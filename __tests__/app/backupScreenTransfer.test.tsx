// The backup screen and a phone-to-phone transfer's save (025 review, 2026-09-15).
//
// A file of its own, for the reason `backupScreenHarness.tsx` gives: a file that renders this screen
// many times starts failing to find its own tree in the later tests.
//
// Two things changed on this screen. A transfer's save now runs as one of the backup controller's runs,
// so it shows here as a restore - one that cannot be stopped part-way, so leaving does not ask. And a
// save that ends while no transfer screen is open to say how is said here, in a dialog.

import { useState } from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { fakeController, manifest, wrap } from '../helpers/backupScreenHarness';
import { BackupScreen } from '../../src/app/settings/BackupScreen';
import { doneText } from '../../src/app/settings/TransferScreen';
import type {
  AppliedTransfer,
  ApplyOutcome,
} from '../../src/features/transfer/state/transferController';
import { t } from '../../src/i18n/strings';

describe('leaving during a transfer s save', () => {
  it('just leaves, instead of offering a stop that does nothing', async () => {
    // "Carry on, or stop?" offered a stop to a save that cannot stop part-way (025 FR-012).
    const onBack = jest.fn();
    const fake = fakeController({ enabled: true, last: manifest(1_000) });
    const view = await wrap(
      <BackupScreen onBack={onBack} controller={fake.controller} onOpenFaq={() => {}} />,
    );
    await waitFor(() => expect(view.getByTestId('backup-toggle')).toBeTruthy());

    await act(async () => {
      fake.state.setRun({
        kind: 'restore',
        progress: { stage: 'restoring', done: 1, total: 2, fraction: 0.5 },
        cancellable: false,
      });
    });
    await act(async () => {
      fireEvent(view.getByTestId('back'), 'press');
    });

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(view.queryByTestId('backup-leave-dialog')).toBeNull();
    expect(fake.state.calls).not.toContain('cancelRun');
  });
});

describe('how a transfer s save ended, when no transfer screen was open to say it', () => {
  // Leaving the transfer screen during its save lands here, and the save's end was said nowhere.

  /** A stand-in for the transfer controller's outcome: kept until taken, and heard when a save ends. */
  function outcomes(initial: ApplyOutcome | null = null) {
    const listeners = new Set<() => void>();
    let unseen = initial;
    return {
      takeOutcome: () => {
        const outcome = unseen;
        unseen = null;
        return outcome;
      },
      subscribeOutcome: (listener: () => void) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      end(outcome: ApplyOutcome) {
        unseen = outcome;
        listeners.forEach(l => l());
      },
      unseen: () => unseen,
    };
  }

  const applied = {
    accountsAdded: 1,
    accountsKept: 0,
    messagesAdded: 3,
    messagesMerged: 0,
    draftsRestored: 0,
    remindersRestored: 0,
    settingsRestored: 0,
    keysFailed: true,
  } as AppliedTransfer;

  it('says it in a dialog once this screen is back in view, not while it is covered, and only once', async () => {
    const fake = fakeController();
    const source = outcomes({ ok: true, applied });
    let showScreen: (inView: boolean) => void = () => {};
    function Covered() {
      const [inView, setInView] = useState(false);
      showScreen = setInView;
      return (
        <BackupScreen
          onBack={() => {}}
          controller={fake.controller}
          onOpenFaq={() => {}}
          transferOutcomes={source}
          inView={inView}
        />
      );
    }
    const view = await wrap(<Covered />);
    await waitFor(() => expect(view.getByTestId('backup-toggle')).toBeTruthy());
    // Covered by a transfer screen, which says it itself.
    expect(view.queryByTestId('backup-transfer-outcome')).toBeNull();
    expect(source.unseen()).not.toBeNull();

    await act(async () => {
      showScreen(true);
    });
    await waitFor(() => expect(view.getByTestId('backup-transfer-outcome')).toBeTruthy());
    expect(view.getByText(t('transfer.outcome.title'))).toBeTruthy();
    expect(view.getByText(doneText(applied))).toBeTruthy();
    expect(source.unseen()).toBeNull();
  });

  it('says it at once when the save ends while this screen is in view, and a failure as a failure', async () => {
    const fake = fakeController();
    const source = outcomes();
    const view = await wrap(
      <BackupScreen
        onBack={() => {}}
        controller={fake.controller}
        onOpenFaq={() => {}}
        transferOutcomes={source}
      />,
    );
    await waitFor(() => expect(view.getByTestId('backup-toggle')).toBeTruthy());
    expect(view.queryByTestId('backup-transfer-outcome')).toBeNull();

    await act(async () => {
      source.end({ ok: false, error: new Error('the disk is full') });
    });
    await waitFor(() => expect(view.getByTestId('backup-transfer-outcome')).toBeTruthy());
    expect(view.getByText(t('transfer.error.failed'))).toBeTruthy();
  });

  it('waits for a dialog that is already open, and says it once that one has closed (2026-09-15)', async () => {
    // It is the one dialog on this screen not opened by a tap, so it can arrive while another is up -
    // and iOS presents one modal at a time, so a second one asked for then never appeared.
    const fake = fakeController({ enabled: true, last: manifest(1_000) });
    const source = outcomes();
    const view = await wrap(
      <BackupScreen
        onBack={() => {}}
        controller={fake.controller}
        onOpenFaq={() => {}}
        transferOutcomes={source}
      />,
    );
    await waitFor(() => expect(view.getByTestId('backup-toggle')).toBeTruthy());
    await act(async () => {
      fireEvent(view.getByTestId('backup-toggle'), 'press');
    });
    await waitFor(() => expect(view.getByTestId('backup-disable-dialog')).toBeTruthy());

    await act(async () => {
      source.end({ ok: true, applied });
    });
    expect(view.queryByTestId('backup-transfer-outcome')).toBeNull();
    // Taken all the same: it is this screen's to say, and no other screen says it as well.
    expect(source.unseen()).toBeNull();

    // Android's back, or a tap on the scrim - the dialog's own way of closing.
    await act(async () => {
      fireEvent(view.getByTestId('backup-disable-dialog'), 'requestClose');
    });
    await waitFor(() => expect(view.getByTestId('backup-transfer-outcome')).toBeTruthy());
    expect(view.queryByTestId('backup-disable-dialog')).toBeNull();
    expect(view.getByText(doneText(applied))).toBeTruthy();
  });
});
