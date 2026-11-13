// The neutral button (031, boards R6 and R14): a `sunken` fill with the card's 14 corner and the label
// in ink, 15/700 - tone, not an outline. R14 draws it 52 tall on its own; R6 sets two side by side at
// 48 (`compact`). The press is PressScale's dip, as every button's.

import { XStack } from './ui';
import { BodyStrong } from './Typography';
import { useTheme } from './ThemeProvider';
import { PressScale } from './PressScale';

export function NeutralButton({
  label,
  onPress,
  busy,
  compact = false,
  testID,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly busy?: boolean;
  /** 48 tall, for a pair in one row (R6); 52 alone (R14). */
  readonly compact?: boolean;
  readonly testID?: string;
}) {
  const theme = useTheme();
  return (
    <PressScale fullWidth onPress={onPress} busy={busy} accessibilityLabel={label} testID={testID}>
      <XStack
        width="100%"
        minHeight={compact ? 48 : 52}
        borderRadius={14}
        backgroundColor={theme.surfaceSunken}
        alignItems="center"
        justifyContent="center"
        paddingHorizontal={12}
      >
        <BodyStrong color={theme.text} textAlign="center">
          {label}
        </BodyStrong>
      </XStack>
    </PressScale>
  );
}
