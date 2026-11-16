// The received message's envelope (031, board "Message - the envelope it came in"): who sent it, on
// the envelope's blue with the postmark struck when ISDS delivered it; who it is for, in the window;
// and the subject on the sheet sliding out of it. Opened from a row, the row's tile grows into the
// envelope and the sheet rises out of it (board Motion 1, `EnvelopeFlight`).
//
// A sent message opened from Odeslané (031 R7, agreed 2026-11-12) is the Sent board's envelope: from
// you, with your box's ID; to them in the window, with their address (015 US3); the stamp in the
// corner cancelled by the postmark ISDS struck. The archive does not know what a send cost - ISDS lists
// no price - so the stamp is blank where the board prints "ZDARMA 0 Kč" (not-now.md).

import { useRef, useState } from 'react';
import { Animated, Pressable, View, type LayoutChangeEvent } from 'react-native';
import { XStack, YStack } from '../../../theme/ui';
import { Caption, Display, Heading, Overline, Subheading } from '../../../theme/Typography';
import { PriceStamp, STAMP_FRAME } from './ComposeEnvelope';
import { perforation, postmarkPrint } from '../../../theme/print';
import { AddressLines } from './AddressLines';
import { useTheme } from '../../../theme/ThemeProvider';
import { Envelope } from '../../../theme/objects/Envelope';
import { Postmark } from '../../../theme/objects/Postmark';
import { Window } from '../../../theme/objects/Window';
import { objectShadow } from '../../../theme/depth';
import { t, plural } from '../../../i18n/strings';
import type { BoxType, DataBoxAccount, MessageEnvelope } from '../../../services/isds/types';
import { boxTypeLabel, boxTypeShort } from '../../accounts/state/boxType';
import { partyName } from '../state/partyName';
import { textSlop } from '../../../theme/touchTarget';
import { FlyingTile, useOpening, type TileRect } from './EnvelopeFlight';
import { clock, shortDate } from '../../../i18n/dates';


/**
 * The quieter line by a name (the owner, 2026-11-13): the box's legal form short - "PFO" - then what
 * follows it, an ID. A tap writes the form out in full and a screen reader always hears it in full: it
 * ranks below the name, it is not taken away.
 */
function FormNote({
  form,
  after,
  lead = '',
  color,
  fontWeight,
  testID,
}: {
  readonly form: BoxType | null;
  readonly after: string | null;
  /** What joins it to the name when it runs on the name's line (" · "). */
  readonly lead?: string;
  readonly color: string;
  readonly fontWeight?: '400';
  readonly testID?: string;
}) {
  const [full, setFull] = useState(false);
  const shown = [form ? (full ? boxTypeLabel(form) : boxTypeShort(form)) : null, after].filter(
    (part): part is string => part != null,
  );
  if (shown.length === 0) {
    return null;
  }
  const line = (
    <Caption fontWeight={fontWeight} color={color} testID={form ? undefined : testID}>
      {lead + shown.join(' · ')}
    </Caption>
  );
  if (!form) {
    return line;
  }
  return (
    <Pressable
      onPress={() => setFull(was => !was)}
      hitSlop={textSlop('caption')}
      // A control that opens and closes, and says which it is (031 T050).
      accessibilityRole="button"
      accessibilityState={{ expanded: full }}
      accessibilityLabel={[boxTypeLabel(form), after].filter(part => part != null).join(', ')}
      testID={testID}
    >
      {line}
    </Pressable>
  );
}

/** The sent postmark's drawing, 96 wide (the owner's answer Q1, 2026-11-16). */
export const SENT_POSTMARK_SIZE = 96;
/**
 * Where the postmark stands on a sent envelope, from its right edge: struck over the stamp's edge, like
 * a real cancellation. The stamp's paper starts 14 + 96 + 2 x 12 = 134 in; the ring reaches 40 into it,
 * so the date sits on the paper, and the stamp draws the waves across the rest. Beside the stamp (138
 * in, until 2026-11-16) it ran over the sender at 360 dp: a 310 envelope put its 108 drawing at 64-172,
 * over the sender's 18-138.
 */
const STAMP_PAPER_LEFT = 14 + STAMP_FRAME.width + 2 * perforation.stamp.inset;
/** Where the ring's outer circle ends in the drawing, the stroke included. */
const RING_RIGHT =
  ((postmarkPrint.cx + postmarkPrint.rings[0] + postmarkPrint.stroke / 2) * SENT_POSTMARK_SIZE) / postmarkPrint.width;
export const SENT_POSTMARK_RIGHT = Math.round(STAMP_PAPER_LEFT - 40 - (SENT_POSTMARK_SIZE - RING_RIGHT));
/** The sender's column beside it: "Ing. Ondřej / Dvořák" on two lines, clear of the drawing at 120. */
export const SENT_SENDER_WIDTH = 100;

/**
 * Where a sent envelope's window starts, under its top edge: the Sent board's 196 envelope less its 14
 * below and the 62 window. The sender's lines keep the room down to it, so a window that grows (the
 * address, a long name) grows the envelope downwards; pinned to the bottom it grew upwards and its top
 * went over the postmark's date and time (031 T050).
 */
const SENT_WINDOW_TOP = 120;
/** The envelope's 12 above the sender and the 8 between the sender and the window. */
const SENT_SENDER_ROOM = SENT_WINDOW_TOP - 12 - 8;

/**
 * The corner of a sent envelope: the stamp, and the postmark struck over its edge once ISDS took it, in
 * the ink of the waves that cancel it - one strike, one ink.
 */
function SentCorner({ sentAt }: { readonly sentAt: number | null }) {
  const theme = useTheme();
  return (
    <>
      <View
        style={{ position: 'absolute', right: 14, top: 14, transform: [{ rotate: '2deg' }] }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        testID="detailStamp"
      >
        {/* Compose's stamp, blank: the archive keeps no cost (the owner, 2026-11-13 and 2026-11-15). */}
        <PriceStamp price={null} frame={STAMP_FRAME} shadow="stampOnEnvelope" cancelled={sentAt != null} />
      </View>
      {sentAt != null ? (
        <View
          style={{ position: 'absolute', right: SENT_POSTMARK_RIGHT, top: 20 }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          testID="detailPostmark"
        >
          <Postmark
            ring={t('send.sent.postmark.ring')}
            line1={shortDate(sentAt)}
            line2={clock(sentAt)}
            size={SENT_POSTMARK_SIZE}
            rotate={-6}
            color={theme.cancelInk}
            waves={false}
          />
        </View>
      ) : null}
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
  // Names lead; the legal form ISDS appends to them goes to the quieter line (`FormNote`).
  const sender = partyName(envelope.sender);
  const addressee = partyName(envelope.recipient);
  const recipient = addressee.name || (sent ? '—' : (account.alias ?? account.label));
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
      {/* Above the letter tucked under its lower edge, so its shadow falls onto it (T050.9). */}
      <View
        ref={opening.envelope}
        onLayout={onEnvelopeLayout}
        collapsable={false}
        style={{ zIndex: 1 }}
        testID="detailEnvelopeFront"
      >
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
                <Postmark ring={t('detail.postmark.ring')} line1={shortDate(delivered)} line2={clock(delivered)} />
              </View>
            ) : null}
            {sent ? (
              // Under the stamp's corner, as narrow as the board's 120.
              <YStack maxWidth={SENT_SENDER_WIDTH} minHeight={SENT_SENDER_ROOM} gap={2} testID="detailSenderBlock">
                <Overline color={theme.envelopeInkSoft}>{t('detail.from')}</Overline>
                <Subheading color={theme.onSolid} testID="detailSender">
                  {sender.name || account.label}
                </Subheading>
                <FormNote
                  form={account.dbType ?? sender.form}
                  after={t('send.sent.record.id', { id: account.boxId })}
                  color={theme.envelopeInkSoft}
                  fontWeight="400"
                  testID="detailSenderForm"
                />
              </YStack>
            ) : (
            <YStack maxWidth={212} gap={2}>
              <Overline color={theme.envelopeInkSoft}>{t('detail.from')}</Overline>
              <Heading color={theme.onSolid} testID="detailSender">
                {sender.name || '—'}
              </Heading>
              <FormNote
                form={sender.form}
                after={null}
                color={theme.envelopeInkSoft}
                fontWeight="400"
                testID="detailSenderForm"
              />
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
                <FormNote lead=" · " form={addressee.form} after={recipientId} color={theme.textMuted} />
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
          // 24 = the 10 under the envelope and the 14 under the last line, so as much shows above the
          // subject as below it (the owner, 2026-11-16: "kinda hidden under the blue top bar").
          paddingTop={24}
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
