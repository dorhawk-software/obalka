// Fixed-palette artwork - the few marks whose colours are NOT theme colours and therefore must not be
// tokenised: the national flags used by the language picker (a flag's colours are its identity). Paths
// and colours are copied 1:1 from the design source (settings). The lock screen's two-tone brand lock
// lived here until the sealed envelope replaced it (031 T034).
//
// This is a sanctioned palette file (exempt in `obalka/no-raw-color`, tools/eslint-plugin-obalka) - screens still take every OTHER
// colour from useTheme().
//
// A `Rect` is placed with a `transform` translate rather than its own x/y - see DashedOutline for why.

import Svg, { Path, Rect } from 'react-native-svg';
import { YStack } from './ui';

/**
 * The flag as boards R3 and R13 draw it beside a language: 22 x 15, its corners just softened, no ring
 * around it (it was a 28 x 20 chip with a hairline ring: "tone, not outlines", 031).
 */
function FlagChip({ children }: { readonly children: React.ReactNode }) {
  return (
    <YStack width={22} height={15} borderRadius={3} overflow="hidden" flexShrink={0}>
      {children}
    </YStack>
  );
}

/** Czech flag (white / red / blue hoist triangle). */
export function FlagCz() {
  return (
    <FlagChip>
      <Svg width={22} height={15} viewBox="0 0 22 15">
        <Rect width={22} height={7.5} fill="#fff" />
        <Rect transform={[{ translateY: 7.5 }]} width={22} height={7.5} fill="#D7141A" />
        <Path d="M0 0L11 7.5L0 15Z" fill="#11457E" />
      </Svg>
    </FlagChip>
  );
}

/** Union Jack (drawn at the design's 60×40, into the 22×15 flag). */
export function FlagEn() {
  return (
    <FlagChip>
      <Svg
        width={22}
        height={15}
        viewBox="0 0 60 40"
        preserveAspectRatio="none"
      >
        <Rect width={60} height={40} fill="#012169" />
        <Path d="M0 0L60 40M60 0L0 40" stroke="#fff" strokeWidth={8} />
        <Path d="M0 0L60 40M60 0L0 40" stroke="#C8102E" strokeWidth={3} />
        <Path d="M30 0V40M0 20H60" stroke="#fff" strokeWidth={12} />
        <Path d="M30 0V40M0 20H60" stroke="#C8102E" strokeWidth={7} />
      </Svg>
    </FlagChip>
  );
}
