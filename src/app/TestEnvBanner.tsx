// "Testovací prostředí" banner (008, US3) - a full-bleed soft-gold strip marking a message that lives
// on the czebox TEST system, so a test box can never be mistaken for a live one.
//
// SCOPE: the MESSAGE DETAIL only (received + sent). Everywhere else the environment is already stated
// and a second marker would be noise or nonsense:
//   • message list / box switcher - the box carries a "Testovací" PILL next to its name;
//   • add-box / login / re-auth   - there is no active box yet; the form has its own Ostré|Testovací
//                                   environment toggle;
//   • compose                     - reached from the list, which already shows the pill.
// The detail is the one surface with no other environment cue, hence the banner.
//
// It is a NORMAL-FLOW element (never an overlay): it occupies real layout space and pushes the header
// down, so it can never cover content (layout jumps & overlaps are forbidden - constitution V). It is
// rendered at the top of the screen's own layout (sliding in/out WITH the screen, no navigator-wide
// shift) and the header then drops its now-redundant status-bar padding, since the banner clears the
// status bar itself (useHeaderTop). Returns null when `show` is false, taking no space at all.
//
// Drawn as the airmail strip board R7 agreed (031, 2026-11-12): stripes along a paper band, no glyph -
// it isn't real mail, and it says so. Until 031 it was the soft-gold `StatusStrip` with a flask.

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { XStack, YStack } from '../theme/ui';
import { Badge } from '../theme/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { AirmailStrip } from '../theme/objects/AirmailStrip';
import { t } from '../i18n/strings';

/** The paper band inside the stripes: at least 28, 16 at the sides (board R7). */
export const TEST_BAND = { minHeight: 28, paddingHorizontal: 16 } as const;

export function TestEnvBanner({ show }: { readonly show: boolean }) {
  const theme = useTheme();
  const inset = useSafeAreaInsets().top;
  if (!show) {
    return null;
  }
  return (
    <YStack
      paddingTop={inset}
      backgroundColor={theme.surfaceAlt}
      accessible
      accessibilityLabel={t('testEnv.banner')}
      testID="testEnvBanner"
    >
      <AirmailStrip>
        <XStack {...TEST_BAND} alignItems="center" testID="testEnvBanner-row">
          {/* Free to wrap at a large text size: the band grows and the stripes are drawn to it. It
              takes the row's width: measured to its own words, Android cut "prostředí" off in dark. */}
          <Badge color={theme.text} flex={1} flexShrink={1} testID="testEnvBanner-label">
            {t('testEnv.banner')}
          </Badge>
        </XStack>
      </AirmailStrip>
    </YStack>
  );
}
