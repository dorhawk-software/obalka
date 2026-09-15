// The spacing tokens are DESIGN.md's scale, name for name and value for value.
//
// `src/theme/spacing.ts` exists so a screen names a step instead of typing a number; that is only worth
// something while the names still mean what DESIGN.md says they mean.

import { readFileSync } from 'fs';
import { join } from 'path';
import { space } from '../../src/theme/spacing';

const DESIGN = readFileSync(join(__dirname, '../../DESIGN.md'), 'utf8');

/** The front matter's `spacing:` block, as `{ name: value }`. */
function designSpacing(): Record<string, number> {
  const block = DESIGN.split('\nspacing:\n')[1].split(/\n\S/)[0];
  return Object.fromEntries(
    [...block.matchAll(/^\s+([\w-]+): "(\d+)px"$/gm)].map(m => [m[1], Number(m[2])]),
  );
}

describe('spacing tokens', () => {
  it('reads a scale from DESIGN.md at all', () => {
    // Guards the guard: a parser that found nothing would compare an empty object with an empty one.
    expect(Object.keys(designSpacing()).length).toBeGreaterThan(4);
  });

  it('are the steps DESIGN.md names, with the values it gives them', () => {
    expect(space).toEqual(designSpacing());
  });
});
