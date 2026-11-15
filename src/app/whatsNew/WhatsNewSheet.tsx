// The sheet after an update (spec 029, chosen by the owner 2026-11-10): once, on the first open of a
// new version, what changed since the version this phone had. One action closes it; the same text
// stays in Settings → O aplikaci → Co je nového. As board R9 draws it (031 I49): the title, since which
// version and how many changes as the sheet's line of words, the changes, and Pokračovat as the filled
// button under them, pinned so a long list keeps it in reach. Rounding: the board's 22 above it is 24.

import { YStack } from '../../theme/ui';
import { InkButton } from '../../theme/InkButton';
import { BottomSheet } from '../../theme/BottomSheet';
import { space } from '../../theme/spacing';
import { plural, t } from '../../i18n/strings';
import type { ChangelogRelease } from '../../content/changelog.generated';
import { APP_VERSION } from '../appInfo';
import { ReleaseChanges } from './ReleaseChanges';
import { noticeableChanges } from './whatsNew';

export function WhatsNewSheet({
  releases,
  since,
  onClose,
}: {
  /** Newest first: every release between the version this phone had and this one. */
  readonly releases: readonly ChangelogRelease[];
  /** The version this phone had. */
  readonly since: string;
  readonly onClose: () => void;
}) {
  // Not closed on the way to the background: the caller holds it while the app is covered (a Modal
  // would sit over the lock screen), so it is still there for the person who has not read it yet.
  const n = noticeableChanges(releases);
  return (
    <BottomSheet
      onClose={onClose}
      title={t('whatsNew.title', { version: APP_VERSION })}
      subtitle={t(`whatsNew.since.${plural(n)}`, { since, n })}
      testID="whats-new-sheet"
      footer={
        <YStack marginTop={space.section}>
          <InkButton label={t('common.continue')} onPress={onClose} testID="whats-new-continue" />
        </YStack>
      }
    >
      <YStack>
        {releases.map(release => (
          <ReleaseChanges key={release.version} release={release} withHeading={releases.length > 1} />
        ))}
      </YStack>
    </BottomSheet>
  );
}
