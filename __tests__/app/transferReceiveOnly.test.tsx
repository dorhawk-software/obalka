// The transfer screen opened from Welcome, on a phone with no boxes (2026-09-24).
//
// That phone can only be the one the archive comes TO. The send half would only say there is no
// backup to send, so it is left out, and the screen is named from the receiving side. Once what
// arrived is saved, the shell offers the way on, and the screen draws it under what was restored -
// never while a transfer is still going, which is this screen's to finish or to stop.

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { TransferScreen } from '../../src/app/settings/TransferScreen';
import type { TransferController } from '../../src/features/transfer/state/transferController';
import { BACKUP_SCHEMA_VERSION, type BackupManifest } from '../../src/services/backup/schema';
import { FORMAT_VERSION } from '../../src/services/backup/envelope';
import { STRINGS_FOR_TEST } from '../../src/i18n/strings';

const { cs } = STRINGS_FOR_TEST;

const manifest = (): BackupManifest => ({
  formatVersion: FORMAT_VERSION,
  schemaVersion: BACKUP_SCHEMA_VERSION,
  appVersion: '1.4.0',
  createdAt: 1_757_000_000_000,
  tiers: { metadata: true, documents: false },
  sizeBytes: 2_400_000,
  archiveName: 'obalka-1.backup',
});

/** A controller that receives one transfer and saves it, or keeps receiving until told otherwise. */
function fake() {
  const calls: string[] = [];
  const state = { receiveHangs: false };
  const received = {
    manifest: manifest(),
    compatibility: { kind: 'current' as const },
    restorable: true,
    recoveryKey: 'FKPX-9WQ2-7TDM-4RJH-2CVB',
    archive: new Uint8Array(4),
    documents: 0,
    dir: '/work/in',
  };
  const controller = {
    available: () => true,
    async receive(phrase: string) {
      calls.push(`receive:${phrase}`);
      if (state.receiveHangs) {
        return new Promise(() => {});
      }
      return received;
    },
    async apply() {
      calls.push('apply');
      return {
        accountsAdded: 1,
        accountsKept: 0,
        messagesAdded: 3,
        messagesMerged: 0,
        draftsRestored: 0,
        remindersRestored: 0,
        settingsRestored: 0,
        keysFailed: false,
      };
    },
    async abandon() {
      calls.push('abandon');
    },
    async dispose() {
      calls.push('dispose');
    },
    isApplying: () => false,
    takeOutcome: () => null,
    subscribeOutcome: () => () => undefined,
    whenApplied: async () => null,
    keepScreenOn: () => {},
  } as unknown as TransferController;
  return { controller, calls, state };
}

const mount = (
  controller: TransferController,
  props: { receiveOnly?: boolean; onContinue?: () => void } = {},
) =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <AppThemeProvider isDark={false}>
        <TransferScreen onBack={() => {}} controller={controller} backups={[]} {...props} />
      </AppThemeProvider>
    </TamaguiProvider>,
  );

async function receive(view: Awaited<ReturnType<typeof mount>>) {
  await act(async () => {
    fireEvent.changeText(view.getByTestId('transfer-phrase-input'), '7K2M-ryba-kotva-duha-lampa');
  });
  await act(async () => {
    fireEvent.press(view.getByTestId('transfer-receive'));
  });
}

describe('receiving only', () => {
  it('leaves out the send half, and is named from the receiving side', async () => {
    const { controller } = fake();
    const view = await mount(controller, { receiveOnly: true });

    expect(view.queryByTestId('transfer-send')).toBeNull();
    expect(view.getByTestId('transfer-receive')).toBeTruthy();
    expect(view.getByText(cs['transfer.receiveFrom'])).toBeTruthy();
  });

  it('is only on the first run: from Settings the phone can still send', async () => {
    const { controller } = fake();
    const view = await mount(controller);
    // The send half is drawn - with no backup on this phone, as its offer to make one (026 US3).
    expect(view.getByTestId('transfer-no-backup')).toBeTruthy();
    expect(view.queryByText(cs['transfer.receiveFrom'])).toBeNull();
  });

  it('receives and saves the way it always has', async () => {
    const { controller, calls } = fake();
    const view = await mount(controller, { receiveOnly: true });
    await receive(view);
    await waitFor(() => expect(view.getByTestId('transfer-received-confirm')).toBeTruthy());
    await act(async () => {
      fireEvent.press(view.getByTestId('transfer-received-confirm'));
    });
    await waitFor(() => expect(view.getByTestId('transfer-done')).toBeTruthy());
    expect(calls).toEqual(['receive:7K2M-ryba-kotva-duha-lampa', 'apply']);
  });
});

describe('the way on', () => {
  it('is drawn when the shell passes it, and goes there', async () => {
    const { controller } = fake();
    const onContinue = jest.fn();
    const view = await mount(controller, { receiveOnly: true, onContinue });

    fireEvent.press(view.getByTestId('transfer-continue'));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('is not drawn while a transfer is going', async () => {
    const { controller, state } = fake();
    state.receiveHangs = true;
    const view = await mount(controller, { receiveOnly: true, onContinue: () => {} });
    await receive(view);

    await waitFor(() => expect(view.getByTestId('transfer-cancel')).toBeTruthy());
    expect(view.queryByTestId('transfer-continue')).toBeNull();
  });

  it('is not drawn without the shell: nowhere to go yet', async () => {
    const { controller } = fake();
    const view = await mount(controller, { receiveOnly: true });
    expect(view.queryByTestId('transfer-continue')).toBeNull();
  });
});
