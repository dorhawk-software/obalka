// Which box a message is sent from (027 US1, US2 - decision 1A).
//
// Compose sent from whichever box it was opened in and never said which. Here the sender is a card of
// its own above the recipient, in the same shape, and "Změnit" opens a sheet of every box. The sender
// matters beyond the label: recipient search, the paid-message credit and the send itself all go
// through the sender's box, which is why compose opened from the merged view asks for it first
// (`SenderGate`) and why, once chosen, it can change to another box but never back to none.

import { ScrollView } from 'react-native';
import { XStack, YStack } from '../../../theme/ui';
import { Badge, Body, Label, Meta, SmallStrong } from '../../../theme/Typography';
import { Avatar } from '../../../theme/Avatar';
import { BottomSheet } from '../../../theme/BottomSheet';
import { DashedOutline } from '../../../theme/DashedOutline';
import { ScreenHeader } from '../../../theme/ScreenHeader';
import { useTheme } from '../../../theme/ThemeProvider';
import { textSlop } from '../../../theme/touchTarget';
import { useContentBottom } from '../../../theme/useContentBottom';
import { boxColor } from '../../../theme/boxColor';
import { boxTypeLabel } from '../../accounts/state/boxType';
import { needsSignIn } from '../state/messagesController';
import { formatCzk } from '../state/credit';
import { t } from '../../../i18n/strings';
import type { DataBoxAccount } from '../../../services/isds/types';
import { Card } from '../../../theme/Card';

const boxName = (a: DataBoxAccount) => a.alias ?? a.label;

/** "Fyzická osoba · kredit 120 Kč" - what the sender row says under the name. */
function senderLine(account: DataBoxAccount): string {
  return [
    boxTypeLabel(account.dbType),
    account.pdzCreditCzk != null
      ? t('send.from.credit', { amount: formatCzk(account.pdzCreditCzk) })
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** The "Od" card: the chosen sender, and "Změnit" when there is another box to change to. */
export function SenderCard({
  account,
  onChange,
}: {
  readonly account: DataBoxAccount;
  /** Absent: nothing to change to (one box), or the message is already sent. */
  readonly onChange?: () => void;
}) {
  const theme = useTheme();
  return (
    <YStack marginBottom={18}>
      <Label fontWeight="700" marginBottom={8}>
        {t('send.from')}
      </Label>
      <Card flexDirection="row"
        padding={12}
        gap={12}
        alignItems="center"
        testID="composeSender"
      >
        <Avatar name={boxName(account)} color={boxColor(account)} size={38} />
        <YStack flex={1} minWidth={0}>
          <SmallStrong color={theme.text} numberOfLines={1}>
            {boxName(account)}
          </SmallStrong>
          <Meta color={theme.textFaint} numberOfLines={1}>
            {senderLine(account)}
          </Meta>
        </YStack>
        {onChange ? (
          <XStack
            hitSlop={textSlop('badge', { paddingVertical: 4 })}
            paddingHorizontal={4}
            paddingVertical={4}
            pressStyle={{ opacity: 0.5 }}
            onPress={onChange}
            accessibilityRole="button"
            accessibilityLabel={t('send.from.change')}
            testID="composeChangeSender"
          >
            <Badge color={theme.warningInk} numberOfLines={1}>
              {t('send.from.changeShort')}
            </Badge>
          </XStack>
        ) : null}
      </Card>
    </YStack>
  );
}

/** No sender yet: the dashed prompt compose from "Vše" opens with. */
export function SenderPrompt({ onPress }: { readonly onPress: () => void }) {
  const theme = useTheme();
  return (
    <YStack marginBottom={18}>
      <Label fontWeight="700" marginBottom={8}>
        {t('send.from')}
      </Label>
      <XStack
        position="relative"
        borderRadius={14}
        padding={12}
        gap={12}
        alignItems="center"
        backgroundColor={theme.surfaceAlt}
        pressStyle={{ opacity: 0.7 }}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t('send.from.pick')}
        testID="composePickSender"
      >
        <DashedOutline color={theme.borderStrong} />
        <YStack width={38} height={38} borderRadius={11} position="relative">
          <DashedOutline radius={11} color={theme.borderStrong} />
        </YStack>
        <Body fontWeight="600" flex={1} color={theme.warningInk}>
          {t('send.from.pick')}
        </Body>
      </XStack>
    </YStack>
  );
}

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
  return (
    <BottomSheet onClose={onClose} title={t('send.from.sheet')} testID="senderSheet">
      <Card
        overflow="hidden"
      >
        {accounts.map((account, i) => {
          const blocked = needsSignIn(account.syncError);
          const on = account.boxId === selected;
          return (
            <XStack
              key={account.boxId}
              alignItems="center"
              gap={12}
              paddingVertical={12}
              paddingHorizontal={14}
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
              <Avatar name={boxName(account)} color={boxColor(account)} size={36} />
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
                backgroundColor={on ? theme.blue : 'transparent'}
                alignItems="center"
                justifyContent="center"
              >
                {on ? (
                  <YStack width={9} height={9} borderRadius={5} backgroundColor={theme.onBlue} />
                ) : null}
              </YStack>
            </XStack>
          );
        })}
      </Card>
    </BottomSheet>
  );
}

/**
 * Compose opened from the merged view, before a sender is chosen: the prompt, and the rest of the form
 * shown but inactive, so the person sees what they are about to fill in. Nothing can be typed yet, so
 * nothing is lost when the real compose takes over.
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
  const placeholder = (label: string, hint: string) => (
    <YStack marginBottom={18}>
      <Label fontWeight="700" marginBottom={8}>
        {label}
      </Label>
      <XStack
        minHeight={50}
        borderWidth={1}
        borderColor={theme.borderStrong}
        borderRadius={14}
        paddingHorizontal={16}
        alignItems="center"
        backgroundColor={theme.surface}
      >
        <Body color={theme.textFaint}>{hint}</Body>
      </XStack>
    </YStack>
  );
  return (
    <YStack flex={1} backgroundColor={theme.bg}>
      <ScreenHeader title={t('send.title')} onBack={onBack} testID="composeBack" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 18, paddingBottom: bottom }}>
        <SenderPrompt onPress={onOpenPicker} />
        <YStack
          opacity={0.45}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {placeholder(t('send.recipient'), t('send.from.first'))}
          {placeholder(t('send.subject'), t('send.subject.placeholder'))}
        </YStack>
      </ScrollView>
      {picking ? (
        <SenderSheet accounts={accounts} selected={null} onPick={onPick} onClose={onClosePicker} />
      ) : null}
    </YStack>
  );
}
