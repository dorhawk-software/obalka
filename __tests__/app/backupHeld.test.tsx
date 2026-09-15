// A backup a restore could not bring every document back from is held out of retention (2026-09-15).
//
// It stays past the limit, so the screen has to say so wherever that shows: on its row, in the question
// before deleting it - the one way to let it go - and in the question before lowering the limit, which
// no longer deletes it and must not count it.

import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { fakeController, manifest, mount } from '../helpers/backupScreenHarness';
import { pruneBody } from '../../src/app/settings/BackupScreen';
import { t } from '../../src/i18n/strings';

const row = (createdAt: number, held: boolean) => ({
  manifest: manifest(createdAt),
  compatibility: { kind: 'current' as const },
  restorable: true,
  held,
});

describe('a held backup on the backup screen', () => {
  it('says on its row why it stays, and deleting it says what goes with it', async () => {
    const fake = fakeController({ enabled: true, last: manifest(5_000) });
    fake.state.backups = [row(5_000, false), row(1_000, true)];
    const view = await mount(fake);

    await waitFor(() =>
      expect(view.getByTestId('backup-held-1')).toHaveTextContent(t('backup.restore.held')),
    );
    expect(view.queryByTestId('backup-held-0')).toBeNull();
    // A screen reader hears the pressable's label and not the caption inside it (2026-09-15, review).
    expect(view.getByTestId('backup-item-1').props.accessibilityLabel).toContain(
      `, ${t('backup.restore.held')}`,
    );
    expect(view.getByTestId('backup-item-0').props.accessibilityLabel).not.toContain(
      t('backup.restore.held'),
    );

    await act(async () => {
      fireEvent(view.getByTestId('backup-item-1'), 'press');
    });
    await act(async () => {
      fireEvent(view.getByTestId('backup-delete-open'), 'press');
    });
    await waitFor(() => expect(view.getByTestId('backup-delete-dialog')).toBeTruthy());
    expect(view.getByText(t('backup.delete.body.held'))).toBeTruthy();
    expect(view.queryByText(t('backup.delete.body'))).toBeNull();
  });

  it('is left out of what lowering the limit deletes, and the question says it stays', async () => {
    const fake = fakeController({ enabled: true, last: manifest(5_000) });
    fake.state.prefs = { automatic: true, keep: 3, documents: false, documentMode: 'downloaded' as const };
    fake.state.backups = [row(5_000, false), row(4_000, false), row(1_000, true)];
    const view = await mount(fake);
    await act(async () => {
      fireEvent(view.getByTestId('backup-advanced-toggle'), 'press');
    });
    await act(async () => {
      fireEvent(view.getByTestId('backup-keep-toggle'), 'press');
    });

    await waitFor(() => expect(view.getByTestId('backup-prune-dialog')).toBeTruthy());
    // One of the two ordinary backups goes, the newest stays, and so does the held one.
    expect(view.getByText(pruneBody(1, 1, 1))).toBeTruthy();
  });

  it('asks nothing when only a held backup is past the limit, since nothing would be deleted', async () => {
    const fake = fakeController({ enabled: true, last: manifest(5_000) });
    fake.state.prefs = { automatic: true, keep: 3, documents: false, documentMode: 'downloaded' as const };
    fake.state.backups = [row(5_000, false), row(1_000, true)];
    const view = await mount(fake);
    await act(async () => {
      fireEvent(view.getByTestId('backup-advanced-toggle'), 'press');
    });
    await act(async () => {
      fireEvent(view.getByTestId('backup-keep-toggle'), 'press');
    });

    expect(view.queryByTestId('backup-prune-dialog')).toBeNull();
    expect(fake.state.calls).toContain('setPreferences:{"keep":1}');
  });
});
