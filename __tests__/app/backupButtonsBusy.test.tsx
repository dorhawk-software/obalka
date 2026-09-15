// The backup screen's buttons while their run is going (2026-09-24).
//
// A file of its own, for the reason `backupScreenHarness.tsx` gives. "Zálohovat nyní" and "Obnovit"
// passed `disabled` while their own run showed "Pracuji…", so a screen reader heard them as unavailable
// rather than busy (023, PressScale's `busy`). And "Obnovit" over a restore an earlier visit had left
// running showed "Pracuji…" but was not held at all: pressing it queued a second restore behind the first.

import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { KEY, fakeController, manifest, mount } from '../helpers/backupScreenHarness';

const row = (createdAt: number) => ({
  manifest: manifest(createdAt),
  compatibility: { kind: 'current' as const },
  restorable: true,
});

/** Open the first backup in the list with the key typed in, ready to restore. */
async function openFirst(view: Awaited<ReturnType<typeof mount>>) {
  await act(async () => {
    fireEvent(view.getByTestId('backup-item-0'), 'press');
  });
  await act(async () => {
    fireEvent.changeText(view.getByTestId('backup-key-input'), KEY);
  });
}

describe('a button whose own run is going', () => {
  it('is heard as busy, not unavailable, while its backup runs', async () => {
    const fake = fakeController({ enabled: true, last: manifest(1_000) });
    let finish = () => {};
    (fake.controller as unknown as { backupNow: () => Promise<void> }).backupNow = () =>
      new Promise<void>(resolve => {
        finish = resolve;
      });
    const view = await mount(fake);

    await act(async () => {
      fireEvent.press(view.getByTestId('backup-now'));
    });

    expect(view.getByTestId('backup-now').props.accessibilityState).toEqual({
      busy: true,
      disabled: false,
    });
    await act(async () => {
      finish();
    });
  });

  it('is heard as busy, not unavailable, while its restore runs', async () => {
    const fake = fakeController({ enabled: true, last: manifest(1_000) });
    fake.state.backups = [row(1_000)];
    let finish = () => {};
    fake.state.restoreGate = new Promise<void>(resolve => {
      finish = resolve;
    });
    const view = await mount(fake);
    await openFirst(view);

    await act(async () => {
      fireEvent.press(view.getByTestId('backup-restore-start'));
    });

    expect(view.getByTestId('backup-restore-start').props.accessibilityState).toEqual({
      busy: true,
      disabled: false,
    });
    await act(async () => {
      finish();
    });
  });
});

describe('a backup this screen did not start (review, 2026-09-24)', () => {
  it('holds "Zálohovat nyní" as busy while it says "Pracuji…"', async () => {
    // An automatic backup, or one an earlier visit left going: the label said it was working, and a
    // screen reader heard the button as available.
    const fake = fakeController({ enabled: true, last: manifest(1_000) });
    const view = await mount(fake);
    await act(async () => {
      fake.state.setRun({
        kind: 'backup',
        progress: { stage: 'reading', done: 1, total: 4, fraction: 0.25 },
        cancellable: true,
      });
    });

    expect(view.getByTestId('backup-now').props.accessibilityState).toEqual({
      busy: true,
      disabled: false,
    });
  });
});

describe('a restore an earlier visit left running', () => {
  it('holds "Obnovit" and "use the password from this phone" until it ends', async () => {
    const fake = fakeController({ enabled: true, last: manifest(1_000) });
    fake.state.backups = [row(1_000)];
    const view = await mount(fake);
    await openFirst(view);
    await act(async () => {
      fake.state.setRun({
        kind: 'restore',
        progress: { stage: 'restoring', done: 3, total: 9, fraction: 0.3 },
        cancellable: true,
      });
    });

    await act(async () => {
      fireEvent.press(view.getByTestId('backup-restore-start'));
    });
    await act(async () => {
      fireEvent(view.getByTestId('backup-use-stored-key'), 'press');
    });

    expect(fake.state.calls.filter(c => c === 'restore' || c === 'revealKey')).toEqual([]);
    expect(view.getByTestId('backup-restore-start').props.accessibilityState.busy).toBe(true);

    // Once it has ended, the button starts a restore again.
    await act(async () => {
      fake.state.setRun(null);
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('backup-restore-start'));
    });
    await waitFor(() => expect(fake.state.calls).toContain('restore'));
  });
});
