// When the password-expiry notifications fire (030 US3).

import {
  NUDGE_HOUR,
  nudgeTimers,
  passwordNudges,
} from '../../src/features/accounts/state/passwordNudge';

const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const EXPIRES = at(2027, 2, 9, 9, 49);

describe('nudgeTimers', () => {
  it('fires at 09:00 a week before and a day before the day the password runs out', () => {
    expect(nudgeTimers(EXPIRES, at(2026, 11, 11))).toEqual({
      weekBefore: at(2027, 2, 2, NUDGE_HOUR),
      dayBefore: at(2027, 2, 8, NUDGE_HOUR),
    });
  });

  it('drops a moment that has passed', () => {
    expect(nudgeTimers(EXPIRES, at(2027, 2, 5))).toEqual({
      weekBefore: null,
      dayBefore: at(2027, 2, 8, NUDGE_HOUR),
    });
    expect(nudgeTimers(EXPIRES, at(2027, 2, 8, 10))).toEqual({ weekBefore: null, dayBefore: null });
  });
});

describe('passwordNudges', () => {
  const box = {
    boxId: 'b1',
    alias: null,
    label: 'Jan Novák',
    authMethod: 'password' as const,
    passwordExpiresAt: EXPIRES,
  };
  const now = at(2026, 11, 11);

  it('names the box as the person named it', () => {
    expect(passwordNudges([{ ...box, alias: 'Živnost' }], now)[0].boxName).toBe('Živnost');
    expect(passwordNudges([box], now)[0]).toMatchObject({ boxId: 'b1', boxName: 'Jan Novák', expiresAt: EXPIRES });
  });

  it('covers an SMS-code box too, which changes it on the portal', () => {
    expect(passwordNudges([{ ...box, authMethod: 'otp_totp' }], now)).toHaveLength(1);
  });

  it('leaves out a Mobile Key box, a box with no date, and one with nothing ahead', () => {
    expect(
      passwordNudges(
        [
          { ...box, boxId: 'mk', authMethod: 'mobile_key' },
          { ...box, boxId: 'none', passwordExpiresAt: null },
          { ...box, boxId: 'past', passwordExpiresAt: at(2026, 11, 1) },
        ],
        now,
      ),
    ).toEqual([]);
  });
});
