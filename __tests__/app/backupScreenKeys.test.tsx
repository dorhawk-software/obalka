// The backup screen and a declined screen lock (006, 2026-09-15).
//
// A file of its own, for the reason `backupScreenHarness.tsx` gives: a file that renders this screen
// many times starts failing to find its own tree in the later tests.
//
// Android asks for the screen lock when the backup password is STORED, and two ways of saying no to it
// were said as failures. After a restore the whole restore was called failed, although the archive had
// been restored and only the password was not kept. And switching backups on said "Zálohu se nepodařilo
// vytvořit." to somebody who had just decided not to - where a declined prompt everywhere else on this
// screen says nothing.

import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { fakeController, KEY, manifest, mount } from '../helpers/backupScreenHarness';
import { BackupPromptDeclinedError } from '../../src/services/backup/backupSecret';
import { t } from '../../src/i18n/strings';

describe('a declined screen lock on the backup screen', () => {
  it('says a password that was not kept beside the restore that worked, not as a failed restore', async () => {
    const fake = fakeController();
    fake.state.restoreKeysFailed = true;
    fake.state.backups = [
      { manifest: manifest(3_000), compatibility: { kind: 'current' }, restorable: true },
    ];
    const view = await mount(fake);

    await act(async () => {
      fireEvent(view.getByTestId('backup-item-0'), 'press');
    });
    await act(async () => {
      fireEvent.changeText(view.getByTestId('backup-key-input'), KEY);
    });
    await act(async () => {
      fireEvent(view.getByTestId('backup-restore-start'), 'press');
    });

    await waitFor(() =>
      expect(view.getByTestId('backup-restored')).toHaveTextContent(/7 zpráv/),
    );
    expect(String(view.getByTestId('backup-restored').props.children)).toContain(
      t('backup.restored.keyNotSaved'),
    );
    expect(view.queryByTestId('backup-error')).toBeNull();
  });

  it('says nothing when switching backups on was declined, and still says a real failure', async () => {
    const fake = fakeController();
    fake.state.enableFailure = new BackupPromptDeclinedError();
    const view = await mount(fake);

    await act(async () => {
      fireEvent(view.getByTestId('backup-toggle'), 'press');
    });
    await waitFor(() => expect(fake.state.calls).toContain('enable'));
    await waitFor(() => expect(view.getByTestId('backup-toggle')).toBeTruthy());
    expect(view.queryByTestId('backup-error')).toBeNull();

    fake.state.enableFailure = new Error('no space left on device');
    await act(async () => {
      fireEvent(view.getByTestId('backup-toggle'), 'press');
    });
    await waitFor(() =>
      expect(view.getByTestId('backup-error')).toHaveTextContent(t('backup.error')),
    );
  });
});
