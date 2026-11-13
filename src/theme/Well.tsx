// A row's glyph in its well (031, boards R3, R7, R13): 40, the `lg` corner, sunken, the offset glyph at
// 24 in ink. Settings rows, the message's reminder row and its attachments card all lead with one.

import type { ReactNode } from 'react';
import { YStack } from './ui';
import { useTheme } from './ThemeProvider';
import { OffsetIcon, type OffsetGlyphName } from './offsetIcons';

/**
 * `name` draws the offset glyph; `children` a plain line glyph where the board draws one (R11's phone
 * at 22 in the refusal sheet), sized and inked by the caller.
 */
export function Well({ name, children }: { readonly name?: OffsetGlyphName; readonly children?: ReactNode }) {
  const theme = useTheme();
  return (
    <YStack
      width={40}
      height={40}
      borderRadius={12}
      alignItems="center"
      justifyContent="center"
      flexShrink={0}
      backgroundColor={theme.surfaceSunken}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {name ? <OffsetIcon name={name} size={24} color={theme.text} /> : children}
    </YStack>
  );
}
