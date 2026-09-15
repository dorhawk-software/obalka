import {
  LoginAuthService,
  LoginController,
} from '../../src/features/accounts/state/loginController';
import { AccountsController } from '../../src/features/accounts/state/accountsController';
import { LoginState } from '../../src/features/accounts/state/loginMachine';
import { InMemoryAccountsStore } from '../../src/services/db/accountsStore';
import { InMemorySecureStore } from '../../src/services/secureStore/secureStore';
import type { AuthMethod, Host, LoginOutcome, OwnerInfo } from '../../src/services/isds/types';

const owner: OwnerInfo = { boxId: 'box1', label: 'ACME', dbType: null, passwordExpiresAt: null };

function fakeAuth(seq: {
  begin?: LoginOutcome;
  otp?: LoginOutcome;
  resend?: LoginOutcome;
  mk?: LoginOutcome;
}): LoginAuthService {
  return {
    beginLogin: async () => seq.begin ?? { kind: 'error', code: 'serverFault', recoverable: true, messageKey: 'x' },
    submitOtp: async () => seq.otp ?? { kind: 'error', code: 'serverFault', recoverable: true, messageKey: 'x' },
    resendSms: async () => seq.resend ?? { kind: 'needsOtpSms' },
    mobileKeyLogin: async () => seq.mk ?? { kind: 'error', code: 'serverFault', recoverable: true, messageKey: 'x' },
    abandon: async () => {},
  };
}

function setup(auth: LoginAuthService) {
  const accountsStore = new InMemoryAccountsStore();
  const secureStore = new InMemorySecureStore();
  const accountsController = new AccountsController({
    accounts: accountsStore,
    secureStore,
    now: () => 1,
    genId: () => 'id1',
  });
  const states: LoginState[] = [];
  const controller = new LoginController({
    authService: auth,
    accountsController,
    onChange: s => states.push(s),
  });
  return { controller, accountsController, secureStore, states };
}

const creds = (method: 'password' | 'otp_totp' = 'password') => ({
  loginName: 'u',
  password: 'pw',
  method,
  host: 'czebox' as const,
});

describe('LoginController', () => {
  it('password success: authenticating → signedIn, and persists the box + secret', async () => {
    const { controller, accountsController, secureStore, states } = setup(
      fakeAuth({ begin: { kind: 'signedIn', ownerInfo: owner } }),
    );
    await controller.start(creds());

    expect(states.map(s => s.status)).toEqual(['authenticating', 'signedIn']);
    const saved = await accountsController.listAccounts();
    expect(saved).toHaveLength(1);
    expect(saved[0].host).toBe('czebox'); // the environment chosen on the form is persisted
    expect(await secureStore.readPassword('box1')).toEqual({ status: 'found', value: 'pw' });
  });

  it('invalid credentials → error state, nothing persisted', async () => {
    const { controller, accountsController, states } = setup(
      fakeAuth({
        begin: { kind: 'error', code: 'invalidCredentials', recoverable: true, messageKey: 'login.error.invalidCredentials' },
      }),
    );
    await controller.start(creds());

    expect(states[states.length - 1]).toMatchObject({ status: 'error', code: 'invalidCredentials' });
    expect(await accountsController.listAccounts()).toHaveLength(0);
  });

  it('password rejected with suggestOtp → retryWithMethod reuses creds and switches to OTP', async () => {
    const calls: string[] = [];
    const auth: LoginAuthService = {
      beginLogin: async input => {
        calls.push(input.method);
        if (input.method === 'password') {
          return {
            kind: 'error',
            code: 'invalidCredentials',
            recoverable: true,
            messageKey: 'login.error.invalidCredentials',
            suggestOtp: true,
          };
        }
        return { kind: 'needsOtpSms' };
      },
      submitOtp: async () => ({ kind: 'signedIn', ownerInfo: owner }),
      resendSms: async () => ({ kind: 'needsOtpSms' }),
      mobileKeyLogin: async () => ({ kind: 'needsOtpSms' }),
      abandon: async () => {},
    };
    const { controller, states } = setup(auth);

    await controller.start(creds('password'));
    expect(states[states.length - 1]).toMatchObject({
      status: 'error',
      code: 'invalidCredentials',
      suggestOtp: true,
    });

    await controller.retryWithMethod('otp_totp');
    expect(controller.state.status).toBe('awaitingSmsCode');
    expect(calls).toEqual(['password', 'otp_totp']); // same login+password, OTP method
  });

  it('TOTP: start → awaitingSmsCode, submitOtp → signedIn + persisted', async () => {
    const { controller, accountsController, states } = setup(
      fakeAuth({ begin: { kind: 'needsOtpSms' }, otp: { kind: 'signedIn', ownerInfo: owner } }),
    );
    await controller.start(creds('otp_totp'));
    expect(states.map(s => s.status)).toEqual(['authenticating', 'awaitingSmsCode']);

    await controller.submitOtp('123456');
    expect(controller.state.status).toBe('signedIn');
    expect(await accountsController.listAccounts()).toHaveLength(1);
  });

  it('duplicate box on persist → recoverable duplicateBox error, not signedIn', async () => {
    const { controller, states } = setup(
      fakeAuth({ begin: { kind: 'signedIn', ownerInfo: owner } }),
    );
    await controller.start(creds()); // first add succeeds
    await controller.start(creds()); // same box again → duplicate

    const last = states[states.length - 1];
    expect(last).toMatchObject({ status: 'error', code: 'duplicateBox' });
  });

  it('reauth: refreshes the existing box secret + method instead of erroring on a duplicate', async () => {
    const { controller, accountsController, secureStore, states } = setup(
      fakeAuth({ begin: { kind: 'signedIn', ownerInfo: owner } }),
    );
    await controller.start(creds('otp_totp')); // box1 added as an SMS-OTP box
    expect((await accountsController.listAccounts())[0].authMethod).toBe('otp_totp');

    // OTP was removed on the portal → user re-auths as password with a new password. Must NOT be a
    // duplicate error, and the working method (+secret) must be persisted so the UI/next login match.
    await controller.start({ ...creds('password'), password: 'newpw', reauth: true });

    expect(states[states.length - 1].status).toBe('signedIn');
    const saved = await accountsController.listAccounts();
    expect(saved).toHaveLength(1); // no second row
    expect(saved[0].authMethod).toBe('password'); // method corrected
    expect(await secureStore.readPassword('box1')).toEqual({ status: 'found', value: 'newpw' }); // secret refreshed
  });

  it('stores, then REPLACES, the session a login establishes (018)', async () => {
    // The chain this covers is the one that failed on a real device: transport → authService →
    // loginController → accountsController. Every link existed; nothing tested them together, and a
    // missing link meant the box reported "sign-in expired" no matter how often the user signed in.
    const seq: { begin?: LoginOutcome } = {
      begin: {
        kind: 'signedIn',
        ownerInfo: owner,
        sessionCookie: 'IPCZ-X-COOKIE=FIRST',
      },
    };
    const auth: LoginAuthService = {
      beginLogin: async () => seq.begin!,
      submitOtp: async () => seq.begin!,
      resendSms: async () => ({ kind: 'needsOtpSms' }),
      mobileKeyLogin: async () => seq.begin!,
      abandon: async () => {},
    };
    const { controller, accountsController, secureStore } = setup(auth);

    await controller.start(creds('otp_totp'));
    // Sealed in the secure store beside the password (001 T028); the accounts row carries none.
    expect(await secureStore.readSession('box1')).toEqual({
      status: 'found',
      value: 'IPCZ-X-COOKIE=FIRST',
    });
    expect('sessionCookie' in (await accountsController.listAccounts())[0]).toBe(false);

    // Re-auth: the box must end up holding the NEW session, not the dead one it was told to replace.
    seq.begin = {
      kind: 'signedIn',
      ownerInfo: owner,
      sessionCookie: 'IPCZ-X-COOKIE=SECOND',
    };
    await controller.start({ ...creds('otp_totp'), reauth: true });
    expect(await secureStore.readSession('box1')).toEqual({
      status: 'found',
      value: 'IPCZ-X-COOKIE=SECOND',
    });
  });

  it('cancel during authentication returns to idle and ignores the late outcome', async () => {
    // beginLogin resolves only after we cancel.
    let resolveBegin: (o: LoginOutcome) => void = () => {};
    const auth: LoginAuthService = {
      beginLogin: () => new Promise<LoginOutcome>(r => (resolveBegin = r)),
      submitOtp: async () => ({ kind: 'needsOtpSms' }),
      resendSms: async () => ({ kind: 'needsOtpSms' }),
      mobileKeyLogin: async () => ({ kind: 'needsOtpSms' }),
      abandon: async () => {},
    };
    const { controller } = setup(auth);
    const p = controller.start(creds());
    expect(controller.state.status).toBe('authenticating');

    controller.cancel();
    expect(controller.state.status).toBe('idle');

    resolveBegin({ kind: 'error', code: 'cancelled', recoverable: true, messageKey: 'login.error.cancelled' });
    await p;
    expect(controller.state.status).toBe('idle'); // late outcome ignored from idle
  });
});

// A sign-in the person leaves ends its handshake then, not when a request it aborted next wakes
// (`IsdsAuthService.abandon`): by then another sign-in may have opened a handshake of its own.
describe('a sign-in the person leaves', () => {
  it('ends the handshake when a sign-in waiting for its SMS code is cancelled', async () => {
    const abandon = jest.fn(async () => {});
    const { controller } = setup({ ...fakeAuth({ begin: { kind: 'needsOtpSms' } }), abandon });
    await controller.start(creds('otp_totp'));
    expect(controller.state.status).toBe('awaitingSmsCode');
    expect(abandon).not.toHaveBeenCalled();

    controller.cancel();
    expect(controller.state.status).toBe('idle');
    expect(abandon).toHaveBeenCalledTimes(1);
  });

  it('aborts a Mobile Key wait and ends its handshake when the screen goes', async () => {
    // Android's system Back and the iOS edge swipe leave the screen without its Cancel.
    const signals: AbortSignal[] = [];
    const abandon = jest.fn(async () => {});
    const { controller } = setup({
      ...fakeAuth({}),
      mobileKeyLogin: input => {
        signals.push(input.signal);
        return new Promise<LoginOutcome>(() => {});
      },
      abandon,
    });
    void controller.start({ ...creds(), method: 'mobile_key' });
    expect(controller.state.status).toBe('awaitingMobileKey');

    controller.dispose();
    expect(signals).toHaveLength(1);
    expect(signals[0].aborted).toBe(true);
    expect(abandon).toHaveBeenCalledTimes(1);
  });
});

// A second request while one is running (audit 2026-09-23). The screens guard their buttons with
// state, which lands a render late, so a double tap reaches the controller twice - and each second call
// used to go straight to ISDS: a second sign-in, a second SMS, and a second Mobile Key wait that
// overwrote the first one's abort handle, so Cancel could stop only the second while the first polled
// on. Every second call below is made WITHOUT awaiting the first, the way the second press arrives.
describe('a second request while one is running (double tap)', () => {
  /** An auth service whose every call is held open until `settle`, counting what reached it. */
  function heldAuth() {
    const waiting: ((o: LoginOutcome) => void)[] = [];
    const hold = () => new Promise<LoginOutcome>(resolve => waiting.push(resolve));
    const signals: AbortSignal[] = [];
    const auth = {
      beginLogin: jest.fn((input: { signal: AbortSignal }) => {
        signals.push(input.signal);
        return hold();
      }),
      submitOtp: jest.fn((_code: string, signal: AbortSignal) => {
        signals.push(signal);
        return hold();
      }),
      resendSms: jest.fn((signal: AbortSignal) => {
        signals.push(signal);
        return hold();
      }),
      mobileKeyLogin: jest.fn((input: { signal: AbortSignal }) => {
        signals.push(input.signal);
        return hold();
      }),
      abandon: jest.fn(async () => {}),
    };
    /** Answer every call still waiting. */
    const settle = (o: LoginOutcome) => {
      for (const resolve of waiting.splice(0)) {
        resolve(o);
      }
    };
    /** Answer only the call that has waited longest. */
    const settleOldest = (o: LoginOutcome) => waiting.shift()?.(o);
    return { auth, signals, settle, settleOldest };
  }

  it('signs in once when the form is submitted twice', async () => {
    const { auth, settle } = heldAuth();
    const { controller } = setup(auth);
    const first = controller.start(creds());
    const second = controller.start(creds());
    settle({ kind: 'signedIn', ownerInfo: owner });
    await Promise.all([first, second]);

    expect(auth.beginLogin).toHaveBeenCalledTimes(1);
    expect(controller.state.status).toBe('signedIn');
  });

  it('asks for ONE Mobile Key approval, and Cancel stops the wait that is running', async () => {
    const { auth, signals } = heldAuth();
    const { controller } = setup(auth);
    void controller.start({ ...creds(), method: 'mobile_key' });
    void controller.start({ ...creds(), method: 'mobile_key' });
    expect(auth.mobileKeyLogin).toHaveBeenCalledTimes(1);

    controller.cancel();
    // Every wait that was started has been told to stop - there is no second one left polling.
    expect(signals).toHaveLength(1);
    expect(signals.every(signal => signal.aborted)).toBe(true);
    expect(controller.state.status).toBe('idle');
  });

  it('checks a code once when it is submitted twice', async () => {
    const { auth, settle } = heldAuth();
    const { controller } = setup(auth);
    const started = controller.start(creds('otp_totp'));
    settle({ kind: 'needsOtpSms' });
    await started;

    const first = controller.submitOtp('123456');
    const second = controller.submitOtp('123456');
    settle({ kind: 'signedIn', ownerInfo: owner });
    await Promise.all([first, second]);
    expect(auth.submitOtp).toHaveBeenCalledTimes(1);
  });

  it('sends one SMS when "send again" is tapped twice', async () => {
    const { auth, settle } = heldAuth();
    const { controller } = setup(auth);
    const started = controller.start(creds('otp_totp'));
    settle({ kind: 'needsOtpSms' });
    await started;

    const first = controller.resendSms();
    const second = controller.resendSms();
    settle({ kind: 'needsOtpSms' });
    await Promise.all([first, second]);
    expect(auth.resendSms).toHaveBeenCalledTimes(1);
    expect(controller.state.status).toBe('awaitingSmsCode');
  });

  it('does not resend while a code is being checked, nor check while an SMS is being sent', async () => {
    const { auth, settle } = heldAuth();
    const { controller } = setup(auth);
    const started = controller.start(creds('otp_totp'));
    settle({ kind: 'needsOtpSms' });
    await started;

    // Each refused call is checked in the tick it is made: a call that did reach the service would
    // have reached it synchronously.
    const checking = controller.submitOtp('123456');
    const refusedResend = controller.resendSms();
    expect(auth.resendSms).not.toHaveBeenCalled();
    settle({ kind: 'needsOtpSms' });
    await Promise.all([checking, refusedResend]);

    const resending = controller.resendSms();
    const refusedCheck = controller.submitOtp('654321');
    expect(auth.submitOtp).toHaveBeenCalledTimes(1);
    settle({ kind: 'needsOtpSms' });
    await Promise.all([resending, refusedCheck]);
  });

  it('does not resend while the first SMS request is still out, so nothing answers over a resend', async () => {
    // 018 T007 recorded a race on 2026-09-15: the code screen offered "send again" while the first SMS
    // request was still out, and that request failing afterwards turned the screen the resend had
    // opened into its error. Closed by the single-flight guard (2026-09-23), pinned here (2026-09-24).
    const { auth, settle } = heldAuth();
    const { controller } = setup(auth);
    const started = controller.start(creds('otp_totp'));

    const refusedResend = controller.resendSms();
    expect(auth.resendSms).not.toHaveBeenCalled();
    settle({ kind: 'error', code: 'timeout', recoverable: true, messageKey: 'login.error.timeout' });
    await Promise.all([started, refusedResend]);

    expect(auth.resendSms).not.toHaveBeenCalled();
    expect(controller.state.status).toBe('error');
  });

  it('switches to SMS once when the SMS-code offer is tapped twice', async () => {
    const { auth, settle } = heldAuth();
    const { controller } = setup(auth);
    const started = controller.start(creds('password'));
    settle({
      kind: 'error',
      code: 'invalidCredentials',
      recoverable: true,
      messageKey: 'login.error.invalidCredentials',
      suggestOtp: true,
    });
    await started;
    auth.beginLogin.mockClear();

    const first = controller.retryWithMethod('otp_totp');
    const second = controller.retryWithMethod('otp_totp');
    settle({ kind: 'needsOtpSms' });
    await Promise.all([first, second]);
    expect(auth.beginLogin).toHaveBeenCalledTimes(1);
  });

  it('lets a new attempt start at once after Cancel, and the cancelled one does not free its claim', async () => {
    const { auth, signals, settle, settleOldest } = heldAuth();
    const { controller } = setup(auth);
    const cancelled = controller.start(creds());
    controller.cancel();

    // The aborted request has not come back yet - a fresh attempt must not wait for it.
    const fresh = controller.start(creds());
    expect(auth.beginLogin).toHaveBeenCalledTimes(2);
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);

    // The cancelled request ends first. The fresh one is still running, so it still holds the claim.
    settleOldest({
      kind: 'error',
      code: 'cancelled',
      recoverable: true,
      messageKey: 'login.error.cancelled',
    });
    await cancelled;
    void controller.start(creds());
    expect(auth.beginLogin).toHaveBeenCalledTimes(2);

    settle({ kind: 'needsOtpSms' });
    await fresh;
  });

  it('dispose aborts the request running and frees the controller', async () => {
    const { auth, signals } = heldAuth();
    const { controller } = setup(auth);
    void controller.submitOtp('123456');
    controller.dispose();
    expect(signals[0].aborted).toBe(true);
    void controller.submitOtp('123456');
    expect(auth.submitOtp).toHaveBeenCalledTimes(2);
  });

  it('a request that throws still frees the controller', async () => {
    // The auth service promises never to throw; a guard that trusted that and freed only on success
    // would leave every later sign-in refused after one that broke the promise.
    const auth = {
      ...fakeAuth({ begin: { kind: 'needsOtpSms' } }),
      beginLogin: jest
        .fn()
        .mockRejectedValueOnce(new Error('broken'))
        .mockResolvedValueOnce({ kind: 'needsOtpSms' }),
    };
    const { controller } = setup(auth);
    await expect(controller.start(creds('otp_totp'))).rejects.toThrow('broken');
    await controller.start(creds('otp_totp'));
    expect(auth.beginLogin).toHaveBeenCalledTimes(2);
    expect(controller.state.status).toBe('awaitingSmsCode');
  });
});

// Cancel frees the controller at once, so the person can start again before the request they left
// has come back - a Mobile Key wait notices its abort only after the pause between polls. What that
// request answers then is about the attempt they left, and must not land on the one they started.
describe('a cancelled request that answers after a new sign-in started', () => {
  const cancelled: LoginOutcome = {
    kind: 'error',
    code: 'cancelled',
    recoverable: true,
    messageKey: 'login.error.cancelled',
  };

  it('leaves the new attempt on its own screen, and its own answer still lands', async () => {
    const waiting: ((o: LoginOutcome) => void)[] = [];
    const hold = () => new Promise<LoginOutcome>(resolve => waiting.push(resolve));
    const auth = {
      ...fakeAuth({}),
      beginLogin: jest.fn(hold),
    };
    const { controller } = setup(auth);
    const left = controller.start(creds('otp_totp'));
    controller.cancel();
    const fresh = controller.start(creds('otp_totp'));
    expect(controller.state.status).toBe('authenticating');

    waiting[0](cancelled);
    await left;
    expect(controller.state.status).toBe('authenticating');

    waiting[1]({ kind: 'needsOtpSms' });
    await fresh;
    expect(controller.state.status).toBe('awaitingSmsCode');
  });

  it('a cancelled Mobile Key wait reports nothing into the new wait', async () => {
    const waits: {
      resolve: (o: LoginOutcome) => void;
      onStatus?: (status: number, description: string) => void;
    }[] = [];
    const auth = {
      ...fakeAuth({}),
      mobileKeyLogin: jest.fn(
        (_input: unknown, onStatus?: (status: number, description: string) => void) =>
          new Promise<LoginOutcome>(resolve => waits.push({ resolve, onStatus })),
      ),
    };
    const { controller } = setup(auth);
    const mk = { ...creds(), method: 'mobile_key' as const };
    const left = controller.start(mk);
    controller.cancel();
    const fresh = controller.start(mk);
    waits[1].onStatus?.(11, 'push sent');

    // The old loop's last poll, then its end, arrive after the new wait began.
    waits[0].onStatus?.(12, 'old');
    waits[0].resolve(cancelled);
    await left;
    expect(controller.state).toMatchObject({ status: 'awaitingMobileKey', mkStatus: 11 });

    waits[1].resolve({ kind: 'signedIn', ownerInfo: owner });
    await fresh;
    expect(controller.state.status).toBe('signedIn');
  });

  it('a late sign-in from the attempt left is not stored under the new attempt’s credentials', async () => {
    const waiting: ((o: LoginOutcome) => void)[] = [];
    const auth = {
      ...fakeAuth({}),
      beginLogin: jest.fn(() => new Promise<LoginOutcome>(resolve => waiting.push(resolve))),
    };
    const { controller, accountsController } = setup(auth);
    const left = controller.start(creds());
    controller.cancel();
    const fresh = controller.start({ ...creds(), loginName: 'someone-else', password: 'other' });

    waiting[0]({ kind: 'signedIn', ownerInfo: owner });
    await left;
    expect(await accountsController.listAccounts()).toHaveLength(0);
    expect(controller.state.status).toBe('authenticating');

    waiting[1]({ kind: 'signedIn', ownerInfo: { ...owner, boxId: 'box2' } });
    await fresh;
    const saved = await accountsController.listAccounts();
    expect(saved.map(a => [a.boxId, a.loginName])).toEqual([['box2', 'someone-else']]);
  });
});

// 001 FR-009. The app assumes ISDS refuses an expired password exactly like a wrong one - an auth
// fault, surfaced as invalid credentials; no other answer has been captured. But the box's
// password-expiry date was stored at its last sign-in, and a refusal after that date is not a typo.
describe('a refused password on a box whose stored password has expired', () => {
  const NOW = new Date(2026, 8, 14, 9, 0).getTime();
  const DAY = 86_400_000;
  const refused: LoginOutcome = {
    kind: 'error',
    code: 'invalidCredentials',
    recoverable: true,
    messageKey: 'login.error.invalidCredentials',
    suggestOtp: true,
  };

  async function storedBox(
    passwordExpiresAt: number | null,
    over: { method?: AuthMethod; host?: Host } = {},
  ) {
    const accountsController = new AccountsController({
      accounts: new InMemoryAccountsStore(),
      secureStore: new InMemorySecureStore(),
      now: () => 1,
      genId: () => 'id1',
    });
    await accountsController.addAccount({
      loginName: 'u',
      password: 'old',
      method: over.method ?? 'password',
      host: over.host ?? 'czebox',
      ownerInfo: { ...owner, passwordExpiresAt },
    });
    return new LoginController({
      authService: fakeAuth({ begin: refused, mk: refused }),
      accountsController,
      now: () => NOW,
      onChange: () => {},
    });
  }

  it('says the password expired and must be changed - not that it is wrong', async () => {
    const controller = await storedBox(NOW - DAY);
    await controller.start({ ...creds(), reauth: true });
    expect(controller.state).toMatchObject({
      status: 'error',
      code: 'passwordChangeRequired',
      messageKey: 'login.error.passwordChangeRequired',
    });
    // No "maybe it needs an SMS code" on top: a code appended to an expired password cannot help.
    expect(controller.state.status === 'error' && controller.state.suggestOtp).toBeFalsy();
  });

  it('counts the moment the password ran out', async () => {
    const controller = await storedBox(NOW);
    await controller.start({ ...creds(), reauth: true });
    expect(controller.state).toMatchObject({ status: 'error', code: 'passwordChangeRequired' });
  });

  it('says the same when the box is added again while it is still stored', async () => {
    const controller = await storedBox(NOW - DAY);
    await controller.start(creds());
    expect(controller.state).toMatchObject({ status: 'error', code: 'passwordChangeRequired' });
  });

  it('keeps invalid credentials while the stored date is still ahead', async () => {
    const controller = await storedBox(NOW + DAY);
    await controller.start({ ...creds(), reauth: true });
    expect(controller.state).toMatchObject({
      status: 'error',
      code: 'invalidCredentials',
      suggestOtp: true,
    });
  });

  it('keeps invalid credentials when ISDS never gave a date', async () => {
    const controller = await storedBox(null);
    await controller.start({ ...creds(), reauth: true });
    expect(controller.state).toMatchObject({ status: 'error', code: 'invalidCredentials' });
  });

  it('leaves an SMS box alone, whatever its stored date', async () => {
    // Refused on the SMS path, or tried with a bare password after all: a cookie box's refusal says
    // nothing about when its password runs out.
    const sms = await storedBox(NOW - DAY, { method: 'otp_totp' });
    await sms.start({ ...creds('otp_totp'), reauth: true });
    expect(sms.state).toMatchObject({ status: 'error', code: 'invalidCredentials' });

    const switched = await storedBox(NOW - DAY, { method: 'otp_totp' });
    await switched.start({ ...creds('password'), reauth: true });
    expect(switched.state).toMatchObject({ status: 'error', code: 'invalidCredentials' });
  });

  it('leaves a Mobile Key box alone, whatever its stored date', async () => {
    const controller = await storedBox(NOW - DAY, { method: 'mobile_key' });
    await controller.start({
      loginName: 'u',
      password: 'communication-code',
      method: 'mobile_key',
      host: 'czebox',
      reauth: true,
    });
    expect(controller.state).toMatchObject({ status: 'error', code: 'invalidCredentials' });
  });

  it('does not borrow the date of the same login in the other environment', async () => {
    const controller = await storedBox(NOW - DAY, { host: 'production' });
    await controller.start({ ...creds(), reauth: true }); // a czebox attempt
    expect(controller.state).toMatchObject({ status: 'error', code: 'invalidCredentials' });
  });
});
