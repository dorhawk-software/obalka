// Segmented control (feature 008) - e.g. Přijaté | Odeslané in the message list. Platform-adaptive
// (US4 / research.md §3a) + a 2026 sliding-indicator micro-interaction:
//   • iOS - the segmented-control idiom: a raised white "pill" + subtle shadow on the selected segment.
//   • Android - a Material 3 connected button group: a TONAL-filled selected segment, brand-tinted ripple.
//   • Both - the selected indicator SLIDES between segments (a 2026 micro-interaction) and a `selection`
//     haptic ticks on switch, so the change is both seen and felt. The slide uses RN core `Animated`
//     (useNativeDriver:false) for a smooth JS-driven move with no spring "bop".
// Pure RN/Tamagui, no native dep.

import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  type LayoutChangeEvent,
  Platform,
  Pressable,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { Text, XStack } from './ui';
import { useTheme } from './ThemeProvider';
import { touchSlop } from './touchTarget';
import { haptics } from '../services/haptics';

const isAndroid = Platform.OS === 'android';
const PAD = 3; // track padding
const GAP = isAndroid ? 3 : 2; // gap between segments
const SEG_H = 34; // segment height
const RADIUS = 8; // segment / indicator radius

/** Hex → rgba string, for a translucent brand-tinted Android ripple. */
function withAlpha(hex: string, alpha: number): string {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface Segment<K extends string> {
  key: K;
  label: string;
}

export function SegmentedControl<K extends string>({
  segments,
  value,
  onChange,
  testID = 'segmented',
}: {
  readonly segments: ReadonlyArray<Segment<K>>;
  readonly value: K;
  readonly onChange: (key: K) => void;
  readonly testID?: string;
}) {
  const theme = useTheme();
  const ripple = { color: withAlpha(theme.blue, 0.16), borderless: false, foreground: true };
  const n = segments.length;
  const selectedIndex = Math.max(
    0,
    segments.findIndex(s => s.key === value),
  );

  // Measure the track to size + position the sliding indicator.
  const [trackW, setTrackW] = useState(0);
  const segW = trackW > 0 ? (trackW - 2 * PAD - (n - 1) * GAP) / n : 0;
  const reduceMotion = useReducedMotion();
  const x = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);
  useEffect(() => {
    if (segW <= 0) {
      return;
    }
    const target = selectedIndex * (segW + GAP);
    if (placed.current && !reduceMotion) {
      // A real switch → slide (timing, not spring; no bop).
      Animated.timing(x, {
        toValue: target,
        duration: 200,
        useNativeDriver: false,
      }).start();
    } else {
      // First layout, or Reduce Motion → snap into place, don't animate.
      x.setValue(target);
      placed.current = true;
    }
  }, [selectedIndex, segW, x, reduceMotion]);

  return (
    <XStack
      backgroundColor={theme.surfaceSunken}
      borderRadius={11}
      padding={PAD}
      gap={GAP}
      testID={testID}
      onLayout={(e: LayoutChangeEvent) =>
        setTrackW(e.nativeEvent.layout.width)
      }
    >
      {/* The sliding selected indicator - a raised surface pill with a soft shadow, the same on both platforms.
        Behind the labels (rendered first + absolute); it carries the selected look so segments stay flat. */}
      {segW > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: PAD,
            top: PAD,
            height: SEG_H,
            width: segW,
            borderRadius: RADIUS,
            transform: [{ translateX: x }],
            // Design: the selected segment is a raised `card` pill with a soft warm shadow - identical
            // on both platforms (segRecvBg = c.card, shadow 0 1px 2px rgba(33,27,18,.12)). No blue fill.
            backgroundColor: theme.surface,
            boxShadow: '0 1px 2px rgba(33,27,18,.12)',
          }}
        />
      ) : null}
      {segments.map(s => {
        const selected = s.key === value;
        return (
          <Pressable
            key={s.key}
            onPress={() => {
              if (!selected) {
                haptics.selection(); // tick only on an actual switch, not a re-tap
              }
              onChange(s.key);
            }}
            android_ripple={ripple}
            // A segment fills its share of the track, so only its 34pt height is short of the target.
            hitSlop={touchSlop({ height: SEG_H })}
            style={({ pressed }) => ({
              flex: 1,
              height: SEG_H,
              borderRadius: RADIUS,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden', // clip the Android ripple to the rounded segment
              // iOS press feedback (Android uses the ripple instead of an opacity dim).
              opacity: !isAndroid && pressed ? 0.6 : 1,
            })}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={s.label}
            testID={`${testID}-${s.key}`}
          >
            <Text
              fontSize={13}
              fontWeight="700"
              color={selected ? theme.text : theme.textMuted}
            >
              {s.label}
            </Text>
          </Pressable>
        );
      })}
    </XStack>
  );
}
