// Every `t('key')` in the app resolves to a real string.
//
// `t()` falls back to the KEY itself when nothing matches, which is the right runtime behaviour -
// visible, not blank - and completely silent in development. It shipped to a device as a button
// labelled "COMMON.CANCEL", in a modal, in a release build, having passed every test.
//
// `localeParity.test.ts` cannot catch this: it compares cs against en, and a key missing from BOTH is
// consistent. Only the call sites know which keys are actually asked for, so this reads them.

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { STRINGS_FOR_TEST } from '../../src/i18n/strings';
import { cs as loginCs } from '../../src/i18n/loginMessages';

const ROOT = join(__dirname, '../..');
const SRC = join(ROOT, 'src');

/** Keys a static reader can resolve: `t('x')` and `t(\`x\`)` with no interpolation. */
const STATIC_KEY = /\bt\(\s*(?:'([^']+)'|`([^`${}]+)`)/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return sourceFiles(full);
    }
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

describe('t() keys', () => {
  const files = sourceFiles(SRC);
  // Keys can also come from the login-error map, which `t()` reads through the same table.
  const known = new Set([
    ...Object.keys(STRINGS_FOR_TEST.cs),
    ...Object.keys(STRINGS_FOR_TEST.en),
    ...Object.keys(loginCs),
  ]);

  it('finds the call sites at all', () => {
    // Guards the guard: a regex that matched nothing would pass this file forever.
    const total = files.reduce(
      (n, f) => n + [...readFileSync(f, 'utf8').matchAll(STATIC_KEY)].length,
      0,
    );
    expect(total).toBeGreaterThan(200);
  });

  it('all resolve to a real string', () => {
    const missing: string[] = [];
    for (const file of files) {
      for (const match of readFileSync(file, 'utf8').matchAll(STATIC_KEY)) {
        const key = match[1] ?? match[2];
        // Only keys that look like ours - `t(x)` on a variable is resolved elsewhere.
        if (key && /^[a-z][\w.]*$/i.test(key) && !known.has(key)) {
          missing.push(`${relative(ROOT, file)} - t('${key}')`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
