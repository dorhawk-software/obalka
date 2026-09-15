// Re-reading the boxes must never load anything again (2026-10-03, the double load).
//
// The shell re-reads the accounts table all the time - on every return to the inbox, after the
// switcher opens, after a sync - and each read handed down NEW objects with the same contents. Every
// effect keyed on an account object, or on a prop built from one inline, ran again: the inbox listed
// its box a second time, the merged view re-read the archive and redrew, the detail screen blanked and
// cancelled a download, compose asked for the credit twice. On screen that was the list flickering,
// and towards ISDS it was a listing nobody asked for.
//
// The fix is in three places (the shell keeps an unchanged account the same object, the screens key
// their loads on the box's ID, and a second listing of a box joins the one under way), and this is
// the guard for all of them at once: mount the real shell, let it settle, make it re-read an
// unchanged table again and again, and require that nothing past the table was asked for anything.
// A new screen that keys a load on an account object fails here, not on somebody's phone.

import { enableScreens } from 'react-native-screens';
enableScreens(false);

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { AppShell } from '../../src/app/AppShell';
import type { DataBoxAccount } from '../../src/services/isds/types';

/** The table behind the shell, and every read past it. */
const mockWorld = {
  accounts: [] as DataBoxAccount[],
  tableReads: 0,
};

const mockCalls = {
  listReceived: jest.fn(async () => ({ kind: 'loaded', messages: [], downloaded: [], syncedAt: 1 })),
  listSent: jest.fn(async () => ({ kind: 'loaded', messages: [], downloaded: [], syncedAt: 1 })),
  getCachedMessages: jest.fn(async () => ({ envelopes: [], downloaded: [], syncedAt: null })),
  getMergedMessages: jest.fn(async () => ({ hits: [], downloaded: [], syncedAt: null })),
  getCredit: jest.fn(async () => null),
  listForBox: jest.fn(async () => []),
  listDrafts: jest.fn(async () => []),
};

jest.mock('../../src/features/accounts/deps', () => {
  const accountsController = {
    listAccounts: async () => {
      mockWorld.tableReads += 1;
      // A fresh copy every time, as the real table read hands back.
      return mockWorld.accounts.map(a => ({ ...a }));
    },
    recordSync: async () => {},
    recordCredit: async () => {},
    recordSyncFailure: async () => {},
  };
  return {
    accountsController,
    removalQueue: new (jest.requireActual('../../src/features/accounts/state/removalQueue').RemovalQueue)(),
    boxWork: new (jest.requireActual('../../src/features/messages/state/boxWork').BoxWork)(),
    messagesController: {
      listReceived: (...args: unknown[]) => (mockCalls.listReceived as (...a: unknown[]) => unknown)(...args),
      listSent: (...args: unknown[]) => (mockCalls.listSent as (...a: unknown[]) => unknown)(...args),
      getCachedMessages: (...args: unknown[]) => (mockCalls.getCachedMessages as (...a: unknown[]) => unknown)(...args),
      getMergedMessages: (...args: unknown[]) => (mockCalls.getMergedMessages as (...a: unknown[]) => unknown)(...args),
      getCredit: (...args: unknown[]) => (mockCalls.getCredit as (...a: unknown[]) => unknown)(...args),
    },
    backupController: { subscribe: () => () => {}, currentRun: () => null },
    transferController: { available: () => false },
    remindersController: { listForBox: (...args: unknown[]) => (mockCalls.listForBox as (...a: unknown[]) => unknown)(...args) },
    scanController: { clearBox: async () => {} },
    appLock: { forget: async () => {} },
    draftsStore: { list: (...args: unknown[]) => (mockCalls.listDrafts as (...a: unknown[]) => unknown)(...args) },
    settingsStore: {
      getSetting: async () => null,
      setSetting: async () => {},
    },
    createLoginDeps: () => ({}),
  };
});

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

function account(boxId: string, label: string): DataBoxAccount {
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
    lastSyncedAt: 1,
    messageCount: null,
    unreadCount: 2,
    pdzCreditCzk: null,
    syncError: null,
    createdAt: 0,
    updatedAt: 0,
    color: '#2A5C9A',
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

/** Lets timers and promises run out - the switcher re-reads the table once its sheet is in. */
async function settle(ms = 400) {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, ms));
  });
}

/** How many times everything past the accounts table has been asked for something. */
function loads() {
  return Object.fromEntries(
    Object.entries(mockCalls).map(([name, fn]) => [name, fn.mock.calls.length]),
  );
}

/** Opens the switcher and closes it again by tapping the box already shown. */
async function openAndCloseSwitcher(view: View, closeWith: string) {
  await press(view, 'boxSwitcher');
  await settle();
  await press(view, closeWith);
  await settle();
}

beforeEach(() => {
  mockWorld.accounts = [account('a', 'Alfa'), account('b', 'Beta')];
  mockWorld.tableReads = 0;
  Object.values(mockCalls).forEach(fn => fn.mockClear());
});

describe('re-reading an unchanged table', () => {
  it('loads nothing again in a box inbox', async () => {
    const view = await renderShell();
    await waitFor(() => expect(view.getByTestId('boxSwitcher')).toBeTruthy());
    await settle();
    const before = loads();
    const readsBefore = mockWorld.tableReads;

    for (let i = 0; i < 3; i++) {
      await openAndCloseSwitcher(view, 'switchBox-a');
    }

    // The table WAS read again - otherwise this proves nothing.
    expect(mockWorld.tableReads).toBeGreaterThanOrEqual(readsBefore + 3);
    expect(loads()).toEqual(before);
  });

  it('loads nothing again in the merged view', async () => {
    const view = await renderShell();
    await waitFor(() => expect(view.getByTestId('boxSwitcher')).toBeTruthy());
    await press(view, 'boxSwitcher');
    await press(view, 'switchUnified');
    await waitFor(() => expect(mockCalls.getMergedMessages).toHaveBeenCalled());
    await settle();
    const before = loads();
    const readsBefore = mockWorld.tableReads;

    for (let i = 0; i < 3; i++) {
      await openAndCloseSwitcher(view, 'switchUnified');
    }

    expect(mockWorld.tableReads).toBeGreaterThanOrEqual(readsBefore + 3);
    expect(loads()).toEqual(before);
  });

  it('still reloads when something on the table really changed', async () => {
    // The other half of the contract: equal is skipped, different is not. An unread count that moved
    // must reach the "Jinde" summary, which reads the other boxes' caches to say so.
    const view = await renderShell();
    await waitFor(() => expect(view.getByTestId('boxSwitcher')).toBeTruthy());
    await settle();
    const cacheReads = mockCalls.getCachedMessages.mock.calls.length;

    mockWorld.accounts = [account('a', 'Alfa'), { ...account('b', 'Beta'), unreadCount: 5 }];
    await openAndCloseSwitcher(view, 'switchBox-a');

    expect(mockCalls.getCachedMessages.mock.calls.length).toBeGreaterThan(cacheReads);
  });
});
