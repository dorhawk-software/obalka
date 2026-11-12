// The compose button (031, board InboxA): a stamp in the flap's gold, perforated, with "Napsat" and
// the compose glyph printed inside its frame. What a send costs is a stamp, so the one action this
// screen is for is one too. It floats bottom-trailing above the safe area, dips a little when pressed
// and gives a light haptic.

import { useRef } from 'react';
import { Animated, Pressable, View, type ViewStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './ThemeProvider';
import { Body } from './Typography';
import { OffsetIcon } from './offsetIcons';
import { Stamp } from './objects/Stamp';
import { perforation } from './print';
import { haptics } from '../services/haptics';

// The FAB's geometry, named once. A list that scrolls UNDER the FAB has to end above it, and the two
// numbers that decide where "above it" is live here - so `useFabClearance` below derives the padding
// from the same source the button lays itself out from. The inbox used to carry a hardcoded 96, which
// happened to match on a device with no gesture bar and hid the last row behind the button on every
// device with one.
/** The printed frame's height (board InboxA: 44 inside a 1 frame). */
const FRAME_HEIGHT = 44;
/** The whole stamp: the frame, its rule on both sides, and the perforated margin around it. */
const FAB_HEIGHT = FRAME_HEIGHT + 2 * (1 + perforation.fab.inset);
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
  label,
  onPress,
  accessibilityLabel,
  testID,
  style,
}: {
  /** The words printed on the stamp, "Napsat". */
  readonly label: string;
  readonly onPress: () => void;
  readonly accessibilityLabel: string;
  readonly testID?: string;
  readonly style?: ViewStyle;
}) {
  const theme = useTheme();
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
      onPressIn={() => animateTo(0.94)}
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
      <Animated.View style={{ transform: [{ scale }] }}>
        {/* The flap's gold is 1.39:1 on the light paper (11.1:1 on the dark). WCAG 1.4.11 asks no
            boundary of a button its own word identifies, and "Napsat" is 10.6:1 on the gold; the
            perforated edge and the printed frame are what make it a stamp. The glow is atmosphere. */}
        <Stamp kind="fab" paper="flap" shadow="stampFab">
          <View
            style={{
              height: FRAME_HEIGHT,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingHorizontal: 16,
            }}
          >
            <OffsetIcon name="compose" size={20} color={theme.onGold} plane="flap" />
            <Body fontWeight="700" fontSize={16} lineHeight={20} color={theme.onGold}>
              {label}
            </Body>
          </View>
        </Stamp>
      </Animated.View>
    </Pressable>
  );
}
