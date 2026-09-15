// Text role components - the typography "visual library". Each bakes in a role's size/weight/
// line-height (from `typography.ts`) plus an AA-contrast default color, so screens compose legible,
// consistent text without repeating fontSize/color. Any prop (color, numberOfLines, flex, margins…)
// can still be overridden inline; overriding `fontSize` rescales the line box with it. Pass `dense` for
// the design's tight single-line list rows. On iOS, a line too short for the face's ink is drawn taller,
// with negative margins that take the extra back (DESIGN.md, The Whole Ink Rule): iOS clips ink to the
// line box. Android paints past it, and draws exactly the line and margins the caller set. Built on the
// themed `Text` primitive.

import { Platform } from 'react-native';
import { Text } from './ui';
import { useTheme } from './ThemeProvider';
import { inkLift } from './inkClipping';
import type { Theme } from './theme';
import {
  fonts,
  metricLeading,
  type as typeScale,
  type TextRole,
} from './typography';

// ui.Text is the Tamagui Text (typed `any` via the shim); role props are therefore passthrough.
type RoleProps = Record<string, unknown>;
type Weight = '400' | '500' | '600' | '700' | '800';

/**
 * Resolve the actual FONT FILE for an effective weight. Public Sans / Bricolage ship as 4-style
 * families - each weight is a SEPARATE face - so RN cannot reach a sibling weight via `family +
 * fontWeight` (Android ignores the weight, iOS keeps the named face). A `fontWeight` override on a role
 * component must therefore switch the face too, or it silently renders at the base face's weight (the
 * "all weights look identical" bug). Bricolage is bundled at 600/700/800; Public Sans at 400/500/600/
 * 700/800. An unavailable weight falls to the nearest bundled face.
 */
function faceForWeight(baseFamily: string, weight: Weight): string {
  if (baseFamily.startsWith('Bricolage')) {
    if (weight === '800') {
      return fonts.displayXBold;
    }
    if (weight === '600' || weight === '500' || weight === '400') {
      return fonts.displaySemiBold;
    }
    return fonts.displayBold; // 700
  }
  switch (weight) {
    case '800':
      return fonts.bodyXBold;
    case '700':
      return fonts.bodyBold;
    case '600':
      return fonts.bodySemiBold;
    case '500':
      return fonts.bodyMedium;
    default:
      return fonts.bodyRegular; // 400
  }
}

/**
 * The caller's vertical margins, each less `give`: the room a taller line adds above and below the
 * text on iOS, taken back so the Text's box stays the design's. The most specific margin the caller set wins,
 * as it would on the Text. Null when one is not a number (a token), which cannot be subtracted from.
 */
function takeBack(
  props: RoleProps,
  give: number,
): { marginTop: number; marginBottom: number } | null {
  const top = props.marginTop ?? props.marginVertical ?? props.margin ?? 0;
  const bottom = props.marginBottom ?? props.marginVertical ?? props.margin ?? 0;
  if (typeof top !== 'number' || typeof bottom !== 'number') {
    return null;
  }
  return { marginTop: top - give, marginBottom: bottom - give };
}

function roleComponent(role: TextRole, colorKey: keyof Theme) {
  const s = typeScale[role];
  return function RoleText(props: RoleProps) {
    const theme = useTheme();
    // The effective weight is the caller's override or the role default; from it we pick the actual
    // FACE. We then render with ONLY `fontFamily` (the resolved face) and pass NO `fontWeight`.
    // Reason: these are 4-style families (Medium/SemiBold/ExtraBold are each a separate iOS family),
    // and passing a `fontWeight` alongside a specific face makes iOS re-derive from the base family
    // and mis-render the non-Regular/Bold weights (the subject rendered as heavy as the sender on
    // iPhone). Android renders the named face regardless of weight, so dropping it changes nothing
    // there. `fontWeight` is destructured out so a caller's override can't leak back onto the Text.
    const {
      fontWeight,
      fontFamily,
      dense,
      fontSize: fontSizeProp,
      lineHeight: lineHeightProp,
      ...rest
    } = props;
    const weight = (fontWeight as Weight | undefined) ?? s.fontWeight;
    const family =
      (fontFamily as string | undefined) ?? faceForWeight(s.fontFamily, weight);

    // The LINE BOX has to follow the font size. A caller that overrode only `fontSize` used to keep the
    // role's line-height - a box sized for a DIFFERENT size - so 14px text sat in the 21px box meant for
    // 15px and every such row rendered taller than the design. The leading is therefore derived: the
    // role's own ratio normally, or the family's tight METRIC leading when `dense` (what the design's
    // list rows get, since they set no line-height). An explicit `lineHeight` wins as the design line.
    const fontSize = (fontSizeProp as number | undefined) ?? s.fontSize;
    const leading = dense
      ? metricLeading[s.fontFamily.startsWith('Bricolage') ? 'display' : 'body']
      : s.lineHeight / s.fontSize;
    const designLine =
      (lineHeightProp as number | undefined) ?? Math.round(fontSize * leading);

    // iOS cuts ink off at the edge of the line box (inkClipping.ts): a dense 14px row's 16px line
    // loses the ring of a capital Ů. So there the Text gets a line the ink fits, taller by a whole dp
    // or more on each side, and margins take the extra back - it still occupies the design's line to the
    // pixel, and its glyphs sit where Android draws them. Android is left exactly as the caller set it:
    // it never clipped, and there the swap is not layout-neutral - a Text is measured in whole pixels
    // at a fractional density, so a taller line with the difference taken back came out a fraction of a
    // pixel taller per Text, and an inbox of them several pixels lower (inkClipping.ts).
    const lift = Platform.OS === 'ios' ? inkLift(family, fontSize, designLine) : 0;
    const margins = lift > 0 ? takeBack(rest, lift) : null;

    return (
      <Text
        fontSize={fontSize}
        lineHeight={margins ? designLine + 2 * lift : designLine}
        letterSpacing={s.letterSpacing}
        color={theme[colorKey]}
        {...rest}
        {...margins}
        fontFamily={family}
      />
    );
  };
}

/** Main screen title (home). */
export const Display = roleComponent('display', 'text');
/** Stack-header titles, dialog titles, a message subject. */
export const Title = roleComponent('title', 'text');
/** Section headers, a box owner's name. */
export const Heading = roleComponent('heading', 'text');
/** Primary readable text. */
export const Body = roleComponent('body', 'text');
/** Emphasized body text. */
export const BodyStrong = roleComponent('bodyStrong', 'text');
/** The value paired with a label (box id, login name). */
export const Value = roleComponent('value', 'text');
/** Form / metadata field labels. */
export const Label = roleComponent('label', 'textMuted');
/** Metadata, timestamps, helper text. */
export const Caption = roleComponent('caption', 'textMuted');
/** Pill text - color is usually set by the pill. */
export const Badge = roleComponent('badge', 'text');
