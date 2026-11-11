// When to tell the person their box's password is about to run out (030 US3). Pure.
//
// Two notifications per box: a week before the day, and the day before, both at 09:00 on the person's
// clock - a week to get round to it, and a last call. They come from the date ISDS reported at the
// person's own last sign-in (`GetPasswordInfo`), and the OS holds the timer: nothing here, or in the
// notifier that schedules them, talks to ISDS (014; 010 FR-010 as amended by 030 FR-007).
//
// Not for Mobile Key boxes: they sign in without the password, so its expiry does not lock them out
// of anything the app does.

import type { DataBoxAccount } from '../../../services/isds/types';
import type { PasswordNudge } from '../../../services/notifications/notifications';

/** Days before the expiry day each notification fires, in the order of `PasswordNudge.timers`. */
export const NUDGE_DAYS_BEFORE = { weekBefore: 7, dayBefore: 1 } as const;
/** The hour, on the person's clock, both fire at. */
export const NUDGE_HOUR = 9;

/** Every scheduled nudge's notification id starts with this, so the set can be reconciled. */
export const PASSWORD_NUDGE_PREFIX = 'pwd-nudge:';

export function passwordNudgeIds(boxId: string): { weekBefore: string; dayBefore: string } {
  return {
    weekBefore: `${PASSWORD_NUDGE_PREFIX}${boxId}:7`,
    dayBefore: `${PASSWORD_NUDGE_PREFIX}${boxId}:1`,
  };
}

/** 09:00 local, `days` calendar days before the day `expiresAt` falls on. */
function morningBefore(expiresAt: number, days: number): number {
  const d = new Date(expiresAt);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - days, NUDGE_HOUR).getTime();
}

/** Both moments, each null when it has passed or would come after the password already ran out. */
export function nudgeTimers(
  expiresAt: number,
  now: number,
): PasswordNudge['timers'] {
  const at = (days: number) => {
    const moment = morningBefore(expiresAt, days);
    return moment > now && moment < expiresAt ? moment : null;
  };
  return {
    weekBefore: at(NUDGE_DAYS_BEFORE.weekBefore),
    dayBefore: at(NUDGE_DAYS_BEFORE.dayBefore),
  };
}

/** The nudges the boxes call for right now: one entry per box with at least one moment still ahead. */
export function passwordNudges(
  accounts: readonly Pick<
    DataBoxAccount,
    'boxId' | 'alias' | 'label' | 'authMethod' | 'passwordExpiresAt'
  >[],
  now: number,
): PasswordNudge[] {
  const out: PasswordNudge[] = [];
  for (const a of accounts) {
    const expiresAt = a.passwordExpiresAt;
    if (a.authMethod === 'mobile_key' || expiresAt == null || !Number.isFinite(expiresAt)) {
      continue;
    }
    const timers = nudgeTimers(expiresAt, now);
    if (timers.weekBefore == null && timers.dayBefore == null) {
      continue;
    }
    out.push({ boxId: a.boxId, boxName: a.alias ?? a.label, expiresAt, timers });
  }
  return out;
}
