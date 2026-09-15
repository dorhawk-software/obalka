// Per-box ISDS session isolation (feature 018).
//
// The bug this pins down is a data-exposure shape, not a usability defect. RN's native cookie jar is
// per DOMAIN; ISDS cookie sessions (OTP, Mobile Key) are per BOX. Sharing the jar meant a second
// box's login overwrote the first's `IPCZ-X-COOKIE` - after which the first box's calls either 401
// or ride the SECOND box's session, showing one person's legally-privileged mail under another
// person's identity.
//
// So the assertions here are about what goes ON THE WIRE, and the load-bearing one is the negative:
// a WS call must never consult the shared jar. `useJar: false` is what turns "unlikely to cross" into
// "cannot cross".

import { IsdsHttpTransport } from '../../src/services/isds/isdsTransport';
import { NoopCookieJar } from '../../src/services/isds/cookieJar';
import { AccountsController } from '../../src/features/accounts/state/accountsController';
import { IsdsAuthService } from '../../src/features/accounts/state/authService';
import { InMemoryAccountsStore } from '../../src/services/db/accountsStore';
import { InMemorySecureStore } from '../../src/services/secureStore/secureStore';
import type {
  HttpClient,
  HttpRequest,
  HttpResponse,
} from '../../src/services/isds/httpClient';

/** Records every request so the test can assert on the wire, not on the return value. */
class RecordingHttp implements HttpClient {
  readonly sent: HttpRequest[] = [];
  constructor(private readonly reply: (req: HttpRequest) => HttpResponse) {}
  async send(req: HttpRequest): Promise<HttpResponse> {
    this.sent.push(req);
    return this.reply(req);
  }
}

const okList = (): HttpResponse => ({
  status: 200,
  text:
    '<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
    '<soap:Body><GetListOfReceivedMessagesResponse><dmStatus><dmStatusCode>0000</dmStatusCode>' +
    '</dmStatus><dmRecords/></GetListOfReceivedMessagesResponse></soap:Body></soap:Envelope>',
});

const args = (over: Partial<Parameters<IsdsHttpTransport['listReceivedMessages']>[0]> = {}) => ({
  host: 'production' as const,
  authMethod: 'otp_totp' as const,
  loginName: 'boxA',
  password: null,
  sessionCookie: 'IPCZ-X-COOKIE=AAA',
  signal: new AbortController().signal,
  ...over,
});

describe('a WS call carries its own box session, and only that', () => {
  it('sends the box cookie and NEVER touches the shared jar', async () => {
    const http = new RecordingHttp(okList);
    await new IsdsHttpTransport(http, new NoopCookieJar()).listReceivedMessages(args());
    const req = http.sent[0];
    expect(req.cookie).toBe('IPCZ-X-COOKIE=AAA');
    // The whole point: the jar cannot decide who this call is.
    expect(req.useJar).toBe(false);
  });

  it('keeps two boxes apart across consecutive calls', async () => {
    const http = new RecordingHttp(okList);
    const t = new IsdsHttpTransport(http, new NoopCookieJar());
    await t.listReceivedMessages(args({ sessionCookie: 'IPCZ-X-COOKIE=AAA' }));
    await t.listReceivedMessages(
      args({ loginName: 'boxB', sessionCookie: 'IPCZ-X-COOKIE=BBB' }),
    );
    expect(http.sent.map(r => r.cookie)).toEqual([
      'IPCZ-X-COOKIE=AAA',
      'IPCZ-X-COOKIE=BBB',
    ]);
    expect(http.sent.every(r => r.useJar === false)).toBe(true);
  });

  it('gives a PASSWORD box Basic auth and no cookie at all', async () => {
    // Password boxes re-authenticate per call and never hold a session. Handing one a cookie would
    // be inventing an identity for it.
    const http = new RecordingHttp(okList);
    await new IsdsHttpTransport(http, new NoopCookieJar()).listReceivedMessages(
      args({ authMethod: 'password', password: 'pw', sessionCookie: null }),
    );
    const req = http.sent[0];
    expect(req.headers?.Authorization).toMatch(/^Basic /);
    expect(req.cookie).toBeUndefined();
    expect(req.useJar).toBe(false);
  });

  it('does NOT call ISDS at all when the box has no session yet', async () => {
    // Reported from the device: with no session the call went out UNAUTHENTICATED, and ISDS answers
    // that with something that is not a 401 - so the user got "Zprávy se nepodařilo načíst" instead
    // of "sign in again". Refusing to ask anonymously turns a confusing failure into a true one.
    //
    // It is also the upgrade path: every box that authenticated before this feature existed has no
    // stored session, and re-authentication is the honest answer for all of them.
    const http = new RecordingHttp(okList);
    const res = await new IsdsHttpTransport(http, new NoopCookieJar()).listReceivedMessages(
      args({ sessionCookie: null }),
    );
    expect(res).toEqual({ type: 'authFault' });
    expect(http.sent).toHaveLength(0);
  });

  it('still lets a PASSWORD box through with no session - it never has one', async () => {
    const http = new RecordingHttp(okList);
    await new IsdsHttpTransport(http, new NoopCookieJar()).listReceivedMessages(
      args({ authMethod: 'password', password: 'pw', sessionCookie: null }),
    );
    expect(http.sent).toHaveLength(1);
  });

  it('applies the same rule to the SENT list', async () => {
    const http = new RecordingHttp(() => ({
      status: 200,
      text:
        '<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
        '<soap:Body><GetListOfSentMessagesResponse><dmStatus><dmStatusCode>0000</dmStatusCode>' +
        '</dmStatus><dmRecords/></GetListOfSentMessagesResponse></soap:Body></soap:Envelope>',
    }));
    await new IsdsHttpTransport(http, new NoopCookieJar()).getSentMessages(args());
    expect(http.sent[0].cookie).toBe('IPCZ-X-COOKIE=AAA');
    expect(http.sent[0].useJar).toBe(false);
  });
});

// --- The large-message (VoDZ) send ------------------------------------------------------------
//
// The last WS path to be converted, and the one with the most at stake: it is two calls, and both
// went out with neither the box's cookie nor `useJar: false`. For a cookie box that meant the
// attachments were uploaded, and the message then CREATED, under whatever session the shared jar held
// - possibly another box's, which would send one person's documents in another person's name. Every
// request is asserted, because a fix to one of the two is still the bug.
//
// WHERE the session goes is part of the same rule. ISDS documents a cookie session only at the
// portal's `/apps/DS/*`; `ws2` is the HTTP Basic host and challenges anything else with a 401. The
// right cookie on the wrong host is not isolation - it is a 401 that reads as "sign in again", every
// time, however often the user does.

const soap = (inner: string): string =>
  '<?xml version="1.0"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">' +
  `<soapenv:Body>${inner}</soapenv:Body></soapenv:Envelope>`;

/** Answers each VoDZ step with success, telling the two apart by the operation in the body. */
const vodzOk = (req: HttpRequest): HttpResponse => {
  if (req.body?.includes('<p:UploadAttachment>')) {
    return {
      status: 200,
      text: soap(
        '<p:UploadAttachmentResponse xmlns:p="http://isds.czechpoint.cz/v20">' +
          '<p:dmAttID>att-1</p:dmAttID>' +
          '<p:dmAttHash1 AttHashAlg="SHA-1">h1</p:dmAttHash1>' +
          '<p:dmAttHash2 AttHashAlg="SHA-256">h2</p:dmAttHash2>' +
          '<p:dmStatus><p:dmStatusCode>0000</p:dmStatusCode></p:dmStatus>' +
          '</p:UploadAttachmentResponse>',
      ),
    };
  }
  return {
    status: 200,
    text: soap(
      '<p:CreateBigMessageResponse xmlns:p="http://isds.czechpoint.cz/v20">' +
        '<p:dmID>5550123</p:dmID><p:dmStatus><p:dmStatusCode>0000</p:dmStatusCode></p:dmStatus>' +
        '</p:CreateBigMessageResponse>',
    ),
  };
};

const bigFile = (fileName: string, isMain: boolean) => ({
  fileName,
  mimeType: 'application/zip',
  sizeBytes: 25 * 1024 * 1024,
  contentBase64: 'QUJD',
  isMain,
});

const bigArgs = (
  over: Partial<Parameters<IsdsHttpTransport['sendBigMessage']>[0]> = {},
): Parameters<IsdsHttpTransport['sendBigMessage']>[0] => ({
  host: 'production',
  authMethod: 'otp_totp',
  loginName: 'boxA',
  password: null,
  sessionCookie: 'IPCZ-X-COOKIE=AAA',
  recipientBoxId: 'recipient9',
  subject: 'Velká zásilka',
  // Two files, so the upload LOOP is covered and not just its first pass.
  files: [bigFile('a.zip', true), bigFile('b.zip', false)],
  signal: new AbortController().signal,
  ...over,
});

/** Which VoDZ step a recorded request was - so a failure names the call that leaked. */
const step = (req: HttpRequest): string =>
  req.body?.includes('<p:CreateBigMessage>') ? 'CreateBigMessage' : 'UploadAttachment';

const PORTAL_VODZ = 'https://www.datovka.gov.cz/apps/DS/vodz';

describe('the large-message (VoDZ) send carries its own box session, and only that', () => {
  it.each(['otp_totp', 'mobile_key'] as const)(
    'a %s box sends its own cookie to the portal on every upload AND the create - and nothing without one',
    async authMethod => {
      const http = new RecordingHttp(vodzOk);
      const t = new IsdsHttpTransport(http, new NoopCookieJar());
      const res = await t.sendBigMessage(bigArgs({ authMethod }));
      expect(res).toEqual({ type: 'sent', messageId: '5550123' });
      expect(
        http.sent.map(r => [step(r), r.url, r.cookie, r.useJar, r.headers?.Authorization]),
      ).toEqual([
        ['UploadAttachment', PORTAL_VODZ, 'IPCZ-X-COOKIE=AAA', false, undefined],
        ['UploadAttachment', PORTAL_VODZ, 'IPCZ-X-COOKIE=AAA', false, undefined],
        ['CreateBigMessage', PORTAL_VODZ, 'IPCZ-X-COOKIE=AAA', false, undefined],
      ]);

      // With no session there is nothing to carry, and an upload is not free to abandon: ISDS keeps
      // an attachment no message uses for two hours and caps the total size of such orphans (developer
      // bulletin 2024/3, 3.1-3.2). So the send is refused before the first byte.
      const refused = await t.sendBigMessage(bigArgs({ authMethod, sessionCookie: null }));
      expect(refused).toEqual({ type: 'authFault' });
      expect(http.sent).toHaveLength(3);
    },
  );

  it('keeps two boxes apart across consecutive large sends, each on its own environment', async () => {
    const http = new RecordingHttp(vodzOk);
    const t = new IsdsHttpTransport(http, new NoopCookieJar());
    await t.sendBigMessage(bigArgs({ files: [bigFile('a.zip', true)] }));
    await t.sendBigMessage(
      bigArgs({
        host: 'czebox',
        loginName: 'boxB',
        sessionCookie: 'IPCZ-X-COOKIE=BBB',
        files: [bigFile('b.zip', true)],
      }),
    );
    const testPortalVodz = 'https://www.datovka-test.gov.cz/apps/DS/vodz';
    expect(http.sent.map(r => [step(r), r.url, r.cookie])).toEqual([
      ['UploadAttachment', PORTAL_VODZ, 'IPCZ-X-COOKIE=AAA'],
      ['CreateBigMessage', PORTAL_VODZ, 'IPCZ-X-COOKIE=AAA'],
      ['UploadAttachment', testPortalVodz, 'IPCZ-X-COOKIE=BBB'],
      ['CreateBigMessage', testPortalVodz, 'IPCZ-X-COOKIE=BBB'],
    ]);
    expect(http.sent.every(r => r.useJar === false)).toBe(true);
  });

  it('gives a PASSWORD box Basic auth on ws2 and no cookie on both steps, still off the jar', async () => {
    const http = new RecordingHttp(vodzOk);
    await new IsdsHttpTransport(http, new NoopCookieJar()).sendBigMessage(
      bigArgs({ authMethod: 'password', password: 'pw', sessionCookie: null }),
    );
    expect(http.sent).toHaveLength(3);
    for (const req of http.sent) {
      expect(req.url).toBe('https://ws2.datovka.gov.cz/DS/vodz');
      expect(req.headers?.Authorization).toMatch(/^Basic /);
      expect(req.cookie).toBeUndefined();
      expect(req.useJar).toBe(false);
    }
  });
});

// --- The other half: how a session gets captured in the first place ---------------------------
//
// The wire assertions above only matter if each box's cookie was ever taken OUT of the shared jar and
// handed back. These cover that, with a jar that records what was asked of it.

class FakeJar {
  cleared = 0;
  /** What was asked of the jar, in order. */
  readonly log: ('read' | 'clear')[] = [];
  constructor(private readonly session: string | null) {}
  async clearAll(): Promise<void> {
    this.cleared += 1;
    this.log.push('clear');
  }
  async readSession(): Promise<string | null> {
    this.log.push('read');
    return this.session;
  }
}

/** Replies with `reply`, noting how often the jar had been emptied when each request went out. */
function httpNotingJar(jar: FakeJar, reply: () => HttpResponse) {
  const clearedAtSend: number[] = [];
  const http = new RecordingHttp(() => {
    clearedAtSend.push(jar.cleared);
    return reply();
  });
  return { http, clearedAtSend };
}

const submitArgs = (method: 'otp_totp' = 'otp_totp') =>
  ({
    host: 'production',
    authMethod: method,
    method,
    loginName: 'boxA',
    password: 'pw',
    code: '123456',
    signal: new AbortController().signal,
  }) as never;

const mobileKeyArgs = () =>
  ({
    host: 'production',
    loginName: 'boxA',
    communicationCode: 'cc',
    applicationName: 'app',
    signal: new AbortController().signal,
  }) as never;

const refused = (): HttpResponse => ({ status: 401, text: '' });

const ownerInfoOk = (): HttpResponse => ({
  status: 200,
  text:
    '<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
    '<soap:Body><GetOwnerInfoFromLoginResponse><dbOwnerInfo><dbID>abc1234</dbID>' +
    '<dbType>FO</dbType><firmName>Jan Novak</firmName></dbOwnerInfo>' +
    '<dbStatus><dbStatusCode>0000</dbStatusCode></dbStatus>' +
    '</GetOwnerInfoFromLoginResponse></soap:Body></soap:Envelope>',
});

describe('a login captures its own session and leaves the jar clean', () => {
  // NOTE: this once asserted that `otpSubmit` empties the jar BEFORE its requests. That was wrong -
  // clearing there destroys the session `otpBegin` established, which is the very session the code
  // submission has to ride. What it does instead is empty the jar AFTER them (001 T028): the session
  // taken out and stored sealed is the only copy, and the native store is readable while the app is
  // locked.
  it('lets step two ride step one’s session, and empties the jar only once its copy is taken', async () => {
    const jar = new FakeJar('IPCZ-X-COOKIE=NEW');
    const { http, clearedAtSend } = httpNotingJar(jar, ownerInfoOk);
    const res = await new IsdsHttpTransport(http, jar).otpSubmit(submitArgs());
    expect(http.sent.length).toBeGreaterThanOrEqual(2); // the code, then the owner info it unlocked
    expect(clearedAtSend.every(n => n === 0)).toBe(true);
    expect(jar.log).toEqual(['read', 'clear']);
    expect(res.type === 'success' && res.sessionCookie).toBe('IPCZ-X-COOKIE=NEW');
  });

  it('empties the jar after a code that did not sign in, too', async () => {
    // Nothing continues a handshake that failed here: the error screen leads to a new attempt, whose
    // `otpBegin` asks for a new SMS. What this one left in the jar would be kept for nobody.
    const jar = new FakeJar('IPCZ-X-COOKIE=HALF');
    const res = await new IsdsHttpTransport(new RecordingHttp(refused), jar).otpSubmit(submitArgs());
    expect(res).toEqual({ type: 'otpFault' });
    expect(jar.log).toEqual(['clear']);
  });

  it('empties the jar when the submission fails on the way', async () => {
    const jar = new FakeJar('IPCZ-X-COOKIE=HALF');
    const http = {
      send: async (): Promise<HttpResponse> => {
        throw new Error('network down');
      },
    };
    await expect(new IsdsHttpTransport(http, jar).otpSubmit(submitArgs())).rejects.toThrow(
      'network down',
    );
    expect(jar.log).toEqual(['clear']);
  });

  it('takes the Mobile Key session out, then empties the jar', async () => {
    const jar = new FakeJar('IPCZ-X-COOKIE=MK');
    const { http, clearedAtSend } = httpNotingJar(jar, ownerInfoOk);
    const res = await new IsdsHttpTransport(http, jar).mepConfirm(mobileKeyArgs());
    expect(clearedAtSend.every(n => n === 0)).toBe(true);
    expect(jar.log).toEqual(['read', 'clear']);
    expect(res.type === 'success' && res.sessionCookie).toBe('IPCZ-X-COOKIE=MK');
  });

  it('empties the jar after a Mobile Key confirmation that did not sign in', async () => {
    const jar = new FakeJar('IPCZ-X-COOKIE=HALF');
    const res = await new IsdsHttpTransport(new RecordingHttp(refused), jar).mepConfirm(
      mobileKeyArgs(),
    );
    expect(res).toEqual({ type: 'authFault' });
    expect(jar.log).toEqual(['clear']);
  });

  it('empties the jar before a password login and again once its expiry lookup is done', async () => {
    // A password box never stores a session, but whatever ISDS set on these requests landed in the
    // shared store all the same.
    const jar = new FakeJar(null);
    const { http, clearedAtSend } = httpNotingJar(jar, ownerInfoOk);
    const res = await new IsdsHttpTransport(http, jar).passwordLogin({
      host: 'production',
      loginName: 'boxA',
      password: 'pw',
      signal: new AbortController().signal,
    });
    expect(res.type).toBe('success');
    expect(http.sent).toHaveLength(2); // owner info, then the password-expiry lookup
    expect(clearedAtSend).toEqual([1, 1]);
    expect(jar.log).toEqual(['clear', 'clear']);
  });

  it('hands the captured session back on success', async () => {
    const jar = new FakeJar('IPCZ-X-COOKIE=NEW');
    const http = new RecordingHttp(ownerInfoOk);
    const res = await new IsdsHttpTransport(http, jar).otpSubmit({
      host: 'production',
      authMethod: 'otp_totp',
      method: 'otp_totp',
      loginName: 'boxA',
      password: 'pw',
      code: '123456',
      signal: new AbortController().signal,
    } as never);
    // Returned rather than left in the jar - leaving it there is the bug.
    expect(res.type).toBe('success');
    expect(res.type === 'success' && res.sessionCookie).toBe(
      'IPCZ-X-COOKIE=NEW',
    );
  });

  it('survives a jar that throws, rather than failing the login', async () => {
    // Principle II: no session captured means the next call 401s into re-auth. That is a worse day,
    // not a crash.
    const jar = {
      clearAll: async () => {
        throw new Error('no native module');
      },
      readSession: async () => {
        throw new Error('no native module');
      },
    };
    const http = new RecordingHttp(ownerInfoOk);
    const res = await new IsdsHttpTransport(http, jar).otpSubmit({
      host: 'production',
      authMethod: 'otp_totp',
      method: 'otp_totp',
      loginName: 'boxA',
      password: 'pw',
      code: '123456',
      signal: new AbortController().signal,
    } as never);
    expect(res.type).toBe('success');
    expect(res.type === 'success' && res.sessionCookie).toBeNull();
  });
});

// --- WHERE the jar is emptied ------------------------------------------------------------------
//
// "Clear the jar around logins" is not one rule, because OTP and Mobile Key are TWO-STEP handshakes.
// Step one establishes a portal session; step two rides it. Clearing between them throws that
// session away, and the code submission then cannot work - a bug written and caught the same hour.
//
// So: empty at the START of a flow, never in the middle of one - and again once its last step is
// over (above).

describe('the jar is emptied at the start of a flow, never mid-handshake', () => {
  const otpArgs = {
    host: 'production' as const,
    authMethod: 'otp_totp' as const,
    method: 'otp_totp' as const,
    loginName: 'boxA',
    password: 'pw',
    code: '123456',
    signal: new AbortController().signal,
  };

  it('empties it when the SMS is requested (step one)', async () => {
    const jar = new FakeJar(null);
    const http = new RecordingHttp(() => ({ status: 200, text: '', headers: {} }));
    await new IsdsHttpTransport(http, jar).otpBegin(otpArgs as never);
    expect(jar.cleared).toBe(1);
  });

  it('does NOT empty it before the code is submitted (step two)', async () => {
    // The whole point: this request must ride the session step one established.
    const jar = new FakeJar('IPCZ-X-COOKIE=NEW');
    const { http, clearedAtSend } = httpNotingJar(jar, ownerInfoOk);
    await new IsdsHttpTransport(http, jar).otpSubmit(otpArgs as never);
    expect(clearedAtSend.every(n => n === 0)).toBe(true);
  });

  it('does NOT empty it before Mobile Key is confirmed (step three)', async () => {
    const jar = new FakeJar('IPCZ-X-COOKIE=MK');
    const { http, clearedAtSend } = httpNotingJar(jar, ownerInfoOk);
    await new IsdsHttpTransport(http, jar).mepConfirm(mobileKeyArgs());
    expect(clearedAtSend.every(n => n === 0)).toBe(true);
  });

  it('does NOT empty it while Mobile Key is polled (step two)', async () => {
    const jar = new FakeJar(null);
    const http = new RecordingHttp(() => ({ status: 200, text: '{"status":1,"description":""}' }));
    await new IsdsHttpTransport(http, jar).mepPoll({
      host: 'production',
      signal: new AbortController().signal,
    });
    expect(jar.cleared).toBe(0);
  });
});

// --- When a box is removed (018 T010) ----------------------------------------------------------
//
// Removal emptied the jar from 2026-09-14, when the jar could still hold the last login's session. It
// cannot since 2026-09-15: a sign-in empties it once its session is taken out, and a sign-in that ends
// before that empties it too (`unfinishedSignIn.test.ts`). All a removal could find there was a
// sign-in still under way, and emptying the jar - which only empties whole - broke that sign-in.
//
// Walked through the real AccountsController, the real sign-in and the real transport, wired as
// `deps.ts` wires them.

/** The jar a sign-in's requests fill: what the portal set last, until something empties it. */
class PortalJar {
  cookie: string | null = null;
  readonly log: ('read' | 'clear')[] = [];
  async clearAll(): Promise<void> {
    this.log.push('clear');
    this.cookie = null;
  }
  async readSession(): Promise<string | null> {
    this.log.push('read');
    return this.cookie;
  }
}

/**
 * An SMS sign-in at the portal, riding `jar` as the native store does: the SMS request opens a
 * handshake, a code that rides it signs in, and owner info answers only the session that sign-in set.
 * Anything else is a message list.
 */
function smsPortal(jar: PortalJar) {
  return new RecordingHttp(req => {
    if (req.url.includes('sendSms=true')) {
      jar.cookie = 'S-COOKIE=HANDSHAKE';
      return { status: 302, text: '', headers: {} };
    }
    if (req.url.includes('/as/processLogin')) {
      if (jar.cookie !== 'S-COOKIE=HANDSHAKE') {
        return refused();
      }
      jar.cookie = 'IPCZ-X-COOKIE=CCC';
      return { status: 200, text: '' };
    }
    if (req.url.includes('/apps/DS/DsManage')) {
      return jar.cookie === 'IPCZ-X-COOKIE=CCC' ? ownerInfoOk() : refused();
    }
    return okList();
  });
}

describe('removing a box leaves the shared jar to the sign-ins', () => {
  /** Two cookie boxes stored the way their logins left them, over one transport and one jar. */
  async function twoBoxes() {
    const jar = new PortalJar();
    const http = smsPortal(jar);
    const transport = new IsdsHttpTransport(http, jar);
    const accounts = new InMemoryAccountsStore();
    const secureStore = new InMemorySecureStore();
    const controller = new AccountsController({ accounts, secureStore });
    for (const [boxId, cookie] of [
      ['boxA', 'IPCZ-X-COOKIE=AAA'],
      ['boxB', 'IPCZ-X-COOKIE=BBB'],
    ] as const) {
      await controller.addAccount({
        loginName: boxId,
        password: 'pw',
        method: 'otp_totp',
        host: 'production',
        ownerInfo: { boxId, label: boxId, dbType: null, passwordExpiresAt: null },
        sessionCookie: cookie,
      });
    }
    return { jar, http, transport, secureStore, controller };
  }

  it('lets a sign-in waiting for its SMS code finish when a box is removed meanwhile', async () => {
    // A removal queued behind a long one, or finished later, runs whenever its turn comes - here
    // between the SMS request and the code. It emptied the jar there, and the code rode no handshake.
    const { jar, transport, controller } = await twoBoxes();
    const signIn = new IsdsAuthService({ transport, host: 'production' });
    const signal = new AbortController().signal;
    expect(
      await signIn.beginLogin({
        loginName: 'boxC',
        password: 'pw',
        method: 'otp_totp',
        host: 'production',
        signal,
      }),
    ).toMatchObject({ kind: 'needsOtpSms' });

    await controller.removeAccount('boxA');
    expect(jar.cookie).toBe('S-COOKIE=HANDSHAKE');

    expect(await signIn.submitOtp('123456', signal)).toMatchObject({
      kind: 'signedIn',
      sessionCookie: 'IPCZ-X-COOKIE=CCC',
    });
    // …and that sign-in's own end empties the jar, as every sign-in's does.
    expect(jar.cookie).toBeNull();
  });

  it('leaves the remaining box calling ISDS with its own session', async () => {
    const { controller, secureStore, transport, http } = await twoBoxes();
    await controller.removeAccount('boxA');
    // Read where a controller reads it: the secure store, not the accounts row (001 T028).
    const boxB = await secureStore.readSession('boxB');
    await transport.listReceivedMessages(
      args({
        loginName: 'boxB',
        sessionCookie: boxB.status === 'found' ? boxB.value : null,
      }),
    );
    expect(http.sent[0].cookie).toBe('IPCZ-X-COOKIE=BBB');
    expect(http.sent[0].useJar).toBe(false);
  });
});
