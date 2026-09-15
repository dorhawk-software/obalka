// Which attachments a backup carries, and what it says it carries (026 US1, US2).
//
// Two modes: the attachments already on the phone, or all of them - downloading what is missing first,
// and only in a backup the person asked for. The manifest records which, how many messages were still
// without their attachments, and which stored objects the backup uses, so the list and the phone
// transfer can tell without the password.

import { createBackup, type SyncTarget } from '../../src/services/backup/backupService';
import { BackupController } from '../../src/features/backup/state/backupController';
import { backupSink, backupSource, documentDetails } from '../../src/services/backup/stores';
import { InMemoryAccountsStore } from '../../src/services/db/accountsStore';
import { InMemoryMessagesStore } from '../../src/services/db/messagesStore';
import { InMemoryDraftsStore } from '../../src/services/db/draftsStore';
import { InMemoryRemindersStore } from '../../src/services/db/remindersStore';
import type { BackupManifest } from '../../src/services/backup/schema';
import type { BackupProgress } from '../../src/services/backup/progress';
import type {
  DataBoxAccount,
  MessageDetail,
  MessageEnvelope,
} from '../../src/services/isds/types';

const FAST = { m: 256, t: 1, p: 1 };
const PASSPHRASE = 'FKPX-9WQ2-7TDM-4RJH-2CVB';

const account: DataBoxAccount = {
  id: 'acc_abc123',
  boxId: 'abc123',
  loginName: 'novak',
  label: 'Jan Novak',
  dbType: 'FO',
  alias: null,
  authMethod: 'password',
  host: 'czebox',
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

const envelope = (id: string): MessageEnvelope => ({
  id,
  subject: `Zpráva ${id}`,
  sender: 'Úřad',
  senderAddress: null,
  recipient: null,
  recipientAddress: null,
  recipientBoxId: null,
  deliveryTime: 1_000,
  acceptanceTime: 1_000,
  state: 6,
  attachmentSize: 1,
});

const detail = (id: string, path: string): MessageDetail =>
  ({
    id,
    subject: `Zpráva ${id}`,
    sender: 'Úřad',
    senderAddress: null,
    recipient: null,
    recipientAddress: null,
    deliveryTime: 1_000,
    acceptanceTime: 1_000,
    attachments: [
      { name: 'a.pdf', mimeType: 'application/pdf', metaType: 'main', contentBase64: '', localPath: path, size: 3 },
    ],
  }) as unknown as MessageDetail;

function pieces(bytes: Uint8Array) {
  let done = false;
  return async () => {
    if (done) {
      return null;
    }
    done = true;
    return bytes;
  };
}

/** A phone with three received messages, two of them downloaded - one sent message, downloaded too. */
async function phone() {
  const stores = {
    accounts: new InMemoryAccountsStore(),
    messages: new InMemoryMessagesStore(),
    drafts: new InMemoryDraftsStore(),
    reminders: new InMemoryRemindersStore(),
  };
  await stores.accounts.add(account);
  await stores.messages.cacheList('abc123', 'received', [envelope('1'), envelope('2'), envelope('3')], 1);
  await stores.messages.cacheList('abc123', 'sent', [envelope('9')], 1);
  const disk = new Map<string, Uint8Array>([
    ['/files/1/a.pdf', new Uint8Array([1, 2, 3])],
    ['/files/2/a.pdf', new Uint8Array([4, 5, 6])],
    ['/files/9/a.pdf', new Uint8Array([7, 8, 9])],
  ]);
  await stores.messages.cacheDetail('abc123', detail('1', '/files/1/a.pdf'));
  await stores.messages.cacheDetail('abc123', detail('2', '/files/2/a.pdf'));
  await stores.messages.cacheDetail('abc123', detail('9', '/files/9/a.pdf'));

  const manifests: BackupManifest[] = [];
  const archives = new Map<string, Uint8Array>();
  const objects = new Map<string, Uint8Array>();
  const target: SyncTarget = {
    async listManifests() {
      return [...manifests];
    },
    async putBackup(manifest, archive) {
      manifests.push(manifest);
      archives.set(manifest.archiveName, archive);
    },
    async getArchive(name) {
      return archives.get(name) as Uint8Array;
    },
    async deleteBackup(name) {
      archives.delete(name);
      const at = manifests.findIndex(m => m.archiveName === name);
      if (at >= 0) {
        manifests.splice(at, 1);
      }
    },
    hasObject: async name => objects.has(name),
    putObject: async (name, pull) => {
      const parts: number[] = [];
      for (let piece = await pull(); piece; piece = await pull()) {
        parts.push(...piece);
      }
      objects.set(name, Uint8Array.from(parts));
    },
    getObject: async name => pieces(objects.get(name) ?? new Uint8Array(0)),
  };
  const source = {
    sizeOf: async (p: string) => disk.get(p)?.length ?? null,
    open: async (p: string) => pieces(disk.get(p) ?? new Uint8Array(0)),
  };
  return { stores, target, objects, source, disk };
}

describe('the manifest says which attachments it carries (026 US2)', () => {
  it('records the mode, the objects it uses and - in the all mode - the messages still without them', async () => {
    const { stores, target, objects, source } = await phone();
    const manifest = await createBackup(backupSource(stores), target, PASSPHRASE, {
      appVersion: '1.0.0',
      now: () => 5_000,
      kdf: FAST,
      documents: { source, key: new Uint8Array(32).fill(3), randomBytes: n => new Uint8Array(n).fill(1), mode: 'all' },
    });

    expect(manifest.tiers.documents).toBe(true);
    expect(manifest.documentMode).toBe('all');
    // Message 3 was never downloaded: its attachments are not in this backup.
    expect(manifest.documentsMissing).toBe(1);
    // Received AND sent: three documents, three objects, every one of them listed.
    expect(manifest.documentCount).toBe(3);
    expect(manifest.documentObjects).toEqual([...objects.keys()].sort());
    expect(manifest.documentObjects).toHaveLength(3);
  });

  it('is a downloaded-only backup when no mode is given, and does not count what is missing', async () => {
    const { stores, target, source } = await phone();
    const manifest = await createBackup(backupSource(stores), target, PASSPHRASE, {
      appVersion: '1.0.0',
      kdf: FAST,
      documents: { source, key: new Uint8Array(32).fill(3), randomBytes: n => new Uint8Array(n).fill(1) },
    });
    expect(manifest.documentMode).toBe('downloaded');
    expect(manifest.documentsMissing).toBeUndefined();
  });

  it('says nothing about attachments for a backup without them', async () => {
    const { stores, target } = await phone();
    const manifest = await createBackup(backupSource(stores), target, PASSPHRASE, {
      appVersion: '1.0.0',
      kdf: FAST,
    });
    expect(manifest.tiers.documents).toBe(false);
    expect(manifest.documentMode).toBeUndefined();
    expect(manifest.documentObjects).toBeUndefined();
  });
});

describe('the all mode downloads first, and only when asked (026 US1, FR-006)', () => {
  async function controllerOn(mode: 'downloaded' | 'all') {
    const { stores, target, source, disk } = await phone();
    const settings = new Map<string, string>();
    const calls: string[] = [];
    let secret: string | null = PASSPHRASE;
    const controller = new BackupController({
      source: backupSource(stores),
      sink: backupSink(stores, fn => fn()),
      secret: {
        canProtect: async () => true,
        save: async p => {
          secret = p;
        },
        reveal: async () => secret,
        forUse: async () => secret,
        has: async () => secret != null,
        clear: async () => {
          secret = null;
        },
      },
      target,
      settings: {
        getSetting: async key => settings.get(key) ?? null,
        setSetting: async (key, value) => {
          settings.set(key, value);
        },
      },
      appVersion: '1.0.0',
      kdf: FAST,
      documents: {
        source,
        fs: {
          ensureDir: async () => undefined,
          writeBytes: async (p, b) => {
            disk.set(p, b);
          },
          appendBytes: async () => undefined,
          exists: async p => disk.has(p),
          move: async () => undefined,
          remove: async () => undefined,
        },
        details: documentDetails(stores),
        messageDir: (boxId, messageId) => `/files/${messageId}`,
        randomBytes: n => new Uint8Array(n).fill(2),
      },
      missing: {
        download: async ({ onProgress }) => {
          calls.push('download');
          onProgress?.({ done: 0, total: 2 });
          onProgress?.({ done: 2, total: 2 });
          return { downloaded: 2, failed: 0 };
        },
        estimate: async () => ({ askable: 1, gone: 0 }),
      },
    });
    await controller.setPreferences({ documentMode: mode, documents: true });
    return { controller, calls, settings };
  }

  it('defaults to the attachments already on the phone', async () => {
    const { stores, target } = await phone();
    const settings = new Map<string, string>();
    const controller = new BackupController({
      source: backupSource(stores),
      sink: backupSink(stores, fn => fn()),
      secret: {} as never,
      target,
      settings: {
        getSetting: async key => settings.get(key) ?? null,
        setSetting: async (key, value) => {
          settings.set(key, value);
        },
      },
      appVersion: '1.0.0',
    });
    expect((await controller.preferences()).documentMode).toBe('downloaded');
  });

  it('downloads what is missing before a backup the person asked for, and the bar never runs back', async () => {
    const { controller, calls, settings } = await controllerOn('all');
    expect(settings.get('backup.documentMode')).toBe('all');
    const seen: BackupProgress[] = [];
    const manifest = await controller.backupNow('unlock', p => seen.push(p));

    expect(calls).toEqual(['download']);
    expect(seen[0].stage).toBe('downloading');
    const fractions = seen.map(p => p.fraction);
    expect(fractions).toEqual([...fractions].sort((a, b) => a - b));
    expect(manifest.documentMode).toBe('all');
  });

  it('downloads nothing in the downloaded mode', async () => {
    const { controller, calls } = await controllerOn('downloaded');
    const manifest = await controller.backupNow('unlock');
    expect(calls).toEqual([]);
    expect(manifest.documentMode).toBe('downloaded');
  });

  it('never downloads in an automatic backup, and waits while a download run holds it', async () => {
    jest.useFakeTimers();
    try {
      const { controller, calls } = await controllerOn('all');
      const release = controller.holdAutomatic();
      controller.archiveChanged();
      await jest.advanceTimersByTimeAsync(20_000);
      expect(await controller.list()).toHaveLength(0);

      release();
      await jest.runAllTimersAsync();
      const listed = await controller.list();
      expect(listed).toHaveLength(1);
      expect(listed[0].manifest.documentMode).toBe('all');
      expect(calls).toEqual([]);
    } finally {
      jest.useRealTimers();
    }
  });
});
