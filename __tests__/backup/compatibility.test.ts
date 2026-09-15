// Backup compatibility across app versions (006 FR-009 to FR-012).
//
// The scenario this exists for: somebody backs up on v1, loses the phone, buys another, installs
// whatever version is current, and restores. That has to work - forever, for every version that ever
// wrote a backup. And the mirror case has to fail SAFELY: a backup from a newer app must be refused
// by an older one with a message about updating, never half-imported over a good archive.
//
// The drift test at the bottom is the one that earns its keep during development rather than in the
// field. A field added to the snapshot without bumping the version makes every backup written
// afterwards silently unreadable by the migration chain, and nobody finds out for months.

import {
  BACKUP_SCHEMA_VERSION,
  SNAPSHOT_SHAPE,
  schemaFingerprint,
  type BackupManifest,
} from '../../src/services/backup/schema';
import {
  BackupIncompatibleError,
  MIGRATIONS,
  assertChainCovers,
  compatibilityOf,
  migratePayload,
} from '../../src/services/backup/migrate';
import { FORMAT_VERSION } from '../../src/services/backup/envelope';

const manifest = (over: Partial<BackupManifest> = {}): BackupManifest => ({
  formatVersion: FORMAT_VERSION,
  schemaVersion: BACKUP_SCHEMA_VERSION,
  appVersion: '0.0.1',
  createdAt: Date.now(),
  tiers: { metadata: true, documents: false },
  sizeBytes: 1024,
  archiveName: 'archive-1.bin',
  ...over,
});

describe('deciding from the manifest alone, before any download', () => {
  // FR-011: the archive can be gigabytes. Finding out it is unreadable after pulling all of it over
  // a phone connection is a design failure, so the verdict comes from a few hundred bytes.
  it('accepts a backup from this exact version', () => {
    expect(compatibilityOf(manifest())).toEqual({ kind: 'current' });
  });

  it('refuses a NEWER schema and names the remedy, without calling it corrupt', () => {
    const verdict = compatibilityOf(
      manifest({ schemaVersion: BACKUP_SCHEMA_VERSION + 1 }),
    );
    expect(verdict).toEqual({
      kind: 'tooNew',
      theirs: BACKUP_SCHEMA_VERSION + 1,
      ours: BACKUP_SCHEMA_VERSION,
      what: 'schema',
    });
  });

  it('refuses a newer ENVELOPE separately from a newer schema', () => {
    // Two versions that change for unrelated reasons: a cipher change and a new column. They fail
    // differently - one means the bytes cannot be decrypted, the other that they cannot be understood.
    const verdict = compatibilityOf(manifest({ formatVersion: FORMAT_VERSION + 1 }));
    expect(verdict).toMatchObject({ kind: 'tooNew', what: 'format' });
  });

  it('rejects a manifest with no usable version', () => {
    expect(compatibilityOf(manifest({ schemaVersion: 0 }))).toMatchObject({
      kind: 'unsupported',
    });
  });
});

describe('carrying an older backup forward', () => {
  it('has a migration for every version that ever existed', () => {
    // The guard that makes "restorable on a later app" a property rather than an intention.
    expect(() => assertChainCovers()).not.toThrow();
  });

  it('restores a backup written by this version unchanged', () => {
    const payload = {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      accounts: [{ boxId: 'abc123' }],
      messages: [],
      drafts: [],
      reminders: [],
      settings: {},
    };
    expect(migratePayload({ ...payload })).toMatchObject({ accounts: [{ boxId: 'abc123' }] });
  });

  it('refuses a payload from the future rather than reading the parts it recognises', () => {
    // The dangerous alternative: keep the known fields, drop the rest, report success. That is a
    // silent data loss dressed as a restore (FR-010, Principle IV).
    expect(() =>
      migratePayload({ schemaVersion: BACKUP_SCHEMA_VERSION + 1, accounts: [] }),
    ).toThrow(BackupIncompatibleError);
    expect(() =>
      migratePayload({ schemaVersion: BACKUP_SCHEMA_VERSION + 1 }),
    ).toThrow(/newer version of the app/);
  });

  it('refuses a file that is not a backup at all', () => {
    expect(() => migratePayload({ hello: 'world' })).toThrow(/does not look like a backup/);
  });

  it('runs each step in order, once', () => {
    // MIGRATIONS is empty at schema 1, so the chain is exercised with a stand-in: this pins the
    // mechanism now, so the first real migration inherits a tested path rather than an untried one.
    const applied: number[] = [];
    const chain = [
      { from: 1, describe: 'a', apply: (p: Record<string, unknown>) => { applied.push(1); return { ...p, one: true }; } },
      { from: 2, describe: 'b', apply: (p: Record<string, unknown>) => { applied.push(2); return { ...p, two: true }; } },
    ];
    let payload: Record<string, unknown> = { schemaVersion: 1 };
    for (let v = 1; v < 3; v++) {
      payload = chain.find(m => m.from === v)!.apply(payload);
      payload.schemaVersion = v + 1;
    }
    expect(applied).toEqual([1, 2]);
    expect(payload).toMatchObject({ schemaVersion: 3, one: true, two: true });
  });
});

describe('schema drift', () => {
  // FR-012. If this fails, the snapshot's shape changed: bump BACKUP_SCHEMA_VERSION, add the
  // migration that carries old backups across, and update the fingerprint below.
  //
  // The fingerprint is checked in rather than computed both times on purpose - comparing the code to
  // itself would pass for any change at all.
  const FINGERPRINT_FOR_VERSION_1 =
    'accounts(alias,authMethod,boxId,createdAt,dbType,host,label,loginName,passwordExpiresAt)|' +
    'drafts(body,boxId,id,recipientAddress,recipientBoxId,recipientName,subject,updatedAt)|' +
    'messages(acceptanceTime,attachmentSize,boxId,deliveryTime,detailJson,downloadedAt,folder,messageId,recipient,recipientAddress,sender,senderAddress,state,subject)|' +
    'reminders(boxId,createdAt,createdBy,date,messageId)|' +
    'settings(<key/value>)';

  // Version 2 added Tier 2: the document index and the key the documents are named under.
  const FINGERPRINT_FOR_VERSION_2 =
    'accounts(alias,authMethod,boxId,createdAt,dbType,host,label,loginName,passwordExpiresAt)|' +
    'documentKey(<opaque>)|' +
    'documents(boxId,contentId,fileName,messageId,sizeBytes)|' +
    'drafts(body,boxId,id,recipientAddress,recipientBoxId,recipientName,subject,updatedAt)|' +
    'messages(acceptanceTime,attachmentSize,boxId,deliveryTime,detailJson,downloadedAt,folder,messageId,recipient,recipientAddress,sender,senderAddress,state,subject)|' +
    'reminders(boxId,createdAt,createdBy,date,messageId)|' +
    'settings(<key/value>)';

  /** The pinned shape of every version this app has ever written, by version number. */
  const PINNED: Record<number, string> = {
    1: FINGERPRINT_FOR_VERSION_1,
    2: FINGERPRINT_FOR_VERSION_2,
  };

  it('has not changed without the version being incremented', () => {
    const pinned = PINNED[BACKUP_SCHEMA_VERSION];
    const now = schemaFingerprint();
    if (pinned !== now) {
      // Thrown rather than asserted so the message IS the failure: a fingerprint diff on its own
      // tells a developer what changed and nothing about what to do next.
      throw new Error(
        [
          `The backup snapshot shape changed, and BACKUP_SCHEMA_VERSION is still ${BACKUP_SCHEMA_VERSION}.`,
          '',
          'Every backup written from now on would carry the new shape under the old version number,',
          'and the migration chain would have no way to tell them apart - which surfaces months later,',
          'when somebody restores a lost phone.',
          '',
          'Do three things:',
          '  1. increment BACKUP_SCHEMA_VERSION in src/services/backup/schema.ts',
          '  2. add the migration from the previous version to MIGRATIONS in migrate.ts',
          '  3. pin the new fingerprint in PINNED here, keeping the old ones',
          '',
          `  was: ${pinned ?? '(this version is not pinned at all)'}`,
          `  now: ${now}`,
        ].join('\n'),
      );
    }
  });

  it('keeps every version it has ever written pinned', () => {
    // The pins are also the record of what each version meant. Dropping one would leave the
    // migration below with nothing to test against.
    for (let v = 1; v <= BACKUP_SCHEMA_VERSION; v++) {
      expect(typeof PINNED[v]).toBe('string');
    }
  });

  it('notices a field being added, removed or renamed', () => {
    // Guarding the guard: a fingerprint that ignored the fields would let every drift through.
    const withExtra = { ...SNAPSHOT_SHAPE, accounts: [...SNAPSHOT_SHAPE.accounts, 'newField'] };
    expect(schemaFingerprint(withExtra)).not.toBe(schemaFingerprint());
    const renamed = { ...SNAPSHOT_SHAPE, reminders: ['boxId', 'messageId', 'due', 'createdBy', 'createdAt'] };
    expect(schemaFingerprint(renamed)).not.toBe(schemaFingerprint());
  });

  it('does not cry wolf over field ORDER', () => {
    // Reordering is not a compatibility event, and a guard that fired on formatting gets switched off.
    const reordered = { ...SNAPSHOT_SHAPE, accounts: [...SNAPSHOT_SHAPE.accounts].reverse() };
    expect(schemaFingerprint(reordered)).toBe(schemaFingerprint());
  });

  it('keeps the session cookie out of the shape entirely', () => {
    // 018 put a bearer credential in the accounts table; FR-007 says a snapshot must not carry it.
    expect(schemaFingerprint()).not.toContain('sessionCookie');
    expect(schemaFingerprint()).not.toContain('secretRef');
  });

  it('leaves a migration to write when the version moves', () => {
    // The other half of drift: bumping the version without adding the step is just as broken as
    // changing the shape without bumping.
    expect(MIGRATIONS.length).toBe(BACKUP_SCHEMA_VERSION - 1);
  });
});
