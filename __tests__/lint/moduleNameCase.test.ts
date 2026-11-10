// No two modules may differ only by the case of their name.
//
// `src/theme/typography.ts` (the scale) once sat beside `src/theme/Typography.tsx` (the role
// components), and `avatar.ts` beside `Avatar.tsx`. On Linux, where this was written, nothing noticed.
// On a Mac the disk ignores case, so TypeScript resolving `./Typography` tried `Typography.ts` first,
// found `typography.ts`, and `tsc` reported 196 errors on a tree CI called green. Metro was unaffected
// (it resolves through its own case-sensitive file map), which is exactly why only a check like this
// one catches it: the app builds, the editor and the type check do not.

import { readdirSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(__dirname, '..', '..');
const DIRS = ['src', '__tests__', 'tools', 'scripts'];
// The extensions TypeScript and Metro try for an extension-less import. JSON is left out because
// `App.tsx` beside `app.json` is React Native's own template; it is safe only while every resolver
// tries JSON after the code extensions - jest.config.js once did not, and `../App` became app.json.
const MODULE = /\.(d\.ts|tsx?|jsx?|mjs|cjs)$/;

function modules(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === 'node_modules' ? [] : modules(path);
    }
    return MODULE.test(entry.name) ? [relative(ROOT, path)] : [];
  });
}

describe('module names', () => {
  it('no two modules differ only by case once the extension is dropped', () => {
    const byKey = new Map<string, string[]>();
    for (const file of DIRS.flatMap((d) => modules(join(ROOT, d)))) {
      const key = file.replace(MODULE, '').toLowerCase();
      byKey.set(key, [...(byKey.get(key) ?? []), file]);
    }
    const clashes = [...byKey.values()]
      .filter((files) => new Set(files.map((f) => f.replace(MODULE, ''))).size > 1)
      .map((files) => files.join(' vs '));
    expect(clashes).toEqual([]);
  });
});
