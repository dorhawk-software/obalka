// Settings → O aplikaci → Co je nového (spec 029): every released version, newest first, in the app's
// language. The same text the sheet shows after an update, and the GitHub release and the stores carry.

import { YStack } from '../../theme/ui';
import { Meta } from '../../theme/Typography';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/spacing';
import { t } from '../../i18n/strings';
import { CHANGELOG } from '../../content/changelog.generated';
import { useLocale } from '../settings/SettingsProvider';
import { SubScreen } from '../settings/SubScreen';
import { ReleaseChanges } from './ReleaseChanges';

export function ChangelogScreen({ onBack }: { readonly onBack: () => void }) {
  const theme = useTheme();
  const locale = useLocale();
  const releases = CHANGELOG[locale];
  return (
    <SubScreen title={t('changelog.title')} onBack={onBack}>
      {releases.length === 0 ? (
        <Meta color={theme.textFaint} marginHorizontal={space.xs} testID="changelog-empty">
          {t('changelog.empty')}
        </Meta>
      ) : (
        releases.map(release => (
          <YStack key={release.version} marginBottom={space.section}>
            <ReleaseChanges release={release} withHeading />
          </YStack>
        ))
      )}
    </SubScreen>
  );
}
