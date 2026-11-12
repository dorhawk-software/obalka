// The window (031): who it is addressed to - the box switcher, the recipient in compose, the login name
// while signing in. The site's cellophane, made quieter for a phone: an inset shade where the
// envelope's paper lies over its edge, a film that catches the light, and a faint glint. The film lies
// under the print, so it never costs a letter any contrast; at night it keeps to the margins.
//
// The glint follows the phone's tilt (board Motion 4), lagging behind it, and only while the window is
// on screen: the gravity sensor runs only then. With Reduce Motion it stays still.

import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  SensorType,
  useAnimatedSensor,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import Svg, {
  Defs,
  FeGaussianBlur,
  Filter,
  G,
  LinearGradient,
  Mask,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { useTheme } from '../ThemeProvider';
import { objectShadow } from '../depth';
import { envelopeShape, windowFilm } from '../print';
import { useLayoutSize } from './perforation';
import { useOnScreen } from '../useOnScreen';

/** A window around `children`, which set its padding and size it. Wrap it to make it pressable. */
export function Window({
  children,
  radius = envelopeShape.windowRadius,
  style,
}: {
  readonly children: ReactNode;
  readonly radius?: number;
  readonly style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const [size, onLayout] = useLayoutSize();
  return (
    <View
      onLayout={onLayout}
      style={[
        {
          borderRadius: radius,
          backgroundColor: theme.window,
          overflow: 'hidden',
          boxShadow: objectShadow(theme.name, 'window'),
        },
        style,
      ]}
    >
      {size ? <WindowFilm width={size.width} height={size.height} /> : null}
      {size ? <Glint width={size.width} height={size.height} /> : null}
      {children}
    </View>
  );
}

/**
 * The CSS gradient line for `angle` across a `width` x `height` box: CSS measures the angle from
 * "up", clockwise, and makes the line just long enough that the corners take the first and last stop.
 */
export function gradientLine(angle: number, width: number, height: number) {
  const a = (angle * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const half = (Math.abs(width * dx) + Math.abs(height * dy)) / 2;
  return {
    x1: width / 2 - dx * half,
    y1: height / 2 - dy * half,
    x2: width / 2 + dx * half,
    y2: height / 2 + dy * half,
  };
}

function WindowFilm({ width, height }: { readonly width: number; readonly height: number }) {
  const theme = useTheme();
  const f = windowFilm;
  const dark = theme.name === 'dark';
  const solid = Math.min(0.5, f.darkMargin.solid / height);
  const fade = Math.min(0.5, f.darkMargin.fade / height);
  return (
    <Svg
      width={width}
      height={height}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Defs>
        <Filter id="soft" x="-10%" y="-40%" width="120%" height="180%">
          <FeGaussianBlur stdDeviation={f.blur} />
        </Filter>
        {dark ? (
          <LinearGradient id="margins" x1="0" y1="0" x2="0" y2="1">
            <Stop offset={0} stopColor={theme.onSolid} stopOpacity={1} />
            <Stop offset={solid} stopColor={theme.onSolid} stopOpacity={1} />
            <Stop offset={fade} stopColor={theme.onSolid} stopOpacity={0} />
            <Stop offset={1 - fade} stopColor={theme.onSolid} stopOpacity={0} />
            <Stop offset={1 - solid} stopColor={theme.onSolid} stopOpacity={1} />
            <Stop offset={1} stopColor={theme.onSolid} stopOpacity={1} />
          </LinearGradient>
        ) : null}
        {dark ? (
          <Mask id="edges">
            <Rect width={width} height={height} fill="url(#margins)" />
          </Mask>
        ) : null}
      </Defs>
      <G opacity={f.film[theme.name]} mask={dark ? 'url(#edges)' : undefined}>
        {/* The film is drawn on a 300 x 120 sheet stretched over the window, strokes and blur too. */}
        <G transform={`scale(${width / 300} ${height / 120})`}>
          <G filter="url(#soft)" fill="none" strokeLinecap="round">
            {f.strokes.map(s => (
              <Path key={s.d} d={s.d} stroke={theme.onSolid} strokeWidth={s.width} strokeOpacity={s.opacity} />
            ))}
          </G>
        </G>
      </G>
    </Svg>
  );
}

const tilt = windowFilm.tilt;
/** Gravity along the phone's width, in m/s^2: iOS reports it the other way round from Android. */
const GRAVITY_X = Platform.OS === 'ios' ? -9.81 : 9.81;

/**
 * The glint: the window's sheen and its two bright bands, drawn `reach` wider on each side so it can
 * move that far without showing an edge. It moves only while on screen and without Reduce Motion;
 * otherwise it lies still, centred.
 */
function Glint({ width, height }: { readonly width: number; readonly height: number }) {
  const onScreen = useOnScreen();
  const reduceMotion = useReducedMotion();
  const drawing = <GlintDrawing width={width} height={height} />;
  return onScreen && !reduceMotion ? <TiltingGlint>{drawing}</TiltingGlint> : <StillGlint>{drawing}</StillGlint>;
}

const GLINT_FRAME: ViewStyle = { position: 'absolute', top: 0, bottom: 0, left: -tilt.reach, right: -tilt.reach };

function StillGlint({ children }: { readonly children: ReactNode }) {
  return (
    <View style={GLINT_FRAME} pointerEvents="none">
      {children}
    </View>
  );
}

/** Mounted only while it may move: the sensor listens for as long as this is on screen. */
function TiltingGlint({ children }: { readonly children: ReactNode }) {
  const gravity = useAnimatedSensor(SensorType.GRAVITY);
  const shift = useSharedValue(0);
  const { reach, lerp, rest } = tilt;
  const unit = GRAVITY_X;
  useFrameCallback(() => {
    const lean = Math.max(-1, Math.min(1, gravity.sensor.value.x / unit));
    const gap = lean * reach - shift.value;
    if (Math.abs(gap) > rest) {
      shift.value += gap * lerp;
    }
  });
  // `left`, not a `transform`: on Android Reanimated never drew this transform at all (the shift reached
  // -7.6 and the glint stayed where it was, 2026-11-12, Obalka_Demo), as the sent result's rise lost
  // its last frames; a layout value is drawn.
  const style = useAnimatedStyle(() => ({ left: shift.value - reach, right: -shift.value - reach }));
  return (
    <Animated.View style={[GLINT_FRAME, style]} pointerEvents="none">
      {children}
    </Animated.View>
  );
}

function GlintDrawing({ width, height }: { readonly width: number; readonly height: number }) {
  const theme = useTheme();
  const line = gradientLine(windowFilm.angle, width, height);
  const wide = width + 2 * tilt.reach;
  return (
    <Svg
      width={wide}
      height={height}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="windowGlint"
    >
      <Defs>
        <LinearGradient
          id="glint"
          gradientUnits="userSpaceOnUse"
          x1={line.x1 + tilt.reach}
          y1={line.y1}
          x2={line.x2 + tilt.reach}
          y2={line.y2}
        >
          {windowFilm.glintStops[theme.name].map(([offset, opacity]) => (
            <Stop key={offset} offset={offset} stopColor={theme.onSolid} stopOpacity={opacity} />
          ))}
        </LinearGradient>
      </Defs>
      <G opacity={windowFilm.glint}>
        <Rect width={wide} height={height} fill={theme.windowGlint} />
        <Rect width={wide} height={height} fill="url(#glint)" />
      </G>
    </Svg>
  );
}
