// Box-switcher bottom sheet (feature 011): the SOLE multi-box surface, opened from the inbox header.
// Lists every box (active ✓, per-box unread badge, Testovací tag, per-box ⋯ → rename/remove), plus a
// dashed "Přidat schránku" and a "Nastavení" row - the entry points retired from the old AppDrawer.
// Picking a non-active box switches the inbox IN PLACE (set + persist activeBoxId in the shell) and
// closes; the inbox re-renders without a push/pop. Sheet chrome reuses the 009 idiom from
// BoxOverflowMenu: a warm rgba(33,27,18,.4) scrim, a surfaceAlt sheet, a grab handle, swipe-down to
// dismiss; Android back closes the sheet first via the Modal's onRequestClose. No restyle.

import { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView } from 'react-native';
import Animated, {
  SlideInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sheetWidth } from '../../../theme/ContentColumn';
import { Body, Heading } from '../../../theme/Typography';
import { XStack, YStack } from '../../../theme/ui';
import { useTheme } from '../../../theme/ThemeProvider';
import { useScrim } from '../../../theme/useScrim';
import { SheetDismissGesture } from '../../../theme/SheetDismissGesture';
import { depth } from '../../../theme/depth';
import { DashedOutline } from '../../../theme/DashedOutline';
import { PlusIcon, SettingsIcon } from '../../../theme/icons';
import { useCloseOnBackground } from '../../../app/useCloseOnBackground';
import { haptics } from '../../../services/haptics';
import { t } from '../../../i18n/strings';
import type { DataBoxAccount } from '../../../services/isds/types';
import { BoxRow } from './BoxRow';
import { UnifiedRow } from './UnifiedRow';
import { unifiedAvailable } from '../state/activeBox';
import { AliasEditor } from './AliasEditor';
import { RemoveBoxDialog } from './RemoveBoxDialog';

export function BoxSwitcherSheet({
  onClose,
  accounts,
  activeBoxId,
  unified = false,
  onOpenUnified = () => {},
  onSwitch,
  onAddBox,
  onOpenSettings,
  onSetAlias,
  onRemove,
}: {
  readonly onClose: () => void;
  readonly accounts: DataBoxAccount[];
  readonly activeBoxId: string | null;
  /** Whether the merged view is what is currently on screen (024 cycle 2). */
  readonly unified?: boolean;
  /** Enter the merged view. Only reachable when at least two boxes exist. */
  readonly onOpenUnified?: () => void;
  /** Pick a box → switch the inbox in place (set + persist in the shell). */
  readonly onSwitch: (boxId: string) => void;
  readonly onAddBox: () => void;
  readonly onOpenSettings: () => void;
  readonly onSetAlias: (boxId: string, alias: string | null) => void;
  /**
   * Remove a box. Never rejects: the shell awaits the removal itself, updates the list from what it
   * actually did, and says so when it did not finish - which may be after this sheet has closed.
   */
  readonly onRemove: (boxId: string) => Promise<void>;
}) {
  const theme = useTheme();
  const scrim = useScrim(0.4);
  // depth.lg carries an inset white top-highlight (rgba 255,255,255,.45) - a subtle bevel on light
  // surfaces, but a harsh bright line along the sheet's top edge against the dark scrim. Soften it in
  // dark mode (barely-there highlight + a soft ambient lift); keep the full bevel in light mode.
  const sheetShadow =
    theme.name === 'dark'
      ? 'inset 0px 1px 1px rgba(255,255,255,0.06), 0px -2px 18px rgba(0,0,0,0.45)'
      : depth.lg;
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [editing, setEditing] = useState<DataBoxAccount | null>(null);
  const [removing, setRemoving] = useState<DataBoxAccount | null>(null);

  // Close everything (incl. the per-box dialogs) when the app backgrounds so nothing is left over the
  // lock screen (RN Modals sit above the in-tree lock overlay - see useCloseOnBackground).
  useCloseOnBackground(
    useCallback(() => {
      setEditing(null);
      setRemoving(null);
      onClose();
    }, [onClose]),
  );

  // `dragY` is the DRAG offset only - 0 at rest. The parent mounts this component ONLY while the
  // switcher is open (`{switcherOpen && <BoxSwitcherSheet/>}`), so every open is a fresh mount: dragY
  // starts at 0, the slide-up entrance is a Reanimated layout animation (SlideInDown), and closing
  // unmounts the whole subtree - no leftover state to reset. Reduce Motion → no entrance animation.
  const dragY = useSharedValue(0);
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
  }));

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      {/* No `accessibilityLabel` here: with `accessible={false}` it is never announced, so it read
          as a dismiss affordance the screen reader offers and does not. The sheet's own Close
          control is the announced way out. */}
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
            {/* press-eater: taps on the sheet itself must not dismiss it */}
            {/* Not an accessibility element: on iOS this wrapper would swallow every control
                inside the sheet into one unreachable blob (see theme/Dialog.tsx). */}
            <Pressable accessible={false} onPress={() => {}}>
              {/* Design: sheet padding 10px 14px 18px. */}
              <YStack
                // Keeps the VoiceOver cursor inside the sheet rather than letting it wander the
                // inbox behind it - the same containment `theme/Dialog.tsx` already had, which the
                // five sibling overlays were missing.
                accessibilityViewIsModal
                backgroundColor={theme.surfaceAlt}
                borderTopLeftRadius={24}
                borderTopRightRadius={24}
                paddingTop={10}
                paddingHorizontal={14}
                paddingBottom={insets.bottom + 18}
                style={{ boxShadow: sheetShadow }}
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
                {/* Design: title padding 0 6px 10px, Bricolage 16/700. */}
                <YStack paddingHorizontal={6} paddingBottom={10}>
                  <Heading fontSize={16}>{t('home.title')}</Heading>
                </YStack>

                {/* The boxes - scrollable so a long list never pushes the actions off-screen. */}
                <ScrollView
                  style={{ maxHeight: 360 }}
                  bounces={false}
                  showsVerticalScrollIndicator={false}
                >
                  {/* 024 cycle 2. Above the boxes and outside their group, because it is a MODE
                      rather than another box - see UnifiedRow for the four ways it is kept
                      distinguishable from one. Absent entirely below two boxes: with a single box it
                      and that box are the same list. */}
                  {unifiedAvailable(accounts.length) ? (
                    <UnifiedRow
                      boxCount={accounts.length}
                      unreadTotal={accounts.reduce(
                        (n, a) => n + (a.unreadCount ?? 0),
                        0,
                      )}
                      active={unified}
                      onPress={() => {
                        if (unified) {
                          onClose();
                          return;
                        }
                        haptics.selection();
                        onOpenUnified();
                      }}
                    />
                  ) : null}
                  {accounts.map(account => (
                    <BoxRow
                      key={account.boxId}
                      account={account}
                      active={!unified && account.boxId === activeBoxId}
                      onPress={() => {
                        if (!unified && account.boxId === activeBoxId) {
                          onClose(); // already active → just dismiss
                          return;
                        }
                        haptics.selection();
                        onSwitch(account.boxId); // set + persist in the shell; inbox re-renders in place
                      }}
                      onRename={() => setEditing(account)}
                      onRemove={() => setRemoving(account)}
                    />
                  ))}
                </ScrollView>

                {/* Design: full-width, 1.5px DASHED bds, radius 14, padding 13, gap 9, margin-top 6.
                    RN can't draw a dashed border with a borderRadius on Android, so the outline is an
                    SVG (DashedOutline) - otherwise it silently renders solid. */}
                <XStack
                  position="relative"
                  marginTop={6}
                  alignItems="center"
                  justifyContent="center"
                  gap={9}
                  padding={13}
                  borderRadius={14}
                  pressStyle={{ backgroundColor: theme.goldSoft }}
                  onPress={() => {
                    haptics.light();
                    onClose();
                    onAddBox();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('home.addBox')}
                  testID="switcherAddBox"
                >
                  <DashedOutline radius={14} color={theme.borderStrong} />
                  <PlusIcon size={19} color={theme.warningInk} />
                  <Body color={theme.warningInk} fontWeight="700" fontSize={14}>
                    {t('home.addBox')}
                  </Body>
                </XStack>

                {/* Design: 1px bd, margin 14px 6px. */}
                <YStack
                  height={1}
                  backgroundColor={theme.border}
                  marginVertical={14}
                  marginHorizontal={6}
                />

                {/* Design: padding 8px 12px, gap 14, radius 12. */}
                <XStack
                  alignItems="center"
                  gap={14}
                  paddingVertical={8}
                  paddingHorizontal={12}
                  borderRadius={12}
                  pressStyle={{ backgroundColor: theme.surfaceSunken }}
                  onPress={() => {
                    haptics.light();
                    onClose();
                    onOpenSettings();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('settings.title')}
                  testID="switcherSettings"
                >
                  <SettingsIcon size={21} color={theme.textMuted} />
                  <Body flex={1} fontWeight="600">
                    {t('settings.title')}
                  </Body>
                </XStack>
              </YStack>
            </Pressable>
          </Animated.View>
        </SheetDismissGesture>
      </Pressable>

      {editing ? (
        <AliasEditor
          account={editing}
          onClose={() => setEditing(null)}
          onSave={alias => {
            onSetAlias(editing.boxId, alias);
            setEditing(null);
          }}
        />
      ) : null}

      {removing ? (
        <RemoveBoxDialog
          account={removing}
          onKeep={() => setRemoving(null)}
          onDelete={() => {
            const boxId = removing.boxId;
            setRemoving(null);
            onClose(); // close the sheet; the shell handles the active-box fallback / Welcome
            // Not awaited here on purpose: the sheet is gone by the time it settles, and the shell
            // owns the outcome - the list, the route and the message when it did not finish.
            void onRemove(boxId);
          }}
        />
      ) : null}
    </Modal>
  );
}
