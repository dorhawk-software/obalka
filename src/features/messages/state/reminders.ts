// User-set deadline reminders (feature 010, cycle 1). Pure domain - no I/O, no storage, no OS calls.
// The store lives in `src/services/db/remindersStore.ts` and the scheduling in the notifier; this file
// only knows what a reminder IS and how to name its timers.
//
// A reminder is the user's own note to themselves, which is why it differs from the fikce deadline in
// two ways that look like inconsistencies and are not:
//
//   * It is stored per message and OUTLIVES the message content. ISDS erases at 90 days (state 9) and
//     the local archive keeps its own copy; the reminder belongs to neither and survives both.
//   * Its day is the USER'S day, not a Czech legal day. `fikce.ts` computes in Europe/Prague because a
//     fiction date is a legal fact about the Czech calendar; a reminder set for the 22nd by someone in
//     Berlin means their 22nd. Using Prague time here would be a category error dressed up as
//     consistency (spec 010, research D4).

/** A user-set (or, from cycle 2, scan-suggested and accepted) deadline on one message. */
export interface Reminder {
  boxId: string;
  messageId: string;
  /** Epoch ms at 00:00 device-local on the chosen day. The DAY is the datum; times are derived. */
  date: number;
  /**
   * How it got here. `'scan'` is unused until cycle 2's on-device attachment scanning - it exists now
   * so accepting an estimate needs no migration.
   */
  createdBy: 'user' | 'scan';
  createdAt: number;
}

/** The two OS notification identifiers for a reminder. */
export interface ReminderNotificationIds {
  /** Fires the day before the date. */
  dayBefore: string;
  /** Fires on the date itself. */
  onDay: string;
}

/**
 * The notification IDs for a reminder, derived from the message it belongs to.
 *
 * DERIVED, never stored - that is the point. Storage holds only `{boxId, messageId, date}`, so:
 *
 *   * cancelling needs no stored handle (remove the reminder, cancel these two IDs);
 *   * rescheduling is "cancel both, create both" rather than a diff;
 *   * scheduling is IDEMPOTENT, because creating a trigger with an existing ID replaces it. That
 *     matters for the re-arm-on-launch fallback: if a WorkManager trigger turns out not to survive a
 *     reboot, re-arming every stored reminder at startup is safe to run unconditionally, where stored
 *     IDs would have duplicated every notification.
 *
 * A stored `notificationId` column, as 010's original Key Entities proposed, can also drift out of
 * sync with the OS's own state; a derived one cannot.
 */
export function reminderNotificationIds(
  boxId: string,
  messageId: string,
): ReminderNotificationIds {
  return {
    dayBefore: `rem:${boxId}:${messageId}:d1`,
    onDay: `rem:${boxId}:${messageId}:d0`,
  };
}

/** The two instants a reminder fires at, plus the ids they are scheduled under. */
export interface ReminderTimers {
  /** Epoch ms for the day-before notification, or null if that moment has passed. */
  dayBefore: number | null;
  /** Epoch ms for the on-the-day notification, or null if that moment has passed. */
  onDay: number | null;
  ids: ReminderNotificationIds;
}

/** Reminders fire at 09:00 in the user's OWN timezone - see the header for why not Prague. */
const REMINDER_HOUR = 9;

/** 09:00 device-local on the calendar day `epochMs` falls in. */
function nineAmLocalOn(epochMs: number): number {
  const d = new Date(epochMs);
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    REMINDER_HOUR,
    0,
    0,
    0,
  ).getTime();
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * When a reminder should fire, derived from its date - nothing here is stored.
 *
 * Two notifications: the day before ("zítra") and on the day ("dnes"). A deadline you are told about
 * only on the morning it lands is a deadline you have already half-missed.
 *
 * A timer whose moment has already passed comes back `null` rather than being scheduled for the past:
 * a reminder set for this afternoon yields no day-before timer, and one set for today after 09:00
 * yields neither. That is a chip with no pending notification, which is the correct degradation -
 * firing immediately for a moment that has gone would be noise, and refusing the reminder outright
 * would lose the user's own note.
 */
/**
 * Which of the two notifications a date will actually get - and therefore what the picker is allowed
 * to promise.
 *
 * The sheet said "Upozorníme vás den předem a v den termínu" for every date, including ones where
 * `reminderTimers` schedules one notification or none: a deadline set for TOMORROW after 09:00 has
 * no day-before moment left, and one set for TODAY after 09:00 has neither. The picker's own "Konec
 * měsíce" preset resolves to today on the last day of a month.
 *
 * Pure arithmetic on the same rule the scheduler uses, so the promise cannot drift from the schedule.
 */
export function reminderPromise(
  date: number | null,
  now: number,
): 'both' | 'onDay' | 'none' {
  if (date == null || !Number.isFinite(date)) {
    return 'both'; // nothing chosen yet - the sheet describes the feature, not a date
  }
  const { dayBefore, onDay } = reminderTimers(date, now, '', '');
  if (dayBefore != null && onDay != null) {
    return 'both';
  }
  return onDay != null ? 'onDay' : 'none';
}

export function reminderTimers(
  date: number,
  now: number,
  boxId: string,
  messageId: string,
): ReminderTimers {
  const ids = reminderNotificationIds(boxId, messageId);
  if (!Number.isFinite(date)) {
    return { dayBefore: null, onDay: null, ids };
  }
  const onDay = nineAmLocalOn(date);
  const dayBefore = nineAmLocalOn(date - DAY_MS);
  return {
    dayBefore: dayBefore > now ? dayBefore : null,
    onDay: onDay > now ? onDay : null,
    ids,
  };
}
