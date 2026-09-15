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

import { Body, BodyStrong, Caption } from '../../../theme/Typography';
import { Spinner, XStack, YStack } from '../../../theme/ui';
import { PressScale } from '../../../theme/PressScale';
import { useTheme } from '../../../theme/ThemeProvider';
import { chipTone } from '../../../theme/chipTone';
import { SearchIcon, TimerIcon } from '../../../theme/icons';
import { haptics } from '../../../services/haptics';
import { t } from '../../../i18n/strings';
import { formatTermDate } from './TermPicker';
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
    <YStack
      marginTop={12}
      minHeight={MIN_HEIGHT}
      justifyContent="center"
      backgroundColor={tone.bg}
      borderWidth={1}
      borderColor={theme.border}
      borderRadius={14}
      paddingVertical={13}
      paddingHorizontal={14}
      gap={8}
      testID="scan-suggestion"
    >
      {suggestion ? (
        <>
          <XStack alignItems="center" gap={8}>
            <TimerIcon size={16} color={tone.fg} />
            <BodyStrong fontSize={15} color={theme.text} flex={1} minWidth={0}>
              {t('scan.found', { d: formatTermDate(suggestion.date) })}
            </BodyStrong>
          </XStack>
          {/* The evidence, verbatim. Wraps rather than truncating - a clipped phrase is exactly the
              part the user needs in order to disagree with it (015's lesson, one screen over). */}
          <Caption fontSize={12} color={theme.textMuted}>
            {t('scan.from', {
              q: suggestion.snippet,
              f: suggestion.fileName,
            })}
          </Caption>
          <Caption fontSize={12} color={theme.textFaint}>
            {t('scan.disclaimer')}
          </Caption>
          <XStack gap={8} marginTop={4}>
            {/* PressScale, not a Tamagui Button - the app's own press feedback since 019, so the
                two actions here feel like every other action in the app. */}
            <PressScale
              fullWidth
              style={{ flex: 1 }}
              onPress={() => {
                haptics.selection();
                onAccept(suggestion.date);
              }}
              accessibilityLabel={t('scan.accept')}
              testID="scan-accept"
            >
              <XStack
                width="100%"
                // `minHeight`, never `height`: React Native scales BOTH `fontSize` and `lineHeight`
                // by the system font scale (`TextAttributes.effectiveLineHeight` goes through
                // `toPixelFromSP`), and a container measured in dp does not scale with them. At a
                // large accessibility text size a fixed 40 crops the label it was drawn around.
                // Nine boxes in the app had this; `SettingsScreen`'s header already carried the
                // reasoning and the fix.
                minHeight={40}
                borderRadius={12}
                backgroundColor={theme.blue}
                alignItems="center"
                justifyContent="center"
              >
                <BodyStrong fontSize={14} color={theme.onBlue}>
                  {t('scan.accept')}
                </BodyStrong>
              </XStack>
            </PressScale>
            <PressScale
              onPress={() => {
                haptics.selection();
                onDismiss();
              }}
              accessibilityLabel={t('scan.dismiss')}
              testID="scan-dismiss"
            >
              <XStack
                minHeight={40}
                paddingHorizontal={18}
                borderRadius={12}
                backgroundColor={theme.surface}
                borderWidth={1}
                borderColor={theme.border}
                alignItems="center"
                justifyContent="center"
              >
                <BodyStrong fontSize={14} color={theme.text}>
                  {t('scan.dismiss')}
                </BodyStrong>
              </XStack>
            </PressScale>
          </XStack>
        </>
      ) : (
        <XStack alignItems="center" gap={10} testID="scan-running">
          {/* Reduce-Motion: the spinner is the platform's own ActivityIndicator, which the OS setting
              already governs - the icon beside it carries the meaning either way. */}
          <SearchIcon size={16} color={tone.fg} />
          <Body fontSize={14} color={theme.textMuted} flex={1} minWidth={0}>
            {t('scan.running')}
          </Body>
          <Spinner size="small" color={tone.fg} />
        </XStack>
      )}
    </YStack>
  );
}
