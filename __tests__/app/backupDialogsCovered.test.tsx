// The backup screen's other dialogs, and the lock screen (2026-09-24).
//
// A file of its own, for the reason `backupScreenHarness.tsx` gives. Every dialog here is a Modal, and a
// Modal draws in a window above the cover the lock gate lays over the app. A restore's outcome learnt
// to wait for the unlock on 2026-09-15; a transfer's outcome did not, and the questions a tap opens -
// leaving mid-run, deleting a backup, lowering the limit - stayed above the lock screen when the app
// left with one open. The outcome now waits, and the questions close as the app leaves.

import { AppState } from 'react-native';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { fakeController, manifest, mount, wrap } from '../helpers/backupScreenHarness';
import { BackupScreen } from '../../src/app/settings/BackupScreen';
import type { ApplyOutcome } from '../../src/features/transfer/state/transferController';
import { BackupLockUnavailableError } from '../../src/features/backup/state/backupController';

beforeEach(() => {
  setAppState('active');
  (AppState.addEventListener as jest.Mock).mockClear();
});

afterEach(() => {
  setAppState('active');
});

function setAppState(state: 'active' | 'background') {
  (AppState as unknown as { currentState: string }).currentState = state;
}

/** Deliver an AppState change to every listener - the jest mock calls none. */
function emitAppState(state: 'active' | 'background') {
  setAppState(state);
  for (const [type, handler] of (AppState.addEventListener as jest.Mock).mock.calls) {
    if (type === 'change') {
      handler(state);
    }
  }
}

/** A transfer's save that ended with no transfer screen open to say it. */
function waitingTransfer(outcome: ApplyOutcome) {
  let unseen: ApplyOutcome | null = outcome;
  return {
    takeOutcome: () => {
      const taken = unseen;
      unseen = null;
      return taken;
    },
    subscribeOutcome: () => () => {},
  };
}

describe('how a transfer s save ended, while the app is covered', () => {
  it('is not said while the app is in the background, and is said once it is back', async () => {
    setAppState('background');
    const fake = fakeController({ enabled: true, last: manifest(1_000) });
    const view = await wrap(
      <BackupScreen
        onBack={() => {}}
        controller={fake.controller}
        onOpenFaq={() => {}}
        transferOutcomes={waitingTransfer({ ok: false, error: new Error('no space left') })}
      />,
    );
    await waitFor(() => expect(view.getByTestId('backup-toggle')).toBeTruthy());
    expect(view.queryByTestId('backup-transfer-outcome')).toBeNull();

    await act(async () => {
      emitAppState('active');
    });

    await waitFor(() => expect(view.getByTestId('backup-transfer-outcome')).toBeTruthy());
  });
});

describe('a question left open as the app leaves', () => {
  it('closes the leave question, and the run goes on', async () => {
    const fake = fakeController({ enabled: true, last: manifest(1_000) });
    const view = await mount(fake);
    await act(async () => {
      fake.state.setRun({
        kind: 'backup',
        progress: { stage: 'reading', done: 1, total: 4, fraction: 0.25 },
        cancellable: true,
      });
    });
    await act(async () => {
      fireEvent(view.getByTestId('back'), 'press');
    });
    await waitFor(() => expect(view.getByTestId('backup-leave-dialog')).toBeTruthy());

    await act(async () => {
      emitAppState('background');
    });

    expect(view.queryByTestId('backup-leave-dialog')).toBeNull();
    expect(fake.state.calls).not.toContain('cancelRun');
  });

  it('closes the question before deleting a backup, and deletes nothing', async () => {
    const fake = fakeController({ enabled: true, last: manifest(1_000) });
    fake.state.backups = [
      { manifest: manifest(1_000), compatibility: { kind: 'current' }, restorable: true },
    ];
    const view = await mount(fake);
    await act(async () => {
      fireEvent(view.getByTestId('backup-item-0'), 'press');
    });
    await act(async () => {
      fireEvent(view.getByTestId('backup-delete-open'), 'press');
    });
    await waitFor(() => expect(view.getByTestId('backup-delete-dialog')).toBeTruthy());

    await act(async () => {
      emitAppState('background');
    });

    expect(view.queryByTestId('backup-delete-dialog')).toBeNull();
    expect(fake.state.calls.filter(c => c.startsWith('deleteBackup'))).toEqual([]);
  });

  it('closes the question before lowering the limit, and the limit stays', async () => {
    const fake = fakeController({ enabled: true, last: manifest(3_000) });
    fake.state.prefs = { automatic: true, keep: 3, documents: false, documentMode: 'downloaded' as const };
    fake.state.backups = [3_000, 2_000, 1_000].map(at => ({
      manifest: manifest(at),
      compatibility: { kind: 'current' as const },
      restorable: true,
    }));
    const view = await mount(fake);
    await act(async () => {
      fireEvent(view.getByTestId('backup-advanced-toggle'), 'press');
    });
    await act(async () => {
      fireEvent(view.getByTestId('backup-keep-toggle'), 'press');
    });
    await waitFor(() => expect(view.getByTestId('backup-prune-dialog')).toBeTruthy());

    await act(async () => {
      emitAppState('background');
    });

    expect(view.queryByTestId('backup-prune-dialog')).toBeNull();
    expect(fake.state.calls.filter(c => c.startsWith('setPreferences'))).toEqual([]);
  });
});

describe('a question that arrives while the app is covered (review, 2026-09-24)', () => {
  // Both open after an await the app can leave during, and closing on leaving reaches only a dialog
  // already open - so they opened over the lock cover.
  it('holds the documents question until the app is back', async () => {
    const fake = fakeController({ enabled: true, last: manifest(1_000), documentsPossible: true });
    let answer = () => {};
    (fake.controller as unknown as { documentEstimate: () => Promise<unknown> }).documentEstimate =
      () =>
        new Promise(resolve => {
          answer = () => resolve({ count: 3, plainBytes: 3000, sealedBytes: 3100, gone: 0 });
        });
    const view = await mount(fake);
    await act(async () => {
      fireEvent(view.getByTestId('backup-documents-toggle'), 'press');
    });

    await act(async () => {
      emitAppState('background');
    });
    await act(async () => {
      answer();
    });
    expect(view.queryByTestId('backup-documents-dialog')).toBeNull();

    await act(async () => {
      emitAppState('active');
    });
    await waitFor(() => expect(view.getByTestId('backup-documents-dialog')).toBeTruthy());
  });

  it('holds "this phone has no screen lock" until the app is back', async () => {
    const fake = fakeController();
    let refuse = () => {};
    (fake.controller as unknown as { enable: () => Promise<unknown> }).enable = () =>
      new Promise((_resolve, reject) => {
        refuse = () => reject(new BackupLockUnavailableError());
      });
    const view = await mount(fake);
    await act(async () => {
      fireEvent(view.getByTestId('backup-toggle'), 'press');
    });

    await act(async () => {
      emitAppState('background');
    });
    await act(async () => {
      refuse();
    });
    expect(view.queryByTestId('backup-nolock-dialog')).toBeNull();

    await act(async () => {
      emitAppState('active');
    });
    await waitFor(() => expect(view.getByTestId('backup-nolock-dialog')).toBeTruthy());
  });
});
