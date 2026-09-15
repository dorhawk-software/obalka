// When the app should mention a box's password (001 T041).
//
// The boundaries are the whole feature. "In 3 days" has to mean three sleeps, not 72 hours, or a
// notice appears a day late for someone whose password expires at nine in the morning - which is
// exactly the person it exists for.

import {
  mustChangePassword,
  passwordExpiry,
  refusedForExpiredPassword,
  WARN_DAYS,
} from '../../src/features/accounts/state/passwordExpiry';
import type { AuthMethod } from '../../src/services/isds/types';

/** A fixed afternoon, so "today" is unambiguous. */
const NOW = new Date(2026, 8, 8, 15, 30).getTime();
const atNoon = (y: number, m: number, d: number) =>
  new Date(y, m, d, 12, 0).getTime();

describe('passwordExpiry', () => {
  it('says nothing when ISDS never gave a date', () => {
    expect(passwordExpiry(null, NOW)).toEqual({ kind: 'none' });
    expect(passwordExpiry(undefined, NOW)).toEqual({ kind: 'none' });
    expect(passwordExpiry(NaN, NOW)).toEqual({ kind: 'none' });
  });

  it('says nothing while the date is comfortably away', () => {
    expect(passwordExpiry(atNoon(2026, 10, 30), NOW).kind).toBe('none');
    // The day after the warning window opens is still silence.
    expect(
      passwordExpiry(atNoon(2026, 8, 8 + WARN_DAYS + 1), NOW).kind,
    ).toBe('none');
  });

  it('starts warning exactly at the window edge', () => {
    const edge = passwordExpiry(atNoon(2026, 8, 8 + WARN_DAYS), NOW);
    expect(edge).toEqual({
      kind: 'soon',
      days: WARN_DAYS,
      date: atNoon(2026, 8, 8 + WARN_DAYS),
    });
  });

  it('counts sleeps, not hours', () => {
    // 09:00 tomorrow is under 18 hours away and is still "tomorrow", not "today".
    const tomorrowMorning = new Date(2026, 8, 9, 9, 0).getTime();
    expect(passwordExpiry(tomorrowMorning, NOW)).toMatchObject({
      kind: 'soon',
      days: 1,
    });
    // …and 23:59 tonight is today, however few minutes are left.
    const lateTonight = new Date(2026, 8, 8, 23, 59).getTime();
    expect(passwordExpiry(lateTonight, NOW).kind).toBe('today');
  });

  it('treats the morning of the expiry day as still today', () => {
    // The clock is 15:30; a date stamped 09:00 the same day has passed in milliseconds but the
    // password is a calendar fact, and the user still has the day.
    const thisMorning = new Date(2026, 8, 8, 9, 0).getTime();
    expect(passwordExpiry(thisMorning, NOW).kind).toBe('today');
  });

  it('reports a date already gone as expired', () => {
    expect(passwordExpiry(atNoon(2026, 8, 7), NOW).kind).toBe('expired');
    expect(passwordExpiry(atNoon(2025, 0, 1), NOW).kind).toBe('expired');
  });
});

// 001 FR-009. The other question the date answers: not "should we warn?" but "was that refusal an
// expired password?" - asked only after ISDS has refused a sign-in.
describe('mustChangePassword', () => {
  const box = (authMethod: AuthMethod, passwordExpiresAt: number | null) => ({
    authMethod,
    passwordExpiresAt,
  });

  it('is true for a password box once its stored date has passed', () => {
    expect(mustChangePassword(box('password', atNoon(2026, 8, 7)), NOW)).toBe(true);
    expect(mustChangePassword(box('password', atNoon(2025, 0, 1)), NOW)).toBe(true);
  });

  it('asks about the moment, not the day - unlike the warning', () => {
    // 09:00 has passed at 15:30. The warning still calls that "today", because it counts sleeps; a
    // refusal at 15:30 is a refusal of a password that has already run out.
    const thisMorning = new Date(2026, 8, 8, 9, 0).getTime();
    expect(passwordExpiry(thisMorning, NOW).kind).toBe('today');
    expect(mustChangePassword(box('password', thisMorning), NOW)).toBe(true);
    // The moment itself counts.
    expect(mustChangePassword(box('password', NOW), NOW)).toBe(true);
  });

  it('is false while the date is still ahead', () => {
    expect(mustChangePassword(box('password', NOW + 1), NOW)).toBe(false);
    const lateTonight = new Date(2026, 8, 8, 23, 59).getTime();
    expect(mustChangePassword(box('password', lateTonight), NOW)).toBe(false);
  });

  it('never guesses from a date ISDS did not give', () => {
    expect(mustChangePassword(box('password', null), NOW)).toBe(false);
    expect(mustChangePassword(box('password', NaN), NOW)).toBe(false);
  });

  it.each(['otp_totp', 'mobile_key'] as const)(
    'is false for %s, whose refusal means a lost session',
    method => {
      expect(mustChangePassword(box(method, atNoon(2026, 8, 7)), NOW)).toBe(false);
    },
  );
});

// The switcher row and the re-auth screen ask the same question and must not answer it twice. The
// verdict stored with the refusal is the answer; the clock only stands in when nothing was stored.
describe('refusedForExpiredPassword', () => {
  const yesterday = atNoon(2026, 8, 7);
  const password = (
    passwordExpiresAt: number | null,
    syncError: 'reauth' | 'passwordExpired' | 'error' | null,
  ) => ({ authMethod: 'password' as const, passwordExpiresAt, syncError });

  it('keeps a refusal that came before the date as "sign in again", once the date has passed', () => {
    // Refused while still in date: most likely a password already changed on the portal. The row
    // says so, and the calendar catching up must not turn it into "expired".
    expect(mustChangePassword(password(yesterday, 'reauth'), NOW)).toBe(true);
    expect(refusedForExpiredPassword(password(yesterday, 'reauth'), NOW)).toBe(false);
  });

  it('keeps a stored expired verdict, whatever the clock says now', () => {
    expect(refusedForExpiredPassword(password(NOW + 86_400_000, 'passwordExpired'), NOW)).toBe(true);
  });

  it('judges at `now` only a box with no refusal stored', () => {
    expect(refusedForExpiredPassword(password(yesterday, null), NOW)).toBe(true);
    expect(refusedForExpiredPassword(password(NOW + 86_400_000, null), NOW)).toBe(false);
    // A transient failure is not a refusal, so it carries no verdict either.
    expect(refusedForExpiredPassword(password(yesterday, 'error'), NOW)).toBe(true);
  });
});
