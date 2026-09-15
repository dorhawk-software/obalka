// LoginController (feature 001): drives the login UI. It connects the validated pieces - the
// never-throwing AuthService, the total login state machine, and the AccountsController - into a
// single state stream the UI subscribes to. Pure orchestration over injected deps, so it is fully
// unit-tested with fakes; the React hook/screens are a thin layer on top.

import { AccountsController } from './accountsController';
import {
  LoginEvent,
  LoginState,
  initialLoginState,
  loginTransition,
} from './loginMachine';
import { mustChangePassword } from './passwordExpiry';
import { messageKeyForError } from '../../../i18n/loginMessages';
import { DuplicateBoxError } from '../../../services/db/accountsStore';
import type {
  AuthMethod,
  DataBoxAccount,
  Host,
  LoginOutcome,
} from '../../../services/isds/types';

/** The subset of AuthService the controller needs (IsdsAuthService satisfies it structurally). */
export interface LoginAuthService {
  beginLogin(input: {
    loginName: string;
    password: string;
    method: AuthMethod;
    host: Host;
    signal: AbortSignal;
  }): Promise<LoginOutcome>;
  submitOtp(code: string, signal: AbortSignal): Promise<LoginOutcome>;
  resendSms(signal: AbortSignal): Promise<LoginOutcome>;
  mobileKeyLogin(
    input: {
      loginName: string;
      communicationCode: string;
      applicationName: string;
      host: Host;
      signal: AbortSignal;
    },
    onStatus?: (status: number, description: string) => void,
  ): Promise<LoginOutcome>;
  /** The sign-in was cancelled or its screen left: end its handshake. Never rejects. */
  abandon(): Promise<void>;
}

/** Shown in the user's Mobile Key push so they know which app is requesting access. */
const MOBILE_KEY_APP_NAME = 'Obálka';

export interface Credentials {
  loginName: string;
  password: string;
  method: AuthMethod;
  /** ISDS environment chosen on the add-box form (production or czebox test). */
  host: Host;
  /** Optional nickname entered on the add-box form. */
  alias?: string;
  /**
   * Re-authenticating an already-added box (its session expired) rather than adding a new one. On
   * success the controller refreshes the box's stored secret instead of inserting a duplicate row.
   */
  reauth?: boolean;
}

export interface LoginControllerDeps {
  authService: LoginAuthService;
  /**
   * Only what a sign-in writes and reads. Narrow so the shell can hand over one whose `addAccount`
   * first waits for box removals still running (`AppShell`, `RemovalQueue.idle`).
   */
  accountsController: Pick<AccountsController, 'addAccount' | 'reauthAccount' | 'listAccounts'>;
  /** ISDS environment. Defaults to czebox (dev/test). */
  host?: Host;
  /** The clock a refused sign-in is checked against the stored password expiry with (001 FR-009). */
  now?: () => number;
  onChange: (state: LoginState) => void;
}

export class LoginController {
  private currentState: LoginState = initialLoginState;
  /**
   * The request running now - a sign-in, a code check, an SMS resend - or null when none is.
   *
   * It is also the guard (audit 2026-09-23): while it is set, `start`, `retryWithMethod`, `submitOtp`
   * and `resendSms` refuse, so a double tap cannot ask ISDS twice or send a second SMS. It used to be
   * overwritten instead, and a second Mobile Key start then left the first one's poll loop running
   * with nothing able to abort it: Cancel aborted only the second. Claimed synchronously, before
   * anything awaits, because the screens' own guard is state that lands a render late. Cancel and
   * dispose abort it and let it go at once, so a new attempt can start straight away.
   */
  private inFlight: AbortController | null = null;
  private pendingCreds: Credentials | null = null;
  private readonly host: Host;
  private readonly now: () => number;

  constructor(private readonly deps: LoginControllerDeps) {
    this.host = deps.host ?? 'czebox';
    this.now = deps.now ?? (() => Date.now());
  }

  get state(): LoginState {
    return this.currentState;
  }

  /**
   * Begin a login with the entered credentials (any method). Refused - a no-op - while another request
   * of this sign-in is still running (see `inFlight`).
   */
  start(input: Credentials): Promise<void> {
    return this.exclusively(async signal => {
      this.pendingCreds = input;
      if (input.method === 'mobile_key') {
        // Mobile Key: drive the waiting screen; `password` carries the communication code.
        this.dispatch({ type: 'SUBMIT_MOBILE_KEY' });
        await this.applyOutcome(
          await this.deps.authService.mobileKeyLogin(
            {
              loginName: input.loginName,
              communicationCode: input.password,
              applicationName: MOBILE_KEY_APP_NAME,
              host: input.host,
              signal,
            },
            (status, description) => {
              // A cancelled wait can still report one poll that was already on its way.
              if (!signal.aborted) {
                this.dispatch({ type: 'MOBILE_KEY_STATUS', status, description });
              }
            },
          ),
          signal,
        );
        return;
      }
      this.dispatch({ type: 'SUBMIT_CREDENTIALS' });
      await this.applyOutcome(
        await this.deps.authService.beginLogin({
          ...input,
          signal,
        }),
        signal,
      );
    });
  }

  /**
   * Retry the last credentials with an OTP method. Used when a password login was rejected and the
   * box turns out to require a one-time code - the user keeps the login name + password they typed.
   */
  async retryWithMethod(method: AuthMethod): Promise<void> {
    if (!this.pendingCreds) {
      return;
    }
    await this.start({ ...this.pendingCreds, method });
  }

  /** Submit a one-time code after an OTP prompt. Refused while a request is running. */
  submitOtp(code: string): Promise<void> {
    return this.exclusively(async signal => {
      this.dispatch({ type: 'SUBMIT_OTP' });
      await this.applyOutcome(await this.deps.authService.submitOtp(code, signal), signal);
    });
  }

  /** Re-request the TOTP SMS. Refused while a request is running - one tap, one SMS. */
  resendSms(): Promise<void> {
    return this.exclusively(async signal => {
      this.dispatch({ type: 'RESEND_SMS' });
      await this.applyOutcome(await this.deps.authService.resendSms(signal), signal);
    });
  }

  /**
   * Run `request` as THE request in flight, or not at all when one already is (see `inFlight`). The
   * claim is taken before the first await and given back when the request ends - unless a cancel
   * already gave it back, in which case a newer request may hold it now and is left alone.
   */
  private async exclusively(request: (signal: AbortSignal) => Promise<void>): Promise<void> {
    if (this.inFlight) {
      return;
    }
    const mine = new AbortController();
    this.inFlight = mine;
    try {
      await request(mine.signal);
    } finally {
      if (this.inFlight === mine) {
        this.inFlight = null;
      }
    }
  }

  /** Cancel an in-flight attempt, or one waiting for a code or a Mobile Key approval. */
  cancel(): void {
    this.inFlight?.abort();
    this.inFlight = null;
    this.dispatch({ type: 'CANCEL' });
    // Ended now, at the tap - not when the request or Mobile Key wait it aborts next wakes
    // (`IsdsAuthService.abandon`).
    void this.deps.authService.abandon();
  }

  /**
   * The screen driving this sign-in is gone. Android's system Back and the iOS edge swipe leave it
   * without its own Cancel, and the sign-in used to go on regardless: an SMS asked for and never
   * entered kept its handshake's cookie in the shared jar, and a Mobile Key wait kept polling for a
   * screen nobody would see again. The same end as a cancel, with no state left to show.
   */
  dispose(): void {
    this.inFlight?.abort();
    this.inFlight = null;
    void this.deps.authService.abandon();
  }

  /** Dismiss an error to try again. */
  retry(): void {
    this.dispatch({ type: 'RETRY' });
  }

  private setState(state: LoginState): void {
    this.currentState = state;
    this.deps.onChange(state);
  }

  private dispatch(event: LoginEvent): void {
    this.setState(loginTransition(this.currentState, event));
  }

  /**
   * Show - and on success, store - what a request came back with, unless it was cancelled.
   *
   * A cancelled request can come back after the person has started again: a Mobile Key wait notices
   * its abort only after the pause between polls, and a slow network notices it later still. Its
   * answer is about the attempt they left, so it must not land on the one they started since - an
   * `OUTCOME` in `authenticating` or `awaitingMobileKey` replaced the new attempt's screen with the
   * old one's "cancelled" error, and a late `signedIn` would have stored a box under the NEW
   * attempt's credentials (`pendingCreds`). Cancel already said how the old attempt ended.
   */
  private async applyOutcome(outcome: LoginOutcome, signal: AbortSignal): Promise<void> {
    if (signal.aborted) {
      return;
    }
    // On success, persist the box before surfacing the signed-in state so the UI never shows a box
    // that wasn't actually saved. A duplicate (or storage failure) becomes a recoverable error.
    if (outcome.kind === 'signedIn' && this.pendingCreds) {
      const creds = this.pendingCreds;
      this.pendingCreds = null;
      try {
        if (creds.reauth) {
          // Existing box: refresh its secret/session + the method that worked, never a duplicate.
          await this.deps.accountsController.reauthAccount(
            outcome.ownerInfo.boxId,
            creds.password,
            creds.method,
            outcome.ownerInfo.dbType,
            // 018: the session this re-auth established, replacing the one that had expired.
            outcome.sessionCookie ?? null,
            // …and the expiry date ISDS just reported, which a password change has usually moved.
            outcome.ownerInfo.passwordExpiresAt,
          );
        } else {
          await this.deps.accountsController.addAccount({
            ...creds,
            ownerInfo: outcome.ownerInfo,
            // 018: captured at THIS box's login, stored against it, replayed only on its calls.
            sessionCookie: outcome.sessionCookie ?? null,
          });
        }
      } catch (e) {
        if (signal.aborted) {
          return;
        }
        const code = e instanceof DuplicateBoxError ? 'duplicateBox' : 'serverFault';
        this.setState({ status: 'error', code, messageKey: messageKeyForError(code) });
        return;
      }
    }
    const explained = await this.explainRefusal(outcome);
    // Cancelled while the box was being stored or the refusal explained: the same rule as above.
    if (signal.aborted) {
      return;
    }
    this.dispatch({ type: 'OUTCOME', outcome: explained });
  }

  /**
   * A password refused on a box whose stored password has expired says so (001 FR-009).
   *
   * An expired password is assumed to be refused with the same auth fault as a wrong one - no other
   * answer has been captured - so this reads the date `GetPasswordInfo` stored at the box's last
   * sign-in instead (`mustChangePassword`). Only for
   * a PASSWORD attempt on a box already stored under this login and environment - a re-auth, or
   * re-adding a box that is still there. A brand-new box has no stored date, and a one-time-code or
   * Mobile Key attempt is refused for reasons of its own.
   *
   * Replaces the "maybe it needs an SMS code" hint rather than adding to it: once the date says the
   * password itself has run out, a code appended to it cannot help.
   */
  private async explainRefusal(outcome: LoginOutcome): Promise<LoginOutcome> {
    const creds = this.pendingCreds;
    if (
      outcome.kind !== 'error' ||
      outcome.code !== 'invalidCredentials' ||
      creds == null ||
      creds.method !== 'password'
    ) {
      return outcome;
    }
    let stored: DataBoxAccount | undefined;
    try {
      stored = (await this.deps.accountsController.listAccounts()).find(
        a => a.loginName === creds.loginName && a.host === creds.host,
      );
    } catch {
      // The date is a better explanation, not a precondition: unable to read it, the refusal keeps
      // the wording it already had.
      return outcome;
    }
    if (stored == null || !mustChangePassword(stored, this.now())) {
      return outcome;
    }
    return {
      kind: 'error',
      code: 'passwordChangeRequired',
      recoverable: true,
      messageKey: messageKeyForError('passwordChangeRequired'),
    };
  }
}
