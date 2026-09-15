import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sheetWidth } from '../../../theme/ContentColumn';
import { XStack, YStack } from '../../../theme/ui';
import { Body, Caption } from '../../../theme/Typography';
import { useTheme } from '../../../theme/ThemeProvider';
import { useScrim } from '../../../theme/useScrim';
import { SheetDismissGesture } from '../../../theme/SheetDismissGesture';
import { fonts } from '../../../theme/typography';
import { EditIcon, MoreIcon, TrashIcon } from '../../../theme/icons';
import { haptics } from '../../../services/haptics';
import { useCloseOnBackground } from '../../../app/useCloseOnBackground';
import { touchSlop } from '../../../theme/touchTarget';
import { t } from '../../../i18n/strings';
import type { DataBoxAccount } from '../../../services/isds/types';

/** The ⋯ trigger's drawn size - declared once so its touch slop is derived, not guessed. */
const TRIGGER = 38;

/**
 * Per-box overflow menu (008): a single `⋯` button opening a bottom action sheet with **Přejmenovat /
 * Odebrat**. Self-contained (renders the trigger + owns the sheet state). The sheet is dismissable by
 * tapping the dim backdrop OR swiping it down (US4 polish); it auto-closes when the app backgrounds so
 * it's never left over the lock screen.
 */
export function BoxOverflowMenu({
  account,
  onRename,
  onRemove,
}: {
  readonly account: DataBoxAccount;
  readonly onRename: () => void;
  readonly onRemove: () => void;
}) {
  const theme = useTheme();
  const scrim = useScrim(0.4);
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  useCloseOnBackground(close);

  // Swipe the sheet DOWN to dismiss. On open it SLIDES UP (the correct bottom-sheet entrance) - the
  // trigger pre-positions it offscreen (below) before mount so there's no flash, then this settles it
  // to 0. Reduce Motion → snap to 0 (no slide).
  const dragY = useSharedValue(0);
  useEffect(() => {
    if (open) {
      dragY.value = reduceMotion ? 0 : withTiming(0, { duration: 240 });
    }
  }, [open, dragY, reduceMotion]);
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
  }));

  return (
    <>
      {/* Plain RN Pressable - NOT gesture-handler's. This trigger sits inside the switcher sheet's RN
          ScrollView; a gesture-handler Pressable there doesn't receive taps on Android (the ScrollView
          keeps the touch responder), so the ⋯ silently did nothing while every other row worked. The
          box row's own press area is a plain Pressable too, so this now matches it. */}
      <Pressable
        onPress={() => {
          haptics.light(); // a light tick as the sheet opens
          if (!reduceMotion) {
            dragY.value = 800; // pre-position offscreen so it slides up (no first-frame flash)
          }
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={t('box.menu')}
        testID={`boxMenu-${account.boxId}`}
        // The size lives in a `style` callback, where a typed `hitSlop` beside it cannot see it - so
        // both read one constant, and resizing the button moves its touch area with it.
        hitSlop={touchSlop({ width: TRIGGER, height: TRIGGER })}
        style={({ pressed }) => ({
          width: TRIGGER,
          height: TRIGGER,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 11,
          backgroundColor: pressed ? theme.surfaceAlt : 'transparent',
        })}
      >
        <MoreIcon size={20} color={theme.textFaint} />
      </Pressable>

      {open ? (
        <Modal
          visible
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={close}
        >
          <Pressable
            accessible={false}
            onPress={close}
            style={{
              flex: 1,
              // Warm "paper" sheet scrim (design §3).
              backgroundColor: scrim,
              justifyContent: 'flex-end',
              alignItems: 'center',
            }}
          >
            <SheetDismissGesture dragY={dragY} onDismiss={close}>
              {/* press-eater (taps on the sheet itself must not close it) + the swipe-down transform */}
              <Animated.View style={[sheetStyle, sheetWidth]}>
                <Pressable accessible={false} onPress={() => {}}>
                  {/* Design: padding 10/14/18, no sheet shadow (the scrim + slide-up carry it). */}
                  <YStack
                    // Keeps the VoiceOver cursor on Přejmenovat / Odebrat rather than the switcher
                    // rows behind them, as in theme/Dialog.tsx. Android needs no prop: the `Modal`
                    // is a dialog window of its own, and TalkBack stays inside it.
                    accessibilityViewIsModal
                    backgroundColor={theme.surfaceAlt}
                    borderTopLeftRadius={24}
                    borderTopRightRadius={24}
                    paddingTop={10}
                    paddingHorizontal={14}
                    paddingBottom={insets.bottom + 18}
                  >
                    <YStack
                      alignSelf="center"
                      width={40}
                      height={4}
                      borderRadius={999}
                      backgroundColor={theme.borderStrong}
                      marginTop={6}
                      marginBottom={12}
                    />
                    {/* Design: only the box name (its ID/login now live on the switcher row); 13/700
                        faint, inset 6dp inside the 14dp-padded sheet. Public Sans is a per-face
                        family, so the Bold face has to be named explicitly. */}
                    <Caption
                      color={theme.textFaint}
                      fontFamily={fonts.bodyBold}
                      fontWeight="700"
                      numberOfLines={1}
                      paddingHorizontal={6}
                      paddingTop={0}
                      paddingBottom={8}
                    >
                      {account.alias ?? account.label}
                    </Caption>
                    <SheetRow
                      icon={<EditIcon size={20} color={theme.text} />}
                      label={t('box.rename')}
                      onPress={() => {
                        close();
                        onRename();
                      }}
                      testID={`boxRename-${account.boxId}`}
                    />
                    <SheetRow
                      icon={<TrashIcon size={20} color={theme.danger} />}
                      label={t('box.remove')}
                      danger
                      onPress={() => {
                        close();
                        onRemove();
                      }}
                      testID={`boxRemove-${account.boxId}`}
                    />
                  </YStack>
                </Pressable>
              </Animated.View>
            </SheetDismissGesture>
          </Pressable>
        </Modal>
      ) : null}
    </>
  );
}

/** One action row in the overflow sheet: leading icon + label, full-width tappable. */
function SheetRow({
  icon,
  label,
  danger,
  onPress,
  testID,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly danger?: boolean;
  readonly onPress: () => void;
  readonly testID: string;
}) {
  const theme = useTheme();
  return (
    <XStack
      alignItems="center"
      gap={14}
      paddingVertical={14}
      paddingHorizontal={8}
      borderRadius={12}
      pressStyle={{ backgroundColor: theme.surfaceSunken }}
      onPress={onPress}
      accessibilityRole="button"
      testID={testID}
    >
      <YStack width={20} alignItems="center">
        {icon}
      </YStack>
      <Body
        flex={1}
        fontFamily={fonts.bodySemiBold}
        fontWeight="600"
        color={danger ? theme.danger : theme.text}
      >
        {label}
      </Body>
    </XStack>
  );
}
