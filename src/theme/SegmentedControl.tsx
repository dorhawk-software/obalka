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
import { depth } from './depth';
import { withAlpha } from './color';
import { space } from './spacing';

const isAndroid = Platform.OS === 'android';
const PAD = 3; // track padding
const GAP = isAndroid ? 3 : 2; // gap between segments
const SEG_H = 34; // segment height
const RADIUS = 8; // segment / indicator radius
// Printed on the envelope (the inbox header, board InboxA): a deeper well with larger segments.
const ON_ENVELOPE = { segH: 38, radius: 9, track: 13, fontSize: 14 } as const;
const DOT = 7; // the unseen-news dot after a label - the unread dot's size


export interface Segment<K extends string> {
  key: K;
  label: string;
  /**
   * A small dot after the label: something in that segment the user has not seen. Drawn outside the
   * label's box, so the label stays where it is when the dot comes and goes (constitution V).
   */
  dot?: boolean;
  /** What a screen reader says for the segment when it differs from the label - with the dot, say. */
  accessibilityLabel?: string;
}

export function SegmentedControl<K extends string>({
  segments,
  value,
  onChange,
  testID = 'segmented',
  tone = 'paper',
}: {
  readonly segments: ReadonlyArray<Segment<K>>;
  readonly value: K;
  readonly onChange: (key: K) => void;
  readonly testID?: string;
  /** `envelope`: printed on the envelope's blue (the inbox header) rather than on the paper. */
  readonly tone?: 'paper' | 'envelope';
}) {
  const theme = useTheme();
  const onEnvelope = tone === 'envelope';
  const segH = onEnvelope ? ON_ENVELOPE.segH : SEG_H;
  const segRadius = onEnvelope ? ON_ENVELOPE.radius : RADIUS;
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
      backgroundColor={onEnvelope ? theme.envelopeWell : theme.surfaceSunken}
      borderRadius={onEnvelope ? ON_ENVELOPE.track : 11}
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
            height: segH,
            width: segW,
            borderRadius: segRadius,
            transform: [{ translateX: x }],
            // Design: the selected segment is a raised `card` pill with a soft warm shadow - identical
            // on both platforms (segRecvBg = c.card, shadow 0 1px 2px rgba(33,27,18,.12)). No blue fill.
            backgroundColor: theme.surface,
            boxShadow: onEnvelope ? depth.segmentOnEnvelope : depth.segment,
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
            hitSlop={touchSlop({ height: segH })}
            style={({ pressed }) => ({
              flex: 1,
              height: segH,
              borderRadius: segRadius,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden', // clip the Android ripple to the rounded segment
              // iOS press feedback (Android uses the ripple instead of an opacity dim).
              opacity: !isAndroid && pressed ? 0.6 : 1,
            })}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={s.accessibilityLabel ?? s.label}
            testID={`${testID}-${s.key}`}
          >
            <XStack>
              <Text
                fontSize={onEnvelope ? ON_ENVELOPE.fontSize : 13}
                fontWeight="700"
                color={selected ? theme.text : onEnvelope ? theme.envelopeInkFaint : theme.textMuted}
              >
                {s.label}
              </Text>
              {s.dot ? (
                <XStack
                  position="absolute"
                  left="100%"
                  top="50%"
                  marginLeft={space.sm}
                  marginTop={-DOT / 2}
                  width={DOT}
                  height={DOT}
                  borderRadius={999}
                  // On the envelope a blue dot would vanish into it; the flap's gold is the news there.
                  backgroundColor={onEnvelope ? theme.flap : theme.blue}
                  testID={`${testID}-${s.key}-dot`}
                />
              ) : null}
            </XStack>
          </Pressable>
        );
      })}
    </XStack>
  );
}
