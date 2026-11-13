// A row's glyph in its well (031, boards R3, R7, R13): 40, the `lg` corner, sunken, the offset glyph at
// 24 in ink. Settings rows, the message's reminder row and its attachments card all lead with one.

import { YStack } from './ui';
import { useTheme } from './ThemeProvider';
import { OffsetIcon, type OffsetGlyphName } from './offsetIcons';

export function Well({ name }: { readonly name: OffsetGlyphName }) {
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
      <OffsetIcon name={name} size={24} color={theme.text} />
    </YStack>
  );
}
