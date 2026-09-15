// A verify stopped on the way out is not a verify that failed (2026-09-15, review).
//
// A file of its own, for the reason `backupScreenHarness.tsx` gives. The leave question offers "Zrušit
// ověřování" for a verify now. Stopped from there, the verify was reported in the snackbar, which
// outlives the screen, as a backup that could not be opened: damaged, or a password that does not match.

import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { fakeController, manifest, mount } from '../helpers/backupScreenHarness';
import { BackupAbortedError } from '../../src/features/backup/state/backupController';
import { t } from '../../src/i18n/strings';

describe('a verify stopped on the way out', () => {
  it('is not said to have failed', async () => {
    const fake = fakeController({ enabled: true, last: manifest(1_000) });
    fake.state.verifyFailure = new BackupAbortedError();
    const view = await mount(fake);

    await act(async () => {
      fireEvent.press(view.getByTestId('backup-verify'));
    });
    expect(fake.state.calls).toContain('verify:obalka-1000.backup');
    await waitFor(() =>
      expect(view.getByTestId('backup-verify')).toHaveTextContent(t('backup.verify')),
    );
    expect(view.queryByText(t('backup.verify.failed'))).toBeNull();
  });
});
