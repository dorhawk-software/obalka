// Refreshing every box at once - the per-box half of `AppShell.refreshAll` (002 FR-017, 024 FR-003).
//
// Moved out of the shell for the reason `removeBox.ts` was: the rules here are exactly the ones that
// went wrong, and a plain function over injected pieces can be tested box by box. The fetches ran
// under one `Promise.all`, so a single box whose database write threw rejected the whole refresh: the
// shell took the "načítá se…" note down for every box while the others were still being fetched,
// never re-read the accounts, and handed the rejection to callers that had started the refresh with
// `void`, where nothing caught it.
//
// Here every box settles on its own, and whatever goes wrong becomes that box's flag and no other's.

import { reportFailure } from '../services/telemetry/telemetry';
import type {
  DataBoxAccount,
  MessageEnvelope,
  SyncFailure,
} from '../services/isds/types';
import {
  classifyFailure,
  needsSignIn,
  type MessagesOutcome,
} from '../features/messages/state/messagesController';

/** The slice of the accounts and messages controllers a refresh uses. */
export interface RefreshAllDeps {
  listReceived(account: DataBoxAccount, signal: AbortSignal): Promise<MessagesOutcome>;
  getCredit(account: DataBoxAccount, signal: AbortSignal): Promise<number | null>;
  recordSync(boxId: string, messages: MessageEnvelope[]): Promise<void>;
  recordCredit(boxId: string, pdzCreditCzk: number | null): Promise<void>;
  recordSyncFailure(boxId: string, syncError: SyncFailure): Promise<void>;
  /**
   * Runs one box's refresh under a signal of its own, which that box's removal aborts as well
   * (`BoxWork.run`). Without it every box runs under the refresh's signal.
   */
  forBox?<T>(
    boxId: string,
    signal: AbortSignal,
    work: (signal: AbortSignal) => Promise<T>,
  ): Promise<T>;
}

/**
 * The boxes a refresh actually fetches: every box except those only the user can repair.
 *
 * The shell marks these as loading, so the mark has to follow the same rule the fetch skips on. It
 * was a second, narrower copy (`!== 'reauth'`), and a box whose password had expired was marked
 * "načítá se…" by a refresh that never fetched it.
 */
export function boxesToFetch(
  accounts: readonly DataBoxAccount[],
  known: Readonly<Record<string, SyncFailure>>,
): string[] {
  return accounts.filter(a => !needsSignIn(known[a.boxId])).map(a => a.boxId);
}

/**
 * Refresh one box; resolves with the flag it holds afterwards (null = synced), and never rejects.
 *
 * A box already waiting for a sign-in is SKIPPED and keeps its flag: ISDS has refused its stored
 * password or session, and sending it again cannot work - an expired password included (001 FR-009),
 * and ISDS locks an account after repeated refused sign-ins. A failure is recorded per box (`reauth`
 * = sign in again, `passwordExpired` = change it on the portal first, `error` = transient) so the
 * switcher can flag the box, and its old timestamp and counts are left untouched.
 */
export async function refreshBox(
  account: DataBoxAccount,
  kept: SyncFailure | undefined,
  deps: RefreshAllDeps,
  signal: AbortSignal,
): Promise<SyncFailure | null> {
  if (needsSignIn(kept)) {
    return kept; // skip: no network call, preserve the flag
  }
  let outcome: MessagesOutcome;
  try {
    outcome = await deps.listReceived(account, signal);
  } catch (e) {
    if (signal.aborted) {
      return kept ?? null;
    }
    // `listReceived` answers its own failures as outcomes; getting here is a fault underneath it.
    reportFailure('isds.listReceived', e, { stage: 'transport' });
    await keepFlag(account.boxId, 'error', deps);
    return 'error';
  }
  if (outcome.kind !== 'loaded' && signal.aborted) {
    // Stopped - by the box's removal - not refused. Recorded as a failure, a box whose removal then
    // kept its row would have been flagged: a cookie box sent to sign in again with a session that
    // works, and skipped by every refresh until it did.
    return kept ?? null;
  }
  if (outcome.kind !== 'loaded') {
    const state = classifyFailure(account, outcome);
    await keepFlag(account.boxId, state, deps);
    return state;
  }
  try {
    await deps.recordSync(account.boxId, outcome.messages);
  } catch (e) {
    // The listing arrived but its counts did not land, so the badge and the Jinde line would state
    // the old numbers as current. Flagged like any other refresh that did not complete.
    reportFailure('db.write', e, { stage: 'persist' });
    await keepFlag(account.boxId, 'error', deps);
    return 'error';
  }
  // Best-effort PDZ credit for the overview - never blocks or fails the refresh (020).
  try {
    const credit = await deps.getCredit(account, signal);
    // A credit call the removal stopped answers null, which is not the box's balance.
    if (!signal.aborted) {
      await deps.recordCredit(account.boxId, credit);
    }
  } catch (e) {
    reportFailure('db.write', e, { stage: 'persist' });
  }
  return null;
}

/**
 * Persist a box's flag so it survives a restart - the refresh-all skip reads it back at launch. When
 * the write fails the flag still holds for this session, which is all the screen needs now.
 */
async function keepFlag(
  boxId: string,
  state: SyncFailure,
  deps: RefreshAllDeps,
): Promise<void> {
  try {
    await deps.recordSyncFailure(boxId, state);
  } catch (e) {
    reportFailure('db.write', e, { stage: 'persist' });
  }
}

/**
 * Refresh every box, each on its own; resolves once EVERY box is done, with the flags to hold
 * afterwards (a box missing from it synced). Never rejects.
 */
export async function refreshBoxes(
  accounts: readonly DataBoxAccount[],
  known: Readonly<Record<string, SyncFailure>>,
  deps: RefreshAllDeps,
  signal: AbortSignal,
): Promise<Record<string, SyncFailure>> {
  const results = await Promise.all(
    accounts.map(async account => {
      const refresh = (boxSignal: AbortSignal) =>
        refreshBox(account, known[account.boxId], deps, boxSignal);
      const state = deps.forBox
        ? await deps.forBox(account.boxId, signal, refresh)
        : await refresh(signal);
      return [account.boxId, state] as const;
    }),
  );
  const next: Record<string, SyncFailure> = {};
  for (const [boxId, state] of results) {
    if (state) {
      next[boxId] = state;
    }
  }
  return next;
}
