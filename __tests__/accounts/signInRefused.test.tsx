// A sign-in that cannot go on, as boards R8 and R11 draw it (031, agreed 2026-11-12). A refusal - the
// name, the password or its expiry - is one card: the lock in its well, what ISDS said, the way back to
// the fields, and the portal. Any other failure is the sealed envelope of "could not load", the reason
// and Zkusit znovu. Before: red centred text over a shadowed button, for both.

import { fireEvent, render, within } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { LoginFlow } from '../../src/features/accounts/screens/LoginFlow';
import type { LoginAuthService } from '../../src/features/accounts/state/loginController';
import { AccountsController } from '../../src/features/accounts/state/accountsController';
import { InMemoryAccountsStore } from '../../src/services/db/accountsStore';
import { InMemorySecureStore } from '../../src/services/secureStore/secureStore';
import type { LoginErrorCode } from '../../src/services/isds/types';
import { t } from '../../src/i18n/strings';

function refusing(code: LoginErrorCode): LoginAuthService {
  return {
    beginLogin: async () => ({ kind: 'error', code, recoverable: true, messageKey: `login.error.${code}` }),
    submitOtp: async () => ({ kind: 'needsOtpSms' }),
    resendSms: async () => ({ kind: 'needsOtpSms' }),
    mobileKeyLogin: async () => ({ kind: 'error', code, recoverable: true, messageKey: `login.error.${code}` }),
    abandon: async () => {},
  };
}

async function signInRefusedWith(code: LoginErrorCode) {
  const deps = {
    authService: refusing(code),
    accountsController: new AccountsController({
      accounts: new InMemoryAccountsStore(),
      secureStore: new InMemorySecureStore(),
    }),
    host: 'czebox' as const,
  };
  const view = await render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <LoginFlow deps={deps} />
    </TamaguiProvider>,
  );
  // The SMS method: a refused password there is not a hint to try SMS, it is a refusal.
  await fireEvent.press(view.getByTestId('method-otp_totp'));
  await fireEvent.press(view.getByTestId('continue'));
  await fireEvent.changeText(await view.findByTestId('loginName'), 'k8tw2e');
  await fireEvent.changeText(view.getByTestId('password'), 'heslo');
  await fireEvent.press(view.getByTestId('submit'));
  return view;
}

describe('a refused sign-in (R8)', () => {
  it('is one card: what ISDS said, the way back to the fields, and the portal', async () => {
    const view = await signInRefusedWith('invalidCredentials');
    const card = await view.findByTestId('signInRefused');
    expect(within(card).getByText(t('login.refused.title'))).toBeOnTheScreen();
    expect(within(card).getByText(t('login.error.invalidCredentials'))).toBeOnTheScreen();
    expect(view.getByTestId('retry')).toHaveTextContent(t('login.refused.edit'));
    expect(view.getByTestId('openPortal')).toBeOnTheScreen();
    // Back to the fields as they were sent, not to the method choice already made.
    await fireEvent.press(view.getByTestId('retry'));
    expect(await view.findByTestId('loginName')).toHaveProp('value', 'k8tw2e');
    expect(view.getByTestId('password')).toHaveProp('value', 'heslo');
  });

  it('for an expired password too', async () => {
    const view = await signInRefusedWith('passwordChangeRequired');
    const card = await view.findByTestId('signInRefused');
    expect(within(card).getByText(t('login.error.passwordChangeRequired'))).toBeOnTheScreen();
    expect(view.getByTestId('openPortal')).toBeOnTheScreen();
  });
});

describe('a sign-in error (R11)', () => {
  it('is the sealed envelope, the reason and Zkusit znovu, with no portal', async () => {
    const view = await signInRefusedWith('serverFault');
    const error = await view.findByTestId('signInError');
    expect(within(error).getByText(t('login.error.serverFault'))).toBeOnTheScreen();
    expect(within(error).getByTestId('envelopePose-sealed', { includeHiddenElements: true })).toBeTruthy();
    expect(view.getByTestId('retry')).toHaveTextContent(t('login.retry'));
    expect(view.queryByTestId('openPortal')).toBeNull();
    expect(view.queryByTestId('signInRefused')).toBeNull();
  });
});
