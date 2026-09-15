// Snapshot and restore (006 Phase 2) - the two halves that touch real data.
//
// The restore side is where a backup feature can destroy something, so most of this file is about
// what a restore must NOT do: it must not delete what the backup does not know about, and it must
// not replace something with nothing.

import { buildPayload, decodePayload, encodePayload, type BackupSource } from '../../src/services/backup/snapshot';
import { mergeMessage, restorePayload, type BackupSink } from '../../src/services/backup/restore';
import { BACKUP_SCHEMA_VERSION, type BackupMessage } from '../../src/services/backup/schema';
import { open, seal } from '../../src/services/backup/envelope';
import { migratePayload } from '../../src/services/backup/migrate';

const SENTINEL_COOKIE = 'IPCZ-X-COOKIE=SENTINEL-session';

const message = (over: Partial<BackupMessage> = {}): BackupMessage => ({
  boxId: 'abc123',
  messageId: '1',
  folder: 'received',
  subject: 'Rozhodnuti',
  sender: 'Urad',
  senderAddress: null,
  recipient: null,
  recipientAddress: null,
  deliveryTime: 1000,
  acceptanceTime: null,
  state: 7,
  attachmentSize: 1,
  detailJson: null,
  downloadedAt: null,
  ...over,
});

/** A source that also carries the fields a snapshot must refuse to copy. */
const source = (over: Partial<BackupSource> = {}): BackupSource => ({
  listAccounts: async () => [
    {
      boxId: 'abc123',
      loginName: 'novakjan',
      label: 'Jan Novak',
      alias: null,
      dbType: 'FO',
      authMethod: 'otp_totp',
      host: 'production',
      passwordExpiresAt: 2000,
      createdAt: 1,
      // Not part of BackupAccount - present here exactly to prove it is not copied.
      sessionCookie: SENTINEL_COOKIE,
      secretRef: 'ref-abc123',
    } as never,
  ],
  listEnvelopes: async (boxId: string, folder: string) =>
    folder === 'received' ? [message({ boxId })] : [],
  messageDetail: async () => JSON.stringify({ id: 'msg1' }),
  listDrafts: async () => [],
  listReminders: async () => [],
  allSettings: async () => ({ themeMode: 'dark', activeBoxId: 'abc123' }),
  ...over,
});

describe('what a snapshot carries', () => {
  it('never copies the session cookie or the keychain pointer', async () => {
    // 018 made the session a bearer credential and put it in the accounts row. A snapshot built by
    // spreading the row would carry one per OTP box (FR-007 as amended).
    const payload = await buildPayload(source());
    const asText = JSON.stringify(payload);
    expect(asText).not.toContain(SENTINEL_COOKIE);
    expect(asText).not.toContain('secretRef');
    expect(payload.accounts[0]).toMatchObject({ boxId: 'abc123', loginName: 'novakjan' });
  });

  it('leaves out what describes THIS device rather than the archive', async () => {
    // `activeBoxId` is which box this phone had open. Restoring it onto another device states
    // something that was never true there.
    const payload = await buildPayload(source());
    expect(payload.settings).toEqual({ themeMode: 'dark' });
  });

  it('leaves out which backups this phone s retention is holding (2026-09-15)', async () => {
    // They name backups in this phone's own store. Carried, a restore wrote the holds of the day the
    // backup was made over today's, and one made with nothing held let go of the backup that still
    // holds a document the restore could not bring back. The preferences themselves still travel.
    const payload = await buildPayload(
      source({
        allSettings: async () => ({
          themeMode: 'dark',
          'backup.keep': '3',
          'backup.held': '["obalka-1000.backup"]',
        }),
      }),
    );
    expect(payload.settings).toEqual({ 'backup.keep': '3', themeMode: 'dark' });
  });

  it('is deterministic, so an unchanged archive produces identical bytes', async () => {
    // What lets a later version skip an upload it does not need, and makes a diff mean something.
    const a = await encodePayload(await buildPayload(source()));
    const b = await encodePayload(await buildPayload(source()));
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });

  it('stamps the schema version it was written under', async () => {
    expect((await buildPayload(source())).schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
  });

  it('survives the whole round trip: build, seal, open, migrate', async () => {
    const built = await buildPayload(source());
    const sealed = await seal(
      await encodePayload(built),
      'FKPX-9WQ2-7TDM-4RJH-2CVB',
      { m: 256, t: 1, p: 1 },
    );
    const back = migratePayload(
      decodePayload(await open(sealed, 'FKPX-9WQ2-7TDM-4RJH-2CVB')),
    );
    expect(back).toEqual(built);
  });
});

/** A sink over a plain Map, so the merge rules can be tested without a database. */
function fakeSink(existing: BackupMessage[] = [], boxes: string[] = []) {
  const messages = new Map(existing.map(m => [`${m.boxId}/${m.messageId}`, m]));
  const accounts = new Set(boxes);
  const settings = new Map<string, string>();
  let failAfter = Infinity;
  let writes = 0;
  const sink: BackupSink = {
    transaction: async fn => {
      const snapshotOfMessages = new Map(messages);
      try {
        return await fn();
      } catch (e) {
        // What a real transaction does: nothing written survives a failure.
        messages.clear();
        snapshotOfMessages.forEach((v, k) => messages.set(k, v));
        throw e;
      }
    },
    existingMessage: async (boxId, messageId) =>
      messages.get(`${boxId}/${messageId}`) ?? null,
    hasAccount: async boxId => accounts.has(boxId),
    upsertAccount: async a => {
      accounts.add(a.boxId);
    },
    upsertMessage: async m => {
      if (++writes > failAfter) {
        throw new Error('storage failed part-way');
      }
      messages.set(`${m.boxId}/${m.messageId}`, m);
    },
    upsertDraft: async () => {},
    upsertReminder: async () => {},
    putSetting: async (k, v) => {
      settings.set(k, v);
    },
  };
  return { sink, messages, accounts, settings, failAt: (n: number) => { failAfter = n; } };
}

const payloadWith = (messages: BackupMessage[]) => ({
  schemaVersion: BACKUP_SCHEMA_VERSION,
  accounts: [],
  messages,
  drafts: [],
  reminders: [],
  settings: {},
  documents: [],
  documentKey: null,
});

describe('a restore is a merge, never a replacement', () => {
  it('keeps messages the backup has never heard of', async () => {
    // Everything received since the backup was written. Treating the backup as authoritative would
    // delete exactly the mail that arrived most recently.
    const local = message({ messageId: 'newer' });
    const { sink, messages } = fakeSink([local]);
    await restorePayload(payloadWith([message({ messageId: 'older' })]), sink);
    expect([...messages.keys()].sort()).toEqual(['abc123/newer', 'abc123/older']);
  });

  it('never replaces something with nothing', async () => {
    // The case that matters: the local copy has its attachments downloaded, the backup predates that.
    // Overwriting would blank the paths and orphan the files on disk.
    const downloaded = message({ detailJson: '{"attachments":[{"localPath":"/disk/1"}]}', downloadedAt: 99 });
    const { sink, messages } = fakeSink([downloaded]);
    await restorePayload(payloadWith([message({ detailJson: null, downloadedAt: null })]), sink);
    const merged = messages.get('abc123/1');
    expect(merged?.detailJson).toContain('localPath');
    expect(merged?.downloadedAt).toBe(99);
  });

  it('does fill in what the local copy is missing', async () => {
    const bare = message({ subject: null, detailJson: null });
    const { sink, messages } = fakeSink([bare]);
    await restorePayload(payloadWith([message({ subject: 'Rozhodnuti', detailJson: '{"a":1}' })]), sink);
    expect(messages.get('abc123/1')).toMatchObject({ subject: 'Rozhodnuti', detailJson: '{"a":1}' });
  });

  it('leaves an existing box alone rather than restoring a stale copy over it', async () => {
    // The live row holds this device session and sync state; the backup's copy is stale by
    // definition and has had the session stripped out of it.
    const { sink, accounts } = fakeSink([], ['abc123']);
    const report = await restorePayload(
      { ...payloadWith([]), accounts: [{ boxId: 'abc123', loginName: 'other', label: null, alias: null, dbType: null, authMethod: 'password', host: 'czebox', passwordExpiresAt: null, createdAt: 0 }] },
      sink,
    );
    expect(report.accountsKept).toBe(1);
    expect(report.accountsAdded).toBe(0);
    expect(accounts.size).toBe(1);
  });

  it('leaves the archive untouched when it fails part-way', async () => {
    // FR-006: a failed restore must never be a half-merged archive.
    const local = message({ messageId: 'local-only', subject: 'Zustava' });
    const { sink, messages, failAt } = fakeSink([local]);
    failAt(1);
    await expect(
      restorePayload(payloadWith([message({ messageId: 'a' }), message({ messageId: 'b' })]), sink),
    ).rejects.toThrow('storage failed part-way');
    expect([...messages.keys()]).toEqual(['abc123/local-only']);
    expect(messages.get('abc123/local-only')?.subject).toBe('Zustava');
  });

  it('reports what it actually did', async () => {
    const { sink } = fakeSink([message({ messageId: '1' })]);
    const report = await restorePayload(
      payloadWith([message({ messageId: '1' }), message({ messageId: '2' })]),
      sink,
    );
    expect(report).toMatchObject({ messagesMerged: 1, messagesAdded: 1 });
  });
});

describe('mergeMessage', () => {
  it('takes the backup wholesale when there is nothing local', () => {
    const m = message({ subject: 'A' });
    expect(mergeMessage(null, m)).toEqual(m);
  });

  it('prefers a present local value over an absent backup one, field by field', () => {
    const local = message({ acceptanceTime: 5, attachmentSize: 3 });
    const backup = message({ acceptanceTime: null, attachmentSize: null });
    expect(mergeMessage(local, backup)).toMatchObject({ acceptanceTime: 5, attachmentSize: 3 });
  });

  it('prefers the backup when both are present - it is the copy being restored', () => {
    const local = message({ subject: 'stale' });
    const backup = message({ subject: 'fresh' });
    expect(mergeMessage(local, backup).subject).toBe('fresh');
  });
});
