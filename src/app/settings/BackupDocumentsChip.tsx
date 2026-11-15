// Which attachments a backup holds, as a chip (026 US2). Shared by the backup screen's restore list and
// the transfer's picker, so the same backup reads the same in both places.
//
// Read from the manifest alone - no password, no decrypting - which is why the manifest records the
// mode at all.

import { XStack } from '../../theme/ui';
import { Meta } from '../../theme/Typography';
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

/**
 * What a backup holds of the attachments, as R10's chip: the 8 corner (DESIGN.md › Chips), the blue
 * info tone when it holds some - downloaded only or all of them - and the sunken tone in body ink when
 * it holds none. Until 2026-11-15 it was a pill (999), "downloaded only" in the soft gold.
 */
export function DocumentsKindChip({
  kind,
  testID,
}: {
  readonly kind: BackupDocumentsKind;
  readonly testID?: string;
}) {
  const theme = useTheme();
  return (
    <XStack
      flexShrink={0}
      paddingHorizontal={8}
      paddingVertical={2}
      borderRadius={8}
      backgroundColor={kind === 'none' ? theme.surfaceSunken : theme.blueSoft}
      testID={testID}
    >
      <Meta fontWeight="700" color={kind === 'none' ? theme.bodyText : theme.blueDark}>
        {t(`backup.docs.chip.${kind}`)}
      </Meta>
    </XStack>
  );
}

/** A backup's chip in the restore list. */
export function BackupDocumentsChip({
  manifest,
  testID,
}: {
  readonly manifest: BackupManifest;
  readonly testID?: string;
}) {
  return <DocumentsKindChip kind={documentsKindOf(manifest)} testID={testID} />;
}
