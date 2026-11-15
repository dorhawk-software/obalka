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
export function Well({
  name,
  large = false,
  testID,
  children,
}: {
  readonly name?: OffsetGlyphName;
  /** The well that heads a sheet or a dialog (R9, R13): 56, the 16 corner, its glyph at 28. */
  readonly large?: boolean;
  readonly testID?: string;
  readonly children?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <YStack
      width={large ? 56 : 40}
      height={large ? 56 : 40}
      borderRadius={large ? 16 : 12}
      testID={testID}
      alignItems="center"
      justifyContent="center"
      flexShrink={0}
      backgroundColor={theme.surfaceSunken}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {name ? <OffsetIcon name={name} size={large ? 28 : 24} color={theme.text} /> : children}
    </YStack>
  );
}
