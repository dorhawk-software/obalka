// Backup and restore, end to end, over the app real stores (006).
//
// Every other suite in this folder tests a piece. This one runs the whole operation the way the app
// will: read the actual InMemory stores, seal, store, list, decide compatibility from the manifest,
// fetch, decrypt, migrate, merge back. The stores here are the app own implementations, not fakes
// written to agree with the code under test.

import { InMemoryAccountsStore } from '../../src/services/db/accountsStore';
import { InMemoryMessagesStore } from '../../src/services/db/messagesStore';
import { InMemoryDraftsStore } from '../../src/services/db/draftsStore';
import { InMemoryRemindersStore } from '../../src/services/db/remindersStore';
import { backupSink, backupSource, type BackupStores } from '../../src/services/backup/stores';
import {
  BackupNotRestorableError,
  createBackup,
  listRestorable,
  restoreBackup,
  type SyncTarget,
} from '../../src/services/backup/backupService';
import { BACKUP_SCHEMA_VERSION, type BackupManifest } from '../../src/services/backup/schema';
import { MESSAGE_STATE } from '../../src/features/messages/state/messageState';
import type { DataBoxAccount, MessageEnvelope } from '../../src/services/isds/types';

const PASSPHRASE = 'FKPX-9WQ2-7TDM-4RJH-2CVB';
/** Cheap KDF: these tests are about the flow, not about how long Argon2id takes. */
const FAST = { m: 256, t: 1, p: 1 };

const account = (boxId: string): DataBoxAccount => ({
  id: `acc_${boxId}`,
  boxId,
  loginName: `login-${boxId}`,
  label: 'Jan Novak',
  dbType: 'FO',
  alias: null,
  authMethod: 'otp_totp',
  host: 'production',
  secretRef: `ref-${boxId}`,
  sessionValidUntil: null,
  passwordExpiresAt: 5000,
  lastSyncedAt: 999,
  messageCount: 2,
  unreadCount: 1,
  pdzCreditCzk: 100,
  syncError: null,
  createdAt: 1,
  updatedAt: 2,
});

const envelope = (id: string, subject: string): MessageEnvelope => ({
  id,
  subject,
  sender: 'Urad',
  senderAddress: 'Namesti 1, Praha',
  recipient: null,
  recipientAddress: null,
  recipientBoxId: null,
  deliveryTime: 1000,
  acceptanceTime: 2000,
  state: MESSAGE_STATE.read,
  attachmentSize: 1,
});

/** A target that keeps everything in memory, and counts what was fetched. */
function memoryTarget() {
  const manifests: BackupManifest[] = [];
  const archives = new Map<string, Uint8Array>();
  let archiveFetches = 0;
  const target: SyncTarget = {
    listManifests: async () => [...manifests],
    putBackup: async (manifest, archive) => {
      manifests.push(manifest);
      archives.set(manifest.archiveName, archive);
    },
    deleteBackup: async name => {
      archives.delete(name);
      const at = manifests.findIndex(m => m.archiveName === name);
      if (at >= 0) {
        manifests.splice(at, 1);
      }
    },
    getArchive: async name => {
      archiveFetches++;
      const found = archives.get(name);
      if (!found) {
        throw new Error(`no archive ${name}`);
      }
      return found;
    },
  };
  return { target, manifests, archives, fetches: () => archiveFetches };
}

async function populated(): Promise<BackupStores> {
  const stores: BackupStores = {
    accounts: new InMemoryAccountsStore(),
    messages: new InMemoryMessagesStore(),
    drafts: new InMemoryDraftsStore(),
    reminders: new InMemoryRemindersStore(),
  };
  await stores.accounts.add(account('abc123'));
  await stores.accounts.setSetting('themeMode', 'dark');
  await stores.messages.cacheList('abc123', 'received', [envelope('1', 'Rozhodnuti'), envelope('2', 'Vyzva')], 500);
  await stores.reminders.set({ boxId: 'abc123', messageId: '1', date: 7000, createdBy: 'user', createdAt: 10 });
  return stores;
}

/** The in-memory stores have no transactions; the restore logic still runs inside one. */
const noTransaction = <T,>(fn: () => Promise<T>) => fn();

describe('a backup, then a restore onto an empty device', () => {
  it('brings the boxes, the messages, the reminders and the settings back', async () => {
    const from = await populated();
    const { target } = memoryTarget();
    await createBackup(backupSource(from), target, PASSPHRASE, { appVersion: '0.0.1', kdf: FAST });

    const onto: BackupStores = {
      accounts: new InMemoryAccountsStore(),
      messages: new InMemoryMessagesStore(),
      drafts: new InMemoryDraftsStore(),
      reminders: new InMemoryRemindersStore(),
    };
    const [candidate] = await listRestorable(target);
    expect(candidate.restorable).toBe(true);

    const report = await restoreBackup(
      candidate.manifest,
      target,
      PASSPHRASE,
      backupSink(onto, noTransaction),
    );

    expect(report.accountsAdded).toBe(1);
    expect(report.messagesAdded).toBe(2);
    expect(report.remindersRestored).toBe(1);
    const restoredList = await onto.messages.getList('abc123', 'received');
    expect(restoredList.envelopes.map(e => e.subject).sort()).toEqual(['Rozhodnuti', 'Vyzva']);
    expect(await onto.accounts.getSetting('themeMode')).toBe('dark');
  });

  it('restores a box that has to sign in again, carrying no session and no secret', async () => {
    // FR-007: the backup never held them, so the restored box arrives in the one honest state -
    // listed, and asking to be signed in.
    const from = await populated();
    const { target } = memoryTarget();
    await createBackup(backupSource(from), target, PASSPHRASE, { appVersion: '0.0.1', kdf: FAST });
    const onto: BackupStores = {
      accounts: new InMemoryAccountsStore(),
      messages: new InMemoryMessagesStore(),
      drafts: new InMemoryDraftsStore(),
      reminders: new InMemoryRemindersStore(),
    };
    const [candidate] = await listRestorable(target);
    await restoreBackup(candidate.manifest, target, PASSPHRASE, backupSink(onto, noTransaction));
    const restored = (await onto.accounts.list())[0];
    // No session travels - and since 001 T028 an account has no field that could carry one.
    expect('sessionCookie' in restored).toBe(false);
    expect(restored.secretRef).toBe('');
    expect(restored.boxId).toBe('abc123');
    // Sync bookkeeping describes the OTHER phone conversation with ISDS and is not carried either.
    expect(restored.lastSyncedAt).toBeNull();
  });

  it('leaves nothing readable in the stored archive', async () => {
    const from = await populated();
    const { target, archives } = memoryTarget();
    const manifest = await createBackup(backupSource(from), target, PASSPHRASE, { appVersion: '0.0.1', kdf: FAST });
    const asText = Buffer.from(archives.get(manifest.archiveName)!).toString('utf8');
    expect(asText).not.toContain('Rozhodnuti');
    expect(asText).not.toContain('abc123');
    expect(asText).not.toContain('LIVE-SESSION');
    // The manifest sits beside it in the clear and must say nothing about the mail either (SC-002).
    expect(JSON.stringify(manifest)).not.toContain('abc123');
  });
});

describe('restoring onto a device that already has messages', () => {
  it('adds what is missing and keeps what the backup never knew about', async () => {
    const from = await populated();
    const { target } = memoryTarget();
    await createBackup(backupSource(from), target, PASSPHRASE, { appVersion: '0.0.1', kdf: FAST });

    const onto = await populated();
    // Arrived after the backup was written - the case that makes an authoritative restore dangerous.
    await onto.messages.cacheList('abc123', 'received', [envelope('3', 'Nova zprava')], 900);

    const [candidate] = await listRestorable(target);
    await restoreBackup(candidate.manifest, target, PASSPHRASE, backupSink(onto, noTransaction));

    const after = await onto.messages.getList('abc123', 'received');
    expect(after.envelopes.map(e => e.id).sort()).toEqual(['1', '2', '3']);
  });
});

describe('deciding before downloading', () => {
  it('does not fetch the archive when the manifest already rules it out', async () => {
    // FR-011. The archive can be gigabytes; the verdict comes from a few hundred bytes.
    const { target, fetches } = memoryTarget();
    const fromTheFuture: BackupManifest = {
      formatVersion: 1,
      schemaVersion: BACKUP_SCHEMA_VERSION + 5,
      appVersion: '9.9.9',
      createdAt: Date.now(),
      tiers: { metadata: true, documents: true },
      sizeBytes: 2_000_000_000,
      archiveName: 'from-the-future.backup',
    };
    await expect(
      restoreBackup(fromTheFuture, target, PASSPHRASE, backupSink(await populated(), noTransaction)),
    ).rejects.toThrow(BackupNotRestorableError);
    expect(fetches()).toBe(0);
  });

  it('still LISTS a backup it cannot read, with the reason', async () => {
    // Hiding it would look like the backup was lost, when the answer is "update the app" - and this
    // is exactly the backup someone is looking for after replacing a phone.
    const { target, manifests } = memoryTarget();
    manifests.push({
      formatVersion: 1,
      schemaVersion: BACKUP_SCHEMA_VERSION + 1,
      appVersion: '9.9.9',
      createdAt: 1,
      tiers: { metadata: true, documents: false },
      sizeBytes: 10,
      archiveName: 'newer.backup',
    });
    const [listed] = await listRestorable(target);
    expect(listed.restorable).toBe(false);
    expect(listed.compatibility.kind).toBe('tooNew');
  });

  it('refuses the wrong passphrase without touching the archive on disk', async () => {
    const from = await populated();
    const { target, archives } = memoryTarget();
    const manifest = await createBackup(backupSource(from), target, PASSPHRASE, { appVersion: '0.0.1', kdf: FAST });
    const before = Buffer.from(archives.get(manifest.archiveName)!);
    await expect(
      restoreBackup(manifest, target, 'WRONG-0000-0000-0000-0000', backupSink(await populated(), noTransaction)),
    ).rejects.toThrow();
    expect(Buffer.from(archives.get(manifest.archiveName)!).equals(before)).toBe(true);
  });
});
