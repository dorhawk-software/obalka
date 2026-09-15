// What the OTHER boxes need you to know, without opening them.
//
// The gap this fills was reported plainly: a production box held an unread message and "it is not
// known until you go into the boxes detail". The counts existed, the attention machinery existed,
// and neither reached the one screen the user was actually looking at.
//
// READS THE LOCAL ARCHIVE ONLY. Not a policy compromise, just what the data is: every number here
// comes from the last sync that succeeded, which is exactly what the switcher's badge already shows.
// Nothing in this module can start a network call, so it cannot deliver anybody's mail (17/3) and it
// costs nothing to render on a screen the user opens constantly.
//
// The counts are deliberately taken from `account.unreadCount` rather than recounted from the cache.
// Both derive from the same successful sync, so they would agree - but "would agree" is how two
// numbers drift. One source means the card and the switcher badge can never contradict each other,
// which matters more here than anywhere: they are frequently on screen at the same time.

import type { DataBoxAccount, SyncFailure, MessageEnvelope } from '../../../services/isds/types';
import type { Reminder } from './reminders';
import { attentionEntries, type AttentionReason } from './attention';

/**
 * A dated thing in a box: a user reminder or an accepted scan estimate.
 *
 * Only those two, and the type says so. A received message served by fiction has no date left to
 * count down - listing is what serves mail (013 established this), so by the time the archive holds
 * a fiction-served row its clock has already run. Dressing it up as a deadline here would have it
 * sort and read as "overdue", which is a different and false claim; it is counted in `fiction`.
 */
export interface SoonestDeadline {
  reason: Extract<AttentionReason, 'reminder' | 'estimate'>;
  date: number;
  /** Whole days from now. NEGATIVE when overdue. */
  daysRemaining: number;
}

export interface BoxAttention {
  boxId: string;
  /** The box's display name, resolved the same way every other surface resolves it. */
  name: string;
  unread: number;
  /**
   * The nearest dated thing, overdue ones included. This is what ORDERS the boxes: an overdue
   * deadline is the closest thing to hurting you there is. Its day count is as of the moment this
   * was read, which is fine for an order - every box moves by the same day at midnight.
   */
  soonest: SoonestDeadline | null;
  /**
   * When each dated thing in this box is due (epoch ms), soonest first. This is what the line SAYS.
   *
   * Dates, not day counts, because the line is phrased as of the moment it is DRAWN, and this is
   * recomputed only when the accounts or the box change - never when the clock crosses midnight. A
   * count frozen here said "termín zítra" on the morning the deadline was due, beside the inbox's own
   * chips already saying "dnes". And every deadline, not only `soonest`: a box can hold a missed one
   * and one due tomorrow, `soonest` is then the missed one, and which of them has been missed is also
   * a question about that moment.
   */
  deadlines: readonly number[];
  /**
   * Messages served by fiction - the attention group ranks them below dated things and above plain
   * unread.
   *
   * They are ALSO inside `unread`: a state-5 message is unread to ISDS, and `unread` is the switcher
   * badge's own number, counted over the same archive. The sentence therefore takes them out of the
   * unread clause, so one such message never reads as two, and the two clauses still add up to the
   * badge.
   *
   * Counted whether or not the user has opened one here, as the attention group counts them. Opening
   * a message takes it off the badge only once ISDS confirms the read, and that confirmation is also
   * what moves it out of state 5. Until then it is on the badge and still served by fiction, so
   * leaving it out here would print it as plain unread mail.
   */
  fiction: number;
  /** Why this box's last refresh failed, or null when it succeeded. */
  syncError: SyncFailure | null;
  /**
   * True when the numbers above are a memory rather than a reading.
   *
   * A box we cannot currently reach still reports its last known unread count, because hiding it
   * would hide the very thing this card exists to surface. Saying it is stale is what keeps that
   * honest - the same decision the switcher row makes.
   */
  stale: boolean;
  /**
   * True while a refresh of this box is in flight, so its numbers are about to be replaced.
   *
   * Never a reason to report a box on its own (see `hasSomethingToSay`): a refresh starting is
   * transient, and a line that appeared for the length of a refresh and then vanished would move
   * every row below it twice (constitution V).
   */
  refreshing: boolean;
}

/** Boxes with a refresh in flight, each with how many refreshes are fetching it. */
export type InFlight = ReadonlyMap<string, number>;

/** No refresh in flight. One shared instance, so "still nothing" is the same value to React. */
export const NOTHING_IN_FLIGHT: InFlight = new Map();

/**
 * The in-flight map after a refresh of `boxIds` starts (`+1`) or finishes (`-1`).
 *
 * Counted, not flagged, because refreshes overlap: launch fans out to every box, and a pull in `Vše`
 * or a finished re-auth can start another before it returns. With a plain set, whichever finished
 * first would clear the box and the line would stop saying "still refreshing" while the other fetch
 * was still out. A finish that has no matching start is ignored rather than going negative - a
 * count that drifted below zero would swallow the next real start.
 */
export function countInFlight(
  current: InFlight,
  boxIds: readonly string[],
  delta: 1 | -1,
): InFlight {
  const next = new Map(current);
  for (const boxId of boxIds) {
    const count = (next.get(boxId) ?? 0) + delta;
    if (count > 0) {
      next.set(boxId, count);
    } else {
      next.delete(boxId);
    }
  }
  return next.size === 0 ? NOTHING_IN_FLIGHT : next;
}

export interface CrossBoxDeps {
  cachedEnvelopes(boxId: string): Promise<readonly MessageEnvelope[]>;
  reminders(boxId: string): Promise<readonly Reminder[]>;
}

/**
 * A box earns a row only by having something to say. Everything quiet is left out entirely.
 *
 * `refreshing` is deliberately NOT on this list. A quiet box being refreshed has nothing to say yet,
 * and letting it in would make the line appear when a refresh starts and disappear when it ends.
 */
function hasSomethingToSay(b: BoxAttention): boolean {
  return (
    b.unread > 0 ||
    b.soonest !== null ||
    b.fiction > 0 ||
    b.syncError !== null
  );
}

/**
 * Order: what is closest to hurting you, first.
 *
 * Dated things outrank undated ones because a deadline is the only item here with a clock on it, and
 * an overdue one (negative `daysRemaining`) sorts to the very top. Then a box holding mail served by
 * fiction - the same place the attention group gives it (`attention.ts`): nothing left to hurry
 * for, but the one thing the user could not have seen coming. Below that, more unread beats less. A
 * box whose only news is that it stopped syncing sits last: it is worth knowing and it is not
 * urgent, and putting it above a deadline would be the tail wagging the dog.
 */
export function compareBoxAttention(a: BoxAttention, b: BoxAttention): number {
  if (a.soonest && b.soonest) {
    if (a.soonest.daysRemaining !== b.soonest.daysRemaining) {
      return a.soonest.daysRemaining - b.soonest.daysRemaining;
    }
  } else if (a.soonest || b.soonest) {
    return a.soonest ? -1 : 1;
  }
  if (a.fiction > 0 !== b.fiction > 0) {
    return a.fiction > 0 ? -1 : 1;
  }
  if (a.unread !== b.unread) {
    return b.unread - a.unread;
  }
  // Stable and predictable when everything else ties: a card whose rows reshuffle between renders
  // is a card people stop trusting.
  return a.name.localeCompare(b.name, 'cs');
}

/**
 * What every box other than `exceptBoxId` currently wants to tell you.
 *
 * `exceptBoxId` is the box already on screen: its own attention group is right there, and repeating
 * it in a card headed "in your other boxes" would be both wrong and confusing. Pass `null` to
 * summarise every box, which is what a merged view would want.
 *
 * `inFlight` is the boxes a refresh is fetching right now. It marks rows; it never adds one.
 */
export async function crossBoxAttention(
  accounts: readonly DataBoxAccount[],
  exceptBoxId: string | null,
  deps: CrossBoxDeps,
  now: number,
  inFlight: InFlight = NOTHING_IN_FLIGHT,
): Promise<BoxAttention[]> {
  const others = accounts.filter(a => a && a.boxId && a.boxId !== exceptBoxId);
  const rows = await Promise.all(
    others.map(async account => {
      let soonest: SoonestDeadline | null = null;
      const deadlines: number[] = [];
      let fiction = 0;
      try {
        const [envelopes, reminders] = await Promise.all([
          deps.cachedEnvelopes(account.boxId),
          deps.reminders(account.boxId),
        ]);
        // Already ordered, dated entries soonest first - so `deadlines` is too.
        for (const entry of attentionEntries(envelopes, reminders, now)) {
          if (entry.reason === 'fiction') {
            fiction += 1; // opened or not - see `BoxAttention.fiction`
            continue;
          }
          if (
            entry.reason === 'unread' ||
            entry.date == null ||
            entry.daysRemaining == null
          ) {
            continue; // a plain unread row: counted below, never a deadline
          }
          deadlines.push(entry.date);
          if (soonest === null || entry.daysRemaining < soonest.daysRemaining) {
            soonest = {
              reason: entry.reason,
              date: entry.date,
              daysRemaining: entry.daysRemaining,
            };
          }
        }
      } catch {
        // One unreadable box must not blank the card for the rest. Its unread count and sync state
        // below come from the account record, which is already in memory, so the row survives with
        // less to say rather than vanishing.
      }
      return {
        boxId: account.boxId,
        name: account.alias ?? account.label,
        unread: account.unreadCount ?? 0,
        soonest,
        deadlines,
        fiction,
        syncError: account.syncError,
        stale: account.syncError !== null,
        refreshing: inFlight.has(account.boxId),
      };
    }),
  );
  return rows.filter(hasSomethingToSay).sort(compareBoxAttention);
}
