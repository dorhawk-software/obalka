// Opening a message (031, board Motion 1): the row's sender tile grows into the message's envelope,
// and the letter slides up out of it and settles over its edge - 280 ms each, eased out, no
// overshoot, no haptic (reading is quiet). The screen itself only fades in (AppNavigator), so the tile
// can fly over it; the tile is measured where it was tapped and handed over in the route's params.
//
// The movement is core Animated on the native driver: on Android Reanimated left this kind of
// transform undrawn (031 I68, I70), while the native driver drew the lock's seal frame by frame.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, View, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useTheme } from '../../../theme/ThemeProvider';
import { envelopeShape } from '../../../theme/print';
import { easedStretch } from '../../../theme/motionClock';

export { easedStretch };

/** Where the tapped row's sender tile was, in window points, how it looked, and when it was tapped. */
export interface TileRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly color: string;
  readonly radius: number;
  readonly at: number;
}

/**
 * Measures `view` where it is on screen and opens with it. Fabric answers at once; a platform that
 * answers later, or never (Jest's views), opens without it - the message opens either way, once.
 */
export function openFromTile(
  view: Pick<View, 'measureInWindow'> | null,
  look: { readonly color: string; readonly radius: number },
  open: (from?: TileRect) => void,
): void {
  let done = false;
  view?.measureInWindow((x, y, width, height) => {
    if (done) {
      return;
    }
    done = true;
    open(width > 0 && height > 0 ? { x, y, width, height, ...look, at: Date.now() } : undefined);
  });
  if (!done) {
    done = true;
    open(undefined);
  }
}

/** A tile tapped longer ago than this does not fly: the message took too long to arrive to follow it. */
export const FLIGHT_FRESH_MS = 600;

/**
 * The opening's timings: the flight (when there is a tile to fly from), then the letter. The letter
 * starts at 60 % of the flight: eased out, the envelope is all but there by then, and a letter that
 * waited for the end left it standing still for 3 frames (Obalka_Demo).
 */
export function openingMoment(flies: boolean, reduceMotion: boolean) {
  const flightMs = flies && !reduceMotion ? 280 : 0;
  const sheetMs = reduceMotion ? 0 : 280;
  const sheetAtMs = Math.round(flightMs * 0.6);
  return { flightMs, sheetAtMs, sheetMs, totalMs: Math.max(flightMs, sheetAtMs + sheetMs), sheetRise: 24 };
}

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

type Progress = Animated.Value | Animated.AnimatedInterpolation<number>;

/**
 * One clock on the UI thread for the whole opening, the flight and the letter stretches of it: a
 * second animation started after a `delay` waits for JS, which is busy drawing the message just then,
 * and the letter came 3-4 frames late however early it was asked for (Obalka_Demo).
 */
function useClock(m: ReturnType<typeof openingMoment>) {
  return useState(() => {
    const clock = new Animated.Value(m.totalMs > 0 ? 0 : 1);
    const still = new Animated.Value(1);
    const flight: Progress = m.flightMs > 0 ? clock.interpolate(easedStretch(0, m.flightMs, m.totalMs)) : still;
    const sheet: Progress = m.sheetMs > 0 ? clock.interpolate(easedStretch(m.sheetAtMs, m.sheetMs, m.totalMs)) : still;
    // Made once with the clock: a style made on each render handed the view new nodes whenever the
    // message re-rendered (its attachments arrive mid-opening), and the letter waited for them.
    // They stay on once it has settled, at their end: taking a native-driven style off the view failed
    // Fabric's prop assertion and Android killed the app (2026-11-12, Obalka_Demo).
    const envelopeStyle = { opacity: flight.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, 0, 1] }) };
    const sheetStyle = {
      opacity: sheet.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 1] }),
      transform: [{ translateY: sheet.interpolate({ inputRange: [0, 1], outputRange: [m.sheetRise, 0] }) }],
    };
    return { clock, flight, envelopeStyle, sheetStyle };
  })[0];
}

/** The opening of one message: what moves, and the handlers the envelope needs to measure itself. */
export function useOpening(from: TileRect | undefined) {
  const reduceMotion = useReducedMotion();
  const [flies] = useState(() => from != null && Date.now() - from.at < FLIGHT_FRESH_MS);
  const m = openingMoment(flies, reduceMotion);
  // What does not move starts where it ends.
  const { clock, flight, envelopeStyle, sheetStyle } = useClock(m);
  const [target, setTarget] = useState<Rect | null>(null);
  const [settled, setSettled] = useState(m.totalMs === 0);
  const started = useRef(false);
  const envelope = useRef<View>(null);

  const onEnvelopeLayout = useCallback(() => {
    envelope.current?.measureInWindow((x, y, width, height) => setTarget({ x, y, width, height }));
  }, []);

  const waitsForTarget = m.flightMs > 0 && target == null;
  useEffect(() => {
    if (settled || started.current || waitsForTarget) {
      return;
    }
    started.current = true;
    Animated.timing(clock, { toValue: 1, duration: m.totalMs, easing: Easing.linear, useNativeDriver: true }).start(
      ({ finished }) => {
        if (finished) {
          setSettled(true);
        }
      },
    );
  }, [settled, waitsForTarget, clock, m.totalMs]);

  // An envelope that never says where it is (no layout yet, a platform that does not answer) is shown
  // where it belongs rather than kept hidden.
  useEffect(() => {
    if (!waitsForTarget) {
      return;
    }
    const id = setTimeout(() => {
      clock.setValue(1);
      setSettled(true);
    }, FLIGHT_FRESH_MS);
    return () => clearTimeout(id);
  }, [waitsForTarget, clock]);

  const flying = !settled && m.flightMs > 0 && from != null;
  return {
    envelope,
    onEnvelopeLayout,
    settled,
    /** The tile on its way, when one flies and the envelope's place is known. */
    tile: flying && target != null ? { from, to: target, flight } : null,
    /** The envelope's print and colour, which take over from the tile as it lands. */
    envelopeStyle,
    /** The letter, rising into its place over the envelope's edge. */
    sheetStyle,
  };
}

/**
 * The tile on its way to the envelope: the envelope's blue under the sender's colour, which fades as
 * it grows. It lies under the real envelope, which takes over as it lands.
 */
export function FlyingTile({
  from,
  to,
  flight,
}: {
  readonly from: TileRect;
  readonly to: Rect;
  readonly flight: Progress;
}) {
  const theme = useTheme();
  // Made once per flight, as the opening's own styles are: new nodes mid-flight wait for JS.
  const { style, fade } = useMemo(() => {
    const along = (start: number) => flight.interpolate({ inputRange: [0, 1], outputRange: [start, 0] });
    const grow = (start: number) => flight.interpolate({ inputRange: [0, 1], outputRange: [start, 1] });
    const frame: Animated.WithAnimatedValue<StyleProp<ViewStyle>> = {
      position: 'absolute',
      left: 0,
      top: 0,
      width: to.width,
      height: to.height,
      borderRadius: envelopeShape.radius,
      backgroundColor: theme.envelope,
      overflow: 'hidden',
      transform: [
        { translateX: along(from.x + from.width / 2 - (to.x + to.width / 2)) },
        { translateY: along(from.y + from.height / 2 - (to.y + to.height / 2)) },
        { scaleX: grow(from.width / to.width) },
        { scaleY: grow(from.height / to.height) },
      ],
    };
    return { style: frame, fade: flight.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 0, 0] }) };
  }, [from, to, flight, theme.envelope]);
  return (
    <Animated.View style={style} pointerEvents="none" testID="flyingTile">
      <Animated.View
        testID="flyingTileColour"
        style={{
          flex: 1,
          backgroundColor: from.color,
          opacity: fade,
        }}
      />
    </Animated.View>
  );
}

/**
 * The tapped tile, still where it was, while the message is read from the archive: the flight starts
 * from it once the envelope is there, so the tile never leaves the screen.
 */
export function TileAtRest({ from }: { readonly from: TileRect }) {
  return (
    <View
      pointerEvents="none"
      testID="tileAtRest"
      style={{
        position: 'absolute',
        left: from.x,
        top: from.y,
        width: from.width,
        height: from.height,
        borderRadius: from.radius,
        backgroundColor: from.color,
      }}
    />
  );
}
