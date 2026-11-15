// One way of writing a date (031 T050, the owner 2026-11-15): the Czech standard's spaced form, the
// hour without its leading zero; English the day, the month's short name and the year.

import { clock, dateTime, fullDate, shortDate } from '../../src/i18n/dates';
import { setActiveLocale } from '../../src/i18n/activeLocale';
import { postmarkDateSize } from '../../src/theme/print';

const NBSP = ' ';
const MORNING = new Date(2026, 10, 12, 9, 20).getTime();
const AUGUST = new Date(2026, 7, 29, 14, 2).getTime();

afterEach(() => setActiveLocale('cs'));

describe('Czech', () => {
  it('writes the standard form, its spaces non-breaking so a date never wraps', () => {
    expect(fullDate(MORNING)).toBe(`12.${NBSP}11.${NBSP}2026`);
    expect(shortDate(AUGUST)).toBe(`29.${NBSP}8.`);
    expect(dateTime(MORNING)).toBe(`12.${NBSP}11.${NBSP}2026 9:20`);
  });

  it('writes the hour without its leading zero and the minutes with theirs', () => {
    expect(clock(MORNING)).toBe('9:20');
    expect(clock(AUGUST)).toBe('14:02');
    expect(clock(new Date(2026, 0, 1, 0, 5).getTime())).toBe('0:05');
  });
});

describe('English', () => {
  it("writes the day and the month's short name, which no reader takes for 11 December", () => {
    setActiveLocale('en');
    expect(fullDate(MORNING)).toBe(`12${NBSP}Nov${NBSP}2026`);
    expect(shortDate(AUGUST)).toBe(`29${NBSP}Aug`);
    expect(dateTime(MORNING)).toBe(`12${NBSP}Nov${NBSP}2026, 9:20`);
  });
});

describe('on the postmark', () => {
  it("keeps the widest date inside the inner ring: the ring's 11 for what it was drawn for, smaller past it", () => {
    // Until 2026-11-15 the widest date was "28.12."; the spaced form and English month names are wider
    // and SVG text does not fit itself.
    expect(postmarkDateSize('28.12.')).toBe(11);
    expect(postmarkDateSize(`10.${NBSP}9.`)).toBe(11);
    const wide = [`28.${NBSP}12.`, `30${NBSP}Sep`, `28${NBSP}Dec`, `31${NBSP}May`];
    for (const date of wide) {
      expect(postmarkDateSize(date)).toBeLessThan(11);
      expect(postmarkDateSize(date)).toBeGreaterThan(9);
    }
  });
});
