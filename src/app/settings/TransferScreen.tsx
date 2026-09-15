// Moving the archive to another phone (025), the whole feature as one screen.
//
// Everything it can do goes through `TransferController`, so this file holds no crypto, no phrase
// generation and no restore rules. What it decides is what to SHOW, and four of those matter:
//
//   * WHERE THE MAIL IS GOING, said while it is going (FR-007). Three states, not two: until a route
//     is negotiated the honest answer is "working it out", and the device run proved why that
//     matters - the flag said "relayed" while the bytes went straight to a private address.
//   * NOTHING IS SAVED UNTIL IT IS AGREED TO (FR-004). The receiving side fetches, then stops and
//     shows a date and a size. The archive is only touched after a second tap.
//   * THE BOXES STILL NEED SIGNING IN TO (FR-011). Said at the end, because that is where somebody
//     stands who thinks the job is finished.
//   * IT ONLY RUNS WHILE SOMEBODY IS WATCHING (FR-014). Leaving the app stops the transfer, and the
//     reason is on screen when the user comes back.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { XStack, YStack, Input } from '../../theme/ui';
import { Body, BodyStrong, Caption } from '../../theme/Typography';
import { ProgressBar } from '../../theme/ProgressBar';
import { Dialog } from '../../theme/Dialog';
import { QrCode } from '../../theme/QrCode';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts } from '../../theme/typography';
import { BackupIcon, CameraIcon, CloseIcon, ShieldKeyIcon } from '../../theme/icons';
import { plural, t } from '../../i18n/strings';
import { haptics } from '../../services/haptics';
import { SubScreen } from './SubScreen';
import { Card, CardRow, RowTitle, Section } from './SettingsSection';
import type {
  AppliedTransfer,
  ApplyOutcome,
  TransferController,
  TransferContents,
  ReceivedTransfer,
} from '../../features/transfer/state/transferController';
import type { BackupProgress } from '../../services/backup/progress';
import {
  PhraseRefusedError,
  TRANSFER_RELAY,
  TransferBackupGoneError,
  TransferBusyError,
  TransferUnavailableError,
  type TransferProgress,
} from '../../services/transfer/transport';
import { parseCodePhrase } from '../../services/transfer/codePhrase';
import {
  METERED_ASK_BYTES,
  isMetered,
} from '../../services/transfer/connection';
import { encodeTransferQr } from '../../services/transfer/transferQr';
import {
  TransferCodeScanner,
  scanningAvailable,
} from '../../features/transfer/screens/CodeScanner';
import type { BackupManifest } from '../../services/backup/schema';
import { useSingleFlight } from '../useSingleFlight';
import { ContinueButton } from './ContinueButton';
import { OptionGroup } from '../../theme/OptionGroup';
import {
  BackupDocumentsChip,
  documentsChipText,
  documentsMissingText,
} from './BackupDocumentsChip';

const pad = (n: number) => String(n).padStart(2, '0');

function formatDateTime(epochMs: number): string {
  const d = new Date(epochMs);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
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

/** Which of the three honest things to say about the route (FR-007). */
export function routeKey(relayed: boolean | null): string {
  if (relayed === null) {
    return 'transfer.route.unknown';
  }
  return relayed ? 'transfer.route.relayed' : 'transfer.route.direct';
}

/** The route sentence itself, with the relay NAMED rather than described (US3 scenario 2). */
export function routeText(relayed: boolean | null): string {
  return t(routeKey(relayed), { host: TRANSFER_RELAY.host, host6: TRANSFER_RELAY.host6 });
}

/**
 * The longest of the three route sentences, laid out invisibly to hold the route line's height.
 *
 * The line starts as one short sentence and becomes the relayed one - four lines on a phone, and
 * longer since it names its hosts - the moment a route is known, which is mid-transfer. Everything
 * under it moved when it did, the cancel row included, under a thumb that may be about to press it
 * (constitution V). Measured by length, which is a fair stand-in here: in both languages the relayed
 * sentence is about three times either of the others. The note drawn in the same place while what
 * arrived is being saved is measured with them, so it can never be the sentence that overflows.
 */
export function routeReserveText(): string {
  const candidates = [
    ...([null, false, true] as const).map(relayed => routeText(relayed)),
    t('transfer.applying.note'),
  ];
  return candidates.reduce((longest, next) => (next.length > longest.length ? next : longest));
}

/**
 * Boxes, messages and documents as one counted list (US1).
 *
 * The same words in the same order on the phone that sends and the phone that receives, because the
 * point of both counts is to be read against each other.
 */
export function countList(
  boxes: number | null,
  messages: number | null,
  documents: number | null,
): string {
  return [
    boxes == null ? null : t(`backup.count.boxes.${plural(boxes)}`, { n: boxes }),
    messages == null ? null : t(`backup.count.messages.${plural(messages)}`, { n: messages }),
    documents == null
      ? null
      : t(`transfer.count.documents.${plural(documents)}`, { n: documents }),
  ]
    .filter(Boolean)
    .join(', ');
}

/** Under the phrase: what is about to go, counted where it could be counted, and the size always. */
export function contentsText(contents: TransferContents | null, sizeBytes: number): string {
  const size = formatBytes(sizeBytes);
  const counted =
    contents != null &&
    (contents.boxes != null || contents.messages != null || contents.documents != null);
  return counted
    ? t('transfer.phrase.contents', {
        what: countList(contents.boxes, contents.messages, contents.documents),
        size,
      })
    : t('transfer.phrase.size', { size });
}

/**
 * The receiving phone's last word (US1 scenarios 3 and 5, FR-011).
 *
 * Documents are counted with the rest. The ones the backup named and that did not land - not in what
 * arrived, unreadable, or with no message left to belong to - are said as a number rather than left
 * for the user to discover as a difference between the two phones.
 */
export function doneText(restored: AppliedTransfer): string {
  const messages = restored.messagesAdded + restored.messagesMerged;
  const boxes = restored.accountsAdded + restored.accountsKept;
  const documents = restored.documents;
  const lost =
    (documents?.missing ?? 0) + (documents?.failed ?? 0) + (documents?.orphaned ?? 0);
  return [
    t('transfer.done', { what: countList(boxes, messages, documents?.restored ?? 0) }),
    lost > 0 ? t(`transfer.done.missing.${plural(lost)}`, { n: lost }) : null,
    // The archive is saved either way, but the password that came with it was not kept, so backups on
    // this phone may be off. Said, so nobody believes the new phone is backing up when it is not.
    restored.keysFailed ? t('transfer.done.keyNotSaved') : null,
    t('transfer.done.signIn'),
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * The sentence for a transfer that did not finish (FR-006), so the outcomes stay told apart whichever
 * way the failure reaches the screen: from a run it started, or from a save it found running.
 */
export function errorText(e: unknown): string {
  if (e instanceof PhraseRefusedError) {
    return t('transfer.error.phrase');
  }
  if (e instanceof TransferUnavailableError) {
    return t('transfer.unavailable');
  }
  if (e instanceof TransferBusyError) {
    return t('transfer.error.busy');
  }
  if (e instanceof TransferBackupGoneError) {
    return t('transfer.error.gone');
  }
  return t('transfer.error.failed');
}

type Mode = 'idle' | 'sending' | 'receiving';

export function TransferScreen({
  onBack,
  controller,
  backups,
  onOpenBackup,
  onBackupsStale,
  inView = true,
  receiveOnly = false,
  onContinue,
}: {
  readonly onBack: () => void;
  readonly controller: TransferController;
  /**
   * Opened on a phone with no boxes, from Welcome (2026-09-24): it can only be the phone the archive
   * comes TO, so the send half - which would only say there is no backup to send - is left out.
   */
  readonly receiveOnly?: boolean;
  /** The way on once what arrived has brought boxes onto the phone. The shell passes it only then. */
  readonly onContinue?: () => void;
  /**
   * The backups this phone holds, any order; null while they are being read (026 US3). The person picks
   * which one goes - nothing is backed up here.
   */
  readonly backups: readonly BackupManifest[] | null;
  /** "Vytvořit zálohu", where no backup exists yet: back to the backup screen. */
  readonly onOpenBackup?: () => void;
  /** The chosen backup turned out to be gone: read the list again. */
  readonly onBackupsStale?: () => void;
  /**
   * Whether this screen is the one in view. False from the moment it is left, while it is still
   * mounted for the transition out. Absent means it is.
   */
  readonly inView?: boolean;
}) {
  const theme = useTheme();
  const [mode, setMode] = useState<Mode>('idle');
  /** Newest first, which is also the one chosen until the person picks another. */
  const sorted = backups ? [...backups].sort((a, b) => b.createdAt - a.createdAt) : null;
  const [chosenName, setChosenName] = useState<string | null>(null);
  const chosen =
    sorted?.find(b => b.archiveName === chosenName) ?? sorted?.[0] ?? null;
  /** The backup the running send is sending, for the line under the phrase. */
  const [sendingManifest, setSendingManifest] = useState<BackupManifest | null>(null);
  const [phrase, setPhrase] = useState<string | null>(null);
  const [sizeBytes, setSizeBytes] = useState(0);
  const [contents, setContents] = useState<TransferContents | null>(null);
  /**
   * Saving what arrived into the archive: local work, not a transfer, and not cancellable (025 review,
   * 2026-09-15). The rows are written in one transaction and the documents after it, so a stop in
   * between would leave messages without their documents - which FR-012 rules out.
   */
  const [applying, setApplying] = useState(false);
  const [applyProgress, setApplyProgress] = useState<BackupProgress | null>(null);
  /**
   * A save this screen did not start is still running: the screen was left during one and opened
   * again. It owns nothing of that run, so all it can do is show it and wait it out.
   */
  const [waitingForApply, setWaitingForApply] = useState(() => controller.isApplying());
  const [typed, setTyped] = useState('');
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const [got, setGot] = useState<ReceivedTransfer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [cancel, setCancel] = useState({ cancelled: false });
  const [scanning, setScanning] = useState(false);
  /** A send held back until the mobile-data question is answered (FR-008). */
  const [meteredAsk, setMeteredAsk] = useState<number | null>(null);

  // Double taps (audit 2026-09-23). `mode` and `got` are what the screen DRAWS, but state lands a
  // render late and a double tap delivers both presses before it: two sends, two receives, or the
  // received transfer confirmed twice - the second of which the controller refused as busy, and the
  // refusal reset the screen while the first save carried on under it. So each of these is also held
  // in a ref, claimed in the tap itself.
  /** "Odeslat z tohoto telefonu", across the connection check it awaits before a run exists. */
  const sendOnce = useSingleFlight();
  /** A run has been started and the screen has not gone back to idle since - what `mode` will say. */
  const started = useRef(false);
  /** The received transfer still waiting for its answer. Taken by the first answer, so only one lands. */
  const awaitingAnswer = useRef<ReceivedTransfer | null>(null);

  const available = controller.available();

  const reset = useCallback(() => {
    started.current = false;
    awaitingAnswer.current = null;
    setMode('idle');
    setPhrase(null);
    setContents(null);
    setProgress(null);
    setGot(null);
    setApplying(false);
    setApplyProgress(null);
    setTyped('');
    setCancel({ cancelled: false });
  }, []);

  useEffect(() => reset, [reset]);

  /**
   * Stop the run in flight and let go of what it staged. One path for the cancel button and for
   * leaving the app, so the two cannot drift apart.
   */
  const stopRun = useCallback(
    (signal: { cancelled: boolean }) => {
      signal.cancelled = true;
      // The staged copy goes with it. A cooperative cancel may never let the send's own cleanup run,
      // and what is staged is the user's sealed archive.
      void controller.abandon();
      reset();
    },
    [controller, reset],
  );

  /**
   * Bytes are moving, or about to: an offer from staging to the last byte taken, a receive until what
   * arrived is on screen. Not the question that follows and not the save - nothing is on the network
   * then, and the save cannot be stopped part-way (see `applying`).
   */
  const inFlight =
    mode === 'sending' || (mode === 'receiving' && got === null && !applying);
  const inFlightSignal = useRef<{ cancelled: boolean } | null>(null);
  inFlightSignal.current = inFlight ? cancel : null;

  /** Saving what arrived, whether this screen started the save or found it running. */
  const saving = applying || waitingForApply;

  /** Whether this screen is still open, for a save whose end can arrive after it was left. */
  const onScreen = useRef(true);
  useEffect(() => {
    onScreen.current = true;
    return () => {
      onScreen.current = false;
    };
  }, []);
  // Read when the save ends, not when it starts. Left, the screen is out of view at once but stays
  // mounted for the transition out, and a save that ended in that moment was taken here and said on a
  // screen nobody could see any more, instead of on the backup screen now in view (2026-09-15).
  const inViewNow = useRef(inView);
  inViewNow.current = inView;
  /** Whether a save's end is this screen's to say, or the controller's to keep for the next screen. */
  const seenHere = () => onScreen.current && inViewNow.current;

  /** How a save ended, in the words the screen that started it uses. */
  const showOutcome = useCallback((outcome: ApplyOutcome) => {
    if (outcome.ok) {
      haptics.success();
      setError(null);
      setDone(doneText(outcome.applied));
    } else {
      setDone(null);
      setError(errorText(outcome.error));
    }
  }, []);

  // Opened again while a save it started earlier is still running (025 review, 2026-09-15). Offering a
  // new transfer then would sweep the files that save is still reading, so the screen shows the save
  // and offers the choice again once it is done - saying how it ended, as the screen that started it
  // would have. Going quietly back to the buttons left the user guessing whether their mail arrived.
  useEffect(() => {
    if (!waitingForApply) {
      return undefined;
    }
    let mounted = true;
    void controller.whenApplied().then(outcome => {
      // Out of view, it is the next screen's to say (see `inViewNow`).
      if (!mounted || !inViewNow.current) {
        return;
      }
      setWaitingForApply(false);
      // Taken, so no other screen says it a second time.
      controller.takeOutcome();
      if (outcome) {
        showOutcome(outcome);
      }
    });
    return () => {
      mounted = false;
    };
  }, [controller, waitingForApply, showOutcome]);

  // Opened again AFTER a save ended with no transfer screen open to say how (025 review, 2026-09-15). It
  // was said nowhere; it is said here, where it would have been. A save still running is the effect
  // above's to report.
  useEffect(() => {
    if (!controller.isApplying()) {
      const left = controller.takeOutcome();
      if (left) {
        showOutcome(left);
      }
    }
  }, [controller, showOutcome]);

  // FR-014 stops a transfer when the app is paused, and Android pauses it when the display times out,
  // so every transfer longer than the timeout stopped by itself. The display stays on while one is
  // live - an offer until the other phone has it, a receive until what arrived is on screen, and the
  // save - and is let go on every way out: done, failed, cancelled, or the screen left (the cleanup).
  const live = inFlight || saving;
  useEffect(() => {
    if (!live) {
      return undefined;
    }
    controller.keepScreenOn(true);
    return () => controller.keepScreenOn(false);
  }, [controller, live]);

  // FR-014. The transfer is foreground work somebody is watching, and this app does none in the
  // background (014). Leaving the app stops it through the same path as the button, and the sentence
  // saying why is waiting when the user comes back: a transfer that had quietly stopped existing would
  // be the pretending the spec rules out.
  //
  // `background` rather than anything but `active`: iOS goes `inactive` for a pulled-down
  // notification centre or a system alert while the app is still on screen, and a transfer should not
  // die of that. Leaving for real always reaches `background`, and Android only reports those two.
  useEffect(() => {
    if (!inFlight) {
      return undefined;
    }
    const leave = () => {
      stopRun(cancel);
      setDone(null);
      setError(t('transfer.stopped.background'));
    };
    // A run can start in the instant the app is already on its way out - a scanned code landing as
    // the home button is pressed - and then no change event is ever coming.
    if (AppState.currentState === 'background') {
      leave();
      return undefined;
    }
    const sub = AppState.addEventListener('change', next => {
      if (next === 'background') {
        leave();
      }
    });
    return () => sub.remove();
  }, [inFlight, cancel, stopRun]);

  // Leaving the SCREEN mid-run is leaving too. Unmounted, nothing here would hear the app go to the
  // background, and the native side would carry on with nobody watching it.
  useEffect(
    () => () => {
      const signal = inFlightSignal.current;
      if (signal) {
        signal.cancelled = true;
        void controller.abandon();
      }
    },
    [controller],
  );

  /** Every failure funnels through here so the three outcomes stay told apart (FR-006). */
  const report = (e: unknown) => {
    setError(errorText(e));
  };

  /** Everything the send does once it is allowed to. */
  const startSend = () => {
    const manifest = chosen;
    if (!manifest || started.current) {
      return;
    }
    started.current = true;
    setError(null);
    setDone(null);
    const signal = { cancelled: false };
    setCancel(signal);
    setMode('sending');
    setSendingManifest(manifest);
    // Every result below is dropped once the run was stopped. The screen has already said why and
    // moved on - possibly to a newer run, whose state a late event from this one must not overwrite.
    void controller
      .offer(
        manifest,
        p => {
          if (!signal.cancelled) {
            setProgress(p);
          }
        },
        signal,
      )
      .then(offer => {
        if (!signal.cancelled) {
          setPhrase(offer.phrase);
          setSizeBytes(offer.sizeBytes);
          setContents(offer.contents);
        }
        return offer.done;
      })
      .then(() => {
        if (signal.cancelled) {
          return;
        }
        haptics.success();
        reset();
        setDone(t('transfer.done.signIn'));
      })
      .catch(e => {
        if (signal.cancelled) {
          return;
        }
        report(e);
        reset();
        if (e instanceof TransferBackupGoneError) {
          // Chosen, then deleted - by retention after a newer backup, most likely. The list is read
          // again so the choice offered is one that exists (026 FR-007).
          setChosenName(null);
          onBackupsStale?.();
        }
      });
  };

  const onSend = () => {
    if (!chosen) {
      return;
    }
    // The total is in the MANIFEST - archive plus documents - so the question can be asked before a
    // byte is staged, let alone sent. FR-008's size half is satisfied on the next screen regardless;
    // this is the half about not spending somebody's mobile data without asking.
    const total = chosen.sizeBytes + (chosen.documentBytes ?? 0);
    // Guarded across the check: nothing is started until it answers, so there is no run yet for
    // `started` to hold, and a second tap in that gap would ask - and start - a second time.
    void sendOnce(async () => {
      if (started.current) {
        return;
      }
      const metered = await isMetered();
      if (metered === true && total > METERED_ASK_BYTES) {
        setMeteredAsk(total);
        return;
      }
      startSend();
    });
  };

  /** Shared by the typed and the scanned path, so both reach the transfer the same way. */
  const startReceive = (parsed: string) => {
    // The typed phrase, a double tap on "Přijmout", and a scanned code all arrive here.
    if (started.current) {
      return;
    }
    started.current = true;
    setError(null);
    setDone(null);
    const signal = { cancelled: false };
    setCancel(signal);
    setMode('receiving');
    void controller
      .receive(
        parsed,
        p => {
          if (!signal.cancelled) {
            setProgress(p);
          }
        },
        signal,
      )
      .then(received => {
        if (signal.cancelled) {
          // The controller refuses a receive that was stopped and sweeps what it staged, so this is
          // only ever a controller that did not - and a stopped transfer is still not offered, nor
          // left on disk with the recovery key that came with it.
          void controller.dispose(received);
          return;
        }
        setProgress(null);
        // STOPS here. The archive is not touched until the dialog below is answered (FR-004).
        awaitingAnswer.current = received;
        setGot(received);
      })
      .catch(e => {
        if (signal.cancelled) {
          return;
        }
        report(e);
        reset();
      });
  };

  const onReceive = () => {
    const parsed = parseCodePhrase(typed);
    if (!parsed) {
      // Not a transport failure and not a refused phrase: this one never left the phone.
      setError(t('transfer.error.phrase'));
      return;
    }
    startReceive(parsed);
  };

  /**
   * The received transfer, handed to whichever answer comes first - and to nothing after it. A second
   * tap on "Uložit do archivu", or "Zrušit" landing in the same frame, finds it already taken.
   */
  const takeReceived = (): ReceivedTransfer | null => {
    const received = awaitingAnswer.current;
    awaitingAnswer.current = null;
    return received;
  };

  /** Declined, dismissed or unreadable: let go of what arrived - the documents are on disk. */
  const onDecline = () => {
    const received = takeReceived();
    if (!received) {
      return;
    }
    void controller.dispose(received);
    setGot(null);
    reset();
  };

  const onConfirm = () => {
    const received = takeReceived();
    if (!received) {
      return;
    }
    setGot(null);
    const key = received.recoveryKey;
    if (!key) {
      // Without the key the archive cannot be opened, and this screen has nowhere to ask for one.
      void controller.dispose(received);
      setError(t('transfer.error.failed'));
      reset();
      return;
    }
    setApplying(true);
    void controller
      .apply(received, key, {
        // Keeping the key that arrived asks for the screen lock on Android, in the backup screen's words.
        promptTitle: t('backup.prompt.enable'),
        onProgress: setApplyProgress,
      })
      .then(restored => {
        // Left during the save: the controller keeps the outcome for whichever screen is in view.
        if (!seenHere()) {
          return;
        }
        controller.takeOutcome();
        haptics.success();
        setDone(doneText(restored));
        reset();
      })
      .catch(e => {
        if (!seenHere()) {
          return;
        }
        controller.takeOutcome();
        report(e);
        reset();
      });
  };

  const running = mode !== 'idle' || waitingForApply;

  return (
    <>

      {meteredAsk != null ? (
        <Dialog
          title={t('transfer.metered.title')}
          body={t('transfer.metered.body', { size: formatBytes(meteredAsk) })}
          onDismiss={() => setMeteredAsk(null)}
          testID="transfer-metered-dialog"
          actions={[
            {
              label: t('common.cancel'),
              testID: 'transfer-metered-cancel',
              onPress: () => setMeteredAsk(null),
            },
            {
              label: t('transfer.metered.confirm'),
              testID: 'transfer-metered-confirm',
              onPress: () => {
                setMeteredAsk(null);
                startSend();
              },
            },
          ]}
        />
      ) : null}

      {got ? (
        <Dialog
          title={t('transfer.got.title')}
          body={
            got.restorable
              ? t('transfer.got.body', {
                  when: formatDateTime(got.manifest.createdAt),
                  size: formatBytes(got.manifest.sizeBytes),
                })
              : got.compatibility.kind === 'tooNew'
              ? t('transfer.got.tooNew')
              : t('transfer.got.unsupported')
          }
          onDismiss={onDecline}
          testID="transfer-received-dialog"
          actions={
            got.restorable
              ? [
                  {
                    label: t('common.cancel'),
                    testID: 'transfer-received-cancel',
                    // Declining still has to let go of what arrived: the documents are on disk.
                    onPress: onDecline,
                  },
                  {
                    label: t('transfer.got.confirm'),
                    testID: 'transfer-received-confirm',
                    onPress: onConfirm,
                  },
                ]
              : [
                  {
                    label: t('common.ok'),
                    testID: 'transfer-received-close',
                    onPress: onDecline,
                  },
                ]
          }
        />
      ) : null}

      <SubScreen title={receiveOnly ? t('transfer.receiveFrom') : t('transfer')} onBack={onBack}>
        {!available ? (
          <Section label={t('transfer')} icon={<BackupIcon size={13} color={theme.textFaint} />}>
            <Card>
              <CardRow last>
                <Body flex={1} fontSize={13} lineHeight={19} color={theme.textMuted}>
                  {t('transfer.unavailable')}
                </Body>
              </CardRow>
            </Card>
          </Section>
        ) : null}

        {available && !running ? (
          <>
            {receiveOnly ? null : (
              <Section
                label={t('transfer.pick')}
                icon={<BackupIcon size={13} color={theme.textFaint} />}
              >
                {sorted === null ? null : sorted.length === 0 ? (
                  // Nothing to send: a transfer always sends a finished backup (026 US3).
                  <Card>
                    <CardRow last={false} testID="transfer-no-backup">
                      <YStack flex={1}>
                        <RowTitle>{t('transfer.pick.none.title')}</RowTitle>
                        <Caption fontSize={12} lineHeight={15} marginTop={1} color={theme.textFaint}>
                          {t('transfer.pick.none.body')}
                        </Caption>
                      </YStack>
                    </CardRow>
                    <CardRow
                      last
                      onPress={onOpenBackup}
                      accessibilityLabel={t('transfer.pick.create')}
                      testID="transfer-create-backup"
                    >
                      <Body flex={1} fontSize={13} fontWeight="600" color={theme.blue}>
                        {t('transfer.pick.create')}
                      </Body>
                    </CardRow>
                  </Card>
                ) : (
                  <YStack gap={8}>
                    <OptionGroup<string>
                      value={chosen?.archiveName ?? ''}
                      onChange={setChosenName}
                      testIDPrefix="transfer-backup"
                      options={sorted.map(manifest => ({
                        value: manifest.archiveName,
                        label: formatDateTime(manifest.createdAt),
                        description: [
                          formatBytes(manifest.sizeBytes + (manifest.documentBytes ?? 0)),
                          documentsMissingText(manifest),
                        ]
                          .filter(Boolean)
                          .join(' · '),
                        trailing: <BackupDocumentsChip manifest={manifest} />,
                      }))}
                    />
                    <Caption fontSize={12} lineHeight={16} color={theme.textFaint} marginHorizontal={4}>
                      {t('transfer.pick.note')}
                    </Caption>
                    <Card>
                      <CardRow
                        last
                        onPress={onSend}
                        accessibilityLabel={t('transfer.pick.send')}
                        testID="transfer-send"
                      >
                        <Body flex={1} fontSize={13} fontWeight="600" color={theme.blue}>
                          {t('transfer.pick.send')}
                        </Body>
                      </CardRow>
                    </Card>
                  </YStack>
                )}
              </Section>
            )}

            <Section
              label={t('transfer.receive')}
              icon={<ShieldKeyIcon size={13} color={theme.textFaint} />}
            >
              <Card>
                <CardRow last={false}>
                  <Body flex={1} fontSize={13} lineHeight={19} color={theme.textMuted}>
                    {t('transfer.receive.desc')}
                  </Body>
                </CardRow>
                {scanningAvailable() ? (
                  <CardRow
                    last={false}
                    onPress={() => setScanning(true)}
                    accessibilityLabel={t('transfer.scan')}
                    testID="transfer-scan"
                  >
                    <XStack alignItems="center" gap={8} flex={1}>
                      <CameraIcon size={15} color={theme.blue} />
                      <Body flex={1} fontSize={13} fontWeight="600" color={theme.blue}>
                        {t('transfer.scan')}
                      </Body>
                    </XStack>
                  </CardRow>
                ) : null}
                <CardRow last={false}>
                  <Input
                    flex={1}
                    value={typed}
                    onChangeText={setTyped}
                    placeholder={t('transfer.phrase.placeholder')}
                    autoCapitalize="none"
                    autoCorrect={false}
                    accessibilityLabel={t('transfer.phrase.placeholder')}
                    testID="transfer-phrase-input"
                  />
                </CardRow>
                <CardRow
                  last
                  onPress={onReceive}
                  accessibilityLabel={t('transfer.start')}
                  testID="transfer-receive"
                >
                  <Body flex={1} fontSize={13} fontWeight="600" color={theme.blue}>
                    {t('transfer.start')}
                  </Body>
                </CardRow>
              </Card>
            </Section>
          </>
        ) : null}

        {running ? (
          <Section
            label={t('transfer')}
            icon={<BackupIcon size={13} color={theme.textFaint} />}
          >
            <Card>
              {/* The phrase, as large and as widely spaced as the recovery key: this gets read
                  across a table, and how it LOOKS is the difference between typing it correctly
                  and not. */}
              {phrase ? (
                <CardRow last={false}>
                  <YStack flex={1} gap={4}>
                    <RowTitle>{t('transfer.phrase.title')}</RowTitle>
                    {/* Word by word, wrapping BETWEEN words and never inside one.
                        One `Text` broke "ostrov" into "ostr" / "ov" on the device: the phrase has no
                        spaces, so the text engine treats it as a single word and breaks it wherever
                        the line runs out. Shrinking the type only postpones that - the longest
                        phrase this list can produce is about 46 characters. Splitting it is the only
                        fix that holds, and it reads better besides. */}
                    <XStack
                      flexWrap="wrap"
                      alignItems="center"
                      columnGap={6}
                      rowGap={2}
                      accessibilityLabel={phrase}
                      testID="transfer-phrase"
                    >
                      {phrase.split('-').map((part, i) => (
                        <XStack key={part + String(i)} alignItems="center" columnGap={6}>
                          {/* A DASH, because that is the character the phrase actually contains and
                              the one somebody has to type. A middle dot looked tidier and was a lie:
                              it is not on any keyboard, and it left the reader guessing between a
                              dot, a space and a dash. What is shown is what you type. */}
                          {i > 0 ? (
                            <Body fontSize={18} color={theme.textFaint}>
                              -
                            </Body>
                          ) : null}
                          <BodyStrong
                            fontSize={18}
                            fontFamily={fonts.bodySemiBold}
                            color={theme.text}
                          >
                            {part}
                          </BodyStrong>
                        </XStack>
                      ))}
                    </XStack>
                    {/* Which backup this is (026 US3): the one chosen, never a newer one in its place. */}
                    {sendingManifest ? (
                      <Caption fontSize={12} color={theme.textFaint} testID="transfer-which">
                        {t('transfer.phrase.which', {
                          when: formatDateTime(sendingManifest.createdAt),
                          what: documentsChipText(sendingManifest),
                        })}
                      </Caption>
                    ) : null}
                    {/* US1 scenario 1: what is about to go, counted, before a byte of it moves. */}
                    <Caption fontSize={12} color={theme.textFaint} testID="transfer-contents">
                      {contentsText(contents, sizeBytes)}
                    </Caption>
                    {/* The phrase is longer than the recovery key it replaces, and typing it is the
                        last piece of friction this feature exists to remove. The text stays: the
                        phone doing the scanning may be the one with a broken camera, and a code
                        nobody can read by eye is a dead end. */}
                    <YStack alignItems="center" paddingTop={6}>
                      <QrCode
                        value={encodeTransferQr(phrase)}
                        size={200}
                        testID="transfer-qr"
                        accessibilityLabel={t('transfer.phrase.title')}
                      />
                    </YStack>
                  </YStack>
                </CardRow>
              ) : null}

              {/* ONE row for the whole in-flight state: what it is doing, how far it has got, and
                  where the bytes are going. They were three separate CardRows and the middle one
                  carried a gap and a reserved bar the others did not, so the three lines sat on
                  three different rhythms - which is the hand-tuning the ui-guide exists to stop.
                  One block, one padding, one gap from the scale. */}
              <CardRow last={saving}>
                <YStack flex={1} gap={6}>
                  <Body fontSize={13} color={theme.textMuted} testID="transfer-stage">
                    {/* "Waiting for the other phone" is only true once there IS a phrase to type.
                        Before that the app is still packing, and the walk measured 25 seconds of it
                        on an archive with nine documents. */}
                    {saving
                      ? t('transfer.stage.applying')
                      : progress?.stage === 'preparing' && progress.total > 0
                      ? t('transfer.stage.preparing.count', {
                          done: String(progress.sent),
                          total: String(progress.total),
                        })
                      : progress && progress.stage !== 'preparing'
                      ? t(`transfer.stage.${progress.stage}`)
                      : phrase
                      ? t('transfer.phrase.waiting')
                      : t('transfer.stage.preparing')}
                  </Body>
                  {/* Reserved whether or not it is drawn, so nothing below moves (constitution V). */}
                  <YStack height={6} justifyContent="center">
                    {saving ? (
                      applyProgress ? (
                        <ProgressBar
                          fraction={applyProgress.fraction}
                          label={t('transfer.stage.applying')}
                          testID="transfer-progress"
                        />
                      ) : null
                    ) : progress && progress.total > 0 ? (
                      <ProgressBar
                        fraction={progress.sent / progress.total}
                        label={t(`transfer.stage.${progress.stage}`)}
                        now={progress.sent}
                        total={progress.total}
                        testID="transfer-progress"
                      />
                    ) : null}
                  </YStack>
                  {/* FR-007, said WHILE it is happening rather than afterwards. The route is only
                      known part-way through and its sentence grows then, so the longest one holds
                      the height from the first frame and the true one is drawn over it: nothing
                      below moves (constitution V). The reserve is invisible to screen readers too,
                      or they would read a route that is not the one being taken. */}
                  <YStack>
                    <Caption
                      fontSize={12}
                      lineHeight={16}
                      opacity={0}
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                      testID="transfer-route-reserve"
                    >
                      {routeReserveText()}
                    </Caption>
                    {/* While it saves nothing is on the network, so there is no route to state - and
                        no cancel row below, so this place says why there is none. */}
                    <Caption
                      position="absolute"
                      top={0}
                      left={0}
                      right={0}
                      fontSize={12}
                      lineHeight={16}
                      color={theme.textFaint}
                      testID={saving ? 'transfer-applying-note' : 'transfer-route'}
                    >
                      {saving ? t('transfer.applying.note') : routeText(progress?.relayed ?? null)}
                    </Caption>
                  </YStack>
                </YStack>
              </CardRow>

              {/* No cancel while it saves (025 review, 2026-09-15). The row used to stay, and pressing
                  it put the screen back to idle while the save carried on - so the next receive
                  swept the files the save was still reading. */}
              {saving ? null : (
                <CardRow
                  last
                  onPress={() => stopRun(cancel)}
                  accessibilityLabel={t('transfer.cancel')}
                  testID="transfer-cancel"
                >
                  <XStack alignItems="center" gap={8} flex={1}>
                    <CloseIcon size={15} color={theme.danger} />
                    <Body flex={1} fontSize={13} fontWeight="600" color={theme.danger}>
                      {t('transfer.cancel')}
                    </Body>
                  </XStack>
                </CardRow>
              )}
            </Card>
          </Section>
        ) : null}

        {error ? (
          <YStack paddingHorizontal={16} paddingTop={4}>
            <Body fontSize={13} color={theme.danger} testID="transfer-error">
              {error}
            </Body>
          </YStack>
        ) : null}
        {done ? (
          <YStack paddingHorizontal={16} paddingTop={4}>
            <Body fontSize={13} color={theme.textMuted} testID="transfer-done">
              {done}
            </Body>
          </YStack>
        ) : null}
        {/* Last, so it moves nothing when it arrives. Not while a transfer runs: a new one started
            after the first save is still this screen's to finish, or to stop. */}
        {onContinue && !running ? (
          <ContinueButton onPress={onContinue} testID="transfer-continue" />
        ) : null}
        <XStack height={24} />
      </SubScreen>
      {/* Full screen and above everything, because a viewfinder that shares the screen with a form
          is a viewfinder nobody can aim. AFTER the page, not before it: siblings are drawn in order,
          and placed first it sat under the page - the camera ran with no viewfinder, and nothing on
          screen said so (found on the emulator, 2026-09-24). */}
      {scanning ? (
        <TransferCodeScanner
          onCancel={() => setScanning(false)}
          onFound={phrase_ => {
            setScanning(false);
            setTyped(phrase_);
            startReceive(phrase_);
          }}
        />
      ) : null}
    </>
  );
}
