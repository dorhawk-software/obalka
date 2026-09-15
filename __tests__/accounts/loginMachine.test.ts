import {
  initialLoginState,
  loginTransition,
  LoginEvent,
  LoginState,
} from '../../src/features/accounts/state/loginMachine';
import type { LoginOutcome, OwnerInfo } from '../../src/services/isds/types';

const owner: OwnerInfo = {
  boxId: 'box1',
  label: 'Test',
  dbType: null,
  passwordExpiresAt: null,
};
const outcome = (o: LoginOutcome): LoginEvent => ({
  type: 'OUTCOME',
  outcome: o,
});

describe('loginTransition', () => {
  it('starts idle', () => {
    expect(initialLoginState).toEqual({ status: 'idle' });
  });

  it('idle + SUBMIT_CREDENTIALS -> authenticating', () => {
    expect(
      loginTransition({ status: 'idle' }, { type: 'SUBMIT_CREDENTIALS' }),
    ).toEqual({
      status: 'authenticating',
    });
  });

  it('authenticating maps each outcome to the right state', () => {
    const auth: LoginState = { status: 'authenticating' };
    expect(
      loginTransition(auth, outcome({ kind: 'signedIn', ownerInfo: owner })),
    ).toEqual({
      status: 'signedIn',
      ownerInfo: owner,
    });
    expect(loginTransition(auth, outcome({ kind: 'needsOtpSms' }))).toEqual({
      status: 'awaitingSmsCode',
    });
    expect(
      loginTransition(
        auth,
        outcome({
          kind: 'error',
          code: 'invalidCredentials',
          recoverable: true,
          messageKey: 'login.error.invalidCredentials',
        }),
      ),
    ).toEqual({
      status: 'error',
      code: 'invalidCredentials',
      messageKey: 'login.error.invalidCredentials',
    });
  });

  it('authenticating + CANCEL -> idle', () => {
    expect(
      loginTransition({ status: 'authenticating' }, { type: 'CANCEL' }),
    ).toEqual({
      status: 'idle',
    });
  });

  it('awaitingSmsCode + SUBMIT_OTP / RESEND_SMS -> authenticating', () => {
    expect(
      loginTransition({ status: 'awaitingSmsCode' }, { type: 'SUBMIT_OTP' }),
    ).toEqual({
      status: 'authenticating',
    });
    expect(
      loginTransition({ status: 'awaitingSmsCode' }, { type: 'RESEND_SMS' }),
    ).toEqual({
      status: 'authenticating',
    });
  });

  it('error + RETRY -> idle, error + SUBMIT_CREDENTIALS -> authenticating', () => {
    const err: LoginState = {
      status: 'error',
      code: 'network',
      messageKey: 'login.error.network',
    };
    expect(loginTransition(err, { type: 'RETRY' })).toEqual({ status: 'idle' });
    expect(loginTransition(err, { type: 'SUBMIT_CREDENTIALS' })).toEqual({
      status: 'authenticating',
    });
  });

  it('SESSION_INVALIDATED from any state -> reauthRequired scoped to the box', () => {
    expect(
      loginTransition(
        { status: 'signedIn', ownerInfo: owner },
        { type: 'SESSION_INVALIDATED', boxId: 'box9' },
      ),
    ).toEqual({ status: 'reauthRequired', boxId: 'box9' });
  });

  it('reauthRequired + SUBMIT_CREDENTIALS -> authenticating', () => {
    expect(
      loginTransition(
        { status: 'reauthRequired', boxId: 'box9' },
        { type: 'SUBMIT_CREDENTIALS' },
      ),
    ).toEqual({ status: 'authenticating' });
  });

  it('ignores irrelevant events (e.g. signedIn + SUBMIT_OTP stays signedIn)', () => {
    const s: LoginState = { status: 'signedIn', ownerInfo: owner };
    expect(loginTransition(s, { type: 'SUBMIT_OTP' })).toBe(s);
  });

  it('is a TOTAL function: never throws for any (state, event) pair', () => {
    const states: LoginState[] = [
      { status: 'idle' },
      { status: 'authenticating' },
      { status: 'awaitingSmsCode' },
      { status: 'signedIn', ownerInfo: owner },
      {
        status: 'error',
        code: 'serverFault',
        messageKey: 'login.error.serverFault',
      },
      { status: 'reauthRequired', boxId: 'box1' },
    ];
    const events: LoginEvent[] = [
      { type: 'SUBMIT_CREDENTIALS' },
      { type: 'SUBMIT_OTP' },
      { type: 'RESEND_SMS' },
      { type: 'CANCEL' },
      { type: 'RETRY' },
      { type: 'SESSION_INVALIDATED', boxId: 'box1' },
      outcome({ kind: 'signedIn', ownerInfo: owner }),
      outcome({ kind: 'needsOtpSms' }),
      outcome({
        kind: 'error',
        code: 'timeout',
        recoverable: true,
        messageKey: 'login.error.timeout',
      }),
    ];
    const valid = new Set([
      'idle',
      'authenticating',
      'awaitingSmsCode',
      'signedIn',
      'error',
      'reauthRequired',
    ]);
    for (const s of states) {
      for (const e of events) {
        const next = loginTransition(s, e);
        expect(valid.has(next.status)).toBe(true);
      }
    }
  });
});
