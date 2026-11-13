// The security tint (031): the inside, the private. Real envelopes are lined so nobody reads through
// them; Obálka's is chevrons of the envelope's blue. It lies behind the lock, the empty states and the
// slips - never behind text you need to read. Fills its parent; put it first among the children.
//
// Drawn at its measured size once it has one, not "100%": on Android an absolutely placed Svg at 100%
// kept the height its parent had when it first drew, so a slip's panel that grew when its QR appeared
// was tinted only down to where the key had ended (031 R6 walk).

import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Mask, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../ThemeProvider';
import { securityTint } from '../print';
import { useLayoutSize } from './perforation';

export function SecurityTint({ vignette = false }: { readonly vignette?: boolean }) {
  const theme = useTheme();
  const [size, onLayout] = useLayoutSize();
  const t = securityTint;
  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={onLayout}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg
        width={size?.width ?? '100%'}
        height={size?.height ?? '100%'}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Defs>
          <Pattern id="tint" width={t.width} height={t.height} patternUnits="userSpaceOnUse">
            <Path
              d={t.chevrons}
              fill="none"
              stroke={theme.envelope}
              strokeWidth={t.stroke}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Pattern>
          {vignette ? (
            <RadialGradient id="vignette" cx={t.vignette.cx} cy={t.vignette.cy} r={t.vignette.r}>
              <Stop offset={0} stopColor={theme.onSolid} stopOpacity={t.vignette.centre} />
              <Stop offset={1} stopColor={theme.onSolid} stopOpacity={1} />
            </RadialGradient>
          ) : null}
          {vignette ? (
            <Mask id="fade">
              <Rect width="100%" height="100%" fill="url(#vignette)" />
            </Mask>
          ) : null}
        </Defs>
        <Rect
          width="100%"
          height="100%"
          fill="url(#tint)"
          opacity={t.opacity[theme.name]}
          mask={vignette ? 'url(#fade)' : undefined}
        />
      </Svg>
    </View>
  );
}
