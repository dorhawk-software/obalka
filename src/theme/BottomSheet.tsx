// The bottom sheet's chrome, once: the Termín picker's and the box switcher's, which drew it byte for
// byte the same, and the language picker's since 2026-09-24. A warm scrim that closes the sheet when
// tapped, the surfaceAlt sheet rising from the bottom (radius 24, padding 10/14/18 over the bottom
// inset), the grab handle, swipe-down to dismiss (`SheetDismissGesture`), and Android back closing it
// through the Modal's `onRequestClose`. Reusing beats inventing (Principle V): a new sheet takes these
// metrics rather than its own.
//
// Mounted only while open (`{open ? <Sheet/> : null}`), so every open is a fresh mount: the drag
// offset starts at 0 and the entrance is a layout animation. Closing when the app goes to the
// background is the caller's, with `useCloseOnBackground` - an RN `Modal` is a window of its own and
// would otherwise sit over the lock screen.

import type { ReactNode } from 'react';
import { Modal, Pressable } from 'react-native';
import Animated, {
  SlideInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sheetWidth } from './ContentColumn';
import { Heading } from './Typography';
import { YStack } from './ui';
import { useTheme } from './ThemeProvider';
import { useScrim } from './useScrim';
import { SheetDismissGesture } from './SheetDismissGesture';
import { depth } from './depth';

export function BottomSheet({
  onClose,
  title,
  testID,
  children,
}: {
  readonly onClose: () => void;
  /** The sheet's heading (Bricolage 16/700, inset 6 like the rows under it). */
  readonly title?: string;
  readonly testID?: string;
  readonly children: ReactNode;
}) {
  const theme = useTheme();
  const scrim = useScrim(0.4);
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  // depth.lg carries an inset white top-highlight - a bevel on light surfaces, a harsh line along the
  // sheet's top edge against the dark scrim. Softened in dark mode, kept in light.
  const sheetShadow =
    theme.name === 'dark'
      ? 'inset 0px 1px 1px rgba(255,255,255,0.06), 0px -2px 18px rgba(0,0,0,0.45)'
      : depth.lg;

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
                paddingTop={10}
                paddingHorizontal={14}
                paddingBottom={insets.bottom + 18}
                style={{ boxShadow: sheetShadow }}
                testID={testID}
              >
                <YStack
                  alignSelf="center"
                  width={40}
                  height={4}
                  borderRadius={999}
                  backgroundColor={theme.borderStrong}
                  marginTop={6}
                  marginBottom={14}
                />
                {title != null ? (
                  // Design: title padding 0 6px 10px, Bricolage 16/700.
                  <YStack paddingHorizontal={6} paddingBottom={10}>
                    <Heading fontSize={16}>{title}</Heading>
                  </YStack>
                ) : null}
                {children}
              </YStack>
            </Pressable>
          </Animated.View>
        </SheetDismissGesture>
      </Pressable>
    </Modal>
  );
}
