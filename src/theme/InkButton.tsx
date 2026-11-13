// The filled button (the boards' `fbtn`): ink, 52 tall, the card's 14 corner, the label 15/700 in the
// paper colour. The one action a screen leads to - send, receive, continue. A button whose requirement
// is unmet is drawn at .55, as R10 draws Přijmout with an empty field, and still answers a press with
// PressScale's refusal, so the reason is felt and heard rather than the press swallowed (019).

import { XStack } from './ui';
import { BodyStrong } from './Typography';
import { useTheme } from './ThemeProvider';
import { PressScale } from './PressScale';

export function InkButton({
  label,
  onPress,
  busy,
  blockedReason,
  onBlockedPress,
  testID,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly busy?: boolean;
  /** What is missing, while it is. */
  readonly blockedReason?: string;
  /** Where the refusal sends focus. */
  readonly onBlockedPress?: () => void;
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
      accessibilityLabel={label}
      testID={testID}
    >
      <XStack
        width="100%"
        minHeight={52}
        borderRadius={14}
        backgroundColor={theme.text}
        alignItems="center"
        justifyContent="center"
        opacity={blocked ? 0.55 : 1}
      >
        <BodyStrong color={theme.surfaceAlt}>{label}</BodyStrong>
      </XStack>
    </PressScale>
  );
}
