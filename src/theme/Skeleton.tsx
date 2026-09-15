// Skeleton placeholder - the 2026 "show the shape of what's coming" loading pattern (calmer + less
// jarring than a centred spinner, and it reserves the real layout so content doesn't jump in). A
// gentle opacity *pulse* on a tonal block (not a flashy shimmer - keeps the trustworthy feel).
// Reduce-Motion → a static block, no pulse.

import { useEffect, useRef } from 'react';
import { Animated, type DimensionValue, type ViewStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useTheme } from './ThemeProvider';

export function Skeleton({
  width,
  height,
  radius = 8,
  color,
  style,
}: {
  readonly width: DimensionValue;
  readonly height: DimensionValue;
  readonly radius?: number;
  /**
   * The block's fill. Defaults to `surfaceAlt`, which is the right answer ON THE PAGE and the wrong
   * one on a Card: in dark mode `surfaceAlt` is DARKER than the `surface` a Card paints, so a
   * skeleton drawn inside one measured 1.09:1 against it - invisible, and a row of invisible
   * placeholders reads as a broken empty row rather than as loading. Pass `borderStrong` there,
   * which measures about 1.5:1 on a card in both themes. (Values deliberately named, not quoted:
   * a palette moves, and `check:colors` forbids hex here for exactly that reason.)
   */
  readonly color?: string;
  readonly style?: ViewStyle;
}) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const pulse = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.6,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: color ?? theme.surfaceAlt,
          opacity: reduceMotion ? 0.7 : pulse,
        },
        style,
      ]}
    />
  );
}
