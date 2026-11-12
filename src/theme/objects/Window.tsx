// The window (031): who it is addressed to - the box switcher, the recipient in compose, the login name
// while signing in. The site's cellophane, made quieter for a phone: an inset shade where the
// envelope's paper lies over its edge, a film that catches the light, and a faint glint. The film lies
// under the print, so it never costs a letter any contrast; at night it keeps to the margins.

import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
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
  const line = gradientLine(f.angle, width, height);
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
        <LinearGradient id="glint" gradientUnits="userSpaceOnUse" {...line}>
          {f.glintStops[theme.name].map(([offset, opacity]) => (
            <Stop key={offset} offset={offset} stopColor={theme.onSolid} stopOpacity={opacity} />
          ))}
        </LinearGradient>
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
      <G opacity={f.glint}>
        <Rect width={width} height={height} fill={theme.windowGlint} />
        <Rect width={width} height={height} fill="url(#glint)" />
      </G>
    </Svg>
  );
}
