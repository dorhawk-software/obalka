// How a restore ended, and the lock screen (2026-09-15, review).
//
// A file of its own, for the reason `backupScreenHarness.tsx` gives. The outcome dialog is a Modal, and
// a Modal draws in a window above the cover the lock gate lays over the app: a restore left running
// that ended while the app was locked was said over the lock screen. It waits for the unlock now.

import { AppState } from 'react-native';
import { act, waitFor } from '@testing-library/react-native';
import { fakeController, wrap } from '../helpers/backupScreenHarness';
import { BackupScreen } from '../../src/app/settings/BackupScreen';
import { LockGate } from '../../src/app/lock/LockGate';
import { InMemoryVaultKeyStorage, Vault } from '../../src/services/secureStore/vault';
import { t } from '../../src/i18n/strings';

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

/** Deliver an AppState change to the listeners registered from `from` on - the jest mock calls none. */
function emitAppState(state: 'active' | 'background', from = 0) {
  const calls = (AppState.addEventListener as jest.Mock).mock.calls.slice(from);
  for (const [type, handler] of calls) {
    if (type === 'change') {
      handler(state);
    }
  }
}

/** The real vault with the lock on and a key behind the gate, whose prompt answers when told to. */
function lockedVault() {
  const storage = new InMemoryVaultKeyStorage();
  storage.gated = new Uint8Array(32).fill(7);
  const vault = new Vault({ storage, lockSetting: { read: async () => true, write: async () => {} } });
  const read = storage.readGated.bind(storage);
  let release = () => {};
  storage.readGated = async title => {
    await new Promise<void>(resolve => {
      release = resolve;
    });
    return read(title);
  };
  return {
    vault,
    /** Answer the prompt that is out, as a person looking at the phone would. */
    answer: () => release(),
    /** Prompts answer at once from here on. */
    answerAtOnce: () => {
      storage.readGated = read;
    },
  };
}

/** A restore left running earlier failed, and no screen has said so yet. */
function waitingOutcome() {
  const fake = fakeController();
  fake.state.unseenRestores = [{ ok: false, error: new Error('no space left on device') }];
  return fake;
}

describe('how a restore ended, while the app is locked', () => {
  it('is not said over the lock screen, and is said once the app is unlocked', async () => {
    const fake = waitingOutcome();
    const { vault, answer } = lockedVault();
    const view = await wrap(
      <LockGate enabled lock={vault}>
        <BackupScreen onBack={() => {}} controller={fake.controller} onOpenFaq={() => {}} />
      </LockGate>,
    );
    // The screen is there under the cover and has taken the outcome; only saying it waits.
    await waitFor(() => expect(view.getByTestId('backup-toggle')).toBeTruthy());
    await waitFor(() => expect(fake.state.unseenRestores).toEqual([]));
    expect(view.getByTestId('unlock')).toBeTruthy();
    expect(view.queryByTestId('backup-restore-outcome')).toBeNull();

    await act(async () => answer());
    await waitFor(() => expect(view.queryByTestId('unlock')).toBeNull(), { timeout: 3000 });
    await waitFor(() => expect(view.getByTestId('backup-restore-outcome')).toBeTruthy());
    expect(view.getByText(t('backup.restore.error'))).toBeTruthy();
  });

  it('goes from over the lock screen when the app leaves with it open, and comes back after the unlock', async () => {
    const fake = waitingOutcome();
    const { vault, answer, answerAtOnce } = lockedVault();
    const view = await wrap(
      <LockGate enabled lock={vault}>
        <BackupScreen onBack={() => {}} controller={fake.controller} onOpenFaq={() => {}} />
      </LockGate>,
    );
    await waitFor(() => expect(view.getByTestId('backup-toggle')).toBeTruthy());
    await act(async () => answer());
    await waitFor(() => expect(view.getByTestId('backup-restore-outcome')).toBeTruthy(), {
      timeout: 3000,
    });

    // Left before anyone pressed OK: the cover goes up, and the dialog does not stay above it.
    answerAtOnce();
    setAppState('background');
    await act(async () => emitAppState('background'));
    expect(view.getByTestId('unlock')).toBeTruthy();
    expect(view.queryByTestId('backup-restore-outcome')).toBeNull();

    // Back and unlocked, it is still to be said: nobody pressed OK. Every listener hears the return, as
    // on a phone - the screen's own wait for the background included, not only the lock screen's.
    setAppState('active');
    await act(async () => emitAppState('active'));
    await waitFor(() => expect(view.queryByTestId('unlock')).toBeNull(), { timeout: 3000 });
    await waitFor(() => expect(view.getByTestId('backup-restore-outcome')).toBeTruthy());
    expect(view.getByText(t('backup.restore.error'))).toBeTruthy();
  });
});
