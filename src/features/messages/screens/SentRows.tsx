// A sent message in the register (031 I19, board R5 "Sent", agreed 2026-11-12): the received row's
// anatomy - the day once beside its first row, the subject, the small tile and name of who it went
// to - with its delivery state at the end of the name's line. The postmark glyph comes only with a
// time ISDS certified: "Dodáno 11.11." in muted ink once it reached the box, "Doručeno 25.10." in
// green once it was signed for (gold when the law signed for it). A message ISDS has not delivered
// yet says nothing there; one that never will says so in the stop ink, without a postmark.
//
// Under the subject, only what a glance would not assume: the countdown to the fiction while the
// recipient has not signed for it, and a note when ISDS erased the content or it went to the vault.
// Above the list, the drafts entry.

import { memo, useCallback } from 'react';
import { XStack, YStack } from '../../../theme/ui';
import { Body, Day, Meta, Small, Tag } from '../../../theme/Typography';
import { useTheme } from '../../../theme/ThemeProvider';
import { ChevronRightIcon, ContentErasedIcon, TimerIcon, VaultIcon } from '../../../theme/icons';
import { OffsetIcon } from '../../../theme/offsetIcons';
import { EnvelopeTile } from '../../../theme/objects/Envelope';
import { avatarColor } from '../../../theme/avatarPalette';
import { chipTone } from '../../../theme/chipTone';
import { objectShadow } from '../../../theme/depth';
import { CARD_RADIUS } from '../../../theme/Card';
import { t, plural } from '../../../i18n/strings';
import type { DataBoxAccount, MessageEnvelope } from '../../../services/isds/types';
import type { MessageFolder } from '../../../services/db/messagesStore';
import { fictionCountdownTone, messageStateKind, messageStatus } from '../state/messageState';
import { sentFictionCountdown } from '../state/fikce';
import { rowDate } from '../state/groupByDate';
import { sentRowLabel } from '../state/rowLabel';
import { BoxPill, boxName } from './BoxPill';
import { weekdayShort } from './InboxRows';

/** What the end of a sent row says: a certified state with its date, the stop, or nothing. */
export type SentRowState =
  | { readonly kind: 'delivered' | 'accepted' | 'fiction'; readonly label: string }
  | { readonly kind: 'stop'; readonly label: string }
  | null;

export function sentRowState(message: MessageEnvelope, now: number): SentRowState {
  const kind = messageStateKind(message.state);
  const label = t(messageStatus(message.state).labelKey);
  if (kind === 'stop') {
    return { kind, label };
  }
  if ((kind === 'accepted' || kind === 'fiction') && message.acceptanceTime != null) {
    return { kind, label: `${label} ${rowDate(message.acceptanceTime, now)}` };
  }
  // Signed for, but ISDS gave no time for it: what it certified last is the delivery.
  if (kind !== 'sent' && message.deliveryTime != null) {
    return { kind: 'delivered', label: `${t('detail.delivered')} ${rowDate(message.deliveryTime, now)}` };
  }
  return null;
}

/**
 * The countdown under a delivered message nobody has signed for: "Adresát dosud nepřevzal · Fikce za
 * 4 dny". At 0 the fiction lands today. See `fikce.ts` for why the received side has none.
 */
export function sentCountdownLabel(daysRemaining: number): string {
  const tail =
    daysRemaining === 0
      ? t('status.fikce.today')
      : t(`status.fikce.in.${plural(daysRemaining)}`, { n: daysRemaining });
  return `${t('status.notPickedUp')} · ${tail}`;
}

export const SentRegisterRow = memo(function SentRegisterRowView({
  message,
  now,
  showDay,
  onOpen,
  folder,
  boxAccount,
}: {
  readonly message: MessageEnvelope;
  readonly now: number;
  /** The first row of its day prints the day; the rest of that day leave the column blank. */
  readonly showDay: boolean;
  readonly onOpen: (messageId: string, folder: MessageFolder) => void;
  readonly folder: MessageFolder;
  /** Set ONLY in the merged view, where a row has to say which box it belongs to. */
  readonly boxAccount?: DataBoxAccount;
}) {
  const theme = useTheme();
  const onPress = useCallback(() => onOpen(message.id, folder), [onOpen, message.id, folder]);
  const recipient = message.recipient || '—';
  const subject = message.subject || t('messages.noSubject');
  const delivered = message.deliveryTime;
  const state = sentRowState(message, now);
  const stateInk =
    state == null
      ? theme.textMuted
      : state.kind === 'accepted'
        ? theme.success
        : state.kind === 'fiction'
          ? chipTone('statusFiction', theme).fg
          : state.kind === 'stop'
            ? chipTone('statusStop', theme).fg
            : theme.textMuted;
  const countdown = sentFictionCountdown(message, now);
  const countdownInk = countdown ? chipTone(fictionCountdownTone(countdown.daysRemaining), theme).fg : theme.textMuted;
  const annotation = messageStatus(message.state).annotation;
  const note = annotation ? t(annotation === 'erased' ? 'status.note.erased' : 'status.note.vault') : null;
  return (
    <XStack
      paddingHorizontal={16}
      paddingTop={showDay ? 8 : 2}
      paddingBottom={8}
      gap={14}
      alignItems="flex-start"
      pressStyle={{ backgroundColor: theme.surfaceAlt }}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={sentRowLabel({
        recipient,
        subject,
        date: rowDate(delivered, now),
        status: state?.label ?? t('messages.status.sent'),
        notes: [countdown ? sentCountdownLabel(countdown.daysRemaining) : null, note],
        box: boxName(boxAccount),
      })}
      testID={`message-${message.id}`}
    >
      <YStack width={34} alignItems="center">
        {showDay && delivered != null ? (
          <>
            <Day>{String(new Date(delivered).getDate())}</Day>
            <Meta fontWeight="600" color={theme.textFaint}>
              {weekdayShort(delivered)}
            </Meta>
          </>
        ) : null}
      </YStack>
      <YStack flex={1} minWidth={0} gap={2}>
        <Body fontWeight="600" numberOfLines={2}>
          {subject}
        </Body>
        <XStack alignItems="center" gap={6}>
          <EnvelopeTile name={recipient} color={avatarColor(recipient)} size={24} />
          <Small color={theme.textMuted} numberOfLines={1} flex={1} minWidth={0}>
            {recipient}
          </Small>
          {boxAccount ? <BoxPill account={boxAccount} compact /> : null}
          {state ? (
            <XStack alignItems="center" gap={4} flexShrink={0} testID="sentRowState">
              {state.kind === 'stop' ? null : <OffsetIcon name="postmark" size={15} color={stateInk} />}
              <Meta fontWeight="600" color={stateInk} numberOfLines={1}>
                {state.label}
              </Meta>
            </XStack>
          ) : null}
        </XStack>
        {countdown ? (
          <XStack alignItems="center" gap={6} marginTop={4}>
            <TimerIcon size={13} color={countdownInk} />
            <Meta fontWeight="700" color={countdownInk} numberOfLines={1}>
              {sentCountdownLabel(countdown.daysRemaining)}
            </Meta>
          </XStack>
        ) : null}
        {note ? (
          <XStack alignItems="center" gap={6} marginTop={4}>
            {annotation === 'erased' ? (
              <ContentErasedIcon size={13} color={theme.textFaint} />
            ) : (
              <VaultIcon size={13} color={theme.textFaint} />
            )}
            <Tag color={theme.textFaint} numberOfLines={1}>
              {note}
            </Tag>
          </XStack>
        ) : null}
      </YStack>
    </XStack>
  );
});

/**
 * The drafts: saved-but-unsent messages, which otherwise live only inside Compose. One sheet above the
 * list, the draft glyph in its well (031 I27, board R5 "Sent"); it opens Compose and its draft list.
 */
export function DraftsEntry({ count, onPress }: { readonly count: number; readonly onPress: () => void }) {
  const theme = useTheme();
  return (
    <XStack
      marginHorizontal={16}
      marginTop={12}
      minHeight={52}
      alignItems="center"
      gap={12}
      paddingHorizontal={12}
      borderRadius={CARD_RADIUS}
      backgroundColor={theme.surface}
      style={{ boxShadow: objectShadow(theme.name, 'sheet') }}
      pressStyle={{ backgroundColor: theme.surfaceAlt }}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('messages.drafts', { n: count })}
      testID="messagesDrafts"
    >
      <YStack
        width={36}
        height={36}
        borderRadius={11}
        alignItems="center"
        justifyContent="center"
        backgroundColor={theme.surfaceSunken}
      >
        <OffsetIcon name="draft" size={22} color={theme.text} />
      </YStack>
      <Small flex={1} fontWeight="600">
        {t('messages.drafts', { n: count })}
      </Small>
      <ChevronRightIcon size={18} color={theme.textMuted} />
    </XStack>
  );
}
