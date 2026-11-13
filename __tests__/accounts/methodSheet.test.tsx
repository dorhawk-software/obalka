// The sign-in methods as board R11 draws them (031, agreed 2026-11-12; the owner asked 2026-11-13):
// one sheet of radio rows, the anatomy of Settings' Vzhled, on the add-box step and on re-sign-in.
// Before: three outlined cards, the picked one tinted blue, each announced as a button.

import { fireEvent, render } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AddBoxForm } from '../../src/features/accounts/screens/AddBoxForm';
import { STRINGS_FOR_TEST, t } from '../../src/i18n/strings';

function form() {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <AddBoxForm onSubmit={() => {}} onBack={() => {}} onOpenFaq={() => {}} />
    </TamaguiProvider>,
  );
}

describe('the method step (R11)', () => {
  it('offers the methods as radios, the picked one selected', async () => {
    const view = await form();
    for (const m of ['password', 'otp_totp', 'mobile_key']) {
      expect(view.getByTestId(`method-${m}`).props.accessibilityRole).toBe('radio');
    }
    expect(view.getByTestId('method-password').props.accessibilityState).toEqual({ selected: true });
    await fireEvent.press(view.getByTestId('method-mobile_key'));
    expect(view.getByTestId('method-mobile_key').props.accessibilityState).toEqual({ selected: true });
    expect(view.getByTestId('method-password').props.accessibilityState).toEqual({ selected: false });
  });

  it('keeps the environment help open under the switch', async () => {
    const view = await form();
    await fireEvent.press(view.getByTestId('advancedToggle'));
    expect(view.getByText(new RegExp(t('login.environment.help.czebox').slice(0, 30)))).toBeOnTheScreen();
    expect(view.queryByTestId('env-help')).toBeNull();
  });
});

describe('the fields step (R11)', () => {
  it('names the method in a chip, and masks a password behind the eye', async () => {
    const view = await form();
    await fireEvent.press(view.getByTestId('continue'));
    expect(view.getByTestId('methodChip')).toHaveTextContent(t('login.method.label.password'));
    expect(view.getByTestId('password')).toHaveProp('secureTextEntry', true);
    expect(view.getByTestId('togglePassword')).toBeOnTheScreen();
  });

  it('shows the Mobile Key communication code as typed, with no eye', async () => {
    const view = await form();
    await fireEvent.press(view.getByTestId('method-mobile_key'));
    await fireEvent.press(view.getByTestId('continue'));
    expect(view.getByTestId('password')).toHaveProp('secureTextEntry', false);
    expect(view.queryByTestId('togglePassword')).toBeNull();
  });
});

// Seen on the emulator (2026-11-13): unmasked, the English "Generated code from the portal (not your
// password)" wrapped onto a second, clipped line of the 50 field. A placeholder is one line of a
// 347-wide field at 15: 40 characters, the Czech's 37 with room.
describe('the communication code placeholder', () => {
  it('fits one line of the field in each language', () => {
    for (const lang of ['cs', 'en'] as const) {
      expect(STRINGS_FOR_TEST[lang]['login.commCode.placeholder'].length).toBeLessThanOrEqual(40);
    }
  });
});
