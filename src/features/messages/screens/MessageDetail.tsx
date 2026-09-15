import { useCallback, useEffect, useRef, useState } from 'react';
import { touchSlop } from '../../../theme/touchTarget';
import { AppState, ScrollView } from 'react-native';
import { Button, Paragraph, Spinner, XStack, YStack } from '../../../theme/ui';
import { PressScale } from '../../../theme/PressScale';
import { Dialog } from '../../../theme/Dialog';
import { Skeleton } from '../../../theme/Skeleton';
import { Avatar } from '../../../theme/Avatar';
import { chipTone } from '../../../theme/chipTone';
import { attachmentFileStore } from '../../../services/files/attachmentFileStore';
import { haptics } from '../../../services/haptics';
import { useSingleFlight } from '../../../app/useSingleFlight';
import { useAfterPressSettles } from '../../../app/useAfterPressSettles';
import {
  Badge,
  Body,
  BodyStrong,
  Caption,
  Heading,
  Label,
  Title,
  Value,
} from '../../../theme/Typography';
import { useTheme } from '../../../theme/ThemeProvider';
import {
  AlertIcon,
  CheckIcon,
  ChevronLeftIcon,
  ContentErasedIcon,
  DownloadIcon,
  FileIcon,
  FileXIcon,
  MailIcon,
  StatusAcceptedIcon,
  VaultIcon,
  TimerIcon,
  ChevronRightIcon,
} from '../../../theme/icons';
import { useHeaderTop } from '../../../theme/useHeaderTop';
import { useContentBottom } from '../../../theme/useContentBottom';
// gesture-handler Pressable for the attachment row: a plain RN/Tamagui onPress holds the JS touch
// responder across the app backgrounding to the external PDF viewer, and on return it's never released
// - freezing touches across the WHOLE detail screen. gesture-handler uses native recognisers, no stuck
// responder.
import { Pressable as GHPressable } from 'react-native-gesture-handler';
import { TestEnvBanner } from '../../../app/TestEnvBanner';
import { plural, t } from '../../../i18n/strings';
import { reauthKey } from '../../accounts/state/reauthCopy';
import {
  type DataBoxAccount,
  type MessageAttachment,
  type MessageEnvelope,
  type SignedOriginal,
} from '../../../services/isds/types';
import type { MessageFolder } from '../../../services/db/messagesStore';
import {
  accountsController,
  messagesController,
  remindersController,
  scanController,
} from '../../accounts/deps';
import { isUnread, type DownloadFailure } from '../state/messagesController';
import { servedByFiction } from '../state/fikce';
import {
  MESSAGE_STATE,
  MESSAGE_STATE_DELIVERED,
  MESSAGE_STATE_SERVED,
  messageStatus,
  stopReasonKey,
  type MessageStateKind,
} from '../state/messageState';
import { TermPicker, formatTermDate } from './TermPicker';
import { DeadlineSuggestionCard } from './DeadlineSuggestion';
import { AlertsOffLine, useReminderAlerts } from './ReminderAlerts';
import { DottedRail } from '../../../theme/DottedRail';
import type { ScanSuggestion } from '../../../services/scan/attachmentScan';
import type { Reminder } from '../state/reminders';
import { DeliveryStateIcon } from './DeliveryStateIcon';
import { AddressLines } from './AddressLines';
import { DeliveryRecordCard } from './DeliveryRecord';
import { SignedOriginalSection } from './SignedOriginalSection';
import {
  deliveryRecord,
  mergeSameTimeHead,
} from '../state/deliveryRecord';
import {
  attachmentOpener,
  NoViewerError,
} from '../../../services/files/attachmentOpener';

type State =
  | { status: 'loading' }
  // The envelope renders from the cached list (no download). `attachments` is null until they are
  // explicitly downloaded (they can be large - never fetched automatically on entry).
  | {
      status: 'ready';
      envelope: MessageEnvelope;
      attachments: MessageAttachment[] | null;
      /** ISDS no longer has the message (re-download failed past retention) → files unrecoverable. */
      unavailable: boolean;
      /** A large-volume message whose enclosures stopped arriving part-way (`enclosuresMissingFrom`). */
      incomplete: boolean;
      /** The signed original the cached detail records, or null (004 amendment). */
      original: SignedOriginal | null;
    }
  | { status: 'error'; messageKey: string };

const pad = (n: number) => String(n).padStart(2, '0');

/** Full "dd.mm.yyyy hh:mm" - message detail wants the time, not just the date. */
function formatDateTime(epochMs: number | null): string {
  if (epochMs == null) {
    return '—';
  }
  const d = new Date(epochMs);
  return (
    `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/**
 * Which note goes under the download button.
 *
 * The delivery clause is only true for a received message served by SIGNING IN. Pure and exported so
 * the rule can be tested without mounting a screen that needs half the app's controllers - and so
 * the three cases are visible in one place rather than spread through JSX.
 *
 *   sent      Nothing was served to anyone by this user's sign-in. The sent rail on the same screen
 *             may be saying the recipient has not picked it up at all.
 *   fiction   Served without anyone signing in - which the banner at the top of this scroll says in
 *             so many words ("bez vašeho přihlášení").
 *   received  Delivery happened by the sign-in that fetched the list (§17/3).
 */
export function downloadNoteKey({
  isSent,
  servedByFiction: served,
}: {
  isSent: boolean;
  servedByFiction: boolean;
}): string {
  if (isSent) {
    return 'detail.attachments.downloadFullNote.sent';
  }
  return served
    ? 'detail.attachments.downloadFullNote.fiction'
    : 'detail.attachments.downloadFullNote';
}

/**
 * The badge over the attachment list. "Celá zpráva uložena" is a claim about files on disk, so it
 * has to answer to whether they are there.
 */
export function savedBadgeKey(anyBlocked: boolean): string {
  return anyBlocked
    ? 'detail.attachments.partlySaved'
    : 'detail.attachments.fullSaved';
}

/**
 * Which notice stands above a downloaded message's attachment rows - one at a time.
 *
 *   unavailable  ISDS has deleted the message, so nothing missing can come back: no download offered.
 *   incomplete   Enclosures of a large-volume message never arrived. Its download fetches only those,
 *                so it goes first; a file that has also gone from the device comes back with the full
 *                download offered once the message is whole.
 *   someMissing  Files the archive recorded are gone from the device, or could not be written.
 */
export function attachmentsNotice({
  incomplete,
  anyBlocked,
  unavailable,
}: {
  incomplete: boolean;
  anyBlocked: boolean;
  unavailable: boolean;
}): 'unavailable' | 'incomplete' | 'someMissing' | null {
  if (unavailable && (incomplete || anyBlocked)) {
    return 'unavailable';
  }
  if (incomplete) {
    return 'incomplete';
  }
  return anyBlocked ? 'someMissing' : null;
}

/** Why a download did not bring everything, in the words the user reads. */
function failureText(account: DataBoxAccount, failure: DownloadFailure): string {
  return failure.kind === 'reauth'
    ? t(reauthKey(account, 'messages.reauth', 'messages.reauth.credentials'))
    : t(failure.messageKey);
}

/** Human file size: B / kB / MB (Czech comma decimal for MB). From the on-disk byte count. */
function formatBytes(n: number): string {
  if (n < 1024) {
    return `${n} B`;
  }
  if (n < 1024 * 1024) {
    return `${Math.round(n / 1024)} kB`;
  }
  return `${(n / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/**
 * The received-side fiction banner: "Doručeno fikcí 20. 6. · bez vašeho přihlášení". A statement of
 * what already happened - the deadline started on THAT day, not on the day the app was next opened,
 * which is the whole reason the date is spelled out rather than left as "doručeno fikcí".
 */
function fikceBannerLabel(servedAt: number): string {
  return `${t('status.byFiction')} ${formatDateTime(servedAt)} · ${t(
    'status.byFiction.withoutYou',
  )}`;
}

export interface MessageDetailProps {
  readonly account: DataBoxAccount;
  readonly messageId: string;
  /** Which folder it was opened from (008): a sent message orients you → recipient + isn't "read". */
  readonly folder?: MessageFolder;
  readonly onBack: () => void;
}

export function MessageDetail({
  account,
  messageId,
  folder = 'received',
  onBack,
}: MessageDetailProps) {
  const theme = useTheme();
  // czebox boxes get a persistent "Testovací" banner pushed in above the header (US3, no overlap).
  const showTestBanner = account.host === 'czebox';
  const headerTop = useHeaderTop(showTestBanner);
  const contentBottom = useContentBottom(24);
  const [state, setState] = useState<State>({ status: 'loading' });
  // The user's own deadline on this message (010 US2). RECEIVED only: a termín is a note about
  // something you have to do, and a message you sent asks nothing of you.
  const [term, setTerm] = useState<number | null>(null);
  const [pickingTerm, setPickingTerm] = useState(false);
  // Whether that reminder will actually alert (2026-09-24): notifications can be refused, or switched
  // off later in the system settings, and the reminder then works as the chip alone (FR-006).
  const reminderAlerts = useReminderAlerts(account.boxId);
  useEffect(() => {
    let alive = true;
    void remindersController
      .get(account.boxId, messageId)
      .then((r: Reminder | null) => {
        if (alive) {
          setTerm(r?.date ?? null);
        }
      })
      .catch(() => {
        if (alive) {
          setTerm(null);
        }
      });
    return () => {
      alive = false;
    };
  }, [account.boxId, messageId]);
  // The on-device scan (010 US3). `scanning` and `suggestion` are transient: a scan runs only after
  // a download the user asked for, and neither survives leaving the screen. The dismissal does.
  const [scanning, setScanning] = useState(false);
  const [suggestion, setSuggestion] = useState<ScanSuggestion | null>(null);
  const [downloading, setDownloading] = useState(false);
  // Bytes downloaded so far for the large >20 MB (VoDZ) path (RESPONSE bytes - the decoded file ≈
  // ×0.75). null for inline (≤20 MB) downloads - they arrive in one chunk, so there's no increment.
  const [downloadedBytes, setDownloadedBytes] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  // Indices of attachments whose on-disk file is gone (deleted externally). Re-checked whenever the
  // detail (re)loads or a re-download replaces the attachments - files can vanish independently of the DB.
  const [missingAtt, setMissingAtt] = useState<Set<number>>(new Set());
  const inFlight = useRef<AbortController | null>(null);

  // Open the detail from the cache only - the envelope is already saved from the list sync, and the
  // attachments are shown only if they were previously downloaded. No network on entry.
  const load = useCallback(async () => {
    setState({ status: 'loading' });
    const [envelope, cachedDetail] = await Promise.all([
      messagesController.getCachedEnvelope(account.boxId, messageId),
      messagesController.getCachedDetail(account.boxId, messageId),
    ]);
    if (envelope) {
      setState({
        status: 'ready',
        envelope,
        attachments: cachedDetail?.attachments ?? null,
        unavailable: cachedDetail?.attachmentsUnavailable ?? false,
        incomplete: cachedDetail?.enclosuresMissingFrom != null,
        original: cachedDetail?.signedZfo ?? null,
      });
      // Opening a RECEIVED message reads it: mark it read on ISDS + in the cache (so the list drops the
      // unread treatment). Fire-and-forget, only for unread - never blocks the detail. A SENT message is
      // never "read" by us (mark-as-downloaded is a received-only op), so skip it.
      if (folder === 'received' && isUnread(envelope.state)) {
        void messagesController.markRead(account, messageId).then(marked => {
          if (marked) {
            void accountsController.decrementUnread(account.boxId);
          }
        });
      }
    } else {
      setState({ status: 'error', messageKey: 'detail.error.load' });
    }
  }, [account, messageId, folder]);

  useEffect(() => {
    load();
    return () => inFlight.current?.abort();
  }, [load]);

  // Verify each downloaded attachment's file still exists on disk (a user could delete it externally).
  useEffect(() => {
    const atts = state.status === 'ready' ? state.attachments : null;
    if (atts == null) {
      setMissingAtt(new Set());
      return;
    }
    let cancelled = false;
    void (async () => {
      const gone = new Set<number>();
      await Promise.all(
        atts.map(async (a, i) => {
          if (a.localPath && !(await attachmentFileStore.exists(a.localPath))) {
            gone.add(i);
          }
        }),
      );
      if (!cancelled) {
        setMissingAtt(gone);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state]);

  /**
   * Scan what was just downloaded (010 US3) - never on entry, never on a cached detail.
   *
   * The scan is tied to a download the USER asked for because that is the only moment at which they
   * have decided this document is worth opening; scanning the cache on every visit would read legal
   * mail on the app's initiative, which is the thing the toggle exists to prevent (FR-012).
   *
   * Nothing here is offered when a deadline is already set: the user's own date is the answer, and
   * an estimate arguing with it would be the app second-guessing a person about their own mail.
   */
  const runScan = useCallback(
    async (attachments: MessageAttachment[], signal: AbortSignal) => {
      if (folder !== 'received' || term != null) {
        return;
      }
      // Asked BEFORE the indicator appears, so a scan that will not happen never shows a card that
      // says it is happening.
      const eligible =
        (await scanController.enabled()) &&
        !(await scanController.isDismissed(account.boxId, messageId));
      if (!eligible || signal.aborted) {
        return;
      }
      setScanning(true);
      setSuggestion(null);
      try {
        const found = await scanController.scan(
          account.boxId,
          messageId,
          attachments,
        );
        if (!signal.aborted) {
          setSuggestion(found);
        }
      } finally {
        if (!signal.aborted) {
          setScanning(false);
        }
      }
    },
    [account.boxId, messageId, folder, term],
  );

  // Explicit, opt-in attachment download (MessageDownload fetches all of them at once).
  const downloadAttachments = useCallback(async () => {
    if (downloading) {
      return;
    }
    setDownloading(true);
    setDownloadedBytes(null);
    // The last failure is not cleared here: it keeps its line, hidden, until this attempt answers.
    // Cleared up front, the line left the missing-attachments notice and the button and every row
    // under it moved up for as long as the retry ran (constitution V).
    inFlight.current?.abort();
    const ctrl = new AbortController();
    inFlight.current = ctrl;
    const outcome = await messagesController.getDetail(
      account,
      messageId,
      folder,
      ctrl.signal,
      bytes => setDownloadedBytes(bytes),
    );
    if (ctrl.signal.aborted) {
      return;
    }
    setDownloading(false);
    setDownloadedBytes(null);
    if (outcome.kind === 'detail' || outcome.kind === 'partial') {
      // Attachments back - all of them, or (partial) the enclosures that arrived, with the rest recorded
      // as missing and offered again. Either way ISDS still has the message: clear any "unavailable".
      // Incomplete by the record, not by the outcome: a re-download of a message already whole that
      // stops part-way keeps it whole (`enclosuresAfterWalk`).
      setState(s =>
        s.status === 'ready'
          ? {
              ...s,
              attachments: outcome.detail.attachments,
              unavailable: false,
              incomplete: outcome.detail.enclosuresMissingFrom != null,
              original: outcome.detail.signedZfo ?? null,
            }
          : s,
      );
      setDownloadError(outcome.kind === 'partial' ? failureText(account, outcome.failure) : null);
      void messagesController.setAttachmentsUnavailable(
        account.boxId,
        messageId,
        false,
      );
      // The attachments only: the signed original is never scanned (004 amendment).
      void runScan(outcome.detail.attachments, ctrl.signal);
    } else if (outcome.kind === 'reauth') {
      setDownloadError(failureText(account, outcome));
    } else if (outcome.kind === 'gone') {
      // ISDS said it has deleted the message (1219), past its retention window, and the controller has
      // recorded that. Any other failure - an outage, or ISDS refusing for another reason - is only a
      // failure to retry, and no longer marks the files lost. The flag clears on a later download.
      setState(s => (s.status === 'ready' ? { ...s, unavailable: true } : s));
      setDownloadError(null);
    } else {
      setDownloadError(t(outcome.messageKey));
    }
  }, [account, messageId, downloading, folder, runScan]);

  // The "paper" header (009): a 54dp bar (surfaceAlt + a hairline below) with a back chevron and a
  // quiet subtitle (the message's counterparty once loaded; the box name while it's still loading).
  // 54dp of CONTENT below the safe-area inset, with a 44x44 tap target on the chevron (design §detail).
  // The banner is a SIBLING of the header bar, not a child of it - nesting it inside the header's
  // YStack made Android draw-clip its label ("Testovací" instead of "Testovací prostředí"). Every
  // other screen puts it at the top of the root column; this one now does too.
  const renderHeader = (subtitle: string) => (
    <>
      <TestEnvBanner show={showTestBanner} />
      <YStack backgroundColor={theme.surfaceAlt}>
        <XStack
          alignItems="center"
          paddingLeft={6}
          paddingRight={16}
          paddingTop={headerTop}
          height={headerTop + 54}
        >
          <XStack
            width={44}
            height={44}
            alignItems="center"
            justifyContent="center"
            borderRadius={999}
            hitSlop={touchSlop({ width: 44, height: 44 })}
            pressStyle={{ opacity: 0.5 }}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            testID="back"
          >
            <ChevronLeftIcon size={24} color={theme.text} />
          </XStack>
          <BodyStrong
            flex={1}
            minWidth={0}
            fontSize={13}
            color={theme.textFaint}
            letterSpacing={0.3}
            numberOfLines={1}
          >
            {subtitle}
          </BodyStrong>
        </XStack>
        <YStack height={1} backgroundColor={theme.border} />
      </YStack>
    </>
  );

  const boxName = account.alias ?? account.label;

  if (state.status === 'loading') {
    return (
      <YStack flex={1} backgroundColor={theme.bg}>
        {renderHeader(boxName)}
        <DetailSkeleton />
      </YStack>
    );
  }

  if (state.status === 'error') {
    return (
      <YStack flex={1} backgroundColor={theme.bg}>
        {renderHeader(boxName)}
        <YStack
          flex={1}
          alignItems="center"
          justifyContent="center"
          padding="$4"
          gap="$3"
        >
          <Paragraph color={theme.danger} textAlign="center">
            {t(state.messageKey)}
          </Paragraph>
          <Button
            minHeight={48}
            borderRadius={14}
            paddingHorizontal={28}
            backgroundColor={theme.surface}
            borderWidth={1}
            borderColor={theme.borderStrong}
            color={theme.text}
            fontWeight="700"
            onPress={onBack}
            testID="retry"
          >
            {t('common.back')}
          </Button>
        </YStack>
      </YStack>
    );
  }

  const { envelope, attachments, unavailable, incomplete, original } = state;
  const isSent = folder === 'sent';
  // The counterparty the message is "with" - recipient for sent, sender for received.
  const party = isSent ? envelope.recipient ?? '—' : envelope.sender;
  // Offer re-download when any attachment is unusable: a deleted file (missingAtt) OR one with no
  // local file at all (couldn't be decoded/saved) - a fresh download may recover it.
  const anyBlocked =
    missingAtt.size > 0 || (attachments?.some(a => !a.localPath) ?? false);
  // Large (VoDZ) download feedback. We get a climbing byte count, no total (ISDS sends no
  // Content-Length); the response is base64, so the decoded size ≈ bytes × 0.75. If there's a single
  // attachment whose size we already know (a re-download), show a real %; otherwise the downloaded
  // amount just climbs. Inline (≤20 MB) downloads report nothing → plain "Stahování…".
  // Not while enclosures are missing: the one attachment held then is not the one being fetched.
  const knownTotal =
    attachments?.length === 1 && !incomplete ? attachments[0].size ?? null : null;
  const decodedBytes = downloadedBytes != null ? downloadedBytes * 0.75 : null;
  const downloadFraction =
    knownTotal != null && decodedBytes != null && knownTotal > 0
      ? Math.min(1, decodedBytes / knownTotal)
      : null;
  const downloadingLabel =
    downloadFraction != null
      ? `${t('detail.attachments.downloading')} ${Math.round(
          downloadFraction * 100,
        )} %`
      : decodedBytes != null
      ? `${t('detail.attachments.downloading')} ${formatBytes(decodedBytes)}`
      : t('detail.attachments.downloading');

  // The message's state, shared with the list so the two screens can never disagree.
  const status = messageStatus(envelope.state);
  const statusTone = chipTone(status.tone, theme);

  // Received: a message ALREADY served by fiction → an attention banner. Not a countdown; see
  // `fikce.ts` for why the received side can never have one.
  const servedAt = isSent ? null : servedByFiction(envelope);
  const fikceTone = servedAt != null ? chipTone('statusFiction', theme) : null;

  // Sent: the delivery timeline. ISDS exposes only `deliveryTime` (dmDeliveryTime) + `acceptanceTime`
  // (dmAcceptanceTime); delivery into the box is effectively the send instant, so Odesláno + Dodáno
  // share `deliveryTime` (no time is fabricated), and the final step carries `acceptanceTime`.
  //
  // 013: the third step is no longer always "Doručeno", and the journey no longer always continues.
  //   * state 5 → the step becomes `Doručeno fikcí`, gold, with a note saying nobody signed in.
  //   * state 3 / 8 → the journey STOPS. The remaining steps are dropped entirely rather than left
  //     greyed out, because a greyed-out step reads as "still coming" when nothing is coming, and a
  //     `stopWhy` paragraph below explains what to do instead.
  // ISDS gives us no timestamp for the stop itself, so that step shows an em-dash rather than
  // borrowing another step's time.
  const steps: {
    kind: MessageStateKind;
    labelKey: string;
    time: number | null | undefined;
    done: boolean;
    noteKey?: string;
  }[] = [
    {
      kind: 'sent',
      labelKey: 'messages.status.sent',
      time: envelope.deliveryTime,
      done: true,
    },
  ];
  if (envelope.state === MESSAGE_STATE.antivirusFailed) {
    // Failed before it ever reached a box - the journey ends at step 2.
    steps.push({
      kind: 'stop',
      labelKey: status.labelKey,
      time: null,
      done: true,
    });
  } else {
    steps.push({
      kind: 'delivered',
      labelKey: 'detail.delivered',
      time: envelope.deliveryTime,
      done: envelope.state >= MESSAGE_STATE_DELIVERED,
    });
    if (envelope.state === MESSAGE_STATE.undeliverable) {
      steps.push({
        kind: 'stop',
        labelKey: status.labelKey,
        time: null,
        done: true,
      });
    } else {
      const byFiction = status.kind === 'fiction';
      steps.push({
        kind: byFiction ? 'fiction' : 'accepted',
        labelKey: byFiction ? 'status.byFiction' : 'detail.accepted',
        time: envelope.acceptanceTime,
        done: envelope.state >= MESSAGE_STATE_SERVED,
        noteKey: byFiction ? 'status.byFiction.note' : undefined,
      });
    }
  }
  // "Odesláno" and "Dodáno" both render `deliveryTime` - ISDS reports no separate submission time -
  // so once the message HAS been delivered the rail was printing one fact under two labels, implying
  // the app knew two moments. Collapsed into one row that says as much (017 T011). While the message
  // is still on its way the two stay separate, because then they are a real progression.
  const sentSteps = mergeSameTimeHead(steps, formatDateTime, {
    labelKey: 'sent.merged',
    noteKey: 'sent.merged.note',
  });
  const stopWhyKey = stopReasonKey(envelope.state);

  // Standing "no longer in ISDS" notice (B2) - shown wherever a re-download would otherwise be offered.
  // Standalone (nothing downloaded) it carries the section's own 22dp top margin; inside the downloaded
  // attachment stack the surrounding gap already spaces it, so the caller passes 0.
  const renderUnavailableNotice = (marginTop: number) => (
    <YStack
      marginTop={marginTop}
      backgroundColor={theme.surface}
      borderWidth={1}
      borderColor={theme.border}
      borderRadius={14}
      padding={15}
    >
      <XStack gap={12} alignItems="flex-start">
        <YStack
          width={40}
          minHeight={40}
          borderRadius={11}
          backgroundColor={theme.surfaceSunken}
          alignItems="center"
          justifyContent="center"
        >
          <FileXIcon size={20} color={theme.textFaint} />
        </YStack>
        <YStack flex={1} gap={3}>
          <BodyStrong fontSize={14} color={theme.text}>
            {t('detail.attachments.unavailable.title')}
          </BodyStrong>
          <Caption color={theme.textMuted}>
            {t('detail.attachments.unavailable.body')}
          </Caption>
        </YStack>
      </XStack>
    </YStack>
  );

  // The soft-gold missing-attachments notice (DESIGN.md) with the download that brings them back - one
  // card, the same metrics, for files gone from the device and for enclosures that never arrived. The
  // last failure keeps its line while a retry runs, transparent and hidden from screen readers, so the
  // button and the rows under the card stay where they are (constitution V).
  const renderMissingNotice = (message: string, actionLabel: string, testID: string) => (
    <YStack
      backgroundColor={theme.goldSoft}
      borderRadius={14}
      padding={12}
      gap={10}
    >
      <Caption color={theme.warningInk} fontWeight="600">
        {message}
      </Caption>
      {downloadError ? (
        <Caption
          color={theme.danger}
          opacity={downloading ? 0 : 1}
          accessibilityElementsHidden={downloading}
          importantForAccessibility={downloading ? 'no-hide-descendants' : 'auto'}
          testID="downloadError"
        >
          {downloadError}
        </Caption>
      ) : null}
      <PressScale
        fullWidth
        busy={downloading}
        onPress={downloadAttachments}
        accessibilityLabel={actionLabel}
        testID={testID}
      >
        <XStack
          width="100%"
          minHeight={46}
          borderRadius={13}
          borderWidth={1}
          borderColor={theme.borderStrong}
          backgroundColor={theme.surface}
          alignItems="center"
          justifyContent="center"
          gap={8}
          opacity={downloading ? 0.55 : 1}
        >
          {downloading ? null : (
            <DownloadIcon size={17} color={theme.text} />
          )}
          <BodyStrong fontSize={14} color={theme.text}>
            {downloading ? downloadingLabel : actionLabel}
          </BodyStrong>
        </XStack>
      </PressScale>
      <ProgressBar
        downloading={downloading}
        fraction={downloadFraction}
      />
    </YStack>
  );

  const renderAttachmentsNotice = (count: number) => {
    const notice = attachmentsNotice({ incomplete, anyBlocked, unavailable });
    if (notice === 'unavailable') {
      return renderUnavailableNotice(0);
    }
    if (notice === 'incomplete') {
      return renderMissingNotice(
        t(`detail.attachments.incomplete.${plural(count)}`, { n: count }),
        t('detail.attachments.downloadMissing'),
        'downloadMissingAttachments',
      );
    }
    if (notice === 'someMissing') {
      return renderMissingNotice(
        t('detail.attachments.someMissing'),
        t('detail.attachments.redownload'),
        'redownloadAttachments',
      );
    }
    return null;
  };

  // A full-bleed banner at the top of the scroll: the fikce attention band (received only). A sent
  // message no longer gets one - its state is spelled out step by step in the delivery timeline
  // below, so a coloured band restating the last step was redundant and pushed the subject down.
  const banner =
    servedAt != null && fikceTone ? (
      <XStack
        backgroundColor={fikceTone.bg}
        paddingHorizontal={18}
        paddingVertical={12}
        alignItems="center"
        gap={10}
      >
        {/* The solid disc, not the timer: nothing is counting down any more. Same mark the sent side
            uses for the same event, so the two read as one thing. */}
        <StatusAcceptedIcon
          size={18}
          color={fikceTone.fg}
          knockout={fikceTone.bg}
        />
        <Badge color={fikceTone.fg} fontWeight="700" lineHeight={18} flex={1}>
          {fikceBannerLabel(servedAt)}
        </Badge>
      </XStack>
    ) : null;

  return (
    <YStack flex={1} backgroundColor={theme.bg}>
      {renderHeader(party)}
      <ScrollView contentContainerStyle={{ paddingBottom: contentBottom }}>
        {banner}
        <YStack paddingHorizontal={20} paddingTop={22}>
          {/* Bricolage subject - the loud line (design detail subject ≈ 25). */}
          <Title
            color={theme.text}
            fontSize={25}
            fontWeight="700"
            lineHeight={31}
            letterSpacing={-0.6}
          >
            {envelope.subject || t('detail.noSubject')}
          </Title>

          {/* Identity card: a "postmark" for received (sender + delivered/accepted), a "Komu" card for
              sent (recipient + box ID). */}
          {isSent ? (
            <YStack
              marginTop={20}
              backgroundColor={theme.surface}
              borderWidth={1}
              borderColor={theme.border}
              borderRadius={16}
              padding={16}
            >
              <XStack gap={14} alignItems="flex-start">
                <Avatar name={party} size={52} />
                <YStack flex={1} minWidth={0}>
                  <Label
                    fontSize={11}
                    fontWeight="700"
                    textTransform="uppercase"
                    letterSpacing={0.4}
                    color={theme.textFaint}
                  >
                    {t('detail.to')}
                  </Label>
                  <BodyStrong color={theme.text} marginTop={2}>
                    {envelope.recipient ?? '—'}
                  </BodyStrong>
                  {/* Who this actually went to (015 US3). Already in the archive - no ISDS call. */}
                  <AddressLines address={envelope.recipientAddress} marginTop={4} />
                  {envelope.recipientBoxId ? (
                    <Caption
                      color={theme.textFaint}
                      numberOfLines={1}
                      marginTop={7}
                    >
                      {'ID ' + envelope.recipientBoxId}
                    </Caption>
                  ) : null}
                </YStack>
              </XStack>
            </YStack>
          ) : (
            <YStack
              marginTop={20}
              backgroundColor={theme.surface}
              borderWidth={1}
              borderColor={theme.border}
              borderRadius={16}
              padding={16}
            >
              <XStack gap={14} alignItems="center">
                <Avatar name={party} size={52} />
                <YStack flex={1} minWidth={0}>
                  <BodyStrong color={theme.text}>
                    {envelope.sender || '—'}
                  </BodyStrong>
                  {/* Where it actually came from (015 US2). Stored when the message entered the
                      archive, so this works offline and costs no ISDS call. */}
                  <AddressLines address={envelope.senderAddress} marginTop={4} />
                  {/* The delivery facts used to live HERE, as one grey line in the same muted tone
                      as the box ID - the weakest presentation in the app on the fact every deadline
                      runs from. They now have their own record below (017). */}
                </YStack>
              </XStack>
            </YStack>
          )}

          {/* Received: the delivery record, a SIBLING of the sender card rather than a panel inside
              it (the design has them as two cards). Nesting it read as a sub-detail of the sender;
              it is the message's own legal receipt. */}
          {!isSent ? (
            <DeliveryRecordCard
              record={deliveryRecord(envelope, formatDateTime)}
            />
          ) : null}

          {/* Sent: the delivery timeline. Each step is its own state glyph on a left rail, joined to
              the next by a dotted connector, so the three ISDS moments read as one progression rather
              than three unrelated rows. A step that has not happened yet is drawn in `borderStrong` -
              still occupying its full height, so the card never resizes as a message advances. */}
          {/* The user's deadline. Received only, and above the delivery status because it is the one
              thing on this screen the user can DO something about - everything below reports what
              ISDS did. */}
          {!isSent ? (
            // The card carries the border so the "notifications are off" line can sit inside it,
            // under the row it is about. Without that line the card draws exactly what the row drew
            // on its own: the same border, radius, padding and height.
            <YStack
              marginTop={22}
              borderWidth={1}
              borderRadius={14}
              borderColor={theme.border}
              backgroundColor={theme.surface}
              overflow="hidden"
            >
              <XStack
                alignItems="center"
                gap={12}
                paddingVertical={13}
                paddingHorizontal={14}
                pressStyle={{ opacity: 0.7 }}
                onPress={() => setPickingTerm(true)}
                accessibilityRole="button"
                accessibilityLabel={t('term.action')}
                testID="detail-term"
              >
                <TimerIcon size={18} color={theme.textFaint} />
                <YStack flex={1}>
                  <BodyStrong fontSize={15} color={theme.text}>
                    {t('term.action')}
                  </BodyStrong>
                  <Caption fontSize={12} marginTop={2} color={theme.textFaint}>
                    {term != null
                      ? t('term.chip', { d: formatTermDate(term) })
                      : t('term.none')}
                  </Caption>
                </YStack>
                <ChevronRightIcon size={18} color={theme.textFaint} />
              </XStack>
              {/* Only for a date that is set, and only when saving could not change it: while the
                  box's first reminder is still being asked about (`ask`), the OS dialog is the answer. */}
              {term != null && reminderAlerts.alerts === 'off' ? (
                <AlertsOffLine onTurnOn={reminderAlerts.turnOn} />
              ) : null}
            </YStack>
          ) : null}

          {/* Directly under the deadline row it feeds: the suggestion's only outcome is to fill that
              row in, so it belongs beside it rather than down by the attachments it was read from. */}
          {!isSent ? (
            <DeadlineSuggestionCard
              scanning={scanning}
              suggestion={suggestion}
              onAccept={date => {
                // An accepted estimate becomes an ORDINARY reminder - same storage, same chip, same
                // two notifications - but stamped `createdBy: 'scan'`, so the record of where the
                // date came from survives the acceptance.
                setTerm(date);
                setSuggestion(null);
                void remindersController
                  .setReminder(account.boxId, messageId, date, envelope.subject, 'scan')
                  .then(reminderAlerts.refresh, reminderAlerts.refresh);
              }}
              onDismiss={() => {
                setSuggestion(null);
                void scanController.dismiss(account.boxId, messageId);
              }}
            />
          ) : null}

          {isSent ? (
            <>
              <Label
                marginTop={22}
                marginBottom={8}
                paddingLeft={2}
                fontSize={12}
                fontWeight="700"
                textTransform="uppercase"
                letterSpacing={0.4}
                color={theme.textFaint}
              >
                {t('detail.deliveryStatus')}
              </Label>
              <YStack
                backgroundColor={theme.surface}
                borderWidth={1}
                borderColor={theme.border}
                borderRadius={16}
                paddingHorizontal={16}
                paddingTop={14}
                paddingBottom={8}
              >
                {/* The state, named, above the rail. The timeline shows the journey; this says where
                    it currently stands - which the rail alone cannot, now that it can end early. */}
                <XStack marginBottom={14}>
                  <XStack
                    minHeight={24}
                    alignItems="center"
                    paddingHorizontal={10}
                    borderRadius={9}
                    backgroundColor={statusTone.bg}
                  >
                    <Badge fontSize={11} letterSpacing={0.3} color={statusTone.fg}>
                      {t(status.labelKey)}
                    </Badge>
                  </XStack>
                </XStack>
                {sentSteps.map((step, i) => {
                  const last = i === sentSteps.length - 1;
                  // A reached step takes its own state colour; one still ahead stays neutral. The
                  // connector below an icon inherits that same colour, so the rail fades out exactly
                  // where the message's progress stops.
                  const stepColor = step.done
                    ? chipTone(
                        step.kind === 'stop'
                          ? 'statusStop'
                          : step.kind === 'fiction'
                          ? 'statusFiction'
                          : step.kind === 'accepted'
                          ? 'statusRead'
                          : step.kind === 'delivered'
                          ? 'statusDelivered'
                          : 'statusSent',
                        theme,
                      ).fg
                    : theme.borderStrong;
                  return (
                    <XStack key={step.kind} gap={12}>
                      <YStack width={18} flexShrink={0} alignItems="center">
                        <DeliveryStateIcon
                          kind={step.kind}
                          color={stepColor}
                          // The discs sit on the card, so they knock out against it.
                          knockout={theme.surface}
                        />
                        {/* SVG, not a dotted border: one-sided dotted borders render SOLID on iOS
                            (see `DottedRail`). */}
                        {!last ? <DottedRail color={stepColor} /> : null}
                      </YStack>
                      <YStack flex={1} minWidth={0} paddingBottom={last ? 0 : 14}>
                        <XStack
                          alignItems="center"
                          justifyContent="space-between"
                          gap={10}
                          minHeight={18}
                        >
                          <Value
                            color={step.done ? theme.text : theme.textFaint}
                          >
                            {t(step.labelKey)}
                          </Value>
                          <Caption
                            flexShrink={0}
                            fontWeight="600"
                            color={step.done ? theme.bodyText : theme.textFaint}
                          >
                            {step.time != null ? formatDateTime(step.time) : '—'}
                          </Caption>
                        </XStack>
                        {step.noteKey ? (
                          <Caption
                            fontSize={12}
                            lineHeight={16}
                            marginTop={3}
                            color={theme.textFaint}
                          >
                            {t(step.noteKey)}
                          </Caption>
                        ) : null}
                      </YStack>
                    </XStack>
                  );
                })}
                {/* Why it stopped, and what to do instead - a terminal state without this is just a
                    dead end the user has to interpret. Full-bleed hairline above, like the design. */}
                {stopWhyKey ? (
                  <YStack
                    borderTopWidth={1}
                    borderTopColor={theme.border}
                    marginTop={6}
                    marginHorizontal={-16}
                    paddingHorizontal={16}
                    paddingTop={12}
                    paddingBottom={4}
                  >
                    <Body
                      fontSize={13}
                      fontWeight="500"
                      lineHeight={18}
                      color={theme.textMuted}
                    >
                      {t(stopWhyKey)}
                    </Body>
                  </YStack>
                ) : null}
                {/* A footnote on a journey that already finished: ISDS erased the content, or the
                    message moved into the user's Datový trezor. Neither is a state change worth a
                    step, and both matter when the user wonders where the attachments went. */}
                {status.annotation ? (
                  <XStack
                    borderTopWidth={1}
                    borderTopColor={theme.border}
                    marginTop={6}
                    marginHorizontal={-16}
                    paddingHorizontal={16}
                    paddingTop={11}
                    paddingBottom={4}
                    alignItems="center"
                    gap={8}
                  >
                    {status.annotation === 'erased' ? (
                      <ContentErasedIcon size={15} color={theme.textFaint} />
                    ) : (
                      <VaultIcon size={15} color={theme.textFaint} />
                    )}
                    <Badge fontSize={12} color={theme.textMuted}>
                      {t(
                        status.annotation === 'erased'
                          ? 'status.note.erased'
                          : 'status.note.vault',
                      )}
                    </Badge>
                  </XStack>
                ) : null}
              </YStack>
            </>
          ) : null}

          {/* Attachments - shared by both folders (a sent message can carry documents too). The
              heading is suppressed in the expired state: the "no longer available" notice stands
              alone there (design). The count only exists once a download confirmed the contents. */}
          {attachments || !unavailable ? (
            <XStack marginTop={22} alignItems="center" gap={7}>
              <Heading fontSize={15} color={theme.text}>
                {t('detail.attachments')}
              </Heading>
              {attachments ? (
                <Caption color={theme.textFaint} fontWeight="700">
                  {String(attachments.length)}
                </Caption>
              ) : null}
            </XStack>
          ) : null}

          {/* Downloaded → the whole message (attachments included) is now in the offline archive.
              Design: a confirmation line 6dp under the heading - 12px bold green + a 14px check. */}
          {/* "Celá zpráva uložena" while files are missing is a green tick over the amber card
              twenty lines below saying the opposite. Reached by restoring a backup - the backup
              carries the message rows and deliberately not the attachment bytes. */}
          {/* Nor while enclosures of a large-volume message never arrived (constitution IV). */}
          {attachments ? (
            <XStack marginTop={6} alignItems="center" gap={6}>
              {anyBlocked || incomplete ? (
                <AlertIcon size={14} color={theme.warningInk} />
              ) : (
                <CheckIcon size={14} color={theme.success} />
              )}
              <Badge
                fontSize={12}
                color={anyBlocked || incomplete ? theme.warningInk : theme.success}
              >
                {t(savedBadgeKey(anyBlocked || incomplete))}
              </Badge>
            </XStack>
          ) : null}

          {attachments ? (
            // Downloaded → we now know the real contents. List them, or - only now that it is
            // confirmed by an actual download - say there are none. (We must NEVER infer "no
            // attachments" from the list's dmAttachmentSize: it is the size in KB, rounded, so a
            // small file reports 0 and would otherwise hide a real attachment.)
            attachments.length > 0 ? (
              <YStack marginTop={10} gap={8}>
                {renderAttachmentsNotice(attachments.length)}
                {attachments.map((att, i) => (
                  <AttachmentRow
                    key={`${att.name}-${i}`}
                    attachment={att}
                    index={i}
                    missing={missingAtt.has(i)}
                  />
                ))}
              </YStack>
            ) : (
              <Body marginTop={8} color={theme.textMuted}>
                {t('detail.attachments.none')}
              </Body>
            )
          ) : unavailable ? (
            // Never downloaded AND now gone from ISDS → no point offering a download.
            renderUnavailableNotice(22)
          ) : downloading ? (
            // Downloading → the design replaces the whole pending card + CTA with a quiet label over
            // the progress track (nothing else to act on while the fetch is in flight).
            <YStack marginTop={14}>
              <Label fontSize={12} color={theme.textMuted} marginBottom={6}>
                {downloadingLabel}
              </Label>
              <ProgressBar downloading fraction={downloadFraction} />
            </YStack>
          ) : (
            // Not downloaded → always offer the download (attachments can be large, and we cannot
            // know from the envelope whether/how many there are - every data message has documents).
            <>
              <YStack
                marginTop={10}
                backgroundColor={theme.surface}
                borderWidth={1}
                borderColor={theme.border}
                borderRadius={14}
                padding={15}
              >
                <XStack gap={13} alignItems="flex-start">
                  <YStack
                    width={40}
                    minHeight={40}
                    borderRadius={11}
                    backgroundColor={theme.surfaceSunken}
                    alignItems="center"
                    justifyContent="center"
                  >
                    <MailIcon size={20} color={theme.textFaint} />
                  </YStack>
                  {/* Design: a title/sub PAIR - "Zpráva obsahuje přílohy" over the explanation. */}
                  <YStack flex={1}>
                    <BodyStrong fontSize={14} fontWeight="700" color={theme.text}>
                      {t('detail.attachments.containsAtts')}
                    </BodyStrong>
                    <Caption
                      marginTop={3}
                      fontSize={13}
                      lineHeight={18}
                      color={theme.textMuted}
                    >
                      {t('detail.attachments.namesAfter')}
                    </Caption>
                  </YStack>
                </XStack>
              </YStack>
              {downloadError ? (
                <Caption marginTop={10} color={theme.danger}>
                  {downloadError}
                </Caption>
              ) : null}
              {/* Blue primary action (design §detail) - a sibling BELOW the card, not inside it.
                  The download is what puts the whole message in the offline archive (and counts as
                  delivery), so the label + the quiet note under it say exactly that. */}
              <PressScale
                fullWidth
                style={{ marginTop: 12 }}
                onPress={downloadAttachments}
                accessibilityLabel={t('detail.attachments.downloadFull')}
                testID="downloadAttachments"
              >
                <XStack
                  width="100%"
                  minHeight={48}
                  borderRadius={13}
                  backgroundColor={theme.blue}
                  alignItems="center"
                  justifyContent="center"
                  gap={8}
                >
                  <DownloadIcon size={17} color={theme.onBlue} />
                  <BodyStrong fontSize={14} color={theme.onBlue}>
                    {t('detail.attachments.downloadFull')}
                  </BodyStrong>
                </XStack>
              </PressScale>
              <Caption
                marginTop={8}
                fontSize={12}
                lineHeight={16}
                color={theme.textFaint}
                textAlign="center"
              >
                {t(downloadNoteKey({ isSent, servedByFiction: servedAt != null }))}
              </Caption>
            </>
          )}

          {/* The signed original (004 amendment), once the contents are known: it arrives with the
              attachments, and a message downloaded before originals were kept fetches it from here. */}
          {attachments ? (
            <SignedOriginalSection
              account={account}
              messageId={messageId}
              folder={folder}
              envelope={envelope}
              original={original}
              unavailable={unavailable}
              formatSize={formatBytes}
              onChange={detail =>
                setState(s =>
                  s.status === 'ready'
                    ? {
                        ...s,
                        original: detail.signedZfo ?? null,
                        unavailable: detail.attachmentsUnavailable ?? false,
                      }
                    : s,
                )
              }
            />
          ) : null}
        </YStack>
      </ScrollView>
      {pickingTerm ? (
        <TermPicker
          current={term}
          alertsOff={reminderAlerts.alerts === 'off'}
          onPick={date => {
            setTerm(date); // optimistic: the write is local and cannot meaningfully fail
            // Read again once saved: the box's first reminder asks the OS, and the answer decides
            // whether the row below the closing sheet says the alert will not come.
            void remindersController
              .setReminder(account.boxId, messageId, date, envelope?.subject ?? null)
              .then(reminderAlerts.refresh, reminderAlerts.refresh);
          }}
          onRemove={() => {
            setTerm(null);
            void remindersController
              .removeReminder(account.boxId, messageId)
              .then(reminderAlerts.refresh, reminderAlerts.refresh);
          }}
          onClose={() => setPickingTerm(false)}
        />
      ) : null}
    </YStack>
  );
}

/**
 * A thin determinate progress bar for the large-attachment download - rendered into a CONSTANT-height
 * slot so its appearance never shifts the rows below (no layout jump, constitution V). Idle: an empty
 * reserved 6px. Downloading: a sunken track with a blue fill (a 35% stub when the total is unknown).
 */
function ProgressBar({
  downloading,
  fraction,
}: {
  readonly downloading: boolean;
  readonly fraction: number | null;
}) {
  const theme = useTheme();
  return (
    <YStack height={6} justifyContent="center">
      {downloading ? (
        <YStack
          height={6}
          borderRadius={3}
          backgroundColor={theme.surfaceSunken}
          overflow="hidden"
        >
          <YStack
            height={6}
            borderRadius={3}
            backgroundColor={theme.blue}
            width={
              fraction != null
                ? `${Math.max(8, Math.min(100, Math.round(fraction * 100)))}%`
                : '40%'
            }
          />
        </YStack>
      ) : null}
    </YStack>
  );
}

/**
 * A downloaded attachment row - its content is cached, so it opens offline. Tap → write to a file and
 * open in the OS viewer. The ✓ marks it as saved offline.
 */
function AttachmentRow({
  attachment,
  index,
  missing,
}: {
  readonly attachment: MessageAttachment;
  readonly index: number;
  /** The on-disk file is gone - show it as missing, don't try to open it. */
  readonly missing: boolean;
}) {
  const theme = useTheme();
  const [opening, setOpening] = useState(false);
  /**
   * One viewer per tap (audit 2026-09-23). `opening` dims the row and says "Otevírání…", but it is
   * state and lands a render late: a double tap got past it and launched the viewer twice.
   */
  const openOnce = useSingleFlight();
  const afterPressSettles = useAfterPressSettles();
  /** Why an attachment would not open. The app's own dialog, never the OS alert (theme/Dialog). */
  const [attachmentAlert, setAttachmentAlert] = useState<string | null>(null);
  const size = attachment.size != null ? formatBytes(attachment.size) : '';
  // No file path on a downloaded attachment ⇒ it couldn't be decoded/saved (malformed data). Like a
  // missing file it can't be opened, but it's not recoverable by re-download - show it as such.
  const corrupt = !missing && !attachment.localPath;
  const blocked = missing || corrupt;

  // Returning from the external viewer always clears the "opening" flag so the attachment can be
  // reopened - even if the open() promise is still pending across the background→foreground hop
  // (otherwise the row stays stuck "opening" and the guard below blocks every later tap).
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        setOpening(false);
        openOnce.release();
      }
    });
    return () => sub.remove();
  }, [openOnce]);

  const open = () => {
    void openOnce(async () => {
      haptics.selection(); // a light tick on opening an attachment
      setOpening(true);
      // Defer the launch until AFTER the press interaction settles. Launching an external activity
      // mid-press can leave RN's JS touch responder held by this row across the app backgrounding;
      // on return it's never released, which freezes touches across the WHOLE screen (incl. Back).
      // Waiting for the queued work lets the press release (onPressOut) before we background.
      await new Promise<void>(launched => {
        afterPressSettles(async () => {
          try {
            await attachmentOpener.open(attachment);
          } catch (e) {
            const key =
              e instanceof NoViewerError
                ? 'detail.attachment.noViewer'
                : 'detail.attachment.openError';
            setAttachmentAlert(t(key));
          } finally {
            setOpening(false);
            launched();
          }
        });
      });
    });
  };

  return (
    <>
    <GHPressable
      onPress={() => {
        if (!blocked) {
          open(); // a missing/undecodable file can't be opened
        }
      }}
      accessibilityRole="button"
      accessibilityLabel={t('detail.attachment.open', {
        name: attachment.name,
      })}
      testID={`attachment-${index}`}
      style={({ pressed }) => ({ opacity: pressed && !blocked ? 0.7 : 1 })}
    >
      <XStack
        alignItems="center"
        gap={12}
        paddingVertical={11}
        paddingHorizontal={13}
        backgroundColor={theme.surface}
        borderWidth={1}
        borderColor={theme.border}
        borderRadius={14}
      >
        {/* A NEUTRAL tile (design §detail attachments): a sunken square with a quiet file glyph - no
            per-extension colour fill, no extension label. Only the blocked state colours it. */}
        <YStack
          width={40}
          minHeight={40}
          borderRadius={11}
          backgroundColor={theme.surfaceSunken}
          alignItems="center"
          justifyContent="center"
        >
          {blocked ? (
            <AlertIcon size={20} color={theme.danger} />
          ) : (
            <FileIcon size={19} color={theme.textMuted} />
          )}
        </YStack>
        <YStack flex={1} minWidth={0}>
          <Value color={theme.text} numberOfLines={1}>
            {attachment.name || '—'}
          </Value>
          {blocked ? (
            <Caption marginTop={1} color={theme.danger} numberOfLines={1}>
              {missing
                ? t('detail.attachment.missing')
                : t('detail.attachment.corrupt')}
            </Caption>
          ) : (
            // The sub-line carries the size only - the "saved offline" mark lives on the right (design).
            <Caption
              fontSize={12}
              marginTop={1}
              color={theme.textFaint}
              numberOfLines={1}
            >
              {opening ? t('detail.attachment.opening') : size}
            </Caption>
          )}
        </YStack>
        {blocked ? null : opening ? (
          <Spinner size="small" color={theme.blue} />
        ) : (
          <XStack alignItems="center" gap={4} flexShrink={0}>
            <CheckIcon size={15} color={theme.success} />
            <Badge fontSize={12} color={theme.success}>
              {t('detail.attachment.savedOffline')}
            </Badge>
          </XStack>
        )}
      </XStack>
    </GHPressable>
    {attachmentAlert ? (
      <Dialog
        title={t('detail.attachments')}
        body={attachmentAlert}
        onDismiss={() => setAttachmentAlert(null)}
        testID="attachment-alert"
        actions={[
          {
            label: t('common.ok'),
            tone: 'primary',
            testID: 'attachment-alert-ok',
            onPress: () => setAttachmentAlert(null),
          },
        ]}
      />
    ) : null}
    </>
  );
}

/** Loading placeholder mirroring the detail layout: subject + identity card + one attachment row. */
function DetailSkeleton() {
  const theme = useTheme();
  return (
    <YStack padding={16} paddingTop={18}>
      <Skeleton width="85%" height={25} radius={7} />
      <Skeleton width="55%" height={25} radius={7} style={{ marginTop: 8 }} />

      <XStack
        marginTop={20}
        gap={14}
        alignItems="center"
        backgroundColor={theme.surface}
        borderWidth={1}
        borderColor={theme.border}
        borderRadius={16}
        padding={16}
      >
        <Skeleton width={48} height={48} radius={14} />
        <YStack flex={1} gap={8}>
          <Skeleton width="55%" height={15} radius={6} />
          <Skeleton width="78%" height={12} radius={6} />
        </YStack>
      </XStack>

      <Skeleton
        width={120}
        height={18}
        radius={6}
        style={{ marginTop: 22, marginBottom: 12 }}
      />
      <XStack
        gap={12}
        alignItems="center"
        backgroundColor={theme.surface}
        borderWidth={1}
        borderColor={theme.border}
        borderRadius={14}
        padding={12}
      >
        <Skeleton width={40} height={40} radius={11} />
        <YStack flex={1} gap={7}>
          <Skeleton width="50%" height={14} radius={6} />
          <Skeleton width={96} height={11} radius={6} />
        </YStack>
      </XStack>
    </YStack>
  );
}
