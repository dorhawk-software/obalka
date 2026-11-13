// The Mobile Key wait as board R8 draws it (031, agreed 2026-11-12): the box's envelope stands still
// with the login name in its window, and one waiting bar is the only motion. Before: a brand tile in a
// pulsing ring and a platform spinner.

import { fireEvent, render } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { LoginFlow } from '../../src/features/accounts/screens/LoginFlow';
import type { LoginAuthService } from '../../src/features/accounts/state/loginController';
import { AccountsController } from '../../src/features/accounts/state/accountsController';
import { InMemoryAccountsStore } from '../../src/services/db/accountsStore';
import { InMemorySecureStore } from '../../src/services/secureStore/secureStore';
import { t } from '../../src/i18n/strings';

const auth: LoginAuthService = {
  beginLogin: async () => ({ kind: 'needsOtpSms' }),
  submitOtp: async () => ({ kind: 'needsOtpSms' }),
  resendSms: async () => ({ kind: 'needsOtpSms' }),
  // ISDS has not heard back from the phone yet.
  mobileKeyLogin: () => new Promise<never>(() => {}),
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

describe('the Mobile Key wait (R8)', () => {
  it('is the box s envelope with the login name in its window, one bar moving, no spinner', async () => {
    const view = await render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <LoginFlow deps={deps} />
      </TamaguiProvider>,
    );
    await fireEvent.press(await view.findByTestId('method-mobile_key'));
    await fireEvent.press(view.getByTestId('continue'));
    await fireEvent.changeText(await view.findByTestId('loginName'), 'k8tw2e');
    await fireEvent.changeText(view.getByTestId('password'), 'heslo-pro-test');
    void fireEvent.press(view.getByTestId('submit'));

    expect(await view.findByTestId('mobileKeyWaiting')).toBeTruthy();
    expect(view.getByTestId('waitingEnvelopeName', { includeHiddenElements: true })).toHaveTextContent('k8tw2e');
    expect(view.getByTestId('mobileKeyBar')).toBeTruthy();
    expect(JSON.stringify(view.toJSON())).not.toContain('ActivityIndicator');
    expect(view.getByText(t('login.mobileKey.expiryHint'))).toBeTruthy();
  });
});
