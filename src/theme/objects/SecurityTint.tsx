// The security tint (031): the inside, the private. Real envelopes are lined so nobody reads through
// them; Obálka's is chevrons of the envelope's blue. It lies behind the lock, the empty states and the
// slips - never behind text you need to read. Fills its parent; put it first among the children.

import { StyleSheet } from 'react-native';
import Svg, { Defs, Mask, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../ThemeProvider';
import { securityTint } from '../print';

export function SecurityTint({ vignette = false }: { readonly vignette?: boolean }) {
  const theme = useTheme();
  const t = securityTint;
  return (
    <Svg
      width="100%"
      height="100%"
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
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
  );
}
