// The bordered card (DESIGN.md › Components › Cards, spec 028 D4).
//
// It lived in the settings screens, so everything outside them drew its own - 59 places with a radius, a
// border and a surface typed out, not all of them the same. The card owns those four; a caller decides
// only how it lays out what it holds (padding, gap, direction, alignment), so two cards cannot disagree
// about what a card looks like. `obalka/use-card` reports a hand-built one.

import type { ReactNode } from 'react';
import { YStack } from './ui';
import { useTheme } from './ThemeProvider';

/** Layout only: the look (border, radius, surface, clipping) is the card's own. */
type CardLayout = Readonly<Record<string, unknown>> & {
  readonly borderWidth?: never;
  readonly borderRadius?: never;
  readonly borderColor?: never;
  readonly backgroundColor?: never;
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
      borderWidth={1}
      borderRadius={CARD_RADIUS}
      borderColor={theme.border}
      backgroundColor={theme.surface}
    >
      {children}
    </YStack>
  );
}
