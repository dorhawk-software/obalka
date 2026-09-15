// The icon SCALE (feature 016) - the tiers Claude Design defined, as components.
//
// The app had exactly one size of icon: a 13–22px stroke, everywhere, at the same visual weight, so
// no screen ever had a focal point that was not text. The design's answer is four tiers, and the rule
// that governs them is about MEANING rather than size:
//
//   > A big glyph goes only where there is nothing it could be a statement about - an empty list, a
//   > finished action, a screen with no message on it. If a screen shows even one real message, the
//   > largest icon on it stays inline.
//
// Which is why this module exists as tiers rather than as a `size` prop on every glyph: a size prop
// invites "make it bigger here", and the whole discipline is that the tier is a claim about the
// screen, not a preference about the picture.
//
// Note the stroke weights move AGAINST size - 2 inline, 1.9 at emblem, 1.25 at hero. A 132px glyph at
// stroke 2 is a slab; the taper is what keeps it atmospheric.
//
// `feature` (44 in a 72px tinted box) is defined by the design but NOT implemented here: its only
// placement is the notification primer sheet, a screen 014 deleted and 010 chose not to restore.
// Bringing it back is a decision about behaviour, not iconography, so the tier arrives with the
// screen that needs it.

import type { ComponentType } from 'react';
import { YStack } from './ui';
import { useTheme } from './ThemeProvider';

/** What a Lucide glyph component accepts - the same shape `icons.tsx` re-exports. */
type Glyph = ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
}>;

/** Sizes and strokes, from `Icon Scale.dc.html`. Do not tune per screen (Principle V). */
export const ICON_TIER = {
  inline: { size: 18, stroke: 2 },
  feature: { glyph: 44, box: 72, radius: 22, stroke: 1.9 },
  emblem: { glyph: 44, box: 96, radius: 28, stroke: 1.9 },
  hero: { size: 132, stroke: 1.25 },
} as const;

/**
 * HERO - a 132px decorative glyph for empty and zero states.
 *
 * Hidden from assistive technology, because it says nothing the headline beneath it does not, and a
 * 132px shape announced to a screen reader is noise for the people least able to skip it.
 *
 * The fixed 132px box is not decoration: it means the glyph cannot resize anything when it renders,
 * which is the layout-jump rule the app has broken twice (Principle V).
 */
export function HeroIcon({ glyph: Glyph }: { readonly glyph: Glyph }) {
  const theme = useTheme();
  return (
    <YStack
      width={ICON_TIER.hero.size}
      height={ICON_TIER.hero.size}
      alignItems="center"
      justifyContent="center"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Glyph
        size={ICON_TIER.hero.size}
        color={theme.heroInk}
        strokeWidth={ICON_TIER.hero.stroke}
      />
    </YStack>
  );
}

/**
 * EMBLEM - a 44px white glyph knocked out of a 96px solid brand-blue tile.
 *
 * The loudest tier, and the most restricted: per the design it may state only "a fact the app knows
 * and the text already says". In practice that is one screen - a message has been sent, the app has
 * the ID in its hand, and the headline says so. It must never appear beside a message whose legal
 * state the app is merely reporting.
 *
 * Also hidden from assistive technology: the headline it sits above carries the meaning.
 */
export function EmblemIcon({ glyph: Glyph }: { readonly glyph: Glyph }) {
  const theme = useTheme();
  return (
    <YStack
      width={ICON_TIER.emblem.box}
      height={ICON_TIER.emblem.box}
      borderRadius={ICON_TIER.emblem.radius}
      backgroundColor={theme.brandTile}
      alignItems="center"
      justifyContent="center"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ boxShadow: '0px 14px 34px rgba(33,50,90,0.32)' }}
    >
      <Glyph
        size={ICON_TIER.emblem.glyph}
        // `onSolid`, not `onBlue`: `brandTile` is fixed in both appearances, so the glyph on it is
        // white in both. As `onBlue` it went near-black at night - 3.36:1 on the tile.
        color={theme.onSolid}
        strokeWidth={ICON_TIER.emblem.stroke}
      />
    </YStack>
  );
}
