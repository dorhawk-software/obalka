// Typography scale - the single source of truth for text sizes/weights/line-heights/family (the "visual
// library"). Screens use the role components in `Typography.tsx` rather than ad-hoc fontSize/color, so
// sizing stays consistent and accessible everywhere. Minimum content size is 13 and the default colors
// (see Typography.tsx) are AA-contrast tokens - never the faint placeholder grey.
//
// Redesign (009): two families - Bricolage Grotesque for display/headings, Public Sans for body/UI
// (see specs/009-visual-redesign/design-system.md §2). `fontFamily` strings must match the bundled
// fonts (pinned at task T002 after the first build); if a family is missing, RN falls back to system
// sans at the SAME size/line-height, so layout never shifts.
//
// Roles, largest → smallest:
//   display    - the main screen title (home / welcome)        [Bricolage Grotesque]
//   title      - stack-header titles, dialog titles, a subject  [Bricolage Grotesque]
//   heading    - section headers, a box owner's name            [Bricolage Grotesque]
//   body       - primary readable text                          [Public Sans]
//   bodyStrong - emphasized body                                [Public Sans]
//   value      - the value paired with a label (box id, login)  [Public Sans]
//   label      - form / metadata field labels                   [Public Sans]
//   caption    - metadata, timestamps, helper text              [Public Sans]
//   badge      - pill text                                       [Public Sans]

export type TextRole =
  | 'display'
  | 'title'
  | 'heading'
  | 'body'
  | 'bodyStrong'
  | 'value'
  | 'label'
  | 'caption'
  | 'badge';

export interface TypeStyle {
  fontSize: number;
  lineHeight: number;
  fontWeight: '400' | '500' | '600' | '700' | '800';
  letterSpacing?: number;
  fontFamily: string;
}

// Pinned to the bundled fonts' PostScript names (verified from the .ttf name tables - these equal the
// react-native-asset file basenames, so the SAME string resolves on iOS and Android). Per-FACE names
// are required: Public Sans / Bricolage Grotesque use 4-style family grouping, so Medium/SemiBold/
// ExtraBold are SEPARATE families that `family + fontWeight` can't reach. `fontWeight` below is kept
// only so the system-sans fallback renders the right weight if a face ever fails to load.
export const fonts = {
  displayXBold: 'BricolageGrotesque-ExtraBold', // 800
  displayBold: 'BricolageGrotesque-Bold', // 700
  displaySemiBold: 'BricolageGrotesque-SemiBold', // 600
  bodyRegular: 'PublicSans-Regular', // 400
  bodyMedium: 'PublicSans-Medium', // 500
  bodySemiBold: 'PublicSans-SemiBold', // 600
  bodyBold: 'PublicSans-Bold', // 700
  bodyXBold: 'PublicSans-ExtraBold', // 800
} as const;

export const type: Record<TextRole, TypeStyle> = {
  display: { fontSize: 26, lineHeight: 31, fontWeight: '800', letterSpacing: -0.5, fontFamily: fonts.displayXBold },
  title: { fontSize: 21, lineHeight: 26, fontWeight: '800', letterSpacing: -0.4, fontFamily: fonts.displayXBold },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '700', letterSpacing: -0.2, fontFamily: fonts.displayBold },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400', fontFamily: fonts.bodyRegular },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '700', fontFamily: fonts.bodyBold },
  value: { fontSize: 14, lineHeight: 19, fontWeight: '600', fontFamily: fonts.bodySemiBold },
  label: { fontSize: 13, lineHeight: 17, fontWeight: '600', fontFamily: fonts.bodySemiBold },
  caption: { fontSize: 13, lineHeight: 17, fontWeight: '500', fontFamily: fonts.bodyMedium },
  badge: { fontSize: 13, lineHeight: 16, fontWeight: '700', fontFamily: fonts.bodyBold },
};

// Each family's own METRIC leading, in ems: (hhea ascender − descender + lineGap) / unitsPerEm, read
// from the bundled .ttf files. This is precisely the leading a browser applies when an element sets no
// `line-height` - so it is what the design's DENSE elements get. The design uses two leadings on
// purpose: it sets ~1.4 explicitly on prose (14→20, 13→18, 12→16) and leaves the tight metric leading
// on single-line list-row text. The roles above all bake in the prose leading, so dense rows need this
// (see the `dense` prop in Typography.tsx) or every row renders ~9dp taller than the design.
export const metricLeading = { body: 1.175, display: 1.2 } as const;
