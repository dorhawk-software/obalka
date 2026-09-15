// AuthService (feature 001).
//
// Orchestrates ISDS login over an injected `IsdsTransport`. CONTRACT: no method ever rejects/throws -
// every path resolves to a typed `LoginOutcome`. This is the heart of the "zero crashes" guarantee
// (spec SC-002, constitution Principle II), and it is fully unit-tested with a fake transport.

import {
  IsdsTransport,
  OtpSubmitArgs,
  TransportNetworkError,
  TransportResult,
  TransportTimeoutError,
} from '../../../services/isds/transport';
import type {
  AuthMethod,
  Host,
  LoginErrorCode,
  LoginOutcome,
} from '../../../services/isds/types';
import { messageKeyForError } from '../../../i18n/loginMessages';

export interface BeginLoginInput {
  loginName: string;
  password: string;
  method: AuthMethod;
  host: Host;
  signal: AbortSignal;
}

export interface AuthServiceDeps {
  transport: IsdsTransport;
  /** Environment host used for follow-up calls (submit/resend/reauth). Defaults to czebox. */
  host?: Host;
  /** Resolve the stored login name for an existing box (used by reauthenticate). */
  resolveLoginName?: (boxId: string) => Promise<string>;
  /** Injectable clock + delay so the Mobile Key poll loop is unit-testable without real timers. */
  now?: () => number;
  delay?: (ms: number) => Promise<void>;
}

/** Mobile Key login: poll cadence + the 240 s approval window (per MobilniKlic_autentizace.pdf). */
const MEP_POLL_INTERVAL_MS = 1000;
const MEP_TIMEOUT_MS = 240_000;

type PendingOtp = {
  loginName: string;
  password: string;
  method: 'otp_totp';
  host: Host;
};

export class IsdsAuthService {
  private pending: PendingOtp | null = null;
  /**
   * Counts the steps that take the shared jar over - a start, a resend, a code, a Mobile Key sign-in -
   * and the person leaving (`abandon`). A step that ends short empties the jar only while it is still
   * the latest (`endHandshake`). A cancel aborts only the request the controller holds and lets a new
   * sign-in start at once, so an aborted request can run on past that new sign-in - and failing there,
   * it emptied the handshake the new sign-in had to ride. (The code screen also offered to send the code
   * again while the first SMS request was out, the same race through a resend; `LoginController` has
   * refused that since 2026-09-23.)
   */
  private handshake = 0;
  private readonly host: Host;
  private readonly now: () => number;
  private readonly delay: (ms: number) => Promise<void>;

  constructor(private readonly deps: AuthServiceDeps) {
    this.host = deps.host ?? 'czebox';
    this.now = deps.now ?? (() => Date.now());
    this.delay =
      deps.delay ?? (ms => new Promise<void>(r => setTimeout(r, ms)));
  }

  /** Start a login. NEVER throws. */
  async beginLogin(input: BeginLoginInput): Promise<LoginOutcome> {
    const handshake = ++this.handshake;
    const result = await this.guard(input.signal, async () => {
      if (input.method === 'password') {
        const r = await this.deps.transport.passwordLogin({
          loginName: input.loginName,
          password: input.password,
          host: input.host,
          signal: input.signal,
        });
        const outcome = this.mapResult(r);
        // A rejected password may simply mean the box now requires a one-time code (enabling OTP
        // disables password-only login). Hint the UI to offer the OTP methods.
        if (outcome.kind === 'error' && outcome.code === 'invalidCredentials') {
          return { ...outcome, suggestOtp: true };
        }
        return outcome;
      }

      if (input.method === 'mobile_key') {
        // Mobile Key has its own entry point (mobileKeyLogin); beginLogin isn't used for it.
        return this.error('serverFault');
      }

      // SMS code: remember credentials (transient, in-memory only) for the submit step.
      this.pending = {
        loginName: input.loginName,
        password: input.password,
        method: input.method,
        host: input.host,
      };

      // Trigger the SMS now.
      const r = await this.deps.transport.otpBegin({
        loginName: input.loginName,
        password: input.password,
        method: 'otp_totp',
        host: input.host,
        signal: input.signal,
      });
      return this.mapResult(r);
    });
    // Only the SMS request opens a handshake that can stop short. A password login is its own last
    // request and empties the jar itself.
    if (input.method === 'otp_totp') {
      await this.endHandshake(result, input.signal, handshake);
    }
    return result;
  }

  /** Submit the SMS code after `needsOtpSms`. NEVER throws. */
  async submitOtp(code: string, signal: AbortSignal): Promise<LoginOutcome> {
    // The code rides the handshake and ends it itself (`otpSubmit`), so nothing older may empty the
    // jar under it.
    this.handshake += 1;
    return this.guard(signal, async () => {
      const p = this.pending;
      if (!p) {
        return this.error('serverFault');
      } // no pending OTP login - recover, don't crash
      const args: OtpSubmitArgs = {
        loginName: p.loginName,
        password: p.password,
        code,
        method: p.method,
        host: p.host,
        signal,
      };
      return this.mapResult(await this.deps.transport.otpSubmit(args));
    });
  }

  /**
   * Mobile Key (Mobilní klíč) login. POSTs the init request, then polls until the user approves the
   * push in their Mobile Key app (or declines / the 240 s window lapses), then finalizes. `onStatus`
   * receives each poll status so the UI can narrate ("push sent", "Mobile Key launched", …). NEVER
   * throws. The communication code is the Basic-auth secret, NOT the account password.
   */
  async mobileKeyLogin(
    input: {
      loginName: string;
      communicationCode: string;
      applicationName: string;
      host: Host;
      signal: AbortSignal;
    },
    onStatus?: (status: number, description: string) => void,
  ): Promise<LoginOutcome> {
    const handshake = ++this.handshake;
    // The confirmation is the request that signs in, and empties the jar itself however it ends.
    let confirmed = false;
    const result = await this.guard(input.signal, async () => {
      const args = {
        loginName: input.loginName,
        communicationCode: input.communicationCode,
        applicationName: input.applicationName,
        host: input.host,
        signal: input.signal,
      };
      const begin = await this.deps.transport.mepBegin(args);
      if (begin.type === 'authFault') {
        return this.error('invalidCredentials'); // wrong login name / communication code
      }
      if (begin.type !== 'pending') {
        return this.error('serverFault');
      }
      const deadline = this.now() + MEP_TIMEOUT_MS;
      for (;;) {
        if (input.signal.aborted) {
          return this.error('cancelled');
        }
        const poll = await this.deps.transport.mepPoll({
          host: input.host,
          signal: input.signal,
        });
        if (poll.type !== 'state') {
          return this.error('serverFault');
        }
        onStatus?.(poll.status, poll.description);
        if (poll.status === 2) {
          confirmed = true;
          return this.mapResult(await this.deps.transport.mepConfirm(args)); // confirmed → finalize
        }
        if (poll.status === 3) {
          return this.error('mobileKeyRejected'); // user declined / server-side expiry
        }
        if (poll.status === 19 || poll.status === -1) {
          return this.error('serverFault'); // push failed / request unknown
        }
        // 1 / 11 / 12 / 13 → still waiting for the user to approve.
        if (this.now() >= deadline) {
          return this.error('mobileKeyTimeout');
        }
        await this.delay(MEP_POLL_INTERVAL_MS);
      }
    });
    if (!confirmed) {
      await this.endHandshake(result, input.signal, handshake);
    }
    return result;
  }

  /** Re-request a TOTP SMS. NEVER throws. */
  async resendSms(signal: AbortSignal): Promise<LoginOutcome> {
    const handshake = ++this.handshake;
    const result = await this.guard(signal, async () => {
      const p = this.pending;
      if (!p) {
        return this.error('serverFault');
      }
      return this.mapResult(
        await this.deps.transport.resendSms({
          loginName: p.loginName,
          password: p.password,
          host: p.host,
          signal,
        }),
      );
    });
    // A resend is the SMS request again, and starts the handshake over.
    await this.endHandshake(result, signal, handshake);
    return result;
  }

  /**
   * The person left this sign-in - cancelled it, or left its screen - possibly while it waits on them
   * for a code or a Mobile Key approval. NEVER throws.
   *
   * Its handshake is over: the cookie its first request left in the shared jar goes
   * (`IsdsTransport.abandonLogin`), and so does the password kept for the code. Called when the
   * person leaves, not when an aborted request or Mobile Key wait next wakes: by then another sign-in
   * may have started, and emptying the jar would take the cookie that sign-in's first step set.
   */
  async abandon(): Promise<void> {
    this.pending = null;
    this.handshake += 1;
    await this.emptyJar();
  }

  /** Re-authenticate an existing box whose session expired (US5), scoped to one box. NEVER throws. */
  async reauthenticate(
    boxId: string,
    password: string,
    otp: string | null,
    signal: AbortSignal,
  ): Promise<LoginOutcome> {
    return this.guard(signal, async () => {
      const loginName = this.deps.resolveLoginName
        ? await this.deps.resolveLoginName(boxId)
        : boxId;
      if (otp == null) {
        return this.mapResult(
          await this.deps.transport.passwordLogin({
            loginName,
            password,
            host: this.host,
            signal,
          }),
        );
      }
      return this.mapResult(
        await this.deps.transport.otpSubmit({
          loginName,
          password,
          code: otp,
          method: 'otp_totp',
          host: this.host,
          signal,
        }),
      );
    });
  }

  private mapResult(r: TransportResult): LoginOutcome {
    switch (r.type) {
      case 'success':
        return {
          kind: 'signedIn',
          ownerInfo: r.ownerInfo,
          sessionCookie: r.sessionCookie ?? null,
        };
      case 'otpSmsSent':
        return { kind: 'needsOtpSms', notice: r.notice };
      case 'authFault':
        return this.error('invalidCredentials');
      case 'otpFault':
        return this.error('invalidOrExpiredOtp');
      case 'smsNotDelivered':
        return this.error('smsNotDelivered');
      case 'passwordChangeRequired':
        return this.error('passwordChangeRequired');
      case 'serverFault':
        return this.error('serverFault');
      default:
        return this.error('serverFault');
    }
  }

  /**
   * A sign-in ended before the request that signs in - refused, failed on the way, declined, timed
   * out, or its status poll failed - and left its first request's cookie in the shared jar. Nothing
   * continues it, so the jar is emptied. Not while the sign-in waits for a code, whose submission has
   * to ride that cookie, not for one that was cancelled - `abandon` ended it when it happened - and not
   * once a later step has taken the jar over (`handshake`): what is in it then is that step's.
   */
  private async endHandshake(
    outcome: LoginOutcome,
    signal: AbortSignal,
    handshake: number,
  ): Promise<void> {
    if (
      outcome.kind === 'needsOtpSms' ||
      signal.aborted ||
      handshake !== this.handshake
    ) {
      return;
    }
    await this.emptyJar();
  }

  private async emptyJar(): Promise<void> {
    try {
      await this.deps.transport.abandonLogin();
    } catch {
      // The real transport never throws here. A cookie left behind is emptied by the next sign-in's
      // first step; a sign-in that rejected would be a crash.
    }
  }

  private error(code: LoginErrorCode): LoginOutcome {
    return {
      kind: 'error',
      code,
      recoverable: true,
      messageKey: messageKeyForError(code),
    };
  }

  /** Wraps an operation so cancellation and any thrown low-level error become recoverable outcomes. */
  private async guard(
    signal: AbortSignal,
    fn: () => Promise<LoginOutcome>,
  ): Promise<LoginOutcome> {
    if (signal.aborted) {
      return this.error('cancelled');
    }
    try {
      return await fn();
    } catch (e: unknown) {
      if (signal.aborted || (e instanceof Error && e.name === 'AbortError')) {
        return this.error('cancelled');
      }
      if (e instanceof TransportTimeoutError) {
        return this.error('timeout');
      }
      if (e instanceof TransportNetworkError) {
        return this.error('network');
      }
      return this.error('serverFault'); // unknown error - never rethrow
    }
  }
}
