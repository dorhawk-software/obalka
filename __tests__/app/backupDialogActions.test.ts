// What the three buttons of "the backup is still running" actually do.
//
// Tested at the builders rather than through the rendered dialogs, for a mechanical reason worth
// writing down: RNTL will not dispatch a press inside a `Modal` that appears AFTER the first render
// of a tree this size. The dialog renders and can be queried - the screen test asserts exactly that -
// but a `fireEvent.press` on its buttons never reaches the handler. Rather than assert something
// weaker, the handlers moved into a pure function, which is the part with the rules in it anyway.

import {
  disableDialogActions,
  leaveCopy,
  leaveDialogActions,
} from '../../src/app/settings/BackupScreen';
import type { BackupRun } from '../../src/features/backup/state/backupController';
import { t } from '../../src/i18n/strings';

function build(stops = true, kind: BackupRun['kind'] = 'backup') {
  const calls: string[] = [];
  const actions = leaveDialogActions({
    kind,
    close: () => calls.push('close'),
    leave: () => calls.push('leave'),
    cancelRun: () => {
      calls.push('cancelRun');
      return stops;
    },
    notStopped: () => calls.push('notStopped'),
  });
  const press = (label: string) => {
    actions.find(a => a.label === label)?.onPress();
    return calls;
  };
  return { actions, press, calls };
}

describe('leaving while a backup runs', () => {
  it('offers exactly three answers, and only one of them is destructive', () => {
    const { actions } = build();
    expect(actions.map(a => a.label)).toEqual([
      t('backup.leave.background'),
      t('backup.leave.cancel'),
      t('backup.leave.stay'),
    ]);
    expect(actions.filter(a => a.tone === 'danger')).toHaveLength(1);
    // The primary is the safe one. A user tapping the emphasised button must not lose their backup.
    expect(actions.find(a => a.tone === 'primary')?.label).toBe(t('backup.leave.background'));
  });

  it('"keep it running" leaves without touching the run', () => {
    const { press } = build();
    expect(press(t('backup.leave.background'))).toEqual(['close', 'leave']);
  });

  it('"cancel the backup" stops it and then leaves', () => {
    const { press } = build();
    // Order matters: cancel BEFORE navigating, so the run is told to stop even if the screen goes
    // away in the same tick.
    expect(press(t('backup.leave.cancel'))).toEqual(['close', 'cancelRun', 'leave']);
  });

  it('"cancel" says the run goes on when it came too late to stop it (2026-09-15)', () => {
    // The dialog stays open while a restore gets past its rows, and the stop then does nothing. Leaving
    // without a word let someone who chose "cancel" believe the restore had been called off.
    const { press } = build(false);
    expect(press(t('backup.leave.cancel'))).toEqual(['close', 'cancelRun', 'notStopped', 'leave']);
  });

  it('"stay here" does nothing but close the dialog', () => {
    const { press } = build();
    expect(press(t('backup.leave.stay'))).toEqual(['close']);
  });

  it('names what it would stop: a restore and a verify are not a backup (2026-09-15)', () => {
    // Both ran as a restore, so leaving either one said "Záloha ještě běží" and "Zrušit zálohu".
    expect(leaveCopy('restore')).toEqual({
      title: 'Obnova ještě běží',
      body: 'Chcete ji nechat doběžet na pozadí, nebo ji zrušit?',
      cancel: 'Zrušit obnovu',
    });
    expect(leaveCopy('verify')).toEqual({
      title: 'Ověřování zálohy ještě běží',
      body: 'Chcete ověřování nechat doběžet na pozadí, nebo ho zrušit?',
      cancel: 'Zrušit ověřování',
    });
    expect(leaveCopy('backup')).toEqual({
      title: t('backup.leave.title'),
      body: t('backup.leave.body'),
      cancel: t('backup.leave.cancel'),
    });
    // The button is the one the copy names, and it still stops the run.
    for (const kind of ['restore', 'verify'] as const) {
      const { actions, press } = build(true, kind);
      expect(actions.find(a => a.tone === 'danger')?.label).toBe(leaveCopy(kind).cancel);
      expect(press(leaveCopy(kind).cancel)).toEqual(['close', 'cancelRun', 'leave']);
    }
  });
});

describe('turning backups off', () => {
  it('asks with the destructive action clearly marked, and does nothing until it is chosen', () => {
    const calls: string[] = [];
    const actions = disableDialogActions({
      close: () => calls.push('close'),
      disable: () => calls.push('disable'),
    });

    expect(actions.map(a => a.tone ?? 'neutral')).toEqual(['neutral', 'danger']);
    actions[0].onPress();
    expect(calls).toEqual(['close']); // "cancel" forgets nothing
    actions[1].onPress();
    expect(calls).toEqual(['close', 'disable']);
  });
});
