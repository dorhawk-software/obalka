// Real ISDS transport (feature 001): speaks SOAP/HTTP to the ISDS access points via an injected
// HttpClient. Validated end-to-end against a real czebox test box (password AND TOTP/SMS):
//   - Password-only box: HTTP Basic on ws1 `/DS/DsManage` → GetOwnerInfoFromLogin / GetPasswordInfo.
//   - OTP box: the password method returns 401; instead the `as/processLogin` flow on the PORTAL
//     host (www.*) authenticates - the one-time code is APPENDED TO THE PASSWORD in HTTP Basic, the
//     body is a SOAP DummyOperation - and sets an `IPCZ-X-COOKIE` session cookie, after which SOAP
//     calls run at `{portal}/apps/DS/DsManage` carrying that cookie.
//
// Per the IsdsTransport contract, this layer THROWS low-level errors (network/timeout) which the
// AuthService maps to recoverable outcomes; business outcomes are returned as TransportResult.

import {
  appsDfUrl,
  appsDsManageUrl,
  appsDxUrl,
  appsDzUrl,
  appsVodzUrl,
  dfUrl,
  dsManageUrl,
  dxUrl,
  dzUrl,
  mepLoginUrl,
  mepStateUrl,
  processLoginUrl,
  vdzWsUrl,
} from './endpoints';
import { decodeEncodedWord } from './headerText';
import { reportFailure } from '../telemetry/telemetry';
import type { CookieJar } from './cookieJar';
import type { AuthMethod, Host, MessageDetail } from './types';
import { HttpClient, HttpResponse, basicAuthHeader } from './httpClient';
import { redirectedToSignIn } from './signInRedirect';
import { cutSignature, parseSignedMessage } from './signedMessage';
import {
  STATUS_MESSAGE_DELETED,
  STATUS_OK,
  STATUS_WRONG_SERVICE_FOR_TYPE,
  buildCreateBigMessage,
  buildCreateMessage,
  buildDataBoxCreditInfo,
  buildDummyOperation,
  buildISDSSearch3,
  buildGetListOfReceivedMessages,
  buildGetListOfSentMessages,
  buildGetOwnerInfoFromLogin,
  buildGetPasswordInfo,
  buildMarkMessageAsDownloaded,
  buildMessageDownload,
  buildSignedMessageDownload,
  buildSignedSentMessageDownload,
  buildUploadAttachment,
  parseCreateBigMessage,
  parseCreateMessage,
  parseDataBoxCreditInfo,
  parseISDSSearch3,
  parseMessageDownload,
  parseMessageList,
  parseSoapBody,
  parseSoapBodyWithAttrs,
  parseUploadAttachment,
  readDmStatusCode,
  readPasswordExpiry,
  readStatusCode,
  toOwnerInfo,
} from './soap';
import {
  CreditInfoResult,
  DownloadMessageArgs,
  FindRecipientsArgs,
  FindRecipientsResult,
  GetCreditInfoArgs,
  IsdsTransport,
  ListMessagesArgs,
  MessageDetailResult,
  MessageListResult,
  MessageMarkResult,
  MobileKeyBeginResult,
  MobileKeyLoginArgs,
  MobileKeyPollArgs,
  MobileKeyPollResult,
  OtpBeginArgs,
  OtpSubmitArgs,
  PasswordLoginArgs,
  SendMessageArgs,
  SendMessageResult,
  SignedMessageResult,
  TransportResult,
} from './transport';

const DEFAULT_TIMEOUT_MS = 30_000;
// A message download can carry up to ~20 MB of attachments (sent messages add the CMS envelope on
// top), which over a slow link easily outruns the default timeout - give downloads their own budget.
const DOWNLOAD_TIMEOUT_MS = 120_000;
const SOAP_HEADERS = {
  'Content-Type': 'text/xml; charset=utf-8',
  SOAPAction: '""',
};

type AnyNode = Record<string, unknown>;
type Headers = Record<string, string>;

/**
 * A note, kept across a restart, that a sign-in has a handshake open in the shared cookie jar (018
 * FR-003, 2026-09-24). Every sign-in empties the jar when it ends, but a process killed mid-sign-in ends
 * nothing, and the native store outlives it. The app empties the jar at launch when the note says so,
 * rather than on every launch. Neither call rejects.
 */
export interface HandshakeMark {
  /** A sign-in is about to ride the jar. */
  open(): Promise<void>;
  /** The jar has been emptied. */
  close(): Promise<void>;
}

export class IsdsHttpTransport implements IsdsTransport {
  /**
   * `jar` is the shared native cookie store, and it is used around logins only: emptied when one
   * starts so no login inherits another box's session, read straight after one to capture the
   * session that login established (018), and emptied again when the login is over, however and
   * wherever it ended, so no copy of that session or of a half-finished handshake stays outside the
   * vault (`endHandshake`, `abandonLogin`, 001 T028). It is never consulted for a WS call; those
   * carry the captured cookie explicitly.
   *
   * REQUIRED, and deliberately so. It defaulted to `NoopCookieJar` for about an hour, and in that
   * hour the app was built without one: every login captured `null`, every stored session was empty,
   * and every call then reported "your sign-in expired" - no matter how many times the user signed
   * in. A default that quietly does nothing turns a forgotten wire into a silent runtime failure.
   * Required, it is a compile error. Tests pass `new NoopCookieJar()` explicitly, which also reads
   * as a statement that they do not exercise sessions.
   */
  constructor(
    private readonly http: HttpClient,
    private readonly jar: CookieJar,
    /** Optional: the app passes one (`deps.ts`); a test that does not look at launches need not. */
    private readonly mark?: HandshakeMark,
  ) {}

  /**
   * Snapshot the session this box's login just established, for replay on its own calls. The login
   * that asks empties the jar straight after (`endHandshake`).
   */
  private async captureSession(host: Host): Promise<string | null> {
    try {
      return await this.jar.readSession(appsDsManageUrl(host));
    } catch (e) {
      // A box that cannot capture its session still "works" until the second box logs in and the
      // shared cookie jar hands one person's mail to the other. Exactly the class of failure that
      // is invisible from the outside and expensive when it happens (018).
      reportFailure('isds.login', e, { stage: 'native', host });
      return null; // no session captured → the next call 401s → re-auth. Never a crash.
    }
  }


  /**
   * A cookie-authenticated box with no stored session cannot make a WS call at all.
   *
   * Letting it try sends an UNAUTHENTICATED request, and ISDS answers that with something that is
   * not a 401 - so it surfaced to the user as "Zprávy se nepodařilo načíst" rather than "sign in
   * again". Reported from the device, 2026-08-17.
   *
   * It also makes the upgrade safe: every existing OTP box has no stored session the first time this
   * code runs, and the honest answer for all of them is re-authentication, said plainly.
   */
  private missingSession(args: {
    authMethod: AuthMethod;
    sessionCookie: string | null;
  }): boolean {
    return args.authMethod !== 'password' && !args.sessionCookie;
  }

  /**
   * Did this call fail because the box's session is gone?
   *
   * A 401/403 is the obvious case. The one that cost a user their re-auth prompt is the other one:
   * **ISDS answers a WS call carrying a dead session cookie with HTTP 200 and a body of pure
   * whitespace** - 26 bytes of spaces and newlines, no SOAP envelope, no fault, no status code.
   * Captured from a production box on 2026-08-19.
   *
   * Read as a server error, that produced the worst possible outcome: the list screen kept the cache
   * and told the user they were OFFLINE. They were not offline, they were signed out, and the one
   * action that would have fixed it - the "Přihlásit se znovu" strip - is shown only for an auth
   * fault. The app stated something false about the network and hid the real recovery.
   *
   * Scoped to cookie-authenticated boxes on purpose. A password box re-authenticates on every call
   * with HTTP Basic and gets a proper 401; an empty 200 there is a server misbehaving, and telling
   * that user to sign in again would be a second wrong guess.
   *
   * The third shape (2026-09-15): the portal turning the call away to its sign-in page. That is how
   * `/apps/DS/*` answers a request without a session, and fetch follows the redirect, so the page
   * arrives as a 200 WITH markup and used to parse as a server fault (`signInRedirect.ts`).
   */
  private sessionLost(usesBasic: boolean, res: HttpResponse): boolean {
    if (res.status === 401 || res.status === 403) {
      return true;
    }
    if (usesBasic) {
      return false;
    }
    // Deliberately narrow: not "unparseable", but "contains no XML at all". A genuine SOAP fault
    // carries an envelope and must stay a server fault.
    if (res.status === 200 && !res.text.includes('<')) {
      return true;
    }
    return redirectedToSignIn({
      status: res.status,
      urls: res.url != null ? [res.url] : [],
      headers: res.headers,
    });
  }

  /**
   * Empty the shared jar so a login cannot inherit, or leak into, another box's session.
   *
   * Around logins only: when one starts, once its last request is over (`endHandshake`), and when it
   * ends before that request (`abandonLogin`). So between logins the jar holds nothing, and removing
   * a box no longer empties it (018 T010, amended 2026-09-15): a removal found either nothing there
   * or a sign-in's handshake still in progress, which it broke. Nothing else reads the jar - every WS
   * call carries its box's own session with `useJar: false`, the VoDZ downloads keep it out with the
   * patched `omitCookies` (018 T006, T015). Never throws.
   */
  private async resetJar(): Promise<void> {
    try {
      await this.jar.clearAll();
    } catch (e) {
      reportFailure('isds.login', e, { stage: 'native' });
      // best-effort: a jar we could not clear is a reason to be careful, not to block a login. The
      // handshake mark stays, so the next launch tries again.
      return;
    }
    await this.mark?.close();
  }

  /**
   * A sign-in starts: empty the jar, then note that this sign-in is about to leave a handshake in it,
   * which only an emptied jar takes back (`resetJar`). Before the request, so a process killed while it
   * is out is still noted.
   */
  private async startHandshake(): Promise<void> {
    await this.resetJar();
    await this.mark?.open();
  }

  /**
   * A login's last request is over, however it ended: empty the jar.
   *
   * What a login leaves there is a bearer session, and the native store is not the vault: it stays
   * readable while the app is locked, which is what sealing every session under the vault key exists
   * to prevent (001 T028). Nothing reads it after this point. A login that succeeded has taken its
   * copy out (`captureSession`), and every ISDS call carries that copy with the jar kept out -
   * `useJar: false` on each WS request here, `omitCookies` on the VoDZ downloads (018 T006, T015). A
   * login that failed is never continued: the next attempt starts over from its first step, which
   * empties the jar again. Never throws.
   */
  private endHandshake(): Promise<void> {
    return this.resetJar();
  }

  /**
   * A login ended before its last request, so `endHandshake` never ran: empty the jar.
   *
   * What its first request left - the portal session an SMS request opens, the Mobile Key S-COOKIE -
   * is not a box's session yet, but it is half of a sign-in, in a store that stays readable while the
   * app is locked, and nothing will ever ride it again: the next attempt starts over from its first
   * step. Which endings those are is the sign-in's to know (`IsdsAuthService`), not a request's - a
   * declined push is a well-formed answer, a timeout is no answer at all. Never throws.
   */
  abandonLogin(): Promise<void> {
    return this.resetJar();
  }

  // --- Username + password (password-only boxes) ---------------------------
  async passwordLogin(args: PasswordLoginArgs): Promise<TransportResult> {
    // Even a password login can leave cookies behind, and a leftover session belonging to some other
    // box is exactly what poisoned the remove-then-re-add handshake (018).
    await this.startHandshake();
    try {
      const url = dsManageUrl(args.host);
      const headers: Headers = {
        ...SOAP_HEADERS,
        Authorization: basicAuthHeader(args.loginName, args.password),
      };
      const res = await this.http.send({
        url,
        method: 'POST',
        headers,
        body: buildGetOwnerInfoFromLogin(),
        signal: args.signal,
        timeoutMs: DEFAULT_TIMEOUT_MS,
      });
      // Awaited here, not returned as a promise: the expiry lookup rides the jar too, and the reset
      // below has to come after it.
      return await this.enrichWithExpiry(
        this.interpretOwnerInfo(res.status, res.text),
        url,
        headers,
        args.signal,
      );
    } finally {
      // And emptied again once the login is over (`endHandshake`).
      await this.endHandshake();
    }
  }

  // --- OTP via the portal as/processLogin flow -----------------------------
  // TOTP step 1: dispatch the SMS. ISDS replies 302 with header
  // `X-Response-message-code: authentication.info.totpSended`; a non-auth-error send means "sent".
  async otpBegin(args: OtpBeginArgs): Promise<TransportResult> {
    // Step ONE of the OTP handshake, and therefore where the jar is emptied: this box must not
    // inherit whatever session the last box left behind, and everything after this point in the
    // flow - including the code submission - depends on the session THIS request establishes (018).
    await this.startHandshake();
    const res = await this.http.send({
      url: processLoginUrl(args.host, { sendSms: true }),
      method: 'POST',
      headers: {
        ...SOAP_HEADERS,
        Authorization: basicAuthHeader(args.loginName, args.password),
      },
      body: buildDummyOperation(),
      signal: args.signal,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
    if (res.status === 401 || res.status === 403) {
      return { type: 'authFault' };
    }
    const code = res.headers?.['x-response-message-code'];
    const text = decodeEncodedWord(res.headers?.['x-response-message-text']);
    const notice = code || text ? { code, text } : undefined;
    return { type: 'otpSmsSent', notice };
  }

  // Submit the one-time code (appended to the password). On success processLogin sets the session
  // cookie; we confirm identity via GetOwnerInfoFromLogin at /apps/DS/DsManage carrying that cookie.
  async otpSubmit(args: OtpSubmitArgs): Promise<TransportResult> {
    // NO resetJar before the code, deliberately. That is step TWO of a two-step handshake: `otpBegin`
    // sent the SMS and established the portal session this request has to ride. Clearing between the
    // steps throws that session away and the code submission cannot work, so the jar is emptied at
    // the flow's START (otpBegin).
    try {
      await this.http.send({
        url: processLoginUrl(args.host),
        method: 'POST',
        headers: {
          ...SOAP_HEADERS,
          Authorization: basicAuthHeader(
            args.loginName,
            args.password + args.code,
          ),
        },
        body: buildDummyOperation(),
        signal: args.signal,
        timeoutMs: DEFAULT_TIMEOUT_MS,
      });
      const result = await this.fetchOwnerInfo(
        appsDsManageUrl(args.host),
        SOAP_HEADERS,
        args.signal,
      );
      // After the OTP step a non-success means the code was wrong/expired.
      if (result.type !== 'success') {
        return { type: 'otpFault' };
      }
      // Take this box's session OUT of the shared jar and hand it back, so it can be stored against
      // this box and replayed only on this box's calls (018).
      return { ...result, sessionCookie: await this.captureSession(args.host) };
    } finally {
      // The handshake is over whichever way it went, and nothing needs the jar any more.
      await this.endHandshake();
    }
  }

  async resendSms(args: PasswordLoginArgs): Promise<TransportResult> {
    return this.otpBegin({ ...args, method: 'otp_totp' });
  }

  // --- Mobile Key (Mobilní klíč) via the portal as/processLogin?type=mep-ws flow ------------
  // Spec: docs/isds-mobile-key/MobilniKlic_autentizace.md. Step 1: POST with
  // Basic(loginName:communicationCode) → a working S-COOKIE in the native jar; ISDS then pushes the
  // user's Mobile Key app for approval. We don't read the cookie value (the native jar carries it).
  async mepBegin(args: MobileKeyLoginArgs): Promise<MobileKeyBeginResult> {
    // This POST establishes the S-COOKIE the whole Mobile Key handshake rides, so the jar must be
    // empty going in - otherwise the handshake can pick up another box's session (018).
    await this.startHandshake();
    const res = await this.http.send({
      url: mepLoginUrl(args.host, args.applicationName),
      method: 'POST',
      headers: {
        ...SOAP_HEADERS,
        Authorization: basicAuthHeader(args.loginName, args.communicationCode),
      },
      body: buildDummyOperation(),
      signal: args.signal,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
    if (res.status === 401 || res.status === 403) {
      return { type: 'authFault' }; // wrong login name / communication code
    }
    // A real begin is a 2xx/3xx that sets the S-COOKIE. Anything ≥400 (e.g. a Tomcat 400 from a stale
    // cookie poisoning the handshake) is NOT a pending login - fail fast instead of polling a request
    // that never got created (which otherwise returns status -1 → a misleading serverFault).
    if (res.status >= 400) {
      return { type: 'serverFault' };
    }
    return { type: 'pending' }; // S-COOKIE set + push dispatched; poll next
  }

  // Step 2: poll the login status (the S-COOKIE rides the native jar). JSON {status, description}.
  async mepPoll(args: MobileKeyPollArgs): Promise<MobileKeyPollResult> {
    const res = await this.http.send({
      url: mepStateUrl(args.host),
      method: 'GET',
      signal: args.signal,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
    if (res.status !== 200) {
      return { type: 'serverFault' };
    }
    try {
      const json = JSON.parse(res.text) as {
        status?: unknown;
        description?: unknown;
      };
      if (typeof json.status !== 'number') {
        return { type: 'serverFault' };
      }
      return {
        type: 'state',
        status: json.status,
        description:
          typeof json.description === 'string' ? json.description : '',
      };
    } catch (e) {
      // Mobile Key polling. A parse failure here stalls a login that looks, to the user, like the
      // other app simply never answered.
      reportFailure('isds.mobileKey', e, { stage: 'parse' });
      return { type: 'serverFault' };
    }
  }

  // Step 3 (only after a status-2 poll): POST again → the IPCZ-X-COOKIE WS session, then confirm
  // identity via owner info - the same second half as otpSubmit.
  async mepConfirm(args: MobileKeyLoginArgs): Promise<TransportResult> {
    try {
      await this.http.send({
        url: mepLoginUrl(args.host, args.applicationName),
        method: 'POST',
        headers: {
          ...SOAP_HEADERS,
          Authorization: basicAuthHeader(args.loginName, args.communicationCode),
        },
        body: buildDummyOperation(),
        signal: args.signal,
        timeoutMs: DEFAULT_TIMEOUT_MS,
      });
      const result = await this.fetchOwnerInfo(
        appsDsManageUrl(args.host),
        SOAP_HEADERS,
        args.signal,
      );
      // Same as the OTP path: the session comes out of the shared jar and belongs to this box alone.
      return result.type === 'success'
        ? { ...result, sessionCookie: await this.captureSession(args.host) }
        : result;
    } finally {
      // The handshake is over whichever way it went, and nothing needs the jar any more.
      await this.endHandshake();
    }
  }

  // --- Message lists (dmInfo /DS/dx) ---------------------------------------
  // Password boxes re-authenticate with HTTP Basic here; OTP boxes have no password-only auth, so
  // they ride the login session cookie at the /apps-prefixed host. A 401 means the session expired.
  async listReceivedMessages(
    args: ListMessagesArgs,
  ): Promise<MessageListResult> {
    const usesBasic = args.authMethod === 'password';
    if (this.missingSession(args)) {
      return { type: 'authFault' }; // no session → say 'sign in again', do not ask ISDS anonymously
    }
    const headers: Headers = { ...SOAP_HEADERS };
    if (usesBasic && args.password != null) {
      headers.Authorization = basicAuthHeader(args.loginName, args.password);
    }
    const res = await this.http.send({
      url: usesBasic ? dxUrl(args.host) : appsDxUrl(args.host),
      method: 'POST',
      headers,
      // 018: this box's own session, and the shared native jar kept out of it. A per-domain
      // jar cannot tell two boxes apart, so `useJar: false` is what makes crossing impossible
      // rather than merely unlikely. A password box carries Basic above and no cookie at all.
      cookie: usesBasic ? undefined : args.sessionCookie ?? undefined,
      useJar: false,
      body: buildGetListOfReceivedMessages(),
      signal: args.signal,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
    if (this.sessionLost(usesBasic, res)) {
      return { type: 'authFault' };
    }
    if (res.status !== 200) {
      return { type: 'serverFault' };
    }
    const body = parseSoapBody(res.text);
    const resp = body.GetListOfReceivedMessagesResponse as AnyNode | undefined;
    if (readDmStatusCode(resp) !== STATUS_OK) {
      return { type: 'serverFault' };
    }
    return { type: 'messages', messages: parseMessageList(body) };
  }

  // --- Sent message list (dmInfo /DS/dx) - for post-timeout reconciliation ---
  async getSentMessages(args: ListMessagesArgs): Promise<MessageListResult> {
    const usesBasic = args.authMethod === 'password';
    if (this.missingSession(args)) {
      return { type: 'authFault' }; // no session → say 'sign in again', do not ask ISDS anonymously
    }
    const headers: Headers = { ...SOAP_HEADERS };
    if (usesBasic && args.password != null) {
      headers.Authorization = basicAuthHeader(args.loginName, args.password);
    }
    const res = await this.http.send({
      url: usesBasic ? dxUrl(args.host) : appsDxUrl(args.host),
      method: 'POST',
      headers,
      // 018: this box's own session, and the shared native jar kept out of it. A per-domain
      // jar cannot tell two boxes apart, so `useJar: false` is what makes crossing impossible
      // rather than merely unlikely. A password box carries Basic above and no cookie at all.
      cookie: usesBasic ? undefined : args.sessionCookie ?? undefined,
      useJar: false,
      body: buildGetListOfSentMessages(),
      signal: args.signal,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
    if (this.sessionLost(usesBasic, res)) {
      return { type: 'authFault' };
    }
    if (res.status !== 200) {
      return { type: 'serverFault' };
    }
    const body = parseSoapBody(res.text);
    const resp = body.GetListOfSentMessagesResponse as AnyNode | undefined;
    if (readDmStatusCode(resp) !== STATUS_OK) {
      return { type: 'serverFault' };
    }
    return { type: 'messages', messages: parseMessageList(body) };
  }

  // --- Message download (dmOperations /DS/dz) ------------------------------
  // Same auth split as the list: Basic on ws1 for password boxes, the session cookie at /apps for
  // OTP boxes.
  //
  // Both folders download the SIGNED message (004 amendment, 2026-09-14): the operator's sealed
  // original is what the archive keeps, and the detail is read out of it (`signedMessage.ts`). Sent
  // messages always did - MessageDownload is received-only. Received messages used MessageDownload
  // until then, and it is still the call behind the signed one: the received signed download has
  // never been observed on a real box, so anything short of a detail read from the original falls
  // back to it rather than leaving the most-used path in the app unopenable.
  async downloadMessage(
    args: DownloadMessageArgs,
  ): Promise<MessageDetailResult> {
    if (this.missingSession(args)) {
      return { type: 'authFault' }; // no session → say 'sign in again', do not ask ISDS anonymously
    }
    const signed = await this.requestSigned(args);
    if (signed.type === 'authFault' || signed.type === 'unsupported') {
      // A dead session is not revived by a second call, and 1281 ("Zvolená služba není určena pro
      // tento typ zprávy") means a large-volume (VoDZ) message that neither ordinary download serves
      // (bulletin 2175 §3.8) - surfaced distinctly so the controller takes the VoDZ path.
      return signed;
    }
    const read =
      signed.type === 'signed' ? await this.readSigned(signed.signedZfo, args) : null;
    if (signed.type === 'signed' && read?.detail != null) {
      return { type: 'detail', detail: read.detail, signedZfo: signed.signedZfo };
    }
    if (args.signedSent) {
      // There is no unsigned download of a sent message to fall back to. An answer from ISDS is passed
      // on as the answer it was, so a deleted message (1219) can be told from a broken transfer.
      return signed.type === 'gone' || signed.type === 'refused' ? signed : { type: 'serverFault' };
    }
    const unsigned = await this.downloadUnsigned(args);
    // An original that arrived but could not be read is still this message's original, so it travels
    // with the detail the fallback produced. One that names a DIFFERENT message does not.
    return unsigned.type === 'detail' && signed.type === 'signed' && read?.foreign === false
      ? { ...unsigned, signedZfo: signed.signedZfo }
      : unsigned;
  }

  /**
   * Only the signed original (004 amendment): for a message whose detail the archive already holds
   * but which was downloaded before originals were kept. Nothing is parsed, so the attachments already
   * on disk are not touched.
   */
  async downloadSignedMessage(
    args: DownloadMessageArgs,
  ): Promise<SignedMessageResult> {
    if (this.missingSession(args)) {
      return { type: 'authFault' };
    }
    return this.requestSigned(args);
  }

  /** One `/DS/dz` download request, with the auth split and the download timeout. */
  private sendDownload(args: DownloadMessageArgs, body: string) {
    const usesBasic = args.authMethod === 'password';
    const headers: Headers = { ...SOAP_HEADERS };
    if (usesBasic && args.password != null) {
      headers.Authorization = basicAuthHeader(args.loginName, args.password);
    }
    return this.http.send({
      url: usesBasic ? dzUrl(args.host) : appsDzUrl(args.host),
      method: 'POST',
      headers,
      // 018: this box's own session, and the shared native jar kept out of it. A per-domain
      // jar cannot tell two boxes apart, so `useJar: false` is what makes crossing impossible
      // rather than merely unlikely. A password box carries Basic above and no cookie at all.
      cookie: usesBasic ? undefined : args.sessionCookie ?? undefined,
      useJar: false,
      body,
      signal: args.signal,
      // Attachments can be large (up to 100 MB) - a download needs much longer than a regular call.
      timeoutMs: DOWNLOAD_TIMEOUT_MS,
    });
  }

  /**
   * The signed download for either folder, returning `dmSignature` as it came.
   *
   * A refusal is reported: on the received folder it is the fallback firing, and a fallback that
   * fires on every message would look, from the outside, exactly like everything working.
   */
  private async requestSigned(
    args: DownloadMessageArgs,
  ): Promise<SignedMessageResult> {
    const usesBasic = args.authMethod === 'password';
    const res = await this.sendDownload(
      args,
      args.signedSent
        ? buildSignedSentMessageDownload(args.messageId)
        : buildSignedMessageDownload(args.messageId),
    );
    if (this.sessionLost(usesBasic, res)) {
      return { type: 'authFault' };
    }
    const context = {
      stage: 'transport' as const,
      endpoint: usesBasic ? '/DS/dz' : '/apps/DS/dz',
      folder: args.signedSent ? 'sent' : 'received',
    };
    if (res.status !== 200) {
      reportFailure('isds.download', new Error('The signed download failed.'), {
        ...context,
        httpStatus: res.status,
      });
      return { type: 'serverFault' };
    }
    // The signature is cut out before anything is parsed: as one XML text node it is seconds of the
    // JS thread (`cutSignature`). The parser sees the envelope and the status, nothing else.
    const { skeleton, signature } = cutSignature(res.text);
    const body = parseSoapBody(skeleton);
    const resp = (
      args.signedSent
        ? body.SignedSentMessageDownloadResponse
        : body.SignedMessageDownloadResponse
    ) as AnyNode | undefined;
    const code = readDmStatusCode(resp);
    if (code === STATUS_WRONG_SERVICE_FOR_TYPE) {
      return { type: 'unsupported' };
    }
    if (code !== STATUS_OK) {
      reportFailure('isds.download', new Error('The signed download was refused.'), {
        ...context,
        dmStatusCode: code,
      });
      // With no status at all it is not an answer from ISDS, and must not read as one. Of the answers,
      // only 1219 is ISDS saying it deleted the message; every other code is a refusal to retry.
      if (code == null) {
        return { type: 'serverFault' };
      }
      return code === STATUS_MESSAGE_DELETED ? { type: 'gone' } : { type: 'refused' };
    }
    if (signature == null) {
      reportFailure('isds.download', new Error('The signed download carried no signature.'), {
        ...context,
        dmStatusCode: code,
      });
      return { type: 'serverFault' };
    }
    return { type: 'signed', signedZfo: signature };
  }

  /** The detail inside a signed message, or null when it cannot be read with confidence - reported. */
  private async readSigned(
    signedZfo: string,
    args: DownloadMessageArgs,
  ): Promise<{ detail: MessageDetail | null; foreign: boolean }> {
    const context = {
      stage: 'parse' as const,
      endpoint: args.authMethod === 'password' ? '/DS/dz' : '/apps/DS/dz',
      folder: args.signedSent ? 'sent' : 'received',
      byteSize: signedZfo.length,
    };
    try {
      const detail = await parseSignedMessage(signedZfo);
      if (detail == null) {
        reportFailure('isds.parse', new Error('The signed message was not recognised.'), context);
        return { detail: null, foreign: false };
      }
      if (detail.id !== args.messageId) {
        reportFailure('isds.parse', new Error('The signed message names another message.'), context);
        return { detail: null, foreign: true };
      }
      return { detail, foreign: false };
    } catch (e) {
      reportFailure('isds.parse', e, context);
      return { detail: null, foreign: false };
    }
  }

  /** MessageDownload: a received message without its seal - the fallback behind the signed one. */
  private async downloadUnsigned(
    args: DownloadMessageArgs,
  ): Promise<MessageDetailResult> {
    const res = await this.sendDownload(args, buildMessageDownload(args.messageId));
    if (this.sessionLost(args.authMethod === 'password', res)) {
      return { type: 'authFault' };
    }
    if (res.status !== 200) {
      return { type: 'serverFault' };
    }
    // Parsed with the attribute-aware parser (file metadata are XML attributes).
    const resp = parseSoapBodyWithAttrs(res.text).MessageDownloadResponse as
      | AnyNode
      | undefined;
    const code = readDmStatusCode(resp);
    if (code === STATUS_WRONG_SERVICE_FOR_TYPE) {
      return { type: 'unsupported' };
    }
    if (code === STATUS_OK) {
      return { type: 'detail', detail: parseMessageDownload(resp) };
    }
    // Same reading as the signed download: no status is no answer, 1219 is a deletion, anything else
    // is ISDS refusing for a reason it does not document as one.
    if (code == null) {
      return { type: 'serverFault' };
    }
    return code === STATUS_MESSAGE_DELETED ? { type: 'gone' } : { type: 'refused' };
  }

  // --- Mark as read (dmInfo /DS/dx) ----------------------------------------
  // Same auth split as the list. Marks the message read/downloaded server-side; we only need the
  // status code, so the no-attributes parser is fine.
  async markMessageAsDownloaded(
    args: DownloadMessageArgs,
  ): Promise<MessageMarkResult> {
    const usesBasic = args.authMethod === 'password';
    if (this.missingSession(args)) {
      return { type: 'authFault' }; // no session → say 'sign in again', do not ask ISDS anonymously
    }
    const headers: Headers = { ...SOAP_HEADERS };
    if (usesBasic && args.password != null) {
      headers.Authorization = basicAuthHeader(args.loginName, args.password);
    }
    const res = await this.http.send({
      url: usesBasic ? dxUrl(args.host) : appsDxUrl(args.host),
      method: 'POST',
      headers,
      // 018: this box's own session, and the shared native jar kept out of it. A per-domain
      // jar cannot tell two boxes apart, so `useJar: false` is what makes crossing impossible
      // rather than merely unlikely. A password box carries Basic above and no cookie at all.
      cookie: usesBasic ? undefined : args.sessionCookie ?? undefined,
      useJar: false,
      body: buildMarkMessageAsDownloaded(args.messageId),
      signal: args.signal,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
    if (this.sessionLost(usesBasic, res)) {
      return { type: 'authFault' };
    }
    if (res.status !== 200) {
      return { type: 'serverFault' };
    }
    const resp = parseSoapBody(res.text).MarkMessageAsDownloadedResponse as
      | AnyNode
      | undefined;
    return readDmStatusCode(resp) === STATUS_OK
      ? { type: 'ok' }
      : { type: 'serverFault' };
  }

  // --- Recipient lookup (db_search /DS/df) ---------------------------------
  // Fulltext search (ISDSSearch3) over ALL box types - the recipient search the web portal uses. Same
  // auth split as the message ops: Basic on ws1 for password boxes, the session cookie at /apps for
  // OTP boxes. db_search uses the `dbStatus`/`dbStatusCode` element (like DsManage), not dmStatus.
  async findRecipients(
    args: FindRecipientsArgs,
  ): Promise<FindRecipientsResult> {
    const usesBasic = args.authMethod === 'password';
    if (this.missingSession(args)) {
      return { type: 'authFault' }; // no session → say 'sign in again', do not ask ISDS anonymously
    }
    const headers: Headers = { ...SOAP_HEADERS };
    if (usesBasic && args.password != null) {
      headers.Authorization = basicAuthHeader(args.loginName, args.password);
    }
    const res = await this.http.send({
      url: usesBasic ? dfUrl(args.host) : appsDfUrl(args.host),
      method: 'POST',
      headers,
      // 018: this box's own session, and the shared native jar kept out of it. A per-domain
      // jar cannot tell two boxes apart, so `useJar: false` is what makes crossing impossible
      // rather than merely unlikely. A password box carries Basic above and no cookie at all.
      cookie: usesBasic ? undefined : args.sessionCookie ?? undefined,
      useJar: false,
      body: buildISDSSearch3(args.query),
      signal: args.signal,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
    if (this.sessionLost(usesBasic, res)) {
      return { type: 'authFault' };
    }
    if (res.status !== 200) {
      return { type: 'serverFault' };
    }
    const body = parseSoapBody(res.text);
    const resp = body.ISDSSearch3Response as AnyNode | undefined;
    // A successful search (incl. zero hits) is dbStatusCode 0000; anything else is a real fault.
    if (readStatusCode(resp) !== STATUS_OK) {
      return { type: 'serverFault' };
    }
    return { type: 'recipients', recipients: parseISDSSearch3(body) };
  }

  // --- Send a message (CreateMessage, dmOperations /DS/dz) ------------------
  // Same auth split as MessageDownload (Basic on ws1 for password boxes, cookie at /apps for OTP).
  // The recipient box type decides DZ (free) vs paid PDZ - there is no flag here.
  async sendMessage(args: SendMessageArgs): Promise<SendMessageResult> {
    const usesBasic = args.authMethod === 'password';
    if (this.missingSession(args)) {
      return { type: 'authFault' }; // no session → say 'sign in again', do not ask ISDS anonymously
    }
    const headers: Headers = { ...SOAP_HEADERS };
    if (usesBasic && args.password != null) {
      headers.Authorization = basicAuthHeader(args.loginName, args.password);
    }
    const res = await this.http.send({
      url: usesBasic ? dzUrl(args.host) : appsDzUrl(args.host),
      method: 'POST',
      headers,
      // 018: this box's own session, and the shared native jar kept out of it. A per-domain
      // jar cannot tell two boxes apart, so `useJar: false` is what makes crossing impossible
      // rather than merely unlikely. A password box carries Basic above and no cookie at all.
      cookie: usesBasic ? undefined : args.sessionCookie ?? undefined,
      useJar: false,
      body: buildCreateMessage(args.recipientBoxId, args.subject, args.files),
      signal: args.signal,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
    if (this.sessionLost(usesBasic, res)) {
      return { type: 'authFault' };
    }
    if (res.status !== 200) {
      return { type: 'serverFault' };
    }
    const body = parseSoapBody(res.text);
    const resp = body.CreateMessageResponse as AnyNode | undefined;
    if (readDmStatusCode(resp) !== STATUS_OK) {
      // TODO(czebox/US2): map PDZ dmStatusCodes → recipientRejectsPdz / insufficientCredit.
      return { type: 'serverFault' };
    }
    const messageId = parseCreateMessage(body);
    return messageId ? { type: 'sent', messageId } : { type: 'serverFault' };
  }

  // --- Send a LARGE-volume (VoDZ) message (/DS/vodz) -----------------------
  // Two steps: UploadAttachment each file (the server returns dmAttID + two hashes), then
  // CreateBigMessage referencing them by id+hash. Same typed outcomes as sendMessage, and the same auth
  // split: Basic on `ws2` for a password box (live-validated on czebox, contract isds-bigmessage.md),
  // the box's cookie at the portal's `/apps/DS/vodz` for OTP / Mobile Key. ISDS documents a cookie
  // session only under `{portal}/apps/DS/*`, and `ws2` challenges for Basic - so a cookie sent there
  // would most likely come back 401, read as an expired session, and send the user round re-auth on
  // every attempt (`appsVodzUrl`). The cookie route has not been exercised with a real session yet.
  async sendBigMessage(args: SendMessageArgs): Promise<SendMessageResult> {
    const usesBasic = args.authMethod === 'password';
    if (this.missingSession(args)) {
      return { type: 'authFault' }; // no session → say 'sign in again', do not ask ISDS anonymously
    }
    const headers: Headers = { ...SOAP_HEADERS };
    if (usesBasic && args.password != null) {
      headers.Authorization = basicAuthHeader(args.loginName, args.password);
    }
    const url = usesBasic ? vdzWsUrl(args.host) : appsVodzUrl(args.host);

    // 1. Upload each file → its dmExtFile reference (server-computed id + hashes).
    const extFiles = [];
    for (const file of args.files) {
      const res = await this.http.send({
        url,
        method: 'POST',
        headers,
        // 018: this box's own session, and the shared native jar kept out of it. A per-domain
        // jar cannot tell two boxes apart, so `useJar: false` is what makes crossing impossible
        // rather than merely unlikely. A password box carries Basic above and no cookie at all.
        cookie: usesBasic ? undefined : args.sessionCookie ?? undefined,
        useJar: false,
        body: buildUploadAttachment(file),
        signal: args.signal,
        timeoutMs: DEFAULT_TIMEOUT_MS,
      });
      if (this.sessionLost(usesBasic, res)) {
        return { type: 'authFault' };
      }
      if (res.status !== 200) {
        return { type: 'serverFault' };
      }
      const body = parseSoapBodyWithAttrs(res.text);
      if (
        readDmStatusCode(body.UploadAttachmentResponse as AnyNode) !== STATUS_OK
      ) {
        return { type: 'serverFault' };
      }
      const ref = parseUploadAttachment(body);
      if (ref == null) {
        return { type: 'serverFault' };
      }
      extFiles.push({ ...ref, isMain: file.isMain });
    }

    // 2. CreateBigMessage referencing the uploaded files.
    const res = await this.http.send({
      url,
      method: 'POST',
      headers,
      // 018: the same box's session as the uploads above - the create step references their ids,
      // and a session belonging to anyone else would be sending under that person's name.
      cookie: usesBasic ? undefined : args.sessionCookie ?? undefined,
      useJar: false,
      body: buildCreateBigMessage(args.recipientBoxId, args.subject, extFiles),
      signal: args.signal,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
    if (this.sessionLost(usesBasic, res)) {
      return { type: 'authFault' };
    }
    if (res.status !== 200) {
      return { type: 'serverFault' };
    }
    const body = parseSoapBody(res.text);
    if (
      readDmStatusCode(body.CreateBigMessageResponse as AnyNode) !== STATUS_OK
    ) {
      // TODO(czebox/US3): map PDZ dmStatusCodes → recipientRejectsPdz / insufficientCredit (as sendMessage).
      return { type: 'serverFault' };
    }
    const messageId = parseCreateBigMessage(body);
    return messageId ? { type: 'sent', messageId } : { type: 'serverFault' };
  }

  // --- PDZ credit (DataBoxCreditInfo, db_search /DS/df) ---------------------
  async getCreditInfo(args: GetCreditInfoArgs): Promise<CreditInfoResult> {
    const usesBasic = args.authMethod === 'password';
    if (this.missingSession(args)) {
      return { type: 'authFault' }; // no session → say 'sign in again', do not ask ISDS anonymously
    }
    const headers: Headers = { ...SOAP_HEADERS };
    if (usesBasic && args.password != null) {
      headers.Authorization = basicAuthHeader(args.loginName, args.password);
    }
    const res = await this.http.send({
      url: usesBasic ? dfUrl(args.host) : appsDfUrl(args.host),
      method: 'POST',
      headers,
      // 018: this box's own session, and the shared native jar kept out of it. A per-domain
      // jar cannot tell two boxes apart, so `useJar: false` is what makes crossing impossible
      // rather than merely unlikely. A password box carries Basic above and no cookie at all.
      cookie: usesBasic ? undefined : args.sessionCookie ?? undefined,
      useJar: false,
      body: buildDataBoxCreditInfo(args.boxId),
      signal: args.signal,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
    if (this.sessionLost(usesBasic, res)) {
      return { type: 'authFault' };
    }
    if (res.status !== 200) {
      return { type: 'serverFault' };
    }
    const body = parseSoapBody(res.text);
    const resp = body.DataBoxCreditInfoResponse as AnyNode | undefined;
    if (readStatusCode(resp) !== STATUS_OK) {
      return { type: 'serverFault' };
    }
    return { type: 'credit', balanceCzk: parseDataBoxCreditInfo(body) };
  }

  // --- shared helpers ------------------------------------------------------
  private async fetchOwnerInfo(
    wsUrl: string,
    headers: Headers,
    signal: AbortSignal,
  ): Promise<TransportResult> {
    const res = await this.http.send({
      url: wsUrl,
      method: 'POST',
      headers,
      body: buildGetOwnerInfoFromLogin(),
      signal,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
    return this.enrichWithExpiry(
      this.interpretOwnerInfo(res.status, res.text),
      wsUrl,
      headers,
      signal,
    );
  }

  private interpretOwnerInfo(status: number, text: string): TransportResult {
    if (status === 401 || status === 403) {
      return { type: 'authFault' };
    }
    if (status !== 200) {
      return { type: 'serverFault' };
    }
    const body = parseSoapBody(text);
    const resp = body.GetOwnerInfoFromLoginResponse as AnyNode | undefined;
    const code = readStatusCode(resp);
    if (code !== STATUS_OK) {
      // TODO(czebox): map specific dbStatusCode values precisely - once one has been captured.
      //
      // A forced password change is deliberately NOT mapped here. No response carrying one has been
      // captured: the czebox research recorded a WRONG password as HTTP 401 (research.md), which
      // never reaches this line, but not what ISDS sends for an EXPIRED one, and the test
      // credentials needed to find out are not available. Mapping a guessed code would put a "change
      // your password" screen on a status nobody has observed, so a non-OK status stays what it
      // demonstrably is - a server fault.
      //
      // The app tells an expired password from a wrong one without it: after an auth fault it reads
      // the expiry date `GetPasswordInfo` stored at the last sign-in (`mustChangePassword` in
      // `passwordExpiry.ts`, 001 FR-009). If ISDS turns out to answer an expired password HERE, with
      // a status code instead of a 401, that inference cannot see it until the code is mapped.
      return { type: 'serverFault' };
    }
    return {
      type: 'success',
      ownerInfo: toOwnerInfo(resp?.dbOwnerInfo as AnyNode, null),
    };
  }

  /** Best-effort: enrich a successful login with the password-expiry date; never fails the login. */
  private async enrichWithExpiry(
    result: TransportResult,
    wsUrl: string,
    headers: Headers,
    signal: AbortSignal,
  ): Promise<TransportResult> {
    if (result.type !== 'success') {
      return result;
    }
    const expiry = await this.tryPasswordExpiry(wsUrl, headers, signal);
    if (expiry == null) {
      return result;
    }
    return {
      type: 'success',
      ownerInfo: { ...result.ownerInfo, passwordExpiresAt: expiry },
    };
  }

  private async tryPasswordExpiry(
    wsUrl: string,
    headers: Headers,
    signal: AbortSignal,
  ): Promise<number | null> {
    try {
      const res = await this.http.send({
        url: wsUrl,
        method: 'POST',
        headers,
        body: buildGetPasswordInfo(),
        signal,
        timeoutMs: DEFAULT_TIMEOUT_MS,
      });
      if (res.status !== 200) {
        return null;
      }
      return readPasswordExpiry(parseSoapBody(res.text));
    } catch (e) {
      // The password-expiry strip is the app's only warning before a box stops working. If this
      // parse breaks, the warning silently never appears again.
      reportFailure('isds.parse', e, { stage: 'parse', endpoint: '/DS/DsManage' });
      return null; // never block login on the expiry lookup
    }
  }
}
