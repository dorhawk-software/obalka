// The one-time-code field asks the OS for the right help (021, iOS report 2026-08-19).
//
// The user reported that on iPhone the code was never offered from the SMS. The app-side half of that
// is small and entirely checkable here: the props that ask iOS for Security Code AutoFill have to
// reach the REAL TextInput, and the field has to be focused, because the suggestion appears in the
// QuickType bar above a focused field and nowhere else.
//
// The second one is why this suite exists: `autoFocus` was set in the source and Tamagui's `Input`
// silently did not forward it. Reading the source would have told you the field was focused; only
// rendering it tells you the truth.
//
// Replaces `otpAutofill.test.tsx`, which asserted the same two props and hardcoded Android's
// `sms-otp` for every platform - the assumption this file exists to correct.

import { render } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { OtpForm } from '../../src/features/accounts/screens/OtpForm';

jest.mock('../../src/services/sms/smsUserConsent', () => ({
  listenForSmsCode: jest.fn(() => () => {}),
  smsAutofillAvailable: jest.fn(() => false),
}));

const form = () =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <OtpForm onSubmit={() => {}} onCancel={() => {}} />
    </TamaguiProvider>,
  );

describe('the one-time-code field', () => {
  it('asks iOS for Security Code AutoFill on the real native input', async () => {
    const view = await form();
    const input = view.getByTestId('otpCode');
    // Asserted on the rendered element, not on our JSX: the wrapper is what drops props.
    expect(input.props.textContentType).toBe('oneTimeCode');
    expect(input.props.keyboardType).toBe('number-pad');
  });

  it('uses each platform’s own autoComplete vocabulary', async () => {
    const view = await form();
    // jest runs as iOS under the RN preset; `sms-otp` is an Android value and says nothing to iOS,
    // where the equivalent is `one-time-code`.
    expect(view.getByTestId('otpCode').props.autoComplete).toBe('one-time-code');
  });

  // The bug itself, pinned. `autoFocus` IS set in OtpForm's JSX and does NOT arrive here - Tamagui's
  // `Input` does not forward it. That is why the screen focuses the field imperatively through the
  // ref instead. If a Tamagui upgrade ever starts forwarding it, this fails and someone gets to
  // delete the workaround rather than carry two mechanisms that both claim to do the same thing.
  //
  // What this canNOT assert is that focus() ran: RNTL gives a host element no focus state to read
  // and no instance to spy on. The consequence - the keyboard opening on arrival, and iOS having a
  // focused field to offer the code above - is device-verifiable only, and is recorded as such.
  it('does not receive autoFocus from the wrapper, which is why focus is imperative', async () => {
    const view = await form();
    expect(view.getByTestId('otpCode').props.autoFocus).toBeUndefined();
  });
});
