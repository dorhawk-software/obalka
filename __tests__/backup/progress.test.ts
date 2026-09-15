// Progress that means something, and a cancel that actually stops (006).
//
// The bar exists because "Pracuji…" told the user nothing. That only holds if the numbers are true:
// the message count has to be the number of messages, the fraction must never go backwards, and the
// run has to end when someone says stop - leaving nothing half-written behind it.

import { InMemoryAccountsStore } from '../../src/services/db/accountsStore';
import { InMemoryMessagesStore } from '../../src/services/db/messagesStore';
import { InMemoryDraftsStore } from '../../src/services/db/draftsStore';
import { InMemoryRemindersStore } from '../../src/services/db/remindersStore';
import { backupSink, backupSource } from '../../src/services/backup/stores';
import {
  createBackup,
  restoreBackup,
  type SyncTarget,
} from '../../src/services/backup/backupService';
import {
  BackupAbortedError,
  type BackupProgress,
} from '../../src/services/backup/progress';
import { seal } from '../../src/services/backup/envelope';
import { encodeUtf8 } from '../../src/services/text/textCodec';
import type { BackupManifest } from '../../src/services/backup/schema';
import { MESSAGE_STATE } from '../../src/features/messages/state/messageState';
import type { DataBoxAccount, MessageEnvelope } from '../../src/services/isds/types';

const PASSPHRASE = 'FKPX-9WQ2-7TDM-4RJH-2CVB';
const FAST = { m: 256, t: 1, p: 1 };
const MESSAGES = 7;

const account: DataBoxAccount = {
  id: 'acc_abc123',
  boxId: 'abc123',
  loginName: 'novak',
  label: 'Jan Novák',
  dbType: 'FO',
  alias: null,
  authMethod: 'password',
  host: 'production',
  secretRef: 'ref',
  sessionValidUntil: null,
  passwordExpiresAt: null,
  lastSyncedAt: null,
  messageCount: null,
  unreadCount: null,
  pdzCreditCzk: null,
  syncError: null,
  createdAt: 1,
  updatedAt: 1,
};

const envelope = (n: number): MessageEnvelope => ({
  id: `msg${n}`,
  subject: `Zpráva ${n}`,
  sender: 'Úřad',
  senderAddress: null,
  recipient: null,
  recipientAddress: null,
  recipientBoxId: null,
  deliveryTime: 1000 + n,
  acceptanceTime: 2000 + n,
  state: MESSAGE_STATE.read,
  attachmentSize: null,
});

async function archive() {
  const stores = {
    accounts: new InMemoryAccountsStore(),
    messages: new InMemoryMessagesStore(),
    drafts: new InMemoryDraftsStore(),
    reminders: new InMemoryRemindersStore(),
  };
  await stores.accounts.add(account);
  await stores.messages.cacheList(
    'abc123',
    'received',
    Array.from({ length: MESSAGES }, (_, i) => envelope(i)),
    500,
  );
  return stores;
}

function memoryTarget(): SyncTarget & { archives: Map<string, Uint8Array> } {
  const manifests: BackupManifest[] = [];
  return {
    archives: new Map(),
    async listManifests() {
      return [...manifests];
    },
    async putBackup(manifest, bytes) {
      manifests.push(manifest);
      this.archives.set(manifest.archiveName, bytes);
    },
    async getArchive(name) {
      const found = this.archives.get(name);
      if (!found) {
        throw new Error(`missing ${name}`);
      }
      return found;
    },
    async deleteBackup(name) {
      this.archives.delete(name);
    },
  };
}

describe('backup progress', () => {
  it('counts the messages it actually reads, and says which box', async () => {
    const stores = await archive();
    const seen: BackupProgress[] = [];

    await createBackup(backupSource(stores), memoryTarget(), PASSPHRASE, {
      appVersion: '1.4.0',
      kdf: FAST,
      onProgress: p => seen.push({ ...p }),
    });

    const reading = seen.filter(p => p.stage === 'reading');
    // Not "about seven": the total IS the number of messages in the archive, and the last count
    // reaches it. A bar whose total is a guess is a bar that finishes at 94%.
    expect(reading.every(p => p.total === MESSAGES)).toBe(true);
    expect(reading.at(-1)?.done).toBe(MESSAGES);
    expect(reading.at(-1)?.detail).toBe('Jan Novák');
  });

  it('passes through every stage, in order, and ends at 1', async () => {
    const stores = await archive();
    const seen: BackupProgress[] = [];

    await createBackup(backupSource(stores), memoryTarget(), PASSPHRASE, {
      appVersion: '1.4.0',
      kdf: FAST,
      onProgress: p => seen.push({ ...p }),
    });

    const stages = seen.map(p => p.stage);
    expect(stages.indexOf('reading')).toBeLessThan(stages.indexOf('sealing'));
    expect(stages.indexOf('sealing')).toBeLessThan(stages.indexOf('writing'));
    expect(seen.at(-1)?.fraction).toBe(1);
  });

  it('never goes backwards', async () => {
    const stores = await archive();
    const fractions: number[] = [];

    await createBackup(backupSource(stores), memoryTarget(), PASSPHRASE, {
      appVersion: '1.4.0',
      kdf: FAST,
      onProgress: p => fractions.push(p.fraction),
    });

    // A bar that jumps back reads as a failure even when the work is fine.
    for (let i = 1; i < fractions.length; i++) {
      expect(fractions[i]).toBeGreaterThanOrEqual(fractions[i - 1]);
    }
  });

  it('reports the restore in rows written, not in vibes', async () => {
    const source = await archive();
    const target = memoryTarget();
    const manifest = await createBackup(backupSource(source), target, PASSPHRASE, {
      appVersion: '1.4.0',
      kdf: FAST,
    });

    const empty = {
      accounts: new InMemoryAccountsStore(),
      messages: new InMemoryMessagesStore(),
      drafts: new InMemoryDraftsStore(),
      reminders: new InMemoryRemindersStore(),
    };
    const seen: BackupProgress[] = [];
    await restoreBackup(
      manifest,
      target,
      PASSPHRASE,
      backupSink(empty, fn => fn()),
      p => seen.push({ ...p }),
    );

    const restoring = seen.filter(p => p.stage === 'restoring');
    // one account + seven messages + the settings rows the archive happens to hold
    expect(restoring.at(-1)?.done).toBe(restoring.at(-1)?.total);
    expect(restoring.at(-1)?.total).toBeGreaterThanOrEqual(MESSAGES + 1);
  });
});

describe('cancelling', () => {
  it('stops a backup and writes nothing', async () => {
    const stores = await archive();
    const target = memoryTarget();
    const signal = { cancelled: false };

    await expect(
      createBackup(backupSource(stores), target, PASSPHRASE, {
        appVersion: '1.4.0',
        kdf: FAST,
        signal,
        // Cancel as soon as the first message is read - mid-work, which is when a user actually hits it.
        onProgress: p => {
          if (p.stage === 'reading' && p.done >= 1) {
            signal.cancelled = true;
          }
        },
      }),
    ).rejects.toBeInstanceOf(BackupAbortedError);

    // The important half: an aborted backup leaves NO archive, not a truncated one.
    expect(target.archives.size).toBe(0);
    expect(await target.listManifests()).toEqual([]);
  });

  it('stops DURING the KDF, which is where the wait actually is', async () => {
    const stores = await archive();
    const target = memoryTarget();
    const signal = { cancelled: false };
    let sealingTicks = 0;

    await expect(
      createBackup(backupSource(stores), target, PASSPHRASE, {
        appVersion: '1.4.0',
        // Enough passes that an uncancelled derivation would report progress many times over.
        kdf: { m: 8192, t: 4, p: 1 },
        signal,
        onProgress: p => {
          if (p.stage === 'sealing') {
            sealingTicks++;
            signal.cancelled = true;
          }
        },
      }),
    ).rejects.toBeInstanceOf(BackupAbortedError);

    // ONE tick. More would mean the derivation ran to completion and the abort only landed after it
    // - the user would have watched the longest step finish before their cancel took effect.
    expect(sealingTicks).toBe(1);
    expect(target.archives.size).toBe(0);
  });

  it('stops a restore and rolls the transaction back', async () => {
    const source = await archive();
    const target = memoryTarget();
    const manifest = await createBackup(backupSource(source), target, PASSPHRASE, {
      appVersion: '1.4.0',
      kdf: FAST,
    });

    const empty = {
      accounts: new InMemoryAccountsStore(),
      messages: new InMemoryMessagesStore(),
      drafts: new InMemoryDraftsStore(),
      reminders: new InMemoryRemindersStore(),
    };
    const signal = { cancelled: false };
    let rolledBack = false;
    const transaction = async <T,>(fn: () => Promise<T>): Promise<T> => {
      try {
        return await fn();
      } catch (err) {
        rolledBack = true; // stands in for the SQLite ROLLBACK the real sink issues
        throw err;
      }
    };

    await expect(
      restoreBackup(
        manifest,
        target,
        PASSPHRASE,
        backupSink(empty, transaction),
        p => {
          if (p.stage === 'restoring' && p.done >= 1) {
            signal.cancelled = true;
          }
        },
        signal,
      ),
    ).rejects.toBeInstanceOf(BackupAbortedError);

    expect(rolledBack).toBe(true);
  });
});

describe('the JS thread', () => {
  it('keeps running while the key is derived', async () => {
    // The point of `argon2idAsync`. Argon2id at any real cost is seconds of solid arithmetic; run
    // synchronously it holds the thread for all of them and NOTHING in the app responds - no bar
    // moves, no button answers, and the progress this whole feature adds would be a still picture.
    //
    // So: schedule a timer, derive a key, and check the timer got to run. It cannot, if the
    // derivation blocks.
    let ticks = 0;
    const timer = setInterval(() => {
      ticks++;
    }, 1);
    try {
      await seal(encodeUtf8('{"messages":[]}'), PASSPHRASE, { m: 4096, t: 2, p: 1 });
    } finally {
      clearInterval(timer);
    }
    expect(ticks).toBeGreaterThan(0);
  });
});
