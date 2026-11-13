// The neutral button (031, boards R6 and R14): a `sunken` fill with the card's 14 corner and the label
// in ink, 15/700 - tone, not an outline. R14 draws it 52 tall on its own; R6 sets two side by side at
// 48 (`compact`); R4 sizes it to its words, 24 at each side, under a failed state's words (`inline`).
// The press is PressScale's dip, as every button's.

import { XStack } from './ui';
import { BodyStrong } from './Typography';
import { useTheme } from './ThemeProvider';
import { PressScale } from './PressScale';

export function NeutralButton({
  label,
  onPress,
  busy,
  compact = false,
  inline = false,
  testID,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly busy?: boolean;
  /** 48 tall, for a pair in one row (R6); 52 alone (R14). */
  readonly compact?: boolean;
  /** As wide as its words with 24 at each side, centred under them (R4); otherwise the column's width. */
  readonly inline?: boolean;
  readonly testID?: string;
}) {
  const theme = useTheme();
  return (
    <PressScale fullWidth={!inline} onPress={onPress} busy={busy} accessibilityLabel={label} testID={testID}>
      <XStack
        width={inline ? undefined : '100%'}
        minHeight={compact ? 48 : 52}
        borderRadius={14}
        backgroundColor={theme.surfaceSunken}
        alignItems="center"
        justifyContent="center"
        paddingHorizontal={inline ? 24 : 12}
      >
        <BodyStrong color={theme.text} textAlign="center">
          {label}
        </BodyStrong>
      </XStack>
    </PressScale>
  );
}
