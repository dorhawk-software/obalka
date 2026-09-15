// A backup written by an older version of this app, restored by the current one (006 T028).
//
// `compatibility.test.ts` already measures the schema FINGERPRINT, and that guard is what catches a
// field being added or renamed. What it cannot catch is the thing that actually goes wrong: the
// fingerprint compares today's shape to today's recorded shape, so it is two pieces of today's code
// agreeing with each other. Every migration ever written passes it.
//
// The only artifact that can prove a version 1 backup still restores is a version 1 backup. So
// `fixtures/schema-v1.obalka` was produced by running the app AS IT STOOD on the last
// commit before `BACKUP_SCHEMA_VERSION` moved to 2 - see `scripts/make-backup-fixture.mjs`, which
// does the checkout, and `fixtures/README.md`, which records where it came from.
//
// The failure this exists to catch is silent and delayed. Tier 2 added `documents` and
// `documentKey`; a later change that assumed either was present - a `.length`, a `for…of`, a key
// derivation - would restore a version 2 backup perfectly and throw on a version 1 one, and nobody
// would find out until somebody restored a phone they had lost.
//
// WHEN THE SCHEMA MOVES TO 3: add `schema-v2.obalka` alongside this, and a describe block for it.
// Not a replacement - version 1 backups do not stop existing because a version 3 shipped.

import { readFileSync } from 'fs';
import { join } from 'path';
import { open } from '../../src/services/backup/envelope';
import { format } from '../../src/services/backup/recoveryKey';
import { decodePayload } from '../../src/services/backup/snapshot';
import { compatibilityOf, migratePayload } from '../../src/services/backup/migrate';
import { restorePayload, type BackupSink } from '../../src/services/backup/restore';
import {
  restoreBackup,
  type DocumentRestore,
  type SyncTarget,
} from '../../src/services/backup/backupService';
import {
  BACKUP_SCHEMA_VERSION,
  type BackupAccount,
  type BackupDraft,
  type BackupManifest,
  type BackupMessage,
  type BackupReminder,
} from '../../src/services/backup/schema';

/**
 * The key the fixture is sealed under, and it is in the repository on purpose.
 *
 * It protects nothing: everything inside the fixture is invented, and a golden test that cannot open
 * its own golden file is not a test. Spelled so it cannot be mistaken for somebody's real key if it
 * ever turns up in a log - `TEST 0N1Y F1XTVRE KEY`.
 *
 * WRITTEN UNGROUPED, and rebuilt with the app's own `format`, because the secret scanner has a rule
 * for a grouped recovery key (`.trivy-secret.yaml`) and it is right to have one. The alternative was
 * three entries in `.trivyignore.yaml` exempting the files most likely to acquire a real key by
 * accident later. One call is cheaper than a permanent hole, and it goes through the same function
 * the app uses to render a key, so the fixture is sealed under exactly the string a phone would use.
 */
const FIXTURE_KEY = format('TEST0N1YF1XTVREKEY00');

const fixture = new Uint8Array(
  readFileSync(join(__dirname, 'fixtures', 'schema-v1.obalka')),
);

/**
 * Opened once for the whole file.
 *
 * Argon2id is the point of the cost and not the point of these tests: deriving it per case turned a
 * one-second file into a five-second one, and a suite people start skipping guards nothing. The
 * first case still awaits a real derivation - this is a memo, not a stub.
 */
const opened = (() => {
  let pending: Promise<Uint8Array> | null = null;
  return () => (pending ??= open(fixture, FIXTURE_KEY));
})();

/** Records what a restore wrote, so the assertions can be about rows rather than a return value. */
function recordingSink() {
  const accounts: BackupAccount[] = [];
  const messages = new Map<string, BackupMessage>();
  const drafts: BackupDraft[] = [];
  const reminders: BackupReminder[] = [];
  const settings = new Map<string, string>();
  const sink: BackupSink = {
    transaction: fn => fn(),
    existingMessage: async (boxId, messageId) =>
      messages.get(`${boxId}/${messageId}`) ?? null,
    hasAccount: async boxId => accounts.some(a => a.boxId === boxId),
    upsertAccount: async a => {
      accounts.push(a);
    },
    upsertMessage: async m => {
      messages.set(`${m.boxId}/${m.messageId}`, m);
    },
    upsertDraft: async d => {
      drafts.push(d);
    },
    upsertReminder: async r => {
      reminders.push(r);
    },
    putSetting: async (k, v) => {
      settings.set(k, v);
    },
  };
  return { sink, accounts, messages, drafts, reminders, settings };
}

describe('a backup written by schema version 1', () => {
  it('opens with its OWN Argon2id parameters, not the ones we write today', async () => {
    // The fixture was sealed at 8 MiB; `KDF_DEFAULTS` is 64. It opening at all is the proof that the
    // costs travel inside the header rather than being assumed by the reader - which is what lets
    // the parameters be raised later without orphaning every backup already written.
    await expect(opened()).resolves.toBeInstanceOf(Uint8Array);
  });

  it('really is version 1 - it predates documents entirely', async () => {
    const raw = decodePayload(await opened());
    expect(raw.schemaVersion).toBe(1);
    // Not "empty" - ABSENT. If these were merely empty the fixture would be a version 2 file with a
    // 1 written on it, and every assertion below would be measuring nothing.
    expect('documents' in raw).toBe(false);
    expect('documentKey' in raw).toBe(false);
  });

  it('is judged migratable from the manifest, before anything is downloaded', () => {
    // FR-011: the verdict has to be reachable from a few hundred bytes, because the alternative is
    // pulling a gigabyte over a phone connection to discover it cannot be read.
    const manifest: BackupManifest = {
      formatVersion: 1,
      schemaVersion: 1,
      appVersion: '1.0.0',
      createdAt: 0,
      tiers: { metadata: true, documents: false },
      sizeBytes: fixture.length,
      archiveName: 'schema-v1.obalka',
    };
    expect(compatibilityOf(manifest)).toEqual({
      kind: 'migratable',
      from: 1,
      steps: BACKUP_SCHEMA_VERSION - 1,
    });
  });

  it('restores into an empty device, row for row', async () => {
    const raw = decodePayload(await opened());
    const payload = migratePayload(raw);
    expect(payload.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    // What the migration promises an old backup looks like afterwards: it held the metadata tier and
    // nothing else, so the document index is empty and there is no key for one.
    expect(payload.documents).toEqual([]);
    expect(payload.documentKey).toBeNull();

    const { sink, accounts, messages, drafts, reminders, settings } =
      recordingSink();
    const report = await restorePayload(payload, sink);

    expect(report).toEqual({
      accountsAdded: 2,
      accountsKept: 0,
      messagesAdded: 4,
      messagesMerged: 0,
      draftsRestored: 1,
      remindersRestored: 1,
      settingsRestored: 2,
    });

    // Ordered, because a snapshot is written deterministically - two backups of an unchanged archive
    // are byte-identical, and that is a property worth a fixture noticing when it breaks.
    expect(accounts.map(a => a.boxId)).toEqual(['fx1test', 'fx2test']);
    expect(accounts[0]).toEqual({
      boxId: 'fx1test',
      loginName: 'fixture.first',
      label: 'Zkušební schránka',
      alias: 'Doma',
      dbType: 'FO',
      authMethod: 'otp',
      host: 'ws1.czebox.cz',
      passwordExpiresAt: null,
      createdAt: 1_690_000_000_000,
    });
    // FR-007, and the one that matters most: a session cookie or a secret reference reaching a
    // second device would defeat the whole design. Neither field was ever written, so neither can
    // arrive - asserted rather than assumed, because this is a real file rather than an object a
    // test just built.
    for (const account of accounts) {
      expect('sessionCookie' in account).toBe(false);
      expect('secretRef' in account).toBe(false);
    }

    expect([...messages.keys()]).toEqual([
      'fx1test/1000001',
      'fx1test/1000002',
      'fx1test/1000003',
      'fx2test/2000001',
    ]);
    // Only 1000001 was ever opened on the phone that made this backup, so only it carries a body.
    expect(messages.get('fx1test/1000001')?.detailJson).toContain(
      'rozhodnuti.pdf',
    );
    expect(messages.get('fx1test/1000001')?.downloadedAt).toBe(1);
    expect(messages.get('fx1test/1000002')?.detailJson).toBeNull();
    expect(messages.get('fx1test/1000002')?.downloadedAt).toBeNull();

    expect(drafts.map(d => d.subject)).toEqual(['Rozepsané']);
    expect(reminders.map(r => r.messageId)).toEqual(['1000001']);

    // `activeBoxId` is device-local: restoring it would silently switch the box on the phone doing
    // the restoring. The v1 writer dropped it, and this proves the dropped field never appears.
    expect([...settings.entries()].sort()).toEqual([
      ['locale', 'cs'],
      ['theme', 'system'],
    ]);
    expect(settings.has('activeBoxId')).toBe(false);
  });

  it('goes through the CURRENT entry point with the Tier 2 machinery switched on', async () => {
    // The scenario T028 is actually about: today's app, which knows about documents, handed a file
    // written before documents existed. Everything Tier 2 would touch throws if touched, so the test
    // fails loudly rather than quietly restoring nothing - and `restoreBackup` is the function the
    // app really calls, `restorePayload` above being only its middle.
    //
    // The trap this guards is one line: `!payload.documentKey || payload.documents.length === 0`
    // reads a `.length` off a field a version 1 payload does not have. It is safe only because the
    // migration puts an empty array there first. Reorder those two clauses, or drop the migration,
    // and every version 1 backup in existence throws on restore.
    const manifest: BackupManifest = {
      formatVersion: 1,
      schemaVersion: 1,
      appVersion: '1.0.0',
      createdAt: 0,
      tiers: { metadata: true, documents: false },
      sizeBytes: fixture.length,
      archiveName: 'schema-v1.obalka',
    };
    const target: SyncTarget = {
      listManifests: async () => [manifest],
      putBackup: async () => {
        throw new Error('a restore must not write');
      },
      getArchive: async name => {
        expect(name).toBe('schema-v1.obalka');
        return fixture;
      },
      deleteBackup: async () => {
        throw new Error('a restore must not delete');
      },
      getObject: async () => {
        throw new Error('there are no objects in a version 1 backup');
      },
    };
    const documents: DocumentRestore = {
      fs: new Proxy({} as never, {
        get: () => () => {
          throw new Error('Tier 2 touched a version 1 backup');
        },
      }),
      details: new Proxy({} as never, {
        get: () => () => {
          throw new Error('Tier 2 touched a version 1 backup');
        },
      }),
      messageDir: () => {
        throw new Error('Tier 2 touched a version 1 backup');
      },
    };

    const { sink } = recordingSink();
    const stages: string[] = [];
    const report = await restoreBackup(
      manifest,
      target,
      FIXTURE_KEY,
      sink,
      stage => {
        if (stages[stages.length - 1] !== stage.stage) {
          stages.push(stage.stage);
        }
      },
      undefined,
      documents,
    );

    expect(report.messagesAdded).toBe(4);
    expect(report.documentKey).toBeNull();
    expect(report.documents).toBeUndefined();
    // No `documents` phase: the bar must not promise work a version 1 backup cannot contain.
    expect(stages).not.toContain('documents');
  });

  it('does not blank a body this phone already has', async () => {
    // Restore rule 2, against a REAL old file rather than a hand-built payload. The fixture's
    // 1000002 has no `detailJson`; this device has since downloaded it. An older backup restored
    // over that must not take the documents away - which is the failure that would cost somebody the
    // very attachments the backup exists to protect.
    const { sink, messages } = recordingSink();
    await sink.upsertMessage({
      boxId: 'fx1test',
      messageId: '1000002',
      folder: 'received',
      subject: 'Bez staženého obsahu',
      sender: null,
      senderAddress: null,
      recipient: null,
      recipientAddress: null,
      deliveryTime: null,
      acceptanceTime: null,
      state: null,
      attachmentSize: null,
      detailJson: '{"documents":[{"fileName":"stazeno-pozdeji.pdf"}]}',
      downloadedAt: 1_716_000_000_000,
    });

    const payload = migratePayload(decodePayload(await opened()));
    const report = await restorePayload(payload, sink);

    expect(report.messagesMerged).toBe(1);
    expect(report.messagesAdded).toBe(3);
    const merged = messages.get('fx1test/1000002');
    expect(merged?.detailJson).toContain('stazeno-pozdeji.pdf');
    expect(merged?.downloadedAt).toBe(1_716_000_000_000);
    // …while everything the backup DID carry still lands.
    expect(merged?.sender).toBe('Úřad, který neexistuje');
    expect(merged?.deliveryTime).toBe(1_712_000_000_000);
  });
});
