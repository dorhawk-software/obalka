// A fast double tap on the backup screen (audit 2026-09-23).
//
// A file of its own, for the reason `backupScreenHarness.tsx` gives. Every run on this screen went
// through `run()`, which checked the `busy` STATE - and state lands a render late, so a double tap
// delivered both presses before it: two backups, two restores, two key prompts. Each tap here is taken
// from ONE render (`doubleTap`), which is how the second finger arrives. The fake controller answers at
// once, but not in the same tick, so the first run is still running when the second tap lands.

import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { fakeController, KEY, manifest, mount } from '../helpers/backupScreenHarness';
import { doubleTap } from '../helpers/doubleTap';

type Fake = ReturnType<typeof fakeController>;
const count = (fake: Fake, call: string) => fake.state.calls.filter(c => c === call).length;

/** Backups on, one made, one listed for restoring. */
function withBackup(): Fake {
  const fake = fakeController({ enabled: true, last: manifest(1_000) });
  fake.state.backups = [
    { manifest: manifest(3_000), compatibility: { kind: 'current' }, restorable: true },
  ];
  return fake;
}

describe('a double tap on the backup screen', () => {
  it('switches backups on once', async () => {
    const fake = fakeController();
    const view = await mount(fake);
    await doubleTap(view.getByTestId('backup-toggle'));
    await waitFor(() => expect(fake.state.status.enabled).toBe(true));
    expect(count(fake, 'enable')).toBe(1);
  });

  it('backs up once for "Zálohovat nyní"', async () => {
    const fake = withBackup();
    const view = await mount(fake);
    await doubleTap(view.getByTestId('backup-now'));
    expect(count(fake, 'backupNow')).toBe(1);
  });

  it('asks for the key once when it is revealed', async () => {
    const fake = withBackup();
    const view = await mount(fake);
    await doubleTap(view.getByTestId('backup-reveal'));
    expect(count(fake, 'revealKey')).toBe(1);
  });

  it('verifies once, imports once', async () => {
    const fake = withBackup();
    const view = await mount(fake);
    await doubleTap(view.getByTestId('backup-verify'));
    expect(count(fake, 'verify:obalka-1000.backup')).toBe(1);

    await doubleTap(view.getByTestId('backup-import'));
    expect(count(fake, 'importBackup')).toBe(1);
  });

  it('restores once with a typed key', async () => {
    const fake = withBackup();
    const view = await mount(fake);
    await fireEvent(view.getByTestId('backup-item-0'), 'press');
    await fireEvent.changeText(view.getByTestId('backup-key-input'), KEY);

    await doubleTap(view.getByTestId('backup-restore-start'));
    await waitFor(() => expect(view.getByTestId('backup-restored')).toBeTruthy());
    expect(count(fake, 'restore')).toBe(1);
  });

  it('restores once with the key this phone holds - the reveal and the restore are one run', async () => {
    // The key is revealed and the restore started inside the same run. A guard that refused the
    // restore because its own run was holding it would reveal the key and then do nothing.
    const fake = withBackup();
    const view = await mount(fake);
    await fireEvent(view.getByTestId('backup-item-0'), 'press');

    await doubleTap(view.getByTestId('backup-use-stored-key'));
    await waitFor(() => expect(view.getByTestId('backup-restored')).toBeTruthy());
    expect(count(fake, 'revealKey')).toBe(1);
    expect(count(fake, 'restore')).toBe(1);

    // And free again afterwards.
    await act(async () => {
      fireEvent.press(view.getByTestId('backup-now'));
    });
    expect(count(fake, 'backupNow')).toBe(1);
  });
});
