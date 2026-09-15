// Shared harness for the first-run restore suites (2026-09-24): the real shell on a phone with no
// boxes, with the accounts table, the backup controller's run and the transfer's availability in the
// test's hands.
//
// ONE shell per file. A second `AppShell` rendered in the same file stops answering presses - the
// first one's taps land, the second's do nothing, whether or not the first was unmounted - so each
// suite walks one scenario on one render, and the scenarios are split across files. (The backup
// screen's suites are split for what looks like the same reason; see `backupScreenHarness.tsx`.)
//
// The inbox is recognised by the diagnostics question the shell asks the first time boxes exist:
// nothing else draws it, and it is drawn only on the home route with a box on it.

import { enableScreens } from 'react-native-screens';
enableScreens(false);

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { AppShell } from '../../src/app/AppShell';
import {
  accountsController,
  backupController,
  transferController,
} from '../../src/features/accounts/deps';
import type { BackupRun } from '../../src/features/backup/state/backupController';
import type { DataBoxAccount } from '../../src/services/isds/types';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

export const restoredBox = {
  id: 'acc_abc1234',
  boxId: 'abc1234',
  loginName: 'restored',
  label: 'Jana Nováková',
  dbType: 'FO',
  alias: null,
  authMethod: 'password',
  host: 'production',
  secretRef: '',
  sessionValidUntil: null,
  passwordExpiresAt: null,
  lastSyncedAt: null,
  messageCount: null,
  unreadCount: null,
  pdzCreditCzk: null,
  syncError: null,
  createdAt: 1_757_000_000_000,
  updatedAt: 1_757_000_000_000,
} as DataBoxAccount;

export const RESTORING: BackupRun = {
  kind: 'restore',
  progress: { stage: 'restoring', done: 1, total: 2, fraction: 0.5 },
};

/** The world behind the shell: the accounts table, the backup controller's run, and the transfer. */
export function world({ canTransfer = false } = {}) {
  let accounts: DataBoxAccount[] = [];
  const listAccounts = jest
    .spyOn(accountsController, 'listAccounts')
    .mockImplementation(async () => accounts);
  let run: BackupRun | null = null;
  const listeners = new Set<() => void>();
  jest.spyOn(backupController, 'subscribe').mockImplementation(listener => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  });
  jest.spyOn(backupController, 'currentRun').mockImplementation(() => run);
  jest.spyOn(backupController, 'status').mockResolvedValue({
    enabled: false,
    last: null,
    documentsPossible: false,
    documentsOn: false,
    documentMode: 'downloaded',
  });
  jest.spyOn(backupController, 'list').mockResolvedValue([]);
  jest.spyOn(transferController, 'available').mockReturnValue(canTransfer);
  return {
    listAccounts,
    /** What the table holds from now on. */
    setAccounts(next: DataBoxAccount[]) {
      accounts = next;
    },
    /** Start or end a run, the way the real controller reports it. */
    async setRun(next: BackupRun | null) {
      await act(async () => {
        run = next;
        listeners.forEach(l => l());
      });
    },
  };
}

export function renderShell() {
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

export type ShellView = Awaited<ReturnType<typeof renderShell>>;

/** Press, and let what it starts settle. */
export async function press(view: ShellView, testID: string) {
  await act(async () => {
    fireEvent.press(view.getByTestId(testID));
  });
}

/** From Welcome to the restore screen, the way a person gets there. */
export async function openRestore(view: ShellView) {
  await waitFor(() => expect(view.getByTestId('welcome')).toBeTruthy());
  await press(view, 'welcome-restore');
  await waitFor(() => expect(view.getByTestId('backup-import')).toBeTruthy());
}
