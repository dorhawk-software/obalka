// The card (DESIGN.md › Components › Cards, spec 028 D4): a sheet with weight - the surface and the
// inbox sheet's soft shadow, no line around it (031 Cards B, board R3, agreed 2026-11-12: "tone, not
// outlines"). In dark mode the lighter surface carries it, with a faint edge for a shadow.
//
// It lived in the settings screens, so everything outside them drew its own - 59 places with a radius, a
// border and a surface typed out, not all of them the same. The card owns those four; a caller decides
// only how it lays out what it holds (padding, gap, direction, alignment), so two cards cannot disagree
// about what a card looks like. `obalka/use-card` reports a hand-built one.

import type { ReactNode } from 'react';
import { YStack } from './ui';
import { useTheme } from './ThemeProvider';
import { objectShadow } from './depth';

/** Layout only: the look (radius, surface, shadow, clipping) is the card's own. */
type CardLayout = Readonly<Record<string, unknown>> & {
  readonly borderWidth?: never;
  readonly borderRadius?: never;
  readonly borderColor?: never;
  readonly backgroundColor?: never;
  readonly style?: never;
};

export const CARD_RADIUS = 14;

export function Card({ children, ...layout }: { readonly children: ReactNode } & CardLayout) {
  const theme = useTheme();
  return (
    // Clipped by default, so a pressed row's highlight keeps the card's corners; a card whose content
    // overhangs on purpose (an unread badge on an avatar's corner) may say `overflow="visible"`.
    <YStack
      overflow="hidden"
      {...layout}
      borderRadius={CARD_RADIUS}
      backgroundColor={theme.surface}
      style={{ boxShadow: objectShadow(theme.name, 'sheet') }}
    >
      {children}
    </YStack>
  );
}
