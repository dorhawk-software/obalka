// Shared harness for the backup-screen suites.
//
// Two files render this screen - the flows (`backupScreen.test.tsx`) and the run/progress UI
// (`backupProgress.test.tsx`) - because a single file accumulates enough renders that the later
// tests start failing to find their own tree. The fixtures live here so the split costs no duplication.

import { render, waitFor } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { SnackbarProvider } from '../../src/app/Snackbar';
import { BackupScreen } from '../../src/app/settings/BackupScreen';
import {
  BackupCancelledError,
  BackupLockUnavailableError,
  type BackupController,
  type BackupRun,
  type BackupStatus,
  type RestoreOutcome,
} from '../../src/features/backup/state/backupController';
import type { BackupManifest } from '../../src/services/backup/schema';
import type { RestorableBackup } from '../../src/services/backup/backupService';

const KEY = 'FKPX-9WQ2-7TDM-4RJH-2CVB';

const manifest = (
  createdAt: number,
  schemaVersion = 1,
  over: Partial<BackupManifest> = {},
): BackupManifest => ({
  formatVersion: 1,
  schemaVersion,
  appVersion: '1.4.0',
  createdAt,
  tiers: { metadata: true, documents: false },
  sizeBytes: 4096,
  archiveName: `obalka-${createdAt}.backup`,
  ...over,
});

/** A stand-in controller: records the calls, answers what the test set up. */
function fakeController(initial: Partial<BackupStatus> = {}) {
  const listeners = new Set<() => void>();
  const restoreListeners = new Set<() => void>();
  let run: BackupRun | null = null;
  const state = {
    status: {
      enabled: false,
      last: null,
      documentsPossible: false,
      documentsOn: false,
      ...initial,
    } as BackupStatus,
    backups: [] as RestorableBackup[],
    key: KEY as string | null,
    calls: [] as string[],
    denyPrompt: false,
    noScreenLock: false,
    restoreFailure: null as Error | null,
    /** The restore worked, and keeping the password it used did not. */
    restoreKeysFailed: false,
    /** The restore left a document behind, so the backup it came from is held. */
    restoreHeld: false,
    /** While set, a restore waits for it before it ends - a restore still running. */
    restoreGate: null as Promise<void> | null,
    /** How the restores no screen said ended, oldest first, until taken - as the real controller keeps them. */
    unseenRestores: [] as RestoreOutcome[],
    /** What switching backups on rejects with, when it is not the missing screen lock. */
    enableFailure: null as Error | null,
    /** Make the restore listing fail without touching the other reads. */
    listFailure: null as Error | null,
    exportCancelled: false,
    importCancelled: false,
    importFailure: null as Error | null,
    verifyFailure: null as Error | null,
    cancelled: false,
    prefs: { automatic: true, keep: 1, documents: false, documentMode: 'downloaded' as 'downloaded' | 'all' },
    /** What `documentEstimate` answers - measured on a real device, set by the test here. */
    estimate: { count: 0, plainBytes: 0, sealedBytes: 0, gone: 0 },
    /** What `missingEstimate` answers (026): messages the `all` mode would download, and those ISDS deleted. */
    missing: { askable: 0, gone: 0 },
    /** Push a run into the controller the way a real operation would, and let React see it. */
    setRun(next: BackupRun | null) {
      run = next;
      listeners.forEach(l => l());
    },
  };
  const controller = {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    currentRun: () => run,
    cancelRun: () => {
      state.calls.push('cancelRun');
      state.cancelled = true;
      return true;
    },
    async status() {
      return state.status;
    },
    async list() {
      if (state.listFailure) {
        throw state.listFailure;
      }
      return state.backups;
    },
    async preferences() {
      return state.prefs;
    },
    async documentEstimate() {
      state.calls.push('documentEstimate');
      return state.estimate;
    },
    async missingEstimate() {
      state.calls.push('missingEstimate');
      return state.missing;
    },
    async setPreferences(next: Partial<typeof state.prefs>) {
      state.calls.push(`setPreferences:${JSON.stringify(next)}`);
      state.prefs = { ...state.prefs, ...next };
    },
    async deleteBackup(archiveName: string) {
      state.calls.push(`deleteBackup:${archiveName}`);
      state.backups = state.backups.filter(
        b => b.manifest.archiveName !== archiveName,
      );
    },
    async enable() {
      state.calls.push('enable');
      if (state.noScreenLock) {
        throw new BackupLockUnavailableError();
      }
      if (state.enableFailure) {
        throw state.enableFailure;
      }
      state.status = { ...state.status, enabled: true, last: manifest(1_000) };
      return state.status.last as BackupManifest;
    },
    async backupNow() {
      state.calls.push('backupNow');
      state.status = { ...state.status, last: manifest(2_000) };
      return state.status.last as BackupManifest;
    },
    async revealKey() {
      state.calls.push('revealKey');
      if (state.denyPrompt) {
        throw new BackupCancelledError();
      }
      return state.key as string;
    },
    takeRestoreOutcome() {
      return state.unseenRestores.shift() ?? null;
    },
    subscribeRestoreOutcome: (listener: () => void) => {
      restoreListeners.add(listener);
      return () => restoreListeners.delete(listener);
    },
    async restore(...args: unknown[]) {
      state.calls.push('restore');
      const seen = args[4] as (() => boolean) | undefined;
      if (state.restoreGate) {
        await state.restoreGate;
      }
      // Kept only when the screen that started it is not there to say it, as the real controller does.
      const ended = (outcome: RestoreOutcome) => {
        if (seen?.()) {
          return;
        }
        state.unseenRestores.push(outcome);
        restoreListeners.forEach(l => l());
      };
      if (state.restoreFailure) {
        ended({ ok: false, error: state.restoreFailure });
        throw state.restoreFailure;
      }
      const restored = {
        accountsAdded: 1,
        accountsKept: 0,
        messagesAdded: 7,
        messagesMerged: 0,
        draftsRestored: 0,
        remindersRestored: 0,
        settingsRestored: 3,
        keysFailed: state.restoreKeysFailed,
        held: state.restoreHeld,
      };
      ended({ ok: true, restored });
      return restored;
    },
    async disable() {
      state.calls.push('disable');
      state.status = { ...state.status, enabled: false };
    },
    async exportBackup(m: BackupManifest) {
      state.calls.push(`exportBackup:${m.archiveName}`);
      if (state.exportCancelled) {
        return false;
      }
      return true;
    },
    async importBackup() {
      state.calls.push('importBackup');
      if (state.importFailure) {
        throw state.importFailure;
      }
      if (state.importCancelled) {
        return null;
      }
      const m = manifest(3_000);
      state.backups = [
        ...state.backups,
        { manifest: m, restorable: true, compatibility: { kind: 'current' } } as RestorableBackup,
      ];
      return m;
    },
    async verify(m: BackupManifest) {
      state.calls.push(`verify:${m.archiveName}`);
      if (state.verifyFailure) {
        throw state.verifyFailure;
      }
      return {
        createdAt: m.createdAt,
        accounts: 3,
        messages: 412,
        drafts: 0,
        reminders: 1,
      };
    },
  } as unknown as BackupController;
  return { controller, state };
}


export const wrap = (ui: React.ReactElement) =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <AppThemeProvider isDark={false}>
        <SnackbarProvider>{ui}</SnackbarProvider>
      </AppThemeProvider>
    </TamaguiProvider>,
  );

export const mount = async (
  fake: ReturnType<typeof fakeController>,
  onBack: () => void = () => {},
) => {
  const view = await wrap(
    <BackupScreen onBack={onBack} controller={fake.controller} onOpenFaq={() => {}} />,
  );
  await waitFor(() => expect(view.getByTestId('backup-toggle')).toBeTruthy());
  return view;
};

export { KEY, manifest, fakeController };
export type { RestorableBackup };
