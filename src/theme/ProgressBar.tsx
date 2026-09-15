// A determinate progress bar (006).
//
// Determinate on purpose: an indeterminate barber's pole says "something is happening", which the
// user already knew. This one is driven by real fractions - message counts and Argon2id's own report
// - so it moves when work is done and stops when it is not.
//
// It also announces itself. A screen-reader user gets "12 of 40" from `accessibilityValue` rather
// than a decorative view they cannot read; the same numbers the sighted label shows.

import { YStack } from './ui';
import { useTheme } from './ThemeProvider';

export function ProgressBar({
  fraction,
  label,
  now,
  total,
  testID,
}: {
  /** 0..1. Clamped, because a bar wider than its track reads as a rendering bug. */
  readonly fraction: number;
  /** What the bar is measuring, for the screen reader. */
  readonly label?: string;
  /** Optional real counts - announced instead of a percentage when they exist. */
  readonly now?: number;
  readonly total?: number;
  readonly testID?: string;
}) {
  const theme = useTheme();
  const clamped = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
  return (
    <YStack
      height={6}
      borderRadius={3}
      backgroundColor={theme.trackOff}
      overflow="hidden"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={
        total && total > 0
          ? { min: 0, max: total, now: now ?? 0 }
          : { min: 0, max: 100, now: Math.round(clamped * 100) }
      }
      testID={testID}
    >
      <YStack
        width={`${clamped * 100}%`}
        height="100%"
        borderRadius={3}
        backgroundColor={theme.blue}
      />
    </YStack>
  );
}
