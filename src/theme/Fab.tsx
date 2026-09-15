// Floating action button - a prominent, unmistakable primary action (the award-winning mobile pattern:
// the one thing this screen is FOR should float, not hide in a header corner). Material 3 "expressive"
// shape (a 56pt rounded square, not a flat circle), brand-filled, with a quick press-scale + a light
// haptic so it feels tactile (2026 "feel, don't just see"). Sits bottom-trailing above the safe area.

import { useRef, type ReactNode } from 'react';
import { Animated, Pressable, type ViewStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './ThemeProvider';
import { BodyStrong } from './Typography';
import { haptics } from '../services/haptics';

// The FAB's geometry, named once. A list that scrolls UNDER the FAB has to end above it, and the two
// numbers that decide where "above it" is live here - so `useFabClearance` below derives the padding
// from the same source the button lays itself out from. The inbox used to carry a hardcoded 96, which
// happened to match on a device with no gesture bar and hid the last row behind the button on every
// device with one.
const FAB_HEIGHT = 54;
/** Distance from the safe-area edge to the FAB's bottom (design: 22 above the content's edge). */
const FAB_BOTTOM = 22;
/** Breathing room between the FAB and whatever scrolls beneath it. */
const FAB_GAP = 20;

/**
 * Bottom padding a scrollable list needs so its last row clears the FAB - the safe-area inset, the
 * FAB's own offset and height, and a gap.
 */
export function useFabClearance(): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + FAB_BOTTOM + FAB_HEIGHT + FAB_GAP;
}

export function Fab({
  icon,
  label,
  labelColor,
  tone,
  toneBorder,
  onPress,
  accessibilityLabel,
  testID,
  style,
}: {
  readonly icon: ReactNode;
  /** When set, the FAB becomes an EXTENDED pill (icon + text) - e.g. the gold "Napsat" compose action. */
  readonly label?: string;
  /** Label/ink color when `label` is set (defaults to white-on-blue). */
  readonly labelColor?: string;
  /** Fill color (defaults to the brand blue). Pass `theme.gold` for the compose FAB. */
  readonly tone?: string;
  /**
   * A 1px outline in this colour. Only needed when `tone` cannot be told apart from the page behind
   * it: the brand blue is 5.87:1 on the paper and needs nothing, the compose gold is **1.91:1** and
   * has only its drop shadow - which is atmosphere, not the boundary WCAG 1.4.11 asks for.
   */
  readonly toneBorder?: string;
  readonly onPress: () => void;
  readonly accessibilityLabel: string;
  readonly testID?: string;
  readonly style?: ViewStyle;
}) {
  const theme = useTheme();
  const extended = label != null;
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const animateTo = (v: number) => {
    if (reduceMotion) {
      return; // Reduce Motion → no press-dip (the press still fires)
    }
    Animated.timing(scale, {
      toValue: v,
      duration: 90, // quick, no spring "bop"
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={() => {
        haptics.light();
        onPress();
      }}
      onPressIn={() => animateTo(0.92)}
      onPressOut={() => animateTo(1)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={[
        // Design: right 18, `FAB_BOTTOM` above the content's bottom edge - i.e. above the home
        // indicator / gesture bar, never under it.
        { position: 'absolute', right: 18, bottom: insets.bottom + FAB_BOTTOM },
        style,
      ]}
    >
      <Animated.View
        style={{
          minWidth: 56,
          height: FAB_HEIGHT,
          borderRadius: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: extended ? 9 : 0,
          paddingHorizontal: extended ? 20 : 0,
          backgroundColor: tone ?? theme.blue,
          ...(toneBorder ? { borderWidth: 1, borderColor: toneBorder } : null),
          transform: [{ scale }],
          boxShadow: '0 8px 20px rgba(184,128,0,.4)',
        }}
      >
        {icon}
        {extended ? (
          <BodyStrong fontSize={15} color={labelColor ?? theme.onBlue}>
            {label}
          </BodyStrong>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}
