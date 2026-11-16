// The answers of the backup screen's questions, out of BackupScreen.tsx (its size limit, 031 T050.7):
// pure builders, so what each answer does is testable without pressing pixels.

import type { DialogAction } from '../../theme/Dialog';
import { t } from '../../i18n/strings';
import type { BackupRun } from '../../features/backup/state/backupController';

/**
 * The two buttons of "delete the older backups?" - the question asked before a lower retention limit
 * takes effect.
 *
 * Cancelling must leave the SETTING alone, not just the backups: an unconfirmed limit that quietly
 * stuck would delete on the next backup instead, which is the same surprise moved later.
 */
export function pruneDialogActions({
  close,
  confirm,
}: {
  close: () => void;
  confirm: () => void;
}): DialogAction[] {
  return [
    // "Ponechat", not "Zrušit": beside a destructive button, "cancel" can be read as cancelling the
    // backups themselves. This one names the outcome.
    { bare: 'way out', label: t('common.keep'), testID: 'backup-prune-keep', onPress: close },
    {
      label: t('backup.prune.confirm'),
      tone: 'danger',
      glyph: 'bin',
      testID: 'backup-prune-confirm',
      onPress: confirm,
    },
  ];
}

/** The two buttons of "delete this backup?". Same shape, same reason (see `leaveDialogActions`). */
export function deleteDialogActions({
  close,
  remove,
}: {
  close: () => void;
  remove: () => void;
}): DialogAction[] {
  return [
    { bare: 'way out', label: t('common.keep'), testID: 'backup-delete-keep', onPress: close },
    {
      label: t('backup.delete'),
      tone: 'danger',
      glyph: 'bin',
      testID: 'backup-delete-confirm',
      onPress: remove,
    },
  ];
}

/** The two buttons of "turn backups off?". Extracted for the same reason as the leave dialog's. */
export function disableDialogActions({
  close,
  disable,
}: {
  close: () => void;
  disable: () => void;
}): DialogAction[] {
  return [
    {
      bare: 'way out',
      label: t('backup.off.keep'),
      testID: 'backup-disable-keep',
      onPress: close,
    },
    {
      glyph: 'archive',
      label: t('backup.off.confirm'),
      tone: 'danger',
      testID: 'backup-disable-confirm',
      onPress: disable,
    },
  ];
}

/**
 * What the leave-mid-run dialog says, for what is running.
 *
 * A restore and a verify ran as backups as far as this dialog knew, so leaving either asked "Záloha
 * ještě běží" and offered "Zrušit zálohu" (2026-09-15). A restore stopped from that button was not a
 * backup being called off, and a verify writes nothing at all.
 */
export function leaveCopy(kind: BackupRun['kind']): { title: string; body: string; cancel: string } {
  switch (kind) {
    case 'restore':
      return {
        title: t('backup.leave.title.restore'),
        body: t('backup.leave.body'),
        cancel: t('backup.leave.cancel.restore'),
      };
    case 'verify':
      return {
        title: t('backup.leave.title.verify'),
        body: t('backup.leave.body.verify'),
        cancel: t('backup.leave.cancel.verify'),
      };
    default:
      return {
        title: t('backup.leave.title'),
        body: t('backup.leave.body'),
        cancel: t('backup.leave.cancel'),
      };
  }
}

/**
 * What the three buttons of the leave-mid-run dialog do.
 *
 * A pure builder rather than inline JSX so the BEHAVIOUR is testable without pressing pixels: React
 * Native Testing Library will not dispatch a press inside a `Modal` that appears after the first
 * render of a tree this size - the dialog renders and can be queried, but the press never lands. The
 * screen test therefore asserts that the right dialog appears, and `__tests__/app/leaveActions.test.ts`
 * asserts what each button does.
 */
export function leaveDialogActions({
  kind,
  close,
  leave,
  cancelRun,
  notStopped,
}: {
  /** What is running, so the stop says what it stops. */
  kind: BackupRun['kind'];
  close: () => void;
  leave: () => void;
  /** Whether the run in progress will stop - see `BackupController.cancelRun`. */
  cancelRun: () => boolean;
  /** Says the run goes on, when the stop came after it could no longer be stopped. */
  notStopped: () => void;
}): DialogAction[] {
  return [
    {
      bare: 'step',
      label: t('backup.leave.background'),
      tone: 'primary',
      testID: 'backup-leave-background',
      // Walk away, leave it running. The controller owns the run, so nothing here has to keep it alive.
      onPress: () => {
        close();
        leave();
      },
    },
    {
      glyph: 'bin',
      label: leaveCopy(kind).cancel,
      tone: 'danger',
      testID: 'backup-leave-cancel',
      onPress: () => {
        close();
        // The dialog can stay open while a restore gets past its rows (2026-09-15), and from then this
        // stop does nothing. Said, rather than leaving someone who chose "cancel" to believe it worked.
        if (!cancelRun()) {
          notStopped();
        }
        leave();
      },
    },
    {
      bare: 'way out',
      label: t('backup.leave.stay'),
      testID: 'backup-leave-stay',
      onPress: close,
    },
  ];
}
