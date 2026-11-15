// The small wait R12 draws where a line or a busy button waits (031, agreed 2026-11-12; T042 Q1: "busy
// buttons keep their small spinner"): a ring in the sunken paper and a quarter of it in ink, turning.
// The platform's own spinner is a bare arc in a colour and rhythm of its own on each system; this is
// the board's, the same on both. Under Reduce Motion it stands still: the words beside it say what is
// happening either way.

import { useEffect } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

/** One turn, as long as a platform spinner's. */
const TURN_MS = 900;

export function ArcSpinner({
  size = 18,
  track,
  ink,
  testID,
}: {
  readonly size?: number;
  /** The ring: the sunken paper (R12 `--sk`). */
  readonly track: string;
  /** The turning quarter: the blue on the paper, the button's words on a button. */
  readonly ink: string;
  readonly testID?: string;
}) {
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    turn.value = withRepeat(withTiming(1, { duration: TURN_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(turn);
  }, [reduceMotion, turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360}deg` }] }));
  return (
    <Animated.View
      style={[{ width: size, height: size }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx={12} cy={12} r={9} fill="none" stroke={track} strokeWidth={2.6} />
        <Path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke={ink} strokeWidth={2.6} strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}
