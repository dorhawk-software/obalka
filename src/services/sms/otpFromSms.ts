// Pulling the one-time code out of an SMS (021).
//
// Kept separate from the native module on purpose: this is the part that can be wrong in an
// interesting way, and it is the part no emulator is needed to test. The module's job is to obtain
// one consented message; this decides whether that message contains a code at all.
//
// The message ISDS actually sends (its wording, its missing diacritics, verbatim):
//
//   Dobry den. Autentizacni kod pro pristup k ISDS je 35124603. Ceska posta, s.p.
//
// The rule follows `deadlineScan.ts`: prefer a number the sentence POINTS AT, and when the text does
// not clearly state one code, return nothing. An OTP field is a worse place to guess than most - a
// wrong code spends one of a handful of attempts and can lock the box.

/** ISDS codes are eight digits; the range is wider so a change of length does not silently break it. */
const MIN_DIGITS = 6;
const MAX_DIGITS = 8;

/** A run of digits that is not part of a longer number (so "300/2008" yields nothing). */
const DIGIT_RUN = new RegExp(
  `(?<![0-9])([0-9]{${MIN_DIGITS},${MAX_DIGITS}})(?![0-9])`,
  'g',
);

/**
 * Words that introduce the code, diacritic-free because the SMS is. `je` is what ISDS actually uses
 * ("…kod pro pristup k ISDS je 35124603"); the rest are the obvious neighbours a rewording would
 * reach for.
 */
const CUES = ['je', 'kod', 'kód', 'code', 'heslo', 'pin'];

/** Lowercase, strip diacritics - "kód" and "kod" are the same cue. */
function fold(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** How much text before the digits may hold the cue. Short: the cue must introduce THIS number. */
const CUE_WINDOW = 24;

function cued(text: string, at: number): boolean {
  const before = fold(text.slice(Math.max(0, at - CUE_WINDOW), at));
  return CUES.some(cue =>
    new RegExp(`(^|[^a-z0-9])${fold(cue)}[\\s.:,-]*$`).test(before),
  );
}

/**
 * The one-time code this message states, or null.
 *
 * Null covers every unclear case, and they are deliberately indistinguishable: no digits, digits that
 * nothing points at while others do, or two equally plausible candidates.
 */
export function otpFromSms(message: string): string | null {
  if (typeof message !== 'string' || message.trim() === '') {
    return null;
  }
  const all: { code: string; cued: boolean }[] = [];
  DIGIT_RUN.lastIndex = 0;
  for (let m = DIGIT_RUN.exec(message); m; m = DIGIT_RUN.exec(message)) {
    all.push({ code: m[1], cued: cued(message, m.index) });
  }
  if (all.length === 0) {
    return null;
  }
  // A cued number beats an uncued one - that is what "the sentence points at it" buys. Among equals,
  // two different candidates mean the message does not state one code, so nothing is offered.
  const cuedOnes = all.filter(c => c.cued);
  const pool = cuedOnes.length > 0 ? cuedOnes : all;
  const distinct = new Set(pool.map(c => c.code));
  return distinct.size === 1 ? pool[0].code : null;
}
