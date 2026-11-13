// The inbox's rows (031, board "Inbox - the envelope front"): the attention block's sheets and the
// register of everything else. A sheet is a letter that still wants you - its sender's envelope sealed
// with the gold flap while unread; the register lists the rest by day, the day printed once beside its
// first row.

import { memo, useCallback, useRef } from 'react';
import { View } from 'react-native';
import { XStack, YStack } from '../../../theme/ui';
import { Body, Caption, Day, Heading, Meta, Numeral, Small, Subheading, Title } from '../../../theme/Typography';
import { useTheme } from '../../../theme/ThemeProvider';
import { HelpIcon } from '../../../theme/icons';
import { OffsetIcon } from '../../../theme/offsetIcons';
import { EnvelopeTile } from '../../../theme/objects/Envelope';
import { objectShadow } from '../../../theme/depth';
import { avatarColor } from '../../../theme/avatarPalette';
import { Skeleton } from '../../../theme/Skeleton';
import { chipTone } from '../../../theme/chipTone';
import { touchSlop } from '../../../theme/touchTarget';
import { t, getActiveLocale, plural } from '../../../i18n/strings';
import type { FaqId } from '../../../content/faq';
import type { DataBoxAccount, MessageEnvelope } from '../../../services/isds/types';
import type { MessageFolder } from '../../../services/db/messagesStore';
import type { AttentionEntry } from '../state/attention';
import { attentionDaysRemaining } from '../state/attention';
import { servedByFiction } from '../state/fikce';
import { isUnread } from '../state/messagesController';
import { freshnessLabel, rowDate, type DateSectionLabel } from '../state/groupByDate';
import { attentionRowLabel, receivedRowLabel, termChipLabel } from '../state/rowLabel';
import { formatTermDate } from './TermPicker';
import { BoxPill, boxName } from './BoxPill';
import { openFromTile, type TileRect } from './EnvelopeFlight';

/** Localized date-section header (a fixed bucket, or "Month Year" for older groups). */
export function sectionTitle(label: DateSectionLabel): string {
  switch (label.kind) {
    case 'today':
      return t('messages.section.today');
    case 'yesterday':
      return t('messages.section.yesterday');
    case 'thisWeek':
      return t('messages.section.thisWeek');
    case 'thisMonth':
      return t('messages.section.thisMonth');
    case 'month':
      return `${t(`messages.month.${label.month}`)} ${label.year}`;
  }
}

/**
 * A section of the register: the month in Bricolage with its year a step quieter beside it (InboxA),
 * or one of the near buckets on its own. A screen reader can jump between them (001 T042).
 */
export function SectionHead({ label }: { readonly label: DateSectionLabel }) {
  const theme = useTheme();
  return (
    <XStack alignItems="baseline" gap={8} paddingHorizontal={16} paddingTop={12} paddingBottom={6}>
      <Title accessibilityRole="header" accessibilityLabel={sectionTitle(label)}>
        {label.kind === 'month' ? t(`messages.month.${label.month}`) : sectionTitle(label)}
      </Title>
      {label.kind === 'month' ? (
        <Subheading fontWeight="600" color={theme.textFaint} accessibilityElementsHidden>
          {String(label.year)}
        </Subheading>
      ) : null}
    </XStack>
  );
}

/**
 * The attention block's head: the count in the oversized gold numeral, "Vyžaduje pozornost", and what
 * the count is made of. The app's loudest moment, because the number counts things with legal
 * consequences and is stated nowhere else (DESIGN.md › the attention block).
 */
export function AttentionHead({ count, summary }: { readonly count: number; readonly summary: string }) {
  const theme = useTheme();
  return (
    <XStack paddingHorizontal={16} paddingTop={16} paddingBottom={12} alignItems="center" gap={12}>
      {/* `goldInk`: the count is stated nowhere else, and plain gold is 2.17:1 on the paper. The role
          draws the 44 on a 36 line and keeps its ink whole on iOS (Typography.tsx). */}
      <Numeral color={theme.goldInk}>{String(count)}</Numeral>
      <YStack flex={1} minWidth={0} gap={2}>
        <Title accessibilityRole="header">{t('messages.attention')}</Title>
        <Caption fontWeight="400" color={theme.textMuted} numberOfLines={2}>
          {summary}
        </Caption>
      </YStack>
    </XStack>
  );
}

/**
 * The user's own reminder on a row (010 US2): the reminder glyph and its date in the blue only the
 * user's own marks take; past due, in the danger ink. The row's spoken label says it in words.
 */
function ReminderMark({ date, now }: { readonly date: number; readonly now: number }) {
  const theme = useTheme();
  const ink = attentionDaysRemaining(date, now) < 0 ? theme.danger : theme.blue;
  return (
    <XStack alignItems="center" gap={4} flexShrink={0}>
      <OffsetIcon name="remind" size={14} color={ink} />
      <Meta fontWeight="600" color={ink}>
        {formatTermDate(date)}
      </Meta>
    </XStack>
  );
}

/**
 * A message in the attention block (I17): a sheet on the paper, its sender's envelope sealed with the
 * gold flap while unread. The fiction chip is read from the MESSAGE, not from why it qualified: a
 * message can be served by fiction and carry a deadline, and hiding the legal clock because the
 * deadline ranked higher would be a half-truth (Principle VI). A message served by fiction also shows
 * the second envelope's edge under its sheet - every board draws it there, and only there.
 */
export const AttentionSheet = memo(function AttentionSheetView({
  message,
  entry,
  now,
  onOpen,
  folder,
  onExplain,
  boxAccount,
}: {
  readonly message: MessageEnvelope;
  /** Why this row qualified. Null is treated as "say nothing", never as fiction. */
  readonly entry: AttentionEntry | null;
  readonly now: number;
  /** `from`: where the sender's tile was, so it can grow into the message's envelope. */
  readonly onOpen: (messageId: string, folder: MessageFolder, from?: TileRect) => void;
  readonly folder: MessageFolder;
  /** Opens the FAQ answer for a term this row uses. */
  readonly onExplain: (focus: FaqId) => void;
  /** Set only in the merged view, where a row has to say which box it belongs to. */
  readonly boxAccount?: DataBoxAccount;
}) {
  const tile = useRef<View>(null);
  const tileColor = avatarColor(message.sender || '—');
  const onPress = useCallback(
    () => openFromTile(tile.current, { color: tileColor, radius: 11 }, from => onOpen(message.id, folder, from)),
    [onOpen, message.id, folder, tileColor],
  );
  const theme = useTheme();
  const tone = chipTone('statusFiction', theme);
  const servedAt = servedByFiction(message);
  const termDate =
    entry != null && (entry.reason === 'reminder' || entry.reason === 'estimate') ? entry.date : null;
  const sender = message.sender || '—';
  const subject = message.subject || t('messages.noSubject');
  const unread = isUnread(message.state);
  // The pill's two halves, kept as parts so the spoken label cannot say less than the pill shows.
  const fictionParts =
    servedAt != null ? [`${t('status.byFiction')} ${rowDate(servedAt, now)}`, t('status.fikce.running')] : null;
  return (
    <YStack paddingHorizontal={16} paddingBottom={10}>
      <XStack
        zIndex={1}
        backgroundColor={theme.surface}
        borderRadius={14}
        padding={12}
        gap={12}
        alignItems="flex-start"
        style={{ boxShadow: objectShadow(theme.name, 'sheet') }}
        pressStyle={{ backgroundColor: theme.surfaceAlt }}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={attentionRowLabel({
          sender,
          subject,
          date: rowDate(message.deliveryTime, now),
          unread,
          fiction: fictionParts,
          term: termDate != null ? termChipLabel(termDate, now) : null,
          box: boxName(boxAccount),
        })}
        testID={`message-${message.id}`}
      >
        <View ref={tile} collapsable={false}>
          <EnvelopeTile name={sender} color={tileColor} sealed={unread} />
        </View>
        <YStack flex={1} minWidth={0} gap={2}>
          <XStack justifyContent="space-between" gap={10}>
            <Heading flexShrink={1} numberOfLines={2}>
              {subject}
            </Heading>
            <Meta flexShrink={0} color={theme.textMuted} paddingTop={2}>
              {rowDate(message.deliveryTime, now)}
            </Meta>
          </XStack>
          {/* The box's monogram follows the sender's name, as on the register's rows (031 R5). */}
          <XStack alignItems="center" gap={6}>
            <Small color={theme.textMuted} numberOfLines={1} flexShrink={1}>
              {sender}
            </Small>
            {boxAccount ? <BoxPill account={boxAccount} compact /> : null}
          </XStack>
          {/* Both marks can be present. They WRAP rather than truncate - a legal status cut short to
              fit beside a deadline would be the same half-truth as not showing it. */}
          {servedAt != null || termDate != null ? (
            <XStack marginTop={4} flexWrap="wrap" alignItems="center" gap={6}>
              {servedAt != null ? (
                // Tappable: "fikce" and "lhůta" are terms the app's audience has no reason to know,
                // and the answer is in `content/faq.ts`. Its own target, so it does not steal the row's.
                <XStack
                  alignItems="center"
                  gap={6}
                  backgroundColor={tone.bg}
                  borderRadius={8}
                  paddingVertical={4}
                  paddingHorizontal={10}
                  flexShrink={1}
                  maxWidth="100%"
                  hitSlop={touchSlop({ height: 24 })}
                  pressStyle={{ opacity: 0.65 }}
                  onPress={() => onExplain('fiction')}
                  accessibilityRole="button"
                  accessibilityLabel={`${fictionParts?.join(' · ')}, ${t('faq.explain')}`}
                  testID="explainFiction"
                >
                  <OffsetIcon name="fiction" size={16} color={tone.fg} plane="gold" />
                  <Meta fontWeight="700" flexShrink={1} color={tone.fg}>
                    {fictionParts?.join(' · ')}
                  </Meta>
                  <HelpIcon size={13} color={tone.fg} />
                </XStack>
              ) : null}
              {termDate != null ? <ReminderMark date={termDate} now={now} /> : null}
            </XStack>
          ) : null}
        </YStack>
      </XStack>
      {servedAt != null ? (
        <View
          testID="sheetEdge"
          style={{
            zIndex: 0,
            marginTop: -8,
            marginHorizontal: 10,
            height: 14,
            borderBottomLeftRadius: 12,
            borderBottomRightRadius: 12,
            backgroundColor: theme.sheetEdge,
            boxShadow: objectShadow(theme.name, 'sheetEdge'),
          }}
        />
      ) : null}
    </YStack>
  );
});

/** The hours Czech says with "ve": dvě, tři, čtyři, dvanáct, třináct, čtrnáct, dvacet and on. */
const VE_HOURS = new Set([2, 3, 4, 12, 13, 14, 20, 21, 22, 23]);

/** Whether Czech puts "ve" rather than "v" before this hour ("ve 14:02", "v 9:05"). */
export function takesVe(hour: number): boolean {
  return VE_HOURS.has(hour);
}

/**
 * When the app last looked at the box (board Empty, I26): "Naposledy dnes ve 14:02", or "před 5
 * minutami", or a date. The empty inbox says it under its envelope, and a list says it at its end.
 */
export function freshnessText(syncedAt: number | null, now: number): string {
  const label = freshnessLabel(syncedAt, now);
  if (label == null) {
    return t('messages.synced.never');
  }
  if (label === 'now') {
    return t('messages.synced.now');
  }
  if (label.startsWith('min:')) {
    const n = Number(label.slice(4));
    return t(`messages.synced.min.${plural(n)}`, { n });
  }
  if (label.startsWith('at:')) {
    const d = label.slice(3);
    return t(VE_HOURS.has(Number(d.split(':')[0])) ? 'messages.synced.at.ve' : 'messages.synced.at', { d });
  }
  return t('messages.synced.on', { d: label.slice(3) });
}

const weekdays = new Map<string, Intl.DateTimeFormat>();

/** The day's short name ("ne", "Sun") in the app's language, from the platform's calendar data. */
export function weekdayShort(epochMs: number): string {
  const locale = getActiveLocale() === 'cs' ? 'cs-CZ' : 'en-GB';
  let format = weekdays.get(locale);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    weekdays.set(locale, format);
  }
  return format.format(new Date(epochMs));
}

/**
 * A received message in the register (I18): the day of the month and its weekday beside the first row
 * of each day, the subject, then the sender's small tile and name, a clip when it has attachments
 * (ISDS gives their total size, never a count, until the message is downloaded) and the user's own
 * reminder.
 */
export const RegisterRow = memo(function RegisterRowView({
  message,
  now,
  termDate,
  showDay,
  onOpen,
  folder,
  boxAccount,
}: {
  readonly message: MessageEnvelope;
  readonly now: number;
  /** The user's reminder date on this message, or null. */
  readonly termDate: number | null;
  /** The first row of its day prints the day; the rest of that day leave the column blank. */
  readonly showDay: boolean;
  readonly onOpen: (messageId: string, folder: MessageFolder, from?: TileRect) => void;
  readonly folder: MessageFolder;
  /** Set ONLY in the merged view, where a row has to say which box it belongs to. */
  readonly boxAccount?: DataBoxAccount;
}) {
  const tile = useRef<View>(null);
  const tileColor = avatarColor(message.sender || '—');
  const onPress = useCallback(
    () => openFromTile(tile.current, { color: tileColor, radius: 7 }, from => onOpen(message.id, folder, from)),
    [onOpen, message.id, folder, tileColor],
  );
  const theme = useTheme();
  const sender = message.sender || '—';
  const subject = message.subject || t('messages.noSubject');
  const delivered = message.deliveryTime;
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
      accessibilityLabel={receivedRowLabel({
        sender,
        subject,
        date: rowDate(delivered, now),
        unread: isUnread(message.state),
        term: termDate != null ? termChipLabel(termDate, now) : null,
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
          <View ref={tile} collapsable={false}>
            <EnvelopeTile name={sender} color={tileColor} size={24} />
          </View>
          <Small color={theme.textMuted} numberOfLines={1} flexShrink={1}>
            {sender}
          </Small>
          {message.attachmentSize != null && message.attachmentSize > 0 ? (
            <OffsetIcon name="attach" size={15} color={theme.textMuted} />
          ) : null}
          {termDate != null ? <ReminderMark date={termDate} now={now} /> : null}
          {boxAccount ? (
            <YStack marginLeft="auto" flexShrink={0}>
              <BoxPill account={boxAccount} compact />
            </YStack>
          ) : null}
        </XStack>
      </YStack>
    </XStack>
  );
});

/** The register's rows to come (031 I20, board R5 "Loading"): each widths pair is one row's two lines. */
const SKELETON_ROWS = [
  ['82%', '60%'],
  ['70%', '52%'],
  ['88%', '64%'],
  ['64%', '48%'],
  ['76%', '58%'],
] as const;

/** The shape of the register while it loads: the day, the subject, the sender's line. */
export function RegisterSkeleton() {
  const theme = useTheme();
  return (
    <YStack paddingTop={10}>
      {SKELETON_ROWS.map(([subject, sender]) => (
        <XStack key={subject} paddingHorizontal={16} paddingVertical={8} gap={14}>
          <YStack width={34} alignItems="center" gap={4}>
            <Skeleton width={28} height={26} radius={6} color={theme.borderStrong} />
            <Skeleton width={18} height={12} radius={6} color={theme.borderStrong} />
          </YStack>
          <YStack flex={1} minWidth={0} gap={6} paddingTop={2}>
            <Skeleton width={subject} height={16} radius={6} color={theme.borderStrong} />
            <Skeleton width={sender} height={14} radius={6} color={theme.borderStrong} />
          </YStack>
        </XStack>
      ))}
    </YStack>
  );
}
