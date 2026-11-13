// The received message's envelope (031, board "Message - the envelope it came in"): who sent it, on
// the envelope's blue with the postmark struck when ISDS delivered it; who it is for, in the window;
// and the subject on the sheet sliding out of it. Opened from a row, the row's tile grows into the
// envelope and the sheet rises out of it (board Motion 1, `EnvelopeFlight`).
//
// A sent message opened from Odeslané (031 R7, agreed 2026-11-12) is the Sent board's envelope: from
// you, with your box's ID; to them in the window, with their address (015 US3); the stamp in the
// corner cancelled by the postmark ISDS struck. The archive does not know what a send cost - ISDS lists
// no price - so the stamp is blank where the board prints "ZDARMA 0 Kč" (not-now.md).

import { useRef } from 'react';
import { Animated, View, type LayoutChangeEvent } from 'react-native';
import { XStack, YStack } from '../../../theme/ui';
import { Caption, Display, Heading, Overline, Subheading } from '../../../theme/Typography';
import { Stamp } from '../../../theme/objects/Stamp';
import { AddressLines } from './AddressLines';
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

/** The sent envelope's stamp: the board's 84, its blank face 64 by 70. */
const SENT_STAMP_FACE = { width: 64, height: 70 } as const;

/** The corner of a sent envelope: the stamp, and the postmark whose waves cancel it once ISDS took it. */
function SentCorner({ sentAt }: { readonly sentAt: number | null }) {
  return (
    <>
      {sentAt != null ? (
        <View
          style={{ position: 'absolute', right: 102, top: 20 }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          testID="detailPostmark"
        >
          <Postmark
            ring={t('send.sent.postmark.ring')}
            line1={dayMonth(sentAt)}
            line2={hourMinute(sentAt)}
            size={108}
            rotate={-6}
            waves={false}
          />
        </View>
      ) : null}
      <View
        style={{ position: 'absolute', right: 14, top: 14, transform: [{ rotate: '2deg' }] }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        testID="detailStamp"
      >
        <Stamp kind="stampSmall" shadow="stampOnEnvelope" cancelled={sentAt != null}>
          <YStack {...SENT_STAMP_FACE} />
        </Stamp>
      </View>
    </>
  );
}

export function DetailEnvelope({
  envelope,
  account,
  attachmentCount,
  openedFrom,
  onBottom,
  sent = false,
}: {
  readonly envelope: MessageEnvelope;
  /** Opened from Odeslané: from this box, to the recipient, the stamp cancelled (R7). */
  readonly sent?: boolean;
  /** The box it arrived in: who the window names when the message itself does not. */
  readonly account: DataBoxAccount;
  /** Known once the attachments are downloaded; until then the sheet says nothing about them. */
  readonly attachmentCount: number | null;
  /** The row's tile it was opened from, which grows into the envelope. */
  readonly openedFrom?: TileRect;
  /** Where the envelope ends in the scrolled content, for the band it tucks into (`DetailBand`). */
  readonly onBottom?: (y: number) => void;
}) {
  const theme = useTheme();
  const opening = useOpening(openedFrom);
  const delivered = envelope.deliveryTime;
  const recipient = envelope.recipient || (sent ? '—' : (account.alias ?? account.label));
  const recipientId = envelope.recipientBoxId ?? (sent ? null : account.boxId);
  // The envelope's frame inside this, and this one's place in the content: its bottom is the sum.
  const at = useRef({ root: null as number | null, envelope: null as number | null });
  const report = () => {
    if (at.current.root != null && at.current.envelope != null) {
      onBottom?.(at.current.root + at.current.envelope);
    }
  };
  const onRootLayout = (e: LayoutChangeEvent) => {
    at.current.root = e.nativeEvent.layout.y;
    report();
  };
  const onEnvelopeLayout = (e: LayoutChangeEvent) => {
    at.current.envelope = e.nativeEvent.layout.y + e.nativeEvent.layout.height;
    report();
    opening.onEnvelopeLayout();
  };
  return (
    // Over what follows it on the screen, which the tile flies across.
    <YStack paddingHorizontal={16} paddingTop={12} zIndex={1} onLayout={onRootLayout} testID="detailEnvelope">
      <View ref={opening.envelope} onLayout={onEnvelopeLayout} collapsable={false} testID="detailEnvelopeFront">
        {opening.tile ? <FlyingTile {...opening.tile} /> : null}
        <Animated.View style={opening.envelopeStyle}>
          <Envelope
            style={{
              minHeight: sent ? 196 : 150,
              paddingTop: 12,
              paddingHorizontal: 16,
              paddingBottom: 14,
              gap: 8,
              justifyContent: 'space-between',
            }}
          >
            {sent ? <SentCorner sentAt={delivered} /> : null}
            {!sent && delivered != null ? (
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
            {sent ? (
              // Under the stamp's corner, as narrow as the board's 120.
              <YStack maxWidth={120} gap={2}>
                <Overline color={theme.envelopeInkSoft}>{t('detail.from')}</Overline>
                <Subheading color={theme.onSolid} testID="detailSender">
                  {envelope.sender || (account.alias ?? account.label)}
                </Subheading>
                <Caption fontWeight="400" color={theme.envelopeInkSoft}>
                  {t('send.sent.record.id', { id: account.boxId })}
                </Caption>
              </YStack>
            ) : (
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
            )}
            <Window
              radius={12}
              style={
                sent
                  ? {
                      alignSelf: 'flex-start',
                      width: 236,
                      maxWidth: '100%',
                      minHeight: 62,
                      paddingTop: 10,
                      paddingBottom: 10,
                      paddingLeft: 13,
                      paddingRight: 14,
                      gap: 2,
                    }
                  : {
                      alignSelf: 'flex-start',
                      maxWidth: 250,
                      minHeight: 52,
                      paddingTop: 8,
                      paddingBottom: 8,
                      paddingLeft: 12,
                      paddingRight: 16,
                      gap: 2,
                    }
              }
            >
              <Overline color={theme.textMuted}>{t('detail.to')}</Overline>
              <XStack alignItems="baseline" flexWrap="wrap">
                <Subheading testID="detailRecipient">{recipient}</Subheading>
                {recipientId ? <Caption color={theme.textMuted}>{` · ${recipientId}`}</Caption> : null}
              </XStack>
              {/* Which of the namesakes it went to, confirmed after the fact (015 US3). */}
              {sent ? <AddressLines address={envelope.recipientAddress} marginTop={2} /> : null}
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
