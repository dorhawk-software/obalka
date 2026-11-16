// A blue text link on the backup screen, out of BackupScreen.tsx (its size limit, 031 T050.5).

import type { ReactNode } from 'react';
import { XStack } from '../../theme/ui';
import { SmallStrong } from '../../theme/Typography';
import { touchSlop } from '../../theme/touchTarget';
import { space } from '../../theme/spacing';
import { useTheme } from '../../theme/ThemeProvider';

/** R1's help link: 44 tall, the slop takes it to the target. */
export const LINK_HEIGHT = 44;

/** R10's link under the key field: its glyph and words in blue, 44 tall (R1's link). */
export function KeyLink({
  icon,
  label,
  onPress,
  busy = false,
  testID,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly onPress: () => void;
  readonly busy?: boolean;
  readonly testID: string;
}) {
  const theme = useTheme();
  return (
    <XStack
      alignSelf="flex-start"
      minHeight={LINK_HEIGHT}
      paddingHorizontal={space.xs}
      alignItems="center"
      gap={space.sm}
      hitSlop={touchSlop({ height: LINK_HEIGHT })}
      onPress={onPress}
      pressStyle={{ opacity: 0.5 }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy }}
      testID={testID}
    >
      {icon}
      <SmallStrong color={theme.blue}>{label}</SmallStrong>
    </XStack>
  );
}
