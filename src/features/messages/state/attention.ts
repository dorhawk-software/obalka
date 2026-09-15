// "Vyžaduje pozornost" - which messages need looking at (feature 010 US1). PURE: no I/O, no storage,
// `now` is an argument. That is what makes the whole story testable without a device, and it is why
// US1 ships before the notification library exists.
//
// WHAT THIS GROUP IS, AND WHAT IT DELIBERATELY IS NOT.
//
// 010 originally specified this as a delivery-fiction countdown over unopened received messages -
// "Doručení fikcí za N dní", escalating red → amber → gold. That cannot be built. Fetching the
// received list is itself what serves a message under §17(3), so by the time any inbox row exists its
// message is in state 6 and the clock has stopped; 013 §6 established this and moved the countdown to
// SENT messages, where it genuinely runs (`fikce.ts`).
//
// The replacement is not a consolation prize. BECAUSE listing serves the message, `state === 6` means
// exactly "the legal clock is already running and you have not read this" - which is the population
// the original story was trying to protect, reached by the one route the law leaves open. After 014
// the app also no longer syncs in the background, so this group is the first thing a user sees on
// opening the app: the closest honest answer to "what happened while I was away".
//
// Three feeds, in descending order of how much they mean:
//
//   `reminder`  - a date the user set themselves (US2). Actionable: there is still something to hit.
//   `estimate`  - a date found in an attachment and accepted (US3, cycle 2). Present in the type from
//                 the start so cycle 2 adds a source rather than a rewrite.
//   `fiction`   - ALREADY served by fiction (state 5). 013 put this here and it stays: a legal clock
//                 started while the app went unopened, and the user could not have known. There is
//                 nothing left to hurry for, which is why it sorts BELOW dated items - those still
//                 have a deadline to meet - but above plain unread, because it is the one entry the
//                 user had no way of seeing coming.
//   `unread`    - served but not opened. No date, so it sorts last.

import type { MessageEnvelope } from '../../../services/isds/types';
import { servedByFiction } from './fikce';
import { isUnread } from './messagesController';
import { MESSAGE_STATE_DELIVERED } from './messageState';
import type { Reminder } from './reminders';
import { reportFailure } from '../../../services/telemetry/telemetry';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Why a message is in the group, strongest first. A dated reason always wins over the rest. */
export type AttentionReason = 'reminder' | 'estimate' | 'fiction' | 'unread';

export interface AttentionEntry {
  messageId: string;
  reason: AttentionReason;
  /** The reminder/estimate date (epoch ms), or null for `unread`. */
  date: number | null;
  /** Whole days from `now` to `date`; NEGATIVE when overdue. Null for `unread`. */
  daysRemaining: number | null;
}

const isUsableDate = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);

/**
 * Whole days between two instants, by the device's own calendar.
 *
 * Device-local on purpose: a reminder is the user's note to themselves, so "in 2 days" must mean two
 * of THEIR days. `fikce.ts` deliberately does the opposite and counts in Europe/Prague, because a
 * fiction date is a fact about the Czech calendar rather than about the user (010 research D4).
 */
export function attentionDaysRemaining(date: number, now: number): number {
  return localDayIndex(date) - localDayIndex(now);
}

function localDayIndex(epochMs: number): number {
  const d = new Date(epochMs);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS;
}

/**
 * The attention group for one box, already ordered: dated entries by date ascending (soonest first),
 * then undated unread by delivery time descending (newest first).
 *
 * Returns `[]` when nothing qualifies - the caller MUST then render no header at all. An attention
 * section that is usually empty teaches people to skip the one that is not (010 FR-002).
 *
 * Crash-safe by contract (Principle II): a garbled envelope or a nonsense date drops that entry, and
 * never throws into the render path.
 */
export function attentionEntries(
  envelopes: readonly MessageEnvelope[],
  reminders: readonly Reminder[],
  now: number,
): AttentionEntry[] {
  try {
    const dated = new Map<string, Reminder>();
    for (const r of reminders) {
      if (r && typeof r.messageId === 'string' && isUsableDate(r.date)) {
        dated.set(r.messageId, r);
      }
    }

    const today = localDayIndex(now);
    const entries: AttentionEntry[] = [];
    // Kept alongside each entry so ordering never has to look the envelope up again.
    const deliveredAt = new Map<string, number>();

    for (const m of envelopes) {
      if (!m || typeof m.id !== 'string') {
        continue;
      }
      const reminder = dated.get(m.id);
      if (reminder) {
        entries.push({
          messageId: m.id,
          // Cycle 2 will pass `createdBy: 'scan'` through as `estimate`; until then every stored
          // reminder is the user's own.
          reason: reminder.createdBy === 'scan' ? 'estimate' : 'reminder',
          date: reminder.date,
          daysRemaining: localDayIndex(reminder.date) - today,
        });
        continue;
      }
      // Served by fiction: a distinct, stronger reason than "unread", even though a state-5 message
      // is also unread. "Nobody signed for this, so the law did" is not the same news as "you have
      // not opened this yet", and collapsing the two would lose the only part the user could not
      // have anticipated.
      if (servedByFiction(m) != null) {
        entries.push({
          messageId: m.id,
          reason: 'fiction',
          date: null,
          daysRemaining: null,
        });
        deliveredAt.set(m.id, isUsableDate(m.acceptanceTime) ? m.acceptanceTime : 0);
        continue;
      }
      // `isUnread` is `state < 7`, which also catches 1–3. Those are SENDER-side states and cannot
      // occur on a received row - but if a garbled envelope claims one, the safe reading is "this has
      // not reached you", not "you owe something on it". Same instinct as `messageStateKind` refusing
      // to infer a legally significant outcome from a value it does not recognise.
      // `openedAt` is the user's own act, recorded on this device. `state` stays the server's
      // truth - the app never claims a delivery it has not been told - but this group is about what
      // still wants the user's attention, and a message they have read does not. Reconciled by the
      // next successful sync like everything else. Fiction and dated entries above are NOT filtered
      // this way: those are about a legal clock, not about having looked.
      if (isUsableDate(m.openedAt)) {
        continue;
      }
      if (m.state >= MESSAGE_STATE_DELIVERED && isUnread(m.state)) {
        entries.push({
          messageId: m.id,
          reason: 'unread',
          date: null,
          daysRemaining: null,
        });
        deliveredAt.set(m.id, isUsableDate(m.deliveryTime) ? m.deliveryTime : 0);
      }
    }

    return entries.sort((a, b) => {
      // Dated before undated.
      if (a.date != null && b.date == null) {
        return -1;
      }
      if (a.date == null && b.date != null) {
        return 1;
      }
      if (a.date != null && b.date != null) {
        return a.date - b.date; // soonest deadline first, overdue ones ahead of everything
      }
      // Undated: fiction above plain unread, then newest first within each.
      if (a.reason !== b.reason) {
        if (a.reason === 'fiction') {
          return -1;
        }
        if (b.reason === 'fiction') {
          return 1;
        }
      }
      return (
        (deliveredAt.get(b.messageId) ?? 0) - (deliveredAt.get(a.messageId) ?? 0)
      ); // newest first
    });
  } catch (e) {
    // An empty group is indistinguishable from "nothing needs attention", which is the one answer
    // this feature must never give wrongly.
    reportFailure('db.read', e, { stage: 'parse' });
    return []; // never break the inbox over a deadline chip
  }
}

/**
 * How many plain-unread rows the group will carry, beyond everything dated or fiction-served.
 *
 * FR-001 makes every unread message ELIGIBLE for this group, and that rule is right: an unopened
 * message has already been served, so it is genuinely something the user has not dealt with. What it
 * does not settle is how many of them the group should SHOW. Unbounded, the answer is "all of them" -
 * and on a first sync, or after a fortnight away, that is the whole inbox. The block then swallows
 * the date sections below it and its oversized numeral reads "38", which is not attention, it is a
 * message count.
 *
 * This file already argues the principle in its own header: "An attention section that is usually
 * empty teaches people to skip the one that is not." A section that is always full teaches exactly
 * the same skip. So dated items and fiction-served ones are never dropped - those are the entries
 * the group exists for - and plain unread is capped. The remainder is not hidden: it falls through
 * to the ordinary date sections, where unread mail was always going to be legible anyway.
 */
export const MAX_UNREAD_SHOWN = 3;

/** What the group is actually made of - so the screen can say, rather than print a fixed legend. */
export interface AttentionSummary {
  /** User-set reminders and accepted scan estimates, counted together: both are dates to meet. */
  dated: number;
  /** Overdue subset of `dated`. */
  overdue: number;
  /** Already served by fiction. */
  fiction: number;
  /** Served but unopened, with no date - after the cap. */
  unread: number;
  /** Plain-unread entries the cap left out. They appear in the date sections instead. */
  unreadBeyondCap: number;
}

/**
 * Trim the group to what it can honestly present, and describe what is left.
 *
 * Kept separate from `attentionEntries` so the membership rule (FR-001) and the presentation rule
 * stay two different decisions, testable apart. `attentionEntries` still answers "what qualifies";
 * this answers "what does the block show, and what does its subtitle say".
 */
export function summarizeAttention(entries: readonly AttentionEntry[]): {
  shown: AttentionEntry[];
  summary: AttentionSummary;
} {
  const dated = entries.filter(e => e.date != null);
  const fiction = entries.filter(e => e.reason === 'fiction');
  const unread = entries.filter(e => e.reason === 'unread');
  const keptUnread = unread.slice(0, MAX_UNREAD_SHOWN);
  // `entries` is already sorted; filtering preserves that order, so re-concatenating in the same
  // three groups keeps the sort rather than re-deriving it.
  const shown = entries.filter(
    e => e.date != null || e.reason === 'fiction' || keptUnread.includes(e),
  );
  return {
    shown,
    summary: {
      dated: dated.length,
      overdue: dated.filter(e => (e.daysRemaining ?? 0) < 0).length,
      fiction: fiction.length,
      unread: keptUnread.length,
      unreadBeyondCap: unread.length - keptUnread.length,
    },
  };
}
