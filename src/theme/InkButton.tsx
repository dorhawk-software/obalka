// The filled button (the boards' `fbtn`): ink, 52 tall, the card's 14 corner, the label 15/700 in the
// paper colour. The one action a screen leads to - send, receive, continue. A button whose requirement
// is unmet is drawn at .55, as R10 draws Přijmout with an empty field, and still answers a press with
// PressScale's refusal, so the reason is felt and heard rather than the press swallowed (019).
// `small` is R13's half of a pair inside a card row: 40 tall, the 12 corner, the label 14/700.
// `compact` is 48, one of a pair beside a neutral button (R10's Smazat and Obnovit).
// `danger` is R9's `dbtn`, the answer a question's danger takes: the same button filled with the danger
// colour, its glyph 10 before the words (the bin before Smazat).

import type { ReactNode } from 'react';
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
  compact = false,
  danger = false,
  icon,
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
  /** 48 tall, one of a pair beside a neutral button (R10). */
  readonly compact?: boolean;
  /** R9's danger answer: filled with the danger colour. */
  readonly danger?: boolean;
  /** A glyph before the words, 10 from them, inked by the caller in `inkButtonInk`. */
  readonly icon?: ReactNode;
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
        minHeight={small ? 40 : compact ? 48 : 52}
        borderRadius={small ? 12 : 14}
        backgroundColor={danger ? theme.danger : theme.text}
        alignItems="center"
        justifyContent="center"
        gap={10}
        opacity={blocked ? 0.55 : 1}
      >
        {icon}
        {small ? (
          <SmallStrong color={theme.surfaceAlt}>{label}</SmallStrong>
        ) : (
          <BodyStrong color={theme.surfaceAlt}>{label}</BodyStrong>
        )}
      </XStack>
    </PressScale>
  );
}

/**
 * The words' colour on a filled button, for a glyph that has to match them: the paper. On R9's danger
 * button the board writes white in light; the paper is the family's ink on a fill, and the two differ
 * by less than the red under them shows.
 */
export function inkButtonInk(theme: { readonly surfaceAlt: string }): string {
  return theme.surfaceAlt;
}
