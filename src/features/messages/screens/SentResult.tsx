// The sent result (031, board "Sent - the stamp is cancelled", I39): the envelope that went - from you,
// to them in the window, the stamp it cost cancelled by the postmark ISDS struck - then "Zpráva
// odeslána", when ISDS took it, and the delivery record still to fill in. "Hotovo" is the one primary
// action; "Ukázat v Odeslaných" opens the message in the sent folder.

import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { XStack, YStack } from '../../../theme/ui';
import { Body, BodyStrong, Caption, Hero, Label, Meta, Overline, Subheading, Tag, Title } from '../../../theme/Typography';
import { useTheme } from '../../../theme/ThemeProvider';
import { chipTone } from '../../../theme/chipTone';
import { depth } from '../../../theme/depth';
import { PressScale } from '../../../theme/PressScale';
import { Envelope } from '../../../theme/objects/Envelope';
import { Postmark } from '../../../theme/objects/Postmark';
import { Stamp } from '../../../theme/objects/Stamp';
import { Slip } from '../../../theme/objects/Slip';
import { Window } from '../../../theme/objects/Window';
import { RecordRing, type RecordRingKind } from '../../../theme/objects/RecordRing';
import { t } from '../../../i18n/strings';
import type { DataBoxAccount, Recipient } from '../../../services/isds/types';
import type { SentStatus } from '../state/sendController';
import { MESSAGE_STATE } from '../state/messageState';
import { dayMonth } from './DetailEnvelope';
import { dateAndTime } from './DeliveryRecord';
import { takesVe } from './InboxRows';

/** The record's ring on this screen (board Sent: 30, where the message's record has 34). */
const RING = 30;

/** The stamp's printed face: the longest label (Czech "PLACENÁ", 56 on Android) and its 8 margins. */
const STAMP_FACE = 76;

/** "ISDS ji přijalo 11.11.2026 ve 14:02. …", with the preposition Czech gives that hour. */
export function sentBody(sentAt: number): string {
  const [date, time] = dateAndTime(sentAt);
  return t(takesVe(new Date(sentAt).getHours()) ? 'send.sent.body.ve' : 'send.sent.body', { date, time });
}

interface Step {
  readonly key: string;
  readonly ring: RecordRingKind;
  readonly label: string;
  readonly note: string;
  /** When it happened; null while it is still to come. */
  readonly at: number | null;
}

/**
 * The record as far as ISDS has said: sent now; delivered and accepted when the sent list's answer
 * says so (`status`, best effort), else still to come. Nothing is drawn as done that ISDS did not
 * report (013).
 */
export function sentSteps(sentAt: number, status: SentStatus | null): Step[] {
  const delivered = status?.deliveryTime ?? null;
  const accepted = status?.acceptanceTime ?? null;
  const fiction = accepted != null && status?.state === MESSAGE_STATE.servedByFiction;
  return [
    { key: 'sent', ring: 'arrived', label: 'send.sent.step.sent', note: 'send.sent.step.sent.note', at: sentAt },
    {
      key: 'delivered',
      ring: delivered != null ? 'arrived' : 'pending',
      label: 'send.sent.step.delivered',
      note: 'send.sent.step.delivered.note',
      at: delivered,
    },
    fiction
      ? {
          key: 'accepted',
          ring: 'fiction',
          label: 'send.sent.step.fiction',
          note: 'send.sent.step.fiction.note',
          at: accepted,
        }
      : {
          key: 'accepted',
          ring: accepted != null ? 'signed' : 'pending',
          label: 'send.sent.step.accepted',
          note: accepted != null ? 'send.sent.step.accepted.done' : 'send.sent.step.accepted.note',
          at: accepted,
        },
  ];
}

function SentEnvelope({
  account,
  recipient,
  sentAt,
  paidCzk,
}: {
  readonly account: DataBoxAccount;
  readonly recipient: Recipient;
  readonly sentAt: number;
  readonly paidCzk: number | null;
}) {
  const theme = useTheme();
  const time = dateAndTime(sentAt)[1];
  return (
    <Envelope
      style={{
        width: 310,
        maxWidth: '100%',
        minHeight: 196,
        paddingVertical: 16,
        paddingHorizontal: 18,
        gap: 12,
        justifyContent: 'space-between',
        transform: [{ rotate: '-1.5deg' }],
      }}
    >
      {/* The postmark ISDS struck when it took the message; its waves cancel the stamp beside it. */}
      <View style={{ position: 'absolute', right: 102, top: 20 }} testID="sentPostmark">
        <Postmark
          ring={t('send.sent.postmark.ring')}
          line1={dayMonth(sentAt)}
          line2={time}
          size={108}
          rotate={-6}
          waves={false}
        />
      </View>
      {/* What the send cost, stuck in the corner and cancelled. The face is 76 wide where the board's is
          64: Android draws "ZDARMA" 51 and "PLACENÁ" 56 wide, the board's face leaves them 48. */}
      <View style={{ position: 'absolute', right: 14, top: 14, transform: [{ rotate: '2deg' }] }} testID="sentStamp">
        <Stamp kind="stampSmall" shadow="stampOnEnvelope" cancelled>
          <YStack width={STAMP_FACE} height={70} paddingVertical={8} paddingHorizontal={8} justifyContent="space-between">
            <Tag color={theme.stampLabel}>
              {(paidCzk != null ? t('send.cost.paid.badge') : t('send.cost.free')).toLocaleUpperCase('cs')}
            </Tag>
            <Title color={theme.stampInk} numberOfLines={1} adjustsFontSizeToFit>
              {paidCzk != null ? t('send.sent.stamp.paid', { czk: paidCzk }) : t('send.sent.stamp.free')}
            </Title>
          </YStack>
        </Stamp>
      </View>
      <YStack maxWidth={120} gap={2}>
        <Overline color={theme.envelopeInkSoft}>{t('detail.from')}</Overline>
        <Subheading color={theme.onSolid}>{account.alias ?? account.label}</Subheading>
        <Caption fontWeight="400" color={theme.envelopeInkSoft}>
          {t('send.sent.record.id', { id: account.boxId })}
        </Caption>
      </YStack>
      <Window
        radius={12}
        style={{
          alignSelf: 'flex-start',
          width: 236,
          maxWidth: '100%',
          minHeight: 62,
          paddingTop: 10,
          paddingBottom: 10,
          paddingLeft: 13,
          paddingRight: 14,
          gap: 2,
        }}
      >
        <Overline color={theme.textMuted}>{t('detail.to')}</Overline>
        <Subheading numberOfLines={2} testID="sentRecipient">
          {recipient.name}
        </Subheading>
      </Window>
    </Envelope>
  );
}

function SentRecord({
  messageId,
  sentAt,
  status,
}: {
  readonly messageId: string;
  readonly sentAt: number;
  readonly status: SentStatus | null;
}) {
  const theme = useTheme();
  const ink = (ring: RecordRingKind) =>
    ring === 'fiction'
      ? theme.goldInk
      : ring === 'signed'
        ? chipTone('statusRead', theme).fg
        : ring === 'pending'
          ? theme.slipMark
          : theme.bodyText;
  return (
    <Slip style={{ paddingTop: 16, paddingHorizontal: 16, paddingBottom: 14, gap: 10 }}>
      <XStack alignItems="center" gap={10}>
        {/* Takes the row's width: measured to its own words, Android cuts the last one (practices,
            mobile/lifecycle.md). */}
        <Overline flex={1} color={theme.textMuted}>
          {t('recv.head')}
        </Overline>
        <Meta fontWeight="400" color={theme.textMuted}>
          {t('send.sent.record.id', { id: messageId })}
        </Meta>
      </XStack>
      {sentSteps(sentAt, status).map(step => {
        const done = step.at != null;
        const [date, time] = done ? dateAndTime(step.at as number) : ['', ''];
        return (
          <XStack key={step.key} alignItems="center" gap={12} testID={`sentStep-${step.key}`}>
            <RecordRing kind={step.ring} color={ink(step.ring)} knockout={theme.surface} size={RING} />
            <YStack flex={1} minWidth={0}>
              <BodyStrong fontWeight={done ? '700' : '600'} color={done ? theme.text : theme.textMuted}>
                {t(step.label)}
              </BodyStrong>
              <Caption fontWeight="400" color={theme.textMuted}>
                {t(step.note)}
              </Caption>
            </YStack>
            {done ? (
              <YStack alignItems="flex-end" flexShrink={0}>
                <Label color={theme.bodyText}>{date}</Label>
                <Caption color={theme.textMuted}>{time}</Caption>
              </YStack>
            ) : (
              <Label color={theme.textMuted} flexShrink={0}>
                {t('send.sent.notYet')}
              </Label>
            )}
          </XStack>
        );
      })}
    </Slip>
  );
}

export function SentResult({
  account,
  recipient,
  messageId,
  sentAt,
  paidCzk,
  reconciled,
  status,
  opening,
  onDone,
  onOpenSent,
}: {
  readonly account: DataBoxAccount;
  readonly recipient: Recipient;
  readonly messageId: string;
  /** When ISDS answered with the message's ID. */
  readonly sentAt: number;
  /** What the send cost, or null for a free one. */
  readonly paidCzk: number | null;
  /** A retry found the message already sent (005). */
  readonly reconciled: boolean;
  /** The sent list's word on it, best effort; null until (or unless) it answers. */
  readonly status: SentStatus | null;
  /** "Ukázat v Odeslaných" is on its way. */
  readonly opening: boolean;
  readonly onDone: () => void;
  readonly onOpenSent: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        alignItems: 'center',
        paddingTop: insets.top + 18,
        paddingHorizontal: 24,
        paddingBottom: insets.bottom + 16,
      }}
      testID="composeSent"
    >
      <SentEnvelope account={account} recipient={recipient} sentAt={sentAt} paidCzk={paidCzk} />
      {/* The words stretch to the column and centre themselves: a centred box measured to its own
          words loses the last one on Android (practices, mobile/lifecycle.md). */}
      <Hero alignSelf="stretch" textAlign="center" marginTop={28} accessibilityRole="header">
        {t('send.sent')}
      </Hero>
      <YStack width="100%" maxWidth={300} marginTop={8}>
        <Body alignSelf="stretch" textAlign="center" color={theme.bodyText} textBreakStrategy="balanced">
          {sentBody(sentAt)}
        </Body>
        {reconciled ? (
          <Caption alignSelf="stretch" textAlign="center" color={theme.textMuted} marginTop={8}>
            {t('send.sent.reconciled')}
          </Caption>
        ) : null}
      </YStack>
      <YStack width="100%" marginTop={24}>
        <SentRecord messageId={messageId} sentAt={sentAt} status={status} />
      </YStack>
      <YStack width="100%" marginTop="auto" paddingTop={24} gap={8}>
        <PressScale fullWidth onPress={onDone} accessibilityLabel={t('send.done')} testID="composeDone">
          <XStack
            width="100%"
            minHeight={54}
            borderRadius={16}
            backgroundColor={theme.text}
            alignItems="center"
            justifyContent="center"
            style={{ boxShadow: depth.primaryButton }}
          >
            <BodyStrong color={theme.surfaceAlt}>{t('send.done')}</BodyStrong>
          </XStack>
        </PressScale>
        <PressScale fullWidth onPress={onOpenSent} accessibilityLabel={t('send.sent.open')} testID="composeOpenSent">
          <XStack width="100%" minHeight={50} alignItems="center" justifyContent="center" opacity={opening ? 0.5 : 1}>
            <BodyStrong color={theme.text}>{t('send.sent.open')}</BodyStrong>
          </XStack>
        </PressScale>
      </YStack>
    </ScrollView>
  );
}
