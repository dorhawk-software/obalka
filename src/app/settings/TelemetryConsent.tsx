// The first-run diagnostics question, asked once, before anything is transmitted.
//
// WHY IT EXISTS AT ALL. Diagnostics used to default ON, which was defensible while the only person
// running the app was the person reading the reports. It stopped being defensible when the app
// pointed at a real Sentry project, and the reason is not GDPR: ePrivacy - § 89 zák. 127/2005 Sb. in
// Czech law - governs storing or reading information on someone's device REGARDLESS of whether it is
// personal data, and wants prior consent unless the access is strictly necessary to deliver the
// service asked for. The SDK writes a persistent per-install id; crash reporting is not strictly
// necessary to deliver a mail client. Legitimate interest is no answer to that, because it is not a
// GDPR question.
//
// BOTH ANSWERS ARE EQUALLY EASY, and that is a requirement rather than a courtesy: consent has to be
// freely given, and an interface where "yes" is a filled button and "no" is a grey link has not
// obtained it. Same size, same shape, same weight, side by side, neither pre-selected.
//
// Drawn to the identity (031 I06, 2026-11-15): the two lists are one R3 sheet with the inset divider,
// the notes R13's muted quiet lines, the longer answer R1's help link (44, the slop to the target), and
// the answers R6's pair of sunken neutral buttons at 48 - alike, which the paragraph above asks for.
// Until then yes was filled in ink and no outlined (50 tall), the divider ran the card's whole width,
// the notes were faint, and the link was a 15 glyph over an 18 line.
//
// WHY IT IS SPECIFIC. The thing that earns a yes is saying exactly what goes and exactly what never
// does - and this app can afford to, because `scrub.ts` is an allow-list rather than a filter, so
// "what is sent" is a closed set rather than a hope.

import { ScrollView, XStack, YStack } from '../../theme/ui';
import { Body, Display, Label, Meta, SmallStrong } from '../../theme/Typography';
import { NeutralButton } from '../../theme/NeutralButton';
import { useTheme } from '../../theme/ThemeProvider';
import { useHeaderTop } from '../../theme/useHeaderTop';
import { useContentBottom } from '../../theme/useContentBottom';
import { touchSlop } from '../../theme/touchTarget';
import { AlertIcon, CheckIcon, HelpIcon } from '../../theme/icons';
import { t } from '../../i18n/strings';
import { haptics } from '../../services/haptics';
import { Card } from '../../theme/Card';
import { RowDivider } from './SettingsSection';

/** R1's help link: 44 tall, the slop takes it to the target. */
const LINK_HEIGHT = 44;

export function TelemetryConsent({
  onAnswer,
  onExplain,
}: {
  /** The user's answer. Persisted by the caller; nothing transmits until this fires. */
  readonly onAnswer: (send: boolean) => void;
  /** Opens the FAQ's diagnostics answer, which is longer and names the operator. */
  readonly onExplain: () => void;
}) {
  const theme = useTheme();
  const headerTop = useHeaderTop();
  const contentBottom = useContentBottom(16);
  return (
    <YStack flex={1} backgroundColor={theme.bg}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerTop + 24,
          paddingHorizontal: 24,
          paddingBottom: contentBottom,
        }}
      >
        <Display accessibilityRole="header" color={theme.text} marginBottom={12}>
          {t('consent.title')}
        </Display>
        <Body color={theme.bodyText} marginBottom={24}>
          {t('consent.intro')}
        </Body>

        {/* The two lists, as a pair: what goes, and what never does. The second is the one people
            actually read, so it gets the same weight rather than a footnote's. */}
        <Card
          overflow="hidden"
          marginBottom={14}
        >
          <XStack gap={12} padding={14} alignItems="flex-start">
            <CheckIcon size={17} color={theme.success} />
            <Label fontWeight="400" flex={1} color={theme.bodyText}>
              {t('consent.sends')}
            </Label>
          </XStack>
          <RowDivider />
          <XStack gap={12} padding={14} alignItems="flex-start">
            <AlertIcon size={17} color={theme.danger} />
            <Label fontWeight="400" flex={1} color={theme.bodyText}>
              {t('consent.never')}
            </Label>
          </XStack>
        </Card>

        <Meta color={theme.textMuted} marginBottom={6}>
          {t('consent.where')}
        </Meta>
        <Meta color={theme.textMuted} marginBottom={6}>
          {t('consent.change')}
        </Meta>

        <XStack
          alignItems="center"
          gap={6}
          alignSelf="flex-start"
          minHeight={LINK_HEIGHT}
          marginBottom={18}
          pressStyle={{ opacity: 0.5 }}
          onPress={onExplain}
          accessibilityRole="button"
          accessibilityLabel={t('consent.more')}
          hitSlop={touchSlop({ height: LINK_HEIGHT })}
          testID="consentMore"
        >
          <HelpIcon size={18} color={theme.blue} />
          <SmallStrong color={theme.blue}>{t('consent.more')}</SmallStrong>
        </XStack>

        {/* Equal weight, side by side: two alike, not a primary and a get-out. */}
        <XStack gap={10}>
          <YStack flex={1}>
            <NeutralButton
              bare="equal answer"
              compact
              label={t('consent.no')}
              onPress={() => {
                haptics.selection();
                onAnswer(false);
              }}
              testID="consentNo"
            />
          </YStack>
          <YStack flex={1}>
            <NeutralButton
              bare="equal answer"
              compact
              label={t('consent.yes')}
              onPress={() => {
                haptics.selection();
                onAnswer(true);
              }}
              testID="consentYes"
            />
          </YStack>
        </XStack>
      </ScrollView>
    </YStack>
  );
}
