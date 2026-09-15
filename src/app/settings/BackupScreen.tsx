// Backup and restore (006), the whole feature as one screen.
//
// Everything it can do goes through `BackupController`, so this file holds no crypto and no key
// handling - it decides what to SHOW, and three of those decisions matter:
//
//   * The scope card is not a footnote. A user who thinks their attachments are backed up finds out
//     on the day they have lost the phone, so what the backup does not contain is stated where the
//     switch is (FR-008).
//   * The password is revealed only through the controller, which reads it from the Keychain and
//     therefore makes the OS ask (FR-013). Nothing here caches it beyond the screen, and leaving the
//     screen forgets it.
//   * Backups that this build cannot read are LISTED, greyed, with the reason. Hiding them would look
//     like the backup was lost when the answer is "update the app" (FR-011).

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { BackHandler, type DimensionValue } from 'react-native';
import { XStack, YStack, Input } from '../../theme/ui';
import { Body, BodyStrong, Caption, Value } from '../../theme/Typography';
import { PressScale } from '../../theme/PressScale';
import { Toggle } from '../../theme/Toggle';
import { QrCode } from '../../theme/QrCode';
import { ProgressBar } from '../../theme/ProgressBar';
import { Skeleton } from '../../theme/Skeleton';
import { Dialog, type DialogAction } from '../../theme/Dialog';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts } from '../../theme/typography';
import {
  BackupIcon,
  CameraIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  HelpIcon,
  MailIcon,
  ShieldKeyIcon,
  TrashIcon,
  TuneIcon,
} from '../../theme/icons';
import { SegmentedControl } from '../../theme/SegmentedControl';
import { SwipeableRow } from '../../theme/SwipeableRow';
import type { FaqId } from '../../content/faq';
import { plural, t } from '../../i18n/strings';
import { haptics } from '../../services/haptics';
import { SubScreen } from './SubScreen';
import { useSnackbar } from '../Snackbar';
import { Card, CardRow, RowTitle, Section } from './SettingsSection';
import {
  BackupAbortedError,
  BackupCancelledError,
  BackupLockUnavailableError,
  BackupRestoreHeldError,
  type BackupController,
  type BackupRun,
  type BackupStatus,
  type ListedBackup,
  type RestoredBackup,
  type RestoreOutcome,

  BACKUP_DEFAULTS,
  MAX_KEEP,
  type BackupPreferences} from '../../features/backup/state/backupController';
import { BackupAuthError } from '../../services/backup/envelope';
import { BackupPromptDeclinedError } from '../../services/backup/backupSecret';
import { PortableFormatError } from '../../services/backup/portable';
import { encodeKeyQr, parseKeyQr } from '../../services/backup/keyQr';
import {
  TransferCodeScanner,
  scanningAvailable,
} from '../../features/transfer/screens/CodeScanner';
import { useAppCovered } from '../lock/LockGate';
import { useCloseOnBackground } from '../useCloseOnBackground';
import { parseRecoveryKey } from '../../services/backup/recoveryKey';
import type { BackupDocumentMode, BackupManifest } from '../../services/backup/schema';
import { OptionGroup } from '../../theme/OptionGroup';
import { BackupDocumentsChip, documentsChipText, documentsMissingText } from './BackupDocumentsChip';
import type { BackupProgress } from '../../services/backup/progress';
import type {
  ApplyOutcome,
  TransferOutcomes,
} from '../../features/transfer/state/transferController';
import { doneText, errorText } from './TransferScreen';
import { useSingleFlight } from '../useSingleFlight';
import { ContinueButton } from './ContinueButton';
import { reportFailure } from '../../services/telemetry/telemetry';

const pad =(n: number) => String(n).padStart(2, '0');

/** Same shape as the message list's timestamps - one app, one date format. */
function formatDateTime(epochMs: number): string {
  const d = new Date(epochMs);
  return (
    `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

function formatBytes(n: number): string {
  if (n < 1024) {
    return `${n} B`;
  }
  if (n < 1024 * 1024) {
    return `${Math.round(n / 1024)} kB`;
  }
  return `${(n / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

type Busy =
  | 'toggle'
  | 'backup'
  | 'reveal'
  | 'restore'
  | 'file'
  | 'verify'
  | 'documents'
  | null;

/**
 * "Hned se smažou 3 starší zálohy, které už nepůjde obnovit; zůstanou 2 nejnovější."
 *
 * Two numbers, and Czech makes both agree: the verb with how many go ("3 zálohy se smažou" but "5
 * záloh se smaže"), the adjective with how many stay. Built from two counted phrases - interpolating
 * numbers into one fixed sentence is how "3 starší zálohy se smaže" got onto a screen.
 */
export function pruneBody(deleted: number, kept: number, held = 0): string {
  return [
    t('backup.prune.body', {
      deleted: t(`backup.prune.deleted.${plural(deleted)}`, { n: deleted }),
      kept: t(`backup.prune.kept.${plural(kept)}`, { n: kept }),
    }),
    // The held backups stay whatever the limit, and "only the newest stays" would be false beside
    // them (2026-09-15).
    held > 0 ? t(`backup.prune.held.${plural(held)}`, { n: held }) : null,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * "Obnoveno: 19 zpráv, 3 schránky, 9 souborů. 1 přílohu se nepodařilo obnovit."
 *
 * What a finished restore says it did, in its own function so the agreement can be tested without
 * rendering the screen (2026-09-15, when the documents that did not come back got their plural forms).
 */
export function restoredText(done: RestoredBackup): string {
  const messages = done.messagesAdded + done.messagesMerged;
  const boxes = done.accountsAdded + done.accountsKept;
  const files = done.documents?.restored ?? 0;
  // Counted phrases, not bare numbers: "1 schránek" is the kind of detail that makes an app read like
  // a translation of itself.
  const counts = {
    messages: t(`backup.count.messages.${plural(messages)}`, { n: messages }),
    boxes: t(`backup.count.boxes.${plural(boxes)}`, { n: boxes }),
  };
  // Documents that the index names and this copy does not carry - a backup exported to a file holds
  // the archive, not the objects. Said rather than quietly dropped: a restore that silently loses
  // documents is the failure the whole tier exists to prevent. With them the ones left with no message
  // to belong to, as the transfer counts them (2026-09-15, review): they were not written either, and
  // the backup they came from is held for them.
  const lost =
    (done.documents?.missing ?? 0) + (done.documents?.failed ?? 0) + (done.documents?.orphaned ?? 0);
  return [
    files > 0
      ? t('backup.restored.documents', {
          ...counts,
          files: t(`backup.count.files.${plural(files)}`, { n: files }),
        })
      : t('backup.restored', counts),
    lost > 0 ? t(`backup.restored.someMissing.${plural(lost)}`, { n: lost }) : null,
    // Why the backup it came from now stays past the retention limit, said where the loss is said
    // (2026-09-15). The list row says it too, for as long as it is true.
    done.held ? t('backup.restored.held') : null,
    // The archive is restored; only the password was not kept - a declined screen lock, most likely.
    // Said beside the result, so a restore that worked is not reported as one that failed and nobody
    // believes this phone is backing up (2026-09-15).
    done.keysFailed ? t('backup.restored.keyNotSaved') : null,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * "Záloha je v pořádku: 3 schránky, 19 zpráv."
 *
 * Counted phrases, as `restoredText` builds them: the sentence took bare numbers until 2026-09-24, so a
 * backup of one box with one message read "1 schránky, 1 zpráv".
 */
export function verifyText(counts: { accounts: number; messages: number }): string {
  return t('backup.verify.ok', {
    boxes: t(`backup.count.boxes.${plural(counts.accounts)}`, { n: counts.accounts }),
    messages: t(`backup.count.messages.${plural(counts.messages)}`, { n: counts.messages }),
  });
}

/**
 * What the progress line calls the stage a run is in. A restore writes its documents back in the stage
 * a backup reads them in, and the line said "Zálohuji přílohy" over a restore until 2026-09-24.
 */
export function stageText(run: Pick<BackupRun, 'kind' | 'progress'>): string {
  return run.kind === 'restore' && run.progress.stage === 'documents'
    ? t('backup.stage.documents.restore')
    : t(`backup.stage.${run.progress.stage}`);
}

/**
 * What a failed restore says. Only an AUTHENTICATION failure means the password was wrong: reporting
 * every failure that way sent me looking at a password that was correct while the real fault - a
 * missing Hermes global - went unnamed; a user would have retyped a perfect key until they gave up.
 */
export function restoreErrorText(err: unknown): string {
  // A restore that failed past its rows keeps its backup held, and says so here as well as on the
  // backup's row (2026-09-24).
  if (err instanceof BackupRestoreHeldError) {
    return `${t('backup.restore.error')} ${t('backup.restore.error.held')}`;
  }
  return err instanceof BackupAuthError ? t('backup.restore.failed') : t('backup.restore.error');
}

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
    { label: t('common.keep'), testID: 'backup-prune-keep', onPress: close },
    {
      label: t('backup.prune.confirm'),
      tone: 'danger',
      icon: color => <TrashIcon size={16} color={color} />,
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
    { label: t('common.keep'), testID: 'backup-delete-keep', onPress: close },
    {
      label: t('backup.delete'),
      tone: 'danger',
      icon: color => <TrashIcon size={16} color={color} />,
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
      label: t('common.cancel'),
      testID: 'backup-disable-keep',
      onPress: close,
    },
    {
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
      label: t('backup.leave.stay'),
      testID: 'backup-leave-stay',
      onPress: close,
    },
  ];
}

/**
 * "12 z 40" where there is something to count, a percentage where there is not.
 *
 * Argon2id knows how far along it is but not in units a person cares about, so it gets the
 * percentage; reading messages and writing rows get the real counts, which is what was asked for.
 */
function countLabel(progress: BackupProgress): string {
  return progress.total > 1
    ? t('backup.progress.count', { done: progress.done, total: progress.total })
    : t('backup.progress.percent', {
        percent: Math.round(progress.fraction * 100),
      });
}

/**
 * A block of placeholder lines standing in for copy that is still being fetched.
 *
 * `widths` is one entry per line the real text occupies at this width, so the row keeps its height
 * and nothing below it moves when the words arrive (constitution V). The fill is `borderStrong`
 * rather than Skeleton's default: these sit inside a Card, and there `surfaceAlt` is DARKER than
 * the surface behind it in dark mode, which measured 1.09:1 on a device - invisible.
 */
function LoadingLines({
  widths,
  height = 11,
  label,
  testID,
}: {
  readonly widths: readonly DimensionValue[];
  readonly height?: number;
  readonly label?: string;
  readonly testID?: string;
}) {
  const theme = useTheme();
  return (
    <YStack
      flex={1}
      gap={5}
      marginTop={3}
      accessible={label !== undefined}
      accessibilityLabel={label}
      testID={testID}
    >
      {widths.map((width, i) => (
        <Skeleton
          key={i}
          color={theme.borderStrong}
          width={width}
          height={height}
          radius={6}
        />
      ))}
    </YStack>
  );
}

export function BackupScreen({
  onOpenTransfer,
  onBack,
  controller,
  onOpenFaq,
  shownAgain,
  transferOutcomes,
  inView = true,
  firstRun = false,
  onContinue,
}: {
  readonly onBack: () => void;
  readonly controller: BackupController;
  /**
   * Opened from Welcome on a phone with no boxes (2026-09-24): only what such a phone can use - the
   * transfer, loading a backup file and the restore list - in the order somebody moving in takes them.
   * Switching backups on, backing up, the scope, the password and retention are all about an archive
   * this phone does not have yet.
   */
  readonly firstRun?: boolean;
  /**
   * The way on once a restore has brought boxes onto the phone: the shell passes it only then. A
   * button at the foot of the screen, under the sentence saying what was restored.
   */
  readonly onContinue?: () => void;
  /** Opens the FAQ at the encryption answer - the detail this screen deliberately does not carry. */
  readonly onOpenFaq: (focus: FaqId) => void;
  /** Opens the phone-to-phone transfer (025). Absent in tests that do not exercise it. */
  readonly onOpenTransfer?: () => void;
  /**
   * Goes up each time this screen comes back into view after another one covered it (025 review,
   * 2026-09-15). The transfer it opens can turn backups on by keeping the key that arrived.
   */
  readonly shownAgain?: number;
  /**
   * Where a transfer's save leaves how it ended when no transfer screen was open to say it (025
   * review, 2026-09-15). Absent in tests that do not exercise it.
   */
  readonly transferOutcomes?: TransferOutcomes;
  /** Whether this screen is the one in view rather than covered by another. Absent means it is. */
  readonly inView?: boolean;
}) {
  const theme = useTheme();
  // The run lives in the controller, so it keeps going when this screen goes away. This subscribes to
  // it - which also means re-entering the screen mid-run shows the bar where it actually is.
  const activeRun = useSyncExternalStore(
    controller.subscribe,
    controller.currentRun,
  );
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [backups, setBackups] = useState<ListedBackup[]>([]);
  const [busy, setBusy] = useState<Busy>(null);
  /**
   * Every run this screen starts - switch on or off, back up now, restore, verify, reveal the key,
   * export or import a file - goes through ONE guard (audit 2026-09-23). `busy` disables the buttons
   * and draws the spinners, but it lands a render late, and a double tap delivers both presses before
   * that: two backups, two restores, two key prompts. The guard is claimed in the tap itself.
   */
  const runOnce = useSingleFlight();
  // Transient confirmations go through the snackbar, not the notice line at the foot of this screen.
  // Found on a device: "Ověřit zálohu" sits under the last-backup line at the TOP, and its answer
  // was rendering below the restore list, a screen and a half further down. The user taps and
  // nothing happens, as far as they can tell. The snackbar is drawn above the navigator, so it is
  // visible wherever the scroll happens to be.
  const snackbar = useSnackbar();
  // The revealed password lives here and nowhere else - leaving the screen forgets it.
  const [revealed, setRevealed] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [chosen, setChosen] = useState<BackupManifest | null>(null);
  const [typedKey, setTypedKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Which dialog is open. The app's own (theme/Dialog) - never the OS alert, which looks like
   *  a different application and reads in ALL CAPS. */
  const [dialog, setDialog] = useState<'leave' | 'disable' | 'noLock' | null>(
    null,
  );
  /** What was running when the leave dialog opened, so its words stay put if the run ends under it. */
  const [leaving, setLeaving] = useState<BackupRun['kind']>('backup');
  /** How backups behave. Loaded with the status; the defaults are the simple case (auto, keep one). */
  const [prefs, setPrefs] = useState<BackupPreferences>(BACKUP_DEFAULTS);
  /** Advanced is COLLAPSED by default. The screen has to stay readable for someone who wants none of it. */
  const [advanced, setAdvanced] = useState(false);
  const [doomed, setDoomed] = useState<BackupManifest | null>(null);
  /** A lower retention limit the user has chosen but not yet confirmed. */
  const [pendingKeep, setPendingKeep] = useState<number | null>(null);
  /** 006 T012b: scanning the recovery key, now that 025 has paid for a camera. */
  const [scanningKey, setScanningKey] = useState(false);
  /**
   * What the documents would cost, measured but not yet agreed to (006 T024).
   *
   * The size is shown BEFORE the switch moves, and it is measured rather than guessed: the ISDS
   * `attachmentSize` is what the message weighed on the server, not what is on this phone, and most
   * messages have never had their documents downloaded at all. Measuring walks the archive, which is
   * why it happens on the tap rather than on every visit to this screen.
   */
  const [documentAsk, setDocumentAsk] = useState<{
    count: number;
    sealedBytes: number;
    /** Messages whose attachments the `all` mode would download, and those ISDS has deleted (026). */
    askable: number;
    gone: number;
    /** The row selected in the dialog. */
    mode: BackupDocumentMode;
    /** Opened from "Změnit" with attachments already on, rather than from the switch. */
    changing: boolean;
  } | null>(null);

  const refresh = useCallback(async () => {
    // THREE independent reads, not one all-or-nothing batch. A destination that cannot be read (a
    // revoked permission, a cloud target that is offline) must not leave the screen stuck on its
    // loading state - and, more to the point, one failing read must not blank the other two. That
    // was a real defect: on a phone's first visit the status and the list both created the backup
    // directory at once, one of them lost the race and threw, and the screen answered "backups off,
    // nothing to restore" when neither had been established. "No backups listed" is the truthful
    // thing to show when the listing failed; it is a lie about the switch.
    const [next, list, preferences] = await Promise.all([
      controller.status().catch(() => null),
      controller.list().catch(() => [] as ListedBackup[]),
      controller.preferences().catch(() => null),
    ]);
    setStatus(
      current =>
        next ??
        current ?? {
          enabled: false,
          last: null,
          documentsPossible: false,
          documentsOn: false,
          documentMode: 'downloaded',
        },
    );
    setBackups(list);
    if (preferences) {
      setPrefs(preferences);
    }
  }, [controller]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Refresh once a run ends, whoever started it: the "Naposledy …" line and the restore list are both
  // stale the moment a backup finishes.
  useEffect(() => {
    if (!activeRun) {
      void refresh();
    }
  }, [activeRun, refresh]);

  // And once it comes back into view (025 review, 2026-09-15). It stays mounted under the transfer it
  // opens, and a transfer that kept the key that arrived had turned backups on while this screen went
  // on saying "off".
  useEffect(() => {
    if (shownAgain) {
      void refresh();
    }
  }, [shownAgain, refresh]);

  /** How a transfer's save ended, when no transfer screen was open to say it. */
  const [transferOutcome, setTransferOutcome] = useState<ApplyOutcome | null>(null);
  // Said here while this screen is the one in view (025 review, 2026-09-15): at once when the save ends
  // then - leaving the transfer mid-save lands here - or when this screen next comes into view. Taken
  // only while in view, so a transfer screen open on top says it itself. A dialog, because it moves
  // nothing on the screen behind it (constitution V) and is seen wherever this screen is scrolled.
  useEffect(() => {
    if (!transferOutcomes || !inView) {
      return undefined;
    }
    const take = () => {
      const outcome = transferOutcomes.takeOutcome();
      if (outcome) {
        setTransferOutcome(outcome);
      }
    };
    take();
    return transferOutcomes.subscribeOutcome(take);
  }, [transferOutcomes, inView]);

  /**
   * How the restores ended that this screen did not see end, oldest first: each was left with "Nechat
   * běžet". The dialog says the first, and the next once it is dismissed.
   */
  const [restoreOutcomes, setRestoreOutcomes] = useState<readonly RestoreOutcome[]>([]);
  /** Whether the lock screen covers the app, or it is in the background - the outcome dialog waits it out. */
  const locked = useAppCovered();
  /** Whether this screen is still there to say how a restore it started ended. */
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  // Read when the restore ends, not when it starts, as the transfer screen reads it for a save. Going
  // back takes the screen out of view at once and unmounts it only once the transition is over, and a
  // restore that ended in that moment was said on the screen on its way out (2026-09-15, review).
  const inViewNow = useRef(inView !== false);
  inViewNow.current = inView !== false;
  /** Whether a restore's end is this screen's to say, or the controller's to keep for the next screen. */
  const seenHere = () => mounted.current && inViewNow.current;
  // Leaving during a restore unmounted the screen, and how the restore ended was said nowhere
  // (2026-09-15). The controller keeps it, as it keeps a transfer's save, and it is said here in a
  // dialog while this screen is in view: when it opens again, or at once when a restore started by an
  // earlier visit ends while it is open - even while a restore of this visit's own is going, which
  // the controller does not keep (see `onRestore`).
  useEffect(() => {
    if (!inView) {
      return undefined;
    }
    const take = () => {
      const taken: RestoreOutcome[] = [];
      for (let next = controller.takeRestoreOutcome(); next; next = controller.takeRestoreOutcome()) {
        taken.push(next);
      }
      if (taken.length > 0) {
        setRestoreOutcomes(current => [...current, ...taken]);
        // Read again now, not only when the run ended: the backup it came from is held or let go after
        // the run, so the read that the run's end started could still show it the way it was.
        void refresh();
      }
    };
    take();
    return controller.subscribeRestoreOutcome(take);
  }, [controller, inView, refresh]);

  /**
   * Leaving while something is running is a question, not an abort.
   *
   * Both ways out go through here - the header button and Android's back gesture/key - because a
   * modal that only guards one of them is a modal that does not guard anything.
   */
  const leave = useCallback(() => {
    // A run that cannot be stopped part-way - a transfer's save (025 FR-012) - leaves nothing to ask:
    // it goes on either way, and "carry on or stop?" would offer a stop that does nothing.
    if (!activeRun || activeRun.cancellable === false) {
      onBack();
      return true;
    }
    setLeaving(activeRun.kind);
    setDialog('leave');
    return true;
  }, [activeRun, onBack]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', leave);
    return () => sub.remove();
  }, [leave]);

  /**
   * Cancelling a biometric prompt is a decision, not a failure - it says nothing. Declining the one
   * Android raises when the password is STORED is the same decision (2026-09-15): switching backups on
   * and pressing cancel said "Zálohu se nepodařilo vytvořit." to somebody who had just said no.
   */
  const report = (err: unknown, fallback: string) => {
    if (!(err instanceof BackupCancelledError) && !(err instanceof BackupPromptDeclinedError)) {
      setError(fallback);
    }
  };

  const run = async (kind: Exclude<Busy, null>, fn: () => Promise<void>) => {
    // Still asked: the documents switch measures under `busy` without being a run of its own.
    if (busy) {
      return;
    }
    await runOnce(async () => {
      setBusy(kind);
      setError(null);
      setNotice(null);
      try {
        await fn();
      } finally {
        setBusy(null);
      }
    });
  };

  const onToggle = (next: boolean) => {
    haptics.selection();
    if (next) {
      void run('toggle', async () => {
        try {
          await controller.enable(t('backup.prompt.enable'));
          await refresh();
        } catch (err) {
          if (err instanceof BackupLockUnavailableError) {
            // Not an error message but an instruction: the user has to set a screen lock, and
            // "the backup could not be created" would never lead them there.
            setDialog('noLock');
            return;
          }
          report(err, t('backup.error'));
        }
      });
      return;
    }
    setDialog('disable');
  };

  const confirmDisable = () => {
    setDialog(null);
    void run('toggle', async () => {
      // Said, not left to reject with nothing to catch it (2026-09-24): the switch stays on, and so
      // does the password, so trying again is all there is to do.
      try {
        await controller.disable();
      } catch (err) {
        reportFailure('backup.snapshot', err, { stage: 'persist' });
        setError(t('backup.off.failed'));
        return;
      }
      setRevealed(null);
      setShowQr(false);
      await refresh();
    });
  };

  const onBackupNow = () =>
    run('backup', async () => {
      try {
        await controller.backupNow(t('backup.prompt.backup'));
        await refresh();
      } catch (err) {
        if (err instanceof BackupAbortedError) {
          // The user stopped it. Say so plainly - silence would read as "did it work?".
          setNotice(t('backup.cancelled'));
          return;
        }
        report(err, t('backup.error'));
      }
    });

  /**
   * Put this backup somewhere that survives the phone (T014).
   *
   * No OS prompt: the archive leaves exactly as sealed, so there is nothing to unlock. A dismissed
   * sheet says nothing at all - the user changed their mind, which is not a failure to report.
   */
  const onExport = (manifest: BackupManifest) =>
    run('file', async () => {
      try {
        if (await controller.exportBackup(manifest)) {
          snackbar.show({ message: t('backup.file.exported') });
        }
      } catch (err) {
        report(err, t('backup.error'));
      }
    });

  /** Take a backup file back in (T014). It then restores by the ordinary path, like any other. */
  const onImport = () =>
    run('file', async () => {
      try {
        const imported = await controller.importBackup();
        if (!imported) {
          return; // cancelled
        }
        await refresh();
        snackbar.show({ message: t('backup.file.imported') });
      } catch (err) {
        // `PortableFormatError` already carries a sentence written for a person - not ours, from a
        // newer build, damaged - and it is more useful than any generic line this screen could add.
        snackbar.show({
          message:
            err instanceof PortableFormatError
              ? err.message
              : t('backup.file.importFailed'),
        });
      }
    });

  /**
   * Open a backup for real and say what is in it (T013).
   *
   * Counts, not a checkmark: "verified" is the app vouching for itself, while "3 boxes, 412
   * messages" is something the user can hold against the phone in their hand.
   */
  const onVerify = (manifest: BackupManifest) =>
    run('verify', async () => {
      try {
        const r = await controller.verify(manifest, t('backup.prompt.reveal'));
        snackbar.show({ message: verifyText(r) });
      } catch (err) {
        if (err instanceof BackupCancelledError) {
          return; // the OS prompt was dismissed; nothing to say
        }
        // Stopped on the way out with "Zrušit ověřování", the person's own answer. The snackbar outlives
        // the screen, and it said "Zálohu se nepodařilo otevřít" about a backup nobody had finished
        // looking at (2026-09-15, review).
        if (err instanceof BackupAbortedError) {
          return;
        }
        snackbar.show({ message: t('backup.verify.failed') });
      }
    });

  const onReveal = () => {
    if (revealed) {
      setRevealed(null);
      setShowQr(false);
      return;
    }
    void run('reveal', async () => {
      try {
        setRevealed(await controller.revealKey(t('backup.prompt.reveal')));
      } catch (err) {
        report(err, t('backup.error'));
      }
    });
  };

  const onRestore = (manifest: BackupManifest, passphrase: string) =>
    run('restore', () => restoreWith(manifest, passphrase));

  /**
   * The restore itself, for a caller already inside a run - "use the key this phone holds" reveals the
   * key and restores as ONE run. Going through `run` again from inside one would be refused by the
   * very guard that run is holding.
   */
  const restoreWith = async (manifest: BackupManifest, passphrase: string) => {
    // Whether this screen says how it ended, as the controller asked when it ended: it keeps the
    // outcome, for the screen in view to say, only when the answer was no (2026-09-15, review).
    // Unasked for a restore that was stopped, which is only ever stopped on the way out.
    const said: { here?: boolean } = {};
    const seen = () => {
      said.here = seenHere();
      return said.here;
    };
    try {
      const done = await controller.restore(
        manifest,
        passphrase,
        t('backup.prompt.enable'),
        undefined,
        seen,
      );
      // Closed whether or not this screen says it. A restore that ended under the FAQ or the transfer
      // opened over this screen left the backup open, its password still typed in, beneath the dialog
      // saying it had worked (2026-09-15, review). Unmounted, these change nothing.
      setChosen(null);
      setTypedKey('');
      if (!said.here) {
        return;
      }
      setRestored(restoredText(done));
      await refresh();
    } catch (err) {
      if (!(said.here ?? seenHere())) {
        return;
      }
      setError(restoreErrorText(err));
    }
  };

  /**
   * Lowering the limit destroys backups THE MOMENT it is set, so it asks first.
   *
   * Nothing is saved until the answer comes back - including the optimistic UI update, so a picker
   * that is cancelled does not sit there showing a number that was never applied.
   */
  const requestKeep = (next: number) => {
    // A held backup is not deleted and takes none of the places the limit keeps (2026-09-15).
    const excess = backups.filter(b => !b.held).length - next;
    if (excess > 0) {
      setPendingKeep(next);
      return;
    }
    savePrefs({ keep: next });
  };

  /**
   * Optimistic: the switch moves at once, and the store catches up.
   *
   * When it does not, the screen says so and reads the store again, so the switch goes back to what
   * was actually saved. Until 2026-09-24 the rejection was caught by nothing: a lower limit whose
   * deletes failed left the old backups listed, the new number on the picker, and not a word. In the
   * snackbar, because the switches sit mid-screen and the error line is at its foot.
   */
  const savePrefs = (next: Partial<BackupPreferences>) => {
    haptics.selection();
    setPrefs(current => ({ ...current, ...next }));
    void controller.setPreferences(next).then(refresh, (err: unknown) => {
      reportFailure('backup.snapshot', err, { stage: 'persist' });
      // A new limit is stored before the older backups are deleted, so a failure with `keep` in it is
      // most likely a delete - which the next backup's retention tries again.
      snackbar.show({
        message: t(next.keep !== undefined ? 'backup.prune.failed' : 'backup.prefs.failed'),
      });
      return refresh();
    });
  };

  /**
   * The documents switch (006 T024).
   *
   * Turning it OFF is immediate and costs nothing: the objects already stored are left exactly where
   * they are, the same way switching backups off leaves the archives alone (Principle IV). Turning it
   * ON asks first, with a measured number in the question - "roughly 128 MB" is a decision somebody
   * can make, and a switch that silently starts writing gigabytes to their phone is not.
   */
  const onToggleDocuments = (next: boolean) => {
    if (!next) {
      savePrefs({ documents: false });
      return;
    }
    askDocuments(false);
  };

  /**
   * Which attachments (026 US1): only those on the phone, or all of them. Both counts are measured
   * before the question is shown, so each row can state what choosing it means.
   */
  const askDocuments = (changing: boolean) => {
    setBusy('documents');
    void Promise.all([controller.documentEstimate(), controller.missingEstimate()])
      .then(([estimate, missing]) => {
        setDocumentAsk({
          count: estimate.count,
          sealedBytes: estimate.sealedBytes,
          askable: missing.askable,
          gone: missing.gone,
          mode: prefs.documentMode,
          changing,
        });
      })
      .catch(err => {
        report(err, t('backup.error'));
      })
      .finally(() => {
        setBusy(null);
      });
  };

  const onRestorePressed = (manifest: BackupManifest) => {
    setError(null);
    setRestored(null);
    setChosen(chosen?.archiveName === manifest.archiveName ? null : manifest);
  };

  const startTypedRestore = (manifest: BackupManifest) => {
    const key = parseRecoveryKey(typedKey);
    if (!key) {
      setError(t('backup.restore.badKey'));
      return;
    }
    void onRestore(manifest, key);
  };

  const enabled = status?.enabled === true;
  /** A restore is running - this visit's, one an earlier visit left going, or a transfer's save. */
  const restoring = activeRun?.kind === 'restore' || busy === 'restore';
  /**
   * Not yet known - which is a THIRD state, and the reason this screen had a bug.
   *
   * `enabled` is a boolean, so before `status` arrives it reads false, and false rendered the whole
   * OFF screen: the "nothing is backed up" sentence, the switch sitting left, and every row below
   * hidden. Then the Keychain answered and it all flipped. A user with backups on was told, in a
   * complete sentence, that they had none. Loading is not "off" and must not be drawn as it.
   */
  const loading = status === null;
  /** The backups retention counts against the limit: all but the held ones. */
  const unheld = backups.filter(b => !b.held).length;
  /** A dialog, or the full-screen scanner, is already up - see the transfer's outcome dialog below. */
  const otherDialog =
    dialog !== null || pendingKeep != null || documentAsk != null || doomed != null || scanningKey;
  /** The restore outcome said, so the next one waiting is said in its place. */
  const dismissRestoreOutcome = () => setRestoreOutcomes(current => current.slice(1));

  /** The backups on this phone, each one restorable from here. */
  const restoreSection = (
    <Section
      label={t('backup.restore')}
      icon={<ClockIcon size={13} color={theme.textFaint} />}
    >
      <Card>
        {/* `backups` starts EMPTY, which is not the same as "there are none" - and the empty-state
          row says, in a sentence, that there is nothing to restore from. Shown while the list is
          still being read it is simply false, and false about the one thing this screen exists
          to promise. So the count is only trusted once it has actually been counted; until then
          the row is a placeholder shaped like a backup (a date over a size), one of them,
          because keeping ONE is the default and so the common resolved case. */}
        {loading ? (
          <CardRow last testID="backup-restore-loading">
            <LoadingLines widths={[150, 110]} label={t('backup.loading')} />
            <Skeleton
              color={theme.borderStrong}
              width={18}
              height={18}
              radius={9}
            />
          </CardRow>
        ) : backups.length === 0 ? (
          <CardRow last>
            <Caption
              flex={1}
              fontSize={13}
              color={theme.textFaint}
              testID="backup-none"
            >
              {t('backup.restore.none')}
            </Caption>
          </CardRow>
        ) : null}
        {backups.map((item, index) => {
          const open = chosen?.archiveName === item.manifest.archiveName;
          return (
            <YStack key={item.manifest.archiveName}>
              {/* Swipe to delete, the same gesture the message list uses - and the same one that
                asks before it destroys anything. A backup that cannot be deleted from the list
                is a list that only grows. */}
              <SwipeableRow
                // `CardRow` paints nothing - its colour comes from the `Card` behind it - so the
                // sliding row has to bring its own or the delete button shows through it.
                bodyBackground={theme.surface}
                testID={`backup-swipe-${index}`}
                onPress={
                  item.restorable
                    ? () => onRestorePressed(item.manifest)
                    : undefined
                }
                // The pressable's label is all a screen reader says for the row, so a held backup
                // says why it stays in it too, as the caption does (2026-09-15, review).
                accessibilityLabel={[
                  formatDateTime(item.manifest.createdAt),
                  documentsChipText(item.manifest),
                  documentsMissingText(item.manifest),
                  item.held ? t('backup.restore.held') : null,
                ]
                  .filter(Boolean)
                  .join(', ')}
                pressTestID={`backup-item-${index}`}
                rightAction={{
                  label: t('backup.delete'),
                  icon: <TrashIcon size={18} color={theme.onBlue} />,
                  color: theme.onBlue,
                  background: theme.danger,
                  onPress: () => setDoomed(item.manifest),
                  testID: `backup-delete-${index}`,
                }}
              >
                {/* `backup-row-N` is always here; `backup-item-N` is the PRESSABLE, which a
                  backup this build cannot read does not get. */}
                <CardRow
                  last={index === backups.length - 1 && !open}
                  testID={`backup-row-${index}`}
                >
                  <YStack flex={1} opacity={item.restorable ? 1 : 0.6}>
                    <XStack alignItems="center" gap={8}>
                      <RowTitle>
                        {formatDateTime(item.manifest.createdAt)}
                      </RowTitle>
                      <BackupDocumentsChip manifest={item.manifest} testID={`backup-docs-${index}`} />
                    </XStack>
                    <Caption
                      fontSize={12}
                      marginTop={1}
                      color={theme.textFaint}
                    >
                      {item.restorable
                        ? `${formatBytes(item.manifest.sizeBytes)} · ${
                            item.manifest.appVersion
                          }`
                        : item.compatibility.kind === 'tooNew'
                        ? t('backup.restore.tooNew')
                        : t('backup.restore.unsupported')}
                    </Caption>
                    {documentsMissingText(item.manifest) ? (
                      <Caption fontSize={12} marginTop={1} color={theme.textFaint}>
                        {documentsMissingText(item.manifest)}
                      </Caption>
                    ) : null}
                    {/* Why this one outlives the retention limit, for as long as it does (2026-09-15). */}
                    {item.held ? (
                      <Caption
                        fontSize={12}
                        marginTop={1}
                        color={theme.textFaint}
                        testID={`backup-held-${index}`}
                      >
                        {t('backup.restore.held')}
                      </Caption>
                    ) : null}
                  </YStack>
                  {item.restorable ? (
                    <ChevronRightIcon size={18} color={theme.textFaint} />
                  ) : null}
                </CardRow>
              </SwipeableRow>
              {open ? (
                <YStack
                  gap={10}
                  paddingHorizontal={14}
                  paddingVertical={12}
                  borderBottomWidth={index === backups.length - 1 ? 0 : 1}
                  borderBottomColor={theme.border}
                  backgroundColor={theme.surfaceAlt}
                >
                  <Input
                    value={typedKey}
                    onChangeText={setTypedKey}
                    placeholder={t('backup.restore.key.placeholder')}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    accessibilityLabel={t('backup.restore.key.placeholder')}
                    testID="backup-key-input"
                  />
                  {/* Showing the key as a QR has worked since T012a; READING one needs a
                      camera, which the app only gained for 025. Typing stays: the phone showing
                      the code may be the lost one. */}
                  {scanningAvailable() ? (
                    <PressScale
                      fullWidth
                      onPress={() => setScanningKey(true)}
                      accessibilityLabel={t('backup.restore.scan')}
                      testID="backup-scan-key"
                    >
                      <XStack
                        paddingVertical={8}
                        alignItems="center"
                        gap={8}
                      >
                        <CameraIcon size={15} color={theme.blue} />
                        <Body fontSize={13} fontWeight="600" color={theme.blue}>
                          {t('backup.restore.scan')}
                        </Body>
                      </XStack>
                    </PressScale>
                  ) : null}
                  <PressScale
                    fullWidth
                    onPress={() => startTypedRestore(item.manifest)}
                    // Busy while any restore runs, this visit's or one an earlier visit left
                    // going (2026-09-24): the button said "Pracuji…" over the earlier one and
                    // still started a second restore behind it, and a screen reader heard its
                    // own run as unavailable.
                    busy={restoring}
                    disabled={busy !== null}
                    accessibilityLabel={t('backup.restore.start')}
                    testID="backup-restore-start"
                  >
                    <XStack
                      width="100%"
                      minHeight={44}
                      borderRadius={12}
                      backgroundColor={theme.text}
                      alignItems="center"
                      justifyContent="center"
                    >
                      <BodyStrong fontSize={14} color={theme.surfaceAlt}>
                        {restoring ? t('backup.working') : t('backup.restore.start')}
                      </BodyStrong>
                    </XStack>
                  </PressScale>
                  {/* The same phone that made the backup already holds the password; making the
                    user copy it out of the card above and back in would be theatre. */}
                  <XStack
                    paddingVertical={6}
                    alignItems="center"
                    gap={6}
                    onPress={() => setDoomed(item.manifest)}
                    pressStyle={{ opacity: 0.6 }}
                    accessibilityRole="button"
                    accessibilityLabel={t('backup.delete')}
                    testID="backup-delete-open"
                  >
                    <TrashIcon size={15} color={theme.danger} />
                    <Body
                      fontSize={13}
                      fontWeight="600"
                      color={theme.danger}
                    >
                      {t('backup.delete')}
                    </Body>
                  </XStack>
                  {enabled ? (
                    <XStack
                      paddingVertical={6}
                      onPress={() => {
                        // The same restore as the button above, so it waits the same way.
                        if (restoring) {
                          return;
                        }
                        void run('restore', async () => {
                          try {
                            const key = await controller.revealKey(
                              t('backup.prompt.reveal'),
                            );
                            await restoreWith(item.manifest, key);
                          } catch (err) {
                            report(err, t('backup.restore.failed'));
                          }
                        });
                      }}
                      pressStyle={{ opacity: 0.6 }}
                      accessibilityRole="button"
                      accessibilityState={{ busy: restoring }}
                      testID="backup-use-stored-key"
                    >
                      <Body
                        fontSize={13}
                        fontWeight="600"
                        color={theme.blue}
                      >
                        {t('backup.restore.useStored')}
                      </Body>
                    </XStack>
                  ) : null}
                </YStack>
              ) : null}
            </YStack>
          );
        })}
      </Card>
    </Section>
  );

  // 025. Next to the file export, because they answer the same question - "how do I get this onto my
  // other phone?" - and a person comparing them should see both at once. Not gated on `enabled`: the
  // phone that RECEIVES has never had backup switched on. On a first run it is named from that phone's
  // side: "Přenést do jiného telefonu" is the wrong way round for the phone the archive is coming to.
  const transferTitle = firstRun ? t('transfer.receiveFrom') : t('transfer');
  const transferSection = onOpenTransfer ? (
    <Section
      label={transferTitle}
      icon={<BackupIcon size={13} color={theme.textFaint} />}
    >
      <Card>
        <CardRow
          last
          onPress={onOpenTransfer}
          accessibilityLabel={transferTitle}
          testID="backup-open-transfer"
        >
          <YStack flex={1}>
            <RowTitle>{transferTitle}</RowTitle>
            <Caption
              fontSize={12}
              lineHeight={16}
              marginTop={1}
              color={theme.textFaint}
            >
              {t('transfer.row.desc')}
            </Caption>
          </YStack>
          <ChevronRightIcon size={18} color={theme.textFaint} />
        </CardRow>
      </Card>
    </Section>
  ) : null;

  // T014. A backup that only lives in this app's storage dies with the phone, which is the event it
  // was made for. IMPORT is deliberately not gated on `enabled`: the phone that needs it most is a new
  // one, where backup has never been switched on and the archive is empty. EXPORT appears only once
  // there is something to export - and never on a first run, where the only backups are ones brought
  // in to be restored, so saving one back out is not what anybody there came for.
  const fileSection = (
    <Section
      label={t('backup.file')}
      icon={<BackupIcon size={13} color={theme.textFaint} />}
    >
      <Card>
        <CardRow last={false}>
          <Caption
            flex={1}
            fontSize={12}
            lineHeight={16}
            color={theme.textFaint}
          >
            {t(firstRun ? 'backup.file.desc.firstRun' : 'backup.file.desc')}
          </Caption>
        </CardRow>
        {!firstRun && !loading && status?.last ? (
          <CardRow
            last={false}
            onPress={() => void onExport(status.last as BackupManifest)}
            accessibilityLabel={t('backup.file.export')}
            testID="backup-export"
          >
            <Body flex={1} fontSize={13} fontWeight="600" color={theme.blue}>
              {t('backup.file.export')}
            </Body>
            <ChevronRightIcon size={16} color={theme.blue} />
          </CardRow>
        ) : null}
        <CardRow
          last
          onPress={() => void onImport()}
          accessibilityLabel={t('backup.file.import')}
          testID="backup-import"
        >
          <Body flex={1} fontSize={13} fontWeight="600" color={theme.blue}>
            {t('backup.file.import')}
          </Body>
          <ChevronRightIcon size={16} color={theme.blue} />
        </CardRow>
      </Card>
    </Section>
  );

  // The questions a tap opened close when the app leaves (2026-09-24). Each is a Modal, drawn in a
  // window above the cover the lock gate lays over the app, so one left open - leaving mid-run,
  // deleting a backup, lowering the limit - stayed above the lock screen on return. Closing is each
  // question's own "no": the limit and the documents keep their setting, nothing is deleted or
  // switched off, and a run the leave question was about goes on. What the app raised by itself - a
  // transfer's or a restore's outcome - waits for the unlock instead (`locked`), since nobody has
  // read it yet. So does a question that arrives while the app is covered: the documents question
  // opens only once the measuring has answered, and "no screen lock" once switching on has failed,
  // both after an await the app can leave during - and closing on leaving reaches only what is
  // already open. Every dialog below is drawn only while `!locked`.
  const closeQuestions = useCallback(() => {
    setDialog(null);
    setPendingKeep(null);
    setDocumentAsk(null);
    setDoomed(null);
  }, []);
  useCloseOnBackground(closeQuestions);

  return (
    // The dialogs sit OUTSIDE the SubScreen rather than among its scrollable children - a modal is
    // not page content, and it should not be able to scroll with the page behind it.
    <>

      {dialog === 'leave' && !locked ? (
        <Dialog
          title={leaveCopy(leaving).title}
          body={leaveCopy(leaving).body}
          onDismiss={() => setDialog(null)}
          testID="backup-leave-dialog"
          // The tested builder, not a copy of it inline: the copy is where a change to what "cancel"
          // does would go untested (2026-09-15).
          actions={leaveDialogActions({
            kind: leaving,
            close: () => setDialog(null),
            leave: onBack,
            cancelRun: controller.cancelRun,
            notStopped: () => snackbar.show({ message: t('backup.leave.notStopped') }),
          })}
        />
      ) : null}

      {dialog === 'disable' && !locked ? (
        <Dialog
          title={t('backup.off.title')}
          body={t('backup.off.body')}
          onDismiss={() => setDialog(null)}
          testID="backup-disable-dialog"
          actions={[
            {
              label: t('common.cancel'),
              testID: 'backup-disable-keep',
              onPress: () => setDialog(null),
            },
            {
              label: t('backup.off.confirm'),
              tone: 'danger',
              testID: 'backup-disable-confirm',
              onPress: confirmDisable,
            },
          ]}
        />
      ) : null}

      {pendingKeep != null && !locked ? (
        <Dialog
          title={t('backup.prune.title')}
          body={pruneBody(unheld - pendingKeep, pendingKeep, backups.length - unheld)}
          onDismiss={() => setPendingKeep(null)}
          testID="backup-prune-dialog"
          actions={pruneDialogActions({
            close: () => setPendingKeep(null),
            confirm: () => {
              const keep = pendingKeep;
              setPendingKeep(null);
              savePrefs({ keep });
            },
          })}
        />
      ) : null}

      {documentAsk && !locked ? (
        <Dialog
          title={t(documentAsk.changing ? 'backup.docs.change.title' : 'backup.docs.ask.title')}
          body={<DocumentModeChoice ask={documentAsk} onChange={mode => setDocumentAsk({ ...documentAsk, mode })} />}
          onDismiss={() => setDocumentAsk(null)}
          testID="backup-documents-dialog"
          actions={[
            {
              label: t('common.cancel'),
              testID: 'backup-documents-cancel',
              onPress: () => setDocumentAsk(null),
            },
            {
              label: t(documentAsk.changing ? 'backup.docs.ask.save' : 'backup.docs.ask.confirm'),
              tone: 'primary',
              testID: 'backup-documents-confirm',
              onPress: () => {
                const { mode } = documentAsk;
                setDocumentAsk(null);
                savePrefs({ documentMode: mode, documents: true });
              },
            },
          ]}
        />
      ) : null}

      {doomed && !locked ? (
        <Dialog
          title={t('backup.delete.title')}
          subtitle={formatDateTime(doomed.createdAt)}
          // Deleting a held backup is how it is let go, so the question says what goes with it.
          body={t(
            backups.some(b => b.held && b.manifest.archiveName === doomed.archiveName)
              ? 'backup.delete.body.held'
              : 'backup.delete.body',
          )}
          onDismiss={() => setDoomed(null)}
          testID="backup-delete-dialog"
          actions={deleteDialogActions({
            close: () => setDoomed(null),
            remove: () => {
              const target = doomed;
              setDoomed(null);
              void run('toggle', async () => {
                // A delete that failed rejected with nothing to catch it (2026-09-24), and the row
                // simply stayed. Said now; the list is read again either way, since a delete can
                // fail after the archive went and before its hold was let go.
                try {
                  await controller.deleteBackup(target.archiveName);
                  setNotice(t('backup.deleted'));
                } catch (err) {
                  reportFailure('backup.snapshot', err, { stage: 'persist' });
                  setError(t('backup.delete.failed'));
                }
                await refresh();
              });
            },
          })}
        />
      ) : null}

      {dialog === 'noLock' && !locked ? (
        <Dialog
          title={t('backup.noLock.title')}
          body={t('backup.noLock.body')}
          onDismiss={() => setDialog(null)}
          testID="backup-nolock-dialog"
          actions={[
            {
              label: t('common.ok'),
              tone: 'primary',
              testID: 'backup-nolock-ok',
              onPress: () => setDialog(null),
            },
          ]}
        />
      ) : null}
      {/* Held back while another dialog is open (2026-09-15). It is the one dialog here that is not
          opened by a tap, so it can arrive while another is up - and iOS presents one modal at a time,
          so a second one asked for then never appears. It is kept, and shown once that one closes. */}
      {/* And while the lock screen is up, like a restore's outcome below: a transfer that ended while
          the app was locked was said over it (2026-09-24). */}
      {transferOutcome && !otherDialog && !locked ? (
        <Dialog
          title={t('transfer.outcome.title')}
          body={
            transferOutcome.ok
              ? doneText(transferOutcome.applied)
              : errorText(transferOutcome.error)
          }
          onDismiss={() => setTransferOutcome(null)}
          testID="backup-transfer-outcome"
          actions={[
            {
              label: t('common.ok'),
              tone: 'primary',
              testID: 'backup-transfer-outcome-ok',
              onPress: () => setTransferOutcome(null),
            },
          ]}
        />
      ) : null}
      {/* How a restore ended that this screen did not see end (2026-09-15). Held back like the
          transfer's outcome, and after it when both are waiting: iOS presents one modal at a time.
          Held while the lock screen is up, too: a Modal draws above it, and a restore that ended
          while the app was locked was said over it (2026-09-15, review). It waits for the unlock. */}
      {restoreOutcomes.length > 0 && !otherDialog && !transferOutcome && !locked ? (
        <Dialog
          title={t('backup.restore.outcome.title')}
          body={
            restoreOutcomes[0].ok
              ? restoredText(restoreOutcomes[0].restored)
              : restoreErrorText(restoreOutcomes[0].error)
          }
          onDismiss={dismissRestoreOutcome}
          testID="backup-restore-outcome"
          actions={[
            {
              label: t('common.ok'),
              tone: 'primary',
              testID: 'backup-restore-outcome-ok',
              onPress: dismissRestoreOutcome,
            },
          ]}
        />
      ) : null}
      <SubScreen title={firstRun ? t('restore.title') : t('backup')} onBack={leave}>
        {firstRun ? (
          <>
            {transferSection}
            {fileSection}
            {restoreSection}
          </>
        ) : (
          <>
        <Section
          label={t('backup')}
          icon={<BackupIcon size={13} color={theme.textFaint} />}
        >
          <Card>
            <CardRow last={!enabled && !loading}>
              <YStack flex={1}>
                <RowTitle>{t('backup.toggle')}</RowTitle>
                {loading ? (
                  /* Three bars because the real copy runs to three lines at this width, so the row
                   keeps its height and the switch does not hop when the text replaces them
                   (constitution V). One label for the group: a screen reader should hear that the
                   answer is coming, not silence, and certainly not three anonymous blocks. */
                  <LoadingLines
                    widths={['96%', '88%', '52%']}
                    label={t('backup.loading')}
                    testID="backup-toggle-loading"
                  />
                ) : (
                  <Caption
                    fontSize={12}
                    lineHeight={15}
                    marginTop={1}
                    color={theme.textFaint}
                  >
                    {/* THREE states, three sentences. `enabled` comes first: with no password stored
                      there is no backup of any kind, so both of the other sentences are false - one
                      promises an automatic backup, the other points at a button this screen does not
                      render (see `enabled ?` on the "Zálohovat nyní" block below). A fourth state,
                      "not known yet", is handled above rather than folded in here - it is the one
                      case where saying nothing is the only honest thing to say. */}
                    {t(
                      !enabled
                        ? 'backup.toggle.desc.off'
                        : prefs.automatic
                        ? 'backup.toggle.desc'
                        : 'backup.toggle.desc.manual',
                    )}
                  </Caption>
                )}
              </YStack>
              {loading ? (
                /* The switch's own 48x28, so it does not move when the real one arrives. Drawing a
                 real Toggle here is what caused the bug: a switch has no "don't know" position, so
                 whichever way it points is a claim, and half the time it is the wrong one. */
                <Skeleton
                  color={theme.borderStrong}
                  width={48}
                  height={28}
                  radius={14}
                />
              ) : (
                <Toggle
                  value={enabled}
                  onChange={onToggle}
                  label={t('backup.toggle')}
                  disabled={busy !== null}
                  testID="backup-toggle"
                />
              )}
            </CardRow>
            {loading ? (
              <CardRow last>
                <Skeleton
                  color={theme.borderStrong}
                  width="58%"
                  height={13}
                  radius={6}
                />
              </CardRow>
            ) : enabled || activeRun ? (
              <CardRow last>
                {/* One row, two jobs: the last-backup line when idle, the live progress when not. Same
                  place, same metrics, so nothing below it moves when a run starts (constitution V). */}
                <YStack flex={1} gap={6}>
                  <XStack alignItems="center" gap={8}>
                    <Body
                      flex={1}
                      fontSize={13}
                      color={theme.textMuted}
                      testID="backup-last"
                    >
                      {activeRun
                        ? `${stageText(activeRun)}${
                            activeRun.progress.detail
                              ? ` · ${activeRun.progress.detail}`
                              : ''
                          }`
                        : status?.last
                        ? // "Backed up" means two different things once Tier 2 exists, and this
                          // line is where that stops being ambiguous (FR-008). Read from the
                          // MANIFEST, so a backup made before the switch was turned on still
                          // reports what it actually holds rather than what is switched on today.
                          status.last.tiers.documents && status.last.documentBytes != null
                          ? t('backup.last.documents', {
                              when: formatDateTime(status.last.createdAt),
                              size: formatBytes(status.last.sizeBytes),
                              docSize: formatBytes(status.last.documentBytes),
                            })
                          : t('backup.last', {
                              when: formatDateTime(status.last.createdAt),
                              size: formatBytes(status.last.sizeBytes),
                            })
                        : t('backup.never')}
                    </Body>
                    {activeRun ? (
                      <Value
                        fontSize={13}
                        color={theme.textFaint}
                        testID="backup-count"
                      >
                        {countLabel(activeRun.progress)}
                      </Value>
                    ) : null}
                  </XStack>
                  {/* The bar's 6px + the 6px gap are reserved whether or not it is drawn. */}
                  <YStack height={6} justifyContent="center">
                    {activeRun ? (
                      <ProgressBar
                        fraction={activeRun.progress.fraction}
                        label={stageText(activeRun)}
                        now={activeRun.progress.done}
                        total={activeRun.progress.total}
                        testID="backup-progress"
                      />
                    ) : null}
                  </YStack>
                </YStack>
              </CardRow>
            ) : null}
            {/* Directly under the line it checks. "Naposledy 09.09. · 2 kB" is the app vouching for
                itself from a manifest; this is the only control on the screen that opens the archive
                and finds out. Hidden until there IS one, so it never invites a check of nothing. */}
            {!loading && enabled && status?.last ? (
              <CardRow
                last
                onPress={() => void onVerify(status.last as BackupManifest)}
                accessibilityLabel={t('backup.verify')}
                testID="backup-verify"
              >
                <XStack alignItems="center" gap={8} flex={1}>
                  <ShieldKeyIcon size={15} color={theme.blue} />
                  <Body flex={1} fontSize={13} fontWeight="600" color={theme.blue}>
                    {busy === 'verify' ? t('backup.verify.busy') : t('backup.verify')}
                  </Body>
                </XStack>
                <ChevronRightIcon size={16} color={theme.blue} />
              </CardRow>
            ) : null}
          </Card>

          {enabled ? (
            <PressScale
              fullWidth
              onPress={onBackupNow}
              // Busy, not disabled, while a backup runs (2026-09-24, 023): a screen reader heard
              // "Pracuji…" as unavailable. Whenever the label says "Pracuji…" - its own run, or one
              // running without this screen (an automatic backup, one an earlier visit left going).
              // Another run of this screen's still disables it.
              busy={busy === 'backup' || activeRun?.kind === 'backup'}
              disabled={busy !== null}
              accessibilityLabel={t('backup.now')}
              testID="backup-now"
            >
              <XStack
                width="100%"
                minHeight={48}
                borderRadius={14}
                backgroundColor={theme.text}
                alignItems="center"
                justifyContent="center"
              >
                <BodyStrong fontSize={15} color={theme.surfaceAlt}>
                  {activeRun?.kind === 'backup' || busy === 'backup'
                    ? t('backup.working')
                    : t('backup.now')}
                </BodyStrong>
              </XStack>
            </PressScale>
          ) : null}
        </Section>

        {/* What is NOT in the backup, next to the switch that turns it on (FR-008). */}
        <Section
          label={t('backup.scope')}
          icon={<MailIcon size={13} color={theme.textFaint} />}
        >
          <Card>
            {/* The card's shape while the answer is still coming. Two of its four rows depend on
              state - the automatic-backup sentence exists only when backups are on, and the scope
              text sits beside it - so drawing the settled card early means assembling it in front
              of the user. Four groups, one per row, at the line counts the real copy takes. */}
            {loading ? (
              <>
                <CardRow last={false}>
                  <LoadingLines
                    widths={['97%', '93%', '61%']}
                    height={13}
                    label={t('backup.loading')}
                    testID="backup-scope-loading"
                  />
                </CardRow>
                <CardRow last={false}>
                  <LoadingLines widths={['90%', '44%']} />
                </CardRow>
                <CardRow last={false}>
                  <LoadingLines widths={['86%', '38%']} />
                </CardRow>
                <CardRow last>
                  <LoadingLines widths={['52%']} height={13} />
                </CardRow>
              </>
            ) : (
              <>
                <CardRow last={false}>
                  <Body
                    flex={1}
                    fontSize={13}
                    lineHeight={19}
                    color={theme.textMuted}
                  >
                    {/* Two sentences for two states. One sentence covering both would be false in
                      one of them - and it is the exact sentence somebody reads to decide. */}
                    {t(
                      prefs.documents
                        ? 'backup.scope.desc.documents'
                        : 'backup.scope.desc',
                    )}
                  </Body>
                </CardRow>
                {/* The switch that changes the sentence above, right under it. Hidden entirely where
                  the destination cannot hold documents: a control that can do nothing is worse than
                  no control. */}
                {status?.documentsPossible ? (
                  <CardRow last={false}>
                    <YStack flex={1}>
                      <RowTitle>{t('backup.docs.title')}</RowTitle>
                      <Caption
                        fontSize={12}
                        lineHeight={15}
                        marginTop={1}
                        color={theme.textFaint}
                      >
                        {busy === 'documents'
                          ? t('backup.docs.measuring')
                          : t(
                              prefs.documents
                                ? `backup.docs.desc.on.${prefs.documentMode}`
                                : 'backup.docs.desc.off',
                            )}
                      </Caption>
                    </YStack>
                    <Toggle
                      value={prefs.documents}
                      onChange={onToggleDocuments}
                      label={t('backup.docs.title')}
                      disabled={busy !== null}
                      testID="backup-documents-toggle"
                    />
                  </CardRow>
                ) : null}
                {/* The mode, and the way to change it, while attachments are on (026 US1). */}
                {status?.documentsPossible && prefs.documents ? (
                  <CardRow
                    last={false}
                    onPress={busy === null ? () => askDocuments(true) : undefined}
                    accessibilityLabel={`${t('backup.docs.which')}: ${t(
                      `backup.docs.mode.${prefs.documentMode}`,
                    )}. ${t('backup.docs.change')}`}
                    testID="backup-documents-mode"
                  >
                    <YStack flex={1}>
                      <RowTitle>{t('backup.docs.which')}</RowTitle>
                      <Caption fontSize={12} lineHeight={15} marginTop={1} color={theme.textFaint}>
                        {t(`backup.docs.mode.${prefs.documentMode}`)}
                      </Caption>
                    </YStack>
                    <Body fontSize={14} fontFamily={fonts.bodySemiBold} fontWeight="600" color={theme.blue}>
                      {t('backup.docs.change')}
                    </Body>
                  </CardRow>
                ) : null}
                {/* Only this row is hidden while backups are off - both of its sentences point at
              controls that are not on screen then. The scope text around it stays: someone deciding
              whether to switch backups ON is exactly who needs to read what a backup does and does
              not contain (FR-008). */}
                {enabled ? (
                  <CardRow last={false}>
                    <Caption
                      flex={1}
                      fontSize={12}
                      lineHeight={16}
                      color={theme.textFaint}
                    >
                      {t(prefs.automatic ? 'backup.auto' : 'backup.auto.off')}
                    </Caption>
                  </CardRow>
                ) : null}
                <CardRow last={false}>
                  <Caption
                    flex={1}
                    fontSize={12}
                    lineHeight={16}
                    color={theme.textFaint}
                  >
                    {t('backup.where')}
                  </Caption>
                </CardRow>
                {/* The algorithms, the parameters and what losing the password costs - one tap away, the
              same way the attachment scan explains itself. A settings row is not the place for a
              cipher name, but the full account has to exist somewhere findable. */}
                <CardRow
                  last
                  onPress={() => onOpenFaq('backupEncryption')}
                  accessibilityLabel={t('backup.how')}
                  testID="backup-how"
                >
                  <XStack alignItems="center" gap={8} flex={1}>
                    <HelpIcon size={15} color={theme.blue} />
                    <Body
                      flex={1}
                      fontSize={13}
                      fontWeight="600"
                      color={theme.blue}
                    >
                      {t('backup.how')}
                    </Body>
                  </XStack>
                  <ChevronRightIcon size={16} color={theme.blue} />
                </CardRow>
              </>
            )}
          </Card>
        </Section>

        {enabled ? (
          <Section
            label={t('backup.key')}
            icon={<ShieldKeyIcon size={13} color={theme.textFaint} />}
          >
            <Card>
              <CardRow last={false}>
                <Body
                  flex={1}
                  fontSize={13}
                  lineHeight={19}
                  color={theme.textMuted}
                >
                  {t('backup.key.desc')}
                </Body>
              </CardRow>
              {revealed ? (
                <CardRow last={false}>
                  {/* Big and widely spaced: this gets copied onto paper by hand, and the groups of
                    four are what make that possible. No monospace face is bundled, so the spacing
                    does the work the font would. */}
                  <Body
                    flex={1}
                    fontFamily={fonts.bodySemiBold}
                    fontWeight="600"
                    fontSize={17}
                    letterSpacing={1.5}
                    color={theme.text}
                    selectable
                    testID="backup-key"
                  >
                    {revealed}
                  </Body>
                </CardRow>
              ) : null}
              <CardRow
                last={!revealed}
                onPress={onReveal}
                accessibilityLabel={
                  revealed ? t('backup.key.hide') : t('backup.key.show')
                }
                testID="backup-reveal"
              >
                <Body
                  flex={1}
                  fontSize={14}
                  fontWeight="600"
                  color={theme.blue}
                >
                  {busy === 'reveal'
                    ? t('backup.working')
                    : revealed
                    ? t('backup.key.hide')
                    : t('backup.key.show')}
                </Body>
                <ChevronRightIcon size={16} color={theme.blue} />
              </CardRow>
              {revealed ? (
                <CardRow
                  last
                  onPress={() => setShowQr(v => !v)}
                  accessibilityLabel={
                    showQr ? t('backup.key.qr.hide') : t('backup.key.qr')
                  }
                  testID="backup-qr-toggle"
                >
                  <Body
                    flex={1}
                    fontSize={14}
                    fontWeight="600"
                    color={theme.blue}
                  >
                    {showQr ? t('backup.key.qr.hide') : t('backup.key.qr')}
                  </Body>
                  <ChevronRightIcon size={16} color={theme.blue} />
                </CardRow>
              ) : null}
            </Card>
            {revealed && showQr ? (
              <YStack alignItems="center" gap={10} paddingVertical={14}>
                <QrCode
                  value={encodeKeyQr(revealed)}
                  size={240}
                  accessibilityLabel={t('backup.key.qr.label')}
                  testID="backup-qr"
                />
                <Caption
                  fontSize={12}
                  color={theme.textFaint}
                  textAlign="center"
                >
                  {t('backup.key.qr.hint')}
                </Caption>
              </YStack>
            ) : null}
          </Section>
        ) : null}

        {enabled ? (
          <Section
            label={t('backup.advanced')}
            icon={<TuneIcon size={13} color={theme.textFaint} />}
          >
            {/* Collapsed by default. Everything under here has a sensible default, so a user who never
              opens it still gets the right behaviour - which is the only way "advanced" earns its
              place on a screen this small. */}
            <Card>
              <CardRow
                last={!advanced}
                onPress={() => setAdvanced(v => !v)}
                accessibilityLabel={t('backup.advanced')}
                testID="backup-advanced-toggle"
              >
                <RowTitle flex={1}>{t('backup.advanced')}</RowTitle>
                {advanced ? (
                  <ChevronDownIcon size={18} color={theme.textFaint} />
                ) : (
                  <ChevronRightIcon size={18} color={theme.textFaint} />
                )}
              </CardRow>

              {advanced ? (
                <>
                  <CardRow last={false}>
                    <YStack flex={1}>
                      <RowTitle>{t('backup.auto.title')}</RowTitle>
                      <Caption
                        fontSize={12}
                        lineHeight={15}
                        marginTop={1}
                        color={theme.textFaint}
                      >
                        {t('backup.auto.desc')}
                      </Caption>
                    </YStack>
                    <Toggle
                      value={prefs.automatic}
                      onChange={next => savePrefs({ automatic: next })}
                      label={t('backup.auto.title')}
                      testID="backup-auto-toggle"
                    />
                  </CardRow>

                  <CardRow last={prefs.keep <= 1}>
                    <YStack flex={1}>
                      <RowTitle>{t('backup.keep.title')}</RowTitle>
                      <Caption
                        fontSize={12}
                        lineHeight={15}
                        marginTop={1}
                        color={theme.textFaint}
                      >
                        {t('backup.keep.desc')}
                      </Caption>
                    </YStack>
                    <Toggle
                      value={prefs.keep > 1}
                      // Off means one. On means the smallest useful "more than one", and the picker
                      // below appears to change it - no number to choose before saying yes.
                      // Turning it OFF is a drop to one, which deletes exactly as much as picking "1"
                      // would - so it goes through the same question.
                      onChange={next =>
                        next ? savePrefs({ keep: 3 }) : requestKeep(1)
                      }
                      label={t('backup.keep.title')}
                      testID="backup-keep-toggle"
                    />
                  </CardRow>

                  {prefs.keep > 1 ? (
                    <YStack
                      gap={8}
                      paddingHorizontal={14}
                      paddingVertical={12}
                      backgroundColor={theme.surfaceAlt}
                    >
                      <Caption fontSize={12} color={theme.textFaint}>
                        {t('backup.keep.count')}
                      </Caption>
                      <SegmentedControl
                        value={String(prefs.keep)}
                        onChange={key => requestKeep(Number(key))}
                        testID="backup-keep-count"
                        segments={Array.from(
                          { length: MAX_KEEP - 1 },
                          (_, i) => ({
                            key: String(i + 2),
                            label: String(i + 2),
                          }),
                        )}
                      />
                    </YStack>
                  ) : null}
                </>
              ) : null}
            </Card>
          </Section>
        ) : null}

        {restoreSection}
        {transferSection}
        {fileSection}
          </>
        )}

        {restored ? (
          <XStack
            alignItems="center"
            gap={8}
            paddingHorizontal={4}
            paddingBottom={10}
          >
            <CheckIcon size={16} color={theme.success} />
            <Body
              flex={1}
              fontSize={13}
              color={theme.textMuted}
              testID="backup-restored"
            >
              {restored}
            </Body>
          </XStack>
        ) : null}
        {notice ? (
          <Body
            fontSize={13}
            paddingHorizontal={4}
            paddingBottom={10}
            color={theme.textMuted}
            testID="backup-notice"
          >
            {notice}
          </Body>
        ) : null}
        {error ? (
          <Body
            fontSize={13}
            paddingHorizontal={4}
            color={theme.danger}
            testID="backup-error"
          >
            {error}
          </Body>
        ) : null}
        {/* Last, so it moves nothing when it arrives: nothing is below it. */}
        {firstRun && onContinue ? (
          <ContinueButton onPress={onContinue} testID="backup-continue" />
        ) : null}
      </SubScreen>
      {/* After the page, so it is drawn over it: placed before, the page covered the viewfinder while
          the camera ran behind it (2026-09-24). */}
      {scanningKey ? (
        <TransferCodeScanner
          parse={parseKeyQr}
          hint={t('backup.restore.scan.hint')}
          onCancel={() => setScanningKey(false)}
          onFound={key => {
            setScanningKey(false);
            // Into the field, NOT straight into a restore. A scanned key is still a key the user
            // should see before it is used - the same rule 021 follows for an SMS code, and for the
            // same reason: a misread that acts on itself spends an attempt nobody gets back.
            setTypedKey(key);
          }}
        />
      ) : null}
    </>
  );
}

/**
 * The body of "Zálohovat i přílohy?" (026 US1): the two modes as radio rows, each with what choosing it
 * means in numbers, and under them what the selected one does.
 */
function DocumentModeChoice({
  ask,
  onChange,
}: {
  readonly ask: {
    count: number;
    sealedBytes: number;
    askable: number;
    gone: number;
    mode: BackupDocumentMode;
  };
  readonly onChange: (mode: BackupDocumentMode) => void;
}) {
  const theme = useTheme();
  const explain =
    ask.mode === 'downloaded'
      ? [t('backup.docs.mode.downloaded.explain')]
      : [
          t('backup.docs.mode.all.explain'),
          ask.gone > 0 ? t(`backup.docs.mode.all.gone.${plural(ask.gone)}`, { n: ask.gone }) : null,
          t('backup.docs.mode.all.wifi'),
        ];
  return (
    <YStack gap={12}>
      <OptionGroup<BackupDocumentMode>
        value={ask.mode}
        onChange={onChange}
        testIDPrefix="backup-documents-mode"
        options={[
          {
            value: 'downloaded',
            label: t('backup.docs.mode.downloaded'),
            description:
              ask.count === 0
                ? t('backup.docs.mode.downloaded.none')
                : t('backup.docs.mode.downloaded.count', {
                    count: t(`backup.count.files.${plural(ask.count)}`, { n: ask.count }),
                    size: formatBytes(ask.sealedBytes),
                  }),
          },
          {
            value: 'all',
            label: t('backup.docs.mode.all'),
            description:
              ask.askable === 0
                ? t('backup.docs.mode.all.complete')
                : t(`backup.docs.mode.all.count.${plural(ask.askable)}`, { n: ask.askable }),
          },
        ]}
      />
      {explain.filter(Boolean).map(line => (
        <Caption key={line} fontSize={14} lineHeight={20} color={theme.textMuted}>
          {line}
        </Caption>
      ))}
    </YStack>
  );
}
