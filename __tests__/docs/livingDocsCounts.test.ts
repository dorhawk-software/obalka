// No test counts in the documents that describe the project TODAY.
//
// "1429 tests" stood in both READMEs while the suite was well past two thousand, and it was not the
// first time: a number like that is written once, read by nobody who can update it, and is wrong from
// the next commit on. The owner's call, after the N-th recurrence: do not state it at all. A sentence
// that says tests, a typecheck and a lint have to pass is true for as long as that is true.
//
// The count of a CI's checks is the same trap - "four more checks" went stale the day the iOS build
// job was added - so the number words are caught too.
//
// SPECS ARE EXEMPT, deliberately. `specs/**` and the amendment notes in them record what was true on a
// dated day ("2367 tests in 205 suites, 2026-09-15"), which is evidence rather than a claim about now.
// Freezing that would be the opposite of honest.

import { readFileSync, readdirSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(__dirname, '../..');

/** The documents that describe the project as it is now. */
function livingDocs(): string[] {
  const docs = readdirSync(join(ROOT, 'docs'))
    .filter(name => name.endsWith('.md'))
    .map(name => join(ROOT, 'docs', name));
  return [join(ROOT, 'README.md'), join(ROOT, 'README.en.md'), ...docs];
}

/** Strip fenced code and links to files: a path like `__tests__/a/b.test.ts` is not a claim. */
function prose(text: string): string {
  return text.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');
}

// `\b` is ASCII-only in JavaScript: `\bčtyři` never matches, because `č` is not a word character to it
// and a space before it is not a boundary either. The self-check below caught exactly that. So the
// edges are written with Unicode letter classes under the `u` flag instead.
const FORBIDDEN: readonly [RegExp, string][] = [
  // "1429 tests", "1 429 testů", "2,372 tests", "205 suites"
  [
    /(?:^|[^\p{L}\d])\d[\d\s.,]*\s*(?:tests?|testů|testy|suites?)(?![\p{L}])/iu,
    'a test count',
  ],
  // "four more checks", "čtyři kontroly" - a number of CI checks, which changes with every job added
  [
    /(?:^|[^\p{L}])(?:two|three|four|five|six|seven|dva|dvě|tři|čtyři|pět|šest|sedm)\s+(?:more\s+)?(?:checks|kontroly|kontrol)(?![\p{L}])/iu,
    'a count of CI checks',
  ],
  // The number AFTER the word, which is how a shields.io badge writes it: `badge/testy-1429-2A744B`.
  // This is the form that survived the first pass of this rule and stayed wrong on the public page.
  [/(?:tests?|testy|testů|suites?)[-_\s]+\d/iu, 'a test count (badge form)'],
  // "Verze 0.0.1" stood in both READMEs while package.json and the stores moved on. The version lives in
  // package.json and the git tags (scripts/release.mjs); a sentence that states it is a third copy.
  [/(?:^|[^\p{L}])(?:verze|version)\s+\d+\.\d+\.\d+/iu, 'the app version'],
];

describe('the living documents do not state counts that go stale', () => {
  const files = livingDocs();

  it('has documents to scan', () => {
    // Guards the guard: a rename that empties this list must fail loudly, not pass silently.
    expect(files.length).toBeGreaterThanOrEqual(5);
  });

  it('states no test count and no count of CI checks', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const text = prose(readFileSync(file, 'utf8'));
      for (const [pattern, what] of FORBIDDEN) {
        const hit = pattern.exec(text);
        if (hit) {
          offenders.push(`${relative(ROOT, file)} states ${what}: "${hit[0].trim()}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('would catch the count that started this', () => {
    // The rule is only worth having if it fires on the exact sentence that was wrong for weeks.
    const [tests, checks] = FORBIDDEN;
    expect(tests[0].test('**1429 tests**, a clean typecheck and a clean lint.')).toBe(true);
    expect(tests[0].test('**1429 testů**, typecheck bez chyb')).toBe(true);
    expect(tests[0].test('205 suites')).toBe(true);
    expect(checks[0].test('CI runs four more checks: that the licence')).toBe(true);
    expect(checks[0].test('CI pouští ještě čtyři kontroly navíc')).toBe(true);
    // The badge that was still wrong on the public page after the counts in the prose were removed.
    const badge = FORBIDDEN[2][0];
    expect(
      badge.test('[![Testy](https://img.shields.io/badge/testy-1429-2A744B?style=flat-square)](#kvalita)'),
    ).toBe(true);
    expect(
      badge.test('[![Tests](https://img.shields.io/badge/tests-1429-2A744B?style=flat-square)](#quality)'),
    ).toBe(true);
    expect(badge.test('[![CI](https://github.com/o/r/actions/workflows/ci.yml/badge.svg)](x)')).toBe(
      false,
    );
    const version = FORBIDDEN[3][0];
    expect(version.test('**Verze 0.0.1, před první beta verzí.**')).toBe(true);
    expect(version.test('**Version 0.0.1, before the first beta.**')).toBe(true);
    expect(version.test('**Before the first beta.**')).toBe(false);
    // And not on prose that names no number.
    expect(tests[0].test('Tests, a typecheck and a lint run on every push.')).toBe(false);
    expect(checks[0].test('CI adds more checks: that the licence attributions are current')).toBe(
      false,
    );
  });
});
