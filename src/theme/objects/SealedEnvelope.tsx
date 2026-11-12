// The sealed envelope (031, board "Lock - sealed"): what the lock screen holds up. The envelope's blue
// tile with the gold flap folded down, and where its point meets the envelope a wax seal with a padlock
// pressed into it - Obálka is sealed, and only its owner breaks the seal. The envelope's colours stay
// in both appearances, as all printed matter does; the seal is the envelope's blue, lit from the top
// left.

import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../ThemeProvider';
import { objectShadow } from '../depth';
import { sealedEnvelope } from '../print';

const g = sealedEnvelope;
const s = g.seal;

/** The wax seal: its lit face, its edge's shadow and highlights, and the padlock pressed into it. */
function WaxSeal() {
  const theme = useTheme();
  const inset = (s.size - s.grid) / 2;
  return (
    <View
      testID="waxSeal"
      style={{
        position: 'absolute',
        left: s.x,
        top: s.y,
        width: s.size,
        height: s.size,
        borderRadius: s.size / 2,
        // The face is a background, not a drawing: the seal's inset highlights are drawn over the
        // background and would be hidden under a drawn face.
        experimental_backgroundImage: `radial-gradient(circle at ${s.light.x}% ${s.light.y}%, ${theme.sealLight}, ${theme.sealShade} ${s.fade}%)`,
        backgroundColor: theme.sealShade,
        boxShadow: objectShadow(theme.name, 'seal'),
      }}
    >
      <Svg
        width={s.grid}
        height={s.grid}
        viewBox={`0 0 ${s.grid} ${s.grid}`}
        style={{ position: 'absolute', left: inset, top: inset }}
      >
        <Circle
          cx={s.grid / 2}
          cy={s.grid / 2}
          r={s.ring.r}
          fill="none"
          stroke={theme.onSolid}
          strokeOpacity={s.ring.opacity}
          strokeWidth={s.ring.stroke}
          strokeDasharray={s.ring.dash}
        />
        <Path
          d={s.shackle}
          fill="none"
          stroke={theme.onSolid}
          strokeOpacity={s.opacity}
          strokeWidth={s.stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Rect
          transform={[{ translateX: s.body.x }, { translateY: s.body.y }]}
          width={s.body.width}
          height={s.body.height}
          rx={s.body.radius}
          fill="none"
          stroke={theme.onSolid}
          strokeOpacity={s.opacity}
          strokeWidth={s.stroke}
          strokeLinejoin="round"
        />
        <Path
          d={s.fold}
          fill="none"
          stroke={theme.onSolid}
          strokeOpacity={s.opacity}
          strokeWidth={s.stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

export function SealedEnvelope() {
  const theme = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: g.size,
        height: g.size,
        borderRadius: g.radius,
        backgroundColor: theme.envelope,
        boxShadow: objectShadow(theme.name, 'sealedEnvelope'),
      }}
    >
      <Svg width={g.size} height={g.size} viewBox={`0 0 ${g.size} ${g.size}`}>
        <Defs>
          <LinearGradient id="sealedFlapSheen" x1="0" y1="0" x2="0" y2="1">
            <Stop offset={0} stopColor={theme.onSolid} stopOpacity={g.sheen} />
            <Stop offset={1} stopColor={theme.printShade} stopOpacity={g.shade} />
          </LinearGradient>
        </Defs>
        <Path d={g.flap} fill={theme.flap} />
        <Path d={g.flap} fill="url(#sealedFlapSheen)" />
      </Svg>
      <WaxSeal />
    </View>
  );
}
