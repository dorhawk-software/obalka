// The room the Debug screen's recording counter reserves (023, constitution V).
//
// "Zaznamenává se · 2 záznamy · 1 kB" is one caption line whose words grow while a recording runs. At a
// larger text size the longer counters take a second line part-way through, and until 2026-09-15 that
// pushed the hint, the discard button and everything under them down. The screen now lays the live
// counter over an invisible reserve - the text `recordingCounterReserve()` returns - so the room is
// whatever the reserve needs, and the live words take none.
//
// That only holds if no counter ever needs MORE lines than the reserve. A line breaker that fills each
// line while the next word fits can only take as many lines or more when every word is as wide or
// wider, so that is what these tests measure - from the bundled font, in both languages, for every entry
// count and every size the counter can show under the recorder's caps. The screen names that breaker for
// both Texts (`textBreakStrategy="simple"`, which Android does not default to), and
// `debugScreen.test.tsx` holds it to that.

import { plural, setActiveLocale } from '../../src/i18n/strings';
import { type as typeScale } from '../../src/theme/typography';
import {
  recordingCounter,
  recordingCounterReserve,
} from '../../src/app/settings/DebugScreen';
import { MAX_BYTES, MAX_ENTRIES } from '../../src/services/debug/debugLog';
import { fontMeasure, greedyLines } from '../helpers/fontMetrics';

const CAPTION = typeScale.caption;
const measure = fontMeasure(`${CAPTION.fontFamily}.ttf`);

/**
 * The width a 360dp phone leaves the counter's words: the settings gutter of 16 on each side, the
 * row's 4 inset, the 8dp dot and the 8 gap beside it.
 */
const PHONE_360 = 360 - 2 * 16 - 4 - 8 - 8;

/** Every entry count the recorder can report. */
const COUNTS = Array.from({ length: MAX_ENTRIES + 1 }, (_, n) => n);

/**
 * Byte counts that reach every label the counter can show under the cap: every byte below a kilobyte,
 * then steps of half a kilobyte, which land on every rounding edge of the kB figure and fall well inside
 * each 0.1 MB step.
 */
function byteCounts(): number[] {
  const out: number[] = [];
  for (let b = 0; b < 1024; b += 1) {
    out.push(b);
  }
  for (let b = 1024; b <= MAX_BYTES; b += 512) {
    out.push(b);
  }
  out.push(1024 * 1024 - 1, MAX_BYTES);
  return out;
}

const words = (text: string) => text.split(' ');
const widths = (text: string) => words(text).map(w => measure(w, CAPTION.fontSize));

/** Word by word, the widest of `counters`. */
function widestWords(counters: string[]): number[] {
  const out = widths(counters[0]);
  for (const counter of counters) {
    widths(counter).forEach((w, i) => {
      out[i] = Math.max(out[i], w);
    });
  }
  return out;
}

afterEach(() => {
  setActiveLocale('cs');
});

describe('the recording counter s reserve', () => {
  it.each(['cs', 'en'] as const)(
    'is word for word at least as wide as any counter the recorder can reach (%s)',
    locale => {
      setActiveLocale(locale);
      const counters = [
        ...COUNTS.map(n => recordingCounter(n, 0)),
        ...byteCounts().map(b => recordingCounter(0, b)),
      ];
      const reserve = recordingCounterReserve();

      // The same number of words everywhere, so word i of one is word i of every other.
      const count = words(reserve).length;
      expect(counters.filter(c => words(c).length !== count)).toEqual([]);

      const widest = widestWords(counters);
      const room = widths(reserve);
      const short = room
        .map((w, i) => ({ word: words(reserve)[i], room: w, needed: widest[i] }))
        .filter(({ room: w, needed }) => w < needed);
      expect(short).toEqual([]);
    },
  );

  it('holds the counter s largest figures, not only the widest glyphs', () => {
    // The reserve is built from what the recorder can reach; these are the far ends it was built for.
    expect(recordingCounter(MAX_ENTRIES, MAX_BYTES)).toBe('Zaznamenává se · 4000 záznamů · 4.0 MB');
    expect(recordingCounter(3888, 1024 * 1024 - 1)).toBe('Zaznamenává se · 3888 záznamů · 1024 kB');
    expect(plural(Number(words(recordingCounterReserve())[3]))).toBe('many');
  });

  it('takes as many lines as the longest counter at every text size, on a 360dp phone', () => {
    // The jump this closes, measured: at 130 % text the counter a recording starts with fits one line
    // and a longer one it reaches later needs two. The reserve needs those two from the start.
    const start = recordingCounter(2, 1024);
    const longer = recordingCounter(3888, 1024 * 1024 - 1);
    const at = (text: string, scale: number) =>
      greedyLines(text, PHONE_360, CAPTION.fontSize * scale, measure);
    expect(at(start, 1.3)).toBe(1);
    expect(at(longer, 1.3)).toBe(2);

    // Every system text size, up to the largest iOS accessibility size (about 3.6x).
    const short: number[] = [];
    for (let step = 0; step <= 52; step += 1) {
      const scale = 1 + step * 0.05;
      const room = at(recordingCounterReserve(), scale);
      if (room < at(start, scale) || room < at(longer, scale)) {
        short.push(scale);
      }
    }
    expect(short).toEqual([]);
    expect(at(recordingCounterReserve(), 1.3)).toBe(2);
  });
});
