// Compose is the envelope you are sending (031 I38, boards R2 and R12, agreed 2026-11-12): Od on the
// envelope, Komu in its window, the stamp in its corner. The stamp says what the send costs once a
// recipient decides it - Zdarma for a public authority, Placená for a postal data message - and is a
// blank dashed slot until then. The window is the recipient search's field while nobody is picked
// (R12, picked 2026-11-12), and the picked recipient after. When ISDS accepts the message the
// postmark lands on this same stamp (the sent result, Motion 2).

import { useRef, useState, type ReactNode } from 'react';
import { View, useWindowDimensions, type TextInput } from 'react-native';
import { Input, XStack, YStack } from '../../../theme/ui';
import { Caption, Overline, Subheading, Tag, Title } from '../../../theme/Typography';
import { useTheme } from '../../../theme/ThemeProvider';
import { Envelope } from '../../../theme/objects/Envelope';
import { Stamp } from '../../../theme/objects/Stamp';
import { Window, WindowBlankLine } from '../../../theme/objects/Window';
import { OffsetIcon } from '../../../theme/offsetIcons';
import { ChevronDownIcon, ChevronRightIcon } from '../../../theme/icons';
import { DashedOutline } from '../../../theme/DashedOutline';
import { envelopeShape } from '../../../theme/print';
import { fonts, type as typeScale } from '../../../theme/typeScale';
import { boxTypeLabel } from '../../accounts/state/boxType';
import type { CreditState } from '../state/credit';
import { t } from '../../../i18n/strings';
import type { CostEstimate, DataBoxAccount, Recipient } from '../../../services/isds/types';

/** The window leaves the stamp's column free: R2's 44 to the envelope's right edge. */
const WINDOW_RIGHT = 44;
/** The stamp's printed frame (R2: 96 wide and 78 tall at the least, its 1 border included; the 12
 * perforated margin lies outside it). */
const FRAME = { width: 96, height: 78 };
/** Od's place above the window: R2's 188 less 12 and 14 of margin, the 10 gap and the window's 72
 * (Komu, the name and one line under it). */
const OD_HEIGHT = 80;

/**
 * The envelope, its stamp, and Od. `children` is the window. `account` null: compose opened from the
 * merged view and no sender chosen yet - the Od slot is the dashed prompt (R12 "No sender yet").
 */
export function ComposeEnvelope({
  account,
  credit,
  estimate,
  onChangeSender,
  onPickSender,
  children,
}: {
  readonly account: DataBoxAccount | null;
  /** The sender's credit, said on the envelope under its ID once known (020: unknown says nothing). */
  readonly credit?: CreditState;
  /** The price a recipient sets; null until one is picked, and the stamp is blank. */
  readonly estimate: CostEstimate | null;
  /** Another box to send from; absent with one box. */
  readonly onChangeSender?: () => void;
  /** No sender yet: open the sheet of boxes. */
  readonly onPickSender?: () => void;
  readonly children: ReactNode;
}) {
  return (
    <Envelope
      creases={envelopeShape.composeCreases}
      style={{
        minHeight: 188,
        paddingTop: 12,
        paddingHorizontal: 16,
        paddingBottom: 14,
        gap: 10,
        justifyContent: 'space-between',
      }}
    >
      <View style={{ position: 'absolute', right: 14, top: 12, transform: [{ rotate: '2deg' }] }}>
        <CostStamp estimate={estimate} />
      </View>
      {/* Od keeps the stamp's height free, so a longer window grows the envelope down rather than
          covering the stamp. */}
      <YStack minHeight={OD_HEIGHT}>
        {account ? (
          <SenderOnEnvelope account={account} credit={credit} onChange={onChangeSender} />
        ) : (
          <SenderSlot onPress={onPickSender} />
        )}
      </YStack>
      {children}
    </Envelope>
  );
}

/** The stamp the send will take: blank until a recipient sets the price (R12), then R2's face. */
function CostStamp({ estimate }: { readonly estimate: CostEstimate | null }) {
  const theme = useTheme();
  if (!estimate) {
    return (
      <View
        style={{ width: 84, height: 72 }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        testID="composeStampBlank"
      >
        {/* R12's 1.4 dashed edge as the browser paints it there (2.1 on, 1.4 off, measured on the
            board); its 3 corner rounded to the scale's 8. */}
        <DashedOutline radius={8} strokeWidth={1.4} dash="2.1 1.4" color={theme.envelopeDash} />
      </View>
    );
  }
  return (
    <View testID="composeStamp" accessible accessibilityLabel={stampLabel(estimate)}>
      <PriceStamp paid={estimate.paid} approxCzk={estimate.approxCzk ?? 0} frame={FRAME} shadow="stampOnEnvelope" />
    </View>
  );
}

/**
 * The stamp's face: ZDARMA or PLACENÁ, the price, and the kind. On the envelope it is R2's 96×78 stuck
 * on (`stampOnEnvelope`); the paid-send question lays it on its own at 112×92 (`stamp`), as R2 does.
 * Decorative where it stands: the caller says what it costs.
 */
export function PriceStamp({
  paid,
  approxCzk,
  frame,
  shadow,
}: {
  readonly paid: boolean;
  readonly approxCzk: number;
  /** The printed frame, its 1 border included; the perforated margin lies outside it. */
  readonly frame: { readonly width: number; readonly height: number };
  readonly shadow: 'stamp' | 'stampOnEnvelope';
}) {
  const theme = useTheme();
  return (
    <Stamp kind="stamp" shadow={shadow}>
      {/* Inside the frame's 1 border. A word wider than the face widens the stamp rather than
          being cut. */}
      <YStack
        minWidth={frame.width - 2}
        minHeight={frame.height - 2}
        paddingVertical={8}
        paddingHorizontal={8}
        justifyContent="space-between"
      >
        <Tag color={theme.stampLabel}>
          {(paid ? t('send.cost.paid.badge') : t('send.cost.free')).toLocaleUpperCase('cs')}
        </Tag>
        <Title color={theme.stampInk} numberOfLines={1} adjustsFontSizeToFit testID="composeStampPrice">
          {paid ? t('send.sent.stamp.paid', { czk: approxCzk }) : t('send.sent.stamp.free')}
        </Title>
        <Tag fontWeight="400" color={theme.stampLabel}>
          {paid ? t('send.stamp.paid.kind') : t('send.stamp.free.kind')}
        </Tag>
      </YStack>
    </Stamp>
  );
}

function stampLabel(estimate: CostEstimate): string {
  return estimate.paid
    ? `${t('send.cost.paid', { czk: estimate.approxCzk ?? 0 })}. ${t('send.cost.paid.note')}`
    : `${t('send.cost.free')}. ${t('send.cost.free.note')}`;
}

const boxName = (a: DataBoxAccount) => a.alias ?? a.label;

/** Od: the box's name over its kind and ID, and its credit once known. With another box, it is the button. */
function SenderOnEnvelope({
  account,
  credit,
  onChange,
}: {
  readonly account: DataBoxAccount;
  readonly credit?: CreditState;
  readonly onChange?: () => void;
}) {
  const theme = useTheme();
  const kind = [boxTypeLabel(account.dbType), `ID ${account.boxId}`].filter(Boolean).join(' · ');
  const known = credit && credit.kind !== 'unknown' ? credit : null;
  return (
    <YStack
      alignSelf="flex-start"
      maxWidth={220}
      gap={2}
      onPress={onChange}
      pressStyle={onChange ? { opacity: 0.7 } : undefined}
      accessibilityRole={onChange ? 'button' : undefined}
      accessibilityLabel={[
        `${t('send.from')} ${boxName(account)}`,
        known ? t('send.from.credit', { amount: known.balance }) : null,
        known?.kind === 'short' ? t('send.credit.shortNote') : null,
      ]
        .filter(Boolean)
        .join(', ')}
      accessibilityHint={onChange ? t('send.from.change') : undefined}
      testID="composeSender"
    >
      <Overline color={theme.envelopeInkSoft}>{t('send.from')}</Overline>
      <XStack alignItems="center" gap={6}>
        <Subheading color={theme.onSolid} flexShrink={1}>
          {boxName(account)}
        </Subheading>
        {onChange ? (
          <YStack testID="composeSenderChevron">
            <ChevronDownIcon size={16} color={theme.onSolid} />
          </YStack>
        ) : null}
      </XStack>
      <Caption fontWeight="400" color={theme.envelopeInkSoft}>
        {kind}
      </Caption>
      {known ? (
        <Caption fontWeight="400" color={theme.envelopeInkSoft} testID="composeSenderCredit">
          {t('send.from.creditLine', { amount: known.balance })}
        </Caption>
      ) : null}
    </YStack>
  );
}

/** No sender yet: Od over a dashed slot to choose the box in (R12). */
function SenderSlot({ onPress }: { readonly onPress?: () => void }) {
  const theme = useTheme();
  return (
    <YStack alignSelf="flex-start" maxWidth={230} gap={2}>
      <Overline color={theme.envelopeInkSoft}>{t('send.from')}</Overline>
      <XStack
        position="relative"
        marginTop={4}
        paddingVertical={10}
        paddingHorizontal={12}
        borderRadius={12}
        onPress={onPress}
        pressStyle={{ opacity: 0.7 }}
        accessibilityRole="button"
        accessibilityLabel={t('send.from.pick')}
        testID="composePickSender"
      >
        {/* R12's 1.5 dashed edge as the browser paints it on the envelope: 1.5 on, 1 off per width. */}
        <DashedOutline radius={12} dash="2.25 1.5" color={theme.envelopeDash} />
        <Subheading color={theme.onSolid}>{t('send.from.pick')}</Subheading>
      </XStack>
    </YStack>
  );
}

/** The window's place on the envelope: across it, clear of the stamp's column. */
function WindowFrame({ children, ring = false }: { readonly children: ReactNode; readonly ring?: boolean }) {
  const theme = useTheme();
  return (
    <View style={{ alignSelf: 'stretch', marginRight: WINDOW_RIGHT }}>
      {/* R12's gold focus ring, 2 outside the window, while the search field has the caret. */}
      {ring ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            bottom: -2,
            left: -2,
            borderRadius: envelopeShape.windowRadius + 2,
            borderWidth: 2,
            borderColor: theme.flap,
          }}
          testID="composeWindowRing"
        />
      ) : null}
      {children}
    </View>
  );
}

/** The picked recipient in the window; pressing it opens the search again (R2). */
export function RecipientWindow({
  recipient,
  onChange,
}: {
  readonly recipient: Recipient;
  readonly onChange: () => void;
}) {
  const theme = useTheme();
  const kind = `${t(`send.dbType.${recipient.dbType}`)} · ID ${recipient.boxId}`;
  return (
    <WindowFrame>
      <XStack
        onPress={onChange}
        pressStyle={{ opacity: 0.8 }}
        accessibilityRole="button"
        accessibilityLabel={[recipient.name, recipient.address, kind].filter(Boolean).join(', ')}
        accessibilityHint={t('send.recipient.change')}
        testID="composeChangeRecipient"
      >
        <Window
          style={{
            flex: 1,
            minHeight: 62,
            paddingTop: 8,
            paddingBottom: 10,
            paddingLeft: 12,
            paddingRight: 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <YStack flex={1} minWidth={0} gap={2}>
            <Overline color={theme.textMuted}>{t('detail.to')}</Overline>
            {/* Never cut: the last moment a wrong recipient can be caught (015 FR-005). The address
                tells namesakes apart; with none, the kind and the box ID (R2, R12). */}
            <Subheading testID="composeRecipientName">{recipient.name}</Subheading>
            <Caption fontWeight="400" color={theme.textMuted} testID="composeRecipientLine">
              {recipient.address ?? kind}
            </Caption>
          </YStack>
          <ChevronRightIcon size={18} color={theme.textMuted} />
        </Window>
      </XStack>
    </WindowFrame>
  );
}

/** The window as the search field: Komu, the search glyph, and what is typed (R12, picked 2026-11-12). */
export function SearchWindow({
  value,
  onChangeText,
  onSubmit,
  autoFocus = false,
}: {
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly onSubmit: () => void;
  readonly autoFocus?: boolean;
}) {
  const theme = useTheme();
  const field = useRef<TextInput>(null);
  const [focused, setFocused] = useState(autoFocus);
  // What is typed is set as the name it will become (the window's 15/700); the hint stays the body's.
  const face = value === '' ? typeScale.body : typeScale.subheading;
  // At least a line at the reader's text size, and free to grow: a height in dp does not scale with the
  // text, and at the largest text it cut the field in half, then Android wrapped the hint (031 I135).
  const line = face.lineHeight * useWindowDimensions().fontScale;
  return (
    <WindowFrame ring={focused}>
      <YStack onPress={() => field.current?.focus()}>
        <Window style={{ minHeight: 62, paddingTop: 8, paddingBottom: 10, paddingHorizontal: 12, gap: 2 }}>
          <Overline color={theme.textMuted}>{t('detail.to')}</Overline>
          <XStack alignItems="center" gap={8}>
            <OffsetIcon name="search" size={18} color={theme.textMuted} />
            <Input
              ref={field}
              flex={1}
              // `auto`, not none: Tamagui's Input brings a 44 of its own.
              height="auto"
              minHeight={line}
              paddingVertical={0}
              paddingHorizontal={0}
              backgroundColor="transparent"
              borderWidth={0}
              fontFamily={value === '' ? fonts.bodyRegular : face.fontFamily}
              fontSize={face.fontSize}
              lineHeight={face.lineHeight}
              color={theme.text}
              placeholderTextColor={theme.textFaint}
              cursorColor={theme.blue}
              selectionColor={theme.blue}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus={autoFocus}
              value={value}
              onChangeText={onChangeText}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={t('send.recipient.search.short')}
              returnKeyType="search"
              onSubmitEditing={onSubmit}
              accessibilityLabel={t('send.recipient.search')}
              testID="composeRecipientQuery"
            />
          </XStack>
        </Window>
      </YStack>
    </WindowFrame>
  );
}

/** No sender yet: the window dimmed, two dotted lines where the recipient will be written (R12). */
export function WaitingWindow() {
  const theme = useTheme();
  return (
    <WindowFrame>
      <View
        style={{ opacity: 0.55 }}
        // One picture: Android would fade the blank lines apart from the window under them (031 I38).
        needsOffscreenAlphaCompositing
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Window style={{ minHeight: 62, paddingTop: 8, paddingBottom: 10, paddingHorizontal: 12, gap: 2 }}>
          <Overline color={theme.textMuted}>{t('detail.to')}</Overline>
          <WindowBlankLine width="80%" />
          <WindowBlankLine width="52%" />
        </Window>
      </View>
    </WindowFrame>
  );
}
