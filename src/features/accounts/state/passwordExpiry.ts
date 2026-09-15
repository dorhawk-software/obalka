// When a box's password runs out (001 T041).
//
// ISDS passwords expire - 90 days is the usual term - and when one does, that box simply stops
// signing in. The app has known the date all along: `GetPasswordInfo` returns it at login and it is
// stored on the account row. It was never shown to anyone. `box.passwordExpires` ("Platnost hesla
// do") has been sitting in both locales as a dead string.
//
// Pure, and calendar-based rather than millisecond-based: "expires in 3 days" has to mean three
// sleeps, not 72 hours. The day is the USER'S day (device timezone) for the same reason a reminder's
// is - see `reminders.ts`, which makes the same choice and explains why using Prague time for
// something that is not a legal deadline would be a category error dressed up as consistency.

import type { DataBoxAccount } from '../../../services/isds/types';

export type PasswordExpiry =
  | { kind: 'none' }
  /** Runs out today - still usable, but this is the last day to act. */
  | { kind: 'today'; date: number }
  | { kind: 'soon'; days: number; date: number }
  /** Already past. Sign-in for this box will fail, if it has not already. */
  | { kind: 'expired'; date: number };

/**
 * How early to start saying so.
 *
 * Two weeks out of a ninety-day term: long enough to act around a weekend or a holiday, short enough
 * that the notice is not part of the furniture for the other seventy-six days. A warning shown for
 * most of the cycle is one nobody reads on the day it matters.
 */
export const WARN_DAYS = 14;

/** Midnight device-local on the calendar day `epochMs` falls in. */
function startOfDay(epochMs: number): number {
  const d = new Date(epochMs);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * What to say about this box's password, if anything.
 *
 * `now` is passed rather than read so this is testable without a clock. A null date means ISDS never
 * told us - for a Mobile Key box it may never do - and silence is the only honest answer to that.
 */
export function passwordExpiry(
  passwordExpiresAt: number | null | undefined,
  now: number,
): PasswordExpiry {
  if (passwordExpiresAt == null || !Number.isFinite(passwordExpiresAt)) {
    return { kind: 'none' };
  }
  const days = Math.round(
    (startOfDay(passwordExpiresAt) - startOfDay(now)) / DAY_MS,
  );
  if (days < 0) {
    return { kind: 'expired', date: passwordExpiresAt };
  }
  if (days === 0) {
    return { kind: 'today', date: passwordExpiresAt };
  }
  if (days <= WARN_DAYS) {
    return { kind: 'soon', days, date: passwordExpiresAt };
  }
  return { kind: 'none' };
}

/**
 * Was this box most likely refused because its password EXPIRED, rather than because it is wrong?
 * (001 FR-009)
 *
 * ISDS has never been seen telling the app. No response to an expired password has been captured, so
 * the app assumes it is refused with the same auth fault as a wrong one, and maps no status code for
 * it (`interpretOwnerInfo` in `isdsTransport.ts` says why). What the app does have is the date: `GetPasswordInfo` reports it at every sign-in and it is stored
 * on the account row. A refusal after that date is an expired password, and telling that user "wrong
 * credentials" sends them to retype a password that cannot work until it is changed on the portal.
 *
 * Only meaningful AFTER an auth fault - the date on its own is the warning above, not a failure - and
 * only as good as the stored date. A password changed on the portal before that date is still called
 * invalid credentials here; one changed after it and then mistyped is still called expired. The copy
 * that renders this verdict is worded for both.
 *
 * Milliseconds, deliberately unlike `passwordExpiry`: the warning counts sleeps, but this asks about
 * one moment. A password that ran out at 08:30 is expired at 09:00 the same day, which the calendar
 * view would still call "today".
 *
 * PASSWORD boxes only. A cookie box's refusal means its session ended - far more common than a
 * password running out - so an old date on its row is not evidence of anything.
 */
export function mustChangePassword(
  account: Pick<DataBoxAccount, 'authMethod' | 'passwordExpiresAt'>,
  now: number,
): boolean {
  const expiresAt = account.passwordExpiresAt;
  if (
    account.authMethod !== 'password' ||
    expiresAt == null ||
    !Number.isFinite(expiresAt)
  ) {
    return false; // an unknown date is silence, never a guess
  }
  return expiresAt <= now;
}

/**
 * Was the refusal this box is recovering from an expired password? One answer for the switcher row
 * and the re-auth screen (001 FR-009).
 *
 * The verdict stored with the refusal wins: `syncError`, decided by `classifyFailure` at the moment
 * ISDS refused, which is what the switcher row shows. The re-auth screen used to re-derive it from the
 * clock, and the two disagreed. A box refused BEFORE its stored date is flagged `reauth` and its row
 * says "Přihlášení vypršelo"; once the date had passed, the screen for that same box said the
 * password had expired and sent the user to the portal to change a password that had most likely
 * just been changed there - which is why it was refused while still in date.
 *
 * Only a box with no stored refusal is judged at `now`: one sent to sign in by the inbox's own sync,
 * which keeps its verdict on screen rather than on the row. `now` is the moment of that refusal
 * (`refusedAt` in `MessageList.tsx`) on the strip AND on the re-auth screen the strip opens, which is
 * handed the same moment. Judged when the screen opened, a refusal just before the date and a tap just
 * after it read "sign in again" on the one and "change it on the portal" on the other.
 */
export function refusedForExpiredPassword(
  account: Pick<DataBoxAccount, 'authMethod' | 'passwordExpiresAt' | 'syncError'>,
  now: number,
): boolean {
  if (account.syncError === 'passwordExpired') {
    return true;
  }
  if (account.syncError === 'reauth') {
    return false;
  }
  return mustChangePassword(account, now);
}
