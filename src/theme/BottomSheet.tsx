// The bottom sheet's chrome, once: the Termín picker's and the box switcher's, which drew it byte for
// byte the same, and the language picker's since 2026-09-24. A warm scrim that closes the sheet when
// tapped, the surfaceAlt sheet rising from the bottom (radius 24, padding 10 above, 24 at the sides and
// 18 over the bottom inset), the grab handle, swipe-down to dismiss (`SheetDismissGesture`), and Android back closing it
// through the Modal's `onRequestClose`. Reusing beats inventing (Principle V): a new sheet takes these
// metrics rather than its own.
//
// Board R9 (031 I53, agreed 2026-11-12) draws every sheet this way: the grabber alone at the top, the
// title in the title role 16 under it, a line of words 6 under that when the sheet has one, and the
// sheet's own content after - each sheet says how far below (14 to a card, 16 to an overline), as R9
// does. Until 2026-11-15 the sides were 14 and the title Bricolage 16/700 under a 6 inset.
//
// Mounted only while open (`{open ? <Sheet/> : null}`), so every open is a fresh mount: the drag
// offset starts at 0 and the entrance is a layout animation. Closing when the app goes to the
// background is the caller's, with `useCloseOnBackground` - an RN `Modal` is a window of its own and
// would otherwise sit over the lock screen.

import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView } from 'react-native';
import Animated, {
  SlideInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sheetWidth } from './ContentColumn';
import { Small, Title } from './Typography';
import { space } from './spacing';
import { YStack } from './ui';
import { useTheme } from './ThemeProvider';
import { useScrim } from './useScrim';
import { SheetDismissGesture } from './SheetDismissGesture';
import { raised } from './depth';
import { useSheetMaxHeight } from './useSheetMaxHeight';

/** Room the scrolling content keeps for a card's shadow, which a scroll view would otherwise cut. */
const SHADOW_ROOM = { side: space.base, below: space.inset } as const;

export function BottomSheet({
  onClose,
  title,
  subtitle,
  testID,
  footer,
  children,
}: {
  readonly onClose: () => void;
  /** The sheet's heading, in the title role (R9). */
  readonly title?: string;
  /** A line of muted words under the title (R9's What's new: since which version, how many changes). */
  readonly subtitle?: string;
  readonly testID?: string;
  /**
   * Pinned under the scrolling content, so it stays in reach however long that runs: the one action
   * that closes the sheet (What's new's "Pokračovat", spec 029).
   */
  readonly footer?: ReactNode;
  readonly children: ReactNode;
}) {
  const theme = useTheme();
  const scrim = useScrim(0.4);
  const insets = useSafeAreaInsets();
  const maxHeight = useSheetMaxHeight();
  const reduceMotion = useReducedMotion();
  // `raised`: depth.lg carries an inset white top-highlight - a bevel on light surfaces, a harsh line along the
  // sheet's top edge against the dark scrim. Softened in dark mode, kept in light.
  const sheetShadow = raised(theme.name, 'sheet');

  const dragY = useSharedValue(0);
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
  }));

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      {/* No `accessibilityLabel`: with `accessible={false}` it is never announced. */}
      <Pressable
        accessible={false}
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: scrim, // warm "paper" sheet scrim (009 §3)
          justifyContent: 'flex-end',
          // Centred so the sheet can be capped on a tablet instead of spanning a metre of glass.
          alignItems: 'center',
        }}
      >
        <SheetDismissGesture dragY={dragY} onDismiss={onClose}>
          <Animated.View
            style={[sheetStyle, sheetWidth]}
            entering={reduceMotion ? undefined : SlideInDown.duration(240)}
          >
            {/* The press-eater: a tap on the sheet itself must not close it. Not an accessibility
                element: on iOS this wrapper would swallow every control inside the sheet into one
                unreachable blob (see theme/Dialog.tsx). */}
            <Pressable accessible={false} onPress={() => {}}>
              <YStack
                // Keeps the VoiceOver cursor inside the sheet rather than on the screen behind it, as
                // in theme/Dialog.tsx. Android needs no prop: the `Modal` is a dialog window of its
                // own, and TalkBack stays inside it.
                accessibilityViewIsModal
                backgroundColor={theme.surfaceAlt}
                borderTopLeftRadius={24}
                borderTopRightRadius={24}
                paddingTop={space.md}
                paddingHorizontal={space.section}
                paddingBottom={insets.bottom + space.gutter}
                maxHeight={maxHeight}
                style={{ boxShadow: sheetShadow }}
                testID={testID}
              >
                <YStack
                  alignSelf="center"
                  width={40}
                  height={4}
                  borderRadius={999}
                  backgroundColor={theme.borderStrong}
                />
                {title != null ? (
                  <Title marginTop={space.inset} accessibilityRole="header">
                    {title}
                  </Title>
                ) : null}
                {subtitle != null ? (
                  <Small color={theme.textMuted} marginTop={space.sm} testID={testID ? `${testID}-subtitle` : undefined}>
                    {subtitle}
                  </Small>
                ) : null}
                {/* Scrolls once the sheet reaches its cap, so it never rises past the status bar.
                    A scroll view clips what it holds, and a card's resting shadow reaches 14 under it
                    and 6 beside it (depth `sheet`): the view reaches past the content by that much and
                    pads it back, so the cards keep their shadow and nothing moves. */}
                <ScrollView
                  style={{
                    flexGrow: 0,
                    flexShrink: 1,
                    marginHorizontal: -SHADOW_ROOM.side,
                    marginBottom: -SHADOW_ROOM.below,
                  }}
                  contentContainerStyle={{
                    paddingHorizontal: SHADOW_ROOM.side,
                    paddingBottom: SHADOW_ROOM.below,
                  }}
                  bounces={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {children}
                </ScrollView>
                {footer}
              </YStack>
            </Pressable>
          </Animated.View>
        </SheetDismissGesture>
      </Pressable>
    </Modal>
  );
}
