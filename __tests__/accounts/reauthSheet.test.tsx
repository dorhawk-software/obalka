// Signing in again as board R11 draws it (031, agreed 2026-11-12): the box is a sheet with its own
// envelope and a lock, the methods are the one sheet of choices, and a refused password keeps the
// form and puts the same suggestion sheet under the field as adding a box does. Before: an outlined
// box with an avatar, and a refusal that swapped the form for a centred blue card.

import { fireEvent, render, within } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { tamaguiConfig } from '../../tamagui.config';
import { LoginFlow } from '../../src/features/accounts/screens/LoginFlow';
import type { LoginAuthService } from '../../src/features/accounts/state/loginController';
import { AccountsController } from '../../src/features/accounts/state/accountsController';
import { InMemoryAccountsStore } from '../../src/services/db/accountsStore';
import { InMemorySecureStore } from '../../src/services/secureStore/secureStore';
import { t } from '../../src/i18n/strings';
import type { LoginOutcome } from '../../src/services/isds/types';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** ISDS refusing a password login, which authService marks as maybe wanting an SMS code. */
const refusedMaybeOtp: LoginOutcome = {
  kind: 'error',
  code: 'invalidCredentials',
  recoverable: true,
  messageKey: 'login.error.invalidCredentials',
  suggestOtp: true,
};

const auth: LoginAuthService = {
  beginLogin: async () => refusedMaybeOtp,
  submitOtp: async () => refusedMaybeOtp,
  resendSms: async () => ({ kind: 'needsOtpSms' }),
  mobileKeyLogin: async () => refusedMaybeOtp,
  abandon: async () => {},
};

async function reauthScreen() {
  const accountsController = new AccountsController({
    accounts: new InMemoryAccountsStore(),
    secureStore: new InMemorySecureStore(),
  });
  await accountsController.addAccount({
    loginName: 'k8tw2e',
    password: 'old',
    method: 'password',
    host: 'czebox',
    ownerInfo: { boxId: 'k4m9xrt', label: 'Jana Nováková', dbType: 'FO', passwordExpiresAt: null },
  });
  const [stored] = await accountsController.listAccounts();
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <LoginFlow deps={{ authService: auth, accountsController, host: 'czebox' }} reauth={stored} />
      </TamaguiProvider>
    </SafeAreaProvider>,
  );
}

describe('signing in again (R11)', () => {
  it('shows the box as a sheet with its envelope and the lock', async () => {
    const view = await reauthScreen();
    const box = view.getByTestId('boxSheet');
    expect(within(box).getByText('Jana Nováková')).toBeOnTheScreen();
    expect(within(box).getByTestId('envelopeTile', { includeHiddenElements: true })).toBeTruthy();
    expect(within(box).getByTestId('boxSheetLock', { includeHiddenElements: true })).toBeTruthy();
  });

  it('shows the Mobile Key communication code as typed, with no eye', async () => {
    const view = await reauthScreen();
    await fireEvent.press(view.getByTestId('reauth-method-mobile_key'));
    expect(view.getByTestId('password')).toHaveProp('secureTextEntry', false);
    expect(view.queryByTestId('togglePassword')).toBeNull();
  });

  it('keeps the form after a refused password and puts the suggestion sheet under the field', async () => {
    const view = await reauthScreen();
    await fireEvent.changeText(view.getByTestId('password'), 'nove-heslo');
    await fireEvent.press(view.getByTestId('submit'));
    const sheet = await view.findByTestId('otpSuggestion');
    expect(within(sheet).getByText(t('login.otpSuggest.title'))).toBeOnTheScreen();
    expect(view.getByTestId('password')).toHaveProp('value', 'nove-heslo');
    expect(view.getByTestId('useSms')).toHaveStyle({ minHeight: 44 });
    expect(view.getByTestId('refusedPortal')).toHaveStyle({ minHeight: 44 });
  });
});
