// A floating surface's edge in dark mode (2026-11-11). `depth.lg`'s white bevel lights only the top edge;
// on a dark dialog it read as a bright top fading out down the sides and gone at the bottom - "the border
// looks weird, non uniform top and bottom". Every raised surface takes its shadow from `raised`, which
// picks the dark-mode edge, so none can fall back to the bevel by forgetting a branch.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { depth, raised } from '../../src/theme/depth';

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return sources(path);
    }
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('raised', () => {
  it('keeps the bevel in light mode', () => {
    expect(raised('light', 'float')).toBe(depth.lg);
    expect(raised('light', 'sheet')).toBe(depth.lg);
  });

  it('draws a dark card with an even edge all round - no top-only highlight', () => {
    const dark = raised('dark', 'float');
    expect(dark).toMatch(/inset 0px 0px 0px 1px/);
    expect(dark).not.toMatch(/inset 0px 1px/);
  });

  it('gives a dark sheet the soft edge it had', () => {
    expect(raised('dark', 'sheet')).toBe(depth.sheetDark);
  });
});

describe('the big bevel', () => {
  it('is taken through `raised` everywhere - never as depth.lg straight on a surface', () => {
    const offenders = sources(join(__dirname, '../../src'))
      .filter(path => !path.endsWith(join('theme', 'depth.ts')))
      .filter(path =>
        readFileSync(path, 'utf8')
          .split('\n')
          .some(line => /depth\.lg\b/.test(line) && !/^\s*(\/\/|\*)/.test(line)),
      );
    expect(offenders).toEqual([]);
  });
});
