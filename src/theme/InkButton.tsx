// The filled button (the boards' `fbtn`): ink, 52 tall, the card's 14 corner, the label 15/700 in the
// paper colour. The one action a screen leads to - send, receive, continue. A button whose requirement
// is unmet is drawn at .55, as R10 draws Přijmout with an empty field, and still answers a press with
// PressScale's refusal, so the reason is felt and heard rather than the press swallowed (019).
// `small` is R13's half of a pair inside a card row: 40 tall, the 12 corner, the label 14/700.

import { XStack } from './ui';
import { BodyStrong, SmallStrong } from './Typography';
import { useTheme } from './ThemeProvider';
import { PressScale } from './PressScale';

export function InkButton({
  label,
  onPress,
  busy,
  blockedReason,
  onBlockedPress,
  small = false,
  accessibilityLabel,
  testID,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly busy?: boolean;
  /** What is missing, while it is. */
  readonly blockedReason?: string;
  /** Where the refusal sends focus. */
  readonly onBlockedPress?: () => void;
  /** R13's row button, one of two side by side: 40 tall, the 12 corner, 14/700. */
  readonly small?: boolean;
  /** What a screen reader hears when the words alone do not say what they act on. */
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}) {
  const theme = useTheme();
  const blocked = !busy && blockedReason != null;
  return (
    <PressScale
      fullWidth
      onPress={onPress}
      busy={busy}
      blockedReason={blockedReason}
      onBlockedPress={onBlockedPress}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
    >
      <XStack
        width="100%"
        minHeight={small ? 40 : 52}
        borderRadius={small ? 12 : 14}
        backgroundColor={theme.text}
        alignItems="center"
        justifyContent="center"
        opacity={blocked ? 0.55 : 1}
      >
        {small ? (
          <SmallStrong color={theme.surfaceAlt}>{label}</SmallStrong>
        ) : (
          <BodyStrong color={theme.surfaceAlt}>{label}</BodyStrong>
        )}
      </XStack>
    </PressScale>
  );
}
