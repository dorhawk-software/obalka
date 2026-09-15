// On-device deadline scanning (010 US3, cycle 2). PURE: text in, at most one suggestion out.
// No I/O, no clock, no document parsing - the caller extracts the text and passes `now`.
//
// WHAT THIS DELIBERATELY IS NOT: a date finder. A government decision routinely carries an issue
// date, a hearing date, a validity date and a deadline, and only one of them is the thing the user
// is bound by. Offering "the latest future date" would present the wrong one with total confidence,
// and a wrong legal deadline is worse than no deadline at all (spec Q5). So:
//
//   * a date counts ONLY when a cue word anchors it - "do", "nejpozději", "ve lhůtě", "termín", …;
//   * if the document states two DIFFERENT cue-anchored dates, the app suggests NOTHING. It is not
//     entitled to decide which deadline binds the user, and picking the earlier one is still picking;
//   * a date already past is never offered - a reminder for it cannot fire, and offering one implies
//     there is still time.
//
// The result is high precision and deliberately low recall. Most documents will produce nothing, and
// that is the intended behaviour, not a gap to close later.

/** Cue words that turn a date into a deadline. Matched immediately before the date. */
import { reportFailure } from '../../../services/telemetry/telemetry';

const CUES = [
  'do',
  'nejpozději',
  'nejpozdeji',
  've lhůtě',
  've lhute',
  'lhůta',
  'lhuta',
  'lhůta končí',
  'termín',
  'termin',
  'splatnost',
  'splatnosti',
];

/** Czech month names, nominative and genitive, lowercase and diacritic-stripped at match time. */
const MONTHS: Record<string, number> = {
  ledna: 1, leden: 1,
  unora: 2, unor: 2,
  brezna: 3, brezen: 3,
  dubna: 4, duben: 4,
  kvetna: 5, kveten: 5,
  cervna: 6, cerven: 6,
  cervence: 7, cervenec: 7,
  srpna: 8, srpen: 8,
  zari: 9,
  rijna: 10, rijen: 10,
  listopadu: 11, listopad: 11,
  prosince: 12, prosinec: 12,
};

export type DeadlineScan =
  | { kind: 'none' }
  | {
      kind: 'found';
      /** Midnight local on the detected day. */
      date: number;
      /** The phrase it was read from, so the user can check the app read it correctly. */
      snippet: string;
    };

/** Lowercase and strip diacritics, so "července" and "cervence" match the same key. */
function fold(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Midnight local, or null if the components are not a real calendar day. */
function toDate(d: number, m: number, y: number): number | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2999) {
    return null;
  }
  const dt = new Date(y, m - 1, d);
  // Rejects 31 February rather than letting it roll into March - a rolled-over deadline would be a
  // date the document does not contain.
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
    return null;
  }
  return dt.getTime();
}

/** `8. 7. 2026`, `8.7.2026`, `08. 07. 2026`, or `8. července 2026` - each optionally cue-anchored. */
const NUMERIC = /(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{4})/g;
const WORDED = /(\d{1,2})\s*\.\s*([a-zá-ž]+)\s+(\d{4})/gi;

/** How much text before a date may contain the cue. Short on purpose: "do" must be attached to the
 *  date, not merely somewhere in the same sentence ("odesláno do Prahy … 8. 7. 2026"). */
const CUE_WINDOW = 24;

function cueAnchored(text: string, matchStart: number): boolean {
  const before = fold(text.slice(Math.max(0, matchStart - CUE_WINDOW), matchStart));
  return CUES.some(cue => {
    const c = fold(cue);
    // The cue must be the last word before the date - allow only spaces/punctuation between.
    return new RegExp(`(^|[^a-z0-9á-ž])${c}[\\s.:,–-]*$`).test(before);
  });
}

/**
 * Find the document's deadline, if it states exactly one.
 *
 * `now` is passed rather than read so this is testable without a clock; dates at or before it are
 * discarded.
 */
export function scanForDeadline(text: string, now: number): DeadlineScan {
  try {
    if (typeof text !== 'string' || text.trim() === '') {
      return { kind: 'none' };
    }
    const hits = new Map<number, string>(); // date → the phrase it came from

    const collect = (
      re: RegExp,
      month: (raw: string) => number | null,
    ): void => {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        if (!cueAnchored(text, m.index)) {
          continue;
        }
        const mo = month(m[2]);
        const date = mo == null ? null : toDate(Number(m[1]), mo, Number(m[3]));
        if (date == null || date <= now) {
          continue;
        }
        if (!hits.has(date)) {
          const from = Math.max(0, m.index - CUE_WINDOW);
          hits.set(date, text.slice(from, m.index + m[0].length).trim());
        }
      }
    };

    collect(NUMERIC, raw => Number(raw));
    collect(WORDED, raw => MONTHS[fold(raw)] ?? null);

    // Exactly one distinct date, or nothing. Two different dates is the document being ambiguous,
    // and resolving that ambiguity is not the app's to do.
    if (hits.size !== 1) {
      return { kind: 'none' };
    }
    const [date, snippet] = [...hits.entries()][0];
    return { kind: 'found', date, snippet };
  } catch (e) {
    reportFailure('scan.pdfText', e, { stage: 'parse' });
    return { kind: 'none' }; // a scan is a convenience; it never takes the screen down with it
  }
}
