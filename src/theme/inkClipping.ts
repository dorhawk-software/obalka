// Where iOS clips a glyph, and the line height that keeps it whole (2026-09-24).
//
// iOS draws a Text into a view exactly as tall as its line boxes and loses whatever a glyph paints
// outside it; Android paints past it. So a line box too short for the ink shows on an iPhone only - the
// attention count lost the top of its "2" that way. The model, read from React Native 0.86's Fabric
// text layout (ReactCommon/react/renderer/textlayoutmanager/platform/ios/react/renderer/
// textlayoutmanager/):
//
//   RCTAttributedTextUtils.mm (`RCTEffectiveFontSizeMultiplierFromTextAttributes` and the
//   `!isnan(textAttributes.lineHeight)` branch): an explicit lineHeight L becomes an NSParagraphStyle
//   with minimumLineHeight = maximumLineHeight = L, times the same text-size multiplier as the font -
//   so only the ratio r = L / fontSize matters, at every Dynamic Type size.
//
//   TextKit (RCTTextLayoutManager.mm, usesFontLeading = NO) sits the baseline one font descent above
//   the bottom of that L-tall line: room beyond the font's own height lands above the ink, and a
//   shortfall comes off the top.
//
//   RCTAttributedTextUtils.mm, `RCTApplyBaselineOffsetForRange`: when L >= UIFont.lineHeight it adds
//   NSBaselineOffsetAttributeName = (L - UIFont.lineHeight) / 2, raising the ink to the middle - where
//   CSS and Android (CustomLineHeightSpan.kt: half the leading above, half below) put it. When
//   L < UIFont.lineHeight it returns before doing anything, so the ink stays pushed up.
//
// In ems, with a and d the font's hhea ascender and descender depth and H = a + d + lineGap (what
// UIFont.lineHeight is), the baseline lies below the top of the line box at
//
//   r >= H:  r / 2 + (a - d) / 2    centred - the same place as CSS and Android
//   r <  H:  r - d                  iOS only, (H - r) / 2 higher than Android draws it
//
// and ink reaching inkTop above and inkBottom below the baseline is cut when inkTop > baseline (the
// first line's top) or baseline + inkBottom > r (the last line's bottom). Lines in between overlap
// their neighbours instead, so a paragraph clips exactly where one line does. With no lineHeight the
// line is H tall: a face whose ink rises past its own ascender clips even then.
//
// The fix that keeps a design's metrics is the one the attention count got: a line tall enough for the
// ink, with negative margins that take the extra back, so the Text still occupies the design's line
// and - since r >= H is centred - draws its glyphs where Android and the design do. The role
// components in Typography.tsx apply it themselves, on iOS only; `inkLift` is the number.
//
// On iOS only, because on Android it is not layout-neutral (measured on a 2.625x Pixel, 2026-09-24:
// the inbox's attention header grew ~4px and pushed every row below it down). Android measures a Text
// as tall as its line in WHOLE pixels - CustomLineHeightSpan.kt takes `ceil(lineHeight * density)` -
// so a Text is ceil(L·d)/d dp tall, not L, and the overshoot depends on L: 19dp is 49.875px drawn as
// 50, 21dp is 55.125px drawn as 56. Swapping the design line for a taller one changes that overshoot,
// negative margins take back exactly 2k dp and not the difference, and Yoga then snaps every edge -
// with margins of 2.625px, or 1.3125px for a half-dp one - to the pixel grid. Each Text came out a
// fraction of a pixel taller, and a screen of them added up to whole pixels. Android never clipped in
// the first place, so there it draws exactly what the caller asked for.
//
// iOS measures the same way (RCTTextLayoutManager.mm rounds a Text's size UP to the pixel grid), but
// its grid is whole: 2x or 3x. A whole-dp line and whole-dp margins are then whole pixels, and nothing
// is rounded - which is why the lift is whole dp on each side, never half of an odd one.

import { fonts } from './typography';

/** One face's vertical metrics and the reach of its ink, in ems of the font size. */
export interface FaceInk {
  /** hhea ascender, above the baseline. */
  readonly ascender: number;
  /** hhea descender, as a depth below the baseline. */
  readonly descender: number;
  readonly lineGap: number;
  /** How far the tallest glyph the app can set reaches above the baseline. */
  readonly inkTop: number;
  /** How far the deepest one reaches below it. */
  readonly inkBottom: number;
}

/**
 * The bundled faces, measured from their .ttf files over printable ASCII, every Czech letter, the
 * cedillas and the UI's typographic symbols (`__tests__/helpers/textClipping.ts`, and
 * `theme/inkClipping.test.ts` fails when a font file and this table part). Public Sans's tallest is Ů,
 * whose ring rises past the face's own ascender; Bricolage's is Č.
 */
export const bundledInk: Readonly<Record<(typeof fonts)[keyof typeof fonts], FaceInk>> = {
  'BricolageGrotesque-SemiBold': { ascender: 0.93, descender: 0.27, lineGap: 0, inkTop: 0.913, inkBottom: 0.239 },
  'BricolageGrotesque-Bold': { ascender: 0.93, descender: 0.27, lineGap: 0, inkTop: 0.918, inkBottom: 0.235 },
  'BricolageGrotesque-ExtraBold': { ascender: 0.93, descender: 0.27, lineGap: 0, inkTop: 0.923, inkBottom: 0.232 },
  'PublicSans-Regular': { ascender: 0.95, descender: 0.225, lineGap: 0, inkTop: 0.9875, inkBottom: 0.206 },
  'PublicSans-Medium': { ascender: 0.95, descender: 0.225, lineGap: 0, inkTop: 0.988, inkBottom: 0.2075 },
  'PublicSans-SemiBold': { ascender: 0.95, descender: 0.225, lineGap: 0, inkTop: 0.9885, inkBottom: 0.2095 },
  'PublicSans-Bold': { ascender: 0.95, descender: 0.225, lineGap: 0, inkTop: 0.989, inkBottom: 0.2125 },
  'PublicSans-ExtraBold': { ascender: 0.95, descender: 0.225, lineGap: 0, inkTop: 0.9905, inkBottom: 0.216 },
};

/**
 * iOS's system font (SF Pro), where a Text names no family: UIFont.systemFont at 17pt has an ascender
 * of 16.19, a descender of 4.10 and a lineHeight of 20.29 - 0.9521, 0.2412 and 1.1933 of its size.
 * Its file is not ours to measure, so its ink is taken to stay inside those: the room Apple draws its
 * accents in. In effect a system-font line has to be at least its own height.
 */
export const systemInk: FaceInk = {
  ascender: 0.9521,
  descender: 0.2412,
  lineGap: 0,
  inkTop: 0.9521,
  inkBottom: 0.2412,
};

/**
 * Ink cut by less than this is let through: 0.05dp, a sixth of a pixel on a 3x screen and the same as
 * the glyph boxes' own overstatement at text sizes - measurement noise, not a visible edge.
 */
export const CLIP_TOLERANCE_DP = 0.05;

/** The ink table for a style's `fontFamily`; the system font when there is none; else undefined. */
export function inkFor(fontFamily: string | undefined): FaceInk | undefined {
  if (fontFamily == null || fontFamily === 'System') {
    return systemInk;
  }
  return (bundledInk as Record<string, FaceInk>)[fontFamily];
}

/** The font's own line height H, in ems: what a Text with no lineHeight gets. */
export function naturalLeading(ink: FaceInk): number {
  return ink.ascender + ink.descender + ink.lineGap;
}

/** Depth of the baseline below the top of an r-tall line box on iOS, in ems (the model above). */
export function iosBaseline(ink: FaceInk, ratio: number): number {
  return ratio >= naturalLeading(ink)
    ? ratio / 2 + (ink.ascender - ink.descender) / 2
    : ratio - ink.descender;
}

/** How far, in dp, ink sticks out of the top and the bottom of the line box on iOS. */
export function iosInkOverflow(
  ink: FaceInk,
  fontSize: number,
  lineHeight: number,
): { top: number; bottom: number } {
  const ratio = lineHeight / fontSize;
  const baseline = iosBaseline(ink, ratio);
  return {
    top: Math.max(0, ink.inkTop - baseline) * fontSize,
    bottom: Math.max(0, baseline + ink.inkBottom - ratio) * fontSize,
  };
}

/** Whether iOS cuts ink of `ink` at `fontSize` on `lineHeight` by more than the tolerance. */
export function iosClips(ink: FaceInk, fontSize: number, lineHeight: number): boolean {
  const over = iosInkOverflow(ink, fontSize, lineHeight);
  return Math.max(over.top, over.bottom) > CLIP_TOLERANCE_DP;
}

/**
 * The smallest lineHeight / fontSize at which nothing clips: below H the top is safe from
 * inkTop + d while the bottom is safe only if inkBottom <= d; from H up the line is centred and the
 * top needs 2·inkTop - a + d, the bottom 2·inkBottom + a - d. Safe ratios run upward from this one.
 */
export function safeLeading(ink: FaceInk): number {
  const tight = ink.inkTop + ink.descender;
  if (ink.inkBottom <= ink.descender && tight < naturalLeading(ink)) {
    return tight;
  }
  return Math.max(
    naturalLeading(ink),
    2 * ink.inkTop - ink.ascender + ink.descender,
    2 * ink.inkBottom + ink.ascender - ink.descender,
  );
}

/**
 * `lineHeight` itself when iOS draws `fontFamily` at `fontSize` on it whole, else the smallest whole
 * dp above it that does. A family with no ink table (not bundled, not the system font) is returned
 * unchanged - the render-time audit in the tests reports those.
 */
export function inkSafeLineHeight(
  fontFamily: string | undefined,
  fontSize: number,
  lineHeight: number,
): number {
  const ink = inkFor(fontFamily);
  if (ink == null || !iosClips(ink, fontSize, lineHeight)) {
    return lineHeight;
  }
  let safe = Math.max(Math.ceil(lineHeight), Math.floor(fontSize * safeLeading(ink)));
  while (iosClips(ink, fontSize, safe)) {
    safe += 1;
  }
  return safe;
}

/**
 * How many whole dp a role component adds above AND below `designLine` so iOS draws `fontFamily` at
 * `fontSize` whole: 0 when the design line already holds the ink. The Text is drawn on
 * `designLine + 2·lift` with each vertical margin `lift` smaller, so it occupies the design line
 * exactly, and - the lift being whole dp - every edge of it is a whole pixel at 2x and 3x, where a
 * half-dp lift (the smallest safe line, when it is an odd number of dp above the design's) would be
 * 1.5px at 3x and left to Yoga's rounding. Safe lines run upward (`safeLeading`), so the first even
 * step that fits is the smallest one that does. A family with no ink table gets 0, as in
 * `inkSafeLineHeight`.
 */
export function inkLift(
  fontFamily: string | undefined,
  fontSize: number,
  designLine: number,
): number {
  const ink = inkFor(fontFamily);
  if (ink == null) {
    return 0;
  }
  let lift = 0;
  while (iosClips(ink, fontSize, designLine + 2 * lift)) {
    lift += 1;
  }
  return lift;
}
