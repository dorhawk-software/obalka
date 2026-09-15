// Fixed-palette artwork - the few marks whose colours are NOT theme colours and therefore must not be
// tokenised: the national flags used by the language picker (a flag's colours are its identity) and the
// two-tone brand lock that sits on the fixed brand-blue tile (`theme.brandTile` is the same in light and
// dark, so its glyph is too). Paths/colours are copied 1:1 from the design source (settings + lock).
//
// This is a sanctioned palette file (see scripts/check-no-raw-hex.sh) - screens still take every OTHER
// colour from useTheme().
//
// A `Rect` is placed with a `transform` translate rather than its own x/y - see DashedOutline for why.

import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { YStack } from './ui';

/** The design's 28×20 flag chip: rounded, clipped, with a 1px hairline ring. */
function FlagChip({ children }: { readonly children: React.ReactNode }) {
  return (
    <YStack
      width={28}
      height={20}
      borderRadius={4}
      overflow="hidden"
      style={{ boxShadow: '0 0 0 1px rgba(33,27,18,0.14)' }}
    >
      {children}
    </YStack>
  );
}

/** Czech flag (white / red / blue hoist triangle). */
export function FlagCz() {
  return (
    <FlagChip>
      <Svg width={28} height={20} viewBox="0 0 28 20">
        <Rect width={28} height={20} fill="#fff" />
        <Rect transform={[{ translateY: 10 }]} width={28} height={10} fill="#D7141A" />
        <Path d="M0 0L14 10L0 20Z" fill="#11457E" />
      </Svg>
    </FlagChip>
  );
}

/** Union Jack (drawn at the design's 60×40 aspect, squashed into the 28×20 chip). */
export function FlagEn() {
  return (
    <FlagChip>
      <Svg
        width={28}
        height={20}
        viewBox="0 0 60 40"
        preserveAspectRatio="none"
      >
        <Rect width={60} height={40} fill="#012169" />
        <Path d="M0 0L60 40M60 0L0 40" stroke="#fff" strokeWidth={8} />
        <Path d="M0 0L60 40M60 0L0 40" stroke="#C8102E" strokeWidth={3.5} />
        <Path d="M30 0V40M0 20H60" stroke="#fff" strokeWidth={12} />
        <Path d="M30 0V40M0 20H60" stroke="#C8102E" strokeWidth={6} />
      </Svg>
    </FlagChip>
  );
}

/**
 * The brand lock: a pale-blue padlock with a GOLD keyhole - the app-lock screen's mark, drawn on the
 * fixed brand-blue tile. Both colours are constant across themes (the tile is), so they stay literal.
 */
export function BrandLockIcon({ size = 46 }: { readonly size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        transform={[{ translateX: 4.5 }, { translateY: 10.5 }]}
        width={15}
        height={10.5}
        rx={3}
        stroke="#EEF4FB"
        strokeWidth={2}
      />
      <Path
        d="M7.5 10.5V8a4.5 4.5 0 0 1 9 0v2.5"
        stroke="#EEF4FB"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Circle cx={12} cy={15.5} r={1.6} fill="#F5B81E" />
    </Svg>
  );
}
