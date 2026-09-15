// Which attachments a backup holds, as a chip (026 US2). Shared by the backup screen's restore list and
// the transfer's picker, so the same backup reads the same in both places.
//
// Read from the manifest alone - no password, no decrypting - which is why the manifest records the
// mode at all.

import { XStack } from '../../theme/ui';
import { Badge } from '../../theme/Typography';
import { useTheme } from '../../theme/ThemeProvider';
import { plural, t } from '../../i18n/strings';
import type { BackupManifest } from '../../services/backup/schema';

export type BackupDocumentsKind = 'none' | 'downloaded' | 'all';

export function documentsKindOf(manifest: BackupManifest): BackupDocumentsKind {
  if (!manifest.tiers.documents) {
    return 'none';
  }
  return manifest.documentMode === 'all' ? 'all' : 'downloaded';
}

/** The chip's words, also what a screen reader hears for the row. */
export function documentsChipText(manifest: BackupManifest): string {
  return t(`backup.docs.chip.${documentsKindOf(manifest)}`);
}

/** "u 3 zpráv chybí přílohy" for an `all` backup that could not get every attachment, else null. */
export function documentsMissingText(manifest: BackupManifest): string | null {
  const missing = manifest.documentsMissing ?? 0;
  if (documentsKindOf(manifest) !== 'all' || missing <= 0) {
    return null;
  }
  return t(`backup.docs.missing.${plural(missing)}`, { n: missing });
}

export function BackupDocumentsChip({
  manifest,
  testID,
}: {
  readonly manifest: BackupManifest;
  readonly testID?: string;
}) {
  const theme = useTheme();
  const kind = documentsKindOf(manifest);
  // All: the brand's informational blue. Downloaded only: the soft gold of "part of it". None: neutral.
  const bg =
    kind === 'all' ? theme.blueSoft : kind === 'downloaded' ? theme.goldSoft : theme.surfaceSunken;
  const fg =
    kind === 'all' ? theme.blueDark : kind === 'downloaded' ? theme.warningInk : theme.textMuted;
  return (
    <XStack
      flexShrink={0}
      paddingHorizontal={8}
      paddingVertical={2}
      borderRadius={999}
      backgroundColor={bg}
      testID={testID}
    >
      <Badge fontSize={12} color={fg}>
        {documentsChipText(manifest)}
      </Badge>
    </XStack>
  );
}
