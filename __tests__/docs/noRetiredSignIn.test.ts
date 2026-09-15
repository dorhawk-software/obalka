// The app signs in three ways: a name and password, an SMS code, and Mobile Key. Nothing else.
//
// The generator "security code" (HOTP, `bezpečnostní kód`) is retired by ISDS and is not implemented.
// It lingered for months as a leftover - an `otp_hotp` path kept "for boxes added before", an FAQ line,
// a constitution clause - and on 2026-09-28 it reached the README's list of sign-in methods, because a
// reader of the code reasonably took the leftover for a feature. The owner's call: it is removed and
// must never be mentioned again. This guard is what keeps it that way.
//
// EXEMPT: the archived ISDS documents in `docs/isds-*`, which are the operator's own text, and Apple's
// feature name "Security Code AutoFill", which is how iOS fills an SMS code in, not a sign-in method.

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(__dirname, '../..');
const SELF = relative(ROOT, __filename);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walk(path, out);
    } else if (/\.(ts|tsx|md)$/.test(name)) {
      out.push(path);
    }
  }
  return out;
}

function scanned(): string[] {
  const docs = readdirSync(join(ROOT, 'docs'))
    .filter(name => name.endsWith('.md') && !name.startsWith('isds-'))
    .map(name => join(ROOT, 'docs', name));
  return [
    join(ROOT, 'README.md'),
    join(ROOT, 'README.en.md'),
    join(ROOT, '.specify/memory/constitution.md'),
    ...docs,
    ...walk(join(ROOT, 'src')),
    ...walk(join(ROOT, 'specs')),
    ...walk(join(ROOT, '__tests__')),
  ].filter(path => relative(ROOT, path) !== SELF);
}

const FORBIDDEN: readonly RegExp[] = [
  /\bhotp\b/i,
  /otp_hotp/i,
  /bezpečnostn\S*\s+kód/i,
  /security code(?! autofill)/i,
];

describe('the retired generator security code (HOTP)', () => {
  it('is mentioned nowhere in the app, its docs, specs or tests', () => {
    const hits: string[] = [];
    for (const path of scanned()) {
      const lines = readFileSync(path, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (FORBIDDEN.some(pattern => pattern.test(line))) {
          hits.push(`${relative(ROOT, path)}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(hits).toEqual([]);
  });

  it('would catch the line that started this', () => {
    const line = '| **01** | Přidejte schránku | Přihlášení jménem a heslem, SMS kódem, bezpečnostním kódem nebo Mobilním klíčem. |';
    expect(FORBIDDEN.some(pattern => pattern.test(line))).toBe(true);
    expect(FORBIDDEN.some(pattern => pattern.test("method: 'otp_hotp'"))).toBe(true);
    expect(FORBIDDEN.some(pattern => pattern.test('iOS Security Code AutoFill'))).toBe(false);
  });
});
