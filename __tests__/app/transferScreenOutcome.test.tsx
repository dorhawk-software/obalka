// How a save ended, on the transfer screen, when it ended with no transfer screen open (025 review,
// 2026-09-15).
//
// A file of its own because `transferScreen.test.tsx` already renders the screen as many times as one
// file can: further renders there left the later tests unable to find their own tree - the limit
// `backupScreenHarness.tsx` describes for the backup screen.
//
// The controller keeps the outcome of a save until a screen takes it. The screen that saw the save end
// takes it; one that was closed during the save leaves it, for the backup screen underneath or for
// this screen opened again.

import { useState } from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { TransferScreen } from '../../src/app/settings/TransferScreen';
import type { TransferController } from '../../src/features/transfer/state/transferController';
import { TransferFailedError } from '../../src/services/transfer/transport';
import { BACKUP_SCHEMA_VERSION, type BackupManifest } from '../../src/services/backup/schema';
import { FORMAT_VERSION } from '../../src/services/backup/envelope';
import { t } from '../../src/i18n/strings';

const manifest = (): BackupManifest => ({
  formatVersion: FORMAT_VERSION,
  schemaVersion: BACKUP_SCHEMA_VERSION,
  appVersion: '1.4.0',
  createdAt: 1_757_000_000_000,
  tiers: { metadata: true, documents: false },
  sizeBytes: 2_400_000,
  archiveName: 'obalka-1.backup',
});

/** Only what these tests reach: a receive that arrives at once, and a save the test can hold. */
function fake() {
  const state = {
    /** How a save ended that no screen has said yet - what `takeOutcome` hands out, once. */
    unseen: null as unknown,
    /** How many times the screen took the outcome. */
    taken: 0,
    applyHangs: false,
    settleApply: null as null | { resolve: (v: unknown) => void },
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
    available: () => true,
    async receive(_phrase: string, onProgress?: (p: unknown) => void) {
      onProgress?.({ stage: 'transferring', sent: 1, total: 2, relayed: true });
      return {
        manifest: manifest(),
        compatibility: { kind: 'current' as const },
        restorable: true,
        recoveryKey: 'FKPX-9WQ2-7TDM-4RJH-2CVB',
        archive: new Uint8Array(4),
        documents: 0,
        dir: '/work/in/1',
      };
    },
    async apply() {
      if (state.applyHangs) {
        return new Promise(resolve => {
          state.settleApply = { resolve };
        });
      }
      return state.applyReport;
    },
    isApplying: () => false,
    whenApplied: async () => null,
    takeOutcome() {
      state.taken += 1;
      const outcome = state.unseen;
      state.unseen = null;
      return outcome;
    },
    subscribeOutcome: () => () => undefined,
    keepScreenOn: () => undefined,
    async dispose() {},
    async abandon() {},
  } as unknown as TransferController;
  return { controller, state };
}

const mount = (controller: TransferController) =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <AppThemeProvider isDark={false}>
        <TransferScreen onBack={() => {}} controller={controller} backups={[manifest()]} />
      </AppThemeProvider>
    </TamaguiProvider>,
  );

/** Type the phrase, receive, and say yes to saving what arrived - the way a person does. */
async function receiveAndConfirm(view: Awaited<ReturnType<typeof mount>>) {
  await act(async () => {
    fireEvent.changeText(view.getByTestId('transfer-phrase-input'), '7K2M-ryba-kotva-duha-lampa');
  });
  await act(async () => {
    fireEvent.press(view.getByTestId('transfer-receive'));
  });
  await waitFor(() => expect(view.getByTestId('transfer-received-dialog')).toBeTruthy());
  await act(async () => {
    fireEvent.press(view.getByTestId('transfer-received-confirm'));
  });
}

describe('a save that ended while no transfer screen was open', () => {
  it('is said when the screen is opened again, a success and a failure each in its own words', async () => {
    // It was said nowhere: the screen that started the save had been left, and a screen opened after
    // the save had ended found nothing running and went straight to the buttons.
    const { controller, state } = fake();
    state.unseen = { ok: true, applied: { ...state.applyReport, keysFailed: true } };
    const view = await mount(controller);
    await waitFor(() => expect(view.getByTestId('transfer-done')).toBeTruthy());
    expect(view.getByTestId('transfer-done').props.children).toContain(
      t('transfer.done.keyNotSaved'),
    );
    expect(state.unseen).toBeNull();
    expect(view.getByTestId('transfer-receive')).toBeTruthy();

    const failing = fake();
    failing.state.unseen = { ok: false, error: new TransferFailedError('the disk is full') };
    const again = await mount(failing.controller);
    await waitFor(() =>
      expect(again.getByTestId('transfer-error').props.children).toBe(t('transfer.error.failed')),
    );
  });

  it('is taken by the screen that saw the save end, and left by one closed during it', async () => {
    // Taking it is what keeps the backup screen from saying it a second time; leaving it is what lets
    // the backup screen say it at all.
    const { controller, state } = fake();
    state.applyHangs = true;
    const view = await mount(controller);
    await receiveAndConfirm(view);
    const beforeEnd = state.taken;
    await act(async () => {
      state.settleApply?.resolve(state.applyReport);
    });
    expect(state.taken).toBe(beforeEnd + 1);
    expect(view.getByTestId('transfer-done')).toBeTruthy();

    const left = fake();
    left.state.applyHangs = true;
    const closing = await mount(left.controller);
    await receiveAndConfirm(closing);
    const beforeLeaving = left.state.taken;
    await act(async () => {
      closing.unmount();
    });
    await act(async () => {
      left.state.settleApply?.resolve(left.state.applyReport);
    });
    expect(left.state.taken).toBe(beforeLeaving);
  });

  it('is left for the screen underneath by one already out of view, though still mounted (2026-09-15)', async () => {
    // Going back takes the screen out of view at once, but it stays mounted until the transition out
    // has finished. A save that ended in that moment was taken here, and said on a screen nobody could
    // see any more instead of on the backup screen now in view.
    const { controller, state } = fake();
    state.applyHangs = true;
    let show: (inView: boolean) => void = () => {};
    function Leaving() {
      const [inView, setInView] = useState(true);
      show = setInView;
      return (
        <TransferScreen
          onBack={() => {}}
          controller={controller}
          backups={[manifest()]}
          inView={inView}
        />
      );
    }
    const view = await render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <AppThemeProvider isDark={false}>
          <Leaving />
        </AppThemeProvider>
      </TamaguiProvider>,
    );
    await receiveAndConfirm(view);
    const beforeEnd = state.taken;

    await act(async () => {
      show(false);
    });
    await act(async () => {
      state.settleApply?.resolve(state.applyReport);
    });
    expect(state.taken).toBe(beforeEnd);
    expect(view.queryByTestId('transfer-done')).toBeNull();
  });
});
