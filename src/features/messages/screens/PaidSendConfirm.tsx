// The paid-send confirmation (a PDZ costs about 10 Kč): a bottom sheet with the committing button
// (design §7). Split out of ComposeScreen.tsx on 2026-11-12, when it learnt to close with the app: an
// RN Modal draws above the lock cover, so the question closes as the app leaves. A send already
// confirmed carries on (it has no idempotency key and runs once); its result is there on return.

import { Modal, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, XStack, YStack } from '../../../theme/ui';
import { PressScale } from '../../../theme/PressScale';
import { BodyStrong, Heading, Label, Small } from '../../../theme/Typography';
import { useTheme } from '../../../theme/ThemeProvider';
import { useScrim } from '../../../theme/useScrim';
import { sheetWidth } from '../../../theme/ContentColumn';
import { raised } from '../../../theme/depth';
import { useSheetMaxHeight } from '../../../theme/useSheetMaxHeight';
import { CreditCardIcon } from '../../../theme/icons';
import { useCloseOnBackground } from '../../../app/useCloseOnBackground';
import { t } from '../../../i18n/strings';

export function PaidSendConfirm({
  approxCzk,
  balanceCzk,
  busy,
  onSend,
  onCancel,
}: {
  readonly approxCzk: number;
  readonly balanceCzk: number;
  readonly busy: boolean;
  readonly onSend: () => void;
  readonly onCancel: () => void;
}) {
  const theme = useTheme();
  const scrim = useScrim(0.4);
  const insets = useSafeAreaInsets();
  const sheetMaxHeight = useSheetMaxHeight();
  useCloseOnBackground(onCancel);
  return (
    <Modal
      visible
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => {
        if (!busy) {
          onCancel();
        }
      }}
    >
      <Pressable
        accessible={false}
        onPress={() => {
          if (!busy) {
            onCancel();
          }
        }}
        style={{
          flex: 1,
          backgroundColor: scrim,
          justifyContent: 'flex-end',
          alignItems: 'center',
        }}
      >
        <Pressable accessible={false} onPress={() => {}} style={sheetWidth}>
          <YStack
            // Containment for VoiceOver, as in theme/Dialog.tsx.
            accessibilityViewIsModal
            backgroundColor={theme.surfaceAlt}
            borderTopLeftRadius={24}
            borderTopRightRadius={24}
            paddingHorizontal={18}
            paddingTop={10}
            paddingBottom={Math.max(20, insets.bottom + 8)}
            maxHeight={sheetMaxHeight}
            style={{ boxShadow: raised(theme.name, 'sheet') }}
            testID="composeConfirm"
          >
            {/* Grab handle */}
            <YStack
              width={40}
              height={4}
              borderRadius={999}
              backgroundColor={theme.borderStrong}
              alignSelf="center"
              marginTop={6}
              marginBottom={16}
            />
            {/* What it costs scrolls at its cap; the two buttons below it never leave the screen. */}
            <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} bounces={false}>
            <XStack gap={12} alignItems="center" marginBottom={12}>
              <YStack
                width={44}
                height={44}
                borderRadius={13}
                backgroundColor={theme.goldSoft}
                alignItems="center"
                justifyContent="center"
              >
                <CreditCardIcon size={24} color={theme.warningInk} />
              </YStack>
              <Heading
                flex={1}
              >
                {t('send.confirm.title')}
              </Heading>
            </XStack>
            <Small fontWeight="500"
              color={theme.textMuted}
            >
              {t('send.confirm.body', {
                czk: approxCzk,
              })}
            </Small>
            <YStack
              backgroundColor={theme.surfaceSunken}
              borderRadius={12}
              paddingHorizontal={14}
              paddingVertical={12}
              marginTop={16}
              marginBottom={16}
            >
              <Label color={theme.text}>
                {t('send.confirm.balance', {
                  czk: balanceCzk,
                })}
              </Label>
            </YStack>
            </ScrollView>
            <PressScale
              fullWidth
              busy={busy}
              onPress={onSend}
              accessibilityLabel={t('send.confirm.send', {
                czk: approxCzk,
              })}
              testID="composeConfirmSend"
            >
              <XStack
                width="100%"
                minHeight={52}
                borderRadius={14}
                backgroundColor={theme.text}
                alignItems="center"
                justifyContent="center"
                opacity={busy ? 0.6 : 1}
              >
                <BodyStrong color={theme.surfaceAlt}>
                  {t('send.confirm.send', {
                    czk: approxCzk,
                  })}
                </BodyStrong>
              </XStack>
            </PressScale>
            <Button
              chromeless
              width="100%"
              minHeight={48}
              marginTop={4}
              color={theme.textMuted}
              fontSize={14}
              fontWeight="700"
              disabled={busy}
              onPress={onCancel}
              testID="composeConfirmCancel"
            >
              {t('login.cancel')}
            </Button>
          </YStack>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
