// Signing in again to a box whose password expired (001 FR-009).
//
// The app assumes ISDS refuses an expired password the way it refuses a wrong one - no other answer
// has been captured. The
// screen that asks for the password again is where "wrong" had a cost: the user retypes something
// that cannot work until it is changed on the portal. These walk the real LoginFlow and
// LoginController over a stored box whose password-expiry date has passed, and one whose has not.

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { tamaguiConfig } from '../../tamagui.config';
import { LoginFlow } from '../../src/features/accounts/screens/LoginFlow';
import { BoxSwitcherSheet } from '../../src/features/accounts/screens/BoxSwitcherSheet';
import type { LoginAuthService } from '../../src/features/accounts/state/loginController';
import { AccountsController } from '../../src/features/accounts/state/accountsController';
import { InMemoryAccountsStore } from '../../src/services/db/accountsStore';
import { InMemorySecureStore } from '../../src/services/secureStore/secureStore';
import { t } from '../../src/i18n/strings';
import type { DataBoxAccount, LoginOutcome, SyncFailure } from '../../src/services/isds/types';

const DAY = 86_400_000;

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** ISDS refusing the password - the answer the app assumes an expired one gets too. */
const refused: LoginOutcome = {
  kind: 'error',
  code: 'invalidCredentials',
  recoverable: true,
  messageKey: 'login.error.invalidCredentials',
};

const authRefusing: LoginAuthService = {
  beginLogin: async () => refused,
  submitOtp: async () => refused,
  resendSms: async () => ({ kind: 'needsOtpSms' }),
  mobileKeyLogin: async () => refused,
  abandon: async () => {},
};

/**
 * A stored czebox password box with this password-expiry date - and, when given, the flag a refresh
 * stored when ISDS refused it.
 */
async function storedBox(passwordExpiresAt: number | null, syncError?: SyncFailure) {
  const accountsController = new AccountsController({
    accounts: new InMemoryAccountsStore(),
    secureStore: new InMemorySecureStore(),
  });
  await accountsController.addAccount({
    loginName: 'novak',
    password: 'old',
    method: 'password',
    host: 'czebox',
    ownerInfo: { boxId: 'b1', label: 'Box', dbType: null, passwordExpiresAt },
  });
  if (syncError) {
    await accountsController.recordSyncFailure('b1', syncError);
  }
  const [stored] = await accountsController.listAccounts();
  return { accountsController, stored };
}

/** The re-auth screen for a stored czebox password box with this password-expiry date. */
async function reauthScreen(
  passwordExpiresAt: number | null,
  syncError?: SyncFailure,
  refusedAt?: number,
) {
  const { accountsController, stored } = await storedBox(passwordExpiresAt, syncError);
  return render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <LoginFlow
          deps={{ authService: authRefusing, accountsController, host: 'czebox' }}
          reauth={stored}
          reauthRefusedAt={refusedAt}
        />
      </TamaguiProvider>
    </SafeAreaProvider>,
  );
}

/** The switcher, listing that one stored box. */
function switcherWith(stored: DataBoxAccount) {
  return render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <BoxSwitcherSheet
          onClose={() => {}}
          accounts={[stored]}
          activeBoxId="b1"
          onSwitch={() => {}}
          onAddBox={() => {}}
          onOpenSettings={() => {}}
          onSetAlias={() => {}}
          onRemove={async () => {}}
        />
      </TamaguiProvider>
    </SafeAreaProvider>,
  );
}

async function signInWith(
  view: Awaited<ReturnType<typeof render>>,
  password: string,
) {
  await act(async () => {
    fireEvent.changeText(view.getByTestId('password'), password);
  });
  await act(async () => {
    fireEvent.press(view.getByTestId('submit'));
  });
}

describe('signing in again to a box whose password expired', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('says so before the attempt - retyping the old password is not the fix', async () => {
    const view = await reauthScreen(Date.now() - DAY);
    expect(view.getByText(t('reauth.intro.passwordExpired'))).toBeTruthy();
    expect(view.queryByText(t('reauth.intro.credentials'))).toBeNull();
  });

  it('offers the portal before the attempt too, for the box’s own environment', async () => {
    // The intro said "change it on the portal first" with no way there until a sign-in had been
    // tried and refused - the one attempt that intro exists to talk the user out of.
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const view = await reauthScreen(Date.now() - DAY);
    await act(async () => {
      fireEvent.press(view.getByTestId('reauthPortal'));
    });
    expect(open).toHaveBeenCalledWith('https://www.datovka-test.gov.cz');
    // The form is still there for when it has been changed.
    expect(view.getByTestId('password')).toBeTruthy();
  });

  it('after ISDS refuses it, offers the portal of the box’s own environment', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const view = await reauthScreen(Date.now() - DAY);
    await signInWith(view, 'old');

    await waitFor(() => expect(view.getByTestId('error')).toBeTruthy());
    expect(view.getByText(t('login.error.passwordChangeRequired'))).toBeTruthy();
    await act(async () => {
      fireEvent.press(view.getByTestId('openPortal'));
    });
    // The test portal: a czebox login does not exist on the production one.
    expect(open).toHaveBeenCalledWith('https://www.datovka-test.gov.cz');
    // Trying again stays possible, for when the password has been changed.
    expect(view.getByTestId('retry')).toBeTruthy();
  });

  it('keeps the invalid-credentials wording, and no portal, while the date is still ahead', async () => {
    const view = await reauthScreen(Date.now() + 30 * DAY);
    expect(view.getByText(t('reauth.intro.credentials'))).toBeTruthy();
    expect(view.queryByTestId('reauthPortal')).toBeNull();
    await signInWith(view, 'wrong');

    await waitFor(() => expect(view.getByTestId('error')).toBeTruthy());
    expect(view.getByText(t('login.error.invalidCredentials'))).toBeTruthy();
    expect(view.queryByTestId('openPortal')).toBeNull();
  });
});

// The switcher row said one thing and the screen it led to another. The row shows the flag a refresh
// stored when ISDS refused the box; the re-auth screen re-read the verdict from the clock. A box
// refused a day BEFORE its date - most likely a password already changed on the portal - is flagged
// `reauth`, and once that date had passed its re-auth screen said the password expired and pointed
// at the portal again. One stored verdict now answers both.
describe('the switcher row and the re-auth screen give one answer', () => {
  it('a box refused before its date stays "sign in again" on both, after the date has passed', async () => {
    const { stored } = await storedBox(Date.now() - DAY, 'reauth');
    const row = await switcherWith(stored);
    expect(row.getByTestId('syncState-b1')).toHaveTextContent(new RegExp(t('box.sync.reauth')));

    const screen = await reauthScreen(Date.now() - DAY, 'reauth');
    expect(screen.getByText(t('reauth.intro.credentials'))).toBeTruthy();
    expect(screen.queryByText(t('reauth.intro.passwordExpired'))).toBeNull();
    expect(screen.queryByTestId('reauthPortal')).toBeNull();
  });

  it('a box refused for an expired password says so on both, with the way to the portal', async () => {
    const { stored } = await storedBox(Date.now() - DAY, 'passwordExpired');
    const row = await switcherWith(stored);
    expect(row.getByTestId('syncState-b1')).toHaveTextContent(
      new RegExp(t('box.sync.passwordExpired')),
    );

    const screen = await reauthScreen(Date.now() - DAY, 'passwordExpired');
    expect(screen.getByText(t('reauth.intro.passwordExpired'))).toBeTruthy();
    expect(screen.getByTestId('reauthPortal')).toBeTruthy();
  });
});

// A box with nothing stored is judged at a moment, and the strip and the screen used different ones:
// the inbox strip the refusal, the re-auth screen its own opening. Refused a minute before the date and
// opened a minute after it, the strip said "sign in again" and the screen "change it on the portal".
describe('a box with no verdict stored', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('is judged on the re-auth screen at the moment ISDS refused it, not when the screen opened', async () => {
    const refusedAt = Date.now();
    const expiresAt = refusedAt + 60_000;
    const realNow = Date.now.bind(Date);
    jest.spyOn(Date, 'now').mockImplementation(() => realNow() + 120_000);

    const screen = await reauthScreen(expiresAt, undefined, refusedAt);
    expect(screen.getByText(t('reauth.intro.credentials'))).toBeTruthy();
    expect(screen.queryByText(t('reauth.intro.passwordExpired'))).toBeNull();
    expect(screen.queryByTestId('reauthPortal')).toBeNull();
  });
});
