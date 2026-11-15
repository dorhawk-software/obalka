// The on-device deadline suggestion (010 US3, cycle 2) - the one thing the scan is allowed to do.
//
// This card exists to be REFUSABLE. A scan reads legal mail with a regular expression; it will
// sometimes read the date of a hearing, an invoice's issue date, or the day a decision was signed,
// and offer it as a deadline. So the card:
//
//   * never commits anything - accepting is a tap, and what it creates is an ordinary US2 reminder;
//   * shows the PHRASE it read the date from, and the file it came from, because the user is the only
//     one who can tell whether "do 8. 7. 2026" was a deadline or a delivery window;
//   * says plainly that it is an estimate made on this phone, not a fact from ISDS. Everything else
//     on this screen is something the state asserted; this is the only line the APP made up, and
//     dressing it in the same confident type would be the 013 lock-screen mistake again (Principle VI).
//
// It occupies a fixed minimum height across both its states, so the card that says "hledám" and the
// card that says "termín 8. 7." are the same size and nothing below them moves (Principle V).
//
// No board draws it (031 I34), so it is R14's strip, the agreed tone card with answers: the estimate's
// sunken tone with no outline, its glyph at 20, the words, and the answers as links under them. Taking
// it is the user's own reminder, so that link is in the reminder's blue. While the scan runs, the one
// waiting bar (R8), not the platform's spinner (I76).

import { Meta, Small, SmallStrong } from '../../../theme/Typography';
import { XStack, YStack } from '../../../theme/ui';
import { useTheme } from '../../../theme/ThemeProvider';
import { chipTone } from '../../../theme/chipTone';
import { OffsetIcon } from '../../../theme/offsetIcons';
import { WaitingBar } from '../../../theme/ProgressBar';
import { haptics } from '../../../services/haptics';
import { t } from '../../../i18n/strings';
import { formatTermDate } from './TermPicker';
import { StripAction } from './InboxStrips';
import type { ScanSuggestion } from '../../../services/scan/attachmentScan';

/** Both states are the same box; only the contents change. */
const MIN_HEIGHT = 108;

export function DeadlineSuggestionCard({
  scanning,
  suggestion,
  onAccept,
  onDismiss,
}: {
  /** A scan is running right now. */
  readonly scanning: boolean;
  /** What it found, or null while it is still looking / when it found nothing. */
  readonly suggestion: ScanSuggestion | null;
  readonly onAccept: (date: number) => void;
  readonly onDismiss: () => void;
}) {
  const theme = useTheme();
  const tone = chipTone('estSoft', theme);

  if (!scanning && !suggestion) {
    return null; // no scan, no find, no card - an empty suggestion box is noise
  }

  return (
    <XStack
      marginTop={12}
      minHeight={MIN_HEIGHT}
      alignItems={suggestion ? 'flex-start' : 'center'}
      gap={10}
      paddingVertical={12}
      paddingHorizontal={14}
      borderRadius={12}
      backgroundColor={tone.bg}
      testID="scan-suggestion"
    >
      <OffsetIcon name={suggestion ? 'deadline' : 'search'} size={20} color={tone.fg} />
      {suggestion ? (
        <YStack flex={1} minWidth={0} gap={6} paddingTop={2}>
          <SmallStrong color={theme.text}>
            {t('scan.found', { d: formatTermDate(suggestion.date) })}
          </SmallStrong>
          {/* The evidence, verbatim. Wraps rather than truncating - a clipped phrase is exactly the
              part the user needs in order to disagree with it (015's lesson, one screen over). */}
          <Meta color={theme.textMuted}>
            {t('scan.from', {
              q: suggestion.snippet,
              f: suggestion.fileName,
            })}
          </Meta>
          <Meta color={theme.textFaint}>{t('scan.disclaimer')}</Meta>
          <XStack gap={18} flexWrap="wrap" marginTop={4}>
            <StripAction
              below
              tone={chipTone('userBlue', theme)}
              label={t('scan.accept')}
              onPress={() => {
                haptics.selection();
                onAccept(suggestion.date);
              }}
              testID="scan-accept"
            />
            <StripAction
              below
              tone={tone}
              label={t('scan.dismiss')}
              onPress={() => {
                haptics.selection();
                onDismiss();
              }}
              testID="scan-dismiss"
            />
          </XStack>
        </YStack>
      ) : (
        <YStack flex={1} minWidth={0} gap={10} testID="scan-running">
          <Small color={theme.textMuted}>{t('scan.running')}</Small>
          <WaitingBar label={t('scan.running')} onSunken testID="scan-waiting" />
        </YStack>
      )}
    </XStack>
  );
}
