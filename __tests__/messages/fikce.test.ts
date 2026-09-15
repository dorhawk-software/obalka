import {
  sentFictionCountdown,
  servedByFiction,
} from '../../src/features/messages/state/fikce';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_750_000_000_000; // fixed reference instant (no Date.now flakiness)
const daysAgo = (n: number) => NOW - n * DAY;

describe('sentFictionCountdown - the recipient has not signed for it yet', () => {
  it('delivered 2 days ago, still in state 4 → 8 days remaining', () => {
    expect(
      sentFictionCountdown({ deliveryTime: daysAgo(2), state: 4 }, NOW),
    ).toEqual({ daysRemaining: 8 });
  });

  it('delivered today → the full 10 days', () => {
    expect(sentFictionCountdown({ deliveryTime: NOW, state: 4 }, NOW)).toEqual({
      daysRemaining: 10,
    });
  });

  it('delivered 10 days ago → 0, i.e. the fiction lands today', () => {
    expect(
      sentFictionCountdown({ deliveryTime: daysAgo(10), state: 4 }, NOW),
    ).toEqual({ daysRemaining: 0 });
  });

  it('the clock has already lapsed → null (nothing left to count)', () => {
    expect(
      sentFictionCountdown({ deliveryTime: daysAgo(12), state: 4 }, NOW),
    ).toBeNull();
  });

  // The whole point of the 013 split: only state 4 is still counting. Anything already served has an
  // outcome, and anything below 4 has not reached a box to start counting in.
  it.each([1, 2, 3, 5, 6, 7, 8, 9, 10])(
    'state %i is not counting down → null',
    state => {
      expect(
        sentFictionCountdown({ deliveryTime: daysAgo(2), state }, NOW),
      ).toBeNull();
    },
  );

  // §17(4) counts CALENDAR DAYS and serves the document on the LAST DAY of the period - not at an
  // instant 240 h after delivery. These fixtures are Prague wall-clock instants, and every one of them
  // fails against the old `deliveryTime + 10 × 24 h` arithmetic.
  describe('calendar days, not 240 hours (§17 odst. 4)', () => {
    const DELIVERED_16_07_1934 = 1_784_223_240_000; // 16.07.2026 19:34 CEST - a real czebox message

    it('reads 0 for the WHOLE of the last day, not "1 more day" until 19:34', () => {
      // The observed defect: on the morning of 26.07. the app said "fikce za 1 den" for a message
      // that was in fact served that day.
      expect(
        sentFictionCountdown(
          { deliveryTime: DELIVERED_16_07_1934, state: 4 },
          1_785_049_200_000, // 26.07. 09:00 CEST
        ),
      ).toEqual({ daysRemaining: 0 });
      expect(
        sentFictionCountdown(
          { deliveryTime: DELIVERED_16_07_1934, state: 4 },
          1_785_103_140_000, // 26.07. 23:59 CEST - still the last day
        ),
      ).toEqual({ daysRemaining: 0 });
    });

    it('lapses once the last day is over', () => {
      expect(
        sentFictionCountdown(
          { deliveryTime: DELIVERED_16_07_1934, state: 4 },
          1_785_105_000_000, // 27.07. 00:30 CEST
        ),
      ).toBeNull();
    });

    it('a delivery late at night has spent a day by 20 minutes later', () => {
      // 23:50 → 00:10 is 20 minutes, but it crosses the date line, so one of the ten days is gone.
      expect(
        sentFictionCountdown(
          { deliveryTime: 1_784_238_600_000, state: 4 }, // 16.07. 23:50 CEST
          1_784_239_800_000, // 17.07. 00:10 CEST
        ),
      ).toEqual({ daysRemaining: 9 });
    });

    // The Czech offset is computed by hand (no Intl/ICU dependency), so the two switch instants are
    // pinned directly. EU rule: CEST from the last Sunday of March 01:00 UTC to the last Sunday of
    // October 01:00 UTC. In 2026 that is 29 March and 25 October.
    it('places the CET→CEST boundary exactly (29.03.2026 01:00 UTC)', () => {
      // 00:59:59 UTC is still CET, so Prague reads 01:59 on 29.03. - same calendar day either way,
      // so probe the day BEFORE, where an hour's error would cross midnight.
      const beforeSwitch = Date.UTC(2026, 2, 29, 0, 59, 59); // 01:59:59 CET
      const afterSwitch = Date.UTC(2026, 2, 29, 1, 0, 0); // 03:00:00 CEST
      // Delivered 10 days earlier by the Prague calendar in each case → both land on their own day.
      expect(
        sentFictionCountdown(
          { deliveryTime: beforeSwitch - 10 * DAY, state: 4 },
          beforeSwitch,
        ),
      ).toEqual({ daysRemaining: 0 });
      expect(
        sentFictionCountdown(
          { deliveryTime: afterSwitch - 10 * DAY, state: 4 },
          afterSwitch,
        ),
      ).toEqual({ daysRemaining: 0 });
    });

    it('treats 23:30 UTC in summer as the NEXT Prague day', () => {
      // 23:30 UTC = 01:30 CEST tomorrow. A UTC-based day index would be a day out here.
      const deliveredLateUtc = Date.UTC(2026, 6, 16, 23, 30); // 17.07. 01:30 CEST
      // Ten Prague days later is 27.07.; on 26.07. midday there is still 1 day left.
      expect(
        sentFictionCountdown(
          { deliveryTime: deliveredLateUtc, state: 4 },
          Date.UTC(2026, 6, 26, 10, 0), // 26.07. 12:00 CEST
        ),
      ).toEqual({ daysRemaining: 1 });
    });

    it('is unaffected by the spring DST change', () => {
      // 19.03. (CET) + 10 days = 29.03., the day Czechia loses an hour. Counting hours would drift.
      expect(
        sentFictionCountdown(
          { deliveryTime: 1_773_910_800_000, state: 4 }, // 19.03.2026 10:00 CET
          1_774_774_800_000, // 29.03.2026 10:00 CEST
        ),
      ).toEqual({ daysRemaining: 0 });
    });
  });

  it('crash-safe: missing / garbled input → null, never throws', () => {
    expect(sentFictionCountdown({ deliveryTime: null, state: 4 }, NOW)).toBeNull();
    expect(
      sentFictionCountdown({ deliveryTime: undefined, state: 4 }, NOW),
    ).toBeNull();
    expect(sentFictionCountdown({ deliveryTime: NaN, state: 4 }, NOW)).toBeNull();
    // @ts-expect-error - exercising a totally malformed input
    expect(sentFictionCountdown(null, NOW)).toBeNull();
  });
});

describe('servedByFiction - a received message served while nobody looked', () => {
  it('state 5 returns the acceptance moment, not a boolean', () => {
    // The date is load-bearing: the user's deadlines run from the day the fiction landed, not from
    // the day they finally opened the app, so the UI has to be able to print it.
    expect(servedByFiction({ state: 5, acceptanceTime: daysAgo(3) })).toBe(
      daysAgo(3),
    );
  });

  it('state 6 (served by an actual sign-in) is NOT fiction', () => {
    expect(servedByFiction({ state: 6, acceptanceTime: daysAgo(3) })).toBeNull();
  });

  it.each([1, 2, 3, 4, 6, 7, 8, 9, 10])('state %i → null', state => {
    expect(servedByFiction({ state, acceptanceTime: daysAgo(3) })).toBeNull();
  });

  it('state 5 with no usable timestamp → null rather than a fabricated date', () => {
    expect(servedByFiction({ state: 5, acceptanceTime: null })).toBeNull();
    expect(servedByFiction({ state: 5, acceptanceTime: NaN })).toBeNull();
  });

  it('crash-safe: malformed input → null, never throws', () => {
    // @ts-expect-error - exercising a totally malformed input
    expect(servedByFiction(null)).toBeNull();
    expect(servedByFiction({})).toBeNull();
  });
});
