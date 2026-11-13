// Moving the archive to another phone (025), the whole feature as one screen.
//
// Everything it can do goes through `TransferController`, so this file holds no crypto, no phrase
// generation and no restore rules. What it decides is what to SHOW, and four of those matter:
//
//   * WHERE THE MAIL IS GOING, said while it is going (FR-007). Three states, not two: until a route
//     is negotiated the honest answer is "working it out", and the device run proved why that
//     matters - the flag said "relayed" while the bytes went straight to a private address. And said
//     again at the end: a small archive crosses in a second, and the sentence during it only flashed
//     past (025 T027).
//   * NOTHING IS SAVED UNTIL IT IS AGREED TO (FR-004). The receiving side fetches, then stops and
//     shows a date and a size. The archive is only touched after a second tap.
//   * THE BOXES STILL NEED SIGNING IN TO (FR-011). Said at the end, because that is where somebody
//     stands who thinks the job is finished.
//   * IT ONLY RUNS WHILE SOMEBODY IS WATCHING (FR-014). Leaving the app stops the transfer, and the
//     reason is on screen when the user comes back.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { XStack, YStack } from '../../theme/ui';
import { Caption, Label, Meta, Overline, Small, SmallStrong } from '../../theme/Typography';
import { SecureSlip, SlipCode } from '../../theme/objects/SecureSlip';
import { ProgressBar, WaitingBar } from '../../theme/ProgressBar';
import { QrCode } from '../../theme/QrCode';
import { useTheme } from '../../theme/ThemeProvider';
import { CloseIcon } from '../../theme/icons';
import { formatBytes, t } from '../../i18n/strings';
import { haptics } from '../../services/haptics';
import { SubScreen } from './SubScreen';
import { Section } from './SettingsSection';
import { space } from '../../theme/spacing';
import type {
  ApplyOutcome,
  TransferController,
  TransferContents,
  ReceivedTransfer,
} from '../../features/transfer/state/transferController';
import type { BackupProgress } from '../../services/backup/progress';
import { TransferBackupGoneError, type TransferProgress } from '../../services/transfer/transport';
import { parseCodePhrase, unknownPhraseWord } from '../../services/transfer/codePhrase';
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
import { TransferDone, type TransferEnd } from './TransferDone';
import { contentsText, doneParts, errorText, lastWord, routeText } from './transferWords';
import { documentsChipText } from './BackupDocumentsChip';
import { ReceiveForm, ReceiveRow, SendHalf, TransferUnavailable } from './TransferForms';
import { TransferDialogs, formatDateTime } from './TransferDialogs';

type Mode = 'idle' | 'sending' | 'receiving';
type Side = 'sending' | 'receiving';

/** A failure and the half of the screen it happened in, which is where it is said (R10). */
type Failure = { readonly text: string; readonly side: Side };

export function TransferScreen({
  onBack,
  controller,
  backups,
  onOpenBackup,
  onBackupsStale,
  inView = true,
  receiveOnly = false,
  onContinue,
  onOpenReceive,
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
   * The receiving screen, where the shell has one (Settings, R10): receiving is then a row here, and
   * the form is on that screen. Without it the form is drawn here, under the send.
   */
  readonly onOpenReceive?: () => void;
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
  /**
   * The route the run in flight was seen to take, kept past its end for the last word (`wentText`).
   * A ref, because the run's own callbacks read it, and `progress` is cleared before they do.
   */
  const routeSeen = useRef<boolean | null>(null);
  const [got, setGot] = useState<ReceivedTransfer | null>(null);
  const [error, setError] = useState<Failure | null>(null);
  const [done, setDone] = useState<TransferEnd | null>(null);
  /** The half the run in flight belongs to, for a stop that arrives from outside it. */
  const runSide = useRef<Side>('receiving');
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
      setDone(lastWord(doneParts(outcome.applied)));
    } else {
      setDone(null);
      setError({ text: errorText(outcome.error), side: 'receiving' });
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
      setError({ text: t('transfer.stopped.background'), side: runSide.current });
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
  const report = (e: unknown, side: Side) => {
    setError({ text: errorText(e, side), side });
  };

  /** A run's progress, with the route it reports kept for after its end. */
  const progressFor = (signal: { cancelled: boolean }) => (p: TransferProgress) => {
    if (signal.cancelled) {
      return;
    }
    if (p.relayed !== null) {
      routeSeen.current = p.relayed;
    }
    setProgress(p);
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
    runSide.current = 'sending';
    setSendingManifest(manifest);
    routeSeen.current = null;
    // Every result below is dropped once the run was stopped. The screen has already said why and
    // moved on - possibly to a newer run, whose state a late event from this one must not overwrite.
    void controller
      .offer(manifest, progressFor(signal), signal)
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
        // That it WENT, first: the sign-in reminder alone was the sentence for the other phone, and
        // left this one's user guessing whether anything had been sent (025 T027).
        setDone(lastWord({ title: t('transfer.sent.title'), body: t('transfer.sent.body') }, routeSeen.current));
      })
      .catch(e => {
        if (signal.cancelled) {
          return;
        }
        report(e, 'sending');
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
    runSide.current = 'receiving';
    routeSeen.current = null;
    void controller
      .receive(parsed, progressFor(signal), signal)
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
        report(e, 'receiving');
        reset();
      });
  };

  const onReceive = () => {
    const parsed = parseCodePhrase(typed);
    if (!parsed) {
      // Not a transport failure and not a refused phrase: this one never left the phone, so the
      // fix is to look again - not the "ask for a new one" a refused phrase gets.
      const word = unknownPhraseWord(typed);
      setError({
        text: word ? t('transfer.error.typo.word', { word }) : t('transfer.error.typo'),
        side: 'receiving',
      });
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
      setError({ text: t('transfer.error.failed'), side: 'receiving' });
      reset();
      return;
    }
    setApplying(true);
    void controller
      .apply(received, key, {
        // Keeping the key that arrived asks for the screen lock on Android. Its own words: the backup
        // screen's "Uložit heslo k záloze" read as if a new password were being set (025 T027).
        promptTitle: t('transfer.prompt.keepKey'),
        onProgress: setApplyProgress,
      })
      .then(restored => {
        // Left during the save: the controller keeps the outcome for whichever screen is in view.
        if (!seenHere()) {
          return;
        }
        controller.takeOutcome();
        haptics.success();
        setDone(lastWord(doneParts(restored), routeSeen.current));
        reset();
      })
      .catch(e => {
        if (!seenHere()) {
          return;
        }
        controller.takeOutcome();
        report(e, 'receiving');
        reset();
      });
  };

  const running = mode !== 'idle' || waitingForApply;
  const screenTitle = receiveOnly ? t('transfer.receiveFrom') : t('transfer');

  // R8: the end is the whole screen, until the way on is taken - the shell's, or back to the form.
  if (done && !running) {
    return (
      <TransferDone
        title={screenTitle}
        end={done}
        onBack={onBack}
        onContinue={onContinue ?? (() => setDone(null))}
      />
    );
  }

  /** The bytes beside the stage (R8), while there are bytes moving to count. */
  const bytes =
    !saving && !got && progress && progress.total > 0 && progress.stage !== 'preparing' && progress.stage !== 'connecting'
      ? t('backup.progress.count', { done: formatBytes(progress.sent), total: formatBytes(progress.total) })
      : null;

  const receiveForm = (
    <ReceiveForm
      typed={typed}
      onType={setTyped}
      onScan={scanningAvailable() ? () => setScanning(true) : undefined}
      onReceive={onReceive}
      failure={error?.side === 'receiving' ? error.text : null}
    />
  );

  return (
    <>

      <TransferDialogs
        meteredAsk={meteredAsk}
        onMeteredCancel={() => setMeteredAsk(null)}
        onMeteredConfirm={() => {
          setMeteredAsk(null);
          startSend();
        }}
        got={got}
        onDecline={onDecline}
        onConfirm={onConfirm}
      />

      {/* R10 sets the receiving form's words 16 under the header; a run keeps R8's 18. */}
      <SubScreen title={screenTitle} onBack={onBack} paddingTop={receiveOnly && !running ? 16 : space.gutter}>
        {!available ? <TransferUnavailable /> : null}

        {available && !running ? (
          <>
            {receiveOnly ? null : (
              <SendHalf
                backups={sorted}
                chosen={chosen}
                onChoose={setChosenName}
                onSend={onSend}
                onOpenBackup={onOpenBackup}
                failure={error?.side === 'sending' ? error.text : null}
              />
            )}
            {/* R10: from Settings, receiving is a screen of its own behind one row, 26 under the send
                (the section's 18 and 8). On that screen, and on a first run, it is the form. */}
            {onOpenReceive && !receiveOnly ? (
              <YStack marginTop={8}>
                <ReceiveRow onPress={onOpenReceive} />
              </YStack>
            ) : receiveOnly ? (
              receiveForm
            ) : (
              <YStack marginTop={8}>
                <Section label={t('transfer.receive')}>{receiveForm}</Section>
              </YStack>
            )}
          </>
        ) : null}

        {running ? (
          // R6 and R8: the half the run belongs to, as a plain overline over it.
          <Section label={mode === 'sending' ? t('transfer') : t('transfer.receive')} testID="transfer-run">
            {/* Boards R6 (the phrase) and R8 (a run): the phrase is a slip on the security tint, and
                the run is plain lines under it - the stage, one bar, what to keep doing, the way to
                stop. No card: a card around a run read as one more setting. A receive has no slip,
                and R8 sets its stage 18 under the overline: the section's 8 and the column's 10. */}
            <YStack gap={10} paddingTop={mode === 'sending' ? 0 : 10}>
              {phrase ? (
                <SecureSlip testID="transfer-slip">
                  <Overline color={theme.textMuted}>{t('transfer.phrase.title')}</Overline>
                  {/* Word by word, wrapping BETWEEN words and never inside one: one `Text` broke
                      "ostrov" into "ostr" / "ov" on the device, because a phrase without spaces is one
                      word to the text engine. A DASH between them, because that is the character the
                      phrase contains - a middle dot is on no keyboard - set tight, as it is typed,
                      and faint (025 T027). The hint under it says the rest. */}
                  <SlipCode parts={phrase.split('-')} faintDashes accessibilityLabel={phrase} testID="transfer-phrase" />
                  <Caption color={theme.textMuted} textAlign="center" testID="transfer-phrase-hint">
                    {t('transfer.phrase.hint')}
                  </Caption>
                  <YStack>
                    {/* Which backup this is (026 US3): the one chosen, never a newer one in its place. */}
                    {sendingManifest ? (
                      <Meta color={theme.textFaint} textAlign="center" testID="transfer-which">
                        {t('transfer.phrase.which', {
                          when: formatDateTime(sendingManifest.createdAt),
                          what: documentsChipText(sendingManifest),
                        })}
                      </Meta>
                    ) : null}
                    {/* US1 scenario 1: what is about to go, counted, before a byte of it moves. */}
                    <Meta color={theme.textFaint} textAlign="center" testID="transfer-contents">
                      {contentsText(contents, sizeBytes)}
                    </Meta>
                  </YStack>
                  {/* The text stays beside the code: the phone doing the scanning may be the one with
                      a broken camera, and a code nobody can read by eye is a dead end. */}
                  <YStack alignItems="center">
                    <QrCode
                      value={encodeTransferQr(phrase)}
                      size={195}
                      testID="transfer-qr"
                      accessibilityLabel={t('transfer.phrase.title')}
                    />
                  </YStack>
                </SecureSlip>
              ) : null}

              <XStack justifyContent="space-between" alignItems="baseline" gap={10}>
                <Small fontWeight="600" color={theme.text} flexShrink={1} testID="transfer-stage">
                  {/* "Waiting for the other phone" is only true once there IS a phrase to type. Before
                      that the app is still packing, and the walk measured 25 seconds of it on an
                      archive with nine documents. A receive has nothing to pack: it is connecting from
                      the first frame, and said "Getting ready to send" (T027). Once it has arrived it
                      says so, under the question about saving it. */}
                  {saving
                    ? t('transfer.stage.applying')
                    : got
                    ? t('transfer.stage.received')
                    : progress?.stage === 'preparing' && progress.total > 0
                    ? t('transfer.stage.preparing.count', {
                        done: String(progress.sent),
                        total: String(progress.total),
                      })
                    : progress && progress.stage !== 'preparing'
                    ? t(`transfer.stage.${progress.stage}`)
                    : phrase
                    ? t('transfer.phrase.waiting')
                    : mode === 'receiving'
                    ? t('transfer.stage.connecting')
                    : t('transfer.stage.preparing')}
                </Small>
                {bytes ? (
                  <Label color={theme.textMuted} testID="transfer-bytes">
                    {bytes}
                  </Label>
                ) : null}
              </XStack>
              {/* Always a bar in the same place: counting when there is something to count,
                  travelling when there is not (025 T027), full once it has all arrived. */}
              {saving ? (
                applyProgress ? (
                  <ProgressBar
                    fraction={applyProgress.fraction}
                    label={t('transfer.stage.applying')}
                    testID="transfer-progress"
                  />
                ) : (
                  <WaitingBar label={t('transfer.stage.applying')} testID="transfer-waiting" />
                )
              ) : got ? (
                <ProgressBar fraction={1} label={t('transfer.stage.received')} testID="transfer-progress" />
              ) : progress && progress.total > 0 ? (
                <ProgressBar
                  fraction={progress.sent / progress.total}
                  label={t(`transfer.stage.${progress.stage}`)}
                  now={progress.sent}
                  total={progress.total}
                  testID="transfer-progress"
                />
              ) : (
                <WaitingBar label={t('transfer.phrase.waiting')} testID="transfer-waiting" />
              )}

              {/* FR-014: leaving the app or locking the phone stops the transfer, and no app can
                  forbid either. So it is said before, not only after. */}
              {saving ? null : (
                <Meta color={theme.textFaint} testID="transfer-keep-open">
                  {t('transfer.keepOpen')}
                </Meta>
              )}

              {/* No cancel while it saves (025 review, 2026-09-15). The row used to stay, and pressing
                  it put the screen back to idle while the save carried on - so the next receive
                  swept the files the save was still reading. */}
              {saving ? null : (
                <XStack
                  alignSelf="flex-start"
                  alignItems="center"
                  gap={6}
                  minHeight={44}
                  paddingHorizontal={4}
                  onPress={() => stopRun(cancel)}
                  accessibilityRole="button"
                  accessibilityLabel={t('transfer.cancel')}
                  testID="transfer-cancel"
                >
                  <CloseIcon size={18} color={theme.danger} />
                  <SmallStrong color={theme.danger}>{t('transfer.cancel')}</SmallStrong>
                </XStack>
              )}

              {/* Last on the screen while a run is up. FR-007's route is known only part-way through
                  and its sentence grows then, from one line to four; above the cancel link it would
                  move the link under a thumb (constitution V). R8 draws it above; that board is on
                  031's sync-back list. While it saves nothing is on the network, so there is no
                  route to state - and no cancel, so this place says why there is none. */}
              <Meta color={theme.textFaint} testID={saving ? 'transfer-applying-note' : 'transfer-route'}>
                {/* The route seen, not only the last event's: `progress` is cleared once what
                    arrived is on screen, and the line under the question said "working it out". */}
                {saving ? t('transfer.applying.note') : routeText(progress?.relayed ?? routeSeen.current)}
              </Meta>
            </YStack>
          </Section>
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
