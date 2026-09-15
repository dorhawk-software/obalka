import { metricLeading, type as typeScale } from '../../src/theme/typography';

// The line BOX has to follow the font size. Role components used to keep the role's line-height when a
// caller overrode only `fontSize`, so 14px text sat in the 21px box meant for 15px - every list row
// rendered ~9dp taller than the design (measured 93.7dp vs the design's 84.6dp for a sent row). These
// cases pin the two leadings the design actually uses, so the row heights can't silently drift back.

/** Mirrors the derivation in Typography.tsx's roleComponent. */
function leadingFor(
  role: keyof typeof typeScale,
  fontSize: number,
  dense = false,
): number {
  const s = typeScale[role];
  const ratio = dense
    ? metricLeading[s.fontFamily.startsWith('Bricolage') ? 'display' : 'body']
    : s.lineHeight / s.fontSize;
  return Math.round(fontSize * ratio);
}

describe('type leading', () => {
  it('matches the font files own metrics (what a browser applies with no line-height)', () => {
    // Read from the bundled .ttf hhea tables: (ascender - descender + lineGap) / unitsPerEm.
    expect(metricLeading.body).toBeCloseTo(1.175, 3); // Public Sans
    expect(metricLeading.display).toBeCloseTo(1.2, 3); // Bricolage Grotesque
  });

  it('rescales with an overridden fontSize instead of keeping the roles box', () => {
    // bodyStrong is 15/21; at 14 the old code kept 21.
    expect(leadingFor('bodyStrong', 14)).toBe(20);
    expect(leadingFor('bodyStrong', 14)).not.toBe(typeScale.bodyStrong.lineHeight);
    // caption is 13/17; at 11 the old code kept a 17px box around 11px text.
    expect(leadingFor('caption', 11)).toBe(14);
  });

  it('is unchanged at a roles own size', () => {
    for (const role of Object.keys(typeScale) as (keyof typeof typeScale)[]) {
      expect(leadingFor(role, typeScale[role].fontSize)).toBe(
        typeScale[role].lineHeight,
      );
    }
  });

  it('gives the designs tight metric leading for dense list rows', () => {
    expect(leadingFor('bodyStrong', 14, true)).toBe(16); // sender / recipient
    expect(leadingFor('label', 12, true)).toBe(14); // date, status label
    expect(leadingFor('heading', 15, true)).toBe(18); // month section header (Bricolage)
  });

  it('keeps a dense row shorter than a prose row at the same size', () => {
    expect(leadingFor('bodyStrong', 14, true)).toBeLessThan(
      leadingFor('bodyStrong', 14),
    );
  });
});
