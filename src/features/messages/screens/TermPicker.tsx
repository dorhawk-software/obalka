// The "Termín" picker (feature 010 US2): a bottom sheet for putting a date on a message.
//
// The sheet is `theme/BottomSheet` - the box switcher's scaffolding, which this picker used to copy
// line for line: warm scrim, surfaceAlt sheet, grab handle, swipe-down to dismiss, Android back closes
// it. No sheet metrics of its own (Principle V). It closes when the app backgrounds, too, so nothing is
// left sitting over the lock screen.
//
// Presets are relative to TODAY, not to the message. "Za týden" means a week from now, because the
// user is deciding when THEY want to look at this again.
//
// As board R9 draws it (031 I57, agreed 2026-11-12): the reminder's glyph in its well beside the title,
// the promise under them in small muted text, the presets one card of 50 rows (label, date, a check),
// the custom day another with its stepper, and Odebrat beside Uložit. Roundings: the stepper's 11
// corner is 12. The stepper is 36 at the least and grows with the reading size: `height="auto"`,
// since Tamagui's button sets its own 44 otherwise.

import { useCallback, useState } from 'react';
import { Label, Meta, Small, SmallStrong, Title } from '../../../theme/Typography';
import { Well } from '../../../theme/Well';
import { InkButton } from '../../../theme/InkButton';
import { NeutralButton } from '../../../theme/NeutralButton';
import { Button, XStack, YStack } from '../../../theme/ui';
import { useTheme } from '../../../theme/ThemeProvider';
import { BottomSheet } from '../../../theme/BottomSheet';
import { space } from '../../../theme/spacing';
import { touchSlop } from '../../../theme/touchTarget';
import { chipTone } from '../../../theme/chipTone';
import { CheckIcon } from '../../../theme/icons';
import { useCloseOnBackground } from '../../../app/useCloseOnBackground';
import { haptics } from '../../../services/haptics';
import { t } from '../../../i18n/strings';
import { reminderPromise } from '../state/reminders';
import { Card } from '../../../theme/Card';

/** R9's preset row: 50 tall at the least. */
const PRESET_ROW = 50;

/** Midnight local on the day `d` days from `from` - the shape a stored reminder date takes. */
function dayFromNow(from: number, days: number): number {
  const d = new Date(from);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).getTime();
}

/** Midnight local on the last day of `from`'s month. */
function endOfMonth(from: number): number {
  const d = new Date(from);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getTime();
}

interface Preset {
  key: string;
  labelKey: string;
  at: (now: number) => number;
}

const PRESETS: Preset[] = [
  { key: 'week', labelKey: 'term.preset.week', at: n => dayFromNow(n, 7) },
  { key: 'twoWeeks', labelKey: 'term.preset.twoWeeks', at: n => dayFromNow(n, 14) },
  { key: 'endOfMonth', labelKey: 'term.preset.endOfMonth', at: endOfMonth },
];

/**
 * "22. 8." - the compact Czech form the chips use.
 *
 * The separator is a NON-BREAKING space (U+00A0). With an ordinary one, "11. 9." is two breakable
 * tokens, and in the password-expiry strip at a large text size the day and the month wrapped onto
 * different lines with the action button between them. A date is one thing and must break as one.
 */
export function formatTermDate(epochMs: number): string {
  const d = new Date(epochMs);
  return `${d.getDate()}.\u00A0${d.getMonth() + 1}.`;
}

/** The day-stepper buttons' drawn width - declared so the touch slop is derived, not guessed. */
const STEPPER_W = 38;

const sameDay = (a: number, b: number) =>
  new Date(a).toDateString() === new Date(b).toDateString();

export function TermPicker({
  current,
  alertsOff = false,
  onPick,
  onRemove,
  onClose,
  now = Date.now(),
}: {
  /** The reminder already on this message, or null. Opens with it preselected. */
  readonly current: number | null;
  /**
   * Notifications are off and saving will not ask for them (2026-09-24): the date will get no alert
   * at all, so the sheet says where it will show instead of promising one.
   */
  readonly alertsOff?: boolean;
  readonly onPick: (date: number) => void;
  readonly onRemove: () => void;
  readonly onClose: () => void;
  readonly now?: number;
}) {
  const theme = useTheme();
  const blue = chipTone('userBlue', theme);
  const [custom, setCustom] = useState<number | null>(null);

  useCloseOnBackground(useCallback(() => onClose(), [onClose]));

  const selected = custom ?? current;
  const pick = (date: number) => {
    haptics.selection();
    onPick(date);
    onClose();
  };

  return (
    <BottomSheet onClose={onClose}>
      {/* R9 (031 I57): the reminder's glyph in its well beside the title, 16 under the grabber. */}
      <XStack alignItems="center" gap={space.lg} marginTop={space.inset}>
        <Well name="remind" />
        <Title flex={1} accessibilityRole="header">
          {t('term.title')}
        </Title>
      </XStack>
      <YStack>
        {/* Says whose date this is. The app does not compute legal deadlines, and the
            picker must not be read as if it did (Principle VI). */}
        <Small
          marginTop={space.base}
          color={theme.textMuted}
          testID="term-sub"
        >
          {/* What this date will ACTUALLY get. A deadline chosen for today after 09:00
              gets no notification at all, and the sheet used to promise two. With
              notifications off, no date gets one. */}
          {alertsOff
            ? t('term.sub.silent')
            : t(
                {
                  both: 'term.sub',
                  onDay: 'term.sub.onDay',
                  none: 'term.sub.none',
                }[reminderPromise(selected, now)],
              )}
        </Small>
      </YStack>

      <Card
        overflow="hidden"
        marginTop={space.xl}
      >
        {PRESETS.map((p, i) => {
          const date = p.at(now);
          const isSelected = selected != null && sameDay(selected, date);
          return (
            <YStack key={p.key}>
            {i > 0 ? <YStack height={1} marginLeft={space.xl} backgroundColor={theme.border} /> : null}
            <XStack
              alignItems="center"
              gap={space.lg}
              minHeight={PRESET_ROW}
              paddingHorizontal={space.xl}
              pressStyle={{ opacity: 0.7 }}
              onPress={() => pick(date)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${t(p.labelKey)}, ${formatTermDate(date)}`}
              testID={`term-${p.key}`}
            >
              <YStack flex={1}>
                <SmallStrong color={theme.text}>
                  {t(p.labelKey)}
                </SmallStrong>
              </YStack>
              <Label fontWeight="400" color={theme.textFaint}>
                {formatTermDate(date)}
              </Label>
              {/* Reserved so selecting does not shift the row (Principle V). */}
              <YStack width={18} alignItems="center">
                {isSelected ? (
                  <CheckIcon size={18} color={blue.fg} />
                ) : null}
              </YStack>
            </XStack>
            </YStack>
          );
        })}
      </Card>

      {/* Custom day-stepper. A full calendar is a native picker per platform; the design
          never specified one, so this ships the honest minimum - nudge a day at a time from
          the current selection - rather than inventing a calendar. */}
      <Card flexDirection="row"
        alignItems="center"
        gap={12}
        marginTop={12}
        paddingVertical={12}
        paddingHorizontal={14}
      >
        <YStack flex={1}>
          <SmallStrong color={theme.text}>
            {t('term.custom')}
          </SmallStrong>
          <Meta color={theme.textFaint}>
            {formatTermDate(selected ?? dayFromNow(now, 1))}
          </Meta>
        </YStack>
        <Button
          height="auto"
          minHeight={36}
          minWidth={STEPPER_W}
          paddingHorizontal={14}
          borderRadius={12}
          backgroundColor={theme.surfaceSunken}
          color={theme.text}
          // The bodyStrong size: 16 was off the scale (031 T050).
          fontSize={15}
          fontWeight="700"
          // A 36×38 nudge button is under the target on both axes. The row's gap is 12, so
          // 5 each side keeps the two buttons' areas from touching.
          hitSlop={touchSlop({ width: STEPPER_W, height: 36 })}
          onPress={() => {
            const base = selected ?? dayFromNow(now, 1);
            const next = dayFromNow(base, -1);
            if (next > now) {
              haptics.selection();
              setCustom(next);
            }
          }}
          accessibilityLabel={t('term.custom.earlier')}
          testID="term-earlier"
        >
          −
        </Button>
        <Button
          height="auto"
          minHeight={36}
          minWidth={STEPPER_W}
          paddingHorizontal={14}
          borderRadius={12}
          backgroundColor={theme.surfaceSunken}
          color={theme.text}
          fontSize={15}
          fontWeight="700"
          hitSlop={touchSlop({ width: STEPPER_W, height: 36 })}
          onPress={() => {
            haptics.selection();
            setCustom(dayFromNow(selected ?? dayFromNow(now, 1), 1));
          }}
          accessibilityLabel={t('term.custom.later')}
          testID="term-later"
        >
          +
        </Button>
      </Card>

      {/* R9: Odebrat and Uložit as two halves, 18 under the custom day; Odebrat in the danger ink. */}
      <XStack gap={space.base} marginTop={space.gutter}>
        {current != null ? (
          <YStack flex={1}>
            <NeutralButton
              danger
              label={t('term.remove')}
              onPress={() => {
                haptics.selection();
                onRemove();
                onClose();
              }}
              testID="term-remove"
            />
          </YStack>
        ) : null}
        <YStack flex={1}>
          <InkButton label={t('term.save')} onPress={() => pick(selected ?? dayFromNow(now, 1))} testID="term-save" />
        </YStack>
      </XStack>
    </BottomSheet>
  );
}
