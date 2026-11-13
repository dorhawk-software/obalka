// The transfer screen's test harness: a fake controller, the screen mounted in its providers, the
// steps a person takes, and AppState driven by the test (moved out of transferScreen.test.tsx on
// 2026-11-12, when the file reached its size limit).

import type { ComponentProps } from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { TransferScreen } from '../../src/app/settings/TransferScreen';
import type { TransferController } from '../../src/features/transfer/state/transferController';
import { BACKUP_SCHEMA_VERSION, type BackupManifest } from '../../src/services/backup/schema';
import { FORMAT_VERSION } from '../../src/services/backup/envelope';

export const manifest = (over: Partial<BackupManifest> = {}): BackupManifest => ({
  formatVersion: FORMAT_VERSION,
  schemaVersion: BACKUP_SCHEMA_VERSION,
  appVersion: '1.4.0',
  createdAt: 1_757_000_000_000,
  tiers: { metadata: true, documents: false },
  sizeBytes: 2_400_000,
  archiveName: 'obalka-1.backup',
  ...over,
});

type Signal = { cancelled: boolean };
export type OnProgress = (p: unknown) => void;

export function fake(over: Partial<Record<string, unknown>> = {}) {
  const calls: string[] = [];
  /** The stop flag and the progress callback each run was handed, in the order the runs started. */
  const signals: Signal[] = [];
  const progress: OnProgress[] = [];
  const state = {
    calls,
    signals,
    progress,
    available: true,
    offerFails: null as Error | null,
    receiveFails: null as Error | null,
    /** A receive that stays in flight until the test settles it, as a real one does. */
    receiveHangs: false,
    /** A receive that reports no progress at all. */
    receiveQuiet: false,
    /** A save into the archive that stays in flight until the test settles it. */
    applyHangs: false,
    settleApply: null as null | { resolve: (v: unknown) => void },
    /** A save the screen did not start is already running when it opens. */
    applying: false,
    /** Settles `whenApplied` with how the save ended. */
    applied: null as null | ((outcome?: unknown) => void),
    /** How a save ended that no screen has said yet - what `takeOutcome` hands out, once. */
    unseen: null as unknown,
    /** How many times the screen took the outcome. */
    taken: 0,
    /** What the screen asked of the display, in order. */
    screenOn: [] as boolean[],
    applyOptions: [] as unknown[],
    settle: null as null | {
      resolve: (v: unknown) => void;
      reject: (e: Error) => void;
    },
    contents: null as null | { boxes: number; messages: number; documents: number | null },
    received: {
      manifest: manifest(),
      compatibility: { kind: 'current' as const },
      restorable: true,
      recoveryKey: 'FKPX-9WQ2-7TDM-4RJH-2CVB',
      archive: new Uint8Array(4),
      documents: 0,
      dir: '/work/in',
    },
    applyReport: {
      accountsAdded: 1,
      accountsKept: 0,
      messagesAdded: 3,
      messagesMerged: 0,
      draftsRestored: 0,
      remindersRestored: 0,
      settingsRestored: 0,
    } as Record<string, unknown>,
  };
  const controller = {
    available: () => state.available,
    async offer(m: BackupManifest, onProgress: OnProgress, signal: Signal) {
      calls.push(`offer:${m.archiveName}`);
      signals.push(signal);
      progress.push(onProgress);
      if (state.offerFails) {
        throw state.offerFails;
      }
      onProgress?.({ stage: 'connecting', sent: 0, total: 0, relayed: null });
      return {
        phrase: '7K2M-ryba-kotva-duha-lampa',
        sizeBytes: 2_400_100,
        contents: state.contents,
        done: new Promise<void>(() => {}),
      };
    },
    async receive(phrase: string, onProgress: OnProgress, signal: Signal) {
      calls.push(`receive:${phrase}`);
      signals.push(signal);
      progress.push(onProgress);
      if (state.receiveFails) {
        throw state.receiveFails;
      }
      if (!state.receiveQuiet) {
        onProgress?.({ stage: 'transferring', sent: 1, total: 2, relayed: true });
      }
      if (state.receiveHangs) {
        return new Promise((resolve, reject) => {
          state.settle = { resolve, reject };
        });
      }
      return state.received;
    },
    async abandon() {
      calls.push('abandon');
    },
    async apply(_received: unknown, _key: string, options: unknown) {
      calls.push('apply');
      state.applyOptions.push(options);
      if (state.applyHangs) {
        return new Promise(resolve => {
          state.settleApply = { resolve };
        });
      }
      return state.applyReport;
    },
    isApplying: () => state.applying,
    takeOutcome() {
      state.taken += 1;
      const outcome = state.unseen;
      state.unseen = null;
      return outcome;
    },
    subscribeOutcome: () => () => undefined,
    whenApplied: () =>
      new Promise<unknown>(resolve => {
        state.applied = resolve;
      }),
    keepScreenOn(on: boolean) {
      state.screenOn.push(on);
    },
    async dispose() {
      calls.push('dispose');
    },
    ...over,
  } as unknown as TransferController;
  return { controller, state };
}

export const mount = (
  controller: TransferController,
  newest: BackupManifest | null = manifest(),
  extra: Partial<ComponentProps<typeof TransferScreen>> = {},
) =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <AppThemeProvider isDark={false}>
        <TransferScreen onBack={() => {}} controller={controller} backups={newest ? [newest] : []} {...extra} />
      </AppThemeProvider>
    </TamaguiProvider>,
  );

/** Type the phrase and start receiving, the way a person does. */
export async function startReceiving(view: Awaited<ReturnType<typeof mount>>) {
  await act(async () => {
    fireEvent.changeText(view.getByTestId('transfer-phrase-input'), '7K2M-ryba-kotva-duha-lampa');
  });
  await act(async () => {
    fireEvent.press(view.getByTestId('transfer-receive'));
  });
}

/**
 * AppState driven by the test: the listeners the screen holds, and a way to move the app.
 *
 * The property is swapped and put back rather than spied on. The preset's `addEventListener` is
 * already a `jest.fn`, so `spyOn` hands back that same function and `mockRestore` strips its
 * implementation - leaving every later suite a subscription of `undefined`.
 */
export function drivenAppState() {
  const listeners = new Set<(next: string) => void>();
  const holder = AppState as unknown as { addEventListener: unknown };
  const original = holder.addEventListener;
  holder.addEventListener = (_type: string, listener: (next: string) => void) => {
    listeners.add(listener);
    return { remove: () => listeners.delete(listener) };
  };
  return {
    listeners,
    move: async (next: string) => {
      await act(async () => {
        for (const listener of [...listeners]) {
          listener(next);
        }
      });
    },
    restore: () => {
      holder.addEventListener = original;
    },
  };
}

/** Receive, then say yes to what arrived. */
export async function receiveAndConfirm(view: Awaited<ReturnType<typeof mount>>) {
  await startReceiving(view);
  await waitFor(() => expect(view.getByTestId('transfer-received-dialog')).toBeTruthy());
  await act(async () => {
    fireEvent.press(view.getByTestId('transfer-received-confirm'));
  });
}
