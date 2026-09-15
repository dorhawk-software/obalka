// The backup screen opened from Welcome, on a phone with no boxes (2026-09-24).
//
// A file of its own, for the reason `backupScreenHarness.tsx` gives.
//
// Such a phone can do three things here: receive a transfer, load a backup file, and restore one of
// the backups it then holds. Everything else on the screen - switching backups on, backing up now, the
// scope, the password, retention, saving a backup out - is about an archive the phone does not have
// yet, and on the first screen somebody sees after "Obnovit" it would be a wall of things to ignore.

import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { fakeController, KEY, manifest, wrap } from '../helpers/backupScreenHarness';
import { BackupScreen } from '../../src/app/settings/BackupScreen';
import { STRINGS_FOR_TEST } from '../../src/i18n/strings';

const { cs } = STRINGS_FOR_TEST;

/** Every control that belongs to a phone that already backs up. */
const MANAGING = [
  'backup-toggle',
  'backup-toggle-loading',
  'backup-now',
  'backup-verify',
  'backup-how',
  'backup-reveal',
  'backup-advanced-toggle',
  'backup-export',
];

async function mountFirstRun(
  fake: ReturnType<typeof fakeController>,
  extra: { onOpenTransfer?: () => void; onContinue?: () => void } = {},
) {
  const view = await wrap(
    <BackupScreen
      firstRun
      onBack={() => {}}
      controller={fake.controller}
      onOpenFaq={() => {}}
      onOpenTransfer={extra.onOpenTransfer}
      onContinue={extra.onContinue}
    />,
  );
  await waitFor(() => expect(view.getByTestId('backup-none')).toBeTruthy());
  return view;
}

// First in the file: the harness notes that a file rendering this screen many times stops finding
// its tree in the later tests, and this one waits for the switch that the first-run ones never draw.
describe('the backup screen from Settings', () => {
  it('is unchanged: the managing controls, the export, and no way on', async () => {
    const fake = fakeController({ enabled: true, last: manifest(1_000) });
    const view = await wrap(
      <BackupScreen
        onBack={() => {}}
        controller={fake.controller}
        onOpenFaq={() => {}}
        onOpenTransfer={() => {}}
        onContinue={() => {}}
      />,
    );
    await waitFor(() => expect(view.getByTestId('backup-toggle')).toBeTruthy());

    expect(view.getByTestId('backup-now')).toBeTruthy();
    expect(view.getByTestId('backup-export')).toBeTruthy();
    expect(view.getAllByText(cs.transfer).length).toBeGreaterThan(0);
    expect(view.getAllByText(cs.backup).length).toBeGreaterThan(0);
    expect(view.queryByTestId('backup-continue')).toBeNull();
  });
});

describe('the backup screen on a first run', () => {
  it('shows only what a phone with no boxes can use', async () => {
    // Backups switched on and one made - the most a phone can bring to this screen - and still none
    // of the managing controls, the export included.
    const fake = fakeController({ enabled: true, last: manifest(1_000) });
    const view = await mountFirstRun(fake, { onOpenTransfer: () => {} });

    for (const id of MANAGING) {
      expect(view.queryByTestId(id)).toBeNull();
    }
    expect(view.getByTestId('backup-import')).toBeTruthy();
    expect(view.getByTestId('backup-open-transfer')).toBeTruthy();
    expect(view.getByText(cs['restore.title'])).toBeTruthy();
    expect(view.getByText(cs['backup.file.desc.firstRun'])).toBeTruthy();
  });

  it('names the transfer from the side of the phone the archive is coming to', async () => {
    const fake = fakeController();
    const onOpenTransfer = jest.fn();
    const view = await mountFirstRun(fake, { onOpenTransfer });

    // "Přenést do jiného telefonu" is the sending phone's sentence.
    expect(view.queryByText(cs.transfer)).toBeNull();
    expect(view.getAllByText(cs['transfer.receiveFrom']).length).toBeGreaterThan(0);
    fireEvent.press(view.getByTestId('backup-open-transfer'));
    expect(onOpenTransfer).toHaveBeenCalledTimes(1);
  });

  it('puts them in the order they are used: transfer, file, then the list the file lands in', async () => {
    const fake = fakeController();
    const view = await mountFirstRun(fake, { onOpenTransfer: () => {} });
    const tree = JSON.stringify(view.toJSON());
    const at = (id: string) => tree.indexOf(`"testID":"${id}"`);

    expect(at('backup-open-transfer')).toBeGreaterThan(-1);
    expect(at('backup-open-transfer')).toBeLessThan(at('backup-import'));
    expect(at('backup-import')).toBeLessThan(at('backup-none'));
  });

  it('loads a backup file into the list, and restores it from there', async () => {
    const fake = fakeController();
    const view = await mountFirstRun(fake);

    await act(async () => {
      fireEvent.press(view.getByTestId('backup-import'));
    });
    await waitFor(() => expect(view.getByTestId('backup-item-0')).toBeTruthy());

    await act(async () => {
      fireEvent(view.getByTestId('backup-item-0'), 'press');
    });
    await act(async () => {
      fireEvent.changeText(view.getByTestId('backup-key-input'), KEY);
    });
    await act(async () => {
      fireEvent(view.getByTestId('backup-restore-start'), 'press');
    });

    await waitFor(() => expect(view.getByTestId('backup-restored')).toBeTruthy());
    expect(fake.state.calls).toEqual(['importBackup', 'restore']);
  });

  it('loads a double-tapped file once', async () => {
    const fake = fakeController();
    const view = await mountFirstRun(fake);

    await act(async () => {
      fireEvent.press(view.getByTestId('backup-import'));
      fireEvent.press(view.getByTestId('backup-import'));
    });

    expect(fake.state.calls.filter(c => c === 'importBackup')).toHaveLength(1);
  });

  it('offers the way on only when the shell has somewhere to go', async () => {
    const fake = fakeController();
    const without = await mountFirstRun(fake);
    expect(without.queryByTestId('backup-continue')).toBeNull();
    without.unmount();

    const onContinue = jest.fn();
    const view = await mountFirstRun(fakeController(), { onContinue });
    fireEvent.press(view.getByTestId('backup-continue'));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
