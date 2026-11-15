// The app's one way of writing a date and a time (031 T050, the owner 2026-11-15).
//
// Czech takes the standard's form (ČSN 01 6910): the day and the month each followed by a full stop and
// a space, the month without a leading zero - "12. 11. 2026", "29. 8." - and the hour without one,
// "9:20". The spaces inside a date are non-breaking, so a date never wraps in two. English writes the
// day, the month's short name and the year - "12 Nov 2026", "29 Aug" - which no reader takes for
// 11 December.
//
// Until 2026-11-15 six screens each padded their own "13.11.2026 09:20" and the term picker and the
// password expiry wrote the spaced form. Every date and time a person reads goes through here; file
// names keep their sortable ISO stamps (`portable.ts`, `debugBundle.ts`).

import { getActiveLocale } from './activeLocale';

const NBSP = ' ';
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The day and the month: "29. 8.", "29 Aug" - a row of this year, the postmark. */
export function shortDate(epochMs: number): string {
  const d = new Date(epochMs);
  return getActiveLocale() === 'en'
    ? `${d.getDate()}${NBSP}${EN_MONTHS[d.getMonth()]}`
    : `${d.getDate()}.${NBSP}${d.getMonth() + 1}.`;
}

/** The whole date: "12. 11. 2026", "12 Nov 2026". */
export function fullDate(epochMs: number): string {
  return `${shortDate(epochMs)}${NBSP}${new Date(epochMs).getFullYear()}`;
}

/** The time of day, the hour without its leading zero: "9:20", "14:02". */
export function clock(epochMs: number): string {
  const d = new Date(epochMs);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** The date and the time: "12. 11. 2026 9:20", "12 Nov 2026, 9:20". */
export function dateTime(epochMs: number): string {
  return getActiveLocale() === 'en'
    ? `${fullDate(epochMs)}, ${clock(epochMs)}`
    : `${fullDate(epochMs)} ${clock(epochMs)}`;
}
