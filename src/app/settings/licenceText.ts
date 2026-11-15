// A licence as the text screen sets it (031 I48, board R13): its paragraphs flowed, and a component's own
// copyright notice set inside it.
//
// FLOWED, NOT RE-WORDED. Spec 012 kept every source line break, and the licence files are hard-wrapped at
// about 80 characters - in a phone's monospace each of those lines wrapped a second time, a ragged edge
// down the whole text. The owner chose R13's flowing paragraphs (2026-11-15): a sentence's lines are
// joined with one space. The words are the licence's, byte for byte, in order
// (`__tests__/app/licencesAsDrawn.test.tsx` checks every bundled text). What is not a sentence keeps its
// line: a rule, a heading (a line in capitals over text that is not - a disclaimer set all in capitals
// is still sentences), and a list item.

/** A line that opens a list item: "(a) ", "1. ", "- ", "* ". */
const LIST_ITEM = /^(\(?[a-z0-9]{1,3}[.)]|[-*•])\s/i;

/** A rule under a title: "-----". */
const RULE = /^[-=_*~\s]+$/;
const hasLowerCase = (line: string) => /[a-z]/.test(line);

/** One paragraph's lines, each trimmed, joined where they continue a sentence. */
function flowParagraph(paragraph: string): string {
  const lines = paragraph
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  // A line in capitals is a heading only where the paragraph has other words: OFL's "PREAMBLE" over its
  // text, not MIT's "THE SOFTWARE IS PROVIDED…", which is capitals all through.
  const mixed = lines.some(hasLowerCase);
  const standsAlone = (line: string) => RULE.test(line) || (mixed && !hasLowerCase(line));
  let out = '';
  lines.forEach((line, i) => {
    if (i === 0) {
      out = line;
      return;
    }
    const keepBreak = standsAlone(lines[i - 1]) || standsAlone(line) || LIST_ITEM.test(line);
    out += (keepBreak ? '\n' : ' ') + line;
  });
  return out;
}

/** The text with its paragraphs kept and each paragraph's sentences flowed. */
export function flowParagraphs(text: string): string {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map(flowParagraph)
    .join('\n\n');
}

/**
 * The licence with a component's copyright notice in it: under the licence's title where it opens with
 * one ("MIT License", where MIT's own template has its notice), otherwise first, as zlib's and Apache's
 * appendices put it. The notice is what MIT, ISC and BSD require each copy to reproduce.
 */
export function withNotice(text: string, notice: string): string {
  const paragraphs = text.trim().split(/\n\s*\n/);
  const first = paragraphs[0];
  const opensWithTitle = /licen[cs]e/i.test(first) && !/[.:]\s/.test(first) && !/[.:]$/.test(first.trim());
  return opensWithTitle
    ? [first, notice, ...paragraphs.slice(1)].join('\n\n')
    : [notice, ...paragraphs].join('\n\n');
}
