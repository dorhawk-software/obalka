// App shell (feature 001): the top-level router between the add-box/login flow and the signed-in
// home (BoxList). It owns the account list and the in-memory active-box selection, refreshing from
// the AccountsController. A real navigator (react-navigation) and persisted active box land with the
// message-list feature; this keeps the login → home milestone working with minimal surface.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';
import {
  reportFailure,
  setRedactionIdentifiers,
} from '../services/telemetry/telemetry';
import { setDebugRedactionIdentifiers } from '../services/debug/debugLog';
import {
  countInFlight,
  crossBoxAttention,
  NOTHING_IN_FLIGHT,
  type BoxAttention,
  type InFlight,
} from '../features/messages/state/crossBox';
import { YStack } from '../theme/ui';
import { useTheme } from '../theme/ThemeProvider';
import { LaunchScreen } from './LaunchScreen';
import { LoginFlow } from '../features/accounts/screens/LoginFlow';
import { Welcome } from '../features/accounts/screens/Welcome';
import { useSettings } from './settings/SettingsProvider';
import { FaqScreen } from './settings/FaqScreen';
import { DEMO_DATA } from '../dev/demoData';
import type { FaqId } from '../content/faq';
import { TelemetryConsent } from './settings/TelemetryConsent';
import { AppNavigator } from './AppNavigator';
import { navigate, resetToInbox } from './navigationRef';
import {
  consumeInitialNotification,
  registerForegroundNotificationHandler,
  setDeepLinkResolver,
} from './notifications/deepLinkRouter';
import {
  resolveDeepLink,
  type NotificationPayload,
} from './notifications/deepLink';
import { EdgeSwipeBack } from './EdgeSwipeBack';
import { useAppCovered } from './lock/LockGate';
import { t } from '../i18n/strings';
import {
  accountsController,
  appLock,
  backupController,
  boxWork,
  remindersController,
  removalQueue,
  scanController,
  createLoginDeps,
  messagesController,
  settingsStore,
  transferController,
} from '../features/accounts/deps';
import { BackupScreen } from './settings/BackupScreen';
import { TransferScreen } from './settings/TransferScreen';
import { SnackbarProvider } from './Snackbar';
import type { DataBoxAccount, SyncFailure } from '../services/isds/types';
import {
  boxesToFetch,
  refreshBoxes,
  type RefreshAllDeps,
} from './refreshAll';
import {
  removalFailureReport,
  removeBox,
  resumeRemoval,
  settleRemoval,
  type RemoveBoxDeps,
  type RemoveBoxResult,
} from '../features/accounts/state/removeBox';
import { unfinishedRemovals } from '../features/accounts/state/unfinishedRemovals';
import type { UseLoginControllerDeps } from '../features/accounts/state/useLoginController';
import {
  withoutRemovalNotice,
  withRemovalNotice,
  type ShellNotice,
} from './shellNotices';
import { Dialog } from '../theme/Dialog';
import {
  readActiveBoxId,
  readUnified,
  resolveActiveBoxId,
  resolveUnified,
  writeActiveBoxId,
  writeUnified,
} from '../features/accounts/state/activeBox';

/**
 * `loadFailed`: the accounts table would not read at launch, or right after a box was added.
 * `restore` / `restoreTransfer`: the backup and transfer screens, opened from Welcome on a phone with no
 * boxes (2026-09-24) - outside the navigator, which cannot be drawn without a box.
 */
type Route =
  | 'loading'
  | 'loadFailed'
  | 'welcome'
  | 'home'
  | 'addBox'
  | 'reauth'
  | 'restore'
  | 'restoreTransfer';

/**
 * The routes a phone with no boxes can be on, where a restore that brings boxes in changes where back
 * goes. The add-box flow is one: it can be opened from Welcome while a restore left running carries
 * on, and its back went to Welcome - a Welcome about an empty phone, over the boxes that restore had
 * brought in.
 */
const FIRST_RUN_ROUTES: readonly Route[] = ['welcome', 'addBox', 'restore', 'restoreTransfer'];

/** Per-box outcome of the last refresh attempt. Absent = synced OK (or not yet attempted). */
export type SyncState = SyncFailure;

const loginDeps = createLoginDeps();

/** The boxes whose removal did not finish on this phone, finished at launch (`resumeRemoval`). */
const unfinished = unfinishedRemovals(settingsStore);

/** What `refreshAll` fetches and records through - the two controllers, as `refreshBox` needs them. */
const refreshDeps: RefreshAllDeps = {
  listReceived: (account, signal) => messagesController.listReceived(account, signal),
  getCredit: (account, signal) => messagesController.getCredit(account, signal),
  recordSync: (boxId, messages) => accountsController.recordSync(boxId, messages),
  recordCredit: (boxId, credit) => accountsController.recordCredit(boxId, credit),
  recordSyncFailure: (boxId, state) => accountsController.recordSyncFailure(boxId, state),
  // Each box under a signal its removal aborts: the refresh's own is never aborted, and a box removed
  // while it was fetched must neither be written back nor flagged (`BoxWork`).
  forBox: (boxId, signal, work) => boxWork.run(boxId, signal, work),
};

export function AppShell() {
  const theme = useTheme();
  const [route, setRoute] = useState<Route>('loading');
  // Help is reachable BEFORE any box exists - the hardest question ("where do I get my credentials?")
  // belongs to someone who cannot sign in yet, so it cannot live only behind sign-in (012 FR-007).
  //
  // It is an OVERLAY, not a route: a route swap would unmount the screen underneath, and returning to
  // a wiped sign-in form is exactly the state loss FR-007 forbids. Rendered over the live screen, the
  // form keeps every keystroke because it never unmounts.
  // Read here rather than threaded down: the consent gate is a ROUTE decision, and routes are this
  // component's job. AppShell is mounted inside `SettingsProvider` (see App.tsx), so this is legal.
  const { ready, telemetry, setTelemetry, setAppLock } = useSettings();
  // Read through a ref by `handleRemove`, which switches the lock off when the last box goes (001
  // T037). The provider hands out a new setter on every render; depending on it directly would
  // rebuild the removal callback, and everything it is passed down to, each time.
  const setAppLockRef = useRef(setAppLock);
  useEffect(() => {
    setAppLockRef.current = setAppLock;
  }, [setAppLock]);
  /**
   * The FAQ overlay: `null` closed, a `FaqId` open and scrolled to that answer, `'all'` open at the top.
   *
   * It used to be a boolean, which quietly threw away the only interesting part. `FaqScreen` already
   * takes a `focus` and both expands that answer and scrolls to it - every caller that reaches the
   * FAQ through the NAVIGATOR passes one - but this overlay rendered `<FaqScreen>` bare, so the one
   * contextual link here ("Co přesně se odesílá?", on the consent card) landed the reader at the top
   * of a long page and left them to find it. A question asked from a specific control should open at
   * its answer.
   */
  const [faq, setFaq] = useState<FaqId | 'all' | null>(null);
  const [accounts, setAccounts] = useState<DataBoxAccount[]>([]);
  const [activeBoxId, setActiveBoxId] = useState<string | null>(null);
  // The "refresh all" SPINNER state - its UI affordance (the box-list home) was retired in 011, but
  // refreshAll still drives the launch/add/re-auth background sync, so the setter (and its
  // perceptible delay) stays; the value itself is not rendered. The merged view briefly used it and
  // no longer does: it runs through the ordinary inbox now, which owns its own indicator.
  const [, setRefreshing] = useState(false);
  const [syncStates, setSyncStates] = useState<Record<string, SyncState>>({});
  // A mirror of syncStates readable synchronously inside refreshAll, which decides which boxes to
  // skip. Kept out of refreshAll's deps (so it isn't recreated on every state change) via this ref.
  const syncStatesRef = useRef<Record<string, SyncState>>({});
  useEffect(() => {
    syncStatesRef.current = syncStates;
  }, [syncStates]);
  const [reauthAccount, setReauthAccount] = useState<DataBoxAccount | null>(
    null,
  );
  /** When ISDS refused the box being re-authenticated, if the screen was opened from that refusal. */
  const [reauthRefusedAt, setReauthRefusedAt] = useState<number | undefined>(undefined);
  /**
   * What the shell has to tell the user, oldest first, one dialog at a time (`shellNotices.ts`): a box
   * removal that did not finish, over whatever screen it left behind - the inbox, or Welcome when the
   * last row went before a later step failed - and a new box name that would not save. Held here
   * rather than in the switcher, which has closed by the time either settles.
   */
  const [notices, setNotices] = useState<readonly ShellNotice[]>([]);
  /** What the "could not load" screen's retry runs again: the launch, or the step after adding a box. */
  const loadRetryRef = useRef<() => void>(() => {});
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  /**
   * The launch screen says the boxes would not load, and its retry runs `retry`.
   *
   * Announced as well as shown. The launch screen turning from a spinner into this is the app speaking
   * unprompted, and with a screen reader on nothing said so: the spinner is hidden from it, and the
   * retry was a button nobody knew to look for. The retry's label goes with it, the way a snackbar's
   * action does (`Snackbar.tsx`). Said here rather than from an effect on the route, which a retry that
   * fails straight away never changes, so it was said once and never again.
   */
  const failLoad = useCallback((retry: () => void) => {
    loadRetryRef.current = retry;
    setRoute('loadFailed');
    AccessibilityInfo.announceForAccessibility(
      `${t('app.loadFailed')} ${t('app.loadFailed.retry')}`,
    );
  }, []);
  /**
   * Bumped when a re-authentication succeeds, and passed down to the inbox so it re-syncs.
   *
   * The inbox owns its own "session expired" strip and clears it when a sync reports back, so
   * without a signal it kept showing the strip after a successful sign-in - until the user pulled to
   * refresh. Nothing else changes: the box, the folder and the refresh callback are all identical
   * either side of a re-auth, so there is no existing dependency to key off.
   *
   * A counter rather than a boolean, deliberately: it must fire again if the same box is
   * re-authenticated twice, and it must never sit in a "true" state that could re-trigger a sync -
   * every sync of the received folder is a legal delivery.
   */
  const [resyncNonce, setResyncNonce] = useState(0);
  // 023 option C: what the boxes the user is NOT looking at want them to know.
  //
  // Recomputed from `accounts` and the local archive, never from the network - so it costs a couple
  // of SQLite reads and cannot deliver anybody's mail. `accounts` changes after every refresh and
  // after every box switch, which is exactly when this can have changed.
  const [crossBox, setCrossBox] = useState<BoxAttention[] | null>(null);
  // 024 FR-003. The boxes `refreshAll` is fetching right now, so the line can say that the numbers
  // it states are about to change. Held here for the same reason `crossBox` is: refreshes start here.
  const [inFlight, setInFlight] = useState<InFlight>(NOTHING_IN_FLIGHT);
  // 024 cycle 2. Whether the MERGED view is what is on screen, rather than a box. Kept beside
  // `activeBoxId` rather than inside it: leaving the merged view has to land on a real box, and that
  // box is the one you were on before, so the two pieces of state are genuinely independent.
  const [unified, setUnified] = useState(false);

  // Current accounts / active box mirrored into refs so the notification deep-link resolver (a
  // long-lived callback registered once) always reads the latest without being re-created.
  const accountsRef = useRef<DataBoxAccount[]>([]);
  useEffect(() => {
    accountsRef.current = accounts;
  }, [accounts]);

  // Seed the crash scrubber with THIS device's own identifiers.
  //
  // A foreign error message can quote anything - a box ID inside a SOAP fault, an owner name inside
  // a parser error that choked on the envelope containing it. No pattern catches a Czech name, but
  // the app already holds the exact strings, so the scrubber removes them literally instead of
  // guessing at their shape. Re-seeded whenever accounts change, because a box added mid-session is
  // a new set of strings that must not appear in the next report.
  useEffect(() => {
    const literals = accounts.flatMap(a =>
      [a.boxId, a.loginName, a.label, a.alias].filter(
        (v): v is string => typeof v === 'string' && v.length > 0,
      ),
    );
    setRedactionIdentifiers(literals);
    // The same strings, for the same reason, in the debug recorder's `standard` level. Seeded from
    // one place so the two can never disagree about what identifies this device's owner; the `full`
    // level deliberately ignores them, because a Full bundle is the user's own data.
    setDebugRedactionIdentifiers(literals);
  }, [accounts]);
  const activeBoxIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeBoxIdRef.current = activeBoxId;
  }, [activeBoxId]);

  // Set the active box AND persist it (last-used restore across launches - FR-003). `null` clears it
  // (zero boxes → Welcome). Both halves are crash-safe (writeActiveBoxId never throws).
  /**
   * Point the shell at a box WITHOUT touching the merged-view flag.
   *
   * Exists because launch restoration and a user's tap are not the same act, and one setter for both
   * was a bug on the device: the launch path resolved the last-used box and called `setActive`,
   * which - correctly, for a tap - cleared the merged flag it had just restored, so the app always
   * reopened on a box. Worse, it PERSISTED the clear, so the user's choice was destroyed rather than
   * only ignored.
   */
  const selectBox = useCallback((boxId: string | null) => {
    setActiveBoxId(boxId);
    // Mirrored now as well as after the render: a queued removal asks which box is active the moment
    // the removal before it has moved the user off a box (`handleRemove`).
    activeBoxIdRef.current = boxId;
    void writeActiveBoxId(boxId);
  }, []);

  const setActive = useCallback(
    (boxId: string | null) => {
      selectBox(boxId);
      // Choosing a box is how you leave the merged view. There is no separate "back": the switcher
      // is the only way in and picking any box is the only way out, which keeps it a MODE rather
      // than a place with its own navigation stack.
      setUnified(false);
      void writeUnified(false);
    },
    [selectBox],
  );

  /** Enter the merged view. Only reachable from the switcher, and only with two boxes or more. */
  const enterUnified = useCallback(() => {
    setUnified(true);
    void writeUnified(true);
  }, []);

  const refresh = useCallback(async () => {
    const list = await accountsController.listAccounts();
    setAccounts(list);
    return list;
  }, []);

  // Refresh every box: fetch its received messages and stamp lastSyncedAt on success. What happens to
  // each box - the skip for a box waiting for a sign-in (re-auth itself clears that flag, see
  // handleReauthDone), the per-box failure flags - is `refreshBox` in `refreshAll.ts`, where it is
  // tested box by box. What stays here is the shell's bookkeeping around it.
  //
  // It never rejects. Every caller starts it with `void` - launch, adding a box, re-auth, the merged
  // view's pull - so a rejection had nowhere to land. A box that fails is that box's flag; a table that
  // will not read is reported and leaves the screen as it was, for the next refresh to try again.
  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    const startedAt = Date.now();
    const ctrl = new AbortController();
    try {
      const list = await accountsController.listAccounts();
      const known = syncStatesRef.current;
      // 024 FR-003: while these are out, the "Jinde" line says "načítá se…". Only the boxes actually
      // fetched - a box skipped for a sign-in is not going to change, and calling it loading would be
      // a promise nothing keeps.
      const fetching = boxesToFetch(list, known);
      setInFlight(prev => countInFlight(prev, fetching, 1));
      try {
        // Resolves once EVERY box is done. It was one `Promise.all` that rejected on the first box to
        // throw, which took the note down for the boxes still being fetched.
        setSyncStates(await refreshBoxes(list, known, refreshDeps, ctrl.signal));
        // Settled only once the re-read lands, not when the fetches return: until `accounts` holds the
        // new counts, the numbers on the line are still the old ones and "still refreshing" is still
        // true.
        await refresh();
      } finally {
        // …and settled even when the re-read throws, or the line would say "still refreshing" for good.
        setInFlight(prev => countInFlight(prev, fetching, -1));
      }
    } catch (e) {
      // The accounts table would not read, before the fetches or in the re-read after them.
      reportFailure('db.read', e, { stage: 'persist' });
    }
    // Keep the loading state on screen long enough to be perceptible (avoids a flicker on fast nets).
    const elapsed = Date.now() - startedAt;
    if (elapsed < 600) {
      await new Promise(resolve => setTimeout(resolve, 600 - elapsed));
    }
    setRefreshing(false);
  }, [refresh]);

  const handleSignedIn = useCallback(async () => {
    let list: DataBoxAccount[];
    try {
      list = await refresh();
    } catch (e) {
      // The box is saved; the list it belongs to would not read. This rejected into the sign-in form,
      // which does not wait for it, and the form's finished state stayed up with no way on.
      reportFailure('db.read', e, { stage: 'persist' });
      failLoad(() => void signedInRef.current());
      return;
    }
    // The box just added is the most recent; surface it as the active one.
    const newest = list.reduce<DataBoxAccount | null>(
      (acc, a) => (acc && acc.createdAt >= a.createdAt ? acc : a),
      null,
    );
    // The new box becomes the active (and last-used) one → its inbox shows (FR-006).
    setActive(newest ? newest.boxId : null);
    setRoute('home');
    // Auto-sync once after adding a box, so its messages/counts appear without a manual refresh.
    void refreshAll();
  }, [refresh, refreshAll, setActive, failLoad]);
  // Read by the "could not load" retry, which runs this step again rather than a plain launch: that
  // would reopen the box used last instead of the one just added (FR-006).
  const signedInRef = useRef(handleSignedIn);
  useEffect(() => {
    signedInRef.current = handleSignedIn;
  }, [handleSignedIn]);

  // A cheap re-read of the table (focus, opening the switcher). Never rejects - the navigator starts it
  // without waiting - and a read that fails keeps the list on screen as it was, for the next one.
  const reloadAccounts = useCallback(() => {
    refresh().catch(e => {
      reportFailure('db.read', e, { stage: 'persist' });
    });
  }, [refresh]);

  // Rename a box. Never rejects: the switcher does not wait for it, so a failure here used to go
  // nowhere and the sheet closed as if the name had been saved.
  const handleSetAlias = useCallback(
    async (boxId: string, alias: string | null) => {
      try {
        await accountsController.setAlias(boxId, alias);
      } catch (e) {
        reportFailure('db.write', e, { stage: 'persist' });
        const account = accountsRef.current.find(a => a.boxId === boxId);
        setNotices(prev => [
          ...prev,
          { kind: 'alias', boxId, name: account ? account.alias ?? account.label : null, alias },
        ]);
        return;
      }
      try {
        await refresh();
      } catch (e) {
        // The name IS saved; only the re-read failed. Shown in place, as `setAlias` stores it, so the
        // switcher does not keep the old name and read as a rename that did not take.
        reportFailure('db.read', e, { stage: 'persist' });
        const stored = alias?.trim() || null;
        setAccounts(prev => prev.map(a => (a.boxId === boxId ? { ...a, alias: stored } : a)));
      }
    },
    [refresh],
  );

  // A box whose row is gone leaves the screen at once, before the rest of it is cleared (`onRowGone`).
  // With the last box that means Welcome straight away: the screen used to stay empty for as long as
  // the archive and its files took to delete, and then Welcome appeared. Adding a box from there waits
  // for the removal to finish (`addBoxDeps`), so nothing of the new box is cleared from under it.
  const letGoOf = useCallback(
    (boxId: string) => {
      const left = accountsRef.current.filter(a => a.boxId !== boxId);
      if (left.length === accountsRef.current.length) {
        return;
      }
      accountsRef.current = left;
      setAccounts(left);
      if (activeBoxIdRef.current === boxId) {
        setActive(left.length > 0 ? left[0].boxId : null);
      }
      if (left.length === 0) {
        setRoute(current => (current === 'home' ? 'welcome' : current));
      }
    },
    [setActive],
  );

  // What a removal runs over - the same for one the user asks for and one finished later.
  const removalDeps = useCallback(
    (): RemoveBoxDeps => ({
      // The row, then both Keychain items (`forgetSecrets`).
      accounts: accountsController,
      purges: [
        // drop the removed box's offline cache too
        { step: 'archive', run: id => messagesController.clearBoxCache(id) },
        // …and its reminders. They are the user's own data and deliberately outlive message
        // CONTENT (ISDS erases at 90 days), but not the box itself - a reminder on a box you
        // removed can never be shown or opened, and its notifications would fire pointing at
        // nothing (010 T013).
        { step: 'reminders', run: id => remindersController.clearBox(id) },
        // …and the scan suggestions it dismissed (010 US3). Tiny key/value rows, but they are
        // keyed by message and would outlive every other trace of the box.
        { step: 'scanDismissals', run: id => scanController.clearBox(id) },
      ],
      appLock,
      setAppLock: enabled => setAppLockRef.current(enabled),
      unfinished,
      onRowGone: letGoOf,
      // Every sync and download of the box stops when its removal starts, and nothing of it is
      // written after its archive is cleared.
      work: boxWork,
    }),
    [letGoOf],
  );

  // Show what a removal actually did. `announce` is false for a removal finished later, which opens no
  // dialog of its own: the user was told when it did not finish, and a launch that opened on a notice
  // about a box removed days ago would be about nothing they can see.
  const applyRemoval = useCallback(
    (boxId: string, result: RemoveBoxResult, name: string | null, announce: boolean) => {
      for (const failure of result.failures) {
        // Each step as what it is - a row, a Keychain item, an archive - so a report can act on it.
        const { op, stage } = removalFailureReport(failure.step);
        reportFailure(op, failure.error, { stage });
      }
      // What the screen shows comes from what the store holds now, not from what was asked for.
      const settled = settleRemoval(
        result,
        boxId,
        activeBoxIdRef.current,
        accountsRef.current,
      );
      if (settled.accounts) {
        accountsRef.current = settled.accounts;
        setAccounts(settled.accounts);
      }
      if (settled.gone) {
        setSyncStates(prev => {
          if (!(boxId in prev)) {
            return prev;
          }
          const rest = { ...prev };
          delete rest[boxId];
          return rest;
        });
      }
      if (settled.active !== undefined) {
        // Removed the ACTIVE box → the first remaining one (persisted as last-used); none → null.
        setActive(settled.active);
      }
      if (settled.toWelcome) {
        // Removed the last box → back to the branded first-run Welcome. Only from the inbox: Welcome
        // appeared when the row went, and may have handed over to the add-box flow since.
        setRoute(current => (current === 'home' ? 'welcome' : current));
      }
      const notice = settled.notice;
      // Queued also while the app is in the background or locked. It is not drawn there - a Modal
      // draws above the lock overlay, and this one names the box - but held until the app is open
      // again (`covered` below). It used to be dropped, and nothing said on return that the removal
      // had not finished.
      setNotices(prev => {
        if (notice !== null && announce) {
          return withRemovalNotice(prev, { kind: 'removal', boxId, name, notice });
        }
        // A removal that went through takes its own box's notice down, and only that one.
        return notice === null || announce ? withoutRemovalNotice(prev, boxId) : prev;
      });
    },
    [setActive],
  );

  // Remove one box and show what actually happened. Only ever run through `handleRemove`'s queue.
  const removeOne = useCallback(
    async (boxId: string): Promise<void> => {
      // Named now, while the row still exists: a removal that fails after the row went still has to
      // say which box it was about.
      const removed = accountsRef.current.find(a => a.boxId === boxId);
      // The sequence lives in `removeBox` so it can be tested - including what removing the LAST box
      // does to the app lock (001 T037), which is explained there. It resolves with what actually
      // happened and never rejects: the switcher closes before this finishes, so a rejection here had
      // nobody to land on, and the list kept a box whose row was already gone.
      const result = await removeBox(boxId, removalDeps());
      applyRemoval(boxId, result, removed ? removed.alias ?? removed.label : null, true);
    },
    [removalDeps, applyRemoval],
  );

  // Finish a removal that did not finish (`resumeRemoval`), from its mark: at launch, and when the
  // dialog about it closes. It clears what is left of a box no longer listed and never touches one
  // that is listed again.
  const resumeOne = useCallback(
    async (boxId: string): Promise<void> => {
      applyRemoval(boxId, await resumeRemoval(boxId, removalDeps()), null, false);
    },
    [removalDeps, applyRemoval],
  );

  // `removeBox` and `resumeRemoval` resolve with their failures, so nothing is expected to reach this.
  // Reported all the same, and it never stops the removals queued after it.
  const reportUnexpected = useCallback((e: unknown) => {
    reportFailure('db.write', e, { stage: 'persist' });
  }, []);

  const handleRemove = useCallback(
    (boxId: string): Promise<void> =>
      // One removal at a time, in the order asked (`RemovalQueue`). The switcher can be reopened while
      // one is still running, and two at once raced each other through the store: the one to settle
      // last put back on screen, even made active, a box the other had already removed. The same box
      // asked for again while queued is the same removal.
      // The queue is the app's, not this screen's (`deps.ts`): a restore waits for it too.
      removalQueue.run(boxId, () => removeOne(boxId), reportUnexpected),
    [removeOne, reportUnexpected],
  );

  const resumeLater = useCallback(
    (boxId: string) => {
      void removalQueue.run(boxId, () => resumeOne(boxId), reportUnexpected);
    },
    [resumeOne, reportUnexpected],
  );

  // The sign-in flow's accounts, with adding a box held until no removal is running. A removal of the
  // same box still clearing its archive would otherwise delete the new Keychain items and the first
  // sync of the box just added - and a last box's lock reset would land after the new box's key.
  const addBoxDeps = useMemo<UseLoginControllerDeps>(
    () => ({
      ...loginDeps,
      accountsController: {
        addAccount: async input => {
          await removalQueue.idle();
          return accountsController.addAccount(input);
        },
        reauthAccount: (...args) => accountsController.reauthAccount(...args),
        listAccounts: () => accountsController.listAccounts(),
      },
    }),
    [],
  );

  // Launch: the boxes and their flags, the box and view used last, the route - then the removals that
  // did not finish. `alive` turns false if the shell unmounts meanwhile.
  const launch = useCallback(
    async (alive: () => boolean) => {
      let list: DataBoxAccount[];
      try {
        list = await refresh();
      } catch (e) {
        // The accounts table would not read. The launch screen used to stay up for good - the promise
        // rejected with nothing to catch it - so it says so now, and its retry runs the launch again.
        reportFailure('db.read', e, { stage: 'persist' });
        if (alive()) {
          failLoad(() => void launch(() => mountedRef.current));
        }
        return;
      }
      if (!alive()) {
        return;
      }
      // Restore each box's last-known failure flag from the DB so a box that needs re-auth still
      // shows its strip (and is skipped by refresh-all) after a cold start - no silent re-try.
      const restored: Record<string, SyncState> = {};
      for (const a of list) {
        if (a.syncError) {
          restored[a.boxId] = a.syncError;
        }
      }
      syncStatesRef.current = restored;
      setSyncStates(restored);
      // Seed the active box from the persisted LAST-USED id (FR-001): resolve it against the boxes
      // that exist - stale/garbled/missing degrades to the first box; zero boxes → null → Welcome.
      const persisted = await readActiveBoxId();
      if (!alive()) {
        return;
      }
      const resolved = resolveActiveBoxId(persisted, list.map(a => a.boxId));
      selectBox(resolved); // re-persists the resolved id (so a fallback becomes the new last-used)
      // …and whether they were last looking at the merged view. AFTER the box, and through
      // `selectBox` above rather than `setActive`, or restoring it would be undone in the same tick.
      // `resolveUnified` applies the two-box threshold, so a user who dropped to one box while the
      // app was closed comes back to that box rather than to a view that no longer makes sense.
      setUnified(resolveUnified(await readUnified(), list.length));
      // Zero boxes → the branded first-run Welcome (its button enters the add-box flow); otherwise home.
      setRoute(resolved != null ? 'home' : 'welcome');
      // Auto-sync on launch: refresh the boxes so a fresh open shows current mail and clears a stale
      // failure flag once connectivity is back. (Boxes flagged `reauth` are still skipped - they need
      // an explicit re-login.) NOTE: listing legally delivers messages (§17/3).
      // DEMO_DATA boxes are fictional and have no server behind them, so a launch sync can only
      // fail and paint a re-login strip over every screenshot. Skipped there, and only there.
      if (resolved != null && !(__DEV__ && DEMO_DATA)) {
        void refreshAll();
      }
      // Removals that did not finish on this phone: a dialog closed, or the app killed halfway. After
      // the route, so clearing a box's files never holds the launch screen up.
      let marked: string[] = [];
      try {
        marked = await unfinished.list();
      } catch (e) {
        reportFailure('settings.read', e, { stage: 'persist' });
      }
      for (const boxId of marked) {
        resumeLater(boxId);
      }
    },
    [refresh, refreshAll, selectBox, resumeLater, failLoad],
  );

  useEffect(() => {
    let alive = true;
    void launch(() => alive);
    return () => {
      alive = false;
    };
  }, [launch]);

  const retryLoad = useCallback(() => {
    setRoute('loading');
    loadRetryRef.current();
  }, []);

  // ── A restore on a phone with no boxes (2026-09-24) ──────────────────────────────────────────────
  //
  // Welcome opens the backup and transfer screens directly, so a new phone reaches its archive without
  // adding a box by hand first. What a restore brings in is rows in the accounts table, which this
  // shell only reads when asked, so it asks when one ends.

  /** The route, for the listener below, which is registered once and outlives renders. */
  const routeRef = useRef(route);
  routeRef.current = route;

  /**
   * Into the inbox of the boxes a restore brought, the way a launch lands there: the box used last if
   * this phone has one, else the first, and the merged view only if it still makes sense. No sync:
   * listing is a legal delivery, and nobody asked for one - the boxes need signing in to first anyway
   * (025 FR-011), which the inbox says on the first refresh the user starts.
   */
  const enterRestored = useCallback(
    async (list: readonly DataBoxAccount[], from: Route) => {
      const ids = list.map(a => a.boxId);
      const last = await readActiveBoxId();
      const merged = await readUnified();
      // Only from where it was asked from. Both reads wait on the settings table, and a person who
      // tapped "Přidat datovou schránku" meanwhile is not pulled out of the sign-in form.
      if (routeRef.current !== from) {
        return;
      }
      selectBox(resolveActiveBoxId(last, ids));
      setUnified(resolveUnified(merged, list.length));
      setRoute('home');
    },
    [selectBox],
  );

  /** The restore screens' way on: shown only once there is a box to go to. */
  const continueRestored = useCallback(() => {
    void enterRestored(accountsRef.current, routeRef.current);
  }, [enterRestored]);

  /**
   * Back from the restore screen: to Welcome, or - once a restore has brought boxes in - to them.
   * Welcome with boxes behind it would offer to add a first box to a phone that has several.
   */
  const leaveRestore = useCallback(() => {
    if (accountsRef.current.length > 0) {
      continueRestored();
      return;
    }
    setRoute('welcome');
  }, [continueRestored]);

  // Every restore - the backup screen's, and a transfer's save, which runs as one of the backup
  // controller's runs - ends by changing the run to none. Heard here while the phone has no boxes on
  // screen: the table is read again, so the restore screens can offer the way on. And if the person
  // had already gone back to Welcome while it ran ("Nechat běžet"), it goes straight to the inbox:
  // Welcome with the archive restored behind it would be a screen about a phone this no longer is.
  useEffect(() => {
    let wasRunning = backupController.currentRun() !== null;
    return backupController.subscribe(() => {
      const running = backupController.currentRun() !== null;
      const ended = wasRunning && !running;
      wasRunning = running;
      if (!ended || !FIRST_RUN_ROUTES.includes(routeRef.current)) {
        return;
      }
      refresh()
        .then(list => {
          if (list.length > 0 && routeRef.current === 'welcome') {
            return enterRestored(list, 'welcome');
          }
          return undefined;
        })
        .catch(e => {
          reportFailure('db.read', e, { stage: 'persist' });
        });
    });
  }, [refresh, enterRestored]);

  // Open the re-authentication flow for a box whose session expired.
  // Recompute the cross-box summary whenever the account snapshot or the active box changes. Those
  // are precisely the moments its answer can differ: a refresh rewrote the counts, a box was
  // repaired or broke, or the user moved to a different box so a different set is now "the others".
  // And when a refresh of those boxes starts or settles (`inFlight`), which is what "still refreshing"
  // reports - the previous rows stay on screen while this re-reads, so the line never blinks out.
  useEffect(() => {
    let alive = true;
    void crossBoxAttention(
      accounts,
      activeBoxId,
      {
        cachedEnvelopes: async boxId =>
          (await messagesController.getCachedMessages(boxId, 'received')).envelopes,
        reminders: boxId => remindersController.listForBox(boxId),
      },
      Date.now(),
      inFlight,
    )
      .then(rows => {
        if (alive) {
          setCrossBox(rows);
        }
      })
      .catch(() => {
        if (alive) {
          // `[]` and never left at `null`: null means "still reading" and holds the inbox skeleton
          // up. A summary we failed to build is "nothing to report", not a screen that never loads.
          setCrossBox([]);
        }
      });
    return () => {
      alive = false;
    };
  }, [accounts, activeBoxId, inFlight]);

  // The threshold, enforced on the way DOWN as well as up. A user with two boxes sitting in the
  // merged view who removes one must not be left in a view that has stopped existing - it would be
  // their only box under a title saying "all boxes". Asked on every account change, not once at
  // launch, because that is when a box can disappear.
  useEffect(() => {
    setUnified(current => {
      const next = resolveUnified(current, accounts.length);
      if (next !== current) {
        void writeUnified(next);
      }
      return next;
    });
  }, [accounts.length]);

  // The active box has to be one that is listed. Removing the active box deletes its row first and
  // clears the rest after it (`removeBox`), and whatever re-reads the table meanwhile - opening the
  // switcher does - left `activeBoxId` naming a box that is no longer there. The navigator draws
  // nothing for that, its header and the switcher included, so the screen stayed blank until the
  // removal settled. The first remaining box stands in, as the removal itself picks; with none left,
  // the removal settles on Welcome. `selectBox`, so the merged view is left to its own rule above.
  //
  // No box at all counts too (2026-09-24): a restore left running can bring boxes in while the add-box
  // flow is open from Welcome, and backing out of it goes to the inbox with none of them chosen - which
  // the navigator draws as an empty screen.
  useEffect(() => {
    if (
      route === 'home' &&
      accounts.length > 0 &&
      (activeBoxId === null || !accounts.some(a => a.boxId === activeBoxId))
    ) {
      selectBox(accounts[0].boxId);
    }
  }, [route, accounts, activeBoxId, selectBox]);

  const handleReauth = useCallback(
    (boxId: string, refusedAt?: number) => {
      const account = accounts.find(a => a.boxId === boxId);
      if (account) {
        setReauthAccount(account);
        // Handed on to the screen, which judges an expired password at this moment when the box has
        // no verdict stored - the moment the inbox strip was judged at (001 FR-009).
        setReauthRefusedAt(refusedAt);
        setRoute('reauth');
      }
    },
    [accounts],
  );

  // Re-auth succeeded (secret/session refreshed): clear the box's broken flag - in the ref too, so
  // the imminent refreshAll won't skip the very box we just fixed - then re-sync everything.
  //
  // THE ORDER OF THE LAST THREE STEPS MATTERS, and getting it wrong is invisible in every test that
  // stubs the transport. It was found when re-auth wrote the new session cookie to the accounts
  // TABLE: `accounts` in this component is a snapshot of that table, and it is what the inbox
  // receives as a prop. `MessageList.refresh` reads the account from a ref (deliberately - see the
  // comment above its `accountRef`, which explains why it must NOT re-run on account identity churn),
  // so bumping the nonce before re-reading the table told the inbox to re-sync using the session that
  // had just expired. It failed, raised its strip again, and nothing re-ran it: the effect is keyed on
  // boxId/folder/refresh/nonce, and none of those change when `setAccounts` finally lands. The user
  // saw "Platnost prihlaseni vyprsela" over an inbox that was, by then, perfectly signed in - until
  // they pulled to refresh, which re-read the ref and cleared it. Since 001 T028 the session comes
  // from the vault at call time, not from the row, but the row still carries the auth method a
  // re-auth may have changed - so the order stands.
  //
  // So: clear the flag, re-read the table, and only THEN tell the inbox to sync.
  const handleReauthDone = useCallback(() => {
    const boxId = reauthAccount?.boxId;
    setReauthAccount(null);
    setRoute('home');
    if (boxId) {
      const cleared = { ...syncStatesRef.current };
      delete cleared[boxId];
      syncStatesRef.current = cleared;
      setSyncStates(cleared);
    }
    void (async () => {
      try {
        await refresh(); // the new session cookie reaches the inbox's prop before it is asked to sync
      } catch (e) {
        // The sign-in is saved; only the re-read failed, and it used to reject with nothing to catch
        // it - the inbox was never told, and kept its strip over a box that was signed in. It is told
        // anyway: its own sync then says what happened, with its own retry, and `refreshAll` reads the
        // table again.
        reportFailure('db.read', e, { stage: 'persist' });
      }
      setResyncNonce(n => n + 1); // tell the inbox its session is good again (it drops its strip)
      await refreshAll();
    })();
  }, [reauthAccount, refresh, refreshAll]);

  // Reminder deep-link (010 FR-005): resolve a tapped reminder → switch the OWNING box active (set +
  // persist) and open the message; degrade safely (missing box → active inbox; missing message →
  // that box's inbox, which is what a reminder outliving ISDS's 90-day erasure lands on). Reads live
  // state via refs so the callback is stable. Never throws.
  const handleDeepLink = useCallback(
    async (payload: NotificationPayload) => {
      const boxIds = accountsRef.current.map(a => a.boxId);
      let messageExists = false;
      if (payload.boxId && payload.messageId && boxIds.includes(payload.boxId)) {
        try {
          const cached = await messagesController.getCachedMessages(
            payload.boxId,
            'received',
          );
          messageExists = cached.envelopes.some(e => e.id === payload.messageId);
        } catch (e) {
          // Falls back to the inbox, so the tap still goes somewhere - but the user asked for one
          // message and got a list, which reads as the reminder pointing at the wrong thing.
          reportFailure('db.read', e, { stage: 'persist' });
          messageExists = false; // best-effort - fall back to the box's inbox
        }
      }
      const target = resolveDeepLink(payload, boxIds, messageExists);
      if (target.kind === 'none') {
        resetToInbox(); // owning box gone → return to the active inbox, never strand
        return;
      }
      setActive(target.boxId); // switch + persist → the root inbox swaps to the owning box in place
      resetToInbox();
      if (target.kind === 'message') {
        navigate('MessageDetail', {
          boxId: target.boxId,
          messageId: target.messageId,
          folder: 'received',
        });
      }
    },
    [setActive],
  );

  // Wire the notification taps: the foreground handler + a cold-start initial-notification pickup are
  // registered once for the app's lifetime (the payload queues in the router until the resolver is
  // ready); the live resolver is registered only while the navigator is mounted (route === 'home').
  useEffect(() => {
    const unsubscribe = registerForegroundNotificationHandler();
    void consumeInitialNotification();
    return unsubscribe;
  }, []);
  // The inbox cannot be drawn with no box in it. A re-read that finds none while the last box's removal
  // is still clearing it is Welcome, from that very render - not a frame of empty navigator first.
  const shownRoute: Route = route === 'home' && accounts.length === 0 ? 'welcome' : route;
  useEffect(() => {
    if (route === 'home' && accounts.length === 0) {
      setRoute('welcome');
    }
  }, [route, accounts.length]);
  useEffect(() => {
    if (shownRoute !== 'home') {
      return;
    }
    setDeepLinkResolver(handleDeepLink); // drains any queued cold-start tap now the navigator is up
    return () => setDeepLinkResolver(null);
  }, [shownRoute, handleDeepLink]);

  // Help rendered OVER the current pre-sign-in screen, which therefore stays mounted and keeps its
  // state. EdgeSwipeBack gives it Android hardware-back and the iOS edge swipe; its handler registers
  // after the one underneath, so the system back closes help rather than leaving the flow.
  // The notice at the head of the queue (`notices`). A dialog, so it sits over whichever screen is up -
  // the inbox, Welcome, or the add-box flow Welcome hands over to. Every removal sentence names the
  // state honestly and offers the same way out: run the removal again.
  //
  // Not drawn while the app is in the background or behind the lock screen (`useAppCovered`, from
  // `LockGate`): RN Modals draw above the lock overlay, and these carry the box's name. Held rather
  // than closed, and back once the app is in the foreground and unlocked. Closing one on the way to
  // the background lost it for good - the app said nothing on return about a removal that had not
  // finished - and closing is the user's answer, not the phone's.
  const covered = useAppCovered();
  const closeNotice = useCallback(
    (closing: ShellNotice) => {
      setNotices(prev => prev.filter(n => n !== closing));
      if (closing.kind === 'removal') {
        // Closing deletes nothing the user did not already ask to delete. A box still listed (`kept`)
        // is left alone and keeps Odebrat in the switcher; what is left of one already gone is
        // finished now, and at the next launch if that fails too (`resumeRemoval`).
        resumeLater(closing.boxId);
      }
    },
    [resumeLater],
  );
  const notice = notices.length > 0 && !covered ? notices[0] : null;
  let noticeDialog: ReactNode = null;
  if (notice?.kind === 'removal') {
    noticeDialog = (
      <Dialog
        key={`removal:${notice.boxId}`}
        testID="removeFailed"
        title={t('box.removeFailed.title')}
        subtitle={notice.name ?? undefined}
        body={
          notice.notice === 'kept'
            ? t('box.removeFailed.kept')
            : notice.notice === 'incomplete'
            ? t('box.removeFailed.incomplete')
            : t('box.removeFailed.unknown')
        }
        onDismiss={() => closeNotice(notice)}
        actions={[
          {
            label: t('box.removeFailed.close'),
            onPress: () => closeNotice(notice),
            testID: 'removeFailedClose',
          },
          {
            label: t('box.removeFailed.retry'),
            onPress: () => {
              setNotices(prev => prev.filter(n => n !== notice));
              void handleRemove(notice.boxId);
            },
            tone: 'primary',
            testID: 'removeFailedRetry',
          },
        ]}
      />
    );
  } else if (notice?.kind === 'alias') {
    noticeDialog = (
      <Dialog
        key={`alias:${notice.boxId}`}
        testID="aliasFailed"
        title={t('box.aliasFailed.title')}
        subtitle={notice.name ?? undefined}
        body={t('box.aliasFailed.body')}
        onDismiss={() => closeNotice(notice)}
        actions={[
          {
            label: t('box.aliasFailed.close'),
            onPress: () => closeNotice(notice),
            testID: 'aliasFailedClose',
          },
          {
            label: t('box.aliasFailed.retry'),
            onPress: () => {
              closeNotice(notice);
              void handleSetAlias(notice.boxId, notice.alias);
            },
            tone: 'primary',
            testID: 'aliasFailedRetry',
          },
        ]}
      />
    );
  }

  const withFaq = (screen: ReactNode) => (
    <>
      {screen}
      {noticeDialog}
      {faq ? (
        <YStack
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          backgroundColor={theme.bg}
        >
          <EdgeSwipeBack onBack={() => setFaq(null)}>
            <FaqScreen onBack={() => setFaq(null)} focus={faq === 'all' ? undefined : faq} />
          </EdgeSwipeBack>
        </YStack>
      ) : null}
    </>
  );

  if (route === 'loading' || route === 'loadFailed') {
    // The launch screen, which says so when the boxes would not load (`LaunchScreen`).
    return <LaunchScreen failed={route === 'loadFailed'} onRetry={retryLoad} />;
  }

  // The diagnostics question, asked once and before anything is transmitted.
  //
  // AFTER the first box rather than before it: at the Welcome screen the user does not yet know what
  // this app is, and a question about error reports is meaningless without that. By the time a box
  // exists they have seen the thing they are being asked to help fix. Nothing transmits in the
  // meantime - `telemetry` is `null` until answered, and `startTelemetry` reads `=== true`.
  //
  // The cost, and it is a real one: a crash during onboarding - the hardest part of this app - is
  // never reported, because the user has not been asked yet. That is the price of asking first.
  if (ready && telemetry === null && accounts.length > 0 && route === 'home') {
    return withFaq(
      <TelemetryConsent
        onAnswer={setTelemetry}
        onExplain={() => setFaq('diagnostics')}
      />,
    );
  }

  if (shownRoute === 'welcome') {
    // First run (no boxes): the branded Welcome gate. Its primary action enters the add-box flow, and
    // the text button under it the restore screen below.
    return withFaq(
      <Welcome
        onAddBox={() => setRoute('addBox')}
        onOpenFaq={() => setFaq('all')}
        onRestore={() => setRoute('restore')}
        canTransfer={transferController.available()}
      />,
    );
  }

  // Each route's EdgeSwipeBack carries the route as its key. They sit at the same place in the tree,
  // so without one React handed the next route the wrapper a swipe had just slid off-screen, and
  // the new screen appeared blank (iPhone, 2026-09-24).
  if (route === 'restore') {
    // The backup screen, showing only what a phone with no boxes can use (`firstRun`). Android's system
    // back is the screen's own: it asks before leaving a restore that is running, and this wrapper's
    // handler, registered after it, would be asked first and leave without the question.
    return withFaq(
      <EdgeSwipeBack key="restore" onBack={leaveRestore} systemBack={false}>
        <SnackbarProvider>
          <BackupScreen
            firstRun
            onBack={leaveRestore}
            controller={backupController}
            onOpenFaq={focus => setFaq(focus)}
            // Only where this phone can receive one - the transfer screen would only say it cannot.
            onOpenTransfer={
              transferController.available() ? () => setRoute('restoreTransfer') : undefined
            }
            transferOutcomes={transferController}
            onContinue={accounts.length > 0 ? continueRestored : undefined}
          />
        </SnackbarProvider>
      </EdgeSwipeBack>,
    );
  }

  if (route === 'restoreTransfer') {
    // Receiving only: a phone with no boxes has nothing to send. Back is the restore screen it came
    // from, where the file and the backups on this phone still are.
    const back = () => setRoute('restore');
    return withFaq(
      <EdgeSwipeBack key="restoreTransfer" onBack={back}>
        <TransferScreen
          receiveOnly
          onBack={back}
          controller={transferController}
          backups={null}
          onContinue={accounts.length > 0 ? continueRestored : undefined}
        />
      </EdgeSwipeBack>,
    );
  }

  if (route === 'addBox') {
    // These flows live outside the navigator, so wrap them to get the iOS swipe-from-edge back gesture.
    //
    // Where back GOES depends on what is behind this flow, and there is always something: the inbox
    // for someone who already has a box, the Welcome gate on a first run. This used to hand back
    // `undefined` when the list was empty, which is not "no back" - `EdgeSwipeBack` reads it as
    // "nowhere to go", so Android's system Back left the app from the first screen a new user ever
    // sees, and iOS lost both the edge swipe and (via AddBoxForm's `headerBack`) the chevron. Welcome
    // is behind it; back goes there.
    const back = () => setRoute(accounts.length > 0 ? 'home' : 'welcome');
    return withFaq(
      <EdgeSwipeBack key="addBox" onBack={back}>
        <LoginFlow
          deps={addBoxDeps}
          onSignedIn={handleSignedIn}
          onBack={back}
          onOpenFaq={() => setFaq('all')}
        />
      </EdgeSwipeBack>,
    );
  }

  if (route === 'reauth' && reauthAccount) {
    const back = () => {
      setReauthAccount(null);
      setRoute('home');
    };
    return (
      <EdgeSwipeBack key="reauth" onBack={back}>
        <LoginFlow
          key={reauthAccount.boxId}
          deps={createLoginDeps(reauthAccount.host)}
          reauth={reauthAccount}
          reauthRefusedAt={reauthRefusedAt}
          onSignedIn={handleReauthDone}
          onBack={back}
        />
      </EdgeSwipeBack>
    );
  }

  return (
    <>
      <AppNavigator
        accounts={accounts}
        activeBoxId={activeBoxId}
        setActive={setActive}
        addBox={() => setRoute('addBox')}
        removeBox={handleRemove}
        setAlias={handleSetAlias}
        onReauth={handleReauth}
        resyncNonce={resyncNonce}
        reloadAccounts={reloadAccounts}
        crossBox={crossBox}
        unified={unified}
        onOpenUnified={enterUnified}
        onRefreshAll={refreshAll}
      />
      {noticeDialog}
    </>
  );
}
