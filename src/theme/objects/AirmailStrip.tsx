// The airmail strip (031): the test environment. It isn't real mail, and it says so - stripes of the
// envelope's blue, paper, the flap's gold and paper at 135 degrees, with a paper band inside for the
// words. Printed matter: the stripes keep their colours at night; the band is the screen's surface.

import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useTheme } from '../ThemeProvider';
import { airmail } from '../print';
import { useLayoutSize } from './perforation';

/**
 * The stripes of a `width` x `height` strip, as CSS's `repeating-linear-gradient(135deg, …)` lays them:
 * position 0 at the top-left corner, measured along the diagonal. Each band is a parallelogram that
 * the strip's edges clip. Returns the coloured bands; paper lies under them.
 */
export function airmailBands(width: number, height: number): { d: string; stripe: number }[] {
  const period = airmail.stripes.reduce((a, b) => a + b, 0);
  const bands: { d: string; stripe: number }[] = [];
  // Along 135 degrees a point's position is (x + y) / sqrt(2); a band [t0, t1] is x + y in
  // [t0 * sqrt(2), t1 * sqrt(2)].
  const k = Math.SQRT2;
  for (let start = 0; start * k < width + height; start += period) {
    let at = start;
    airmail.stripes.forEach((w, stripe) => {
      if (stripe % 2 === 0) {
        const s0 = at * k;
        const s1 = (at + w) * k;
        bands.push({
          d: `M${s0} 0H${s1}L${s1 - height} ${height}H${s0 - height}Z`,
          stripe,
        });
      }
      at += w;
    });
  }
  return bands;
}

/** The strip around `children` (the label), full width; the band sets the label's padding. */
export function AirmailStrip({
  children,
  style,
}: {
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const [size, onLayout] = useLayoutSize();
  // Blue, paper, gold, paper: the even stripes are inked, the odd ones are the paper under them.
  const ink = [theme.envelope, theme.stampPaper, theme.flap, theme.stampPaper];
  return (
    <View onLayout={onLayout} style={[{ paddingVertical: airmail.inset, overflow: 'hidden' }, style]}>
      {size ? (
        <Svg
          width={size.width}
          height={size.height}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Rect width={size.width} height={size.height} fill={theme.stampPaper} />
          {airmailBands(size.width, size.height).map(b => (
            <Path key={b.d} d={b.d} fill={ink[b.stripe]} />
          ))}
        </Svg>
      ) : null}
      <View style={{ backgroundColor: theme.surface }}>{children}</View>
    </View>
  );
}
