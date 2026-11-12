// The sealed envelope (031, board "Lock - sealed"): what the lock screen holds up. The envelope's blue
// tile with the gold flap folded down, and where its point meets the envelope a wax seal with a padlock
// pressed into it - Obálka is sealed, and only its owner breaks the seal. The envelope's colours stay
// in both appearances, as all printed matter does; the seal is the envelope's blue, lit from the top
// left.

import { Animated, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../ThemeProvider';
import { objectShadow } from '../depth';
import { sealedEnvelope } from '../print';

const g = sealedEnvelope;
const s = g.seal;

/**
 * What the unlock moves (board Motion 3), each 0 at rest: `seal` 1 is broken and gone, `flap` 1 is open
 * (turned 180 on its fold), `shake` -1..1 is the refusal's nudge.
 */
export interface SealMotion {
  readonly seal: Animated.Value;
  readonly flap: Animated.Value;
  readonly shake: Animated.Value;
}

/** The wax seal: its lit face, its edge's shadow and highlights, and the padlock pressed into it. */
function WaxSeal({ left = 0, testID }: { readonly left?: number; readonly testID?: string }) {
  const theme = useTheme();
  const inset = (s.size - s.grid) / 2;
  return (
    <View
      testID={testID}
      style={{
        position: 'absolute',
        left,
        top: 0,
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

/** One half of the seal as it breaks: cut at the middle, tilting away from it as it drops and fades. */
function SealHalf({ side, motion }: { readonly side: 'left' | 'right'; readonly motion: SealMotion }) {
  const half = s.size / 2;
  const style: Animated.WithAnimatedValue<StyleProp<ViewStyle>> = {
    position: 'absolute',
    left: side === 'left' ? 0 : half,
    top: 0,
    width: half,
    height: s.size,
    overflow: 'hidden',
    // Hinged at the crack's foot, so the halves open from the top like a seal snapped in two.
    transformOrigin: side === 'left' ? 'right bottom' : 'left bottom',
    // Only while it breaks: whole, the seal is drawn whole (its shadow would be cut at the crack).
    opacity: motion.seal.interpolate({ inputRange: [0, 0.001, 1], outputRange: [0, 1, 0] }),
    transform: [
      { translateY: motion.seal.interpolate({ inputRange: [0, 1], outputRange: [0, g.breakDrop] }) },
      {
        rotate: motion.seal.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${side === 'left' ? -g.breakTilt : g.breakTilt}deg`],
        }),
      },
    ],
  };
  return (
    <Animated.View style={style}>
      <WaxSeal left={side === 'left' ? 0 : -half} />
    </Animated.View>
  );
}

const STILL: SealMotion = { seal: new Animated.Value(0), flap: new Animated.Value(0), shake: new Animated.Value(0) };

export function SealedEnvelope({ motion = STILL }: { readonly motion?: SealMotion }) {
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
      {/* The flap turns on its fold, towards you, and lies open above the envelope. */}
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: g.size,
          height: g.size,
          // In points: a percentage of the fold's place (28.749999999999996%) leaves Android drawing
          // nothing once the flap is turned at all (2026-11-12).
          transformOrigin: [g.size / 2, g.hinge, 0],
          transform: [
            { perspective: g.perspective },
            { rotateX: motion.flap.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) },
          ],
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
      </Animated.View>
      {/* The seal whole: it nudges on a refusal, and goes with the flap when there is no seal to break
          (a later unlock). */}
      <Animated.View
        style={{
          position: 'absolute',
          left: s.x,
          top: s.y,
          width: s.size,
          height: s.size,
          opacity: Animated.multiply(
            motion.seal.interpolate({ inputRange: [0, 0.001], outputRange: [1, 0], extrapolate: 'clamp' }),
            motion.flap.interpolate({ inputRange: [0, 0.5], outputRange: [1, 0], extrapolate: 'clamp' }),
          ),
          transform: [
            { translateX: motion.shake.interpolate({ inputRange: [-1, 0, 1], outputRange: [-g.shake, 0, g.shake] }) },
          ],
        }}
      >
        <WaxSeal testID="waxSeal" />
      </Animated.View>
      <View style={{ position: 'absolute', left: s.x, top: s.y, width: s.size, height: s.size }} pointerEvents="none">
        <SealHalf side="left" motion={motion} />
        <SealHalf side="right" motion={motion} />
      </View>
    </View>
  );
}
