// The received message's envelope (031, board "Message - the envelope it came in"): who sent it, on
// the envelope's blue with the postmark struck when ISDS delivered it; who it is for, in the window;
// and the subject on the sheet sliding out of it. Opened from a row, the row's tile grows into the
// envelope and the sheet rises out of it (board Motion 1, `EnvelopeFlight`).

import { Animated, View } from 'react-native';
import { XStack, YStack } from '../../../theme/ui';
import { Caption, Display, Heading, Overline, Subheading } from '../../../theme/Typography';
import { useTheme } from '../../../theme/ThemeProvider';
import { Envelope } from '../../../theme/objects/Envelope';
import { Postmark } from '../../../theme/objects/Postmark';
import { Window } from '../../../theme/objects/Window';
import { objectShadow } from '../../../theme/depth';
import { t, plural } from '../../../i18n/strings';
import type { DataBoxAccount, MessageEnvelope } from '../../../services/isds/types';
import { FlyingTile, useOpening, type TileRect } from './EnvelopeFlight';

const pad = (n: number) => String(n).padStart(2, '0');

/** "19.08.", the date a postmark strikes. */
export function dayMonth(epochMs: number): string {
  const d = new Date(epochMs);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`;
}

function hourMinute(epochMs: number): string {
  const d = new Date(epochMs);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DetailEnvelope({
  envelope,
  account,
  attachmentCount,
  openedFrom,
}: {
  readonly envelope: MessageEnvelope;
  /** The box it arrived in: who the window names when the message itself does not. */
  readonly account: DataBoxAccount;
  /** Known once the attachments are downloaded; until then the sheet says nothing about them. */
  readonly attachmentCount: number | null;
  /** The row's tile it was opened from, which grows into the envelope. */
  readonly openedFrom?: TileRect;
}) {
  const theme = useTheme();
  const opening = useOpening(openedFrom);
  const delivered = envelope.deliveryTime;
  const recipient = envelope.recipient || (account.alias ?? account.label);
  const recipientId = envelope.recipientBoxId ?? account.boxId;
  return (
    // Over what follows it on the screen, which the tile flies across.
    <YStack paddingHorizontal={16} paddingTop={12} zIndex={1}>
      <View ref={opening.envelope} onLayout={opening.onEnvelopeLayout} collapsable={false}>
        {opening.tile ? <FlyingTile {...opening.tile} /> : null}
        <Animated.View style={opening.envelopeStyle}>
          <Envelope
            style={{
              minHeight: 150,
              paddingTop: 12,
              paddingHorizontal: 16,
              paddingBottom: 14,
              gap: 8,
              justifyContent: 'space-between',
            }}
          >
            {delivered != null ? (
              // Struck where it lands, over the corner; a picture of the delivery the record below states.
              <View
                style={{ position: 'absolute', right: 8, top: 8 }}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                testID="detailPostmark"
              >
                <Postmark ring={t('detail.postmark.ring')} line1={dayMonth(delivered)} line2={hourMinute(delivered)} />
              </View>
            ) : null}
            <YStack maxWidth={212} gap={2}>
              <Overline color={theme.envelopeInkSoft}>{t('detail.from')}</Overline>
              <Heading color={theme.onSolid} testID="detailSender">
                {envelope.sender || '—'}
              </Heading>
              {envelope.senderAddress ? (
                <Caption fontWeight="400" color={theme.envelopeInkSoft} numberOfLines={2}>
                  {envelope.senderAddress}
                </Caption>
              ) : null}
            </YStack>
            <Window
              radius={12}
              style={{
                alignSelf: 'flex-start',
                maxWidth: 250,
                minHeight: 52,
                paddingTop: 8,
                paddingBottom: 8,
                paddingLeft: 12,
                paddingRight: 16,
                gap: 2,
              }}
            >
              <Overline color={theme.textMuted}>{t('detail.to')}</Overline>
              <XStack alignItems="baseline" flexWrap="wrap">
                <Subheading>{recipient}</Subheading>
                <Caption color={theme.textMuted}>{` · ${recipientId}`}</Caption>
              </XStack>
            </Window>
          </Envelope>
        </Animated.View>
      </View>
      {/* The sheet sliding out of the envelope: its top tucked 10 under the envelope's edge. */}
      <Animated.View style={opening.sheetStyle}>
        <YStack
          marginTop={-10}
          marginHorizontal={10}
          backgroundColor={theme.surface}
          borderTopLeftRadius={8}
          borderTopRightRadius={8}
          borderBottomLeftRadius={14}
          borderBottomRightRadius={14}
          paddingTop={16}
          paddingHorizontal={16}
          paddingBottom={14}
          style={{ boxShadow: objectShadow(theme.name, 'letter') }}
          testID="detailSubject"
        >
          <Display accessibilityRole="header" textBreakStrategy="balanced">
            {envelope.subject || t('detail.noSubject')}
          </Display>
          {attachmentCount != null && attachmentCount > 0 ? (
            <Caption fontWeight="400" color={theme.textMuted} marginTop={4}>
              {t(`detail.attachments.count.${plural(attachmentCount)}`, { n: attachmentCount })}
            </Caption>
          ) : null}
        </YStack>
      </Animated.View>
    </YStack>
  );
}
