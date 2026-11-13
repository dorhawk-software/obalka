// A determinate progress bar (006).
//
// Determinate on purpose: an indeterminate barber's pole says "something is happening", which the
// user already knew. This one is driven by real fractions - message counts and Argon2id's own report
// - so it moves when work is done and stops when it is not.
//
// It also announces itself. A screen-reader user gets "12 of 40" from `accessibilityValue` rather
// than a decorative view they cannot read; the same numbers the sighted label shows.
//
// The track is the sunken surface, as every board draws it (`--sk`, 031 R6/R8/R10/R14), 6 tall with
// the 3 ends; until 2026-11-13 it was the off switch's darker track.

import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, type LayoutChangeEvent } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
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
      backgroundColor={theme.surfaceSunken}
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

/**
 * The same track with nothing to count yet: a short segment travelling along it (025 T027).
 *
 * The exception to the rule above, for the one wait with no fraction in it - the other phone has
 * not answered yet. A still screen there read as a hang on the walk, and the platform spinner that
 * replaced it was nobody's design. Drawn in the bar's own place, so the line under the stage is the
 * same height whether it waits or counts. Reduce Motion leaves the empty track: the stage line says
 * what is happening either way.
 */
export function WaitingBar({ label, testID }: { readonly label?: string; readonly testID?: string }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const travel = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion || width === 0) {
      return undefined;
    }
    const loop = Animated.loop(
      Animated.timing(travel, {
        toValue: 1,
        duration: 1400,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [travel, width, reduceMotion]);
  const segment = width * 0.3;
  const translateX = travel.interpolate({ inputRange: [0, 1], outputRange: [-segment, width] });
  return (
    <YStack
      height={6}
      borderRadius={3}
      backgroundColor={theme.surfaceSunken}
      overflow="hidden"
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      testID={testID}
    >
      {reduceMotion || width === 0 ? null : (
        <Animated.View
          style={{
            width: segment,
            height: '100%',
            borderRadius: 3,
            backgroundColor: theme.blue,
            transform: [{ translateX }],
          }}
        />
      )}
    </YStack>
  );
}
