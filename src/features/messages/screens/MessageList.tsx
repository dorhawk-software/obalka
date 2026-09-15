import {
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  type LayoutChangeEvent,
  Linking,
  RefreshControl,
  ScrollView,
  SectionList,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { Button, XStack, YStack } from '../../../theme/ui';
import {
  Badge,
  Body,
  BodyStrong,
  Caption,
  Display,
  Heading,
  Label,
  Title,
} from '../../../theme/Typography';
import { fonts } from '../../../theme/typography';
import { useTheme } from '../../../theme/ThemeProvider';
import {
  AlertIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CloudOffGlyph,
  ContentErasedIcon,
  EditIcon,
  HelpIcon,
  LayersIcon,
  MailGlyph,
  SearchIcon,
  SendGlyph,
  StatusAcceptedIcon,
  TimerIcon,
  VaultIcon,
  WifiOffIcon,
} from '../../../theme/icons';
import { TestTag } from '../../accounts/screens/BoxRow';
import { BoxIdentityLine } from '../../accounts/screens/BoxIdentityLine';
import { SegmentedControl } from '../../../theme/SegmentedControl';
import { Fab, useFabClearance } from '../../../theme/Fab';
import { EmptyState } from '../../../theme/EmptyState';
import { Skeleton } from '../../../theme/Skeleton';
import { Avatar } from '../../../theme/Avatar';
import { chipTone } from '../../../theme/chipTone';
import { HeroIcon } from '../../../theme/iconTiers';
import {
  attentionEntries,
  summarizeAttention,
  type AttentionEntry,
  type AttentionSummary,
} from '../state/attention';
import type { Reminder } from '../state/reminders';
import { formatTermDate } from './TermPicker';
import {
  passwordExpiry,
  refusedForExpiredPassword,
} from '../../accounts/state/passwordExpiry';
import {
  freshnessLabel,
  groupByDate,
  rowDate,
  type DateSectionLabel,
} from '../state/groupByDate';
import { sentFictionCountdown, servedByFiction } from '../state/fikce';
import {
  fictionCountdownTone,
  messageStatus,
  showsListChip,
} from '../state/messageState';
import {
  attentionRowLabel,
  receivedRowLabel,
  sentRowLabel,
  termChipLabel,
} from '../state/rowLabel';
import { DeliveryStateIcon } from './DeliveryStateIcon';
import { haptics } from '../../../services/haptics';
import { reportFailure } from '../../../services/telemetry/telemetry';
import { useHeaderTop } from '../../../theme/useHeaderTop';
import { touchSlop } from '../../../theme/touchTarget';
import { t, plural } from '../../../i18n/strings';
import { FAQ_LEGEND_ID, type FaqId } from '../../../content/faq';
import { storedReauthKey } from '../../accounts/state/reauthCopy';
import { portalUrl } from '../../../services/isds/endpoints';
import {
  type DataBoxAccount,
  type Host,
  type MessageEnvelope,
} from '../../../services/isds/types';
import type { MessageFolder } from '../../../services/db/messagesStore';
import {
  messagesController,
  draftsStore,
  remindersController,
} from '../../accounts/deps';
import {
  isUnread,
  needsSignIn,
  type MessagesOutcome,
} from '../state/messagesController';
import type { BoxAttention } from '../state/crossBox';
import { CrossBoxLine, crossBoxSummary } from './CrossBoxLine';
import { BoxPill } from './BoxPill';
import { draftsBus } from '../state/draftsBus';

/**
 * The reminder feed is empty until US2 stores any. Module-level so the identity is stable - a fresh
 * `[]` each render would not break `attentionEntries` (it is pure), but it is the kind of thing that
 * silently defeats memoization the moment someone adds it.
 */
const NO_REMINDERS: readonly Reminder[] = [];

type State =
  | { status: 'loading' }
  | {
      status: 'loaded';
      // The folder these messages belong to - pinned to the data (NOT the live segment) so switching
      // tabs never renders one folder's messages with the other's orientation (no stale flash).
      folder: MessageFolder;
  /** Set only in the merged view - see `ReceivedRow`. */
  boxAccount?: DataBoxAccount;
      messages: MessageEnvelope[];
      downloaded: Set<string>;
      /**
       * Why these rows are not fresh - `null` when they are.
       *
       * It used to be a boolean called `fromCache`, and the banner it drove said "Offline". That is
       * a claim about the NETWORK, and the app was making it after any failed sync at all: a server
       * fault, a timeout, an expired session. A user with a perfectly good connection was told they
       * had none (reported 2026-08-19). The banner now says which of the two it actually is.
       */
      stale: 'offline' | 'failed' | null;
      /** When this folder last synced successfully, or null = never. Drives the freshness line. */
      syncedAt: number | null;
    }
  | { status: 'reauth' }
  | { status: 'error'; messageKey: string };

/**
 * A list section. RECEIVED = a "Vyžaduje pozornost" group (delivery-fiction signal) on top, then the
 * remainder date-grouped (Dnes / Tento týden / …); SENT is date-grouped throughout. One union so a
 * single SectionList renders both folders; the row component is chosen by folder, the header by `kind`.
 */
type InboxSection =
  | {
      key: string;
      kind: 'attention';
      data: MessageEnvelope[];
      /** Why each row is here, by message id - the card renders a different chip per reason. */
      reasons: Map<string, AttentionEntry>;
      /** What the group is made of, for its derived subtitle. */
      summary: AttentionSummary;
    }
  | { key: string; kind: 'date'; label: DateSectionLabel; data: MessageEnvelope[] }
  // 024: the one-line "elsewhere" notice. A section with NO rows, so it is drawn entirely by
  // `renderSectionHeader` - which is what puts it between this box's attention block and its date
  // sections, scrolling with the list, instead of floating above everything as a card did.
  | { key: string; kind: 'crossBox'; data: []; boxes: readonly BoxAttention[] };

/** Localized date-section header (a fixed bucket, or "Month Year" for older groups). */
function sectionTitle(label: DateSectionLabel): string {
  switch (label.kind) {
    case 'today':
      return t('messages.section.today');
    case 'yesterday':
      return t('messages.section.yesterday');
    case 'thisWeek':
      return t('messages.section.thisWeek');
    case 'thisMonth':
      return t('messages.section.thisMonth');
    case 'month':
      return `${t(`messages.month.${label.month}`)} ${label.year}`;
  }
}

/**
 * The design's slim sync bar: a RESERVED 3px strip (so the list never shifts) in which a 38%-wide
 * brand-blue bar sweeps across while a sync runs. Keyframes copied from the design (`rprog`):
 * translateX(-110%) → translateX(320%) of the BAR's own width, 1.3s, ease-in-out, infinite.
 * Reduce Motion → the bar is shown static (no sweep).
 */
function SyncProgressBar({ active }: { readonly active: boolean }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const barWidth = width * 0.38;
  const x = useSharedValue(0);

  useEffect(() => {
    if (!active || reduceMotion || barWidth === 0) {
      cancelAnimation(x);
      return;
    }
    x.value = -1.1 * barWidth;
    x.value = withRepeat(
      withTiming(3.2 * barWidth, {
        duration: 1300,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      false,
    );
    return () => cancelAnimation(x);
  }, [active, reduceMotion, barWidth, x]);

  const sweep = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  return (
    <YStack
      height={3}
      backgroundColor={theme.bg}
      overflow="hidden"
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {active && barWidth > 0 ? (
        <Animated.View
          style={[
            {
              height: '100%',
              width: barWidth,
              backgroundColor: theme.blue,
              borderTopRightRadius: 2,
              borderBottomRightRadius: 2,
            },
            reduceMotion ? undefined : sweep,
          ]}
        />
      ) : null}
    </YStack>
  );
}

/**
 * The end of the list: a hairline, then how fresh what you just read is.
 *
 * TWO findings meet here, which is why it is one element and not two.
 *
 *   * The screen never said how old the rows were. The store had computed `syncedAt` all along and
 *     every caller dropped it - and after 014 removed background sync, freshness is purely a
 *     consequence of the user's own last action, so it is the one thing only the app can report.
 *   * The list had no ending. Rows draw a hairline on TOP of themselves, so the last one ran out
 *     into paper mid-stroke, and a user who scrolled to the bottom got no closure at all.
 *
 * It lives at the BOTTOM deliberately. The first attempt put it under the header as a reserved
 * 22dp row, which fixed the first finding by making a third one worse: the top of this screen
 * already carries a box switcher, a segmented control, a sync bar and up to two strips before the
 * first message, and permanent chrome is exactly what it does not need. Below the last row it costs
 * no screen at all, and it is where "that is everything, as of X" has always belonged.
 *
 * Silent while a sync is in flight - the bar at the top is already saying that.
 */
function ListEnd({
  syncedAt,
  syncing,
  now,
}: {
  readonly syncedAt: number | null;
  readonly syncing: boolean;
  readonly now: number;
}) {
  const theme = useTheme();
  const label = freshnessLabel(syncedAt, now);
  let text = '';
  if (!syncing) {
    if (label == null) {
      text = t('messages.synced.never');
    } else if (label === 'now') {
      text = t('messages.synced.now');
    } else if (label.startsWith('min:')) {
      const n = Number(label.slice(4));
      text = t(`messages.synced.min.${plural(n)}`, { n });
    } else if (label.startsWith('at:')) {
      text = t('messages.synced.at', { d: label.slice(3) });
    } else {
      text = t('messages.synced.on', { d: label.slice(3) });
    }
  }
  return (
    <YStack>
      {/* The list's own closing edge - the counterpart to each row's top hairline. */}
      <YStack height={1} backgroundColor={theme.border} />
      <YStack paddingTop={14} paddingBottom={4} alignItems="center">
        <Caption fontSize={12} dense color={theme.textFaint} numberOfLines={1}>
          {text}
        </Caption>
      </YStack>
    </YStack>
  );
}

/**
 * The SENT-side countdown label: "Adresát dosud nepřevzal · Fikce za 4 dny". Days are pluralized for
 * Czech; at 0 the fiction lands today. This is the only countdown left in the app - see `fikce.ts` for
 * why the received side cannot have one.
 */
function sentCountdownLabel(daysRemaining: number): string {
  const tail =
    daysRemaining === 0
      ? t('status.fikce.today')
      : t(`status.fikce.in.${plural(daysRemaining)}`, { n: daysRemaining });
  return `${t('status.notPickedUp')} · ${tail}`;
}

/**
 * The attention group's subtitle, DERIVED from its contents.
 *
 * It used to be one fixed legend - "Nepřečtené, blížící se termíny a zprávy doručené bez vás" -
 * printed under a numeral that counts four incommensurable feeds. So the loudest element on the
 * screen said the same sentence whether it stood for one overdue deadline or forty unread
 * newsletters, and the number could not be decoded without doing the scanning it was meant to save
 * (2026-09-09 critique). The legend also said "blížící se termíny" while overdue items sort to the
 * very top, so it did not even cover the group's most urgent member.
 */
function attentionSubtitle(summary: AttentionSummary): string {
  const parts: string[] = [];
  const add = (n: number, key: string) => {
    if (n > 0) {
      parts.push(t(`${key}.${plural(n)}`, { n }));
    }
  };
  // Overdue first, and counted apart from the rest of the dated items - being late is a different
  // fact from having a date.
  add(summary.overdue, 'attn.overdue');
  add(summary.dated - summary.overdue, 'attn.dated');
  add(summary.fiction, 'attn.fiction');
  add(summary.unread, 'attn.unread');
  add(summary.unreadBeyondCap, 'attn.more');
  return parts.join(' · ');
}

export interface MessageListProps {
  readonly account: DataBoxAccount;
  /** Open the box-switcher bottom sheet (the inbox is the home - no back chevron). */
  readonly onOpenSwitcher: () => void;
  /** Open global search from the inbox header. */
  readonly onSearch: () => void;
  /**
   * Open the help answer that explains a term the screen just used.
   *
   * `content/faq.ts` carries excellent, legally sourced answers for exactly the vocabulary this
   * screen prints - "fikce", "dodáno" vs "doručeno" - and `FaqScreen` has accepted a `focus` id
   * since it was written. Only Settings and Backup ever passed one, so a user who saw "lhůta už
   * běží" on the home screen had no way to find out what lhůta (2026-09-09 critique).
   */
  readonly onOpenFaq: (focus: FaqId) => void;
  /**
   * Open a message. The BOX is passed explicitly, because in the merged view the row's box is not
   * the active one - opening a row in whichever box happened to be selected would show a different
   * message, or none, and in this app the boxes are different legal entities.
   */
  readonly onOpenMessage: (
    messageId: string,
    folder: MessageFolder,
    boxId: string,
  ) => void;
  readonly onCompose: () => void;
  /**
   * Re-authenticate this box when its session/credentials expired (reauth empty-state), handing over
   * the moment ISDS refused it: the re-auth screen judges an expired password at that same moment, so
   * it cannot read differently from the strip that opened it (001 FR-009).
   */
  readonly onReauth: (refusedAt: number) => void;
  /**
   * Incremented by the shell when a re-authentication SUCCEEDS.
   *
   * Without it the expired-session strip survived a successful sign-in: this screen clears the strip
   * only when a sync reports back, and after a re-auth the box, the folder and the refresh callback
   * are all unchanged - so nothing re-ran and the strip sat there until the user pulled to refresh.
   */
  readonly resyncNonce?: number;
  /**
   * What the OTHER boxes hold (023 option C), or null while the shell is still reading it.
   *
   * Null holds the skeleton rather than painting the list without it - see `loaded`. A card that
   * appears a beat after the rows have settled pushes them down, which is the exact complaint the
   * freshness line earned when it did that (constitution V).
   */
  readonly crossBox?: BoxAttention[] | null;
  /**
   * The MERGED view (024 cycle 2): this same list, showing every box at once.
   *
   * A mode rather than a second screen, and that is the whole point. The first attempt built a
   * separate `UnifiedInbox` and it drifted immediately - no avatars, no month sections, different
   * row metrics - because two components drawing "an inbox" is two places for the design to live.
   * Reported in exactly those terms. The only thing that genuinely differs between the two views is
   * whether a row has to say WHICH box it belongs to, so that is the only thing this flag changes.
   *
   * `account` stays the active box even here: the header's switcher, the drafts entry and the
   * compose action all still belong to it, and the user leaves the merged view by picking a box.
   */
  readonly unified?: {
    accounts: readonly DataBoxAccount[];
    /** Refresh every box - the shell's `refreshAll`, the same call launch makes. */
    onRefreshAll: () => void;
    /** Re-authenticate one box, from the "could not reach" strip. */
    onReauthBox: (boxId: string) => void;
  } | null;
}

/**
 * Hands the Data Boxes portal for this box's environment to the OS browser.
 *
 * A hand-off, not a fetch - and the only thing the app can honestly offer here, since changing an
 * ISDS password is not something it can do (there is no ChangeISDSPassword call in this app). A
 * failure is inert: the strip simply does nothing rather than raising an error nobody can act on.
 *
 * Per environment since 2026-09-14. It opened the PRODUCTION portal for every box, so a test box's
 * "Změnit v portálu" landed on a portal where that test login does not exist.
 */
function openPortal(host: Host): void {
  void Linking.openURL(portalUrl(host)).catch(() => {});
}

export function MessageList({
  account,
  onOpenSwitcher,
  onSearch,
  onOpenFaq,
  onOpenMessage,
  onCompose,
  onReauth,
  resyncNonce = 0,
  crossBox = [],
  unified = null,
}: MessageListProps) {
  const theme = useTheme();
  // A czebox box is marked by the "Testovací" PILL next to its name in the header (and in the box
  // switcher). No test-env banner here: it would just say the same thing twice. The banner is now
  // reserved for the message detail, the one place with no other environment cue.
  const isTestBox = account.host === 'czebox';
  const headerTop = useHeaderTop();
  // How far the scroll has to end above the screen's bottom edge to clear the compose FAB - asked of
  // the FAB rather than guessed, so the two cannot drift apart.
  const fabClearance = useFabClearance();
  const [state, setState] = useState<State>({ status: 'loading' });
  // The box's reminders, for the attention group and the row chips. Local-only, so this is a cheap
  // read with no network and no legal consequence - reloaded on focus because the detail screen is
  // where a reminder is set, and coming back must show it.
  //
  // `null` means NOT READ YET, and the list holds its skeleton until it is. That is how 010 keeps
  // Principle V: chips that arrive a frame after the rows would shove every row below them down, and
  // the alternative - permanently reserving a chip-sized gap on every row - pays for the jump with
  // dead space on the rows that never get a chip, and drifts the row metrics away from the design.
  // Reserving nothing and painting the chips in the FIRST frame costs one local table read.
  const [reminders, setReminders] = useState<readonly Reminder[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Background-sync indicator (the cache is shown instantly; this signals a live refresh is in flight,
  // distinct from the pull-to-refresh `refreshing` spinner).
  const [syncing, setSyncing] = useState(false);
  // The box's session/credentials expired. The design surfaces this as an INLINE gold strip pinned
  // under the header (the cached list stays readable behind it) - never a full-screen takeover.
  const [needsReauth, setNeedsReauth] = useState(false);
  // When that sync was refused - the moment the strip asks "was it an expired password?" (001
  // FR-009), as `classifyFailure` does for the stored flag. Not the render clock: a refusal a minute
  // before the stored expiry date would turn into "change it on the portal" on a later re-render,
  // while the strip is on screen, and grow it by a row of actions above a list being read.
  const [refusedAt, setRefusedAt] = useState(0);
  // Which box each merged row belongs to. Empty in per-box mode, where the answer is always the
  // active box and no row needs to say it. Keyed by message id, which is ISDS's globally unique
  // `dmID`, so one map covers every box without a composite key.
  const [boxByMessage, setBoxByMessage] = useState<Map<string, string>>(
    new Map(),
  );
  // Drafts held for this box - the count drives the entry above the list.
  const [draftCount, setDraftCount] = useState(0);
  // Přijaté | Odeslané - which ISDS folder is shown (008). Default received; resets per box open.
  const [folder, setFolder] = useState<MessageFolder>('received');
  const inFlight = useRef<AbortController | null>(null);

  // Live-sync the current folder from ISDS (runs in the background behind the cached view). Updates on
  // success; on failure keeps whatever's shown (cache), surfacing reauth/error only if nothing is yet.
  // The live account, read at CALL time. `refresh` must not be rebuilt when the account object changes
  // identity while still describing the same box - and it does, constantly: `reloadAccounts()` re-reads
  // the table on every screen focus AND on every box-switcher open, handing down freshly constructed
  // objects with identical contents. `refresh` sits in the open-folder effect's dependency list, so
  // that identity churn used to re-run the effect: it aborted the in-flight sync, re-rendered the list
  // from cache (a visible flash of a different message set), and fired ANOTHER `listReceived` - which
  // under §17(3) legally DELIVERS the user's mail - from a tap that only asked to open the switcher.
  // Keyed on `account.boxId` instead, the effect now re-runs only when the box or folder truly changes.
  const accountRef = useRef(account);
  accountRef.current = account;
  // Read inside `openMessage`, which must stay referentially stable - see the note above it; a row's
  // press handler is one of the props the whole memoisation of this list rests on.
  const boxByMessageRef = useRef(boxByMessage);
  boxByMessageRef.current = boxByMessage;

  /**
   * Opening a message - one function for the whole list, not one per row per render.
   *
   * Each row used to be handed a freshly-created `onPress` arrow, which is a changed prop on every
   * render and would have defeated the memoisation below however carefully the rest was done. The
   * row now receives THIS (stable) plus its own id, and closes over neither.
   */
  const openMessage = useCallback(
    (messageId: string, folder_: MessageFolder) => {
      haptics.selection(); // a light tick on opening a message
      onOpenMessage(
        messageId,
        folder_,
        // Per-box: always the active box. Merged: the row's own, resolved from the read that built
        // the list. Falls back to the active box, which is the only honest guess left.
        boxByMessageRef.current.get(messageId) ?? accountRef.current.boxId,
      );
    },
    [onOpenMessage],
  );

  const loadReminders = useCallback(() => {
    let alive = true;
    void remindersController
      .listForBox(accountRef.current.boxId)
      .then(list => {
        if (alive) {
          setReminders(list);
        }
      })
      .catch(() => {
        if (alive) {
          // No chips beats no inbox (Principle II) - and it must be `[]`, never left at `null`, or a
          // failed read would hold the skeleton up forever.
          setReminders(NO_REMINDERS);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  const refresh = useCallback(
    async (ctrl: AbortController, isUserRefresh: boolean): Promise<void> => {
      const current = accountRef.current;
      // The sync bar reflects ANY refresh in flight, so the bar + the pull-to-
      // refresh read as one thing; a user pull ADDITIONALLY shows the RefreshControl spinner at the top.
      setSyncing(true);
      if (isUserRefresh) {
        setRefreshing(true);
      }
      // MERGED: read the local archive across every box. No network call, so entering this view
      // cannot deliver anybody's mail (17/3); refreshing it is the shell's `refreshAll`, which is
      // the same command shape launch already runs.
      const outcome: MessagesOutcome = unified
        ? await messagesController
            .getMergedMessages(folder)
            .then(merged => {
              setBoxByMessage(
                new Map(merged.hits.map(h => [h.envelope.id, h.boxId])),
              );
              return {
                kind: 'loaded' as const,
                messages: merged.hits.map(h => h.envelope),
                downloaded: merged.downloaded,
                // The archive's own stamp, missing included: this read synced nothing, so "now" in
                // place of a missing stamp told an archive nobody had synced here that it had just
                // been updated (2026-09-24).
                syncedAt: merged.syncedAt,
              };
            })
            .catch(() => ({ kind: 'error' as const, messageKey: 'messages.error' }))
        : folder === 'sent'
        ? await messagesController.listSent(current, ctrl.signal)
        : await messagesController.listReceived(current, ctrl.signal);
      if (ctrl.signal.aborted) {
        return; // a newer sync is in flight; it owns the indicators
      }
      setRefreshing(false);
      setSyncing(false);
      // Drives the inline reauth strip - INDEPENDENT of the list state, so a box with cached messages
      // still tells the user their sign-in expired (the design's `activeNeedsReauth`).
      setNeedsReauth(outcome.kind === 'reauth');
      if (outcome.kind === 'reauth') {
        setRefusedAt(Date.now());
      }
      if (outcome.kind === 'loaded') {
        setState({
          status: 'loaded',
          folder,
          messages: outcome.messages,
          downloaded: new Set(outcome.downloaded),
          stale: null,
          // A successful live sync IS the sync time. The store's own stamp is written on the same
          // pass, but reading it back would cost a round trip to say what we already know. Not in
          // the merged view: it reads the archive and syncs nothing, so its stamp is all there is.
          syncedAt: unified ? outcome.syncedAt : outcome.syncedAt ?? Date.now(),
        });
      } else {
        // Live sync failed. If cached content is already shown, keep it but mark it stale (the offline
        // banner now applies); only surface reauth/error if there's nothing for this folder yet.
        // An expired session gets NO banner: the gold strip above already says the sign-in expired
        // and offers the fix, and a second line reporting that the messages are therefore out of
        // date is the same fact told worse.
        const stale =
          outcome.kind === 'reauth'
            ? null
            : outcome.messageKey === 'messages.error.network'
            ? ('offline' as const)
            : ('failed' as const);
        setState(s =>
          s.status === 'loaded' && s.folder === folder
            ? { ...s, stale }
            : outcome.kind === 'reauth'
            ? { status: 'reauth' }
            : { status: 'error', messageKey: outcome.messageKey },
        );
      }
    },
    // Deliberately NOT `account`: the box is read from the ref at call time. The open-folder effect
    // below keys on `account.boxId` itself, so a real box change still re-runs it. `unified` IS a
    // dependency: it selects the data source, so a stale closure would keep reading the old one.
    [folder, unified],
  );

  // Open the current folder: show its CACHE instantly (snappy, offline-first), THEN sync in the
  // background. Re-runs on box/folder change - switching tabs is immediate from cache.
  useEffect(() => {
    let alive = true;
    inFlight.current?.abort();
    const ctrl = new AbortController();
    inFlight.current = ctrl;
    setSyncing(true); // a sync is imminent - start the bar NOW (before the awaited cache read),
    // so the status line never passes through an empty/blank frame on tab switch (no flash, no collapse)
    void (async () => {
      // A cache that will not read is treated as an empty one (2026-09-24): the sync below still runs
      // and ends the bar, in the list or in the load error with its retry. Unguarded, this rejected
      // with nothing to catch it and the sync never started - the bar ran for good over an empty list.
      const cached = await messagesController
        .getCachedMessages(account.boxId, folder)
        .catch((e: unknown) => {
          reportFailure('db.read', e, { stage: 'persist' });
          return null;
        });
      if (!alive || ctrl.signal.aborted) {
        return;
      }
      if (cached !== null && cached.envelopes.length > 0) {
        // Optimistic cache (sync runs next) - NOT "offline" yet, so no offline banner here. The
        // freshness line is seeded from the cache's own stamp, so an offline open says how old the
        // rows are instead of going blank when the live sync then fails.
        setState({
          status: 'loaded',
          folder,
          messages: cached.envelopes,
          downloaded: new Set(cached.downloaded),
          stale: null,
          syncedAt: cached.syncedAt,
        });
      } else {
        setState({ status: 'loading' });
      }
      await refresh(ctrl, false);
    })();
    return () => {
      alive = false;
      ctrl.abort();
    };
    // `resyncNonce` re-runs this after a successful re-auth - a user-initiated sign-in, so the
    // listing it triggers is one the user asked for (014).
  }, [account.boxId, folder, refresh, resyncNonce, unified?.accounts]);

  // A different box = a different session: drop the previous box's reauth strip until THIS box's sync
  // reports back. (Not reset on a folder switch - the session is per box, so the strip must not blink.)
  useEffect(() => {
    setNeedsReauth(false);
  }, [account.boxId]);

  // Pull-to-refresh / retry - re-sync the current folder with a fresh in-flight controller.
  const onPullRefresh = useCallback(() => {
    inFlight.current?.abort();
    const ctrl = new AbortController();
    inFlight.current = ctrl;
    // MERGED: a pull here means "refresh every box", which is the shell's `refreshAll` and the same
    // command shape launch already runs (014 FR-001 permits pull-to-refresh explicitly). The local
    // re-read below then picks up whatever it wrote, so the rows update either way.
    if (unified) {
      unified.onRefreshAll();
    }
    void refresh(ctrl, true);
  }, [refresh, unified]);

  // Coming back from a detail: re-read the cache (cheap, no network) so changes made there show up
  // immediately without a manual pull-to-refresh - e.g. the dropped unread treatment after opening a
  // message marks it read.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      messagesController
        .getCachedMessages(account.boxId, folder)
        .then(cached => {
          if (alive) {
            setState(s =>
              // Only patch in the cache if we're still showing this same folder (no cross-folder mix).
              s.status === 'loaded' && s.folder === folder
                ? {
                    ...s,
                    messages: cached.envelopes,
                    downloaded: new Set(cached.downloaded),
                    syncedAt: cached.syncedAt ?? s.syncedAt,
                  }
                : s,
            );
          }
        })
        // What is on screen stays; the next sync or visit reads it again. Unguarded, a database that
        // would not open was an unhandled rejection on every visit (2026-09-24).
        .catch((e: unknown) => reportFailure('db.read', e, { stage: 'persist' }));
      // Refresh the draft count too, so saving a draft and returning here updates the entry.
      draftsStore
        .list(account.boxId)
        .then(drafts => {
          if (alive) {
            setDraftCount(drafts.length);
          }
        })
        .catch((e: unknown) => reportFailure('db.read', e, { stage: 'persist' }));
      // A reminder is set on the DETAIL screen, so returning here must pick it up - same reasoning as
      // the cache re-read above, and just as cheap (local table, no network).
      const stopReminders = loadReminders();
      return () => {
        alive = false;
        stopReminders();
      };
    }, [account.boxId, folder, loadReminders]),
  );

  // Keep the draft count live when drafts change ANYWHERE - e.g. the auto-save snackbar's discard/undo
  // fires while this list is already focused, so the focus-effect re-read above wouldn't catch it.
  useEffect(() => {
    let alive = true;
    const refreshDraftCount = () =>
      draftsStore
        .list(account.boxId)
        .then(drafts => {
          if (alive) {
            setDraftCount(drafts.length);
          }
        })
        .catch((e: unknown) => reportFailure('db.read', e, { stage: 'persist' }));
    const unsubscribe = draftsBus.subscribe(refreshDraftCount);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [account.boxId]);

  // Header - the inbox IS the home (011): a "paper" bar (surfaceAlt + a hairline below) carrying the
  // app wordmark + a global search button, then a BOX-SWITCHER button (active box avatar + name + ▾)
  // that opens the switcher sheet, then the Přijaté|Odeslané segment and a CONSTANT-HEIGHT sync line.
  // No back chevron - this is the navigator root, not a pushed per-box screen.
  // Counted from the rows that are actually on screen, never from `account.unreadCount`. The two
  // disagreed on the device - a gold dot on row one under a header claiming nothing was unread -
  // because the record is only rewritten by a successful sync while the dots read envelope state.
  const unreadShown =
    state.status === 'loaded' && state.folder === 'received'
      ? state.messages.reduce((n, m) => n + (isUnread(m.state) ? 1 : 0), 0)
      : 0;

  const header = (
    <YStack>
      {/* Design: ONE unified sunken bar - box selector | 1px divider | search - under a surfaceAlt
          header with a hairline. The design dropped the wordmark row from the inbox entirely. */}
      <YStack
        backgroundColor={theme.surfaceAlt}
        borderBottomWidth={1}
        borderColor={theme.border}
        paddingTop={headerTop}
        paddingHorizontal={12}
        paddingBottom={10}
      >
        <XStack
          alignItems="stretch"
          backgroundColor={theme.surfaceSunken}
          borderRadius={14}
          overflow="hidden"
        >
          <XStack
            flex={1}
            minWidth={0}
            alignItems="center"
            gap={11}
            paddingVertical={9}
            paddingHorizontal={12}
            pressStyle={{ opacity: 0.65 }}
            onPress={onOpenSwitcher}
            accessibilityRole="button"
            accessibilityLabel={account.alias ?? account.label}
            testID="boxSwitcher"
          >
            {unified ? (
              // An OUTLINED tile with a glyph, never an avatar: the switcher makes the same
              // distinction, and a merged view is not an identity. See `UnifiedRow`.
              <YStack
                width={36}
                height={36}
                borderRadius={11}
                borderWidth={1}
                borderColor={theme.borderStrong}
                backgroundColor={theme.surface}
                alignItems="center"
                justifyContent="center"
              >
                <LayersIcon size={18} color={theme.textMuted} />
              </YStack>
            ) : (
              <Avatar
                name={account.alias ?? account.label}
                colorSeed={account.boxId}
                size={36}
              />
            )}
            <YStack flex={1} minWidth={0}>
              <XStack alignItems="center" gap={6}>
                <BodyStrong
                  fontSize={15}
                  color={theme.text}
                  numberOfLines={1}
                  flexShrink={1}
                  // `flexShrink` alone will not take a flex child below its content width, so at a
                  // large text size the name overran the "Testovací" chip and its own ellipsis was
                  // sliced down the middle by the chip's edge. The zero floor is what lets it
                  // actually shrink, and the chip must refuse to.
                  minWidth={0}
                  // …and 2dp of padding, because the box then clips its own ellipsis: RN measures
                  // the shrunk Text a hair narrower than the glyph it draws, so the third dot of
                  // "Ondřej Ši…" was sliced vertically at the box edge. `TestTag` in this same
                  // file hit the identical clipping on "Testovac[í]" and notes it there.
                  paddingRight={2}
                >
                  {unified ? t('unified.title') : account.alias ?? account.label}
                </BodyStrong>
                {!unified && isTestBox ? <TestTag /> : null}
              </XStack>
              {unified ? (
                // A box says "{legal form} · ID {boxId}". The merged view says what it merges and
                // how much of it wants reading - a sentence no single box can produce about itself.
                <Caption fontSize={12} color={theme.textFaint} numberOfLines={1}>
                  {[
                    t(`unified.subtitle.${plural(unified.accounts.length)}`, {
                      n: unified.accounts.length,
                    }),
                    unreadShown > 0
                      ? t(`attn.unread.${plural(unreadShown)}`, { n: unreadShown })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Caption>
              ) : (
                <BoxIdentityLine account={account} />
              )}
            </YStack>
            <ChevronDownIcon size={18} color={theme.textFaint} />
          </XStack>
          {/* Hairline splitting the selector from search, inset 9px top/bottom (design). */}
          <YStack
            width={1}
            marginVertical={9}
            backgroundColor={theme.borderStrong}
          />
          <XStack
            width={56}
            alignItems="center"
            justifyContent="center"
            pressStyle={{ opacity: 0.6 }}
            onPress={onSearch}
            accessibilityRole="button"
            accessibilityLabel={t('search.title')}
            testID="openSearch"
          >
            <SearchIcon size={21} color={theme.textMuted} />
          </XStack>
        </XStack>
        {/* Přijaté | Odeslané - switch the box's folder (008). */}
        <YStack marginTop={10}>
          <SegmentedControl
            segments={[
              { key: 'received' as const, label: t('messages.segment.received') },
              { key: 'sent' as const, label: t('messages.segment.sent') },
            ]}
            value={folder}
            onChange={setFolder}
            testID="messagesFolder"
          />
        </YStack>
      </YStack>
      {/* Slim sync bar: a RESERVED 3px strip that only animates while syncing (no layout jump). */}
      <SyncProgressBar active={syncing} />

    </YStack>
  );

  // A tappable "drafts" entry - the only way (pre-008) to reach saved-but-unsent messages, which
  // otherwise live only inside Compose. Opens Compose, where the draft list is shown.
  const draftsEntry =
    draftCount > 0 ? (
      <YStack backgroundColor={theme.bg}>
        <XStack
          alignItems="center"
          gap={10}
          paddingHorizontal={16}
          paddingVertical={12}
          pressStyle={{ backgroundColor: theme.surfaceAlt }}
          onPress={onCompose}
          accessibilityRole="button"
          accessibilityLabel={t('messages.drafts', { n: draftCount })}
          testID="messagesDrafts"
        >
          <EditIcon size={18} color={theme.blue} />
          <Body flex={1} color={theme.blue} fontWeight="600">
            {t('messages.drafts', { n: draftCount })}
          </Body>
          <ChevronRightIcon size={20} color={theme.textFaint} />
        </XStack>
        <YStack height={1} backgroundColor={theme.border} />
      </YStack>
    ) : null;

  // Render against the LOADED folder (state.folder), not the live segment - so the rows + orientation
  // always match the data shown (the segment may have flipped while the new folder is still syncing).
  //
  // Rows also wait on the reminders read: `loaded` stays null until the chips are known, so the first
  // painted list is the final one (see the `reminders` state above).
  const loaded =
    state.status === 'loaded' && reminders != null && crossBox != null
      ? state
      : null;
  const shownFolder = loaded ? loaded.folder : folder;
  const stale = loaded ? loaded.stale : null;
  // Quantised to the minute, deliberately.
  //
  // A bare `Date.now()` is a new number on every single render, and it is passed to every visible
  // row - so no row could ever be memoised: the whole render window rebuilt its avatars, chips and
  // SVG glyphs whenever anything at all changed up here (a sync starting, a pull-to-refresh, the
  // folder segment). The finest granularity anything downstream actually shows is a minute
  // (`rowDate` renders "14:32"), so rounding to it costs nothing and makes the value stable.
  // It is still read fresh on every render, exactly as before - it just stops changing between them.
  const now = Math.floor(Date.now() / 60_000) * 60_000;
  // In the merged view a row says which box it came from; in a per-box inbox it never does, because
  // every row shares one box. `boxOf` returns undefined in that mode, which is what hides the pill.
  const accountsByBox = useMemo(() => {
    const m = new Map<string, DataBoxAccount>();
    for (const a of unified?.accounts ?? []) {
      m.set(a.boxId, a);
    }
    return m;
  }, [unified?.accounts]);
  const missingBoxes = (unified?.accounts ?? []).filter(
    a => a.syncError != null,
  );
  const boxOf = useCallback(
    (messageId: string): DataBoxAccount | undefined =>
      unified ? accountsByBox.get(boxByMessage.get(messageId) ?? '') : undefined,
    [unified, accountsByBox, boxByMessage],
  );
  // 001 T041. `now` is already what the deadline chips are computed from, so the strip crosses from
  // "in 1 day" to "today" on the same re-render they do.
  const pwd = passwordExpiry(account.passwordExpiresAt, now);
  // 001 FR-009: a password box refused after its stored expiry date. Read at the moment of the
  // refusal (`refusedAt`, above), the same one the strip's own copy uses (`storedReauthKey` below), so
  // its words and its portal action cannot disagree. A verdict already stored for the box wins over
  // that moment (`refusedForExpiredPassword`): the switcher row shows it and the re-auth screen reads
  // it, and a box refused before its date and still unrepaired read "change it on the portal" here
  // but "sign in again" on both of those once the date had passed.
  const passwordExpired = needsReauth && refusedForExpiredPassword(account, refusedAt);
  // The two strips are ACTIONABLE and must not read as the informational gold around them.
  const reauthTone = chipTone('dangerSoft', theme);
  const pwdTone = chipTone('info', theme);
  // The re-auth strip's "Přihlásit znovu" - one element for both of that strip's shapes (below).
  const reauthAction = (
    <XStack
      flexShrink={0}
      pressStyle={{ opacity: 0.6 }}
      onPress={() => onReauth(refusedAt)}
      accessibilityRole="button"
      accessibilityLabel={t('box.reauth.action')}
      // Derived from the Badge's own 16dp line box → 48. It read `hitSlop={8}` (a 32dp target)
      // until the critique caught it: this is one of only two ways out of "your box does not
      // work", and it was the smallest control on the screen.
      hitSlop={touchSlop({ height: 16 })}
      testID="reauth"
    >
      <Badge
        fontFamily={fonts.bodyXBold} // Public Sans 800 - a fontWeight prop can't switch the face
        fontWeight="800"
        color={reauthTone.fg}
      >
        {t('box.reauth.action')}
      </Badge>
    </XStack>
  );

  // Build the sections. RECEIVED: "Vyžaduje pozornost" on top, then the remainder date-grouped (Dnes /
  // Tento týden / …) like SENT. The row component is chosen by folder.
  //
  // Membership now comes from `attentionEntries` (010 US1) rather than being decided here. It carries
  // four feeds - a user reminder, an accepted scan estimate (cycle 2), a message already served by
  // fiction (013's feed, kept), and plain unread - already ordered by urgency. Keeping the rule in a
  // pure module is what makes it testable without a device; this file only maps ids back to rows.
  // Memoised for the same reason as `now`: a fresh Map each render is a fresh prop for every row.
  const termDates = useMemo(
    () => new Map((reminders ?? NO_REMINDERS).map(r => [r.messageId, r.date])),
    [reminders],
  );
  const sections: InboxSection[] = [];
  if (loaded && shownFolder === 'sent') {
    for (const s of groupByDate(loaded.messages, now)) {
      sections.push({ key: s.key, kind: 'date', label: s.label, data: s.data });
    }
  } else if (loaded) {
    const entries = attentionEntries(
      loaded.messages,
      reminders ?? NO_REMINDERS,
      now,
    );
    // Membership (FR-001) and presentation are two decisions. `attentionEntries` answers what
    // qualifies; this caps the plain-unread tail so the block cannot swallow the whole inbox on a
    // first sync. Everything dated or fiction-served is always kept, and the remainder falls to the
    // date sections below rather than disappearing.
    const { shown, summary } = summarizeAttention(entries);
    const byId = new Map(loaded.messages.map(m => [m.id, m]));
    const attention = shown
      .map(e => byId.get(e.messageId))
      .filter((m): m is MessageEnvelope => m != null);
    const inAttention = new Set(shown.map(e => e.messageId));
    const earlier = loaded.messages.filter(m => !inAttention.has(m.id));
    if (attention.length > 0) {
      sections.push({
        key: 'attention',
        kind: 'attention',
        data: attention,
        reasons: new Map(shown.map(e => [e.messageId, e])),
        summary,
      });
    }
    // 024: after THIS box's urgent mail and before its date sections. You opened this box; its own
    // deadlines lead, and news from a box you did not open follows. Never in the merged view, where
    // there is no "elsewhere" left to report.
    //
    // Asked of the sentence rather than of the box count, the same test `CrossBoxLine` makes before
    // drawing: a section whose line then renders nothing would still take the attention block's
    // closing footer away (`crossBoxFollowsAttention`), leaving it open-ended.
    if (!unified && crossBox && crossBoxSummary(crossBox, now) !== '') {
      sections.push({
        key: 'crossBox',
        kind: 'crossBox',
        data: [],
        boxes: crossBox,
      });
    }
    for (const s of groupByDate(earlier, now)) {
      sections.push({ key: s.key, kind: 'date', label: s.label, data: s.data });
    }
  }

  // Whether the "Jinde" line is the next thing after the attention block - it is always pushed
  // directly after it, so its presence is the whole test.
  const crossBoxFollowsAttention =
    sections.some(x => x.kind === 'attention') &&
    sections.some(x => x.kind === 'crossBox');

  // The scrollable body. The header, the two strips and the compose FAB are STATIC siblings of it
  // (design): they are pinned in every state - loading, load error, empty and populated alike.
  let content: ReactNode;
  if (state.status === 'loading' || (state.status === 'loaded' && loaded == null)) {
    // Skeleton list (the shape of what's coming) instead of a centred spinner - calmer + reserves
    // the layout so real rows don't jump in. Also covers "messages are in, reminders are not yet":
    // holding the skeleton for one local read beats painting rows and then growing them, and it must
    // NOT fall through to the empty state - there are messages, they are just not renderable yet.
    content = (
      <YStack flex={1} accessibilityLabel={t('messages.loading')}>
        {[0, 1, 2, 3, 4, 5].map(i => (
          <MessageRowSkeleton key={i} />
        ))}
      </YStack>
    );
  } else if (state.status === 'error') {
    // Load error - a TOP-anchored block (bare glyph, title, one-line reason, retry). Kept
    // pull-to-refreshable (like the boxes overview) so the list is never a dead-end requiring the
    // button - a swipe down retries the live load.
    content = (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: fabClearance }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onPullRefresh}
            tintColor={theme.blue}
            colors={[theme.blue]}
          />
        }
      >
        <YStack alignItems="center" paddingVertical={60} paddingHorizontal={36}>
          <HeroIcon glyph={CloudOffGlyph} />
          <Heading fontSize={18} textAlign="center" marginTop={16}>
            {t('messages.error.loadTitle')}
          </Heading>
          <Body
            fontFamily={fonts.bodyMedium} // Public Sans 500 - a fontWeight prop can't switch the face
            fontSize={14}
            fontWeight="500"
            lineHeight={20}
            maxWidth={240}
            color={theme.textMuted}
            textAlign="center"
            marginTop={6}
          >
            {/* The reason, not a guess at it. This said "Zkontrolujte připojení" for EVERY failure
                - a server fault, a timeout, an expired session - which is the same false-offline
                claim the stale banner was fixed to stop making (see the `stale` field). The state
                already carries which one it was. */}
            {t(
              state.status === 'error' &&
                state.messageKey !== 'messages.error.load'
                ? state.messageKey
                : 'messages.error.loadSub',
            )}
          </Body>
          <Button
            marginTop={18}
            height={46}
            borderRadius={13}
            paddingHorizontal={22}
            backgroundColor={theme.surface}
            borderWidth={1}
            borderColor={theme.borderStrong}
            color={theme.text}
            fontSize={14}
            fontWeight="700"
            onPress={onPullRefresh}
            testID="retry"
          >
            {t('messages.retry')}
          </Button>
        </YStack>
      </ScrollView>
    );
  } else {
    // 'loaded' - and 'reauth', whose message + action now live in the pinned strip above, so the list
    // (whatever is cached - nothing, for a box that never synced) simply stays behind it.
    const emptyState =
      shownFolder === 'sent' ? (
        <EmptyState
          icon={<HeroIcon glyph={SendGlyph} />}
          title={t('messages.sent.empty')}
          subtitle={t('messages.sent.empty.hint')}
          marginTop={60}
        />
      ) : (
        <EmptyState
          icon={<HeroIcon glyph={MailGlyph} />}
          title={t('messages.empty')}
          subtitle={t('messages.empty.hint')}
          marginTop={60}
        />
      );
    // Not "empty" - unavailable. The distinction matters: the app has not been able to look.
    const reauthEmptyState = (
      <EmptyState
        icon={<HeroIcon glyph={CloudOffGlyph} />}
        title={t('messages.reauth.empty')}
        subtitle={t('messages.reauth.empty.hint')}
        marginTop={60}
      />
    );
    content = (
      <SectionList<MessageEnvelope, InboxSection>
        sections={sections}
        keyExtractor={m => m.id}
        style={{ flex: 1 }}
        // Clear the compose FAB so it never sits over the last row.
        contentContainerStyle={{ paddingBottom: fabClearance }}
        // The design's list is a plain scroll column - headers travel with their content, nothing pins.
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => {
          if (section.kind === 'crossBox') {
            // A section with no rows: the header IS the line.
            return (
              <CrossBoxLine
                boxes={section.boxes}
                now={now}
                onPress={onOpenSwitcher}
              />
            );
          }
          if (section.kind === 'attention') {
            // Design's signature header: an OVERSIZED gold Bricolage numeral beside the title + a
            // one-line reason. It OPENS the shared `card` attention block - the hairline here is the
            // block's top edge, each row carries its own, and the footer closes it (see below).
            return (
              <YStack
                backgroundColor={theme.surface}
                borderTopWidth={1}
                borderColor={theme.border}
              >
                <XStack
                  paddingTop={18}
                  paddingHorizontal={18}
                  paddingBottom={12}
                  alignItems="center"
                  gap={12}
                >
                  <Display
                    fontSize={44}
                    // The design draws this numeral on a 36pt line, tighter than the glyph. Android
                    // paints past a line box; iOS clips to it, and cut off the top of the "2" (iPhone,
                    // 2026-09-24). The role draws it on a line its ink fits and takes the extra back
                    // with margins (Typography.tsx), so the row keeps the design's 36pt on both.
                    lineHeight={36}
                    letterSpacing={-2}
                    // `goldInk`, not `gold`: this numeral is the COUNT, stated in no other text on
                    // the screen, and plain gold reads 2.17:1 on `surface` - under even the 3:1 that
                    // large text is held to. Unchanged in dark mode, where the two are the same value.
                    color={theme.goldInk}
                  >
                    {String(section.data.length)}
                  </Display>
                  <YStack flex={1} minWidth={0}>
                    <Title
                      fontSize={17}
                      lineHeight={19}
                      letterSpacing={-0.3}
                      color={theme.text}
                      accessibilityRole="header"
                    >
                      {t('messages.attention')}
                    </Title>
                    <Caption
                      fontSize={12}
                      dense
                      fontWeight="600"
                      color={theme.textFaint}
                      marginTop={3}
                      numberOfLines={2}
                    >
                      {attentionSubtitle(section.summary)}
                    </Caption>
                  </YStack>
                </XStack>
              </YStack>
            );
          }
          return (
            <YStack
              backgroundColor={theme.bg}
              paddingTop={18}
              paddingHorizontal={18}
              paddingBottom={8}
            >
              {/* Dnes / Tento týden / a month - a screen reader can jump between them (001 T042). */}
              <Heading
                accessibilityRole="header"
                color={theme.text}
                fontSize={15}
                dense
                letterSpacing={0}
              >
                {sectionTitle(section.label)}
              </Heading>
            </YStack>
          );
        }}
        renderSectionFooter={({ section }) =>
          // Closes the attention block: its bottom hairline, then the 10px gap the design leaves
          // before the first date header.
          //
          // …unless the "Jinde" line comes next, in which case there is nothing to leave a gap
          // BEFORE: the line carries its own top hairline, so this footer would add a second one
          // with 11px of paper between them, and the line would float away from the block instead of
          // closing it. Reported exactly that way. The gap exists to separate the block from a date
          // HEADER, which draws no top edge of its own; the line does, so it needs no help.
          section.kind === 'attention' && !crossBoxFollowsAttention ? (
            <YStack
              height={11}
              backgroundColor={theme.bg}
              borderTopWidth={1}
              borderColor={theme.border}
              testID="attentionEnd"
            />
          ) : null
        }
        // Not `ListHeaderComponent` any more - see where it is rendered as a static sibling. Kept
        // out of the list so it survives the states where the list does not exist.
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onPullRefresh}
            tintColor={theme.blue}
            colors={[theme.blue]}
          />
        }
        // On reauth there are no messages *yet* (nothing cached) - the strip above says why, so don't
        // also claim the box is empty.
        // Closes the list and says how fresh it is - see `ListEnd`. Only when there is something to
        // close: an empty folder ends with its own empty state, which needs no footer.
        ListFooterComponent={
          sections.length > 0 ? (
            <ListEnd
              syncedAt={loaded ? loaded.syncedAt : null}
              syncing={syncing}
              now={now}
            />
          ) : null
        }
        ListEmptyComponent={
          // A box whose session expired and has nothing cached used to render NOTHING here - the
          // strip above, then a full-viewport void. The comment said "the strip already explains
          // it", and it does explain the CAUSE, but a blank screen is not a designed state and does
          // not say what the user is looking at (2026-09-09 critique). It gets its own empty state,
          // saying the list is unavailable until they sign in - never "this box is empty", which
          // would be a claim the app cannot make while it has not been able to look.
          state.status === 'reauth' ? reauthEmptyState : emptyState
        }
        renderItem={({ item, section }) => {
          if (section.kind === 'attention') {
            return (
              <AttentionCard
                message={item}
                entry={section.reasons.get(item.id) ?? null}
                now={now}
                onOpen={openMessage}
                folder={shownFolder}
                onExplain={onOpenFaq}
                boxAccount={boxOf(item.id)}
              />
            );
          }
          if (shownFolder === 'sent') {
            return (
              <SentRow
                message={item}
                now={now}
                onOpen={openMessage}
                folder={shownFolder}
                onExplain={onOpenFaq}
                boxAccount={boxOf(item.id)}
              />
            );
          }
          return (
            <ReceivedRow
              message={item}
              now={now}
              termDate={termDates.get(item.id) ?? null}
              onOpen={openMessage}
              folder={shownFolder}
              boxAccount={boxOf(item.id)}
            />
          );
        }}
      />
    );
  }

  return (
    <YStack flex={1} backgroundColor={theme.bg}>
      {header}
      {/* Session expired - an inline gold strip pinned under the header, with the (cached) list still
          readable behind it. Tapping the action re-authenticates this box. */}
      {!unified && needsReauth ? (
        <XStack
          // `flex-start`, not `center`: at a large text size the message wraps to three lines, and a
          // centred action lands in the MIDDLE of it - the strip then reads "Platnost / hesla končí
          // 11. Změnit v portálu / 9.", with the date split either side of the button. Aligned to the
          // first line, the message stays one block and the action sits beside it.
          alignItems="flex-start"
          gap={10}
          paddingHorizontal={16}
          paddingVertical={9}
          // NOT gold. Gold on this screen already means unread, the compose action, the attention
          // count, a fiction pill and the test environment; a sixth meaning made the two strips that
          // are ACTIONABLE look exactly like the four that are merely informational, so nothing on
          // screen said which of the amber was a button (2026-09-09 critique). This one is the more
          // severe of the two - the box cannot be used at all until it is answered - so it takes the
          // soft red; the password strip below takes blue, the colour this design system already
          // reserves for "this does something".
          backgroundColor={reauthTone.bg}
          borderBottomWidth={1}
          borderColor={reauthTone.accent}
        >
          <AlertIcon size={17} color={reauthTone.fg} />
          {/* 001 FR-009: an EXPIRED password takes two steps, in order - change it on the portal,
              then sign in with the new one - so that strip carries both actions, UNDER the message:
              two beside it would squeeze the sentence to a word per line. Every other refusal keeps
              the one-action shape, with the action beside the message. */}
          <YStack flex={1} gap={8}>
            <Badge color={reauthTone.fg}>
              {t(
                storedReauthKey(
                  account,
                  'box.reauth.session',
                  'box.reauth.credentials',
                  refusedAt,
                ),
              )}
            </Badge>
            {passwordExpired ? (
              <XStack gap={18} flexWrap="wrap">
                <XStack
                  pressStyle={{ opacity: 0.6 }}
                  onPress={() => openPortal(account.host)}
                  accessibilityRole="link"
                  accessibilityLabel={t('pwd.action')}
                  hitSlop={touchSlop({ height: 16 })}
                  testID="reauthPortal"
                >
                  <Badge
                    fontFamily={fonts.bodyXBold}
                    fontWeight="800"
                    color={reauthTone.fg}
                  >
                    {t('pwd.action')}
                  </Badge>
                </XStack>
                {reauthAction}
              </XStack>
            ) : null}
          </YStack>
          {passwordExpired ? null : reauthAction}
        </XStack>
      ) : null}
      {/* The box's PASSWORD is running out - a different thing from the session above, and a quieter
          one: the box still works today. Shown only when re-auth is NOT being asked for, because a
          box you cannot use has one problem, not two, and stacking strips buries the actionable one.
          The app cannot change an ISDS password, so the action hands off to the portal rather than
          promising something it cannot do (Principle VI). */}
      {!unified && !needsReauth && pwd.kind !== 'none' ? (
        <XStack
          // See the reauth strip above - the same shape, and it had the same defect.
          alignItems="flex-start"
          gap={10}
          paddingHorizontal={16}
          paddingVertical={9}
          // Blue, not gold - see the reauth strip above. Quieter than that one on purpose: the box
          // still works today, so this is a thing to do soon rather than a thing blocking you.
          backgroundColor={pwdTone.bg}
          borderBottomWidth={1}
          borderColor={pwdTone.border ?? pwdTone.accent}
          testID="passwordExpiry"
        >
          <AlertIcon size={17} color={pwdTone.fg} />
          <Badge flex={1} color={pwdTone.fg}>
            {pwd.kind === 'expired'
              ? t('pwd.expired')
              : pwd.kind === 'today'
              ? t('pwd.today')
              : t('pwd.soon', { d: formatTermDate(pwd.date) })}
          </Badge>
          <XStack
            flexShrink={0}
            pressStyle={{ opacity: 0.6 }}
            onPress={() => openPortal(account.host)}
            accessibilityRole="link"
            accessibilityLabel={t('pwd.action')}
            hitSlop={touchSlop({ height: 16 })}
            testID="passwordExpiryAction"
          >
            <Badge
              fontFamily={fonts.bodyXBold}
              fontWeight="800"
              color={pwdTone.fg}
            >
              {t('pwd.action')}
            </Badge>
          </XStack>
        </XStack>
      ) : null}
      {/* MERGED: a list that quietly omits a box it could not reach is lying by arrangement rather
          than by statement. Same shape as the per-box re-auth strip above, including the
          first-line alignment, and the same action when exactly one box is fixable. */}
      {unified && missingBoxes.length > 0 ? (
        <XStack
          alignItems="flex-start"
          gap={10}
          paddingHorizontal={16}
          paddingVertical={9}
          backgroundColor={reauthTone.bg}
          borderBottomWidth={1}
          borderColor={reauthTone.border ?? reauthTone.accent}
          testID="unifiedMissing"
        >
          <AlertIcon size={17} color={reauthTone.fg} />
          <Badge flex={1} color={reauthTone.fg}>
            {t(`unified.missing.${plural(missingBoxes.length)}`, {
              n: missingBoxes.length,
            })}
          </Badge>
          <XStack
            flexShrink={0}
            pressStyle={{ opacity: 0.6 }}
            onPress={() => {
              const fixable = missingBoxes.filter(a => needsSignIn(a.syncError));
              // One box: fix it. Several: the switcher, where each broken one is already marked,
              // because "sign in" would otherwise be vague about which.
              if (fixable.length === 1) {
                unified.onReauthBox(fixable[0].boxId);
              } else {
                onOpenSwitcher();
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={t('box.reauth.action')}
            hitSlop={touchSlop({ height: 16 })}
            testID="unifiedMissingAction"
          >
            <Badge
              fontFamily={fonts.bodyXBold}
              fontWeight="800"
              color={reauthTone.fg}
            >
              {t('box.reauth.action')}
            </Badge>
          </XStack>
        </XStack>
      ) : null}
      {/* Stale-content notice - pinned under the header (it must not scroll away with the content it
          labels). Two wordings, because "offline" is a statement of fact the app is often in no
          position to make: it is used only for a genuine network failure, and every other failed sync
          says what it can honestly say - these rows could not be refreshed. */}
      {stale ? (
        <XStack
          alignItems="center"
          justifyContent="center"
          gap={8}
          paddingHorizontal={16}
          paddingVertical={7}
          backgroundColor={theme.surfaceSunken}
          borderBottomWidth={1}
          borderColor={theme.border}
        >
          {stale === 'offline' ? (
            <WifiOffIcon size={16} color={theme.textFaint} />
          ) : (
            <AlertIcon size={16} color={theme.textFaint} />
          )}
          <Label fontSize={12} color={theme.textMuted}>
            {t(stale === 'offline' ? 'messages.offline' : 'messages.stale')}
          </Label>
        </XStack>
      ) : null}
      {/* Drafts sit ABOVE the body rather than inside the list.
          As the list's `ListHeaderComponent` they vanished in `loading` and `error`, because the
          SectionList is not rendered in either - so a user holding unsent drafts lost their only
          route to them exactly when the network was failing (2026-09-09 critique). */}
      {draftsEntry}
      {/* 023 option C: the other boxes, above the list rather than inside it - it is not a message
          and must not scroll away among them. Renders nothing when every other box is quiet, so a
          single-box user never sees it at all. */}
      {content}
      {/* No compose in the merged view. Every act in this app belongs to a legal identity, and a
          screen that has stopped naming one would have to ask which box on every send. You compose
          from a box, which is where you already know who you are. */}
      {unified ? null : (
      <Fab
        icon={<EditIcon size={21} color={theme.onGold} />}
        label={t('messages.compose')}
        labelColor={theme.onGold}
        tone={theme.gold}
        // Gold on the paper is 1.91:1, so the button's own edge is the thing 1.4.11 cannot find. The
        // shadow is atmosphere, not a boundary. (Draws nothing in dark mode.)
        toneBorder={theme.goldInk}
        onPress={onCompose}
        accessibilityLabel={t('send.title')}
        testID="compose"
      />
      )}
    </YStack>
  );
}

/** Loading placeholder mirroring the simple received row (avatar + name/date + subject). */
function MessageRowSkeleton() {
  return (
    <XStack
      paddingHorizontal={18}
      paddingVertical={13}
      gap={12}
      alignItems="flex-start"
    >
      <Skeleton width={38} height={38} radius={12} />
      <YStack flex={1} gap={8} paddingTop={3}>
        <XStack alignItems="center" justifyContent="space-between">
          <Skeleton width={150} height={13} radius={6} />
          <Skeleton width={54} height={11} radius={6} />
        </XStack>
        <Skeleton width="72%" height={13} radius={6} />
      </YStack>
    </XStack>
  );
}

/**
 * "Vyžaduje pozornost" row - a FLAT, full-bleed row inside the shared attention block (the block's
 * `card` surface + hairlines come from the section header/footer): a 40px avatar column, then the
 * quiet sender + date, the loud Bricolage subject, and the fiction notice.
 *
 * The notice carries a PILL now, not a bare icon+label: it states a fact that already happened
 * ("Doručeno fikcí 20. 6. · lhůta už běží") rather than a countdown, and the design gives it the same
 * gold `statusFiction` tone the sent side uses - so the same event looks the same from either side.
 *
 * The pill follows the REASON the row is in the group (010 US2), which is why `entry` is a prop rather
 * than something this card re-derives. Since 010 the group also holds user deadlines and plain unread
 * messages; rendering the fiction pill on those would tell someone their message had been served by
 * law when it had not - a false legal claim on the strength of a layout convenience (Principle VI).
 * A row with nothing to say (`unread`) shows no pill at all - EXCEPT in the merged view, where every
 * row owes the reader its box regardless of why it is in the group.
 */
const AttentionCard = memo(function AttentionCardView({
  message,
  entry,
  now,
  onOpen,
  folder,
  onExplain,
  boxAccount,
}: {
  readonly message: MessageEnvelope;
  /** Why this row qualified. Null is treated as "say nothing", never as fiction. */
  readonly entry: AttentionEntry | null;
  readonly now: number;
  readonly onOpen: (messageId: string, folder: MessageFolder) => void;
  readonly folder: MessageFolder;
  /** Set only in the merged view - see `ReceivedRow`. */
  readonly boxAccount?: DataBoxAccount;
  /** Opens the FAQ answer for a term this row uses. */
  readonly onExplain: (focus: FaqId) => void;
}) {
  const onPress = useCallback(
    () => onOpen(message.id, folder),
    [onOpen, message.id, folder],
  );
  const theme = useTheme();
  const tone = chipTone('statusFiction', theme);
  // Read from the MESSAGE, not from `entry.reason`. A message can be both served by fiction and
  // carry a deadline, and the reason is only which of the two put it in the group - suppressing the
  // pill because the deadline ranked higher would hide the fact that a legal clock is running.
  const servedAt = servedByFiction(message);
  const termDate =
    entry != null && (entry.reason === 'reminder' || entry.reason === 'estimate')
      ? entry.date
      : null;
  const sender = message.sender || '—';
  // The fiction pill's two halves, kept as parts: the chip joins them with the design's middle dot,
  // the label with the sentence rule that knows "3. 6." has already closed itself. One source, so the
  // row cannot say less than the pill shows.
  const fictionParts =
    servedAt != null
      ? [
          `${t('status.byFiction')} ${rowDate(servedAt, now)}`,
          t('status.fikce.running'),
        ]
      : null;
  return (
    <XStack
      backgroundColor={theme.surface}
      borderTopWidth={1}
      borderColor={theme.border}
      paddingVertical={14}
      paddingHorizontal={18}
      gap={12}
      alignItems="flex-start"
      pressStyle={{ backgroundColor: theme.surfaceAlt }}
      onPress={onPress}
      accessibilityRole="button"
      // This is the row the whole attention group exists for - a legal clock and a deadline, drawn as
      // two pills. Announced fragment by fragment it was the least legible row in the app.
      accessibilityLabel={attentionRowLabel({
        sender,
        subject: message.subject || t('messages.noSubject'),
        date: rowDate(message.deliveryTime, now),
        unread: isUnread(message.state),
        fiction: fictionParts,
        term: termDate != null ? termChipLabel(termDate, now) : null,
      })}
      testID={`message-${message.id}`}
    >
      <Avatar name={sender} size={40} />
      <YStack flex={1} minWidth={0}>
        <XStack alignItems="center" gap={7}>
          {/* The attention row carries the same unread dot as an ordinary received row - a message
              served by fiction is very much still unread, and hiding that here read as "handled". */}
          {isUnread(message.state) ? (
            // Same ring as the received row's dot - see there.
            <YStack
              width={7}
              height={7}
              flexShrink={0}
              borderRadius={999}
              backgroundColor={theme.gold}
              borderWidth={1}
              borderColor={theme.goldInk}
            />
          ) : null}
          <Label flex={1} minWidth={0} numberOfLines={1}>
            {sender}
          </Label>
          <Label flexShrink={0} fontSize={12} color={theme.textFaint}>
            {rowDate(message.deliveryTime, now)}
          </Label>
        </XStack>
        <Heading
          fontFamily={fonts.displaySemiBold} // Bricolage 600 - the Bold face would render 700
          fontSize={15}
          fontWeight="600"
          lineHeight={20}
          letterSpacing={-0.1}
          color={theme.text}
          marginTop={2}
          numberOfLines={2}
        >
          {message.subject || t('messages.noSubject')}
        </Heading>
        {/* Both chips can be present. They WRAP rather than truncate - a legal status abbreviated to
            fit beside a deadline would be the same kind of half-truth as not showing it. */}
        {servedAt != null || termDate != null || boxAccount ? (
          <XStack marginTop={8} flexWrap="wrap" gap={6}>
            {servedAt != null ? (
              // Tappable, because this pill is the app saying a legal clock is running using a term
              // - "fikce", "lhůta" - that its own audience of ordinary citizens and sole traders has
              // no reason to know. The answer already exists in `content/faq.ts`; this is the route
              // to it (2026-09-09 critique). Its own press target, so it does not steal the row's.
              <XStack
                alignItems="center"
                gap={6}
                backgroundColor={tone.bg}
                borderRadius={9}
                paddingVertical={5}
                paddingLeft={8}
                paddingRight={10}
                // The wrapping the comment above promises only worked BETWEEN the chips. A single
                // chip wider than the row still ran off the edge, because nothing inside it could
                // give: the sentence is longer in English ("the deadline is already running" against
                // "lhůta už běží") and it pushed its own help mark off screen, so the row lost the
                // one affordance that explains the word "fiction" to the people who need it.
                flexShrink={1}
                maxWidth="100%"
                hitSlop={touchSlop({ height: 26 })}
                pressStyle={{ opacity: 0.65 }}
                onPress={() => onExplain('fiction')}
                accessibilityRole="button"
                accessibilityLabel={`${fictionParts?.join(' · ')}, ${t(
                  'faq.explain',
                )}`}
                testID="explainFiction"
              >
                <StatusAcceptedIcon
                  size={14}
                  color={tone.fg}
                  knockout={tone.bg}
                />
                {/* Shrinks and wraps to a second line; the two icons do not (RN defaults them to
                    `flexShrink: 0`), so the legal status can grow without costing the help mark. */}
                <Badge flexShrink={1} fontSize={12} color={tone.fg}>
                  {fictionParts?.join(' · ')}
                </Badge>
                <HelpIcon size={13} color={tone.fg} />
              </XStack>
            ) : null}
            {termDate != null ? <TermChip date={termDate} now={now} /> : null}
            {boxAccount ? <BoxPill account={boxAccount} /> : null}
          </XStack>
        ) : null}
      </YStack>
    </XStack>
  );
});

/** A flat received row (the "Dříve" remainder): avatar + optional unread dot + sender + date + subject. */
/**
 * The user's own deadline chip (010 US2). Blue, because it is the only thing on a row the USER put
 * there - every other chip in the app reports something ISDS said.
 *
 * One component for both places it appears (the flat received row and the attention card), so the two
 * cannot drift apart in radius, height or wording - the metrics come from the scale, not from each
 * screen's taste (Principle V).
 */
function TermChip({ date, now }: { readonly date: number; readonly now: number }) {
  const theme = useTheme();
  const blue = chipTone('userBlue', theme);
  // The wording lives in `rowLabel.ts` because the row's spoken label has to say the same thing this
  // chip shows, and two copies of "za 3 dny" is exactly the pair that drifts.
  const label = termChipLabel(date, now);
  return (
    <XStack
      minHeight={22}
      paddingHorizontal={9}
      borderRadius={8}
      alignItems="center"
      backgroundColor={blue.bg}
    >
      <Badge fontSize={11} letterSpacing={0.2} color={blue.fg}>
        {label}
      </Badge>
    </XStack>
  );
}

const ReceivedRow = memo(function ReceivedRowView({
  message,
  now,
  termDate,
  onOpen,
  folder,
  boxAccount,
}: {
  readonly message: MessageEnvelope;
  readonly now: number;
  /** The user's reminder date on this message, or null. */
  readonly termDate: number | null;
  readonly onOpen: (messageId: string, folder: MessageFolder) => void;
  readonly folder: MessageFolder;
  /**
   * Set ONLY in the merged view, where a row has to say which box it belongs to.
   *
   * Undefined in a per-box inbox, where every row shares one box and repeating it on all of them
   * would be noise. This single prop is the entire difference between the two views.
   */
  readonly boxAccount?: DataBoxAccount;
}) {
  const onPress = useCallback(
    () => onOpen(message.id, folder),
    [onOpen, message.id, folder],
  );
  const theme = useTheme();
  const sender = message.sender || '—';
  const unread = isUnread(message.state);
  return (
    <XStack
      paddingHorizontal={18}
      paddingVertical={13}
      gap={12}
      alignItems="flex-start"
      borderTopWidth={1}
      borderTopColor={theme.border}
      pressStyle={{ backgroundColor: theme.surfaceAlt }}
      onPress={onPress}
      accessibilityRole="button"
      // One stop, one sentence - without it the row is read out as four unrelated fragments and the
      // gold unread dot, which carries meaning no announcement had, is silent.
      accessibilityLabel={receivedRowLabel({
        sender,
        subject: message.subject || t('messages.noSubject'),
        date: rowDate(message.deliveryTime, now),
        unread,
        term: termDate != null ? termChipLabel(termDate, now) : null,
      })}
      testID={`message-${message.id}`}
    >
      <Avatar name={sender} size={38} />
      <YStack flex={1} gap={2}>
        <XStack alignItems="center" gap={7}>
          {unread ? (
            // The design's gold dot, kept - plus the ring that makes it visible. Gold is 2.17:1 on
            // `surface`, and this dot is the ONLY unread cue a sighted user gets (the row's a11y
            // label carries it for everyone else), so 1.4.11's 3:1 has nothing else to lean on.
            // In dark mode `goldInk` IS `gold`, so the ring draws nothing there.
            <YStack
              width={7}
              height={7}
              borderRadius={999}
              backgroundColor={theme.gold}
              borderWidth={1}
              borderColor={theme.goldInk}
            />
          ) : null}
          {/* Sender is the PRIMARY line - always bold + dark (heavier than the subject below), per the
              design. Read/unread is signalled by the gold dot alone, not by thinning the sender.
              `dense`: the design sets no line-height on these, so they take the font's metric leading. */}
          <BodyStrong
            flex={1}
            // Without a zero floor a flex child refuses to shrink below its content, so at a large
            // text size the sender ran into the date and its own ellipsis was clipped mid-glyph.
            minWidth={0}
            fontSize={14}
            dense
            color={theme.text}
            numberOfLines={1}
          >
            {sender}
          </BodyStrong>
          <Label
            flexShrink={0}
            color={theme.textFaint}
            fontSize={12}
            dense
            numberOfLines={1}
          >
            {rowDate(message.deliveryTime, now)}
          </Label>
        </XStack>
        <Caption
          color={theme.textMuted}
          fontSize={14}
          lineHeight={18}
          numberOfLines={1}
        >
          {message.subject || t('messages.noSubject')}
        </Caption>
        {/* No reserved slot: the list waits for the reminders read, so a row is painted at its final
            height once and never grows under the ones below it (Principle V - see `reminders`). */}
        {termDate != null || boxAccount ? (
          <XStack marginTop={5} alignItems="center" gap={6} flexWrap="wrap">
            {termDate != null ? <TermChip date={termDate} now={now} /> : null}
            {boxAccount ? <BoxPill account={boxAccount} /> : null}
          </XStack>
        ) : null}
      </YStack>
    </XStack>
  );
});

/**
 * A flat sent row: avatar + you→recipient (arrow + name) + date + subject + the delivery-state glyph,
 * plus - only when there is something a glance would not have assumed - one extra line.
 *
 * The design's rule for that extra line, in order of precedence:
 *   * a CHIP for `fiction` or `stop`: served without anyone reading it, or never delivered at all.
 *     Ordinary progress (odesláno → dodáno → doručeno) stays carried by the glyph alone, so the
 *     common row keeps its two-line height.
 *   * a COUNTDOWN while the recipient has not signed for it yet (state 4) - the one place in the app
 *     where a fiction clock is still running.
 *   * ANNOTATIONS (content erased at ISDS, kept in the Datový trezor) - a footnote on a journey that
 *     already finished, so it is quiet: faint, small, no pill.
 */
const SentRow = memo(function SentRowView({
  message,
  now,
  onOpen,
  folder,
  onExplain,
  boxAccount,
}: {
  readonly message: MessageEnvelope;
  readonly now: number;
  readonly onOpen: (messageId: string, folder: MessageFolder) => void;
  readonly folder: MessageFolder;
  /** Set only in the merged view - see `ReceivedRow`. */
  readonly boxAccount?: DataBoxAccount;
  /** Opens the FAQ answer carrying the delivery-state legend. */
  readonly onExplain: (focus: FaqId) => void;
}) {
  const onPress = useCallback(
    () => onOpen(message.id, folder),
    [onOpen, message.id, folder],
  );
  const theme = useTheme();
  const recipient = message.recipient || '—';
  const status = messageStatus(message.state);
  const tone = chipTone(status.tone, theme);
  const countdown = sentFictionCountdown(message, now);
  // Escalates as the fiction date approaches (red ≤3 days, amber ≤7, gold beyond). Every countdown
  // used to render the same gold whatever the distance.
  const fictionTone = chipTone(
    countdown
      ? fictionCountdownTone(countdown.daysRemaining)
      : 'statusFiction',
    theme,
  );
  // The row's extra line, whichever one it draws - the state chip repeats `status`, so only the
  // countdown adds anything the label does not already say.
  const annotation = status.annotation
    ? t(
        status.annotation === 'erased'
          ? 'status.note.erased'
          : 'status.note.vault',
      )
    : null;
  return (
    <XStack
      paddingHorizontal={18}
      paddingVertical={13}
      gap={12}
      alignItems="flex-start"
      borderTopWidth={1}
      borderTopColor={theme.border}
      pressStyle={{ backgroundColor: theme.surfaceAlt }}
      onPress={onPress}
      accessibilityRole="button"
      // The delivery state is a GLYPH on this row - the word for it survives only here.
      accessibilityLabel={sentRowLabel({
        recipient,
        subject: message.subject || t('messages.noSubject'),
        date: rowDate(message.deliveryTime, now),
        status: t(status.labelKey),
        notes: [
          !showsListChip(message.state) && countdown
            ? sentCountdownLabel(countdown.daysRemaining)
            : null,
          annotation,
        ],
      })}
      testID={`message-${message.id}`}
    >
      <Avatar name={recipient} size={38} />
      <YStack flex={1} gap={2}>
        <XStack alignItems="center" gap={7}>
          <ArrowRightIcon size={13} color={theme.textFaint} />
          {/* The twin of the received row's sender - same floor, same reason. */}
          <BodyStrong
            flex={1}
            minWidth={0}
            fontSize={14}
            dense
            color={theme.text}
            numberOfLines={1}
          >
            {recipient}
          </BodyStrong>
          <Label
            flexShrink={0}
            color={theme.textFaint}
            fontSize={12}
            dense
            numberOfLines={1}
          >
            {rowDate(message.deliveryTime, now)}
          </Label>
          {/* The delivery state rides at the END of the primary line as a glyph - it does NOT get a
              line of its own, so a sent row is the same two lines (and the same height) as a received
              one. The wording survives only as the icon's accessibility label. */}
          <DeliveryStateIcon
            kind={status.kind}
            color={tone.fg}
            label={t(status.labelKey)}
            // The `stop` disc knocks its slash out against the LIST paper, not a card.
            knockout={theme.bg}
          />
        </XStack>
        <Caption
          color={theme.textMuted}
          fontSize={14}
          lineHeight={18}
          numberOfLines={1}
        >
          {message.subject || t('messages.noSubject')}
        </Caption>
        {/* One meta row: the box (merged view only), then whichever of the two status forms this
            message has. Previously two mutually exclusive branches; the box has to appear beside
            either of them, so the row is now the constant and its contents vary. */}
        {showsListChip(message.state) || countdown || boxAccount ? (
          <XStack marginTop={7} alignItems="center" gap={6} flexWrap="wrap">
            {boxAccount ? <BoxPill account={boxAccount} /> : null}
            {countdown && !showsListChip(message.state) ? (
              <XStack alignItems="center" gap={6}>
                <TimerIcon size={13} color={fictionTone.fg} />
                <Badge fontSize={12} color={fictionTone.fg} numberOfLines={1}>
                  {sentCountdownLabel(countdown.daysRemaining)}
                </Badge>
              </XStack>
            ) : null}
            {showsListChip(message.state) ? (
            <>
            {/* Tappable for the same reason the fiction pill is: "Dodáno" and "Doručeno" are a legal
                distinction the app states and never explains, and the five-glyph delivery vocabulary
                has its legend in the FAQ. `FAQ_LEGEND_ID` is the answer that renders the marks. */}
            <XStack
              minHeight={22}
              alignItems="center"
              gap={5}
              paddingLeft={9}
              paddingRight={7}
              borderRadius={8}
              backgroundColor={tone.bg}
              hitSlop={touchSlop({ height: 22 })}
              pressStyle={{ opacity: 0.65 }}
              onPress={() => onExplain(FAQ_LEGEND_ID)}
              accessibilityRole="button"
              accessibilityLabel={`${t(status.labelKey)}, ${t('faq.explain')}`}
              testID="explainDeliveryState"
            >
              <Badge fontSize={11} letterSpacing={0.2} color={tone.fg}>
                {t(status.labelKey)}
              </Badge>
              <HelpIcon size={12} color={tone.fg} />
            </XStack>
            </>
            ) : null}
          </XStack>
        ) : null}
        {annotation ? (
          <XStack alignItems="center" gap={5} marginTop={6}>
            {status.annotation === 'erased' ? (
              <ContentErasedIcon size={13} color={theme.textFaint} />
            ) : (
              <VaultIcon size={13} color={theme.textFaint} />
            )}
            <Badge fontSize={11} color={theme.textFaint} numberOfLines={1}>
              {annotation}
            </Badge>
          </XStack>
        ) : null}
      </YStack>
    </XStack>
  );
});
