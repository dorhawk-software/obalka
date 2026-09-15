import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  TextInput,
} from 'react-native';
import { XStack, YStack } from '../../../theme/ui';
import { PressScale } from '../../../theme/PressScale';
import { Caption, Heading, Label, Meta, SmallStrong } from '../../../theme/Typography';
import { Avatar } from '../../../theme/Avatar';
import { BOX_COLORS, boxColor, boxColorKey, type BoxColor } from '../../../theme/boxColor';
import { boxTypeShort } from '../state/boxType';
import { useTheme } from '../../../theme/ThemeProvider';
import { useScrim } from '../../../theme/useScrim';
import { depth } from '../../../theme/depth';
import { t } from '../../../i18n/strings';
import type { DataBoxAccount } from '../../../services/isds/types';

/**
 * "Upravit schránku" (027 decision 2B): the box's own name and its colour, in one dialog. Clearing the
 * name and saving removes it. The colour is one of `BOX_COLORS`; one another box already has is marked
 * and allowed, since telling the boxes apart is the point and the person may know better.
 */

const SWATCH_RADIUS = 12;
const SWATCH_RING = 3;
const DOT = 7;
/** From the swatch's outer edge to the dot's: what puts the dot's centre on the corner arc's centre. */
const DOT_INSET = SWATCH_RADIUS - DOT / 2;
export function AliasEditor({
  account,
  others = [],
  onSave,
  onClose,
}: {
  readonly account: DataBoxAccount;
  /** The other boxes, to mark the colours they already have. */
  readonly others?: readonly DataBoxAccount[];
  /** `color` only when it was changed here - an untouched one is not written back. */
  readonly onSave: (alias: string | null, color?: BoxColor) => void;
  readonly onClose: () => void;
}) {
  const theme = useTheme();
  const scrim = useScrim(0.45);
  const [draft, setDraft] = useState(account.alias ?? '');
  const initial = boxColor(account);
  const [color, setColor] = useState<string>(initial);
  const taken = new Set(others.filter(o => o.boxId !== account.boxId).map(o => boxColor(o)));
  // Only a colour the person picked is saved. Writing back the one the sheet opened with would, for a
  // box still on the old ID hash (not one of the ten), be refused by `setColor` - and the rename with it.
  const save = () => onSave(draft.trim() || null, color === initial ? undefined : (color as BoxColor));
  const code = boxTypeShort(account.dbType);

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        testID="aliasKeyboardAvoider"
      >
        <Pressable
          accessible={false}
          onPress={onClose}
          style={{
            flex: 1,
            // Warm "paper" dialog scrim (design §3).
            backgroundColor: scrim,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          {/* Not an accessibility element - on iOS it would swallow the whole editor into one
              unreachable blob (see theme/Dialog.tsx). */}
          <Pressable
            accessible={false}
            onPress={() => {}}
            style={{ width: '100%', maxWidth: 420 }}
          >
            <YStack
              // Keeps the VoiceOver cursor inside the editor instead of wandering the switcher sheet
              // behind it, as in theme/Dialog.tsx. iOS only: on Android the `Modal` is its own dialog
              // window, and TalkBack already stays in the window that holds focus.
              accessibilityViewIsModal
              backgroundColor={theme.surfaceAlt}
              borderRadius={20}
              paddingTop={24}
              paddingHorizontal={24}
              paddingBottom={18}
              style={{ boxShadow: depth.lg }}
            >
              <Heading fontSize={18} marginBottom={14}>{t('alias.renameTitle')}</Heading>
              {/* The live preview: the box as it will look everywhere, in the colour picked below. */}
              <XStack alignItems="center" gap={12} marginBottom={14}>
                <Avatar name={draft.trim() || account.label} color={color} size={42} />
                <Caption color={theme.textMuted} flex={1} numberOfLines={2}>
                  {code ? `${account.label} · ${code}` : account.label}
                </Caption>
              </XStack>
              <Label marginBottom={6} color={theme.textMuted}>{t('alias.name')}</Label>
              {/* Design: the rename field is empty when there's no name - no placeholder. */}
              <TextInput
                value={draft}
                onChangeText={setDraft}
                autoFocus
                returnKeyType="done"
                // The one field that is a raw RN TextInput rather than the themed `Input`, so it
                // needs this itself: without it iOS raises a keyboard in the OS's appearance, which
                // is a bright slab under a dark dialog when the two differ. See `theme/ui.tsx`.
                keyboardAppearance={theme.name === 'dark' ? 'dark' : 'light'}
                onSubmitEditing={save}
                style={{
                  minHeight: 50,
                  borderWidth: 1,
                  borderColor: theme.borderStrong,
                  borderRadius: 14,
                  paddingHorizontal: 16,
                  fontSize: 15,
                  color: theme.text,
                  backgroundColor: theme.surface,
                }}
              />
              <Label marginTop={16} marginBottom={8} color={theme.textMuted}>{t('alias.color')}</Label>
              <XStack flexWrap="wrap" gap={10} accessibilityRole="radiogroup">
                {BOX_COLORS.map(c => {
                  const selected = c === color;
                  const name = t(boxColorKey(c));
                  return (
                    <Pressable
                      key={c}
                      onPress={() => setColor(c)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={t(
                        taken.has(c) ? 'alias.color.option.taken' : 'alias.color.option',
                        { name },
                      )}
                      testID={`boxColor-${c}`}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: SWATCH_RADIUS,
                        backgroundColor: c,
                        borderWidth: selected ? SWATCH_RING : 0,
                        borderColor: theme.text,
                      }}
                    >
                      {/* Centred on the corner's own arc, so dot and corner are concentric; offset
                          from inside the ring, which a selected swatch adds, so the dot does not
                          jump 3 dp when the swatch is picked. */}
                      {taken.has(c) ? (
                        <YStack
                          position="absolute"
                          right={DOT_INSET - (selected ? SWATCH_RING : 0)}
                          bottom={DOT_INSET - (selected ? SWATCH_RING : 0)}
                          width={DOT}
                          height={DOT}
                          borderRadius={999}
                          backgroundColor={theme.onSolid}
                        />
                      ) : null}
                    </Pressable>
                  );
                })}
              </XStack>
              {taken.size > 0 ? (
                <Meta marginTop={8} color={theme.textFaint}>
                  {t('alias.color.taken')}
                </Meta>
              ) : null}
              {/* Full-width split: outline cancel + dark primary save (design §3 dialog). */}
              <XStack gap={10} alignItems="center" marginTop={18}>
                <PressScale
                  fullWidth
                  onPress={onClose}
                  accessibilityLabel={t('login.cancel')}
                  testID="aliasCancel"
                  style={{ flex: 1 }}
                >
                  <XStack
                    minHeight={48}
                    borderRadius={14}
                    borderWidth={1}
                    borderColor={theme.borderStrong}
                    backgroundColor={theme.surface}
                    alignItems="center"
                    justifyContent="center"
                  >
                    <SmallStrong color={theme.textMuted}>
                      {t('login.cancel')}
                    </SmallStrong>
                  </XStack>
                </PressScale>
                <PressScale
                  fullWidth
                  onPress={save}
                  accessibilityLabel={t('alias.save')}
                  testID="aliasSave"
                  style={{ flex: 1 }}
                >
                  {/* Design: flat dialog buttons - no shadow. */}
                  <XStack
                    minHeight={48}
                    borderRadius={14}
                    backgroundColor={theme.text}
                    alignItems="center"
                    justifyContent="center"
                  >
                    <SmallStrong color={theme.surfaceAlt}>
                      {t('alias.save')}
                    </SmallStrong>
                  </XStack>
                </PressScale>
              </XStack>
            </YStack>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
