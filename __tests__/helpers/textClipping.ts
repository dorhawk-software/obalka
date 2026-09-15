// The ink the bundled faces can draw, measured from the .ttf files themselves - the numbers
// `src/theme/inkClipping.ts` carries for the app, and `theme/inkClipping.test.ts` holds it to.
//
// Each glyph's reach is its `glyf` header box: the compiler writes the box of the outline's control
// points, which contains the drawn curve and overstates it by at most 0.004em in these fonts (checked
// against fontTools' outline bounds, 2026-09-24) - so the measure errs toward clipping.

import { fontFace } from './fontMetrics';
import { fonts } from '../../src/theme/typography';
import type { FaceInk } from '../../src/theme/inkClipping';

/**
 * The characters a face is held to: printable ASCII, every Czech letter in both cases, the cedillas
 * (the deepest Latin descenders these faces carry) and the typographic symbols the UI sets. Czech
 * comes first, so a tie for the tallest glyph is reported as the letter this app meets most. A symbol
 * a face lacks is drawn by a system fallback font whose ink these files cannot tell, and is skipped.
 */
export const INK_CHARSET = (() => {
  let chars = 'ÁČĎÉĚÍŇÓŘŠŤÚŮÝŽáčďéěíňóřšťúůýž';
  for (let c = 0x20; c <= 0x7e; c += 1) {
    chars += String.fromCharCode(c);
  }
  return chars + 'ÇçŞşŢţ' + '·–—‘’‚“”„…•→←‹›€§°×−≥≤≈✓⇒';
})();

/** The faces the app bundles, by the PostScript name a style's `fontFamily` carries. */
export const BUNDLED_FACES: readonly string[] = Object.values(fonts);

/** A face's measured ink, with the characters that reach furthest up and down. */
export interface MeasuredInk extends FaceInk {
  readonly topChar: string;
  readonly bottomChar: string;
}

/**
 * The line a Text takes in the layout: its line box plus its own vertical margins. A role component
 * whose design line is too short for its ink draws on a taller line and takes the extra back with
 * negative margins (Typography.tsx), so its `lineHeight` alone overstates the room it occupies.
 */
export function occupiedLine(style: {
  readonly lineHeight?: unknown;
  readonly marginTop?: unknown;
  readonly marginBottom?: unknown;
}): number {
  const n = (v: unknown) => (typeof v === 'number' ? v : 0);
  return n(style.lineHeight) + n(style.marginTop) + n(style.marginBottom);
}

/** Measures one bundled face, by PostScript name, over `chars`. */
export function measureInk(face: string, chars: string = INK_CHARSET): MeasuredInk {
  const font = fontFace(`${face}.ttf`);
  let top = { y: -Infinity, ch: '' };
  let bottom = { y: Infinity, ch: '' };
  for (const ch of chars) {
    const ink = font.has(ch) ? font.ink(ch) : null;
    if (ink == null) {
      continue;
    }
    if (ink.yMax > top.y) {
      top = { y: ink.yMax, ch };
    }
    if (ink.yMin < bottom.y) {
      bottom = { y: ink.yMin, ch };
    }
  }
  const m = font.metrics;
  return {
    ascender: m.ascender,
    descender: -m.descender,
    lineGap: m.lineGap,
    inkTop: top.y,
    inkBottom: -bottom.y,
    topChar: top.ch,
    bottomChar: bottom.ch,
  };
}
