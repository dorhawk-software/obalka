// Every link the app hands to the system catches the refusal (031 I133).
//
// `Linking.openURL` rejects when nothing on the phone opens the address - no browser, a work profile
// that blocks it. Walked 2026-11-15: every place but Compose's "buy credit" link swallowed that; the
// one that did not raised an unhandled rejection, which the crash reporter would have sent as a crash.

import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const sources = execSync("git ls-files 'src/**/*.ts' 'src/**/*.tsx'", { cwd: ROOT, encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);

// One call and what follows it, up to the end of its statement.
const calls = sources.flatMap(file => {
  const text = readFileSync(join(ROOT, file), 'utf8');
  return [...text.matchAll(/Linking\.openURL\(/g)].map(m => {
    const rest = text.slice(m.index);
    const line = text.slice(0, m.index).split('\n').length;
    return { where: `${file}:${line}`, statement: rest.slice(0, rest.search(/;|\n\s*\n|\}\)?\s*\n\s*(accessibility|testID)/)) };
  });
});

it('finds the links it guards', () => {
  expect(calls.length).toBeGreaterThanOrEqual(5);
});

it.each(calls.map(c => [c.where, c.statement]))('%s catches a refusal', (_where, statement) => {
  expect(statement).toMatch(/\.catch\(/);
});
