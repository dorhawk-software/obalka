// The backup screen while something is RUNNING (006).
//
// Split from `backupScreen.test.tsx` for a mundane reason - a single file renders this screen enough
// times that later tests stop finding their own tree - and for a useful one: everything here is about
// the two things the user asked for after seeing "Pracuji…" and nothing else. A real bar with real
// numbers, and a run that survives leaving the screen.

import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { BackupScreen } from '../../src/app/settings/BackupScreen';
import { fakeController, manifest, mount, wrap } from '../helpers/backupScreenHarness';
import type { BackupProgress } from '../../src/services/backup/progress';
import { t } from '../../src/i18n/strings';

describe('BackupScreen while it runs', () => {
  it('shows the stage, the real counts and a bar that follows them', async () => {
    const fake = fakeController({ enabled: true, last: manifest(1_000) });
    const view = await mount(fake);

    const at = (progress: BackupProgress) =>
      act(async () => {
        fake.state.setRun({ kind: 'backup', progress });
      });

    await at({ stage: 'reading', done: 12, total: 40, fraction: 0.075, detail: 'Jan Novák' });
    // Exactly what was asked for: what is happening, to what, and how far - not "Pracuji…".
    expect(view.getByTestId('backup-last')).toHaveTextContent(
      new RegExp(t('backup.stage.reading')),
    );
    expect(view.getByTestId('backup-last')).toHaveTextContent(/Jan Novák/);
    expect(view.getByTestId('backup-count')).toHaveTextContent('12 z 40');
    expect(view.getByTestId('backup-progress').props.accessibilityValue).toEqual({
      min: 0,
      max: 40,
      now: 12,
    });

    // The KDF has no rows to count, so it reports a percentage instead of a fake "x of y".
    await at({ stage: 'sealing', done: 0.5, total: 1, fraction: 0.55 });
    expect(view.getByTestId('backup-last')).toHaveTextContent(t('backup.stage.sealing'));
    expect(view.getByTestId('backup-count')).toHaveTextContent('55 %');

    // …and when the run ends, the row goes back to saying when the last backup was.
    await act(async () => {
      fake.state.setRun(null);
    });
    expect(view.queryByTestId('backup-progress')).toBeNull();
    expect(view.getByTestId('backup-last')).toHaveTextContent(/Naposledy/);
  });

  it('does not move the rest of the screen when a run starts', async () => {
    // Constitution V: transient UI must not shove the page around. The progress line replaces the
    // last-backup line in the same row, and the bar's height is reserved whether or not it is drawn.
    const fake = fakeController({ enabled: true, last: manifest(1_000) });
    const view = await mount(fake);
    const before = view.getByTestId('backup-now').props.style;

    await act(async () => {
      fake.state.setRun({
        kind: 'backup',
        progress: { stage: 'reading', done: 1, total: 9, fraction: 0.02 },
      });
    });

    expect(view.getByTestId('backup-now').props.style).toEqual(before);
    expect(view.getByTestId('backup-last')).toBeTruthy();
  });

  it('leaving mid-run asks, and honours both answers', async () => {
    const onBack = jest.fn();
    const fake = fakeController({ enabled: true, last: manifest(1_000) });
    const view = await wrap(
      <BackupScreen onBack={onBack} controller={fake.controller} onOpenFaq={() => {}} />,
    );
    await waitFor(() => expect(view.getByTestId('backup-toggle')).toBeTruthy());

    // Nothing running: back is just back.
    fireEvent(view.getByTestId('back'), 'press');
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(view.queryByTestId('backup-leave-dialog')).toBeNull();

    await act(async () => {
      fake.state.setRun({
        kind: 'backup',
        progress: { stage: 'sealing', done: 0.3, total: 1, fraction: 0.4 },
      });
    });

    await act(async () => {
      fireEvent(view.getByTestId('back'), 'press');
    });
    // Now it is a question, not an abort - and it is OUR dialog, not the OS one. (`waitFor`: RN's
    // Modal mounts its content a tick after the state change.)
    await waitFor(() => expect(view.getByTestId('backup-leave-dialog')).toBeTruthy());
    expect(view.getByText(t('backup.leave.title'))).toBeTruthy();
    expect(onBack).toHaveBeenCalledTimes(1);

    // All three answers are on it - what each one DOES is tested in `leaveActions.test.ts`, because
    // RNTL will not dispatch a press inside a Modal that appears after the first render here.
    expect(view.getByTestId('backup-leave-background')).toBeTruthy();
    expect(view.getByTestId('backup-leave-cancel')).toBeTruthy();
    expect(view.getByTestId('backup-leave-stay')).toBeTruthy();
    // Nothing has happened yet: opening the question must not answer it.
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(fake.state.calls).not.toContain('cancelRun');
  });
});
