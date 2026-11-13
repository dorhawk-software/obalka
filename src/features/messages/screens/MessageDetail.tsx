import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { touchSlop } from '../../../theme/touchTarget';
import { Animated } from 'react-native';
import { XStack, YStack } from '../../../theme/ui';
import { PressScale } from '../../../theme/PressScale';
import { Skeleton } from '../../../theme/Skeleton';
import { attachmentFileStore } from '../../../services/files/attachmentFileStore';
import { Body, BodyStrong, Caption, Heading, Label, Meta, Small, SmallStrong } from '../../../theme/Typography';
import { useTheme } from '../../../theme/ThemeProvider';
import {
  AlertIcon,
  ChevronLeftIcon,
  DownloadIcon,
  FileXIcon,
  ChevronRightIcon,
} from '../../../theme/icons';
import { useHeaderTop } from '../../../theme/useHeaderTop';
import { useContentBottom } from '../../../theme/useContentBottom';
// gesture-handler Pressable for the attachment row: a plain RN/Tamagui onPress holds the JS touch
// responder across the app backgrounding to the external PDF viewer, and on return it's never released
// - freezing touches across the WHOLE detail screen. gesture-handler uses native recognisers, no stuck
// responder.
import { TestEnvBanner } from '../../../app/TestEnvBanner';
import { formatBytes, plural, t } from '../../../i18n/strings';
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
} from '../state/messageState';
import { TermPicker, formatTermDate } from './TermPicker';
import { DeadlineSuggestionCard } from './DeadlineSuggestion';
import { AlertsOffLine, useReminderAlerts } from './ReminderAlerts';
import type { ScanSuggestion } from '../../../services/scan/attachmentScan';
import type { Reminder } from '../state/reminders';
import { AttachmentRow } from './AttachmentRow';
import { DeliveryRecordSlip, SentRecordSlip, type SentStep } from './DeliveryRecord';
import { DetailBand, useTuck } from './DetailBand';
import { DetailEnvelope } from './DetailEnvelope';
import { TileAtRest, type TileRect } from './EnvelopeFlight';
import { FictionBanner } from './FictionBanner';
import { SignedOriginalSection } from './SignedOriginalSection';
import {
  deliveryRecord,
  mergeSameTimeHead,
} from '../state/deliveryRecord';
import { Card } from '../../../theme/Card';
import { Well } from '../../../theme/Well';
import { NeutralButton } from '../../../theme/NeutralButton';
import { EmptyObject } from '../../../theme/EmptyObject';
import { EnvelopePose } from '../../../theme/objects/Envelope';
import { OffsetIcon } from '../../../theme/offsetIcons';

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
      /** When a listing last brought the envelope's state, or null - the sent card's "Stav k". */
      syncedAt: number | null;
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

export interface MessageDetailProps {
  readonly account: DataBoxAccount;
  readonly messageId: string;
  /** Which folder it was opened from (008): a sent message orients you → recipient + isn't "read". */
  readonly folder?: MessageFolder;
  readonly onBack: () => void;
  /** The row's tile it was opened from, which grows into the envelope (board Motion 1). */
  readonly openedFrom?: TileRect;
}

export function MessageDetail({ account, messageId, folder = 'received', onBack, openedFrom }: MessageDetailProps) {
  const theme = useTheme();
  // czebox boxes get a persistent "Testovací" banner pushed in above the header (US3, no overlap).
  const showTestBanner = account.host === 'czebox';
  const headerTop = useHeaderTop(showTestBanner);
  const contentBottom = useContentBottom(24);
  const tuck = useTuck(); // the envelope tucking into the bar as the message scrolls (DetailBand)
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
  //
  // Keyed on the box's ID, not the account object (2026-10-03): the shell re-reads the accounts on every
  // focus and unread change, and each re-read used to re-run this - the detail blanked to its skeleton,
  // an attachment download under way was aborted (its spinner left on), and the mark-read went out again.
  const accountRef = useRef(account);
  accountRef.current = account;
  const load = useCallback(async () => {
    const box = accountRef.current;
    setState({ status: 'loading' });
    // The sync time with the envelope, in the same read: a "Stav k" line arriving after the card has
    // drawn would push everything under it down (constitution V).
    const [envelope, cachedDetail, syncedAt] = await Promise.all([
      messagesController.getCachedEnvelope(box.boxId, messageId),
      messagesController.getCachedDetail(box.boxId, messageId),
      messagesController.getCachedSyncedAt(box.boxId, messageId),
    ]);
    if (envelope) {
      setState({
        status: 'ready',
        envelope,
        attachments: cachedDetail?.attachments ?? null,
        unavailable: cachedDetail?.attachmentsUnavailable ?? false,
        incomplete: cachedDetail?.enclosuresMissingFrom != null,
        original: cachedDetail?.signedZfo ?? null,
        syncedAt,
      });
      // Opening a RECEIVED message reads it: mark it read on ISDS + in the cache (so the list drops the
      // unread treatment). Fire-and-forget, only for unread - never blocks the detail. A SENT message is
      // never "read" by us (mark-as-downloaded is a received-only op), so skip it.
      if (folder === 'received' && isUnread(envelope.state)) {
        void messagesController.markRead(box, messageId).then(marked => {
          if (marked) {
            void accountsController.decrementUnread(box.boxId);
          }
        });
      }
    } else {
      setState({ status: 'error', messageKey: 'detail.error.body' });
    }
    // `boxId` re-creates this for a different box; the rest of the account is read from the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.boxId, messageId, folder]);

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

  // The "paper" header (009): a 54dp bar and a hairline, a back chevron (44x44) and a quiet subtitle;
  // a received message's `band` comes in over it as the envelope tucks under (DetailBand). The test
  // banner is a SIBLING of the bar: nested inside it, Android clipped its label to "Testovací".
  const renderHeader = (subtitle: string, band?: ReactNode) => (
    <>
      <TestEnvBanner show={showTestBanner} />
      <YStack backgroundColor={theme.surfaceAlt} zIndex={1}>
        <XStack
          accessibilityElementsHidden={band != null && tuck.tucked}
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
          <Label fontWeight="700"
            flex={1}
            minWidth={0}
            color={theme.textFaint}
            numberOfLines={1}
          >
            {subtitle}
          </Label>
        </XStack>
        <YStack height={1} backgroundColor={theme.border} />
        {band}
      </YStack>
    </>
  );

  // The bar names what this is from the first frame, loading or not (031 R7).
  const title = t(folder === 'sent' ? 'detail.header.sent' : 'detail.header.received');

  if (state.status === 'loading') {
    return (
      <YStack flex={1} backgroundColor={theme.bg}>
        {renderHeader(title)}
        {openedFrom ? <TileAtRest from={openedFrom} /> : <DetailSkeleton />}
      </YStack>
    );
  }

  if (state.status === 'error') {
    return (
      <YStack flex={1} backgroundColor={theme.bg}>
        {renderHeader(title)}
        {/* A failed list's anatomy (031 R4): the envelope sealed - nothing came out - the words and one
            way on. The detail reads only this phone's archive, so it says it found nothing there and
            sends you back to the list, rather than "download" and "try again" over a back button. */}
        <EmptyObject
          object={<EnvelopePose pose="sealed" />}
          title={t('detail.error.title')}
          body={t(state.messageKey)}
          action={<NeutralButton inline label={t('detail.error.back')} onPress={onBack} testID="retry" />}
          testID="detailError"
        />
      </YStack>
    );
  }

  const { envelope, attachments, unavailable, incomplete, original } = state;
  const isSent = folder === 'sent';
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

  // Received: a message ALREADY served by fiction → an attention banner. Not a countdown; see
  // `fikce.ts` for why the received side can never have one.
  const servedAt = isSent ? null : servedByFiction(envelope);

  // Sent: the delivery timeline. ISDS exposes only `deliveryTime` (dmDeliveryTime) + `acceptanceTime`
  // (dmAcceptanceTime); delivery into the box is effectively the send instant, so Odesláno + Dodáno
  // share `deliveryTime` (no time is fabricated), and the final step carries `acceptanceTime`.
  //
  // 013: the third step is no longer always "Doručeno", and the journey no longer always continues.
  //   * state 5 → the step becomes `Doručeno fikcí`, gold, with a note saying nobody signed in.
  //   * state 3 / 8 → the journey STOPS. The remaining steps are dropped entirely rather than left
  //     greyed out, because a greyed-out step reads as "still coming" when nothing is coming, and a
  //     `stopWhy` paragraph below explains what to do instead.
  // ISDS gives no timestamp for the stop itself: that step shows an em-dash, not another step's time.
  const steps: (SentStep & { noteKey?: string })[] = [
    {
      kind: 'sent',
      labelKey: 'send.sent.step.sent',
      noteKey: 'send.sent.step.sent.note',
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
      labelKey: 'send.sent.step.delivered',
      noteKey: 'send.sent.step.delivered.note',
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
      const served = envelope.state >= MESSAGE_STATE_SERVED;
      steps.push({
        kind: byFiction ? 'fiction' : 'accepted',
        labelKey: byFiction ? 'send.sent.step.fiction' : 'send.sent.step.accepted',
        time: envelope.acceptanceTime,
        done: served,
        noteKey: byFiction
          ? 'send.sent.step.fiction.note'
          : served
            ? 'send.sent.step.accepted.done'
            : 'send.sent.step.accepted.note',
      });
    }
  }
  // "Odesláno" and "Dodáno" both render `deliveryTime` (ISDS has no submission time): once delivered,
  // one row says so (017 T011); on its way, the two stay separate, a real progression.
  const sentSteps = mergeSameTimeHead(steps, formatDateTime, {
    labelKey: 'sent.merged',
    noteKey: 'sent.merged.note',
  });
  const stopWhyKey = stopReasonKey(envelope.state);
  // Submitted, stamped or in the box: a later listing can still move it on. Everything else is final.
  const stateCanChange =
    envelope.state === MESSAGE_STATE.submitted ||
    envelope.state === MESSAGE_STATE.stamped ||
    envelope.state === MESSAGE_STATE.delivered;
  const stateAsOf = stateCanChange ? state.syncedAt : null;

  // Standing "no longer in ISDS" notice (B2), wherever a re-download would be offered. Standalone it
  // carries the section's top margin; inside the attachment stack the caller passes 0.
  const renderUnavailableNotice = (marginTop: number) => (
    <Card
      marginTop={marginTop}
      padding={16}
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
        <YStack flex={1} gap={4}>
          <SmallStrong color={theme.text}>
            {t('detail.attachments.unavailable.title')}
          </SmallStrong>
          <Caption color={theme.textMuted}>
            {t('detail.attachments.unavailable.body')}
          </Caption>
        </YStack>
      </XStack>
    </Card>
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
          <SmallStrong color={theme.text}>
            {downloading ? downloadingLabel : actionLabel}
          </SmallStrong>
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
  // message's state is spelled out step by step in the delivery timeline instead.
  const banner =
    servedAt != null ? <FictionBanner servedAt={servedAt} onRemind={() => setPickingTerm(true)} /> : null;

  return (
    <YStack flex={1} backgroundColor={theme.bg}>
      {/* Received (031): the header names what this is, and the envelope says who it is from. */}
      {renderHeader(title, (
        <DetailBand top={headerTop} envelope={envelope} account={account} tuck={tuck} onBack={onBack} />
      ))}
      <Animated.ScrollView onScroll={tuck.onScroll} scrollEventThrottle={16} testID="detailScroll"
        contentContainerStyle={{ paddingBottom: contentBottom }}>
        {banner}
        <DetailEnvelope
          envelope={envelope}
          account={account}
          sent={isSent}
          attachmentCount={attachments ? attachments.length : null}
          openedFrom={openedFrom}
          onBottom={tuck.onEnvelopeBottom}
        />
        <YStack paddingHorizontal={16}>
          {/* Received: the delivery record, the slip under the envelope - the message's own legal
              receipt, never a sub-detail of the sender. */}
          {/* Sent (R7): the Sent board's slip, filled in as ISDS reports the steps. */}
          {isSent ? (
            <SentRecordSlip
              messageId={messageId}
              steps={sentSteps}
              stateAsOf={stateAsOf != null ? formatDateTime(stateAsOf) : null}
              stopWhyKey={stopWhyKey ?? null}
              annotation={status.annotation ?? null}
            />
          ) : (
            <DeliveryRecordSlip record={deliveryRecord(envelope, formatDateTime)} />
          )}

          {/* The user's deadline. Received only, and above the delivery status because it is the one
              thing on this screen the user can DO something about - everything below reports what
              ISDS did. */}
          {!isSent ? (
            // The card carries the border so the "notifications are off" line can sit inside it,
            // under the row it is about. Without that line the card draws exactly what the row drew
            // on its own: the same border, radius, padding and height.
            // R7: the row leads with its glyph in a well, as a settings row does - 56 tall, 8 and 12.
            <Card
              marginTop={16}
              overflow="hidden"
            >
              <XStack
                alignItems="center"
                gap={12}
                minHeight={56}
                paddingVertical={8}
                paddingHorizontal={12}
                pressStyle={{ opacity: 0.7 }}
                onPress={() => setPickingTerm(true)}
                accessibilityRole="button"
                accessibilityLabel={t('term.action')}
                testID="detail-term"
              >
                <Well name="remind" />
                <YStack flex={1}>
                  <SmallStrong fontWeight="600" color={theme.text}>
                    {t('term.action')}
                  </SmallStrong>
                  <Caption color={theme.textMuted}>
                    {term != null
                      ? t('term.chip', { d: formatTermDate(term) })
                      : t('term.none')}
                  </Caption>
                </YStack>
                <ChevronRightIcon size={18} color={theme.textMuted} />
              </XStack>
              {/* Only for a date that is set, and only when saving could not change it: while the
                  box's first reminder is still being asked about (`ask`), the OS dialog is the answer. */}
              {term != null && reminderAlerts.alerts === 'off' ? (
                <AlertsOffLine onTurnOn={reminderAlerts.turnOn} />
              ) : null}
            </Card>
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

          {/* Attachments - shared by both folders (a sent message can carry documents too). The
              heading is suppressed in the expired state: the "no longer available" notice stands
              alone there (design). The count only exists once a download confirmed the contents. */}
          {/* 031 (board Message): "Přílohy" and the count beside it, 18 under what comes before (the
              board's 20, on the scale). */}
          {attachments || !unavailable ? (
            <XStack marginTop={18} alignItems="baseline" gap={8}>
              <Heading>{t('detail.attachments')}</Heading>
              {attachments ? <Small color={theme.textMuted}>{String(attachments.length)}</Small> : null}
            </XStack>
          ) : null}

          {/* Downloaded → the whole message (attachments included) is now in the offline archive.
              Design: a confirmation line 6dp under the heading - 12px bold green + a 14px check. */}
          {/* "Celá zpráva uložena" while files are missing is a green tick over the amber card
              twenty lines below saying the opposite. Reached by restoring a backup - the backup
              carries the message rows and deliberately not the attachment bytes. */}
          {/* Nor while enclosures of a large-volume message never arrived (constitution IV). */}
          {/* Each saved file says "v archivu" itself since 031; the line stays for what it must
              warn about. */}
          {attachments && (anyBlocked || incomplete) ? (
            <XStack marginTop={6} alignItems="center" gap={6}>
              <AlertIcon size={14} color={theme.warningInk} />
              <Meta fontWeight="700" color={theme.warningInk}>
                {t('detail.attachments.partlySaved')}
              </Meta>
            </XStack>
          ) : null}

          {attachments ? (
            // Downloaded → we now know the real contents. List them, or - only now that it is
            // confirmed by an actual download - say there are none. (We must NEVER infer "no
            // attachments" from the list's dmAttachmentSize: it is the size in KB, rounded, so a
            // small file reports 0 and would otherwise hide a real attachment.)
            attachments.length > 0 ? (
              <YStack marginTop={8} gap={8}>
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
              <Meta fontWeight="600" color={theme.textMuted} marginBottom={6}>
                {downloadingLabel}
              </Meta>
              <ProgressBar downloading fraction={downloadFraction} />
            </YStack>
          ) : (
            // Not downloaded → always offer the download (attachments can be large, and we cannot
            // know from the envelope whether/how many there are - every data message has documents).
            <>
              {/* R7: one card - the glyph in its well, the title over the explanation, and the blue
                  download inside it, 10 under them (14 around). */}
              <Card
                marginTop={12}
                padding={14}
                gap={10}
              >
                <XStack gap={12} alignItems="center">
                  <Well name="attach" />
                  <YStack flex={1}>
                    <SmallStrong fontWeight="600" color={theme.text}>
                      {t('detail.attachments.containsAtts')}
                    </SmallStrong>
                    <Caption color={theme.textMuted}>
                      {t('detail.attachments.namesAfter')}
                    </Caption>
                  </YStack>
                </XStack>
                {downloadError ? (
                  <Caption color={theme.danger}>
                    {downloadError}
                  </Caption>
                ) : null}
                {/* The download is what puts the whole message in the offline archive, so the label
                    and the quiet note under the card say exactly that. */}
                <PressScale
                  fullWidth
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
                    <OffsetIcon name="download" size={20} color={theme.onBlue} plane="envelope" />
                    <BodyStrong color={theme.onBlue}>
                      {t('detail.attachments.downloadFull')}
                    </BodyStrong>
                  </XStack>
                </PressScale>
              </Card>
              <Meta
                marginTop={8}
                color={theme.textFaint}
                textAlign="center"
              >
                {t(downloadNoteKey({ isSent, servedByFiction: servedAt != null }))}
              </Meta>
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
      </Animated.ScrollView>
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
          borderRadius={999}
          backgroundColor={theme.surfaceSunken}
          overflow="hidden"
        >
          <YStack
            height={6}
            borderRadius={999}
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
 * Loading placeholder in the message's own shape (031 R7, I31): the envelope, the sheet with the
 * subject tucked 10 under its edge, and the slip - so nothing moves when the message comes in.
 */
function DetailSkeleton() {
  const theme = useTheme();
  return (
    <YStack paddingHorizontal={16} paddingTop={12} testID="detailSkeleton">
      <Skeleton width="100%" height={150} radius={20} />
      <YStack
        marginTop={-10}
        marginHorizontal={10}
        backgroundColor={theme.surface}
        borderTopLeftRadius={8}
        borderTopRightRadius={8}
        borderBottomLeftRadius={14}
        borderBottomRightRadius={14}
        paddingTop={16}
        paddingHorizontal={16}
        paddingBottom={14}
        gap={8}
      >
        <Skeleton width="85%" height={24} radius={8} color={theme.borderStrong} />
        <Skeleton width="55%" height={24} radius={8} color={theme.borderStrong} />
      </YStack>
      <Card marginTop={16} padding={16} gap={12}>
        <Skeleton width={96} height={12} radius={6} color={theme.borderStrong} />
        {[0, 1].map(i => (
          <XStack key={i} gap={12} alignItems="center">
            <Skeleton width={34} height={34} radius={999} color={theme.borderStrong} />
            <YStack flex={1} gap={6}>
              <Skeleton width="45%" height={14} radius={6} color={theme.borderStrong} />
              <Skeleton width="60%" height={12} radius={6} color={theme.borderStrong} />
            </YStack>
          </XStack>
        ))}
      </Card>
    </YStack>
  );
}
