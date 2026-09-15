// The design-lint rules read what the system is from `tools/eslint-plugin-obalka/tokens.json`; this
// derives that file from the theme and DESIGN.md and fails when the two disagree (spec 028). A rule
// enforcing a scale the app no longer has would be worse than no rule.
//
// After changing a role, a spacing step, a radius step or a palette colour:
//   UPDATE_TOKENS=1 npx jest __tests__/lint/designTokens.test.ts

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { type as typeScale } from '../../src/theme/typography';
import { space } from '../../src/theme/spacing';
import { darkTheme, lightTheme } from '../../src/theme/theme';

const ROOT = join(__dirname, '../..');
const FILE = join(ROOT, 'tools/eslint-plugin-obalka/tokens.json');

function derive() {
  const roles = Object.fromEntries(
    Object.entries(typeScale).map(([key, s]) => {
      const family = s.fontFamily.startsWith('Bricolage') ? 'Bricolage' : 'Public Sans';
      return [
        key[0].toUpperCase() + key.slice(1),
        {
          size: s.fontSize,
          line: s.lineHeight,
          weight: Number(s.fontWeight),
          family,
          face: `${family} ${s.fontWeight}`,
          ...(s.textTransform ? { uppercase: true } : {}),
        },
      ];
    }),
  );
  const design = readFileSync(join(ROOT, 'DESIGN.md'), 'utf8');
  const shapes = design.split('\n## Shapes\n')[1].split('```')[1];
  const radii = [...shapes.matchAll(/^(\d+)\s+(.+)$/gm)].map(m => ({
    value: Number(m[1]),
    use: m[2].replace(/\s+←.*$/, '').trim().replace(/,$/, ''),
  }));
  const palette: Record<string, string[]> = {};
  for (const theme of [lightTheme, darkTheme]) {
    for (const [name, value] of Object.entries(theme)) {
      if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) {
        const names = (palette[value.toUpperCase()] ??= []);
        if (!names.includes(name)) {
          names.push(name);
        }
      }
    }
  }
  return { roles, space, radii, palette };
}

describe('the design-lint tokens', () => {
  it('are what the theme and DESIGN.md say', () => {
    const derived = `${JSON.stringify(derive(), null, 2)}\n`;
    if (process.env.UPDATE_TOKENS) {
      writeFileSync(FILE, derived);
    }
    const stored = readFileSync(FILE, 'utf8');
    if (stored !== derived) {
      throw new Error(
        'tools/eslint-plugin-obalka/tokens.json is stale: the theme or DESIGN.md changed under it.\n' +
          'Regenerate it with UPDATE_TOKENS=1 npx jest __tests__/lint/designTokens.test.ts and review the diff.',
      );
    }
  });

  it('found every scale it reads', () => {
    const tokens = derive();
    expect(Object.keys(tokens.roles)).toContain('Meta');
    expect(tokens.radii.map(r => r.value)).toEqual(expect.arrayContaining([8, 11, 14, 999]));
    expect(Object.keys(tokens.palette).length).toBeGreaterThan(20);
  });
});
