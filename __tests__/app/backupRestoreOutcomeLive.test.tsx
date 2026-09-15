// A restore an earlier visit started, ending while the backup screen is open again (2026-09-15).
//
// A file of its own, for the reason `backupScreenHarness.tsx` gives. Left with "Nechat běžet" and opened
// again before the restore ends, the screen says how it ended the moment it does. It also reads the
// list again then: the run has already ended by the time the backup it came from is held or let go, so
// the read the end of the run starts can come too early to show it.

import { useState } from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { fakeController, KEY, manifest, mount, wrap } from '../helpers/backupScreenHarness';
import { BackupScreen, restoredText } from '../../src/app/settings/BackupScreen';
import { t } from '../../src/i18n/strings';

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

/** A fake with one restorable backup, whose restores do not end until they are released. */
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

describe('a restore that ends while the backup screen is open again', () => {
  it('is said at once, and the list shows the backup it came from as held', async () => {
    const fake = fakeController();
    const backup = { manifest: manifest(3_000), compatibility: { kind: 'current' as const }, restorable: true };
    fake.state.backups = [backup];
    let release = () => {};
    fake.state.restoreGate = new Promise<void>(resolve => {
      release = resolve;
    });

    const left = await mount(fake);
    await act(async () => {
      fireEvent(left.getByTestId('backup-item-0'), 'press');
    });
    await act(async () => {
      fireEvent.changeText(left.getByTestId('backup-key-input'), KEY);
    });
    await act(async () => {
      fireEvent(left.getByTestId('backup-restore-start'), 'press');
    });
    await act(async () => {
      left.unmount();
    });

    const again = await mount(fake);
    expect(again.queryByTestId('backup-restore-outcome')).toBeNull();
    expect(again.queryByTestId('backup-held-0')).toBeNull();

    // A document did not come back, so the backup it came from is held from now on.
    const held = { ...backup, held: true };
    fake.state.backups = [held];
    fake.state.restoreHeld = true;
    await act(async () => {
      release();
    });

    await waitFor(() => expect(again.getByTestId('backup-restore-outcome')).toBeTruthy());
    expect(
      again.getByText(
        restoredText({
          accountsAdded: 1,
          accountsKept: 0,
          messagesAdded: 7,
          messagesMerged: 0,
          draftsRestored: 0,
          remindersRestored: 0,
          settingsRestored: 3,
          keysFailed: false,
          held: true,
        }),
      ),
    ).toBeTruthy();
    await waitFor(() =>
      expect(again.getByTestId('backup-held-0')).toHaveTextContent(t('backup.restore.held')),
    );
    expect(fake.state.unseenRestores).toEqual([]);
  });

  it('is said even while a restore this visit started is still going (review)', async () => {
    // The screen skipped every outcome while a restore of its own was going, and the one outcome the
    // controller kept was then replaced by that restore's. Opened again during a restore and started
    // again, the screen said the second restore and nobody ever said how the first one ended.
    const { fake, release } = restoring();
    const first = await mount(fake);
    await startRestore(first);
    await act(async () => {
      first.unmount();
    });
    const second = await mount(fake);
    await startRestore(second);
    expect(fake.state.calls.filter(call => call === 'restore')).toHaveLength(2);

    await act(async () => {
      release();
    });

    // The first in the dialog, the second where the screen that started it says it.
    await waitFor(() => expect(second.getByTestId('backup-restore-outcome')).toBeTruthy());
    await waitFor(() => expect(second.getByTestId('backup-restored')).toHaveTextContent(/7 zpráv/));
    expect(fake.state.unseenRestores).toEqual([]);
  });

  it('is kept for the next visit when it ends as the screen that started it goes back (review)', async () => {
    // Going back takes the screen out of view at once and unmounts it once the transition is over. A
    // restore that ended in that moment was said on the screen on its way out, which nobody could see.
    const { fake, release } = restoring();
    let outOfView = () => {};
    function Leaving() {
      const [inView, setInView] = useState(true);
      outOfView = () => setInView(false);
      return (
        <BackupScreen onBack={() => {}} controller={fake.controller} onOpenFaq={() => {}} inView={inView} />
      );
    }
    const leaving = await wrap(<Leaving />);
    await waitFor(() => expect(leaving.getByTestId('backup-toggle')).toBeTruthy());
    await startRestore(leaving);
    await act(async () => {
      outOfView();
    });

    await act(async () => {
      release();
    });
    expect(leaving.queryByTestId('backup-restored')).toBeNull();
    expect(fake.state.unseenRestores).toHaveLength(1);
    await act(async () => {
      leaving.unmount();
    });

    const again = await mount(fake);
    await waitFor(() => expect(again.getByTestId('backup-restore-outcome')).toBeTruthy());
    expect(again.getByText(/7 zpráv/)).toBeTruthy();
    expect(fake.state.unseenRestores).toEqual([]);
  });

  it('closes the backup it restored when it ends under another screen, and says it once back (review)', async () => {
    // The FAQ or the transfer, opened over the backup screen while the restore ran. The outcome was kept
    // for the dialog, and beneath the dialog the backup stayed open with its password still typed in.
    const { fake, release } = restoring();
    let cover = () => {};
    let uncover = () => {};
    function Covered() {
      const [inView, setInView] = useState(true);
      cover = () => setInView(false);
      uncover = () => setInView(true);
      return (
        <BackupScreen onBack={() => {}} controller={fake.controller} onOpenFaq={() => {}} inView={inView} />
      );
    }
    const view = await wrap(<Covered />);
    await waitFor(() => expect(view.getByTestId('backup-toggle')).toBeTruthy());
    await startRestore(view);
    await act(async () => {
      cover();
    });
    await act(async () => {
      release();
    });
    expect(fake.state.unseenRestores).toHaveLength(1);

    await act(async () => {
      uncover();
    });
    await waitFor(() => expect(view.getByTestId('backup-restore-outcome')).toBeTruthy());
    expect(view.queryByTestId('backup-key-input')).toBeNull();
    expect(view.queryByTestId('backup-restored')).toBeNull();
  });
});
