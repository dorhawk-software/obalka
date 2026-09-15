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
import { BodyStrong, Heading } from '../../../theme/Typography';
import { useTheme } from '../../../theme/ThemeProvider';
import { useScrim } from '../../../theme/useScrim';
import { depth } from '../../../theme/depth';
import { t } from '../../../i18n/strings';
import type { DataBoxAccount } from '../../../services/isds/types';

/** Modal to add / edit / remove a box's alias. Clearing the field and saving removes the alias. */
export function AliasEditor({
  account,
  onSave,
  onClose,
}: {
  readonly account: DataBoxAccount;
  readonly onSave: (alias: string | null) => void;
  readonly onClose: () => void;
}) {
  const theme = useTheme();
  const scrim = useScrim(0.45);
  const [draft, setDraft] = useState(account.alias ?? '');

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
              paddingTop={22}
              paddingHorizontal={20}
              paddingBottom={18}
              style={{ boxShadow: depth.lg }}
            >
              <Heading fontSize={18} marginBottom={14}>{t('alias.renameTitle')}</Heading>
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
                onSubmitEditing={() => onSave(draft.trim() || null)}
                style={{
                  minHeight: 50,
                  borderWidth: 1,
                  borderColor: theme.borderStrong,
                  borderRadius: 14,
                  paddingHorizontal: 15,
                  fontSize: 15,
                  color: theme.text,
                  backgroundColor: theme.surface,
                }}
              />
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
                    <BodyStrong color={theme.textMuted} fontSize={14}>
                      {t('login.cancel')}
                    </BodyStrong>
                  </XStack>
                </PressScale>
                <PressScale
                  fullWidth
                  onPress={() => onSave(draft.trim() || null)}
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
                    <BodyStrong color={theme.surfaceAlt} fontSize={14}>
                      {t('alias.save')}
                    </BodyStrong>
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
