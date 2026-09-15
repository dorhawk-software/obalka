// "Poslat SMS znovu" asks ISDS for another SMS - a real text to the box owner's phone (audit
// 2026-09-23).
//
// It was a plain button, enabled even while a send or a resend was still in flight, and a double tap
// reached ISDS twice. Now it is disabled while anything is in flight, and a tap is refused in the tap
// itself while its own request runs - because `disabled` is state and lands a render late. The taps
// here are taken from ONE render (`doubleTap`), which is how the second finger arrives.

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { tamaguiConfig } from '../../tamagui.config';
import { OtpForm } from '../../src/features/accounts/screens/OtpForm';
import { LoginFlow } from '../../src/features/accounts/screens/LoginFlow';
import type { LoginOutcome } from '../../src/services/isds/types';
import { doubleTap } from '../helpers/doubleTap';

jest.mock('../../src/services/sms/smsUserConsent', () => ({
  listenForSmsCode: jest.fn(() => () => {}),
  smsAutofillAvailable: jest.fn(() => false),
}));

/** A request held open until the test answers it. */
function held() {
  let answer: () => void = () => {};
  const request = jest.fn(
    () =>
      new Promise<void>(resolve => {
        answer = resolve;
      }),
  );
  return { request, answer: () => act(async () => answer()) };
}

const form = (props: Partial<Parameters<typeof OtpForm>[0]>) =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <OtpForm onSubmit={() => {}} onCancel={() => {}} {...props} />
    </TamaguiProvider>,
  );

describe('the resend link on its own', () => {
  it('asks once when tapped twice before the screen re-renders', async () => {
    const resend = held();
    const view = await form({ onResend: resend.request });
    await doubleTap(view.getByTestId('otpResend'));
    expect(resend.request).toHaveBeenCalledTimes(1);

    // Free again once that request has answered: a later tap is a new, deliberate resend.
    await resend.answer();
    await fireEvent.press(view.getByTestId('otpResend'));
    expect(resend.request).toHaveBeenCalledTimes(2);
  });

  it('is disabled - still there, same place - while the code is being sent', async () => {
    const onResend = jest.fn();
    const view = await form({ onResend, sending: true });
    expect(view.getByTestId('otpResend')).toBeDisabled();
    await fireEvent.press(view.getByTestId('otpResend'));
    expect(onResend).not.toHaveBeenCalled();

    // Dimmed, not resized: every metric but the opacity is the enabled link's (constitution V).
    const { opacity: dimmed, ...busyBox } = StyleSheet.flatten(
      view.getByTestId('otpResend').props.style,
    );
    await view.unmount();
    const idle = await form({ onResend });
    const { opacity: full, ...idleBox } = StyleSheet.flatten(
      idle.getByTestId('otpResend').props.style,
    );
    expect(busyBox).toEqual(idleBox);
    expect(dimmed).toBeLessThan(full ?? 1);
  });

  it('is disabled while a code is being checked', async () => {
    const onResend = jest.fn();
    const view = await form({ onResend, loading: true });
    expect(view.getByTestId('otpResend')).toBeDisabled();
    await fireEvent.press(view.getByTestId('otpResend'));
    expect(onResend).not.toHaveBeenCalled();
  });

  it('is enabled when nothing is in flight', async () => {
    const view = await form({ onResend: jest.fn() });
    expect(view.getByTestId('otpResend')).toBeEnabled();
  });
});

describe('the resend link in the sign-in flow', () => {
  it('sends one SMS for a double tap, and is disabled while it is being sent', async () => {
    let answerResend: (o: LoginOutcome) => void = () => {};
    const deps = {
      authService: {
        beginLogin: jest.fn(async () => ({ kind: 'needsOtpSms' }) as LoginOutcome),
        submitOtp: jest.fn(async () => ({ kind: 'error' }) as LoginOutcome),
        resendSms: jest.fn(
          () =>
            new Promise<LoginOutcome>(resolve => {
              answerResend = resolve;
            }),
        ),
        mobileKeyLogin: jest.fn(),
        abandon: jest.fn(async () => {}),
      },
      accountsController: {} as never,
      host: 'production' as const,
    };
    const view = await render(
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
    await fireEvent.press(view.getByTestId('method-otp_totp'));
    await fireEvent.press(view.getByTestId('continue'));
    await fireEvent.changeText(view.getByTestId('loginName'), 'user');
    await fireEvent.changeText(view.getByTestId('password'), 'secret');
    await fireEvent.press(view.getByTestId('submit'));
    await waitFor(() =>
      expect(view.getByTestId('otpNotice')).toHaveTextContent(/poslali v SMS/),
    );
    expect(view.getByTestId('otpResend')).toBeEnabled();

    await doubleTap(view.getByTestId('otpResend'));
    expect(deps.authService.resendSms).toHaveBeenCalledTimes(1);
    // While ISDS has not answered, the link is there but cannot be pressed again.
    await waitFor(() => expect(view.getByTestId('otpResend')).toBeDisabled());
    // And the screen says it is asking - not that a code was sent, nor that one is being checked.
    expect(view.getByTestId('otpNotice')).toHaveTextContent(/Žádáme o jednorázový kód/);

    await act(async () => {
      answerResend({ kind: 'needsOtpSms' });
    });
    await waitFor(() => expect(view.getByTestId('otpResend')).toBeEnabled());
    expect(deps.authService.resendSms).toHaveBeenCalledTimes(1);
  });
});
