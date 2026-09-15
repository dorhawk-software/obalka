// Each row of the backup list says what that backup weighs, attachments included (2026-10-03).
// The status line above the list always said "14 kB + přílohy 150 kB"; the rows said "14 kB" even for a
// backup chipped "Všechny přílohy", which read as if the attachments were not in it.

import { backupSizeText } from '../../src/app/settings/BackupScreen';
import { t } from '../../src/i18n/strings';
import type { BackupManifest } from '../../src/services/backup/schema';

const manifest = (over: Partial<BackupManifest>): BackupManifest => ({
  formatVersion: 1,
  schemaVersion: 2,
  appVersion: '0.0.1',
  createdAt: 1,
  tiers: { metadata: true, documents: false },
  sizeBytes: 14 * 1024,
  archiveName: 'obalka-1.backup',
  ...over,
});

describe('the size on a backup row', () => {
  it('adds the attachments of a backup that holds them', () => {
    expect(
      backupSizeText(
        manifest({ tiers: { metadata: true, documents: true }, documentBytes: 150 * 1024 }),
      ),
    ).toBe(t('backup.size.documents', { size: '14 kB', docSize: '150 kB' }));
  });

  it('is the archive alone for a backup without attachments, or with none stored', () => {
    expect(backupSizeText(manifest({}))).toBe('14 kB');
    expect(
      backupSizeText(manifest({ tiers: { metadata: true, documents: true }, documentBytes: 0 })),
    ).toBe('14 kB');
  });
});
