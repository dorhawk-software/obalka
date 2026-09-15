// The code screen opens BEFORE ISDS answers (021, reported from an iPhone 2026-08-19).
//
// The user worked this out from the outside: "when i hit to send me sms otp, it stays and is blocked
// on the screen, and only after i receive the sms text … i am forwarded to the text input, but i
// receive the text right away". They were right, and it defeats one-time-code autofill on both
// platforms for different reasons:
//
//   iOS     Security Code AutoFill offers the code above a FOCUSED oneTimeCode field. If the message
//           lands while the credentials form is still spinning, there is no such field yet.
//   Android our own SMS User Consent watch starts when the code screen mounts, so a message that
//           arrives before that is never offered at all - no prompt, no code, no explanation.
//
// So the screen has to be up before the SMS is. What it must NOT do is claim the code was sent while
// the request is still in flight, which is what these tests are really pinning.

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { tamaguiConfig } from '../../tamagui.config';
import { LoginFlow } from '../../src/features/accounts/screens/LoginFlow';
import type { LoginOutcome } from '../../src/services/isds/types';

jest.mock('../../src/services/sms/smsUserConsent', () => ({
  listenForSmsCode: jest.fn(() => () => {}),
  smsAutofillAvailable: jest.fn(() => false),
}));

/** An ISDS that never answers, so the test can look at the screen mid-request. */
function hangingDeps() {
  let release: ((o: LoginOutcome) => void) | null = null;
  const deps = {
    authService: {
      beginLogin: jest.fn(
        () =>
          new Promise<LoginOutcome>(resolve => {
            release = resolve;
          }),
      ),
      submitOtp: jest.fn(async () => ({ kind: 'error' }) as LoginOutcome),
      resendSms: jest.fn(async () => ({ kind: 'error' }) as LoginOutcome),
      mobileKeyLogin: jest.fn(),
      pollMobileKey: jest.fn(),
      abandon: jest.fn(async () => {}),
    },
    accountsController: {} as never,
    host: 'production' as const,
  };
  return { deps, answer: (o: LoginOutcome) => release?.(o) };
}

const flow = (deps: ReturnType<typeof hangingDeps>['deps']) =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <LoginFlow deps={deps as never} />
      </TamaguiProvider>
    </SafeAreaProvider>,
  );

/** Walk the add-box form the way a user does: pick the SMS method, continue, fill in, submit. */
async function submitSmsLogin(view: Awaited<ReturnType<typeof render>>) {
  await act(async () => {
    fireEvent.press(view.getByTestId('method-otp_totp'));
  });
  await act(async () => {
    fireEvent.press(view.getByTestId('continue'));
  });
  await act(async () => {
    fireEvent.changeText(view.getByTestId('loginName'), 'user');
  });
  await act(async () => {
    fireEvent.changeText(view.getByTestId('password'), 'secret');
  });
  await act(async () => {
    fireEvent.press(view.getByTestId('submit'));
  });
}

describe('asking for an SMS code', () => {
  // First in the file on purpose: a render that follows a test ending on an un-awaited event comes up
  // empty, since that test's cleanup is still in act() - and this one unmounts itself.
  it('ends the sign-in when the code screen goes without its Cancel, as a system Back does', async () => {
    // Android’s system Back and the iOS edge swipe take the whole flow away without passing its
    // Cancel. An SMS asked for and never entered kept its handshake’s cookie in the shared jar
    // until the next sign-in (`LoginController.dispose`).
    const { deps, answer } = hangingDeps();
    const view = await flow(deps);
    await submitSmsLogin(view);
    await act(async () => {
      answer({ kind: 'needsOtpSms' } as LoginOutcome);
    });
    await waitFor(() =>
      expect(view.getByTestId('otpNotice')).toHaveTextContent(/poslali v SMS/),
    );
    expect(deps.authService.abandon).not.toHaveBeenCalled();

    await act(async () => {
      await view.unmount();
    });
    expect(deps.authService.abandon).toHaveBeenCalledTimes(1);
  });

  it('shows the code field immediately, without waiting for ISDS', async () => {
    const { deps } = hangingDeps();
    const view = await flow(deps);
    await submitSmsLogin(view);
    // The request has NOT answered - and the code screen is already up.
    await waitFor(() => expect(view.getByTestId('otpCode')).toBeTruthy());
    expect(deps.authService.beginLogin).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'otp_totp' }),
    );
  });

  it('does not claim the SMS was sent before ISDS says so', async () => {
    const { deps, answer } = hangingDeps();
    const view = await flow(deps);
    await submitSmsLogin(view);
    await waitFor(() => expect(view.getByTestId('otpCode')).toBeTruthy());
    expect(view.getByTestId('otpNotice')).toHaveTextContent(/Žádáme o jednorázový kód/);

    await act(async () => {
      answer({ kind: 'needsOtpSms' } as LoginOutcome);
    });
    await waitFor(() =>
      expect(view.getByTestId('otpNotice')).toHaveTextContent(
        /poslali v SMS/,
      ),
    );
  });

  it('refuses a code it has nowhere to send yet, and says why', async () => {
    // 019's rule: a blocked primary action explains itself rather than doing nothing.
    const { deps } = hangingDeps();
    const view = await flow(deps);
    await submitSmsLogin(view);
    await waitFor(() => expect(view.getByTestId('otpCode')).toBeTruthy());
    fireEvent.changeText(view.getByTestId('otpCode'), '35124603');
    await act(async () => {
      fireEvent.press(view.getByTestId('otpSubmit'));
    });
    expect(deps.authService.submitOtp).not.toHaveBeenCalled();
  });
});
