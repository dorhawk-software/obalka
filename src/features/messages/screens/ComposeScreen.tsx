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
import { KeyboardAvoidingView, Linking, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../../theme/ScreenHeader';
import { textSlop } from '../../../theme/touchTarget';
import { XStack, YStack } from '../../../theme/ui';
import { KeyboardAwareScrollView } from '../../../theme/KeyboardAwareScrollView';
import { PressScale } from '../../../theme/PressScale';
import { BodyStrong, Caption, SmallStrong } from '../../../theme/Typography';
import { useTheme } from '../../../theme/ThemeProvider';
import { ArcSpinner } from '../../../theme/ArcSpinner';
import { ExternalLinkIcon } from '../../../theme/icons';
import { markSameName } from '../state/addressParts';
import { creditState } from '../state/credit';
import { totalAttachmentBytes } from '../state/costModel';
import { useSnackbar } from '../../../app/Snackbar';
import { formatBytes, t } from '../../../i18n/strings';
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
import { SentResult } from './SentResult';
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
import { SenderSheet } from './SenderPicker';
import { PaidSendConfirm } from './PaidSendConfirm';
import { ComposeEnvelope, RecipientWindow, SearchWindow } from './ComposeEnvelope';
import {
  AttachmentList,
  ComposeLetter,
  CreditShortStrip,
  DraftSheets,
  RecipientSheet,
  ResultsHead,
  SearchLine,
  type SearchState,
} from './ComposeParts';

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


export interface ComposeScreenProps {
  /** The sender (027). Changing it keeps the draft: recipient, subject, text and attachments. */
  readonly account: DataBoxAccount;
  /** Every box, for the sender sheet. "Změnit" is offered when there is more than one. */
  readonly accounts?: readonly DataBoxAccount[];
  /** Make another box the sender. Absent: the sender cannot be changed here. */
  readonly onChangeSender?: (boxId: string) => void;
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
  function ComposeScreenView(
    { account, accounts = [], onChangeSender, onBack, onOpenSent },
    ref,
  ) {
    const theme = useTheme();
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
    /** When ISDS answered with the ID, and what the send cost (null: free) - the sent result's facts. */
    const [sentAt, setSentAt] = useState(0);
    const [sentCzk, setSentCzk] = useState<number | null>(null);
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

    // The sender, read at CALL time (audit 2026-10-03). The accounts are re-read on every screen focus and
    // every switcher open and handed down as new objects with the same contents; an effect keyed on the
    // object re-ran the ISDS credit lookup and the recipient search each time. Keyed on `boxId` instead,
    // they re-run when the sender really changes.
    const accountRef = useRef(account);
    accountRef.current = account;
    const [choosingSender, setChoosingSender] = useState(false);

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
      const sender = accountRef.current;
      void messagesController
        .getCredit(sender, ctrl.signal)
        .then(czk => {
          if (alive && czk != null) {
            setFreshCredit(czk);
            void accountsController.recordCredit(sender.boxId, czk); // keep the switcher in step
          }
        })
        .catch(() => {}); // never break compose over a balance
      return () => {
        alive = false;
        ctrl.abort();
      };
    }, [paidRecipient, account.boxId]);

    // Another sender's balance is not this one's: a new sender starts from its stored credit again.
    useEffect(() => {
      setFreshCredit(undefined);
    }, [account.boxId]);

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

    // Stable across keystrokes and across re-reads of the accounts (keyed on the sender's `boxId`) - the
    // query is passed in, so the debounce effect below can call it without re-subscribing.
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
          accountRef.current,
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [account.boxId],
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
            docs = hasBody ? [await textToPdf({ sender: account, recipient, subject, text: bodyText }), ...files] : files;
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
              // No haptic here: the sent result thumps when its postmark lands (031, board Motion).
              reconcilePending.current = false;
              setSentReconciled(out.reconciled === true);
              setSentAt(Date.now());
              {
                const cost = sendController.estimate(recipient, files);
                setSentCzk(cost.paid ? cost.approxCzk : null);
              }
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

    // The one line under the window (R12): each state takes the same place.
    const searchState: SearchState = searching
      ? 'searching'
      : error
        ? 'error'
        : searched && results.length === 0
          ? 'none'
          : results.length > 0
            ? 'results'
            : query.trim() === ''
              ? 'hint'
              : 'idle';

    return (
      <YStack flex={1} backgroundColor={theme.bg}>
        {/* No test-env banner: you reach compose FROM the list, which already carries the
            "Testovací" pill. */}
        {sentId && recipient ? (
          /* 031 (board Sent): the envelope that went, cancelled; no header - "Hotovo" is the way back. */
          <SentResult
            account={account}
            recipient={recipient}
            messageId={sentId}
            sentAt={sentAt}
            paidCzk={sentCzk}
            reconciled={sentReconciled}
            status={sentStatus}
            opening={opening}
            onDone={onBack}
            onOpenSent={() => {
              const id = sentId;
              void openOnce(async () => {
                setOpening(true);
                await recorded.current;
                onOpenSent(id);
              });
            }}
          />
        ) : (
          /* KeyboardAvoidingView lifts the pinned send footer above the keyboard - on Android 15+
             (edge-to-edge) the window no longer resizes for adjustResize, so a sibling footer would
             otherwise sit behind the IME. */
          <>
          <ScreenHeader title={t('send.title')} onBack={onBack} testID="composeBack" />
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <KeyboardAwareScrollView
              style={{ flex: 1 }}
              testID="composeScroll"
              // The KeyboardAvoidingView above handles the keyboard; a second inset double-adjusts.
              adjustKeyboardInsets={false}
              contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, gap: 12 }}
            >
              {/* The envelope you are sending, and the letter tucked under its edge (R2). */}
              <YStack>
                <ComposeEnvelope
                  account={account}
                  // Only under a paid stamp: the credit is what a postal data message is paid from (R2).
                  credit={estimate?.paid ? credit : undefined}
                  estimate={estimate}
                  onChangeSender={
                    onChangeSender && accounts.length > 1 ? () => setChoosingSender(true) : undefined
                  }
                >
                  {recipient ? (
                    <RecipientWindow
                      recipient={recipient}
                      onChange={() => {
                        setRecipient(null);
                        setResults([]);
                        setSearched(false);
                      }}
                    />
                  ) : (
                    <SearchWindow value={query} onChangeText={setQuery} onSubmit={() => void runSearch(query)} />
                  )}
                </ComposeEnvelope>
                {recipient ? (
                  <ComposeLetter subject={subject} onSubject={setSubject} body={bodyText} onBody={setBodyText} />
                ) : null}
              </YStack>
              {recipient ? (
                <>
                  {/* Judged on a KNOWN balance only (020 FR-003); the balance itself is on the envelope. */}
                  {estimate?.paid && credit.kind === 'short' ? <CreditShortStrip /> : null}
                  <AttachmentList
                    files={files}
                    onRemove={f => setFiles(prev => prev.filter(x => x !== f))}
                    reading={reading != null}
                    readingLabel={readingLabel}
                    fraction={reading != null && reading.totalBytes > 0 ? reading.readBytes / reading.totalBytes : 0}
                    onCancel={cancelReading}
                    onAdd={() => void addAttachment()}
                    busy={busy}
                  />
                  {/* No manual "save draft" - the draft auto-saves on exit (FR-007), with an undoable
                      "Koncept uložen" snackbar shown by the route. Send lives in the pinned footer. */}
                </>
              ) : (
                <>
                  <SearchLine state={searchState} error={error} />
                  {searchState === 'results' ? (
                    <>
                      <ResultsHead count={results.length} sameName={marked.some(m => m.sameName)} />
                      {marked.map(r => (
                        <RecipientSheet
                          key={r.boxId}
                          recipient={r}
                          sameName={r.sameName}
                          onPick={() => setRecipient(r)}
                        />
                      ))}
                    </>
                  ) : null}
                  {searchState === 'hint' ? (
                    <DraftSheets drafts={drafts} onResume={resumeDraft} onDiscard={d => void discardDraft(d)} />
                  ) : null}
                </>
              )}
            </KeyboardAwareScrollView>

            {/* The pinned footer (R12): Odeslat never scrolls away; what refused the send says so
                above it. Only once a recipient is picked - before that there is nothing to send. */}
            {recipient ? (
              <YStack
                backgroundColor={theme.surfaceAlt}
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
                  <XStack
                    alignSelf="flex-start"
                    alignItems="center"
                    gap={6}
                    marginTop={-4}
                    hitSlop={textSlop('smallStrong')}
                    pressStyle={{ opacity: 0.6 }}
                    // Where to buy PDZ credit: the portal for the box's own environment, from
                    // `endpoints.ts`, so it follows the gov.cz migration with everything else.
                    onPress={() => void Linking.openURL(portalUrl(account.host))}
                    accessibilityRole="link"
                    accessibilityLabel={t('send.buyCredit')}
                    testID="composeBuyCredit"
                  >
                    <SmallStrong color={theme.warningInk}>{t('send.buyCredit')}</SmallStrong>
                    <ExternalLinkIcon size={16} color={theme.warningInk} />
                  </XStack>
                ) : null}
                <PressScale
                  fullWidth
                  busy={busy}
                  disabled={!canSend}
                  onPress={() => doSend(false)}
                  accessibilityLabel={t('send.send')}
                  testID="composeSend"
                >
                  {/* Faded as one, as the board's group opacity does: without its own layer Android
                      fades the words and the ink apart, and the words sink into the faded ink. */}
                  <View style={{ width: '100%', opacity: canSend ? 1 : 0.45 }} needsOffscreenAlphaCompositing>
                    <XStack
                      width="100%"
                      minHeight={52}
                      borderRadius={14}
                      backgroundColor={theme.text}
                      alignItems="center"
                      justifyContent="center"
                      gap={10}
                      testID="composeSendFace"
                    >
                      {busy ? <ArcSpinner track={theme.surfaceSunken} ink={theme.surfaceAlt} /> : null}
                      <BodyStrong color={theme.surfaceAlt}>{busy ? t('send.sending') : t('send.send')}</BodyStrong>
                    </XStack>
                  </View>
                </PressScale>
              </YStack>
            ) : null}
          </KeyboardAvoidingView>
          </>
        )}

        {pendingConfirm ? (
          <PaidSendConfirm
            approxCzk={pendingConfirm.estimate.approxCzk ?? 0}
            balanceCzk={pendingConfirm.credit.balanceCzk}
            busy={busy}
            onSend={() => doSend(true)}
            onCancel={() => setPendingConfirm(null)}
          />
        ) : null}
        {choosingSender && onChangeSender ? (
          <SenderSheet
            accounts={accounts}
            selected={account.boxId}
            onPick={boxId => {
              setChoosingSender(false);
              if (boxId !== account.boxId) {
                onChangeSender(boxId);
              }
            }}
            onClose={() => setChoosingSender(false)}
          />
        ) : null}
      </YStack>
    );
  },
);
ComposeScreen.displayName = 'ComposeScreen';
