// The printed objects' shadows and geometry (031). Values come from the agreed canvas; these hold the
// properties a later edit by eye would break without noticing.

import { objectFilter, objectShadow } from '../../src/theme/depth';
import { perforation, securityTint, windowFilm } from '../../src/theme/print';

const SHADOWS = ['sheet', 'sheetEdge', 'envelope', 'envelopeHeader', 'letter', 'window', 'seal'] as const;
const FILTERS = ['slip', 'stamp', 'stampFab'] as const;

describe('object shadows', () => {
  it.each(SHADOWS)('%s exists in both themes', kind => {
    expect(objectShadow('light', kind)).toMatch(/px/);
    expect(objectShadow('dark', kind)).toMatch(/px/);
  });

  it.each(FILTERS)('%s is a single drop-shadow filter by day, so it follows the perforations', kind => {
    // One: iOS keeps only the last drop-shadow of a chain.
    expect(objectFilter('light', kind)).toMatch(/^drop-shadow\([^)]*\)\)$/);
  });

  it.each(['stamp', 'stampFab'] as const)('%s keeps its drop-shadow at night', kind => {
    expect(objectFilter('dark', kind)).toMatch(/^drop-shadow\(/);
  });

  it('lets a slip cast a soft black shadow at night, as boards R6 and R7 draw it', () => {
    // Until 031 R6 the night slip had only its 1 pt edge (the older DetailDark board); every board
    // agreed on 2026-11-12 draws this shadow and no edge.
    expect(objectFilter('dark', 'slip')).toBe('drop-shadow(0px 4px 10px rgba(0,0,0,0.35))');
  });

  it('casts a resting sheet\'s shadow below it, never a bevel on top (paper lies on the screen)', () => {
    for (const theme of ['light', 'dark'] as const) {
      expect(objectShadow(theme, 'sheet')).not.toMatch(/inset/);
    }
  });

  it('draws the window as an inset: the envelope\'s paper lies over its edge', () => {
    for (const theme of ['light', 'dark'] as const) {
      expect(objectShadow(theme, 'window')).toMatch(/^inset /);
    }
  });

  it('gives a dark sheet a faint edge in place of the light theme\'s shadow', () => {
    expect(objectShadow('dark', 'sheet')).not.toBe(objectShadow('light', 'sheet'));
    expect(objectShadow('dark', 'sheet')).toMatch(/^0px 0px 0px 1px rgba\(255,255,255,/);
  });
});

describe('print geometry', () => {
  it.each(Object.entries(perforation))('%s: the holes never run into each other', (_name, p) => {
    expect(p.pitch).toBeGreaterThan(2 * p.radius);
  });

  it('keeps the tint quieter at night, where the ground is darker', () => {
    expect(securityTint.opacity.dark).toBeLessThan(securityTint.opacity.light);
    expect(windowFilm.film.dark).toBeLessThan(windowFilm.film.light);
  });
});
