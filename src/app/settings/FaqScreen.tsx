// Časté dotazy - the app's help, ported from the design (012 §2).
//
// An accordion of cards: each question is a button with a +/− chip; tapping expands its answer below.
// That is user-initiated, so moving content beneath it is legitimate - Principle V's no-layout-jumps
// rule is about TRANSIENT/async elements appearing. Nothing above a tapped row may move, which is why
// the chip is a fixed 22×22 box and the question keeps its own line height whether open or closed.
//
// Everything renders from `src/content/faq.ts` and never touches the network.

import { useCallback, useRef, useState } from 'react';
import { XStack, YStack } from '../../theme/ui';
import { Badge, Body, BodyStrong, Caption } from '../../theme/Typography';
import { useTheme } from '../../theme/ThemeProvider';
import { InfoIcon } from '../../theme/icons';
import { chipTone } from '../../theme/chipTone';
import { DeliveryStateIcon } from '../../features/messages/screens/DeliveryStateIcon';
import type { MessageStateKind } from '../../features/messages/state/messageState';
import { t } from '../../i18n/strings';
import { useLocale } from './SettingsProvider';
import { SubScreen } from './SubScreen';
import { DebugRecordingFrame } from '../DebugRecordingStrip';
import {
  FAQ,
  FAQ_DISCLAIMER,
  FAQ_ORDER,
  FAQ_LEGEND_ID,
  type FaqGroup,
  type FaqId,
} from '../../content/faq';

/**
 * The delivery-state legend, appended to the `deliveredVsServed` answer. It is the one answer whose
 * subject the user can also SEE in the app, so showing the actual marks beats describing them - and
 * it is drawn from the same `DeliveryStateIcon` the sent list uses, so the legend cannot go stale
 * relative to what the rows render.
 */
const LEGEND: { kind: MessageStateKind; tone: Parameters<typeof chipTone>[0]; labelKey: string }[] = [
  { kind: 'sent', tone: 'statusSent', labelKey: 'messages.status.sent' },
  { kind: 'delivered', tone: 'statusDelivered', labelKey: 'detail.delivered' },
  { kind: 'accepted', tone: 'statusRead', labelKey: 'faq.legend.bySignIn' },
  { kind: 'fiction', tone: 'statusFiction', labelKey: 'status.byFiction' },
  { kind: 'stop', tone: 'statusStop', labelKey: 'faq.legend.stop' },
];

function DeliveryLegend() {
  const theme = useTheme();
  return (
    <YStack
      backgroundColor={theme.surfaceSunken}
      borderRadius={12}
      paddingVertical={12}
      paddingHorizontal={14}
      gap={11}
    >
      {LEGEND.map(({ kind, tone, labelKey }) => {
        const colors = chipTone(tone, theme);
        return (
          <XStack key={kind} alignItems="center" gap={10}>
            <DeliveryStateIcon
              kind={kind}
              color={kind === 'stop' ? colors.bg : colors.fg}
              knockout={theme.surfaceSunken}
            />
            <Body fontSize={13} fontWeight="600" color={theme.bodyText}>
              {t(labelKey)}
            </Body>
          </XStack>
        );
      })}
    </YStack>
  );
}

interface FaqScreenProps {
  readonly onBack: () => void;
  /**
   * Open the screen with one answer already expanded and scrolled to.
   *
   * Settings links here for the detail its own rows must not carry - how the attachment scan works.
   * A link that lands the reader at the top of a fourteen-question accordion has answered nothing,
   * so the answer opens itself and the screen scrolls to it.
   */
  readonly focus?: FaqId;
}

export function FaqScreen(props: FaqScreenProps) {
  // Help is opened from the sign-in flow too, where the shell draws it over that flow and over its
  // Debug-mode strip (023 FR-007), so it carries the strip itself. As a navigator route it is already
  // framed, and this frame then adds nothing.
  return (
    <DebugRecordingFrame>
      <FaqContent {...props} />
    </DebugRecordingFrame>
  );
}

function FaqContent({ onBack, focus }: FaqScreenProps) {
  const theme = useTheme();
  const locale = useLocale();
  const [open, setOpen] = useState<Partial<Record<FaqId, boolean>>>(
    focus ? { [focus]: true } : {},
  );
  const entries = FAQ[locale];
  const scrollRef = useRef<{
    scrollTo(o: { y: number; animated?: boolean }): void;
  } | null>(null);
  const focusY = useRef<number | null>(null);
  const scrolled = useRef(false);
  // Scroll once the focused card has been laid out - its y is not known before that, and scrolling
  // to a guess would land somewhere else at a different font scale.
  const scrollToFocus = useCallback(() => {
    if (focus == null || scrolled.current || focusY.current == null) {
      return;
    }
    scrolled.current = true;
    scrollRef.current?.scrollTo({
      y: Math.max(0, focusY.current - 12),
      animated: false,
    });
  }, [focus]);

  const renderGroup = (group: FaqGroup) => (
    <YStack gap={10}>
      {FAQ_ORDER[group].map(id => {
        const entry = entries[id];
        const isOpen = open[id] === true;
        return (
          <YStack
            key={id}
            backgroundColor={theme.surface}
            borderWidth={1}
            borderColor={theme.border}
            borderRadius={14}
            overflow="hidden"
            onLayout={
              id === focus
                ? (e: { nativeEvent: { layout: { y: number } } }) => {
                    focusY.current = e.nativeEvent.layout.y;
                    scrollToFocus();
                  }
                : undefined
            }
          >
            <XStack
              padding={14}
              gap={12}
              alignItems="flex-start"
              onPress={() => setOpen(prev => ({ ...prev, [id]: !isOpen }))}
              pressStyle={{ backgroundColor: theme.surfaceAlt }}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              testID={`faq-${id}`}
            >
              <BodyStrong flex={1} fontSize={15} lineHeight={20} color={theme.text}>
                {entry.question}
              </BodyStrong>
              {/* Fixed box: the +/− swap must not change the row's height (Principle V). */}
              <XStack
                width={22}
                minHeight={22}
                flexShrink={0}
                borderRadius={7}
                backgroundColor={theme.surfaceSunken}
                alignItems="center"
                justifyContent="center"
              >
                <Badge fontSize={16} lineHeight={16} color={theme.textMuted}>
                  {isOpen ? '−' : '+'}
                </Badge>
              </XStack>
            </XStack>
            {isOpen ? (
              <YStack paddingHorizontal={14} paddingBottom={15} gap={10}>
                {entry.answer.map((paragraph, i) => (
                  <Body
                    key={i}
                    fontSize={14}
                    lineHeight={20}
                    color={theme.bodyText}
                  >
                    {paragraph}
                  </Body>
                ))}
                {id === FAQ_LEGEND_ID ? <DeliveryLegend /> : null}
              </YStack>
            ) : null}
          </YStack>
        );
      })}
    </YStack>
  );

  return (
    <SubScreen title={t('faq.title')} onBack={onBack} scrollRef={scrollRef}>
        <GroupLabel>{t('faq.group.app')}</GroupLabel>
        {renderGroup('app')}

        <GroupLabel marginTop={24}>{t('faq.group.isds')}</GroupLabel>
        {/* Scoped to this group deliberately (design): the ISDS answers are the ones making statements
            about how delivery law works, and a notice at the top of the screen would read as a warning
            about the app instead. */}
        <XStack
          gap={9}
          paddingHorizontal={4}
          marginBottom={12}
          alignItems="flex-start"
        >
          <YStack marginTop={1}>
            <InfoIcon size={16} color={theme.textFaint} />
          </YStack>
          <Caption flex={1} fontSize={12} lineHeight={17} color={theme.textFaint}>
            {FAQ_DISCLAIMER[locale]}
          </Caption>
        </XStack>
      {renderGroup('isds')}
    </SubScreen>
  );
}

function GroupLabel({
  children,
  marginTop,
}: {
  readonly children: string;
  readonly marginTop?: number;
}) {
  const theme = useTheme();
  return (
    <Badge
      accessibilityRole="header"
      fontSize={12}
      textTransform="uppercase"
      letterSpacing={0.4}
      color={theme.textFaint}
      marginLeft={4}
      marginBottom={10}
      marginTop={marginTop}
    >
      {children}
    </Badge>
  );
}
