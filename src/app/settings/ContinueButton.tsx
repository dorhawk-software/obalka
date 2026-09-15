// The way on from a restore made on a phone with no boxes (2026-09-24): once the archive is in, the
// restore screen and the transfer screen both end on this, under the sentence saying what came back.
//
// One component for both, so the two screens cannot draw it differently. Its metrics are the backup
// screen's own "Zálohovat nyní" - the one filled action on these screens - rather than numbers of its
// own (constitution V).

import { XStack } from '../../theme/ui';
import { BodyStrong } from '../../theme/Typography';
import { PressScale } from '../../theme/PressScale';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/spacing';
import { t } from '../../i18n/strings';

export function ContinueButton({
  onPress,
  testID,
}: {
  readonly onPress: () => void;
  readonly testID: string;
}) {
  const theme = useTheme();
  return (
    <PressScale
      fullWidth
      onPress={onPress}
      accessibilityLabel={t('common.continue')}
      testID={testID}
      style={{ marginTop: space.md }}
    >
      <XStack
        width="100%"
        minHeight={48}
        borderRadius={14}
        backgroundColor={theme.text}
        alignItems="center"
        justifyContent="center"
      >
        <BodyStrong color={theme.surfaceAlt}>{t('common.continue')}</BodyStrong>
      </XStack>
    </PressScale>
  );
}
