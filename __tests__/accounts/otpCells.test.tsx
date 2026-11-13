// The SMS code as board R8 draws it (031, agreed 2026-11-12): eight digit boxes, the notice a blue
// tone strip, and Confirm waiting for all eight. Before: one wide field with dots, a centred grey
// line for the notice, and Confirm open from the first digit.

import { fireEvent, render } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { OtpForm } from '../../src/features/accounts/screens/OtpForm';
import { t } from '../../src/i18n/strings';

jest.mock('../../src/services/sms/smsUserConsent', () => ({
  listenForSmsCode: jest.fn(() => () => {}),
  smsAutofillAvailable: jest.fn(() => false),
}));

function form(onSubmit: (code: string) => void = () => {}) {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <OtpForm onSubmit={onSubmit} onCancel={() => {}} onResend={() => {}} />
    </TamaguiProvider>,
  );
}

describe('the SMS code (R8)', () => {
  it('shows each digit in its own box, eight of them', async () => {
    const view = await form();
    await fireEvent.changeText(view.getByTestId('otpCode'), '482913');
    expect(view.getAllByTestId(/^otpCell-/, { includeHiddenElements: true })).toHaveLength(8);
    expect(view.getByTestId('otpCell-0', { includeHiddenElements: true })).toHaveTextContent('4');
    expect(view.getByTestId('otpCell-5', { includeHiddenElements: true })).toHaveTextContent('3');
    expect(view.getByTestId('otpCell-6', { includeHiddenElements: true })).toHaveTextContent('');
  });

  it('keeps only digits, and no more than eight, from a paste', async () => {
    const view = await form();
    await fireEvent.changeText(view.getByTestId('otpCode'), '3512 4603 99');
    expect(view.getByTestId('otpCode').props.value).toBe('35124603');
  });

  it('confirms only a whole code', async () => {
    const onSubmit = jest.fn();
    const view = await form(onSubmit);
    await fireEvent.changeText(view.getByTestId('otpCode'), '3512460');
    await fireEvent.press(view.getByTestId('otpSubmit'));
    expect(onSubmit).not.toHaveBeenCalled();
    await fireEvent.changeText(view.getByTestId('otpCode'), '35124603');
    await fireEvent.press(view.getByTestId('otpSubmit'));
    expect(onSubmit).toHaveBeenCalledWith('35124603');
  });

  it('says the code was sent on a tone strip with its bell', async () => {
    const view = await form();
    expect(view.getByTestId('otpNotice')).toHaveTextContent(t('login.otp.notice.smsSent'));
    expect(view.getByTestId('otpNoticeBell')).toBeOnTheScreen();
  });
});
