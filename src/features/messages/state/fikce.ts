// Delivery-fiction ("fikce doručení") signals. Presentation-derived ONLY, from ISDS metadata the app
// already stores (deliveryTime / acceptanceTime / state); NO storage, NO reminders, NO document
// scanning (those are spec 010). Crash-safe: bad/missing input returns null, never throws (Principle
// II). Legal basis: §17 odst. 4 zák. 300/2008 Sb. - a message nobody signs for is deemed delivered on
// the 10th day after it was delivered to the box.
//
// 013 SPLIT THIS IN TWO, and the reason is worth keeping written down.
//
// The old module computed one thing: a countdown to fiction on RECEIVED messages. That countdown can
// essentially never appear. It is only meaningful while a message sits in state 4 (dodána, not yet
// served) - but fetching the received-message list is itself what serves a message (§17 odst. 3), so
// by the time any inbox row exists on screen its message is already in state 6 and its clock has
// stopped. The app cannot observe its own state-4 mail.
//
// What each side CAN see is the mirror image of the other:
//
//   * SENT (`sentFictionCountdown`) - a message we sent that is sitting in the recipient's box in
//     state 4 genuinely is counting down. "They haven't signed for this; in 4 days the law will sign
//     for them" is real, actionable information, and it is the one place a countdown belongs.
//   * RECEIVED (`servedByFiction`) - a message already in state 5 was served by fiction before we
//     ever looked, which happens when the app went unopened for ten days. There is no clock left to
//     run, so this is a NOTICE, not a countdown: it tells the user a deadline started without them.

import { reportFailure } from '../../../services/telemetry/telemetry';

const DAY_MS = 24 * 60 * 60 * 1000;
const FICTION_DAYS = 10;
/**
 * §17(4)'s unit is a CALENDAR DAY, not 24 hours from delivery, and the day in question is a Czech
 * civil day (Europe/Prague) - ISDS runs on Czech time and the deadline is a Czech legal fact. On a
 * device set to another zone the local date can be a day off, which is a day off in a legal deadline.
 *
 * The offset is computed here rather than via `Intl`, on purpose. `Intl` with a named
 * time zone needs ICU data, which a Hermes build may or may not carry, and nothing else in this app
 * uses `Intl` - so we would be relying on a capability we have never exercised, with a silent
 * fallback to device-local time that is wrong by a day for a user abroad. A legal deadline should not
 * depend on which JS engine variant shipped.
 *
 * The rule is fixed EU law (Directive 2000/84/EC, unchanged since 2002) and Czechia has followed it
 * throughout: CET (UTC+1), and CEST (UTC+2) from the last Sunday of March 01:00 UTC to the last
 * Sunday of October 01:00 UTC. If the EU ever abolishes the change, this is the one place to edit.
 */
function lastSundayUtc(year: number, monthIndex: number, utcHour: number): number {
  // Day 0 of the next month is the last day of this one.
  const last = new Date(Date.UTC(year, monthIndex + 1, 0));
  return Date.UTC(
    year,
    monthIndex,
    last.getUTCDate() - last.getUTCDay(),
    utcHour,
  );
}

/** +1 h (CET) or +2 h (CEST) in ms, for the instant given. */
function czechOffsetMs(epochMs: number): number {
  const year = new Date(epochMs).getUTCFullYear();
  const cestFrom = lastSundayUtc(year, 2, 1); // last Sunday in March, 01:00 UTC
  const cestUntil = lastSundayUtc(year, 9, 1); // last Sunday in October, 01:00 UTC
  return (epochMs >= cestFrom && epochMs < cestUntil ? 2 : 1) * 60 * 60 * 1000;
}

/** Whole-day index of `epochMs` in Czech civil time, so two instants subtract as calendar days. */
function czechDayIndex(epochMs: number): number {
  return Math.floor((epochMs + czechOffsetMs(epochMs)) / DAY_MS);
}

/** Whole days until delivery-by-fiction for a message still sitting in the recipient's box. */
export interface FictionCountdown {
  /** 0 = the fiction lands today. Never negative - a lapsed clock yields null instead. */
  daysRemaining: number;
}

export interface CountdownInput {
  /** Epoch ms - when ISDS delivered the message into the recipient's box (`dmDeliveryTime`). */
  deliveryTime: number | null | undefined;
  /** `dmMessageStatus`. Only state 4 is still counting. */
  state?: number | null;
}

/**
 * The countdown for a SENT message the recipient has not signed for yet, or null.
 *
 * COUNTED IN CALENDAR DAYS, from the primary source (verified 2026-08-16). §17 odst. 4 zák.
 * 300/2008 Sb.:
 *
 *   "Nepřihlásí-li se do datové schránky osoba podle odstavce 3 ve lhůtě 10 dnů ODE DNE, kdy byl
 *    dokument dodán do datové schránky, považuje se tento dokument za doručený POSLEDNÍM DNEM této
 *    lhůty."
 *
 * Two things follow, and the old implementation got the second one wrong:
 *
 *   1. The period runs "ode dne" - the delivery day itself is not counted - so the last day is the
 *      10th calendar day after the delivery date.
 *   2. Service happens on that DAY, not at an instant 240 hours after delivery. The previous code
 *      compared `deliveryTime + 10 × 24 h` against `now`, which reported "fikce za 1 den" for most of
 *      the very day the fiction actually landed. Observed on a real czebox message: delivered
 *      16.07. 19:34, still showing "za 1 den" on the morning of 26.07., when it was in fact due that
 *      day. Now it reads 0 ("dnes") for the whole of the last day.
 *
 * NOT applied, deliberately: the weekend/holiday shift to the next working day. §40 odst. 1 písm. c)
 * správního řádu does extend a deadline that lands on a Saturday, Sunday or holiday - but §40 odst. 1
 * opens "Pokud je provedení určitého úkonu v řízení vázáno na lhůtu", i.e. it governs limits for
 * PERFORMING AN ACT in proceedings. §17(4) requires no act: service occurs by operation of law when
 * nobody signs in. On the face of both texts the extension does not reach it. That reading is ours,
 * not a cited authority, so if a working-day rule is ever confirmed this is the one place to change.
 */
export function sentFictionCountdown(
  m: CountdownInput,
  now: number = Date.now(),
): FictionCountdown | null {
  try {
    if (!m || typeof m.deliveryTime !== 'number' || !isFinite(m.deliveryTime)) {
      return null;
    }
    // Only state 4 counts down: below it nothing has been delivered, at/above 5 it is already served.
    if (m.state !== 4) {
      return null;
    }
    // Calendar days, in Czech civil time: the last day of the period is the 10th day after the
    // delivery DATE, and it is the whole of that day.
    const fictionDay = czechDayIndex(m.deliveryTime) + FICTION_DAYS;
    const daysRemaining = fictionDay - czechDayIndex(now);
    if (daysRemaining < 0) {
      return null; // the fiction has already landed; ISDS just hasn't moved the state yet
    }
    return { daysRemaining };
  } catch (e) {
    // A null here removes the 10-day countdown from a message that is still counting down. The user
    // sees no deadline and concludes there is none; the fiction lands anyway. Nothing about that is
    // visible from the outside, which is why a defensive catch around arithmetic gets a report.
    reportFailure('isds.parse', e, { stage: 'parse' });
    return null;
  }
}

/**
 * When a RECEIVED message was served by fiction (epoch ms), or null if it wasn't.
 *
 * State 5 is the whole test - ISDS records the fiction moment in `dmAcceptanceTime`, which is why the
 * timestamp comes back rather than a boolean: the user's deadlines run from THAT day, not from the
 * day they finally opened the app, and the UI has to be able to say so.
 */
export function servedByFiction(m: {
  state?: number | null;
  acceptanceTime?: number | null;
}): number | null {
  try {
    if (!m || m.state !== 5) {
      return null;
    }
    return typeof m.acceptanceTime === 'number' && isFinite(m.acceptanceTime)
      ? m.acceptanceTime
      : null;
  } catch (e) {
    // Same stakes as above: this is the moment the message became legally served, and the user's
    // deadlines run from it.
    reportFailure('isds.parse', e, { stage: 'parse' });
    return null;
  }
}
