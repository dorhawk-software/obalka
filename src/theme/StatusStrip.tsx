// The strip across the top of a screen that states a condition the whole screen is under: the message
// lives on the czebox TEST system (`TestEnvBanner`), or Debug mode is recording (`DebugRecordingStrip`,
// 023 FR-007).
//
// ONE COMPONENT, BECAUSE THERE WERE TWO COPIES. The recording strip was written as a copy of the test
// banner so that two strips in the same place would share their numbers - and the numbers it copied
// were on neither of DESIGN.md's scales: a 5 padding and a 7 gap against spacing that runs
// 2/4/6/8/10/12/14/18, and a 12/15 label under a type scale whose smallest step is 13. A copy keeps a
// drift as faithfully as it keeps a rule, so the metrics now live here once, on the scale, and both
// strips are drawn from them (found by review, 2026-09-15).
//
// NORMAL FLOW, NEVER AN OVERLAY (constitution V). A strip takes real space above the screen's own
// header and clears the status bar itself, so it can never cover a control. Whoever mounts one hands
// the screen below it a spent top inset (`DebugRecordingFrame` does it through the safe-area context,
// the message detail through `useHeaderTop`), or the header pays the status-bar gap a second time.
//
// ONE HEIGHT. Every strip reserves the same row - the Badge line box between two on-scale paddings -
// whatever it says and whichever tone it wears, so a screen carrying either strip lays its content out
// in the same place. The single exception is derived, not tuned: a strip that is a BUTTON is at least a
// finger tall counting the status bar it clears. On a phone with a status bar that inset alone pays for
// it and the row is the same as every other strip's; only with no inset above it (a screen drawn below
// another strip) does a pressable row grow.

import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { XStack, YStack } from './ui';
import { Badge } from './Typography';
import { useTheme } from './ThemeProvider';
import type { Theme } from './theme';
import { ChevronRightIcon } from './icons';
import { MIN_TARGET } from './touchTarget';
import { type as typeScale } from './typography';

/** Above and below the label: DESIGN.md spacing `sm`. */
export const STATUS_STRIP_PADDING_VERTICAL = 6;
/** Either side of the content: DESIGN.md spacing `xl`. */
export const STATUS_STRIP_PADDING_HORIZONTAL = 14;
/** Between the glyph, the label and the chevron: DESIGN.md spacing `base`. */
export const STATUS_STRIP_GAP = 8;
/** The drawn size of a strip's glyphs, so a flask and a chevron sit on the same line box. */
export const STATUS_STRIP_GLYPH = 14;
/**
 * The row every strip reserves at the default text size: the Badge role's line box between the two
 * paddings. A `minHeight`, so a larger system text size still grows it (the Growing Box Rule).
 */
export const STATUS_STRIP_ROW = 2 * STATUS_STRIP_PADDING_VERTICAL + typeScale.badge.lineHeight;

/**
 * `test` - the czebox environment, in its dedicated soft-gold tokens (009 §6).
 * `chrome` - part of the app's own furniture: the header's `surfaceAlt` with a hairline under it, so
 * it reads as chrome rather than as an alert.
 */
export type StatusStripTone = 'test' | 'chrome';

export interface StatusStripColors {
  readonly background: string;
  readonly ink: string;
  readonly edge: string;
  /** The trailing chevron of a strip that opens something. */
  readonly chevron: string;
}

/**
 * The colours a tone paints. Exported so `__tests__/theme/contrast.test.ts` measures the pairs a strip
 * actually draws rather than a transcription of them.
 */
export function statusStripColors(tone: StatusStripTone, theme: Theme): StatusStripColors {
  if (tone === 'test') {
    return {
      background: theme.testBg,
      ink: theme.testFg,
      edge: theme.testBd,
      chevron: theme.testFg,
    };
  }
  return {
    background: theme.surfaceAlt,
    ink: theme.text,
    edge: theme.border,
    chevron: theme.textMuted,
  };
}

export function StatusStrip({
  tone,
  label,
  glyph,
  onPress,
  accessibilityHint,
  testID,
}: {
  readonly tone: StatusStripTone;
  /** The whole statement. It is also what a screen reader hears: the strip is one element. */
  readonly label: string;
  /** Before the label, drawn at `STATUS_STRIP_GLYPH` or smaller. Decorative - the label says it. */
  readonly glyph: ReactNode;
  /** Makes the strip a button, with a chevron saying so. Omit it and the strip is a label. */
  readonly onPress?: () => void;
  readonly accessibilityHint?: string;
  /** On the strip; its row and label take `<testID>-row` and `<testID>-label`. */
  readonly testID?: string;
}) {
  const theme = useTheme();
  const inset = useSafeAreaInsets().top;
  const colors = statusStripColors(tone, theme);
  return (
    <YStack
      paddingTop={inset}
      backgroundColor={colors.background}
      borderBottomWidth={1}
      borderColor={colors.edge}
      onPress={onPress}
      pressStyle={onPress ? { opacity: 0.65 } : undefined}
      accessible
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      accessibilityHint={onPress ? accessibilityHint : undefined}
      testID={testID}
    >
      <XStack
        // The whole strip is a button's target, status-bar inset included - derived from the minimum,
        // never typed, and only for a strip that can be pressed: a label has no target to meet.
        minHeight={Math.max(STATUS_STRIP_ROW, onPress ? MIN_TARGET - inset : 0)}
        alignItems="center"
        justifyContent="center"
        gap={STATUS_STRIP_GAP}
        paddingVertical={STATUS_STRIP_PADDING_VERTICAL}
        paddingHorizontal={STATUS_STRIP_PADDING_HORIZONTAL}
        testID={testID ? `${testID}-row` : undefined}
      >
        {glyph}
        {/* Free to wrap. The banner this replaces pinned its label to one line (`numberOfLines={1}`,
            `flexShrink={0}`) after Android cut "Testovací prostředí" short - inside the message detail's
            fixed-height header column, since removed, and with a letter spacing Android is known to
            mismeasure, which the Badge role does not set. Pinned, a label at the largest text sizes
            runs off both edges of the screen instead: "Režim ladění zaznamenává" is 166dp in Public
            Sans Bold 13, so at 200 % the recording strip's row needs about 398dp, more than a 390dp
            phone has. Wrapped, the row grows by a line, which it may: the height is fixed for as long
            as the text size is. */}
        <Badge
          color={colors.ink}
          flexShrink={1}
          textAlign="center"
          testID={testID ? `${testID}-label` : undefined}
        >
          {label}
        </Badge>
        {onPress ? <ChevronRightIcon size={STATUS_STRIP_GLYPH} color={colors.chevron} /> : null}
      </XStack>
    </YStack>
  );
}
