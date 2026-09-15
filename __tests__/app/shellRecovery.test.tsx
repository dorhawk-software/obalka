// The shell's own failures settle to something the user can act on (constitution II).
//
// Four paths in `AppShell` rejected with nothing to catch them. The launch read of the accounts table:
// the launch screen spun for good. The re-read after adding a box: the sign-in form's finished state
// stayed up with no way on. Renaming a box, which the switcher does not wait for: the sheet closed as
// if the name had been saved. And the re-read after a re-auth: the refresh that follows it never ran.
// These mount the real shell over fakes of its dependencies and break the table where each one reads.

import { enableScreens } from 'react-native-screens';
enableScreens(false);

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { AppShell } from '../../src/app/AppShell';
import { t } from '../../src/i18n/strings';
import * as telemetry from '../../src/services/telemetry/telemetry';
import type { DataBoxAccount } from '../../src/services/isds/types';

/** The fake database and ISDS behind the shell. */
const mockWorld = {
  accounts: [] as DataBoxAccount[],
  /** How many reads of the accounts table fail before they work again. */
  listFailures: 0,
  /** Every read of the accounts table fails. */
  listBroken: false,
  /** How many alias writes fail before they work again. */
  aliasFailures: 0,
  /** Every alias written, in order. */
  aliasWrites: [] as (string | null)[],
  /** Boxes whose re-auth succeeded - ISDS lists their mail from then on. */
  signedIn: new Set<string>(),
  /** Reads of the table that fail once a re-auth has been saved. */
  listFailuresAfterReauth: 0,
  /** Boxes a refresh-all recorded as synced. */
  synced: [] as string[],
  /** The box the fake ISDS signs in as. */
  signInAs: 'a',
  /** Reads of the table that fail once a box has been added. */
  listFailuresAfterAdd: 0,
};

jest.mock('../../src/features/accounts/deps', () => {
  const accountsController = {
    listAccounts: async () => {
      if (mockWorld.listBroken) {
        throw new Error('database disk image is malformed');
      }
      if (mockWorld.listFailures > 0) {
        mockWorld.listFailures -= 1;
        throw new Error('database is locked');
      }
      return mockWorld.accounts.map(a => ({ ...a }));
    },
    recordSync: async (boxId: string) => {
      mockWorld.synced.push(boxId);
    },
    recordCredit: async () => {},
    recordSyncFailure: async () => {},
    setAlias: async (boxId: string, alias: string | null) => {
      mockWorld.aliasWrites.push(alias);
      if (mockWorld.aliasFailures > 0) {
        mockWorld.aliasFailures -= 1;
        throw new Error('database is locked');
      }
      mockWorld.accounts = mockWorld.accounts.map(a => (a.boxId === boxId ? { ...a, alias } : a));
    },
    addAccount: async (input: { ownerInfo: { boxId: string; label: string } }) => {
      const added = mockAccount(input.ownerInfo.boxId, input.ownerInfo.label);
      mockWorld.accounts = [...mockWorld.accounts, added];
      mockWorld.listFailures = mockWorld.listFailuresAfterAdd;
      return added;
    },
    reauthAccount: async (boxId: string) => {
      mockWorld.signedIn.add(boxId);
      mockWorld.listFailures = mockWorld.listFailuresAfterReauth;
    },
  };
  return {
    accountsController,
    removalQueue: new (jest.requireActual('../../src/features/accounts/state/removalQueue').RemovalQueue)(),
    boxWork: new (jest.requireActual('../../src/features/messages/state/boxWork').BoxWork)(),
    messagesController: {
      listReceived: async (account: DataBoxAccount) =>
        mockWorld.signedIn.has(account.boxId)
          ? { kind: 'loaded', messages: [], downloaded: [], syncedAt: Date.now() }
          : { kind: 'reauth' },
      listSent: async () => ({ kind: 'loaded', messages: [], downloaded: [] }),
      getCachedMessages: async () => ({ envelopes: [], downloaded: [], syncedAt: null }),
      getCredit: async () => null,
    },
    // The shell listens for restores ending while a phone has no boxes (2026-09-24); none run here.
    backupController: { subscribe: () => () => {}, currentRun: () => null },
    transferController: { available: () => false },
    remindersController: { listForBox: async () => [] },
    scanController: { clearBox: async () => {} },
    appLock: { forget: async () => {} },
    draftsStore: { list: async () => [] },
    settingsStore: {
      getSetting: async () => null,
      setSetting: async () => {},
    },
    // The sign-in flow, over a fake ISDS that signs in as `signInAs`.
    createLoginDeps: () => ({
      authService: {
        beginLogin: async () => ({
          kind: 'signedIn',
          ownerInfo: {
            boxId: mockWorld.signInAs,
            label: 'Nová',
            dbType: null,
            passwordExpiresAt: null,
          },
          sessionCookie: null,
        }),
        submitOtp: async () => ({ kind: 'needsOtpSms' }),
        resendSms: async () => ({ kind: 'needsOtpSms' }),
        mobileKeyLogin: async () => ({ kind: 'needsOtpSms' }),
        abandon: async () => {},
      },
      accountsController,
      host: 'czebox',
    }),
  };
});

// Diagnostics already answered, so the shell goes straight to the inbox instead of the consent card.
jest.mock('../../src/app/settings/SettingsProvider', () => {
  const actual = jest.requireActual('../../src/app/settings/SettingsProvider');
  return {
    ...actual,
    useSettings: () => ({ ...actual.useSettings(), telemetry: false }),
  };
});

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function mockAccount(boxId: string, label: string): DataBoxAccount {
  return {
    id: boxId,
    boxId,
    loginName: 'user',
    label,
    dbType: null,
    alias: null,
    authMethod: 'password',
    host: 'production',
    secretRef: 'ref',
    sessionValidUntil: null,
    passwordExpiresAt: null,
    lastSyncedAt: null,
    messageCount: null,
    unreadCount: null,
    pdzCreditCzk: null,
    syncError: null,
    createdAt: 0,
    updatedAt: 0,
  };
}

function renderShell() {
  return render(
    <GestureHandlerRootView>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <AppThemeProvider isDark={false}>
          <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
            <AppShell />
          </SafeAreaProvider>
        </AppThemeProvider>
      </TamaguiProvider>
    </GestureHandlerRootView>,
  );
}

type View = Awaited<ReturnType<typeof renderShell>>;

async function press(view: View, testID: string) {
  await act(async () => {
    fireEvent.press(view.getByTestId(testID));
  });
}

async function type(view: View, testID: string, text: string) {
  await act(async () => {
    fireEvent.changeText(view.getByTestId(testID), text);
  });
}

/** Switcher → the box's ⋯ → Upravit schránku → a new name → Uložit. */
async function rename(view: View, boxId: string, alias: string) {
  for (const testID of ['boxSwitcher', `boxMenu-${boxId}`, `boxRename-${boxId}`]) {
    await press(view, testID);
  }
  // The rename field starts empty for a box with no name of its own.
  const inputs = view.getAllByDisplayValue('');
  await act(async () => {
    fireEvent.changeText(inputs[inputs.length - 1], alias);
  });
  await press(view, 'aliasSave');
}

beforeEach(() => {
  mockWorld.accounts = [mockAccount('a', 'Alfa'), mockAccount('b', 'Beta')];
  mockWorld.listFailures = 0;
  mockWorld.listBroken = false;
  mockWorld.aliasFailures = 0;
  mockWorld.aliasWrites = [];
  mockWorld.signedIn = new Set(['a', 'b']);
  mockWorld.listFailuresAfterReauth = 0;
  mockWorld.synced = [];
  mockWorld.signInAs = 'a';
  mockWorld.listFailuresAfterAdd = 0;
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('when the saved boxes will not load at launch', () => {
  it('says so on the launch screen, and loads them on retry', async () => {
    mockWorld.listFailures = 1;
    const view = await renderShell();

    await waitFor(() => expect(view.getByTestId('loadFailed')).toBeTruthy());
    expect(view.getByTestId('loadFailed')).toHaveTextContent(new RegExp(t('app.loadFailed')));

    await press(view, 'loadRetry');
    await waitFor(() => expect(view.getByTestId('boxSwitcher')).toBeTruthy());
    expect(view.queryByTestId('loadFailed')).toBeNull();
  });

  it('says so again when the retry fails too', async () => {
    mockWorld.listFailures = 2;
    const view = await renderShell();
    await waitFor(() => expect(view.getByTestId('loadFailed')).toBeTruthy());

    await press(view, 'loadRetry');
    await waitFor(() => expect(view.getByTestId('loadFailed')).toBeTruthy());
    await press(view, 'loadRetry');
    await waitFor(() => expect(view.getByTestId('boxSwitcher')).toBeTruthy());
  });

  it('tells a screen reader, and names the way on, each time', async () => {
    // The spinner is hidden from a screen reader once the message is up, so nothing said the launch
    // had stopped, or that a retry was there to find.
    const announced = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    mockWorld.listFailures = 2;
    const view = await renderShell();
    await waitFor(() => expect(view.getByTestId('loadFailed')).toBeTruthy());
    const said = `${t('app.loadFailed')} ${t('app.loadFailed.retry')}`;
    expect(announced).toHaveBeenCalledWith(said);

    announced.mockClear();
    await press(view, 'loadRetry');
    await waitFor(() => expect(announced).toHaveBeenCalledWith(said));
  });
});

describe('when the list will not read right after a box is added', () => {
  it('says so, and opens the new box on retry', async () => {
    mockWorld.accounts = [];
    mockWorld.signInAs = 'n';
    mockWorld.listFailuresAfterAdd = 1;
    const view = await renderShell();
    await waitFor(() => expect(view.getByTestId('welcome')).toBeTruthy());

    await press(view, 'welcome-add-box');
    await press(view, 'method-password');
    await press(view, 'continue');
    await type(view, 'loginName', 'user');
    await type(view, 'password', 'secret');
    await press(view, 'submit');

    await waitFor(() => expect(view.getByTestId('loadFailed')).toBeTruthy());
    await press(view, 'loadRetry');
    await waitFor(() => expect(view.getByTestId('boxSwitcher')).toBeTruthy());
    await press(view, 'boxSwitcher');
    expect(view.getByTestId('switchBox-n').props.accessibilityState?.selected).toBe(true);
  });
});

describe('renaming a box', () => {
  it('says the new name was not saved, and saves the same name on retry', async () => {
    mockWorld.aliasFailures = 1;
    const view = await renderShell();
    await waitFor(() => expect(view.getByTestId('boxSwitcher')).toBeTruthy());
    await rename(view, 'a', 'Doma');

    await waitFor(() => expect(view.getByTestId('aliasFailed')).toBeTruthy());
    expect(view.getByTestId('aliasFailed')).toHaveTextContent(new RegExp(t('box.aliasFailed.body')));

    await press(view, 'aliasFailedRetry');
    await waitFor(() => expect(view.queryByTestId('aliasFailed')).toBeNull());
    expect(mockWorld.aliasWrites).toEqual(['Doma', 'Doma']);
    await press(view, 'boxSwitcher');
    expect(view.getByTestId('switchBox-a')).toHaveTextContent(/Doma/);
  });

  it('shows the new name when it saved but the list would not read again', async () => {
    const view = await renderShell();
    await waitFor(() => expect(view.getByTestId('boxSwitcher')).toBeTruthy());
    await press(view, 'boxSwitcher');
    // Broken from here on: the save goes through, and every read after it fails.
    await act(async () => {
      mockWorld.listBroken = true;
    });
    for (const testID of ['boxMenu-a', 'boxRename-a']) {
      await press(view, testID);
    }
    const inputs = view.getAllByDisplayValue('');
    await act(async () => {
      fireEvent.changeText(inputs[inputs.length - 1], 'Doma');
    });
    await press(view, 'aliasSave');

    await waitFor(() => expect(view.getByTestId('switchBox-a')).toHaveTextContent(/Doma/));
    expect(view.queryByTestId('aliasFailed')).toBeNull();
  });

  it('keeps the list on screen, and reports it, when a re-read on the way in will not read', async () => {
    const reported = jest.spyOn(telemetry, 'reportFailure');
    const view = await renderShell();
    await waitFor(() => expect(view.getByTestId('boxSwitcher')).toBeTruthy());
    mockWorld.listBroken = true;
    // Opening the switcher re-reads the table.
    await press(view, 'boxSwitcher');

    await waitFor(() =>
      expect(reported).toHaveBeenCalledWith('db.read', expect.any(Error), { stage: 'persist' }),
    );
    expect(view.getByTestId('switchBox-a')).toBeTruthy();
    expect(view.getByTestId('switchBox-b')).toBeTruthy();
  });
});

describe('a re-auth whose list will not read afterwards', () => {
  it('still refreshes every box, and reports the read', async () => {
    // The re-read threw, and the refresh of every box that follows a re-auth never ran.
    const reported = jest.spyOn(telemetry, 'reportFailure');
    mockWorld.signedIn = new Set(['b']);
    mockWorld.listFailuresAfterReauth = 1;
    const view = await renderShell();
    await waitFor(() => expect(view.getByTestId('reauth')).toBeTruthy());

    await press(view, 'reauth');
    await type(view, 'password', 'new');
    await press(view, 'submit');

    await waitFor(() => expect(mockWorld.synced).toContain('a'));
    expect(reported).toHaveBeenCalledWith('db.read', expect.any(Error), { stage: 'persist' });
    await waitFor(() => expect(view.queryByTestId('reauth')).toBeNull());
  });
});

// 001 FR-009, for a box with no verdict stored: the inbox strip judged an expired password at the
// moment ISDS refused the box, and the re-auth screen it opens at the moment the screen opened.
describe('the inbox strip and the re-auth screen', () => {
  it('give one answer for a box refused just before its password expired and opened just after', async () => {
    const realNow = Date.now.bind(Date);
    let later = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => realNow() + later);
    mockWorld.accounts = [
      { ...mockAccount('a', 'Alfa'), passwordExpiresAt: realNow() + 60_000 },
      mockAccount('b', 'Beta'),
    ];
    mockWorld.signedIn = new Set(['b']);
    const view = await renderShell();
    await waitFor(() => expect(view.getByTestId('reauth')).toBeTruthy());
    expect(view.getByText(t('box.reauth.credentials'))).toBeTruthy();

    // Two minutes on - past the date - the user taps "Přihlásit znovu".
    later = 120_000;
    await press(view, 'reauth');
    await waitFor(() => expect(view.getByText(t('reauth.intro.credentials'))).toBeTruthy());
    expect(view.queryByText(t('reauth.intro.passwordExpired'))).toBeNull();
    expect(view.queryByTestId('reauthPortal')).toBeNull();
  });
});
