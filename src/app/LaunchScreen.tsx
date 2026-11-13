// The branded launch screen, and the same screen saying the saved boxes could not be loaded.
//
// Moved out of `AppShell` (2026-09-24) because the app root needs it too: when the database will not
// open - its key is a Keychain item, and a Keychain can fail - the settings cannot be read, and the
// shell, which waits for them, is never drawn. The root used to show nothing at all then, for good.
// One component, so both places show exactly the same screen (constitution V).

import { YStack } from '../theme/ui';
import { Display, Small } from '../theme/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { NeutralButton } from '../theme/NeutralButton';
import { WaitingBar } from '../theme/ProgressBar';
import LogoMark from '../assets/logo.svg';
import { t } from '../i18n/strings';

export function LaunchScreen({
  failed,
  onRetry,
}: {
  /** Say the saved boxes could not be loaded, and offer `onRetry`; otherwise the waiting bar. */
  readonly failed: boolean;
  readonly onRetry: () => void;
}) {
  const theme = useTheme();
  // Board R8 (031, agreed 2026-11-12): the shipped mark and the "Obálka" wordmark centred over all but
  // the bottom 120, and one waiting bar, 120 wide, 84 above the bottom, in the slot a platform spinner
  // used to hold. The lockup is centred against the same space whatever sits under it, so nothing moves
  // when the bar turns into the failure (constitution V): the message and a neutral retry, 64 above
  // the bottom, 36 in from each side.
  return (
    <YStack flex={1} backgroundColor={theme.bg}>
      <YStack position="absolute" top={0} left={0} right={0} bottom={120} alignItems="center" justifyContent="center" gap={16}>
        <LogoMark width={84} height={84} />
        <Display color={theme.blueDark}>{t('app.name')}</Display>
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
          <Small fontWeight="500" // Public Sans 500 - a fontWeight prop can't switch the face
            maxWidth={240}
            color={theme.textMuted}
            textAlign="center"
          >
            {t('app.loadFailed')}
          </Small>
          <YStack marginTop={18}>
            <NeutralButton compact inline label={t('app.loadFailed.retry')} onPress={onRetry} testID="loadRetry" />
          </YStack>
        </YStack>
      ) : (
        <YStack position="absolute" left={0} right={0} bottom={84} alignItems="center">
          <YStack width={120}>
            <WaitingBar label={t('app.loading')} testID="launchBar" />
          </YStack>
        </YStack>
      )}
    </YStack>
  );
}
