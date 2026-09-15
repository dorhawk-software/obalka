import { IsdsAuthService } from '../../src/features/accounts/state/authService';
import {
  TransportNetworkError,
  TransportTimeoutError,
} from '../../src/services/isds/transport';
import type { LoginOutcome } from '../../src/services/isds/types';
import { liveSignal, makeTransport, ownerInfo } from '../helpers/fakeTransport';

const begin = (
  svc: IsdsAuthService,
  signal = liveSignal(),
): Promise<LoginOutcome> =>
  svc.beginLogin({
    loginName: 'user',
    password: 'pw',
    method: 'password',
    host: 'czebox',
    signal,
  });

describe('AuthService - password login', () => {
  it('success -> signedIn with owner info', async () => {
    const oi = ownerInfo({ boxId: 'b1', label: 'ACME s.r.o.' });
    const svc = new IsdsAuthService({
      transport: makeTransport({
        passwordLogin: async () => ({ type: 'success', ownerInfo: oi }),
      }),
    });
    await expect(begin(svc)).resolves.toEqual({
      kind: 'signedIn',
      ownerInfo: oi,
      sessionCookie: null,
    });
  });

  it('authFault -> invalidCredentials (recoverable, with messageKey + suggestOtp)', async () => {
    const svc = new IsdsAuthService({
      transport: makeTransport({
        passwordLogin: async () => ({ type: 'authFault' }),
      }),
    });
    // A rejected password hints that the box may require a one-time code (enabling OTP disables
    // password-only login), so the UI can offer the OTP methods.
    await expect(begin(svc)).resolves.toEqual({
      kind: 'error',
      code: 'invalidCredentials',
      recoverable: true,
      messageKey: 'login.error.invalidCredentials',
      suggestOtp: true,
    });
  });

  it('passwordChangeRequired -> mapped, not crashed', async () => {
    const svc = new IsdsAuthService({
      transport: makeTransport({
        passwordLogin: async () => ({ type: 'passwordChangeRequired' }),
      }),
    });
    const r = await begin(svc);
    expect(r).toMatchObject({ kind: 'error', code: 'passwordChangeRequired' });
  });

  it('serverFault -> serverFault', async () => {
    const svc = new IsdsAuthService({
      transport: makeTransport({
        passwordLogin: async () => ({ type: 'serverFault' }),
      }),
    });
    expect(await begin(svc)).toMatchObject({
      kind: 'error',
      code: 'serverFault',
    });
  });

  it('thrown TransportNetworkError -> error network (never rejects)', async () => {
    const svc = new IsdsAuthService({
      transport: makeTransport({
        passwordLogin: async () => {
          throw new TransportNetworkError();
        },
      }),
    });
    expect(await begin(svc)).toMatchObject({ kind: 'error', code: 'network' });
  });

  it('thrown TransportTimeoutError -> error timeout', async () => {
    const svc = new IsdsAuthService({
      transport: makeTransport({
        passwordLogin: async () => {
          throw new TransportTimeoutError();
        },
      }),
    });
    expect(await begin(svc)).toMatchObject({ kind: 'error', code: 'timeout' });
  });

  it('thrown unknown error -> error serverFault (never rethrows)', async () => {
    const svc = new IsdsAuthService({
      transport: makeTransport({
        passwordLogin: async () => {
          throw new Error('boom');
        },
      }),
    });
    expect(await begin(svc)).toMatchObject({
      kind: 'error',
      code: 'serverFault',
    });
  });

  it('already-aborted signal -> error cancelled (no transport call)', async () => {
    const controller = new AbortController();
    controller.abort();
    const passwordLogin = jest.fn();
    const svc = new IsdsAuthService({
      transport: makeTransport({ passwordLogin }),
    });
    expect(await begin(svc, controller.signal)).toMatchObject({
      kind: 'error',
      code: 'cancelled',
    });
    expect(passwordLogin).not.toHaveBeenCalled();
  });

  it('abort during the call (AbortError thrown) -> error cancelled', async () => {
    const svc = new IsdsAuthService({
      transport: makeTransport({
        passwordLogin: async () => {
          const e = new Error('aborted');
          e.name = 'AbortError';
          throw e;
        },
      }),
    });
    expect(await begin(svc)).toMatchObject({
      kind: 'error',
      code: 'cancelled',
    });
  });

  it('every outcome resolves (the promise never rejects)', async () => {
    const builders = [
      () => ({ type: 'success', ownerInfo: ownerInfo() } as const),
      () => ({ type: 'authFault' } as const),
      () => ({ type: 'passwordChangeRequired' } as const),
      () => ({ type: 'serverFault' } as const),
    ];
    for (const b of builders) {
      const svc = new IsdsAuthService({
        transport: makeTransport({ passwordLogin: async () => b() }),
      });
      await expect(begin(svc)).resolves.toHaveProperty('kind');
    }
  });
});
