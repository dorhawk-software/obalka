// A box drawn around text it can no longer hold (impeccable audit, 2026-09-09).
//
// React Native scales BOTH halves of a line: `TextAttributes.effectiveFontSize` and
// `effectiveLineHeight` each go through `PixelUtil.toPixelFromSP`, so at the system's largest text
// size a 14pt label in a 20pt line box becomes a 28pt label in a 40pt one. What does NOT scale is a
// container measured in dp. `height={40}` is 40dp at every text size, and the label it was drawn
// around is simply cropped.
//
// `SettingsScreen` already knew this and said so at its own header:
//
//     minHeight, not height: at a large system font size the Bricolage title is taller than the bar
//     the design drew for it, and a fixed 54 clips its descenders instead of growing.
//
// …and the fix had been applied to two bars. Nine other boxes still had it - two dialog buttons, the
// delivery-state pill, four rows in the message detail, the search field, the compose body. None of
// them are visible at the default text size, which is exactly why a person cannot be the check.
//
// This is a SOURCE scan rather than a render test on purpose. Jest's renderer has no layout engine,
// so a rendered tree cannot tell you a box was too short; and the failure mode being prevented is
// someone typing `height` where `minHeight` belongs, which is a property of the source. It is the
// same shape as `noSystemAlert.test.ts`, for the same reason.

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(__dirname, '../..');
const SRC = join(ROOT, 'src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return sourceFiles(full);
    }
    return /\.tsx$/.test(entry) ? [full] : [];
  });
}

/** The role components from `Typography.tsx`, plus the two primitives that render text directly. */
const TEXT_ROLE =
  /<(Display|Title|Heading|Body|BodyStrong|Value|Label|Caption|Badge|Text|Paragraph|Input|Button)\b/;

/**
 * A square box - `width` and `height` set to the same literal - is an ICON well, a knob, an avatar
 * or a swatch. Its size is the drawing, not a guess about the text inside it, and its content is a
 * glyph that does not scale with the reading size. Those are correct as fixed and stay fixed.
 */
function isSquare(openingTag: string): boolean {
  const w = openingTag.match(/\bwidth=\{(\d+)\}/);
  const h = openingTag.match(/\bheight=\{(\d+)\}/);
  return w != null && h != null && w[1] === h[1];
}

interface Offender {
  file: string;
  line: number;
  height: string;
}

/**
 * Every element that pins a `height` in dp and puts scaling text inside it.
 *
 * Deliberately crude: it looks at the element's own opening tag and the lines that follow it up to
 * the next opening tag of a sibling box. A scan that is a little eager is the right trade here - a
 * false positive is one comment away from being resolved, and a false negative is a cropped word on
 * someone's phone that nobody sees.
 */
function offenders(): Offender[] {
  const found: Offender[] = [];
  for (const file of sourceFiles(SRC)) {
    const lines = readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const m = /^\s*height=\{(\d+)\}\s*$/.exec(lines[i]);
      if (!m) {
        continue;
      }
      // The opening tag this prop belongs to: walk back to the `<Name`, forward to its `>`.
      let start = i;
      while (start > 0 && !/^\s*<[A-Z]/.test(lines[start])) {
        start--;
      }
      let end = i;
      while (end < lines.length - 1 && !/^\s*\/?>\s*$/.test(lines[end])) {
        end++;
      }
      const openingTag = lines.slice(start, end + 1).join('\n');
      if (isSquare(openingTag)) {
        continue;
      }
      // A self-closing element has no children, so nothing it could crop. These are the rules,
      // rails and grabber handles - a 4dp bar is not a box around a word.
      if (/^\s*\/>\s*$/.test(lines[end])) {
        continue;
      }
      // Children, up to whatever the element's own closing depth is - capped, since a text role
      // further away than this belongs to a sibling, not to this box.
      const children = lines.slice(end + 1, end + 8).join('\n');
      if (TEXT_ROLE.test(children)) {
        found.push({
          file: relative(ROOT, file),
          line: i + 1,
          height: m[1],
        });
      }
    }
  }
  return found;
}

describe('text never sits in a box that cannot grow with it', () => {
  it('scans the whole app', () => {
    expect(sourceFiles(SRC).length).toBeGreaterThan(30);
  });

  it('finds no fixed-height container wrapping scaling text', () => {
    const bad = offenders();
    const report = bad
      .map(o => `  ${o.file}:${o.line} - height={${o.height}} around text`)
      .join('\n');
    expect(
      bad.length === 0
        ? ''
        : `Use minHeight so the box grows with the reading size:\n${report}`,
    ).toBe('');
  });
});

// The other half of the same guarantee: the scale itself has to stay in scaling units. A `fontSize`
// that opted out of scaling would pass the scan above and still be unreadable to someone who needs
// large text - and it is one prop away at every call site.
describe('nothing opts out of the system text size', () => {
  it('never sets allowFontScaling={false}', () => {
    const hits = sourceFiles(SRC).filter(f =>
      /allowFontScaling=\{false\}/.test(readFileSync(f, 'utf8')),
    );
    expect(hits.map(f => relative(ROOT, f))).toEqual([]);
  });
});

// ── The other axis ──────────────────────────────────────────────────────────────────────────────
//
// The scan above only looks DOWN: it catches a box too short for its text. Every defect the
// 2026-09-09 critique found at 1.8× was horizontal, and it could not see any of them:
//
//   * the inbox header's box name ran into the "Testovací" chip and its ellipsis was sliced;
//   * the row's sender ran into the date, same clipped ellipsis;
//   * the switcher row had the identical shape.
//
// One cause in all three. A flex child will not shrink below its own content width unless it is told
// it may - `flex`/`flexShrink` without `minWidth={0}` - so instead of ellipsizing, it overruns the
// sibling beside it. The rule is mechanical, which makes it checkable: text that truncates
// (`numberOfLines`) and flexes must also carry the floor that lets it.
describe('truncating text can actually shrink', () => {
  /** `flex={1}` or `flexShrink={1}` - a child that is meant to give way. */
  const FLEXES = /\b(flex|flexShrink)=\{[1-9]/;

  function unshrinkable(): string[] {
    const bad: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const lines = readFileSync(file, 'utf8').split('\n');
      for (let i = 0; i < lines.length; i++) {
        // A text role opening across several lines, i.e. one with props.
        if (!/^\s*<(Body|BodyStrong|Title|Heading|Caption|Label|Value|Badge|Display|Text)$/.test(lines[i].trimEnd())) {
          continue;
        }
        let end = i;
        while (end < lines.length - 1 && !/^\s*\/?>\s*$/.test(lines[end])) {
          end++;
        }
        const props = lines.slice(i, end + 1).join('\n');
        if (!/numberOfLines=\{1\}/.test(props) || !FLEXES.test(props)) {
          continue;
        }
        if (/minWidth=\{0\}/.test(props)) {
          continue;
        }
        bad.push(`${relative(ROOT, file)}:${i + 1}`);
      }
    }
    return bad;
  }

  it('finds no flexing single-line text without a zero floor', () => {
    const bad = unshrinkable();
    expect(
      bad.length === 0
        ? ''
        : 'Add minWidth={0} so it can ellipsize instead of overrunning its neighbour:\n  ' +
            bad.join('\n  '),
    ).toBe('');
  });
});
