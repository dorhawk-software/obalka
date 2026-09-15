import { IsdsAuthService } from '../../src/features/accounts/state/authService';
import { liveSignal, makeTransport, ownerInfo } from '../helpers/fakeTransport';
import type {
  MobileKeyPollResult,
  TransportResult,
} from '../../src/services/isds/transport';

const mkInput = () => ({
  loginName: 'u',
  communicationCode: 'CODE',
  applicationName: 'Obálka',
  host: 'czebox' as const,
  signal: liveSignal(),
});

const noDelay = () => Promise.resolve();

describe('IsdsAuthService - Mobile Key (Mobilní klíč)', () => {
  it('begin authFault (wrong code) → invalidCredentials', async () => {
    const svc = new IsdsAuthService({
      transport: makeTransport({ mepBegin: async () => ({ type: 'authFault' }) }),
      delay: noDelay,
    });
    expect(await svc.mobileKeyLogin(mkInput())).toMatchObject({
      kind: 'error',
      code: 'invalidCredentials',
    });
  });

  it('polls through in-progress states, then confirms → signedIn + reports each status', async () => {
    const states: MobileKeyPollResult[] = [
      { type: 'state', status: 11, description: 'push sent' },
      { type: 'state', status: 13, description: 'launched' },
      { type: 'state', status: 2, description: 'confirmed' },
    ];
    const seen: number[] = [];
    const svc = new IsdsAuthService({
      transport: makeTransport({
        mepBegin: async () => ({ type: 'pending' }),
        mepPoll: async () => states.shift() ?? { type: 'serverFault' },
        mepConfirm: async (): Promise<TransportResult> => ({
          type: 'success',
          ownerInfo: ownerInfo({ boxId: 'boxMK' }),
        }),
      }),
      delay: noDelay,
      now: () => 0, // never reaches the deadline
    });
    const out = await svc.mobileKeyLogin(mkInput(), s => seen.push(s));
    expect(out).toMatchObject({
      kind: 'signedIn',
      ownerInfo: { boxId: 'boxMK' },
      sessionCookie: null,
    });
    expect(seen).toEqual([11, 13, 2]);
  });

  it('user declines (status 3) → mobileKeyRejected', async () => {
    const svc = new IsdsAuthService({
      transport: makeTransport({
        mepBegin: async () => ({ type: 'pending' }),
        mepPoll: async () => ({ type: 'state', status: 3, description: 'no' }),
      }),
      delay: noDelay,
      now: () => 0,
    });
    expect(await svc.mobileKeyLogin(mkInput())).toMatchObject({
      kind: 'error',
      code: 'mobileKeyRejected',
    });
  });

  it('not approved within the 240 s window → mobileKeyTimeout', async () => {
    let t = 0;
    const svc = new IsdsAuthService({
      transport: makeTransport({
        mepBegin: async () => ({ type: 'pending' }),
        mepPoll: async () => ({ type: 'state', status: 1, description: 'wait' }),
      }),
      delay: noDelay,
      // 1st call sets the deadline (0 + 240 s); the 2nd (250 s) exceeds it.
      now: () => {
        const v = t;
        t += 250_000;
        return v;
      },
    });
    expect(await svc.mobileKeyLogin(mkInput())).toMatchObject({
      kind: 'error',
      code: 'mobileKeyTimeout',
    });
  });
});
