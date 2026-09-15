// The leave question names what is running (2026-09-15).
//
// A file of its own, for the reason `backupScreenHarness.tsx` gives: added to the progress suite, this
// render was the one that could no longer find its own tree. A restore and a verify both ran as a
// restore, and the question said "Záloha ještě běží" and offered "Zrušit zálohu" for either of them.

import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { fakeController, manifest, wrap } from '../helpers/backupScreenHarness';
import { BackupScreen } from '../../src/app/settings/BackupScreen';
import { t } from '../../src/i18n/strings';

describe('leaving the backup screen while something runs', () => {
  it('asks about a restore as a restore and about a verify as a verify', async () => {
    const fake = fakeController({ enabled: true, last: manifest(1_000) });
    const view = await wrap(
      <BackupScreen onBack={() => {}} controller={fake.controller} onOpenFaq={() => {}} />,
    );
    await waitFor(() => expect(view.getByTestId('backup-toggle')).toBeTruthy());

    const asked = [
      ['restore', 'Obnova ještě běží', 'Zrušit obnovu'],
      ['verify', 'Ověřování zálohy ještě běží', 'Zrušit ověřování'],
    ] as const;
    for (const [kind, title, cancel] of asked) {
      await act(async () => {
        fake.state.setRun({
          kind,
          progress: { stage: 'opening', done: 0.2, total: 1, fraction: 0.3 },
        });
      });
      await act(async () => {
        fireEvent(view.getByTestId('back'), 'press');
      });
      await waitFor(() => expect(view.getByTestId('backup-leave-dialog')).toBeTruthy());
      expect(view.getByText(title)).toBeTruthy();
      // A button's text is hidden from the tree; what it says is its label.
      expect(view.getByTestId('backup-leave-cancel').props.accessibilityLabel).toBe(cancel);
      expect(view.queryByText(t('backup.leave.title'))).toBeNull();
      await act(async () => {
        fireEvent(view.getByTestId('backup-leave-dialog'), 'requestClose');
      });
      await waitFor(() => expect(view.queryByTestId('backup-leave-dialog')).toBeNull());
    }
  });
});
