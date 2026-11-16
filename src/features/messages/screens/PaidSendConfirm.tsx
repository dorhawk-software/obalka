// The paid-send question (a PDZ costs about 10 Kč), as R2 draws it (031 I40, agreed 2026-11-12): the
// stamp the send will take, laid on the sheet on its own and tilted as on the envelope, the question
// under it, what it costs, the box's credit, and the answers under the thumb. R9 took this sheet as
// the shape of every question, so it is the app's `Dialog`: it rises, scrolls and closes as they do.
// Until 2026-11-15 it was a sheet of its own that slid up (I74), with a card glyph and a sunken panel
// for the credit.
//
// Split out of ComposeScreen.tsx on 2026-11-12, when it learnt to close with the app: a Modal draws
// above the lock cover, so the question closes as the app leaves. A send already confirmed carries on
// (it has no idempotency key and runs once); its result is there on return.

import { View } from 'react-native';
import { YStack } from '../../../theme/ui';
import { Label, Small } from '../../../theme/Typography';
import { useTheme } from '../../../theme/ThemeProvider';
import { Dialog } from '../../../theme/Dialog';
import { space } from '../../../theme/spacing';
import { useCloseOnBackground } from '../../../app/useCloseOnBackground';
import { t } from '../../../i18n/strings';
import { PriceStamp } from './ComposeEnvelope';

/** R2's stamp on the sheet: 112 wide and 92 tall at the least, its 1 border included. */
const STAMP_FRAME = { width: 112, height: 92 };

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
  useCloseOnBackground(onCancel);
  const cancelUnlessSending = () => {
    if (!busy) {
      onCancel();
    }
  };
  return (
    <Dialog
      title={t('send.confirm.title')}
      object={
        <View
          style={{ transform: [{ rotate: '2deg' }] }}
          // The words say what it costs; the picture would only say it again.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          testID="composeConfirmStamp"
        >
          <PriceStamp price={{ paid: true, czk: approxCzk }} frame={STAMP_FRAME} shadow="stamp" />
        </View>
      }
      body={
        <YStack alignItems="center" gap={space.base}>
          <Small color={theme.bodyText} textAlign="center">
            {t('send.confirm.body', { czk: approxCzk })}
          </Small>
          <Label fontWeight="500" color={theme.textMuted} textAlign="center" testID="composeConfirmBalance">
            {t('send.confirm.balance', { czk: balanceCzk })}
          </Label>
        </YStack>
      }
      actions={[
        { label: t('send.confirm.send', { czk: approxCzk }), onPress: onSend, tone: 'primary', busy, testID: 'composeConfirmSend' },
        { label: t('send.confirm.cancel'), onPress: cancelUnlessSending, testID: 'composeConfirmCancel' },
      ]}
      onDismiss={cancelUnlessSending}
      testID="composeConfirm"
    />
  );
}
