// Every Settings row that opens something has to LOOK like it opens something.
//
// Reported from a device: "Režim ladění" was the one row in Settings you could tap into that carried
// no chevron. On its own the row looked fine - which is exactly why this is worth a test rather than
// a fix. Settings is read as a COLUMN: the eye runs down the right-hand edge and the marks there are
// the index of what is reachable. One row missing its mark does not read as an oversight, it reads
// as a statement - "this one is different" - so the affordance is wrong for the row that has it
// missing AND slightly wrong for the four that have it.
//
// That is not catchable by reading a diff, because the diff for such a row is a perfectly ordinary
// row. It is catchable by asking which rows navigate and which of them draw a mark, which is what
// this file does. Same reasoning as `theme/screenHeader.test.tsx`, one level down.
//
// `AboutRow` is local to SettingsScreen, so the scan is too. If it is ever hoisted into `theme/`,
// widen the glob rather than deleting the test.

import { readFileSync } from 'fs';
import { join } from 'path';

const FILE = join(__dirname, '../../src/app/settings/SettingsScreen.tsx');

/** Anything that tells the eye "there is more behind this row". */
const AFFORDANCES = ['ChevronRightIcon', 'ExternalLinkIcon'];

/** Every `<AboutRow …>…</AboutRow>`, with its opening tag and its body. */
function aboutRows(source: string): { line: number; open: string; body: string }[] {
  const rows: { line: number; open: string; body: string }[] = [];
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].includes('<AboutRow')) {
      continue;
    }
    const start = i;
    let depth = 0;
    const buf: string[] = [];
    for (let j = i; j < lines.length; j += 1) {
      buf.push(lines[j]);
      depth += (lines[j].match(/<AboutRow/g) ?? []).length;
      depth -= (lines[j].match(/<\/AboutRow>/g) ?? []).length;
      if (depth === 0 && buf.length > 0 && lines[j].includes('</AboutRow>')) {
        break;
      }
    }
    const block = buf.join('\n');
    rows.push({
      line: start + 1,
      open: block.slice(0, block.indexOf('>') + 1),
      body: block,
    });
  }
  return rows;
}

describe('Settings rows', () => {
  const source = readFileSync(FILE, 'utf8');
  const rows = aboutRows(source);

  it('finds the rows at all, so a passing scan means something', () => {
    // A regex that silently matches nothing is a test that passes forever. There are five tappable
    // rows today; the assertion is only that the scan is finding real ones.
    expect(rows.length).toBeGreaterThanOrEqual(5);
    expect(rows.filter(r => r.open.includes('onPress')).length).toBeGreaterThanOrEqual(5);
  });

  it('every row that opens something draws the mark that says so', () => {
    const naked = rows
      .filter(row => row.open.includes('onPress'))
      .filter(row => !AFFORDANCES.some(icon => row.body.includes(icon)))
      .map(row => {
        const title = /<RowTitle>\{?t\('([^']+)'\)/.exec(row.body);
        return `SettingsScreen.tsx:${row.line} (${title ? title[1] : 'unknown row'})`;
      });

    expect(naked).toEqual([]);
  });
});
