import { fireEvent, render } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { LoginFlow } from '../../src/features/accounts/screens/LoginFlow';
import { LoginAuthService } from '../../src/features/accounts/state/loginController';
import { AccountsController } from '../../src/features/accounts/state/accountsController';
import { InMemoryAccountsStore } from '../../src/services/db/accountsStore';
import { InMemorySecureStore } from '../../src/services/secureStore/secureStore';
import { t } from '../../src/i18n/strings';

// Render smoke test: proves the screens mount and the controller wires up. The full login flow
// (state transitions, persistence, OTP) is covered by loginController.test.ts.
const auth: LoginAuthService = {
  beginLogin: async () => ({ kind: 'needsOtpSms' }),
  submitOtp: async () => ({ kind: 'needsOtpSms' }),
  resendSms: async () => ({ kind: 'needsOtpSms' }),
  mobileKeyLogin: async () => ({ kind: 'needsOtpSms' }),
  abandon: async () => {},
};

const deps = {
  authService: auth,
  accountsController: new AccountsController({
    accounts: new InMemoryAccountsStore(),
    secureStore: new InMemorySecureStore(),
  }),
  host: 'czebox' as const,
};

describe('LoginFlow (component)', () => {
  it('add-box: method-first wizard - step 1 lists every method, step 2 shows its credentials', async () => {
    const view = await render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <LoginFlow deps={deps} />
      </TamaguiProvider>,
    );

    // Step 1: the method choice (password, SMS, Mobile Key) - no secret field yet.
    expect(view.getByText(t('login.title'))).toBeTruthy();
    expect(view.getByTestId('method-password')).toBeTruthy();
    expect(view.getByTestId('method-otp_totp')).toBeTruthy();
    expect(view.getByTestId('method-mobile_key')).toBeTruthy();
    expect(view.queryByTestId('loginName')).toBeNull();

    // Step 1 selects the method; the footer "Pokračovat" advances to step 2's credential fields.
    fireEvent.press(view.getByTestId('method-password'));
    fireEvent.press(view.getByTestId('continue'));
    expect(await view.findByTestId('loginName')).toBeTruthy();
    expect(view.getByTestId('password')).toBeTruthy();
    expect(view.getByTestId('submit')).toBeTruthy();
  });
});
