// The inbox's strips (031 I16, board R14 "Inbox strips", agreed 2026-11-12): what is wrong with the
// box, as a tone card inset under the envelope - no hairline, the paper around it. Soft red for a box
// that cannot be used until it is answered, blue for a password still working but running out. The
// stale line is quieter: sunken, centred, no action (pulling the list retries).
//
// A strip's message and its action share the first line: at a large text size the message wraps, and
// an action centred on the whole strip lands in the middle of the sentence. An expired password takes
// two steps in order, so its two actions go under the message (001 FR-009).
//
// Under them, while the inbox syncs, the one waiting bar (R5 "Loading", R14 "Waiting").

import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, type LayoutChangeEvent } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { XStack, YStack } from '../../../theme/ui';
import { Badge, Meta } from '../../../theme/Typography';
import { useTheme } from '../../../theme/ThemeProvider';
import { AlertIcon, WifiOffIcon } from '../../../theme/icons';
import { touchSlop } from '../../../theme/touchTarget';
import type { ChipColors as ChipTone } from '../../../theme/chipTone';
import { t } from '../../../i18n/strings';

export function InboxStrip({
  tone,
  message,
  action,
  actionsBelow,
  testID,
}: {
  readonly tone: ChipTone;
  readonly message: string;
  /** One way out, beside the message (`StripAction`). */
  readonly action?: ReactNode;
  /** Several ways out, in order, under the message. */
  readonly actionsBelow?: ReactNode;
  readonly testID?: string;
}) {
  return (
    <XStack
      marginHorizontal={16}
      marginTop={12}
      minHeight={44}
      alignItems="flex-start"
      gap={10}
      paddingVertical={12}
      paddingLeft={14}
      paddingRight={actionsBelow ? 14 : 6}
      borderRadius={12}
      backgroundColor={tone.bg}
      testID={testID}
    >
      <AlertIcon size={20} color={tone.fg} />
      <YStack flex={1} minWidth={0} gap={8} paddingTop={2}>
        <Badge color={tone.fg}>{message}</Badge>
        {actionsBelow ? (
          <XStack gap={18} flexWrap="wrap">
            {actionsBelow}
          </XStack>
        ) : null}
      </YStack>
      {action}
    </XStack>
  );
}

/** A strip's way out: its words in the strip's ink, a step bolder, with a 48 target. */
export function StripAction({
  tone,
  label,
  onPress,
  role = 'button',
  below = false,
  testID,
}: {
  readonly tone: ChipTone;
  readonly label: string;
  readonly onPress: () => void;
  /** `link` when it leaves the app (the ISDS portal). */
  readonly role?: 'button' | 'link';
  /** Under the message, where it lines up with the words rather than the first line. */
  readonly below?: boolean;
  readonly testID?: string;
}) {
  return (
    <XStack
      flexShrink={0}
      paddingHorizontal={below ? 0 : 8}
      paddingTop={below ? 0 : 2}
      pressStyle={{ opacity: 0.6 }}
      onPress={onPress}
      accessibilityRole={role}
      accessibilityLabel={label}
      // From the Badge's own 16 dp line box to 48: one of the only ways out of "your box does not work".
      hitSlop={touchSlop({ height: 16 })}
      testID={testID}
    >
      <Badge fontWeight="800" color={tone.fg}>
        {label}
      </Badge>
    </XStack>
  );
}

/**
 * The rows are the last ones that loaded. Two wordings: "offline" only for a genuine network failure;
 * every other failed sync says what it can honestly say - these rows could not be refreshed.
 */
export function StaleLine({ kind, afterStrip }: { readonly kind: 'offline' | 'failed'; readonly afterStrip: boolean }) {
  const theme = useTheme();
  return (
    <XStack
      marginHorizontal={16}
      marginTop={afterStrip ? 8 : 12}
      minHeight={32}
      alignItems="center"
      justifyContent="center"
      gap={8}
      paddingHorizontal={12}
      borderRadius={11}
      backgroundColor={theme.surfaceSunken}
      testID="staleLine"
    >
      {kind === 'offline' ? (
        <WifiOffIcon size={15} color={theme.textFaint} />
      ) : (
        <AlertIcon size={15} color={theme.textFaint} />
      )}
      <Meta fontWeight="600" color={theme.textMuted} flexShrink={1}>
        {t(kind === 'offline' ? 'messages.offline' : 'messages.stale')}
      </Meta>
    </XStack>
  );
}

/**
 * The inbox syncing (031 I20, board R5 "Loading"): the one waiting bar - a 3 dp sunken track inset
 * under the strips, one segment a third of it long sweeping across. It lies over the top of the list,
 * so it takes no room and nothing moves when it comes and goes. Reduce Motion: the segment stands.
 * Core Animated on the native driver: Android never drew Reanimated's transform on these moments.
 */
export function SyncBar({ active }: { readonly active: boolean }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [track, setTrack] = useState(0);
  const [sweep] = useState(() => new Animated.Value(0));
  const segment = track * 0.3;
  useEffect(() => {
    if (!active || reduceMotion || track === 0) {
      return;
    }
    sweep.setValue(0);
    const loop = Animated.loop(
      Animated.timing(sweep, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [active, reduceMotion, track, sweep]);
  if (!active) {
    return null;
  }
  return (
    <YStack height={0} zIndex={1} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <YStack
        position="absolute"
        left={16}
        right={16}
        top={10}
        height={3}
        borderRadius={999}
        overflow="hidden"
        backgroundColor={theme.surfaceSunken}
        onLayout={(e: LayoutChangeEvent) => setTrack(e.nativeEvent.layout.width)}
        testID="syncBar"
      >
        {track > 0 ? (
          <Animated.View
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: segment,
              height: 3,
              borderRadius: 999,
              backgroundColor: theme.blue,
              transform: [
                {
                  translateX: reduceMotion
                    ? track * 0.35
                    : sweep.interpolate({ inputRange: [0, 1], outputRange: [-segment, track] }),
                },
              ],
            }}
          />
        ) : null}
      </YStack>
    </YStack>
  );
}
