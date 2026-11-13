// One clock for a moment of motion (031): an `Animated.Value` run from 0 to 1 on the native driver, with
// each movement a stretch of it. On Android a second animation started after a `delay` waits for JS,
// and Reanimated dropped the last frames of a moment and then kept them over what React committed
// (the opening of a message, the sent result: Obalka_Demo, 2026-11-12/13). The native driver draws
// every frame and ends where it is told; its styles stay on at their end.

/**
 * The stretch from `startMs` to `startMs + ms` of one clock running 0 to 1 over `totalMs`, eased out
 * (cubic) as points the native driver joins with straight lines - it takes no easing function.
 */
export function easedStretch(startMs: number, ms: number, totalMs: number, steps = 8) {
  const inputRange: number[] = [];
  const outputRange: number[] = [];
  for (let k = 0; k <= steps; k += 1) {
    const f = k / steps;
    inputRange.push((startMs + f * ms) / totalMs);
    outputRange.push(1 - (1 - f) ** 3);
  }
  return { inputRange, outputRange, extrapolate: 'clamp' as const };
}
