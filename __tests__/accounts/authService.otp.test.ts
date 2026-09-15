import { IsdsAuthService } from '../../src/features/accounts/state/authService';
import {
  TransportNetworkError,
  OtpSubmitArgs,
} from '../../src/services/isds/transport';
import { liveSignal, makeTransport, ownerInfo } from '../helpers/fakeTransport';

describe('AuthService - OTP login', () => {
  it('TOTP: beginLogin triggers SMS -> needsOtpSms, then submitOtp -> signedIn', async () => {
    const oi = ownerInfo();
    const otpBegin = jest.fn(async () => ({ type: 'otpSmsSent' } as const));
    const otpSubmit = jest.fn(
      async (_args: OtpSubmitArgs) =>
        ({ type: 'success', ownerInfo: oi } as const),
    );
    const svc = new IsdsAuthService({
      transport: makeTransport({ otpBegin, otpSubmit }),
    });

    const begun = await svc.beginLogin({
      loginName: 'u',
      password: 'p',
      method: 'otp_totp',
      host: 'czebox',
      signal: liveSignal(),
    });
    expect(begun).toEqual({ kind: 'needsOtpSms' });
    expect(otpBegin).toHaveBeenCalledTimes(1);

    const done = await svc.submitOtp('123456', liveSignal());
    expect(done).toEqual({
      kind: 'signedIn',
      ownerInfo: oi,
      // 018: a fake transport returns no session; a real OTP login does.
      sessionCookie: null,
    });
    expect(otpSubmit.mock.calls[0][0]).toMatchObject({
      loginName: 'u',
      password: 'p',
      code: '123456',
      method: 'otp_totp',
    });
  });

  it('invalid/expired code -> error invalidOrExpiredOtp (recoverable, no crash at final step)', async () => {
    const svc = new IsdsAuthService({
      transport: makeTransport({
        otpBegin: async () => ({ type: 'otpSmsSent' }),
        otpSubmit: async () => ({ type: 'otpFault' }),
      }),
    });
    await svc.beginLogin({
      loginName: 'u',
      password: 'p',
      method: 'otp_totp',
      host: 'czebox',
      signal: liveSignal(),
    });
    expect(await svc.submitOtp('000000', liveSignal())).toMatchObject({
      kind: 'error',
      code: 'invalidOrExpiredOtp',
      recoverable: true,
    });
  });

  it('TOTP SMS not delivered -> error smsNotDelivered', async () => {
    const svc = new IsdsAuthService({
      transport: makeTransport({
        otpBegin: async () => ({ type: 'smsNotDelivered' }),
      }),
    });
    expect(
      await svc.beginLogin({
        loginName: 'u',
        password: 'p',
        method: 'otp_totp',
        host: 'czebox',
        signal: liveSignal(),
      }),
    ).toMatchObject({ kind: 'error', code: 'smsNotDelivered' });
  });

  it('resendSms re-requests and returns needsOtpSms', async () => {
    const resendSms = jest.fn(async () => ({ type: 'otpSmsSent' } as const));
    const svc = new IsdsAuthService({
      transport: makeTransport({
        otpBegin: async () => ({ type: 'otpSmsSent' }),
        resendSms,
      }),
    });
    await svc.beginLogin({
      loginName: 'u',
      password: 'p',
      method: 'otp_totp',
      host: 'czebox',
      signal: liveSignal(),
    });
    expect(await svc.resendSms(liveSignal())).toEqual({ kind: 'needsOtpSms' });
    expect(resendSms).toHaveBeenCalledTimes(1);
  });

  it('submitOtp without a pending login -> recoverable error, never throws', async () => {
    const svc = new IsdsAuthService({ transport: makeTransport({}) });
    expect(await svc.submitOtp('123', liveSignal())).toMatchObject({
      kind: 'error',
    });
  });

  it('submitOtp transport network failure -> error network (never rejects)', async () => {
    const svc = new IsdsAuthService({
      transport: makeTransport({
        otpBegin: async () => ({ type: 'otpSmsSent' }),
        otpSubmit: async () => {
          throw new TransportNetworkError();
        },
      }),
    });
    await svc.beginLogin({
      loginName: 'u',
      password: 'p',
      method: 'otp_totp',
      host: 'czebox',
      signal: liveSignal(),
    });
    expect(await svc.submitOtp('123456', liveSignal())).toMatchObject({
      kind: 'error',
      code: 'network',
    });
  });
});
