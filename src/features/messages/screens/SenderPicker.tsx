// Which box a message is sent from (027 US1, US2 - decision 1A).
//
// Compose sent from whichever box it was opened in and never said which. The sender is Od on the
// envelope (031 R2), and with another box to send from it opens a sheet of every box. The sender
// matters beyond the label: recipient search, the paid-message credit and the send itself all go
// through the sender's box, which is why compose opened from the merged view asks for it first
// (`SenderGate`) and why, once chosen, it can change to another box but never back to none.

import { ScrollView } from 'react-native';
import { XStack, YStack } from '../../../theme/ui';
import { Meta, SmallStrong } from '../../../theme/Typography';
import { BottomSheet } from '../../../theme/BottomSheet';
import { space } from '../../../theme/spacing';
import { ScreenHeader } from '../../../theme/ScreenHeader';
import { useTheme } from '../../../theme/ThemeProvider';
import { useContentBottom } from '../../../theme/useContentBottom';
import { boxColor } from '../../../theme/boxColor';
import { boxTypeLabel } from '../../accounts/state/boxType';
import { needsSignIn } from '../state/messagesController';
import { t } from '../../../i18n/strings';
import type { DataBoxAccount } from '../../../services/isds/types';
import { Card } from '../../../theme/Card';
import { EnvelopeTile } from '../../../theme/objects/Envelope';
import { useCloseOnBackground } from '../../../app/useCloseOnBackground';
import { ComposeEnvelope, WaitingWindow } from './ComposeEnvelope';
import { WaitingLetter } from './ComposeParts';

const boxName = (a: DataBoxAccount) => a.alias ?? a.label;

/**
 * R9's sender row (031 I58, agreed 2026-11-12): 60 tall at the least, the box's envelope tile at 36, its
 * name over its kind and ID, and the Language rows' radio. A box that needs a new sign-in is dimmed and
 * says so. Until 2026-11-15 the tile was the plain avatar and the radio a filled disc.
 */
const SENDER_ROW = 60;


/** The sheet of boxes to send from. A box waiting for a sign-in is listed and cannot be picked. */
export function SenderSheet({
  accounts,
  selected,
  onPick,
  onClose,
}: {
  readonly accounts: readonly DataBoxAccount[];
  readonly selected: string | null;
  readonly onPick: (boxId: string) => void;
  readonly onClose: () => void;
}) {
  const theme = useTheme();
  // BottomSheet leaves closing to its caller; an RN Modal draws above the lock cover.
  useCloseOnBackground(onClose);
  return (
    <BottomSheet onClose={onClose} title={t('send.from.sheet')} testID="senderSheet">
      {/* R9: the card 14 under the title. */}
      <Card
        overflow="hidden"
        marginTop={space.xl}
      >
        {accounts.map((account, i) => {
          const blocked = needsSignIn(account.syncError);
          const on = account.boxId === selected;
          return (
            <XStack
              key={account.boxId}
              alignItems="center"
              gap={space.lg}
              minHeight={SENDER_ROW}
              paddingVertical={space.lg}
              paddingHorizontal={space.xl}
              borderTopWidth={i === 0 ? 0 : 1}
              borderColor={theme.border}
              opacity={blocked ? 0.5 : 1}
              pressStyle={blocked ? undefined : { backgroundColor: theme.surfaceAlt }}
              onPress={blocked ? undefined : () => onPick(account.boxId)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on, disabled: blocked }}
              accessibilityLabel={[boxName(account), blocked ? t('send.from.signIn') : null]
                .filter(Boolean)
                .join(', ')}
              testID={`senderOption-${account.boxId}`}
            >
              <EnvelopeTile name={boxName(account)} color={boxColor(account)} size={36} box testID={`envelopeTile-${account.boxId}`} />
              <YStack flex={1} minWidth={0}>
                <SmallStrong numberOfLines={1}>
                  {boxName(account)}
                </SmallStrong>
                <Meta color={theme.textFaint} numberOfLines={1}>
                  {blocked
                    ? t('send.from.signIn')
                    : [boxTypeLabel(account.dbType), `ID ${account.boxId}`]
                        .filter(Boolean)
                        .join(' · ')}
                </Meta>
              </YStack>
              <YStack
                width={22}
                height={22}
                borderRadius={11}
                borderWidth={2}
                borderColor={on ? theme.blue : theme.borderStrong}
                alignItems="center"
                justifyContent="center"
                testID={on ? 'senderOption-on' : undefined}
              >
                {/* The Language rows' radio (`OptionGroup`, R9): a blue ring and a 12 blue dot. */}
                {on ? <YStack width={12} height={12} borderRadius={999} backgroundColor={theme.blue} /> : null}
              </YStack>
            </XStack>
          );
        })}
      </Card>
    </BottomSheet>
  );
}

/**
 * Compose opened from the merged view, before a sender is chosen (R12 "No sender yet"): the envelope
 * with Od as a dashed slot to choose the box in, the window and the letter dimmed, the stamp blank -
 * the person sees what they are about to fill in. Nothing can be typed yet, so nothing is lost when
 * the real compose takes over.
 */
export function SenderGate({
  accounts,
  picking,
  onOpenPicker,
  onClosePicker,
  onPick,
  onBack,
}: {
  readonly accounts: readonly DataBoxAccount[];
  readonly picking: boolean;
  readonly onOpenPicker: () => void;
  readonly onClosePicker: () => void;
  readonly onPick: (boxId: string) => void;
  readonly onBack: () => void;
}) {
  const theme = useTheme();
  const bottom = useContentBottom(24);
  return (
    <YStack flex={1} backgroundColor={theme.bg}>
      <ScreenHeader title={t('send.title')} onBack={onBack} testID="composeBack" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: bottom }}>
        <ComposeEnvelope account={null} estimate={null} onPickSender={onOpenPicker}>
          <WaitingWindow />
        </ComposeEnvelope>
        <WaitingLetter />
      </ScrollView>
      {picking ? (
        <SenderSheet accounts={accounts} selected={null} onPick={onPick} onClose={onClosePicker} />
      ) : null}
    </YStack>
  );
}
