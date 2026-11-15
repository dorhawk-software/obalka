// The box's ⋯ menu (008): Upravit schránku, Změnit heslo (a box signed in with name and password,
// 030 US2), Odebrat.
//
// Board R9 (031 I55, agreed 2026-11-12) draws it as a popover held up beside the ⋯ that opened it, not
// a second sheet over the switcher: 230 across, the 14 corner, the surface with the popover's shadow,
// rows 48 tall with the glyph 12 before the words in the bold small role, and a hairline above Odebrat,
// which is in the danger ink. Its top edge stands just over the ⋯'s bottom and its right edge on the
// ⋯'s right; where the screen leaves no room below, it opens upwards from the ⋯'s top instead. No scrim
// of its own: the switcher behind stays as it is, and a tap anywhere outside closes it, as do back and
// the app going to the background. Until 2026-11-15 it was a bottom sheet with the box's name over the
// rows.
//
// Rounding from the board: its top overlaps the ⋯ by 3, which is the 2 step.

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, useWindowDimensions, type View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { XStack, YStack } from '../../../theme/ui';
import { SmallStrong } from '../../../theme/Typography';
import { useTheme } from '../../../theme/ThemeProvider';
import { EditIcon, LockIcon, MoreIcon, TrashIcon } from '../../../theme/icons';
import { objectShadow } from '../../../theme/depth';
import { space } from '../../../theme/spacing';
import { haptics } from '../../../services/haptics';
import { useCloseOnBackground } from '../../../app/useCloseOnBackground';
import { touchSlop } from '../../../theme/touchTarget';
import { t } from '../../../i18n/strings';
import type { DataBoxAccount } from '../../../services/isds/types';

/** The ⋯ trigger's drawn size - declared once so its touch slop is derived, not guessed. */
const TRIGGER = 38;

/** R9's popover: 230 across, the 14 corner, rows 48 tall at the least. */
const MENU = { width: 230, radius: 14, row: 48 } as const;

/** How far the menu's edge reaches over the ⋯ it opened from. */
const OVERLAP = space.hair;

/** Where the ⋯ is on the screen, measured when it is pressed. */
interface Anchor {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Where the menu stands: under the ⋯, its right edge on the ⋯'s, or over the ⋯ when the screen leaves
 * no room below. Null until both the ⋯ and the menu have been measured, so it never shows in the wrong
 * place for a frame.
 */
export function placeMenu(
  anchor: Anchor | null,
  menuHeight: number,
  screen: { readonly width: number; readonly height: number },
  insets: { readonly top: number; readonly bottom: number },
): { top: number; right: number } | null {
  if (anchor == null || menuHeight === 0) {
    return null;
  }
  const right = screen.width - (anchor.x + anchor.width);
  const below = anchor.y + anchor.height - OVERLAP;
  if (below + menuHeight <= screen.height - insets.bottom - space.base) {
    return { top: below, right };
  }
  return { top: Math.max(insets.top + space.base, anchor.y + OVERLAP - menuHeight), right };
}

export function BoxOverflowMenu({
  account,
  onRename,
  onRemove,
  onChangePassword,
}: {
  readonly account: DataBoxAccount;
  readonly onRename: () => void;
  readonly onRemove: () => void;
  /** Present for a box that signs in with name and password (030 US2). */
  readonly onChangePassword?: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const screen = useWindowDimensions();
  const trigger = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [menuHeight, setMenuHeight] = useState(0);
  const close = useCallback(() => {
    setOpen(false);
    setAnchor(null);
    setMenuHeight(0);
  }, []);
  useCloseOnBackground(close);
  const place = placeMenu(anchor, menuHeight, screen, insets);

  const choose = (action: () => void) => () => {
    close();
    action();
  };

  return (
    <>
      {/* Plain RN Pressable - NOT gesture-handler's. This trigger sits inside the switcher sheet's RN
          ScrollView; a gesture-handler Pressable there doesn't receive taps on Android (the ScrollView
          keeps the touch responder), so the ⋯ silently did nothing while every other row worked. The
          box row's own press area is a plain Pressable too, so this now matches it. */}
      <Pressable
        ref={trigger}
        onPress={() => {
          haptics.light(); // a light tick as the menu opens
          trigger.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y, width, height }));
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
        <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
          {/* The whole screen outside the menu: a tap there closes it. Clear - R9 draws no scrim. */}
          <Pressable accessible={false} onPress={close} style={{ flex: 1 }} testID="boxMenu-outside">
            {/* The press-eater: a tap on the menu's padding must not close it. */}
            <Pressable
              accessible={false}
              onPress={() => {}}
              onLayout={event => setMenuHeight(event.nativeEvent.layout.height)}
              style={{
                position: 'absolute',
                width: MENU.width,
                top: place?.top ?? 0,
                right: place?.right ?? 0,
                // Measured first, then shown where it belongs.
                opacity: place == null ? 0 : 1,
              }}
            >
              <YStack
                // Keeps the VoiceOver cursor on the menu rather than the switcher rows behind it, as
                // in theme/Dialog.tsx. Android needs no prop: the `Modal` is a dialog window of its
                // own, and TalkBack stays inside it.
                accessibilityViewIsModal
                backgroundColor={theme.surface}
                borderRadius={MENU.radius}
                paddingVertical={space.sm}
                style={{ boxShadow: objectShadow(theme.name, 'popover') }}
                testID={`boxMenuList-${account.boxId}`}
              >
                <MenuRow
                  icon={<EditIcon size={20} color={theme.text} />}
                  label={t('box.rename')}
                  onPress={choose(onRename)}
                  testID={`boxRename-${account.boxId}`}
                />
                {onChangePassword ? (
                  <MenuRow
                    icon={<LockIcon size={20} color={theme.text} />}
                    label={t('box.changePassword')}
                    onPress={choose(onChangePassword)}
                    testID={`boxChangePassword-${account.boxId}`}
                  />
                ) : null}
                <YStack height={1} backgroundColor={theme.border} />
                <MenuRow
                  icon={<TrashIcon size={20} color={theme.danger} />}
                  label={t('box.remove')}
                  danger
                  onPress={choose(onRemove)}
                  testID={`boxRemove-${account.boxId}`}
                />
              </YStack>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </>
  );
}

/** One action in the menu: the glyph, then the words, the whole row the press. */
function MenuRow({
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
      gap={space.lg}
      minHeight={MENU.row}
      paddingHorizontal={space.inset}
      pressStyle={{ backgroundColor: theme.surfaceSunken }}
      onPress={onPress}
      accessibilityRole="button"
      testID={testID}
    >
      <YStack width={20} alignItems="center">
        {icon}
      </YStack>
      <SmallStrong flex={1} color={danger ? theme.danger : theme.text}>
        {label}
      </SmallStrong>
    </XStack>
  );
}
