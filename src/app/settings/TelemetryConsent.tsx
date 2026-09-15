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
// WHY IT IS SPECIFIC. The thing that earns a yes is saying exactly what goes and exactly what never
// does - and this app can afford to, because `scrub.ts` is an allow-list rather than a filter, so
// "what is sent" is a closed set rather than a hope.

import { ScrollView, XStack, YStack } from '../../theme/ui';
import { Body, BodyStrong, Caption, Display } from '../../theme/Typography';
import { PressScale } from '../../theme/PressScale';
import { useTheme } from '../../theme/ThemeProvider';
import { useHeaderTop } from '../../theme/useHeaderTop';
import { useContentBottom } from '../../theme/useContentBottom';
import { touchSlop } from '../../theme/touchTarget';
import { AlertIcon, CheckIcon, HelpIcon } from '../../theme/icons';
import { t } from '../../i18n/strings';
import { haptics } from '../../services/haptics';

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
          paddingHorizontal: 22,
          paddingBottom: contentBottom,
        }}
      >
        <Display fontSize={26} lineHeight={31} color={theme.text} marginBottom={12}>
          {t('consent.title')}
        </Display>
        <Body fontSize={15} lineHeight={22} color={theme.bodyText} marginBottom={22}>
          {t('consent.intro')}
        </Body>

        {/* The two lists, as a pair: what goes, and what never does. The second is the one people
            actually read, so it gets the same weight rather than a footnote's. */}
        <YStack
          borderWidth={1}
          borderRadius={14}
          borderColor={theme.border}
          backgroundColor={theme.surface}
          overflow="hidden"
          marginBottom={14}
        >
          <XStack gap={11} padding={14} alignItems="flex-start">
            <CheckIcon size={17} color={theme.success} />
            <Body flex={1} fontSize={13} lineHeight={19} color={theme.bodyText}>
              {t('consent.sends')}
            </Body>
          </XStack>
          <YStack height={1} backgroundColor={theme.border} />
          <XStack gap={11} padding={14} alignItems="flex-start">
            <AlertIcon size={17} color={theme.danger} />
            <Body flex={1} fontSize={13} lineHeight={19} color={theme.bodyText}>
              {t('consent.never')}
            </Body>
          </XStack>
        </YStack>

        <Caption fontSize={12} lineHeight={17} color={theme.textFaint} marginBottom={6}>
          {t('consent.where')}
        </Caption>
        <Caption fontSize={12} lineHeight={17} color={theme.textFaint} marginBottom={16}>
          {t('consent.change')}
        </Caption>

        <XStack
          alignItems="center"
          gap={7}
          alignSelf="flex-start"
          marginBottom={26}
          pressStyle={{ opacity: 0.6 }}
          onPress={onExplain}
          accessibilityRole="button"
          accessibilityLabel={t('consent.more')}
          hitSlop={touchSlop({ height: 18 })}
          testID="consentMore"
        >
          <HelpIcon size={15} color={theme.blue} />
          <BodyStrong fontSize={13} color={theme.blue}>
            {t('consent.more')}
          </BodyStrong>
        </XStack>

        {/* Equal weight, side by side. Not a primary and a get-out. */}
        <XStack gap={10}>
          <PressScale
            style={{ flex: 1 }}
            onPress={() => {
              haptics.selection();
              onAnswer(false);
            }}
            accessibilityLabel={t('consent.no')}
            testID="consentNo"
          >
            <XStack
              minHeight={50}
              borderRadius={14}
              borderWidth={1}
              borderColor={theme.borderStrong}
              alignItems="center"
              justifyContent="center"
            >
              <BodyStrong fontSize={15} color={theme.text}>
                {t('consent.no')}
              </BodyStrong>
            </XStack>
          </PressScale>
          <PressScale
            style={{ flex: 1 }}
            onPress={() => {
              haptics.selection();
              onAnswer(true);
            }}
            accessibilityLabel={t('consent.yes')}
            testID="consentYes"
          >
            <XStack
              minHeight={50}
              borderRadius={14}
              borderWidth={1}
              borderColor={theme.text}
              backgroundColor={theme.text}
              alignItems="center"
              justifyContent="center"
            >
              <BodyStrong fontSize={15} color={theme.surfaceAlt}>
                {t('consent.yes')}
              </BodyStrong>
            </XStack>
          </PressScale>
        </XStack>
      </ScrollView>
    </YStack>
  );
}
