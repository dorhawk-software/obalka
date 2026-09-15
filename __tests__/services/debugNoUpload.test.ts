// "Nothing is ever sent by itself."
//
// That is the promise the Debug screen makes to the user, and it is the reason they can reasonably
// tap a button that records their government mail to a file. A promise like that cannot rest on
// nobody adding an import later, so it is enforced here structurally rather than described.
//
// The rule is deliberately blunt: NO network API may appear anywhere under `src/services/debug/`.
// Not guarded by a flag, not behind a consent check, not "only for the manifest". If a future
// feature genuinely needs one, this test is where that argument has to be made and written down.

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(__dirname, '../..');
const DEBUG_DIR = join(ROOT, 'src/services/debug');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return sourceFiles(full);
    }
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

/** Strip comments: this rule is EXPLAINED in these files, and prose about it is not a violation. */
function code(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(line => !/^\s*(\/\/|\*)/.test(line))
    .join('\n');
}

const FORBIDDEN: readonly [RegExp, string][] = [
  [/\bfetch\s*\(/, 'fetch'],
  [/\bXMLHttpRequest\b/, 'XMLHttpRequest'],
  [/\bWebSocket\b/, 'WebSocket'],
  [/\bnavigator\s*\.\s*sendBeacon\b/, 'sendBeacon'],
  [/from\s+['"]@sentry\//, 'the Sentry SDK'],
  [/from\s+['"]axios['"]/, 'axios'],
  [/RNBlobUtil\s*\.\s*(config|fetch)\s*\(/, "react-native-blob-util's HTTP client"],
];

describe('the debug bundle never uploads itself', () => {
  const files = sourceFiles(DEBUG_DIR);

  it('has files to scan', () => {
    // Guards the guard: a rename that empties this directory must fail loudly, not pass silently.
    expect(files.length).toBeGreaterThanOrEqual(5);
  });

  it('contains no network API of any kind', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = code(readFileSync(file, 'utf8'));
      for (const [pattern, name] of FORBIDDEN) {
        if (pattern.test(source)) {
          offenders.push(`${relative(ROOT, file)} uses ${name}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('reaches the outside world only through the OS share sheet', () => {
    // The one sanctioned exit. The app hands the OS a path and learns nothing further: no
    // destination, no result, no "sent" callback. The user picks the recipient in a sheet this app
    // does not draw and cannot read. iOS: blob-util's options menu. Android: the app's own
    // ACTION_SEND module - not `actionViewIntent`, which OPENS a file and failed on a phone with no
    // zip viewer (found walking the emulator, 2026-09-15).
    const store = code(readFileSync(join(DEBUG_DIR, 'debugStore.ts'), 'utf8'));
    expect(store).toMatch(/\.shareFile\(/);
    expect(store).toMatch(/presentOptionsMenu/);
    expect(store).not.toMatch(/actionViewIntent/);
  });

  it('shares through a native module that has no network code either', () => {
    // The Android exit is the app's own Kotlin, so the rule has to follow it there: it hands a
    // content:// URI to the chooser and nothing else.
    const module = readFileSync(
      join(ROOT, 'android/app/src/main/java/com/obalkadatovaschranka/share/ShareFileModule.kt'),
      'utf8',
    );
    expect(module).toMatch(/Intent\.ACTION_SEND/);
    for (const forbidden of [/java\.net\./, /okhttp/i, /HttpURLConnection/, /\bSocket\b/]) {
      expect(module).not.toMatch(forbidden);
    }
  });
});
