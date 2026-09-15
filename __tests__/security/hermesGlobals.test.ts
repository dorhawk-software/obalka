// Nothing in the app may reach for a global Hermes does not have.
//
// The app runs on Hermes, the tests run on Node, and Node has all of these. So a `new TextDecoder()`
// passes every test, ships, and then throws `ReferenceError: Property 'TextDecoder' doesn't exist` on
// the one path nobody could exercise in jest. That is not hypothetical: it is how the backup restore
// shipped broken - sealing an archive worked (a TextEncoder does exist in this runtime) and opening it
// threw, which the screen reported as "check the password", about a password that was correct.
//
// So this is a SOURCE scan, not a runtime check: it is the only kind that can see code jest never runs.
// The fix for a failure here is never to shim a global on app start - it is to import the function,
// so the dependency is visible in the file that needs it.

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(__dirname, '../..');
const SRC = join(ROOT, 'src');

/** Globals that exist in Node (so tests pass) and NOT in Hermes (so the app throws). */
const MISSING_IN_HERMES: { pattern: RegExp; instead: string }[] = [
  {
    pattern: /\bnew TextDecoder\b|\bTextDecoder\s*\(/,
    instead: "import { decodeUtf8 } from 'services/text/textCodec'",
  },
  {
    pattern: /\bnew TextEncoder\b|\bTextEncoder\s*\(/,
    instead: "import { encodeUtf8 } from 'services/text/textCodec'",
  },
  {
    pattern: /(?<!\.)\bstructuredClone\s*\(/,
    instead: 'copy the value explicitly, or use the shim in services/scan/hermesShims.ts',
  },
  {
    pattern: /\bnew ReadableStream\b/,
    instead: 'pass the bytes directly, or install the shim first (services/scan/hermesShims.ts)',
  },
  {
    pattern: /\bPromise\s*\.\s*withResolvers\b/,
    instead: 'a plain `new Promise` with captured resolve/reject',
  },
  {
    pattern: /\bimport\s*\.\s*meta\b/,
    instead: 'a static path - Metro cannot compile import.meta',
  },
];

/**
 * The two files whose whole job is to provide these - they must name them.
 *
 * Deliberately short, and it must stay short: an entry here is a promise that the module installs the
 * global before anything can reach it, which is exactly the ordering assumption this test exists to
 * remove everywhere else.
 */
const ALLOWED = new Set([
  'src/services/scan/hermesShims.ts',
  'src/services/text/textCodec.ts',
]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return sourceFiles(full);
    }
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

/** Strip comments so prose ABOUT these globals (this file, and several long ones) is not a hit. */
function code(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(line => !/^\s*(\/\/|\*)/.test(line))
    .join('\n');
}

describe('Hermes-missing globals', () => {
  const files = sourceFiles(SRC).filter(
    f => !ALLOWED.has(relative(ROOT, f)),
  );

  it('scans a real, non-trivial set of files', () => {
    // Guards the guard: a broken walk would silently pass everything.
    expect(files.length).toBeGreaterThan(50);
  });

  it.each(MISSING_IN_HERMES)('nothing uses $pattern', ({ pattern, instead }) => {
    const offenders = files
      .filter(f => pattern.test(code(readFileSync(f, 'utf8'))))
      .map(f => `${relative(ROOT, f)} - use ${instead}`);
    expect(offenders).toEqual([]);
  });
});
