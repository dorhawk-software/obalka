// The sent result (031, board "Sent - the stamp is cancelled", I39): the envelope that went - from you,
// to them in the window, the stamp it cost cancelled by the postmark ISDS struck - then "Zpráva
// odeslána", when ISDS took it, and the delivery record still to fill in. "Hotovo" is the one primary
// action; "Ukázat v Odeslaných" opens the message in the sent folder.

import { useEffect, useRef, useState } from 'react';
import { ScrollView, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
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
import { haptics } from '../../../services/haptics';
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

/**
 * The sending moment (031, board Motion 2): the stamp is seen uncancelled for `beatMs`; then the postmark
 * lands at `landScale` and settles to 1 in `landMs` - one firm haptic, the thump of a rubber stamp - its
 * waves cancelling the stamp; then the envelope rises from the middle of the screen into its place in
 * `riseMs` while the words and the record come in under it. Ease-out, no overshoot. With Reduce Motion
 * nothing moves: the postmark and the rest crossfade in, and the haptic stays.
 */
export function sendMoment(reduceMotion: boolean) {
  return {
    beatMs: 120,
    landMs: 140,
    landScale: reduceMotion ? 1 : 1.06,
    /** The postmark fades in instead of appearing at once. */
    landFades: reduceMotion,
    riseMs: reduceMotion ? 0 : 320,
    /** When the words and the record start coming in, from the landing. */
    restDelayMs: reduceMotion ? 0 : 140,
    restMs: reduceMotion ? 140 : 320,
  } as const;
}

/** When the sending moment is over, from the landing: the screen then holds its end state plainly. */
export function sendMomentEnd(m: ReturnType<typeof sendMoment>): number {
  return Math.max(m.landMs, m.landMs + m.riseMs, m.restDelayMs + m.restMs);
}

/** The moment's end, as plain values (`settled` in `SentResult`). */
const SETTLED_ENVELOPE = { opacity: 1, top: 0 } as const;
const SETTLED_POSTMARK = { opacity: 1, transform: [{ scale: 1 }] };
const SETTLED_REST = { opacity: 1 } as const;

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
  landed,
  postmarkStyle,
}: {
  readonly account: DataBoxAccount;
  readonly recipient: Recipient;
  readonly sentAt: number;
  readonly paidCzk: number | null;
  /** The postmark has landed: it is struck, and the stamp cancelled. */
  readonly landed: boolean;
  readonly postmarkStyle: ReturnType<typeof useAnimatedStyle> | typeof SETTLED_POSTMARK;
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
      {landed ? (
        <Animated.View style={[{ position: 'absolute', right: 102, top: 20 }, postmarkStyle]} testID="sentPostmark">
          <Postmark
            ring={t('send.sent.postmark.ring')}
            line1={dayMonth(sentAt)}
            line2={time}
            size={108}
            rotate={-6}
            waves={false}
          />
        </Animated.View>
      ) : null}
      {/* What the send cost, stuck in the corner and cancelled. The face is 76 wide where the board's is
          64: Android draws "ZDARMA" 51 and "PLACENÁ" 56 wide, the board's face leaves them 48. */}
      <View style={{ position: 'absolute', right: 14, top: 14, transform: [{ rotate: '2deg' }] }} testID="sentStamp">
        <Stamp kind="stampSmall" shadow="stampOnEnvelope" cancelled={landed}>
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
  const { height: screenHeight } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [landed, setLanded] = useState(false);
  /**
   * The moment is over. Its end is then rendered with plain values: on Android, Reanimated moves
   * `transform` and `opacity` outside React and dropped the last frames, leaving the envelope 44-75
   * short of its place (2026-11-12, Obalka_Demo); what React commits itself always lands.
   */
  const [settled, setSettled] = useState(false);
  const land = useSharedValue(0);
  /** How far below its place the envelope still is; it starts in the middle of the screen. */
  const rise = useSharedValue(0);
  /** The envelope is hidden until its first layout says where the middle of the screen is from it. */
  const placed = useSharedValue(reduceMotion ? 1 : 0);
  const rest = useSharedValue(0);
  const started = useRef(false);

  const onEnvelopeLayout = (e: LayoutChangeEvent) => {
    if (placed.value === 1) {
      return;
    }
    const { y, height } = e.nativeEvent.layout;
    rise.value = started.current ? 0 : Math.max(0, screenHeight / 2 - (y + height / 2));
    placed.value = 1;
  };

  // The moment plays once, when ISDS has accepted the message and this screen appears.
  useEffect(() => {
    if (started.current) {
      return;
    }
    const m = sendMoment(reduceMotion);
    const timer = setTimeout(() => {
      started.current = true;
      setLanded(true);
      haptics.stamp();
      land.value = withTiming(1, { duration: m.landMs, easing: Easing.out(Easing.cubic) });
      rise.value = withDelay(m.landMs, withTiming(0, { duration: m.riseMs, easing: Easing.out(Easing.cubic) }));
      rest.value = withDelay(m.restDelayMs, withTiming(1, { duration: m.restMs, easing: Easing.out(Easing.cubic) }));
    }, m.beatMs);
    return () => clearTimeout(timer);
  }, [reduceMotion, land, rise, rest]);

  // Its own effect, keyed on the landing alone, so nothing else re-running can cancel the end.
  useEffect(() => {
    if (!landed) {
      return;
    }
    const end = setTimeout(() => setSettled(true), sendMomentEnd(sendMoment(reduceMotion)));
    return () => clearTimeout(end);
  }, [landed, reduceMotion]);

  // Plain numbers for the worklet: it runs on the UI thread, where `sendMoment` does not exist (a call to
  // it from there crashed the screen on Android, 2026-11-12).
  const { landFades, landScale } = sendMoment(reduceMotion);
  const postmarkStyle = useAnimatedStyle(() => ({
    opacity: landFades ? land.value : 1,
    transform: [{ scale: landScale + (1 - landScale) * land.value }],
  }));
  const envelopeStyle = useAnimatedStyle(() => ({
    opacity: placed.value,
    // `top`, not a translate: it goes through layout, so its last frame is never dropped (above).
    top: rise.value,
  }));
  const restStyle = useAnimatedStyle(() => ({ opacity: rest.value }));

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
      {/* Above the words: it rises over them into its place. */}
      {/* Measured by a plain view: the animated one only moves. */}
      <View style={{ zIndex: 1 }} onLayout={onEnvelopeLayout}>
        <Animated.View style={settled ? SETTLED_ENVELOPE : envelopeStyle}>
          <SentEnvelope
            account={account}
            recipient={recipient}
            sentAt={sentAt}
            paidCzk={paidCzk}
            landed={landed}
            postmarkStyle={settled ? SETTLED_POSTMARK : postmarkStyle}
          />
        </Animated.View>
      </View>
      <Animated.View
        style={[{ flexGrow: 1, alignSelf: 'stretch', alignItems: 'center' }, settled ? SETTLED_REST : restStyle]}
      >
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
      </Animated.View>
    </ScrollView>
  );
}
