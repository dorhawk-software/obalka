// How a restore from the backup screen ended, when the screen that started it had been left (2026-09-15).
//
// A file of its own, for the reason `backupScreenHarness.tsx` gives. Leaving during a restore with
// "Nechat běžet" unmounted the screen, and nothing said how the restore ended, whether it worked or
// failed. The controller keeps it now, the way it keeps a transfer's save (025), and the screen says it
// in a dialog the next time it is in view.

import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { fakeController, KEY, manifest, mount, wrap } from '../helpers/backupScreenHarness';
import { BackupScreen, restoredText } from '../../src/app/settings/BackupScreen';
import { doneText } from '../../src/app/settings/TransferScreen';
import type {
  AppliedTransfer,
  ApplyOutcome,
} from '../../src/features/transfer/state/transferController';
import { t } from '../../src/i18n/strings';

/** A fake with one restorable backup, whose restore does not end until it is released. */
function restoring() {
  const fake = fakeController();
  fake.state.backups = [
    { manifest: manifest(3_000), compatibility: { kind: 'current' }, restorable: true },
  ];
  let release = () => {};
  fake.state.restoreGate = new Promise<void>(resolve => {
    release = resolve;
  });
  return { fake, release: () => release() };
}

/** Open the backup, type the key and press "Obnovit", as a person would. */
async function startRestore(view: Awaited<ReturnType<typeof mount>>) {
  await act(async () => {
    fireEvent(view.getByTestId('backup-item-0'), 'press');
  });
  await act(async () => {
    fireEvent.changeText(view.getByTestId('backup-key-input'), KEY);
  });
  await act(async () => {
    fireEvent(view.getByTestId('backup-restore-start'), 'press');
  });
}

describe('how a restore ended, when the screen that started it was left', () => {
  it('is said in a dialog the next time the screen opens', async () => {
    const { fake, release } = restoring();
    const left = await mount(fake);
    await startRestore(left);
    expect(fake.state.calls).toContain('restore');
    await act(async () => {
      left.unmount();
    });

    await act(async () => {
      release();
    });
    // Kept rather than said: no screen was open to say it.
    const [outcome] = fake.state.unseenRestores;
    if (!outcome?.ok) {
      throw new Error('the restore should have ended well');
    }

    const again = await mount(fake);
    await waitFor(() => expect(again.getByTestId('backup-restore-outcome')).toBeTruthy());
    expect(again.getByText(t('backup.restore.outcome.title'))).toBeTruthy();
    expect(again.getByText(restoredText(outcome.restored))).toBeTruthy();
    // Taken, so no later visit says it a second time.
    expect(fake.state.unseenRestores).toEqual([]);
  });

  it('says a failure as a failure', async () => {
    const { fake, release } = restoring();
    fake.state.restoreFailure = new Error('no space left on device');
    const left = await mount(fake);
    await startRestore(left);
    await act(async () => {
      left.unmount();
    });
    await act(async () => {
      release();
    });

    const again = await mount(fake);
    await waitFor(() => expect(again.getByTestId('backup-restore-outcome')).toBeTruthy());
    expect(again.getByText(t('backup.restore.error'))).toBeTruthy();
    expect(fake.state.unseenRestores).toEqual([]);
  });

  it('is said on the screen that started it while that screen is open, and kept for nobody else', async () => {
    const { fake, release } = restoring();
    const view = await mount(fake);
    await startRestore(view);
    await act(async () => {
      release();
    });

    await waitFor(() => expect(view.getByTestId('backup-restored')).toHaveTextContent(/7 zpráv/));
    expect(view.queryByTestId('backup-restore-outcome')).toBeNull();
    expect(fake.state.unseenRestores).toEqual([]);
  });

  it('waits for a transfer s outcome that is already waiting, one dialog at a time', async () => {
    // iOS presents one modal at a time, so a second dialog asked for while one is up never appears.
    const fake = fakeController();
    fake.state.unseenRestores = [{ ok: false, error: new Error('no space left on device') }];
    let unseenTransfer: ApplyOutcome | null = {
      ok: true,
      applied: {
        accountsAdded: 1,
        accountsKept: 0,
        messagesAdded: 3,
        messagesMerged: 0,
        draftsRestored: 0,
        remindersRestored: 0,
        settingsRestored: 0,
        keysFailed: false,
      } as AppliedTransfer,
    };
    const shown = unseenTransfer;
    const view = await wrap(
      <BackupScreen
        onBack={() => {}}
        controller={fake.controller}
        onOpenFaq={() => {}}
        transferOutcomes={{
          takeOutcome: () => {
            const outcome = unseenTransfer;
            unseenTransfer = null;
            return outcome;
          },
          subscribeOutcome: () => () => undefined,
        }}
      />,
    );

    await waitFor(() => expect(view.getByTestId('backup-transfer-outcome')).toBeTruthy());
    expect(view.getByText(doneText(shown.applied))).toBeTruthy();
    expect(view.queryByTestId('backup-restore-outcome')).toBeNull();

    await act(async () => {
      fireEvent(view.getByTestId('backup-transfer-outcome'), 'requestClose');
    });
    await waitFor(() => expect(view.getByTestId('backup-restore-outcome')).toBeTruthy());
    expect(view.queryByTestId('backup-transfer-outcome')).toBeNull();
    expect(view.getByText(t('backup.restore.error'))).toBeTruthy();
  });
});
