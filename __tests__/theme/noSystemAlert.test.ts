// The app draws its own dialogs.
//
// `Alert.alert` is the OS one: system font, system spacing, ALL-CAPS buttons, none of the app's
// palette. Next to the paper design it reads as a different application - reported in exactly those
// terms ("the default modal is ugly as heck") after the backup screen shipped with one.
//
// There is no allowlist. Every confirm and every notice in this app goes through `theme/Dialog`,
// which is also where accessibility (a heading role on the title) and the safe-dismiss rule live.

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
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

/** Strip comments so prose about Alert (this rule is explained in several files) is not a hit. */
function code(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(line => !/^\s*(\/\/|\*)/.test(line))
    .join('\n');
}

describe('system alerts', () => {
  const files = sourceFiles(SRC);

  it('scans the whole app', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('are never used - the app has its own Dialog', () => {
    const offenders = files
      .filter(f => /\bAlert\s*\.\s*alert\s*\(/.test(code(readFileSync(f, 'utf8'))))
      .map(f => `${relative(ROOT, f)} - use theme/Dialog instead`);
    expect(offenders).toEqual([]);
  });
});
