// The branded launch screen, and the same screen saying the saved boxes could not be loaded.
//
// Moved out of `AppShell` (2026-09-24) because the app root needs it too: when the database will not
// open - its key is a Keychain item, and a Keychain can fail - the settings cannot be read, and the
// shell, which waits for them, is never drawn. The root used to show nothing at all then, for good.
// One component, so both places show exactly the same screen (constitution V).

import { Button, Spinner, YStack } from '../theme/ui';
import { Body, Display } from '../theme/Typography';
import { fonts } from '../theme/typography';
import { useTheme } from '../theme/ThemeProvider';
import LogoMark from '../assets/logo.svg';
import { t } from '../i18n/strings';

export function LaunchScreen({
  failed,
  onRetry,
}: {
  /** Say the saved boxes could not be loaded, and offer `onRetry`; otherwise the spinner. */
  readonly failed: boolean;
  readonly onRetry: () => void;
}) {
  const theme = useTheme();
  // Branded launch state (not a bare spinner), on `bg`: the envelope mark + the "Obálka" Bricolage
  // wordmark centred (same brand lockup as Welcome/Lock), a quiet spinner held to the lower third so
  // the brand is the hero, not the loader.
  //
  // When the boxes would not load, the same screen says so and offers to try again. The spinner's
  // slot stays, only hidden, and the message sits over it: the lockup is centred against the same
  // space either way, so nothing moves when the one turns into the other (constitution V). The
  // message block takes the inbox's own load-error metrics.
  return (
    <YStack flex={1} backgroundColor={theme.bg} alignItems="center">
      <YStack flex={1} alignItems="center" justifyContent="center" gap={16}>
        <LogoMark width={84} height={84} />
        <Display color={theme.blueDark}>{t('app.name')}</Display>
      </YStack>
      <YStack
        paddingBottom={64}
        opacity={failed ? 0 : 1}
        accessibilityElementsHidden={failed}
        importantForAccessibility={failed ? 'no-hide-descendants' : 'auto'}
      >
        <Spinner size="small" color={theme.blue} />
      </YStack>
      {failed ? (
        <YStack
          position="absolute"
          left={0}
          right={0}
          bottom={64}
          alignItems="center"
          paddingHorizontal={36}
          testID="loadFailed"
        >
          <Body
            fontFamily={fonts.bodyMedium} // Public Sans 500 - a fontWeight prop can't switch the face
            fontSize={14}
            maxWidth={240}
            color={theme.textMuted}
            textAlign="center"
          >
            {t('app.loadFailed')}
          </Body>
          <Button
            marginTop={18}
            height={46}
            borderRadius={13}
            paddingHorizontal={22}
            backgroundColor={theme.surface}
            borderWidth={1}
            borderColor={theme.borderStrong}
            color={theme.text}
            fontSize={14}
            fontWeight="700"
            onPress={onRetry}
            testID="loadRetry"
          >
            {t('app.loadFailed.retry')}
          </Button>
        </YStack>
      ) : null}
    </YStack>
  );
}
