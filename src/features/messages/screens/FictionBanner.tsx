// The fiction band (031, board Message): a gold band across the top of a received message the law
// signed for - "Doručeno fikcí 29.08. · bez vašeho přihlášení" - and the one thing still worth doing
// about it, a reminder of the deadline it started.

import { XStack } from '../../../theme/ui';
import { Badge } from '../../../theme/Typography';
import { useTheme } from '../../../theme/ThemeProvider';
import { chipTone } from '../../../theme/chipTone';
import { OffsetIcon } from '../../../theme/offsetIcons';
import { t } from '../../../i18n/strings';
import { dayMonth } from './DetailEnvelope';

/**
 * "Doručeno fikcí 29.08. · bez vašeho přihlášení". The day the deadline started on, not the day the
 * app was next opened, which is why the date is spelled out. The board gives the day; the minute is
 * in the record below. A year that is not this one is said, or last August's fiction would read as
 * this August's.
 */
export function fikceBannerLabel(servedAt: number, now: number = Date.now()): string {
  const year = new Date(servedAt).getFullYear();
  const day = year === new Date(now).getFullYear() ? dayMonth(servedAt) : `${dayMonth(servedAt)}${year}`;
  return `${t('status.byFiction')} ${day} · ${t('status.byFiction.withoutYou')}`;
}

export function FictionBanner({
  servedAt,
  onRemind,
}: {
  readonly servedAt: number;
  /** Opens the reminder's date picker. */
  readonly onRemind: () => void;
}) {
  const tone = chipTone('statusFiction', useTheme());
  return (
    <XStack
      backgroundColor={tone.bg}
      minHeight={44}
      paddingLeft={16}
      paddingRight={6}
      alignItems="center"
      gap={10}
      testID="fikceBanner"
    >
      <OffsetIcon name="fiction" size={18} color={tone.fg} plane="gold" />
      <Badge color={tone.fg} flex={1} paddingVertical={6}>
        {fikceBannerLabel(servedAt)}
      </Badge>
      <XStack
        minHeight={44}
        paddingHorizontal={10}
        alignItems="center"
        pressStyle={{ opacity: 0.5 }}
        onPress={onRemind}
        accessibilityRole="button"
        accessibilityLabel={t('detail.fikce.remind')}
        testID="fikceRemind"
      >
        <Badge color={tone.fg} textDecorationLine="underline">
          {t('detail.fikce.remind')}
        </Badge>
      </XStack>
    </XStack>
  );
}
