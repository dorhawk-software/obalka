// Compose screen (feature 005, US1/US2). Look up a recipient (fulltext ISDSSearch3) and see, live,
// whether the message is FREE (to a public authority / OVM) or a PAID Poštovní datová zpráva (PDZ)
// with an approximate CZK cost - the cost model made visible. Attach documents (capped before they are
// read, then read+encoded off the JS thread in chunks the person can watch and cancel - Principle I,
// T006) and send: a paid send requires explicit confirmation (no silent spend).
// Never blocks: lookup + send run off the JS thread with cancellable in-flight refs.

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../../theme/ScreenHeader';
import { MIN_TARGET, textSlop, touchSlop } from '../../../theme/touchTarget';
import { sheetWidth } from '../../../theme/ContentColumn';
import { Button, Input, Spinner, XStack, YStack } from '../../../theme/ui';
import { KeyboardAwareScrollView } from '../../../theme/KeyboardAwareScrollView';
import { PressScale } from '../../../theme/PressScale';
import {
  Badge,
  Body,
  BodyStrong,
  Caption,
  Label,
  Title,
  Value,
} from '../../../theme/Typography';
import { fonts } from '../../../theme/typography';
import { useTheme } from '../../../theme/ThemeProvider';
import { useScrim } from '../../../theme/useScrim';
import { chipTone } from '../../../theme/chipTone';
import { EmblemIcon } from '../../../theme/iconTiers';
import { AddressLines } from './AddressLines';
import { markSameName } from '../state/addressParts';
import { creditState } from '../state/credit';
import { totalAttachmentBytes } from '../state/costModel';
import { Avatar } from '../../../theme/Avatar';
import { depth } from '../../../theme/depth';
import { DashedOutline } from '../../../theme/DashedOutline';
import { ProgressBar } from '../../../theme/ProgressBar';
import {
  ArrowRightIcon,
  CheckIcon,
  CloseIcon,
  CreditCardIcon,
  EditIcon,
  FileIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  SendGlyph,
} from '../../../theme/icons';
import { SwipeableRow } from '../../../theme/SwipeableRow';
// gesture-handler Pressable for the inline trash so it coordinates with the row's swipe/tap gestures.
import { Pressable as GHPressable } from 'react-native-gesture-handler';
import { useSnackbar } from '../../../app/Snackbar';
import { t } from '../../../i18n/strings';
import { reauthKey } from '../../accounts/state/reauthCopy';
import { portalUrl } from '../../../services/isds/endpoints';
import type {
  CostEstimate,
  CreditInfo,
  DataBoxAccount,
  OutgoingDocument,
  Recipient,
  RecipientDbType,
} from '../../../services/isds/types';
import type { DraftRecord } from '../../../services/db/draftsStore';
import type { SentStatus } from '../state/sendController';
import {
  sendController,
  draftsStore,
  messagesController,
  accountsController,
} from '../../accounts/deps';
import { draftsBus } from '../state/draftsBus';
import {
  pickDocuments,
  type ReadProgress,
} from '../../../services/files/attachmentPicker';
import { textToPdf } from '../../../services/files/textToPdf';
import { haptics } from '../../../services/haptics';
import { reportFailure } from '../../../services/telemetry/telemetry';
import { useSingleFlight } from '../../../app/useSingleFlight';

/** A random id for a new draft (the app polyfills crypto.getRandomValues). */
function newDraftId(): string {
  const b = new Uint8Array(16);
  globalThis.crypto.getRandomValues(b);
  return Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
}

// Recipient search runs automatically as the user types: wait for a typing pause, and require a
// couple of characters so one keystroke doesn't hit the network on every box in the country.
const SEARCH_DEBOUNCE_MS = 400;
const MIN_SEARCH_CHARS = 2;

/**
 * B / kB / MB with the Czech decimal comma, as the detail, backup and transfer screens write sizes.
 * It now also fills sentences ("Načítání 1,5 MB z 3,0 MB"), where "1.5 MB" read as a typo.
 */
function formatBytes(n: number): string {
  if (n >= 1024 * 1024) {
    return `${(n / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  }
  if (n >= 1024) {
    return `${Math.round(n / 1024)} kB`;
  }
  return `${n} B`;
}

/** "dd.mm.yyyy hh:mm" for the post-send delivery confirmation, or '' for a missing time. */
function formatDateTime(epochMs: number | null): string {
  if (epochMs == null) {
    return '';
  }
  const d = new Date(epochMs);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(
    d.getHours(),
  )}:${p(d.getMinutes())}`;
}

export interface ComposeScreenProps {
  readonly account: DataBoxAccount;
  readonly onBack: () => void;
  /**
   * Open the message that was just sent, in the archive (005 T018).
   *
   * The route REPLACES compose with the detail rather than pushing on top of it: a send is finished,
   * and leaving a spent compose screen underneath means the back gesture lands the reader back on
   * "Zpráva odeslána" instead of the list they came from.
   */
  readonly onOpenSent: (messageId: string) => void;
}

/** Imperative API the route uses to auto-save the draft when the screen is being removed. */
export interface ComposeHandle {
  /**
   * Persist the current compose state as a draft and return it, or null if there is nothing worth
   * saving (empty compose, or already sent). Synchronous result (the DB write is fire-and-forget) so
   * it can run inside a navigation `beforeRemove` listener.
   */
  persistOnExit: () => DraftRecord | null;
}

export const ComposeScreen = forwardRef<ComposeHandle, ComposeScreenProps>(
  // Named apart from the constant it is assigned to, which it would otherwise shadow; `displayName`
  // below keeps the name React tools show.
  function ComposeScreenView({ account, onBack, onOpenSent }, ref) {
    const theme = useTheme();
    const scrim = useScrim(0.4);
    const snackbar = useSnackbar();
    const insets = useSafeAreaInsets();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Recipient[]>([]);
    // Which results share an owner name with another result in the SAME set (015). A fact about the
    // search, not about anybody in it - computed here, never fetched.
    const marked = markSameName(results);
    const [searching, setSearching] = useState(false);
    const [searched, setSearched] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [recipient, setRecipient] = useState<Recipient | null>(null);
    const [subject, setSubject] = useState('');
    // Plain-text message body → turned into a "Textová zpráva.pdf" on send (the portal's convenience;
    // ISDS needs a document, not just a subject). Counts as a document, so attachments become optional.
    const [bodyText, setBodyText] = useState('');
    const [files, setFiles] = useState<OutgoingDocument[]>([]);
    // 005 T006: how far the current pick has got, or null when nothing is being read. It drives the
    // row that stands in for "Přidat přílohu" while the files stream in.
    const [reading, setReading] = useState<ReadProgress | null>(null);
    /** The pick in progress, so it can be cancelled - by the person, or by leaving the screen. */
    const picking = useRef<AbortController | null>(null);
    const [busy, setBusy] = useState(false);
    // The send itself, guarded at the tap. `busy` draws the spinner, but it lands only after a re-render,
    // and a double tap on "Odeslat" - or on the paid-confirm button - delivers both presses before
    // that. ISDS has no idempotency key: a second send is a second official message, and a second
    // charge for a PDZ (audit 2026-09-23).
    const sendOnce = useSingleFlight();
    const [sendError, setSendError] = useState<string | null>(null);
    const [pendingConfirm, setPendingConfirm] = useState<{
      estimate: CostEstimate;
      credit: CreditInfo;
    } | null>(null);
    const [showBuyCredit, setShowBuyCredit] = useState(false);
    const [sentId, setSentId] = useState<string | null>(null);
    const [sentReconciled, setSentReconciled] = useState(false);
    const [sentStatus, setSentStatus] = useState<SentStatus | null>(null);
    /** The archive write for the message just sent; awaited before opening it. */
    const recorded = useRef<Promise<void> | null>(null);
    const [opening, setOpening] = useState(false);
    /** "Zobrazit zprávu" navigates once, however fast it is tapped - `opening` only dims it. */
    const openOnce = useSingleFlight();
    /** Freshly fetched PDZ balance. `undefined` = not fetched yet (fall back to the stored one). */
    const [freshCredit, setFreshCredit] = useState<number | undefined>(undefined);
    const [drafts, setDrafts] = useState<DraftRecord[]>([]);
    const draftId = useRef<string | null>(null);
    const inFlight = useRef<AbortController | null>(null);
    // Once a send times out (ambiguous - it MAY have gone through), every later attempt reconciles
    // against the sent list first, so a retry can't charge twice. Cleared only on a confirmed send.
    const reconcilePending = useRef(false);

    const loadDrafts = useCallback(async () => {
      setDrafts(await draftsStore.list(account.boxId));
    }, [account.boxId]);

    useEffect(() => {
      void loadDrafts();
    }, [loadDrafts]);

    // 020 FR-007: refresh the balance when it starts to MATTER - i.e. once a paid recipient is
    // picked. Deliberately not on every compose-open: writing to an OVM is free, and an ISDS call
    // nobody needs is exactly what 014 removed. Opening compose and choosing a paid recipient is a
    // user action, and asking for a credit balance delivers nothing, so this is inside that boundary.
    //
    // A failed fetch leaves the stored value alone rather than blanking it: "we could not ask just
    // now" is not "you have nothing".
    // The same rule the cost model uses: an OVM (public authority) message is free, everything else
    // is a paid PDZ. Derived from the recipient rather than from `estimate`, which is computed
    // further down the render - a hook cannot wait for it.
    const paidRecipient = recipient != null && recipient.dbType !== 'OVM';
    useEffect(() => {
      if (!paidRecipient) {
        return;
      }
      const ctrl = new AbortController();
      let alive = true;
      void messagesController
        .getCredit(account, ctrl.signal)
        .then(czk => {
          if (alive && czk != null) {
            setFreshCredit(czk);
            void accountsController.recordCredit(account.boxId, czk); // keep the switcher in step
          }
        })
        .catch(() => {}); // never break compose over a balance
      return () => {
        alive = false;
        ctrl.abort();
      };
    }, [paidRecipient, account]);

    // Auto-save the draft when leaving compose (no manual button). Returns the saved record so the
    // route can offer an undoable "Koncept uložen" snackbar; null when there's nothing worth keeping.
    const persistOnExit = useCallback((): DraftRecord | null => {
      // Already sent → no draft; an empty compose → nothing to save.
      if (sentId) {
        return null;
      }
      if (!recipient && subject.trim() === '' && bodyText.trim() === '') {
        return null;
      }
      const id = draftId.current ?? newDraftId();
      draftId.current = id;
      const record: DraftRecord = {
        id,
        boxId: account.boxId,
        recipientBoxId: recipient?.boxId ?? null,
        recipientLabel: recipient?.name ?? null,
        recipientAddress: recipient?.address ?? null,
        recipientDbType: recipient?.dbType ?? null,
        subject: subject.trim(),
        body: bodyText,
        updatedAt: Date.now(),
      };
      // fire-and-forget; the caller already has the record. Notify the list AFTER the write lands.
      void draftsStore.save(record).then(() => draftsBus.emit());
      return record;
    }, [account.boxId, recipient, subject, bodyText, sentId]);

    useImperativeHandle(ref, () => ({ persistOnExit }), [persistOnExit]);

    const resumeDraft = useCallback((d: DraftRecord) => {
      draftId.current = d.id;
      setSubject(d.subject);
      setBodyText(d.body);
      if (d.recipientBoxId) {
        setRecipient({
          boxId: d.recipientBoxId,
          name: d.recipientLabel ?? d.recipientBoxId,
          // Persisted since 015 (migration 12). A draft saved before that has null here, which is
          // honest: we genuinely do not know the address, and the row says so rather than claiming
          // the register had none.
          address: d.recipientAddress ?? null,
          dbType: (d.recipientDbType ?? 'FO') as RecipientDbType,
          // Not persisted; assume a private box accepts PDZ (OVM is free regardless). Re-checked on send.
          acceptsPdz: d.recipientDbType !== 'OVM',
        });
      }
    }, []);

    // Discard a draft from the list (swipe → Zahodit, or the inline trash) - removed immediately but
    // UNDOable via the snackbar (re-saves the captured record), matching the auto-save-on-exit flow.
    const discardDraft = useCallback(
      async (d: DraftRecord) => {
        await draftsStore.remove(d.id);
        draftsBus.emit();
        await loadDrafts();
        snackbar.show({
          message: t('send.draft.discarded'),
          action: {
            label: t('common.undo'),
            onPress: () =>
              void draftsStore.save(d).then(() => {
                draftsBus.emit();
                void loadDrafts();
              }),
          },
        });
      },
      [loadDrafts, snackbar],
    );

    // Stable across keystrokes (depends only on `account`) - the query is passed in, so the debounce
    // effect below can call it without re-subscribing on every character.
    const runSearch = useCallback(
      async (q: string) => {
        inFlight.current?.abort();
        if (q.trim() === '') {
          return;
        }
        const ac = new AbortController();
        inFlight.current = ac;
        setSearching(true);
        setError(null);
        const out = await sendController.searchRecipients(
          account,
          q,
          ac.signal,
        );
        if (ac.signal.aborted) {
          return;
        }
        setSearching(false);
        setSearched(true);
        if (out.kind === 'recipients') {
          setResults(out.recipients);
        } else {
          setError(
            out.kind === 'reauth' ? t('send.error.search') : t(out.messageKey),
          );
        }
      },
      [account],
    );

    // Auto-search as the user types (no Find button): debounce, and require a couple of characters so
    // a single keystroke doesn't hit the network. Clearing the field resets the results.
    useEffect(() => {
      const q = query.trim();
      if (q === '') {
        inFlight.current?.abort();
        setResults([]);
        setSearched(false);
        setSearching(false);
        return;
      }
      if (q.length < MIN_SEARCH_CHARS) {
        return;
      }
      const handle = setTimeout(() => void runSearch(q), SEARCH_DEBOUNCE_MS);
      return () => clearTimeout(handle);
    }, [query, runSearch]);

    // Leaving compose mid-read abandons the read: a draft does not keep attachments, so bytes that
    // finish arriving after the screen is gone would have nowhere to go.
    useEffect(
      () => () => {
        picking.current?.abort();
        picking.current = null;
      },
      [],
    );

    const addAttachment = useCallback(async () => {
      // One pick at a time. The button is replaced by the progress row once a read starts, but a
      // second tap can still land while the system picker is opening.
      if (picking.current) {
        return;
      }
      setSendError(null);
      const ctrl = new AbortController();
      picking.current = ctrl;
      const out = await pickDocuments({
        // The cap is on the whole message, so what is already attached counts against it.
        attachedBytes: totalAttachmentBytes(files),
        signal: ctrl.signal,
        onProgress: p => {
          if (!ctrl.signal.aborted) {
            setReading(p);
          }
        },
      });
      // A cancelled pick has already given the row back (`cancelReading`), and an unmounted one has
      // no screen to report to. Either way, nothing it returns is attached.
      if (ctrl.signal.aborted) {
        return;
      }
      picking.current = null;
      setReading(null);
      switch (out.kind) {
        case 'picked':
          if (out.documents.length > 0) {
            setFiles(prev => [...prev, ...out.documents]);
          }
          break;
        case 'tooLarge':
          setSendError(
            t('send.attachments.tooLarge', {
              size: formatBytes(out.messageBytes),
              limit: formatBytes(out.limitBytes),
            }),
          );
          break;
        case 'failed':
          setSendError(t('send.error.attach'));
          break;
        case 'dismissed':
        case 'cancelled':
          break;
      }
    }, [files]);

    // The row goes back to "Přidat přílohu" at once. The picker drops the partial read and its cache
    // copies in its own time, and the abort check above keeps whatever it returns from being attached.
    const cancelReading = useCallback(() => {
      picking.current?.abort();
      picking.current = null;
      setReading(null);
    }, []);

    const doSend = useCallback(
      (confirmedPaid: boolean) =>
        sendOnce(async () => {
          const hasBody = bodyText.trim() !== '';
          if (!recipient || (files.length === 0 && !hasBody)) {
            return;
          }
          setBusy(true);
          setSendError(null);
          setShowBuyCredit(false);
          setPendingConfirm(null);
          // A typed message body becomes the main "Textová zpráva.pdf" (rendered in the OS PDF engine,
          // off the JS thread); otherwise the first attachment is the main document. ISDS requires ≥1.
          let docs: OutgoingDocument[];
          try {
            docs = hasBody ? [await textToPdf(bodyText), ...files] : files;
          } catch {
            setBusy(false);
            setSendError(t('send.error.pdf'));
            return;
          }
          const withMain = docs.map((f, i) => ({ ...f, isMain: i === 0 }));
          const out = await sendController.send(
            account,
            { recipient, subject: subject.trim(), files: withMain },
            new AbortController().signal,
            { confirmedPaid, reconcileFirst: reconcilePending.current },
          );
          setBusy(false);
          switch (out.kind) {
            case 'sent':
              haptics.success(); // the message went out - a confident success tap
              reconcilePending.current = false;
              setSentReconciled(out.reconciled === true);
              setSentId(out.messageId);
              // Cache what we just sent as this message's offline detail, so opening it shows the
              // attachments immediately - we already hold the files, re-downloading them is absurd.
              //
              // KEPT, not discarded: "Zobrazit zprávu" below waits on this promise. The write is fast
              // and the button needs a deliberate tap to reach, so the wait is almost always over
              // before it starts - but almost always is how you ship a detail screen that opens empty
              // on a slow phone, which is the one device where it matters.
              //
              // A write that FAILS is reported and waited out all the same: the message went, and the
              // detail can still come from the box. Left rejecting, it was an unhandled rejection
              // here and a "Zobrazit zprávu" that never opened anything, however often it was tapped.
              recorded.current = messagesController
                .recordSentMessage(account, {
                  messageId: out.messageId,
                  subject: subject.trim(),
                  recipient,
                  files: withMain,
                  sentAt: Date.now(),
                })
                .catch((e: unknown) => {
                  reportFailure('db.write', e, { stage: 'persist' });
                });
              // Best-effort post-send confirmation: read the sent message's delivery state from the box's
              // sent list (null if it fails or isn't listed yet - we just show nothing extra).
              setSentStatus(null);
              void sendController
                .fetchSentStatus(
                  account,
                  out.messageId,
                  new AbortController().signal,
                )
                .then(setSentStatus);
              // The message went out - drop any draft it was resumed from (and stop auto-save on exit).
              if (draftId.current) {
                void draftsStore
                  .remove(draftId.current)
                  .then(() => draftsBus.emit());
                draftId.current = null;
              }
              break;
            case 'needsConfirmation':
              haptics.warning(); // a paid-send decision gate appeared - a caution tick
              setPendingConfirm({ estimate: out.estimate, credit: out.credit });
              break;
            case 'blocked': {
              const key =
                out.reason === 'insufficientCredit'
                  ? 'send.blocked.insufficientCredit'
                  : out.reason === 'pdzDisabled'
                  ? 'send.blocked.pdzDisabled'
                  : out.reason === 'tooLarge'
                  ? 'send.blocked.tooLarge'
                  : 'send.blocked.recipientRejectsPdz';
              setSendError(t(key));
              setShowBuyCredit(
                out.reason === 'insufficientCredit' ||
                  out.reason === 'pdzDisabled',
              );
              break;
            }
            case 'reauth':
              setSendError(t(reauthKey(account, 'send.reauth', 'send.reauth.credentials')));
              break;
            case 'error':
              haptics.error(); // the send failed - a distinct error tick
              // An ambiguous timeout: the send may have landed. Arm reconcile so a retry de-dups.
              if (out.ambiguous) {
                reconcilePending.current = true;
              }
              setSendError(t(out.messageKey));
              break;
          }
        }),
      [account, recipient, subject, files, bodyText, sendOnce],
    );

    const estimate = recipient
      ? sendController.estimate(recipient, files)
      : null;
    // 020: what to say about this box's credit, judged against the estimate's approximate price.
    // Unknown balance → the card says nothing about money the app has not been told about. The
    // freshly-fetched value wins over the stored one; `undefined` means "not fetched yet", which is
    // why it is not simply `number | null` (null is a real answer: ISDS declined to say).
    const credit = creditState(
      freshCredit === undefined ? account.pdzCreditCzk : freshCredit,
      estimate?.approxCzk,
    );
    // Sendable once there's a recipient + at least one document: a typed body (→ PDF) OR an attachment.
    // Not while a pick is still reading - the message would leave without the files being read.
    const canSend =
      (files.length > 0 || bodyText.trim() !== '') && !busy && reading == null;
    // Sizes only once bytes are streaming; while the picked files are still being copied into the
    // cache there is no byte count that means anything yet.
    const readingLabel =
      reading != null && reading.stage === 'reading' && reading.totalBytes > 0
        ? t('send.attachments.reading', {
            read: formatBytes(reading.readBytes),
            total: formatBytes(reading.totalBytes),
          })
        : t('send.attachments.readingStart');

    const inputStyle = {
      height: 50,
      backgroundColor: theme.surface,
      borderColor: theme.borderStrong,
      borderWidth: 1,
      borderRadius: 14,
      paddingHorizontal: 15,
      fontSize: 15,
      color: theme.text,
      placeholderTextColor: theme.textFaint,
      focusStyle: { borderColor: theme.blue, borderWidth: 1.5 },
    };

    return (
      <YStack flex={1} backgroundColor={theme.bg}>
        {/* No test-env banner: you reach compose FROM the list, which already carries the
            "Testovací" pill. */}
        <ScreenHeader
          title={t('send.title')}
          onBack={onBack}
          testID="composeBack"
        />

        {sentId ? (
          /* Sent-success - a full-screen confirmation. The EMBLEM tier (016): the one non-empty screen
             that earns a big glyph, because the app knows the message went and the headline says so. */
          <YStack
            flex={1}
            alignItems="center"
            justifyContent="center"
            paddingHorizontal={28}
            paddingVertical={40}
            testID="composeSent"
          >
            <EmblemIcon glyph={SendGlyph} />
            <Title
              fontFamily={fonts.displayBold}
              fontSize={22}
              fontWeight="700"
              letterSpacing={0}
              color={theme.text}
              textAlign="center"
              marginTop={20}
            >
              {t('send.sent')}
            </Title>
            {sentReconciled ? (
              <Caption
                color={theme.textMuted}
                textAlign="center"
                marginTop={8}
                maxWidth={300}
              >
                {t('send.sent.reconciled')}
              </Caption>
            ) : null}
            <Caption
              color={theme.textMuted}
              textAlign="center"
              marginTop={8}
              fontSize={14}
            >
              {t('send.sent.id', { id: sentId })}
            </Caption>
            {/* Single post-send delivery/acceptance confirmation (best-effort; T035). */}
            {sentStatus?.acceptanceTime != null ? (
              <Caption color={theme.success} textAlign="center" marginTop={4}>
                {t('send.sent.accepted', {
                  when: formatDateTime(sentStatus.acceptanceTime),
                })}
              </Caption>
            ) : sentStatus?.deliveryTime != null ? (
              <Caption color={theme.textMuted} textAlign="center" marginTop={4}>
                {t('send.sent.delivered', {
                  when: formatDateTime(sentStatus.deliveryTime),
                })}
              </Caption>
            ) : null}
            <PressScale
              fullWidth
              onPress={onBack}
              accessibilityLabel={t('send.done')}
              testID="composeDone"
              style={{ maxWidth: 280, marginTop: 28 }}
            >
              <XStack
                width="100%"
                minHeight={52}
                borderRadius={14}
                backgroundColor={theme.text}
                alignItems="center"
                justifyContent="center"
              >
                <BodyStrong color={theme.surfaceAlt}>
                  {t('send.done')}
                </BodyStrong>
              </XStack>
            </PressScale>
            {/* 005 T018's other half. The message was folded into the archive the moment it went
                out; until now the only way to it was to leave, find the sent folder and look. It is
                chromeless blue rather than a second filled button because the ui-guide reserves the
                dark fill for the ONE primary action, and after a send that action is "done". */}
            <PressScale
              onPress={() => {
                if (!sentId) {
                  return;
                }
                const id = sentId;
                void openOnce(async () => {
                  setOpening(true);
                  await recorded.current;
                  onOpenSent(id);
                });
              }}
              accessibilityLabel={t('send.sent.open')}
              testID="composeOpenSent"
              style={{ marginTop: 16 }}
            >
              <XStack
                alignItems="center"
                justifyContent="center"
                gap={6}
                // The floor a finger needs, drawn rather than slopped: `hitSlop` belongs on the view
                // that handles the press, and here that is PressScale's own - which does not take
                // one. A 48-tall centred row clears both platforms without the indirection.
                minHeight={MIN_TARGET}
                paddingHorizontal={12}
                opacity={opening ? 0.5 : 1}
              >
                <Body fontSize={14} fontWeight="600" color={theme.blue}>
                  {t('send.sent.open')}
                </Body>
                <ArrowRightIcon size={16} color={theme.blue} />
              </XStack>
            </PressScale>
          </YStack>
        ) : (
          /* KeyboardAvoidingView lifts the pinned send footer above the keyboard - on Android 15+
             (edge-to-edge) the window no longer resizes for adjustResize, so a sibling footer would
             otherwise sit behind the IME. */
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <KeyboardAwareScrollView
              style={{ flex: 1 }}
              testID="composeScroll"
              // The KeyboardAvoidingView above handles the keyboard; a second inset double-adjusts.
              adjustKeyboardInsets={false}
              contentContainerStyle={{
                paddingHorizontal: 18,
                paddingTop: 18,
                paddingBottom: 24,
              }}
            >
              {recipient ? (
                <YStack>
                  <Label
                    fontFamily={fonts.bodyBold}
                    fontWeight="700"
                    marginBottom={8}
                  >
                    {t('send.recipient')}
                  </Label>
                  {/* Selected recipient - avatar + identity + an inline "Změnit" link. */}
                  <XStack
                    backgroundColor={theme.surface}
                    borderWidth={1}
                    borderColor={theme.border}
                    borderRadius={14}
                    padding={12}
                    gap={11}
                    alignItems="flex-start"
                  >
                    <Avatar name={recipient.name} size={38} />
                    <YStack flex={1} minWidth={0} gap={1}>
                      {/* No `numberOfLines`: this is the last moment a wrong recipient can be
                          caught, so it must identify them at least as well as the search result
                          that offered them (FR-005). */}
                      <BodyStrong fontSize={14} color={theme.text}>
                        {recipient.name}
                      </BodyStrong>
                      <AddressLines address={recipient.address} />
                      <Caption
                        fontSize={12}
                        color={theme.textFaint}
                        marginTop={5}
                      >
                        {t(`send.dbType.${recipient.dbType}`)} ·{' '}
                        {recipient.boxId}
                      </Caption>
                    </YStack>
                    <XStack
                      hitSlop={textSlop('badge', { paddingVertical: 4 })}
                      paddingHorizontal={4}
                      paddingVertical={4}
                      pressStyle={{ opacity: 0.5 }}
                      onPress={() => {
                        setRecipient(null);
                        setResults([]);
                        setSearched(false);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={t('send.recipient.change')}
                      testID="composeChangeRecipient"
                    >
                      <Badge color={theme.warningInk} numberOfLines={1}>
                        {t('send.recipient.change')}
                      </Badge>
                    </XStack>
                  </XStack>

                  {/* Live cost preview - the cost model made visible (green free / amber paid) */}
                  {estimate
                    ? (() => {
                        const tone = chipTone(
                          estimate.paid ? 'costPaid' : 'costFree',
                          theme,
                        );
                        return (
                          <YStack
                            backgroundColor={tone.bg}
                            borderWidth={1}
                            borderColor={tone.border ?? tone.accent}
                            borderRadius={14}
                            paddingVertical={13}
                            paddingHorizontal={14}
                            marginTop={14}
                            testID="composeCost"
                            // Announce the cost (the key free-vs-paid decision) as one unit, not two.
                            accessible
                            accessibilityRole="summary"
                            accessibilityLabel={
                              estimate.paid
                                ? `${t('send.cost.paid', {
                                    czk: estimate.approxCzk ?? 0,
                                  })}. ${t('send.cost.paid.note')}`
                                : `${t('send.cost.free')}. ${t(
                                    'send.cost.free.note',
                                  )}`
                            }
                          >
                            <XStack gap={11} alignItems="flex-start">
                              {estimate.paid ? (
                                <CreditCardIcon size={20} color={tone.fg} />
                              ) : (
                                <CheckIcon size={20} color={tone.fg} />
                              )}
                              <YStack flex={1} gap={3}>
                                <BodyStrong
                                  fontFamily={fonts.bodyXBold}
                                  fontSize={14}
                                  color={tone.fg}
                                  fontWeight="800"
                                >
                                  {estimate.paid
                                    ? t('send.cost.paid', {
                                        czk: estimate.approxCzk ?? 0,
                                      })
                                    : t('send.cost.free')}
                                </BodyStrong>
                                <Caption
                                  fontSize={12}
                                  lineHeight={16}
                                  color={theme.textMuted}
                                >
                                  {estimate.paid
                                    ? t('send.cost.paid.note')
                                    : t('send.cost.free.note')}
                                </Caption>
                                {/* The balance, but only where it changes a decision: a paid
                                    message. An UNKNOWN balance renders nothing - "we have not
                                    asked" must never be printed as "you have no money" (020
                                    FR-003). */}
                                {estimate.paid && credit.kind !== 'unknown' ? (
                                  <Caption
                                    fontSize={12}
                                    lineHeight={16}
                                    fontWeight="700"
                                    color={
                                      credit.kind === 'short'
                                        ? theme.danger
                                        : theme.textMuted
                                    }
                                    testID="composeCredit"
                                  >
                                    {t(
                                      credit.kind === 'short'
                                        ? 'send.credit.short'
                                        : 'send.credit.balance',
                                      { amount: credit.balance },
                                    )}
                                  </Caption>
                                ) : null}
                              </YStack>
                            </XStack>
                          </YStack>
                        );
                      })()
                    : null}

                  <Label
                    fontFamily={fonts.bodyBold}
                    fontWeight="700"
                    marginTop={18}
                    marginBottom={8}
                  >
                    {t('send.subject')}
                  </Label>
                  <Input
                    {...inputStyle}
                    value={subject}
                    onChangeText={setSubject}
                    placeholder={t('send.subject.placeholder')}
                    accessibilityLabel={t('send.subject')}
                    testID="composeSubject"
                  />

                  {/* Message text → turned into a "Textová zpráva.pdf" on send (no need to make a PDF) */}
                  <Label
                    fontFamily={fonts.bodyBold}
                    fontWeight="700"
                    marginTop={16}
                    marginBottom={8}
                  >
                    {t('send.body')}
                  </Label>
                  <Input
                    {...inputStyle}
                    minHeight={120}
                    paddingTop={13}
                    lineHeight={21}
                    multiline
                    numberOfLines={6}
                    textAlignVertical="top"
                    value={bodyText}
                    onChangeText={setBodyText}
                    placeholder={t('send.body.placeholder')}
                    accessibilityLabel={t('send.body')}
                    testID="composeBody"
                  />
                  <Caption
                    fontSize={12}
                    lineHeight={16}
                    color={theme.textFaint}
                    marginTop={8}
                  >
                    {t('send.body.hint')}
                  </Caption>

                  {/* Attachments - read + base64-encoded off the JS thread (Principle I) */}
                  <Label
                    fontFamily={fonts.bodyBold}
                    fontWeight="700"
                    marginTop={18}
                    marginBottom={8}
                  >
                    {t('send.attachments')}
                  </Label>
                  {files.length > 0 ? (
                    <YStack gap={8} marginBottom={8}>
                      {files.map((f, i) => (
                        <XStack
                          key={`${f.fileName}-${i}`}
                          backgroundColor={theme.surface}
                          borderWidth={1}
                          borderColor={theme.border}
                          borderRadius={13}
                          paddingHorizontal={12}
                          paddingVertical={10}
                          gap={11}
                          alignItems="center"
                        >
                          {/* Neutral sunken tile + a plain file glyph - the design draws the SAME
                              tile for every file type (no coloured extension badge). */}
                          <YStack
                            width={34}
                            minHeight={34}
                            borderRadius={9}
                            backgroundColor={theme.surfaceSunken}
                            alignItems="center"
                            justifyContent="center"
                          >
                            <FileIcon size={17} color={theme.textMuted} />
                          </YStack>
                          <YStack flex={1} minWidth={0} gap={1}>
                            <Value
                              fontSize={13}
                              color={theme.text}
                              numberOfLines={1}
                            >
                              {f.fileName}
                            </Value>
                            <Caption color={theme.textFaint} fontSize={11}>
                              {formatBytes(f.sizeBytes)}
                            </Caption>
                          </YStack>
                          <XStack
                            width={30}
                            height={30}
                            alignItems="center"
                            justifyContent="center"
                            // Was `hitSlop={6}` - a 42pt target for the button that removes an
                            // attachment. Derived from the drawn size instead.
                            hitSlop={touchSlop({ width: 30, height: 30 })}
                            pressStyle={{ opacity: 0.5 }}
                            // By the file, not by its index: the index is the one this render
                            // drew, and a double tap runs both presses against the list as the
                            // FIRST removal left it - so removing index i twice took the file
                            // after it too. A file already gone is simply not found again.
                            onPress={() =>
                              setFiles(prev => prev.filter(x => x !== f))
                            }
                            accessibilityRole="button"
                            accessibilityLabel={t('send.attachments.remove')}
                            testID={`composeRemoveFile-${i}`}
                          >
                            <CloseIcon size={16} color={theme.textFaint} />
                          </XStack>
                        </XStack>
                      ))}
                    </YStack>
                  ) : null}
                  {/* The attachment slot: "Přidat přílohu", or - while a pick reads - its progress
                      row, and nothing around the slot may move when one becomes the other, at ANY
                      system text size (constitution V). Giving the two boxes the same dp metrics
                      only holds at the default size: the row's caption line plus its bar grow
                      faster than the button's single line, so from ~1.2x text the row came out a
                      few dp taller and the form below it jumped. So the progress row is ALWAYS laid
                      out and alone sizes the slot - invisible, silent and untouchable while idle -
                      and the button is drawn over that same footprint. The row always needs at
                      least the button's height (its 13pt line + 6 + a 6dp bar, inside 6 + 6 and a
                      1px edge, against one 14pt line), so the button's label always fits. */}
                  <YStack width="100%" position="relative">
                    {/* At the default size 6 + a 30pt control + 6 inside a 1px edge is 44, so the
                        46 minimum sets the height. The row is an attachment row's surface and edge,
                        and its cancel is drawn exactly like the remove control on those rows. */}
                    <XStack
                      width="100%"
                      minHeight={46}
                      borderRadius={13}
                      borderWidth={1}
                      borderColor={theme.border}
                      backgroundColor={theme.surface}
                      paddingLeft={12}
                      paddingRight={8}
                      paddingVertical={6}
                      gap={10}
                      alignItems="center"
                      opacity={reading ? 1 : 0}
                      pointerEvents={reading ? 'auto' : 'none'}
                      accessibilityElementsHidden={!reading}
                      importantForAccessibility={
                        reading ? 'auto' : 'no-hide-descendants'
                      }
                      testID="composeAttachReading"
                    >
                      <YStack flex={1} minWidth={0} gap={6}>
                        <Caption
                          fontSize={13}
                          color={theme.textMuted}
                          numberOfLines={1}
                          testID="composeAttachReadingLabel"
                        >
                          {readingLabel}
                        </Caption>
                        <ProgressBar
                          fraction={
                            reading != null && reading.totalBytes > 0
                              ? reading.readBytes / reading.totalBytes
                              : 0
                          }
                          label={t('send.attachments.readingStart')}
                          testID="composeAttachProgress"
                        />
                      </YStack>
                      <XStack
                        width={30}
                        height={30}
                        alignItems="center"
                        justifyContent="center"
                        hitSlop={touchSlop({ width: 30, height: 30 })}
                        pressStyle={{ opacity: 0.5 }}
                        onPress={reading ? cancelReading : undefined}
                        accessibilityRole="button"
                        accessibilityLabel={t('send.attachments.cancel')}
                        testID="composeCancelAttach"
                      >
                        <CloseIcon size={16} color={theme.textFaint} />
                      </XStack>
                    </XStack>
                    {reading ? null : (
                      /* Design: full-width, 46px tall, 1.5px DASHED bds, radius 13, gap 8 - the same
                         outline as the switcher's "Přidat datovou schránku", so the two affordances
                         read identically. It has to be drawn as SVG (DashedOutline): RN cannot render
                         borderStyle:'dashed' together with a borderRadius on Android - it silently
                         falls back to a SOLID border, which is what this was doing. Its size is the
                         slot's (see above): 46 tall at the default text size, as designed. */
                      <XStack
                        position="absolute"
                        top={0}
                        right={0}
                        bottom={0}
                        left={0}
                        borderRadius={13}
                        alignItems="center"
                        justifyContent="center"
                        gap={8}
                        opacity={busy ? 0.5 : 1}
                        pressStyle={{ opacity: 0.6 }}
                        onPress={busy ? undefined : addAttachment}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: busy }}
                        accessibilityLabel={t('send.attachments.add')}
                        testID="composeAddAttachment"
                      >
                        <DashedOutline radius={13} color={theme.borderStrong} />
                        <PlusIcon size={18} color={theme.warningInk} />
                        <BodyStrong fontSize={14} color={theme.warningInk}>
                          {t('send.attachments.add')}
                        </BodyStrong>
                      </XStack>
                    )}
                  </YStack>
                  {/* No manual "save draft" - the draft auto-saves on exit (FR-007), with an undoable
                  "Koncept uložen" snackbar shown by the route. Send lives in the pinned footer. */}
                </YStack>
              ) : (
                <YStack>
                  {drafts.length > 0 ? (
                    <YStack marginBottom={22}>
                      <Label
                        fontFamily={fonts.bodyBold}
                        fontWeight="700"
                        marginBottom={8}
                      >
                        {t('send.drafts')}
                      </Label>
                      <YStack gap={8}>
                        {drafts.map(d => (
                          // Trailing swipe → Zahodit (undoable); the inline "Zahodit" is the discoverable
                          // a11y fallback and runs the same undoable discard (US4).
                          <SwipeableRow
                            key={d.id}
                            onPress={() => resumeDraft(d)}
                            accessibilityLabel={
                              d.recipientLabel ?? t('send.draft.empty')
                            }
                            pressTestID={`draft-${d.id}`}
                            rightAction={{
                              label: t('send.draft.discard'),
                              icon: (
                                <TrashIcon size={20} color={theme.onBlue} />
                              ),
                              color: theme.onBlue,
                              background: theme.danger,
                              onPress: () => void discardDraft(d),
                              testID: `draftSwipeDiscard-${d.id}`,
                            }}
                          >
                            <XStack
                              backgroundColor={theme.surface}
                              borderWidth={1}
                              borderColor={theme.border}
                              borderRadius={13}
                              paddingVertical={11}
                              paddingHorizontal={13}
                              gap={11}
                              alignItems="center"
                            >
                              <YStack
                                width={36}
                                height={36}
                                borderRadius={11}
                                backgroundColor={theme.violetSoft}
                                alignItems="center"
                                justifyContent="center"
                              >
                                <EditIcon size={18} color={theme.violet} />
                              </YStack>
                              {/* The subject line is ALWAYS rendered (falling back to "(bez předmětu)")
                                so every draft row keeps the same height (no layout jump). */}
                              <YStack flex={1} minWidth={0} gap={1}>
                                <BodyStrong
                                  fontSize={14}
                                  color={theme.text}
                                  numberOfLines={1}
                                >
                                  {d.recipientLabel ?? t('send.draft.empty')}
                                </BodyStrong>
                                <Caption
                                  fontSize={12}
                                  color={theme.textFaint}
                                  numberOfLines={1}
                                >
                                  {d.subject.trim() === ''
                                    ? t('messages.noSubject')
                                    : d.subject}
                                </Caption>
                              </YStack>
                              <GHPressable
                                onPress={() => void discardDraft(d)}
                                accessibilityRole="button"
                                accessibilityLabel={t('send.draft.discard')}
                                testID={`draftDelete-${d.id}`}
                                hitSlop={textSlop('badge', { paddingVertical: 6 })}
                                style={({ pressed }) => ({
                                  paddingHorizontal: 6,
                                  paddingVertical: 6,
                                  opacity: pressed ? 0.5 : 1,
                                })}
                              >
                                <Badge color={theme.danger}>
                                  {t('send.draft.discard')}
                                </Badge>
                              </GHPressable>
                            </XStack>
                          </SwipeableRow>
                        ))}
                      </YStack>
                    </YStack>
                  ) : null}
                  <Label
                    fontFamily={fonts.bodyBold}
                    fontWeight="700"
                    marginBottom={8}
                  >
                    {t('send.recipient')}
                  </Label>
                  {/* No Find button - results auto-load as you type (debounced); Enter searches now.
                    The leading magnifying glass marks it as a search field; it's decorative (taps
                    pass through to the input). */}
                  <YStack>
                    <Input
                      {...inputStyle}
                      width="100%"
                      paddingLeft={42}
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={query}
                      onChangeText={setQuery}
                      placeholder={t('send.recipient.search.short')}
                      returnKeyType="search"
                      onSubmitEditing={() => void runSearch(query)}
                      accessibilityLabel={t('send.recipient.search')}
                      testID="composeRecipientQuery"
                    />
                    <YStack
                      position="absolute"
                      left={14}
                      top={0}
                      bottom={0}
                      justifyContent="center"
                      pointerEvents="none"
                    >
                      <SearchIcon size={19} color={theme.textFaint} />
                    </YStack>
                  </YStack>

                  {searching ? (
                    <XStack
                      gap={8}
                      alignItems="center"
                      paddingVertical={10}
                      marginTop={12}
                    >
                      <Spinner color={theme.blue} />
                      <Caption color={theme.textMuted}>
                        {t('send.recipient.searching')}
                      </Caption>
                    </XStack>
                  ) : error ? (
                    <Caption color={theme.danger} marginTop={12}>
                      {error}
                    </Caption>
                  ) : searched && results.length === 0 ? (
                    <Caption color={theme.textMuted} marginTop={12}>
                      {t('send.recipient.none')}
                    </Caption>
                  ) : results.length > 0 ? (
                    <YStack gap={8} marginTop={12}>
                      {/* The count, and - only when the set actually contains namesakes - one line
                          saying so. The user has to NOTICE two rows share a name before it occurs
                          to them to compare addresses, and with a dozen results that is exactly
                          what fails (015 FR-004a). */}
                      <XStack
                        flexWrap="wrap"
                        alignItems="center"
                        gap={8}
                        paddingHorizontal={2}
                      >
                        <Badge fontSize={12} color={theme.textFaint}>
                          {t('recipient.found')} · {results.length}
                        </Badge>
                        {marked.some(m => m.sameName) ? (
                          <Caption fontSize={12} color={theme.textMuted}>
                            {t('recipient.sameNameHint')}
                          </Caption>
                        ) : null}
                      </XStack>
                      {marked.map(r => (
                        <RecipientRow
                          key={r.boxId}
                          recipient={r}
                          sameName={r.sameName}
                          theme={theme}
                          onPick={() => setRecipient(r)}
                        />
                      ))}
                    </YStack>
                  ) : query.trim() === '' ? (
                    // Initial state: tell the user how to start AND that subject/text/attachments come
                    // after picking a recipient (give the task a shape).
                    <Caption
                      color={theme.textFaint}
                      paddingVertical={14}
                      paddingHorizontal={4}
                    >
                      {t('send.recipient.hint')}
                    </Caption>
                  ) : null}
                </YStack>
              )}
            </KeyboardAwareScrollView>

            {/* Pinned send footer (design §3) - a surfaceAlt bar + top hairline holding the dark,
              high-contrast primary action, so Send never scrolls away. Only once a recipient is
              picked (before that there is nothing to send). */}
            {recipient ? (
              <YStack
                backgroundColor={theme.surfaceAlt}
                borderTopWidth={1}
                borderTopColor={theme.border}
                paddingHorizontal={16}
                paddingTop={12}
                paddingBottom={insets.bottom + 12}
                gap={12}
              >
                {sendError ? (
                  <Caption color={theme.danger} testID="composeSendError">
                    {sendError}
                  </Caption>
                ) : null}
                {showBuyCredit ? (
                  <Button
                    chromeless
                    alignSelf="flex-start"
                    color={theme.warningInk}
                    fontWeight="700"
                    paddingHorizontal={0}
                    // Where to buy PDZ credit: the portal for the box's own environment, from
                    // `endpoints.ts`, so it follows the gov.cz migration with everything else.
                    onPress={() => Linking.openURL(portalUrl(account.host))}
                    testID="composeBuyCredit"
                  >
                    {t('send.buyCredit')}
                  </Button>
                ) : null}
                <PressScale
                  fullWidth
                  busy={busy}
                  disabled={!canSend}
                  onPress={() => doSend(false)}
                  accessibilityLabel={t('send.send')}
                  testID="composeSend"
                >
                  <XStack
                    width="100%"
                    minHeight={52}
                    borderRadius={14}
                    backgroundColor={theme.text}
                    alignItems="center"
                    justifyContent="center"
                    gap={10}
                    opacity={canSend ? 1 : 0.45}
                  >
                    {busy ? (
                      <Spinner size="small" color={theme.surfaceAlt} />
                    ) : null}
                    <BodyStrong color={theme.surfaceAlt}>
                      {busy ? t('send.sending') : t('send.send')}
                    </BodyStrong>
                  </XStack>
                </PressScale>
              </YStack>
            ) : null}
          </KeyboardAvoidingView>
        )}

        {/* Paid-send confirmation - a bottom SHEET (design §7): this is the one action that spends
          money, so it gets a deliberate gate (scrim + sheet + 🪙) with the committing dark button.
          Same handlers/gating as before - only the chrome changed from a centered dialog to a sheet. */}
        {pendingConfirm ? (
          <Modal
            visible
            transparent
            animationType="slide"
            statusBarTranslucent
            onRequestClose={() => {
              if (!busy) {
                setPendingConfirm(null);
              }
            }}
          >
            <Pressable
              accessible={false}
              onPress={() => {
                if (!busy) {
                  setPendingConfirm(null);
                }
              }}
              style={{
                flex: 1,
                backgroundColor: scrim,
                justifyContent: 'flex-end',
                alignItems: 'center',
              }}
            >
              <Pressable accessible={false} onPress={() => {}} style={sheetWidth}>
                <YStack
                  // Containment for VoiceOver, as in theme/Dialog.tsx.
                  accessibilityViewIsModal
                  backgroundColor={theme.surfaceAlt}
                  borderTopLeftRadius={24}
                  borderTopRightRadius={24}
                  paddingHorizontal={18}
                  paddingTop={10}
                  paddingBottom={Math.max(20, insets.bottom + 8)}
                  style={{ boxShadow: depth.lg }}
                  testID="composeConfirm"
                >
                  {/* Grab handle */}
                  <YStack
                    width={40}
                    height={4}
                    borderRadius={2}
                    backgroundColor={theme.borderStrong}
                    alignSelf="center"
                    marginTop={6}
                    marginBottom={16}
                  />
                  <XStack gap={11} alignItems="center" marginBottom={12}>
                    <YStack
                      width={44}
                      height={44}
                      borderRadius={13}
                      backgroundColor={theme.goldSoft}
                      alignItems="center"
                      justifyContent="center"
                    >
                      <CreditCardIcon size={24} color={theme.warningInk} />
                    </YStack>
                    <Title
                      fontFamily={fonts.displayBold}
                      fontSize={18}
                      fontWeight="700"
                      letterSpacing={0}
                      color={theme.text}
                      flex={1}
                    >
                      {t('send.confirm.title')}
                    </Title>
                  </XStack>
                  <Body
                    fontFamily={fonts.bodyMedium}
                    color={theme.textMuted}
                    fontSize={14}
                    fontWeight="500"
                    lineHeight={20}
                  >
                    {t('send.confirm.body', {
                      czk: pendingConfirm.estimate.approxCzk ?? 0,
                    })}
                  </Body>
                  <YStack
                    backgroundColor={theme.surfaceSunken}
                    borderRadius={12}
                    paddingHorizontal={14}
                    paddingVertical={11}
                    marginTop={16}
                    marginBottom={16}
                  >
                    <Value fontSize={13} color={theme.text}>
                      {t('send.confirm.balance', {
                        czk: pendingConfirm.credit.balanceCzk,
                      })}
                    </Value>
                  </YStack>
                  <PressScale
                    fullWidth
                    busy={busy}
                    onPress={() => doSend(true)}
                    accessibilityLabel={t('send.confirm.send', {
                      czk: pendingConfirm.estimate.approxCzk ?? 0,
                    })}
                    testID="composeConfirmSend"
                  >
                    <XStack
                      width="100%"
                      minHeight={52}
                      borderRadius={14}
                      backgroundColor={theme.text}
                      alignItems="center"
                      justifyContent="center"
                      opacity={busy ? 0.6 : 1}
                    >
                      <BodyStrong color={theme.surfaceAlt}>
                        {t('send.confirm.send', {
                          czk: pendingConfirm.estimate.approxCzk ?? 0,
                        })}
                      </BodyStrong>
                    </XStack>
                  </PressScale>
                  <Button
                    chromeless
                    width="100%"
                    minHeight={48}
                    marginTop={4}
                    color={theme.textMuted}
                    fontSize={14}
                    fontWeight="700"
                    disabled={busy}
                    onPress={() => setPendingConfirm(null)}
                    testID="composeConfirmCancel"
                  >
                    {t('login.cancel')}
                  </Button>
                </YStack>
              </Pressable>
            </Pressable>
          </Modal>
        ) : null}
      </YStack>
    );
  },
);
ComposeScreen.displayName = 'ComposeScreen';

/**
 * One search result (015, reworked to the design).
 *
 * Everything here follows from one fact: a search for a common surname returns several people with
 * the SAME name, identical in type and cost badge, and the address is the only thing that separates
 * them. The old row concatenated name and address onto one clipped line, so the address - always
 * last - was what got cut. Nothing in this row truncates now, and the meta line WRAPS so the cost
 * badge can never reclaim the width the address needs.
 */
function RecipientRow({
  recipient,
  sameName,
  theme,
  onPick,
}: {
  readonly recipient: Recipient;
  /** Another result in this same search shares this owner name (015 FR-004a). */
  readonly sameName: boolean;
  readonly theme: ReturnType<typeof useTheme>;
  readonly onPick: () => void;
}) {
  const free = recipient.dbType === 'OVM';
  const tone = chipTone(free ? 'costFree' : 'costPaid', theme);
  return (
    <XStack
      backgroundColor={theme.surface}
      borderWidth={1}
      borderColor={theme.border}
      borderRadius={13}
      padding={12}
      gap={11}
      alignItems="flex-start"
      pressStyle={{ opacity: 0.7 }}
      onPress={onPick}
      accessibilityRole="button"
      accessibilityLabel={
        recipient.address
          ? `${recipient.name}, ${recipient.address}`
          : recipient.name
      }
      testID={`recipient-${recipient.boxId}`}
    >
      {/* Initials come from the NAME. Derived from the old combined label they were computed from
          "Jan Novak · Nová 1/777, 60200 Brno, CZ" (FR-006). */}
      <Avatar name={recipient.name} size={38} />
      <YStack flex={1} minWidth={0} gap={1}>
        <BodyStrong fontSize={14} lineHeight={19} color={theme.text}>
          {recipient.name}
        </BodyStrong>
        <AddressLines address={recipient.address} />
        {/* Wraps: with a long box type, a cost badge and possibly the same-name tag, a fixed row
            would start squeezing something - and the thing it squeezed last time was the address. */}
        <XStack flexWrap="wrap" alignItems="center" gap={8} marginTop={8}>
          <Caption fontSize={12} color={theme.textFaint}>
            {t(`send.dbType.${recipient.dbType}`)} · {recipient.boxId}
          </Caption>
          <YStack
            paddingHorizontal={8}
            paddingVertical={3}
            borderRadius={8}
            backgroundColor={tone.bg}
          >
            <Badge color={tone.fg} fontSize={11}>
              {free ? t('send.cost.free') : t('send.cost.paid.badge')}
            </Badge>
          </YStack>
          {sameName ? (
            <YStack
              paddingHorizontal={8}
              paddingVertical={3}
              borderRadius={8}
              backgroundColor={theme.surfaceSunken}
            >
              <Badge color={theme.textMuted} fontSize={11}>
                {t('recipient.sameName')}
              </Badge>
            </YStack>
          ) : null}
        </XStack>
      </YStack>
    </XStack>
  );
}
