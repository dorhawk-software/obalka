// Czech typesetting the boards already do (031 I82, I83): a one-letter preposition or conjunction
// (v, k, s, z, o, u, a, i) never ends a line - "nastavení v / tomto telefonu" is a fault any Czech reader
// sees - and a number never parts from its unit ("4,2 / MB"). Both take a no-break space.
//
// Applied where Czech text reaches the screen: every `t()` string (with its values filled in), the FAQ
// answers and the in-app changelog. English is left alone: its "a" may end a line.

const NBSP = ' ';

/** A one-letter word, at the start or after a space or an opening mark, followed by a plain space. */
const ONE_LETTER = /(^|[\s („"'])([vkszouaiVKSZOUAI]) /g;

/** The text with a no-break space after each Czech one-letter preposition or conjunction. */
export function typesetCs(text: string): string {
  // Twice: in "a v tomto" the first match takes the space the second one needs before it.
  return text.replace(ONE_LETTER, `$1$2${NBSP}`).replace(ONE_LETTER, `$1$2${NBSP}`);
}

/** Text written in `locale`, typeset when it is Czech: for content that does not come through `t()`. */
export function typesetFor(locale: string, text: string): string {
  return locale === 'cs' ? typesetCs(text) : text;
}

const MIB = 1024 * 1024;

/**
 * B / kB / MB with the decimal comma, the number and its unit held together ("1,4 MB"), as every
 * board writes a size - on the detail, compose, backup, transfer and debug screens alike. One copy:
 * there were five, and the debug screen's wrote "1.4 MB".
 */
export function formatBytes(n: number): string {
  if (n < 1024) {
    return `${n}${NBSP}B`;
  }
  if (n < MIB) {
    return `${Math.round(n / 1024)}${NBSP}kB`;
  }
  return `${(n / MIB).toFixed(1).replace('.', ',')}${NBSP}MB`;
}
