// The neutral button (031, boards R6 and R14): the `neutralFill` tone with the card's 14 corner and the
// label in ink, 15/700 - tone, not an outline. The fill is a step deeper than the boards' `sunken`,
// which was 1.03:1 on the paper and read as bold words there (the owner, 2026-11-15). R14 draws it 52 tall on its own; R6 sets two side by side at
// 48 (`compact`); R4 sizes it to its words, 24 at each side, under a failed state's words (`inline`);
// R13 halves a card row with it at 40, the 12 corner and 14/700 (`small`), Smazat in the danger ink.
// The press is PressScale's dip, as every button's. `disabled` draws it at .55, as R10 dims the backup's
// pair while a run goes on, faded as one picture (Android fades a group child by child otherwise).

import { XStack } from './ui';
import { BodyStrong, SmallStrong } from './Typography';
import { useTheme } from './ThemeProvider';
import { PressScale } from './PressScale';
import { OffsetIcon } from './offsetIcons';
import type { ButtonGlyph } from './buttonGlyph';

export function NeutralButton({
  label,
  onPress,
  busy,
  disabled = false,
  compact = false,
  inline = false,
  glyph,
  icon,
  small = false,
  danger = false,
  accessibilityLabel,
  testID,
}: ButtonGlyph & {
  readonly label: string;
  readonly onPress: () => void;
  readonly busy?: boolean;
  /** The action cannot be taken now and the screen shows why: dimmed, and announced unavailable. */
  readonly disabled?: boolean;
  /** 48 tall, for a pair in one row (R6); 52 alone (R14). */
  readonly compact?: boolean;
  /** As wide as its words with 24 at each side, centred under them (R4); otherwise the column's width. */
  readonly inline?: boolean;
  /** R13's row button, one of two side by side: 40 tall, the 12 corner, 14/700. */
  readonly small?: boolean;
  /** The words in the danger ink, for an action that removes something (R13's Smazat). */
  readonly danger?: boolean;
  /** What a screen reader hears when the words alone do not say what they act on. */
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}) {
  const theme = useTheme();
  return (
    <PressScale
      fullWidth={!inline}
      onPress={onPress}
      busy={busy}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
    >
      <XStack
        width={inline ? undefined : '100%'}
        minHeight={small ? 40 : compact ? 48 : 52}
        opacity={disabled ? 0.55 : 1}
        needsOffscreenAlphaCompositing={disabled}
        borderRadius={small ? 12 : 14}
        backgroundColor={theme.neutralFill}
        alignItems="center"
        justifyContent="center"
        paddingHorizontal={inline ? 24 : 12}
        gap={10}
      >
        {glyph ? (
          // In the words' ink; a red ink prints its own faint plane, not the blue (practices 1.6.3).
          <OffsetIcon name={glyph} size={small ? 18 : 20} color={danger ? theme.danger : theme.text} />
        ) : (
          icon
        )}
        {small ? (
          <SmallStrong color={danger ? theme.danger : theme.text} textAlign="center">
            {label}
          </SmallStrong>
        ) : (
          <BodyStrong color={danger ? theme.danger : theme.text} textAlign="center">
            {label}
          </BodyStrong>
        )}
      </XStack>
    </PressScale>
  );
}
