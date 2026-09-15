// Moving an archive between phones (025 T011/T012/T013).
//
// The transport is faked, deliberately and completely. What is worth testing is not whether croc
// moves bytes - it does, and the spike proved it on real hosts - but the ORDER things happen in,
// because that is where an archive gets destroyed: read the manifest before trusting the payload,
// show the user what is coming before writing any of it, and never grow a second restore path.

import { TransferController } from '../../src/features/transfer/state/transferController';
import type {
  ArchiveRuns,
  RestoredKeyStores,
} from '../../src/features/backup/state/backupController';
import {
  TRANSFER_BACKUP_FILE,
  TRANSFER_KEY_FILE,
  TransferBusyError,
  TransferBackupGoneError,
  TransferCancelledError,
  TransferRunningError,
  TransferUnavailableError,
  type Transport,
} from '../../src/services/transfer/transport';
import { packPortable, unpackPortable } from '../../src/services/backup/portable';
import { encodeUtf8 } from '../../src/services/text/textCodec';
import { seal, FORMAT_VERSION } from '../../src/services/backup/envelope';
import {
  buildPayload,
  encodePayload,
  type BackupSource,
} from '../../src/services/backup/snapshot';
import {
  BACKUP_SCHEMA_VERSION,
  type BackupManifest,
  type BackupMessage,
} from '../../src/services/backup/schema';
import type { DocumentRestore, SyncTarget } from '../../src/services/backup/backupService';
import type { BackupSink } from '../../src/services/backup/restore';
import {
  backupDocuments,
  encodeDocumentKey,
  type DocumentFs,
  type DocumentSource,
} from '../../src/services/backup/documents';
import type { MessageFolder } from '../../src/services/db/messagesStore';
import type { MessageDetail } from '../../src/services/isds/types';
import { InMemoryAccountsStore } from '../../src/services/db/accountsStore';
import { InMemoryMessagesStore } from '../../src/services/db/messagesStore';
import { InMemoryDraftsStore } from '../../src/services/db/draftsStore';
import { InMemoryRemindersStore } from '../../src/services/db/remindersStore';
import {
  backupSink,
  documentDetails,
  type BackupStores,
} from '../../src/services/backup/stores';
import { BackupPromptDeclinedError } from '../../src/services/backup/backupSecret';
import * as telemetry from '../../src/services/telemetry/telemetry';

const FAST = { m: 256, t: 1, p: 1 };
const KEY = 'FKPX-9WQ2-7TDM-4RJH-2CVB';
/** What the screen hands `apply` besides the key. */
const APPLY = { promptTitle: 'Uložit heslo k záloze' };
const PHRASE = '7K2M-ryba-kotva-duha-lampa';

const manifest = (over: Partial<BackupManifest> = {}): BackupManifest => ({
  formatVersion: FORMAT_VERSION,
  schemaVersion: BACKUP_SCHEMA_VERSION,
  appVersion: '1.4.0',
  createdAt: 1_000,
  tiers: { metadata: true, documents: false },
  sizeBytes: 1024,
  archiveName: 'obalka-1000.backup',
  ...over,
});

/** A backup with Tier 2 whose manifest lists the objects it uses (026 FR-002). */
const docManifest = (over: Partial<BackupManifest> = {}): BackupManifest =>
  manifest({
    tiers: { metadata: true, documents: true },
    documentMode: 'downloaded',
    documentObjects: ['doc-aaaa', 'doc-bbbb', 'doc-empty'],
    ...over,
  });

/** A real sealed archive, so the restore path is exercised rather than mocked around. */
async function sealedArchive() {
  const payload = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    accounts: [
      {
        boxId: 'abc123',
        loginName: 'novak',
        label: 'Jan Novak',
        alias: null,
        dbType: 'FO',
        authMethod: 'password',
        host: 'czebox',
        passwordExpiresAt: null,
        createdAt: 1,
      },
    ],
    messages: [],
    drafts: [],
    reminders: [],
    settings: {},
    documents: [],
    documentKey: null,
  };
  return seal(await encodePayload(payload as never), KEY, FAST);
}

/**
 * A sealed archive and a manifest that AGREES with it.
 *
 * `packPortable` checks that `sizeBytes` matches the archive it frames, which is a real property of
 * the format worth keeping - so the fixtures have to build the manifest from the archive rather than
 * assert a round number and hope.
 */
async function bundle(over: Partial<BackupManifest> = {}) {
  const archive = await sealedArchive();
  const m = manifest({ sizeBytes: archive.length, ...over });
  return { archive, manifest: m, bytes: packPortable(m, archive) };
}

/** How much `open` hands out per call, kept small so a document of any size takes several. */
const SLICE = 64;

function memoryFs() {
  const files = new Map<string, Uint8Array>();
  const dirs = new Set<string>();
  /** Every path read WHOLE. A document read that way is what the slice reader replaced. */
  const wholeReads: string[] = [];
  /** The largest single piece written or appended to each path. */
  const largestWrite = new Map<string, number>();
  const wrote = (p: string, b: Uint8Array) =>
    largestWrite.set(p, Math.max(largestWrite.get(p) ?? 0, b.length));
  return {
    files,
    dirs,
    wholeReads,
    largestWrite,
    fs: {
      ensureDir: async (p: string) => {
        dirs.add(p);
      },
      list: async (p: string) => {
        if (!dirs.has(p)) {
          throw new Error(`no such directory: ${p}`);
        }
        return [...files.keys()]
          .filter(k => k.startsWith(`${p}/`))
          .map(k => k.slice(p.length + 1));
      },
      readBytes: async (p: string) => {
        wholeReads.push(p);
        const v = files.get(p);
        if (!v) {
          throw new Error(`no such file: ${p}`);
        }
        return v;
      },
      open: async (p: string) => {
        const v = files.get(p);
        if (!v) {
          throw new Error(`no such file: ${p}`);
        }
        let at = 0;
        return async () => {
          if (at >= v.length) {
            return null;
          }
          const piece = v.slice(at, at + SLICE);
          at += piece.length;
          return piece;
        };
      },
      writeBytes: async (p: string, b: Uint8Array) => {
        wrote(p, b);
        files.set(p, b.slice());
      },
      // The two a document restore needs on top: a file written a piece at a time, then moved into
      // place once it has verified.
      appendBytes: async (p: string, b: Uint8Array) => {
        wrote(p, b);
        const head = files.get(p) ?? new Uint8Array(0);
        const out = new Uint8Array(head.length + b.length);
        out.set(head, 0);
        out.set(b, head.length);
        files.set(p, out);
      },
      exists: async (p: string) => files.has(p),
      move: async (from: string, to: string) => {
        const v = files.get(from);
        if (!v) {
          throw new Error(`no such file: ${from}`);
        }
        files.set(to, v);
        files.delete(from);
      },
      remove: async (p: string) => {
        files.delete(p);
        dirs.delete(p);
      },
    },
  };
}

/**
 * The one run directory staged under `/work/<box>` right now. Every offer and every receive stages into
 * a directory of its own (025 review, 2026-09-15), so a test that looks at what was staged asks here.
 */
function runDirIn(store: ReturnType<typeof memoryFs>, box: 'in' | 'out'): string {
  const dirs = new Set(
    [...store.files.keys()]
      .filter(k => k.startsWith(`/work/${box}/`))
      .map(k => k.split('/').slice(0, 4).join('/')),
  );
  expect(dirs.size).toBe(1);
  return [...dirs][0];
}

/** A transport that records what it was asked to do and plants whatever the test wants received. */
function fakeTransport(plant: (dir: string, fs: ReturnType<typeof memoryFs>) => Promise<void>) {
  const calls: string[] = [];
  let failWith: Error | null = null;
  let hanging = false;
  let store: ReturnType<typeof memoryFs> | null = null;
  const transport: Transport & {
    calls: string[];
    fail(e: Error): void;
    hang(): void;
    bind(s: ReturnType<typeof memoryFs>): void;
    isAvailable: boolean;
  } = {
    calls,
    isAvailable: true,
    fail(e) {
      failWith = e;
    },
    /**
     * A send NOBODY EVER TAKES UP.
     *
     * The default `send` resolves immediately, which quietly made two tests measure the wrong thing:
     * the cleanup hanging off `done` had already run by the time they called `abandon`, so they
     * passed whether or not `abandon` did anything. Mutating `sweepStale` to sweep the wrong
     * directory left them green, which is how this was found. A real offer sits here until somebody
     * connects, and nothing about that is guaranteed to happen.
     */
    hang() {
      hanging = true;
    },
    bind(s) {
      store = s;
    },
    available: () => transport.isAvailable,
    async send(dir, options) {
      calls.push(`send:${dir}:${options.secret}:local=${options.onlyLocal}`);
      if (failWith) {
        throw failWith;
      }
      if (hanging) {
        await new Promise<void>(() => {});
      }
    },
    async receive(dir, options) {
      calls.push(`receive:${dir}:${options.secret}:local=${options.onlyLocal}`);
      if (failWith) {
        throw failWith;
      }
      await plant(dir, store as ReturnType<typeof memoryFs>);
      return (await (store as ReturnType<typeof memoryFs>).fs.list(dir)) as string[];
    },
    cancel() {
      calls.push('cancel');
    },
    keepScreenOn(on) {
      calls.push(`keepScreenOn:${on}`);
    },
  };
  return transport;
}

function build(
  plant: (dir: string, fs: ReturnType<typeof memoryFs>) => Promise<void> = async () => {},
  over: {
    recoveryKey?: () => Promise<string | null>;
    onlyLocal?: boolean;
    backupDir?: string;
    source?: Pick<BackupSource, 'listAccounts' | 'listEnvelopes'>;
    /** Wire the document restore, writing each message's files under this directory. */
    documentsTo?: string;
    /** Tier 2 on the receiving phone, built over the same stores the restore writes into. */
    documents?: (stores: BackupStores) => DocumentRestore;
    /** Where the keys that arrive are kept. */
    keys?: RestoredKeyStores;
    /** The backup controller's run tracking, which a save goes through. */
    runs?: ArchiveRuns;
    /** The restore's transaction, so a test can hold a save part-way through. */
    transaction?: BackupSink['transaction'];
    /** The cache directory an earlier controller used: the next process of the app, say. */
    store?: ReturnType<typeof memoryFs>;
    /**
     * What this phone's backup store lists, when a test needs more than an archive by name - asked
     * afresh on every listing when it is a function.
     */
    manifests?: BackupManifest[] | (() => BackupManifest[]);
  } = {},
) {
  const store = over.store ?? memoryFs();
  const transport = fakeTransport(plant);
  transport.bind(store);
  const archives = new Map<string, Uint8Array>();
  const target: SyncTarget = {
    listManifests: async () =>
      typeof over.manifests === 'function' ? over.manifests() : over.manifests ?? [],
    putBackup: async () => {},
    getArchive: async name => {
      const a = archives.get(name);
      if (!a) {
        throw new Error(`missing ${name}`);
      }
      return a;
    },
    deleteBackup: async () => {},
  };
  const stores = {
    accounts: new InMemoryAccountsStore(),
    messages: new InMemoryMessagesStore(),
    drafts: new InMemoryDraftsStore(),
    reminders: new InMemoryRemindersStore(),
  };
  const sink: BackupSink = backupSink(stores, over.transaction ?? (fn => fn()));
  const controller = new TransferController({
    transport,
    fs: store.fs,
    workDir: '/work',
    target,
    sink,
    recoveryKey: over.recoveryKey ?? (async () => KEY),
    onlyLocal: over.onlyLocal,
    backupDir: over.backupDir,
    source: over.source,
    keys: over.keys,
    runs: over.runs,
    // The same stores the sink writes to, which is what the real wiring does: the documents are
    // attached to the messages the restore has just committed.
    documents:
      over.documents?.(stores) ??
      (over.documentsTo
      ? {
          fs: store.fs,
          details: documentDetails(stores),
          messageDir: (boxId, messageId) => `${over.documentsTo}/${boxId}/${messageId}`,
        }
      : undefined),
  });
  return { controller, transport, store, archives, stores, sink };
}

/** An archive with these boxes, each holding this many received and sent messages. */
function archiveOf(boxes: Record<string, { received: number; sent: number }>): BackupSource {
  const envelope = (boxId: string, folder: MessageFolder, i: number) =>
    ({ boxId, messageId: `${folder}-${i}`, folder }) as BackupMessage;
  return {
    listAccounts: async () =>
      Object.keys(boxes).map(boxId => ({
        boxId,
        loginName: boxId,
        label: null,
        alias: null,
        dbType: 'FO',
        authMethod: 'password',
        host: 'czebox',
        passwordExpiresAt: null,
        createdAt: 1,
      })),
    listEnvelopes: async (boxId, folder) =>
      Array.from({ length: boxes[boxId][folder] }, (_, i) => envelope(boxId, folder, i)),
    messageDetail: async () => null,
    listDrafts: async () => [],
    listReminders: async () => [],
    allSettings: async () => ({}),
  };
}

describe('offering a transfer', () => {
  it('shows the phrase and the size BEFORE anything moves', async () => {
    // FR-008. A transfer whose size appears afterwards is a transfer nobody agreed to.
    const { controller, archives } = build();
    const archive = await sealedArchive();
    archives.set('obalka-1000.backup', archive);

    const offer = await controller.offer(manifest({ sizeBytes: archive.length }));
    expect(offer.phrase).toMatch(/^[0-9A-Z]{4}(-[a-z]+){4}$/);
    expect(offer.sizeBytes).toBeGreaterThan(archive.length);
    await offer.done;
  });

  it('sends the backup that was chosen, even when a newer one exists (026 FR-007)', async () => {
    // Until 026 the newest backup went, whichever the screen had named. Which backup travels is the
    // person's choice now.
    const archive = await sealedArchive();
    const chosen = manifest({ createdAt: 1_000, archiveName: 'obalka-1000.backup', sizeBytes: archive.length });
    const newer = manifest({ createdAt: 2_000, archiveName: 'obalka-2000.backup' });
    const { controller, archives, store } = build(undefined, { manifests: [chosen, newer] });
    archives.set(chosen.archiveName, archive);
    archives.set(newer.archiveName, new Uint8Array([1]));

    const offer = await controller.offer(chosen);
    const sent = unpackPortable(
      await store.fs.readBytes(`${runDirIn(store, 'out')}/${TRANSFER_BACKUP_FILE}`),
    );
    await offer.done;

    expect(sent.manifest.archiveName).toBe(chosen.archiveName);
    expect(Buffer.from(sent.archive).equals(Buffer.from(archive))).toBe(true);
  });

  it('refuses, rather than sending another, when the chosen backup was deleted (026 FR-007)', async () => {
    const chosen = manifest({ createdAt: 1_000, archiveName: 'obalka-1000.backup' });
    const newer = manifest({ createdAt: 2_000, archiveName: 'obalka-2000.backup' });
    const { controller, archives, transport } = build(undefined, { manifests: [newer] });
    archives.set(newer.archiveName, await sealedArchive());

    await expect(controller.offer(chosen)).rejects.toBeInstanceOf(TransferBackupGoneError);
    expect(transport.calls).toEqual([]);
  });

  it('sends the sealed archive and the recovery key, and nothing else', async () => {
    const { controller, archives, store } = build();
    const a1 = await sealedArchive();
    archives.set('obalka-1000.backup', a1);

    let staged: string[] = [];
    const offer = await controller.offer(manifest({ sizeBytes: a1.length }));
    staged = await store.fs.list(runDirIn(store, 'out'));
    await offer.done;

    expect(staged.sort()).toEqual([TRANSFER_BACKUP_FILE, TRANSFER_KEY_FILE].sort());
  });

  it('hands the transport a PATH, never the bytes', async () => {
    // FR-001 is enforced by the signature, and this is the test that says so out loud: there is no
    // call shape here that could carry a payload or a passphrase.
    const { controller, archives, transport } = build();
    const a = await sealedArchive();
    archives.set('obalka-1000.backup', a);
    const offer = await controller.offer(manifest({ sizeBytes: a.length }));
    await offer.done;
    expect(transport.calls[0]).toMatch(/^send:\/work\/out\/[^/:]+:/);
  });

  it('sends without a key when this phone has none', async () => {
    // A phone that restored from a file may hold an archive and no key. Better to send what there
    // is than to refuse - the far side can still be told the key by hand.
    const { controller, archives, store } = build(undefined, {
      recoveryKey: async () => null,
    });
    const a = await sealedArchive();
    archives.set('obalka-1000.backup', a);
    const offer = await controller.offer(manifest({ sizeBytes: a.length }));
    const staged = await store.fs.list(runDirIn(store, 'out'));
    await offer.done;
    expect(staged).toEqual([TRANSFER_BACKUP_FILE]);
  });

  it('passes the local-only choice through rather than deciding for itself', async () => {
    const { controller, archives, transport } = build(undefined, { onlyLocal: true });
    const a = await sealedArchive();
    archives.set('obalka-1000.backup', a);
    await (await controller.offer(manifest({ sizeBytes: a.length }))).done;
    expect(transport.calls[0]).toContain('local=true');
  });

  it('sweeps what it staged once the transfer ends', async () => {
    const { controller, archives, store } = build();
    const a = await sealedArchive();
    archives.set('obalka-1000.backup', a);
    const offer = await controller.offer(manifest({ sizeBytes: a.length }));
    await offer.done;
    expect([...store.files.keys()].filter(k => k.startsWith('/work/out'))).toEqual([]);
  });

  it('clears an abandoned offer BEFORE staging the next one', async () => {
    // The walk found 7 MB of sealed archive sitting in the cache from a transfer nobody ever took
    // up: `done` never settled, so the cleanup hanging off it never ran. Sweeping on the way IN is
    // what bounds that however the previous attempt ended.
    const { controller, archives, store } = build();
    const a = await sealedArchive();
    archives.set('obalka-1000.backup', a);
    await store.fs.ensureDir('/work/out');
    await store.fs.writeBytes('/work/out/doc-leftover', new Uint8Array(999));

    const offer = await controller.offer(manifest({ sizeBytes: a.length }));
    const staged = await store.fs.list('/work/out');
    await offer.done;
    expect(staged).not.toContain('doc-leftover');
  });

  it('lets go of an offer the user walked away from', async () => {
    const { controller, archives, store, transport } = build();
    const a = await sealedArchive();
    archives.set('obalka-1000.backup', a);
    // A send nobody takes up: `done` never settles, so only `abandon` can clean this. The transport
    // has to be told to hang for that to be true - see `hang()`.
    transport.hang();
    void (await controller.offer(manifest({ sizeBytes: a.length }))).done.catch(
      () => undefined,
    );
    expect(store.files.has(`${runDirIn(store, 'out')}/recovery.key`)).toBe(true);
    await controller.abandon();
    expect([...store.files.keys()].filter(k => k.startsWith('/work/out'))).toEqual([]);
  });

  it('clears what a KILLED run left staged, including the recovery key', async () => {
    // Walked on the device 2026-09-13: a send waiting for a receiver, force-stopped, left 6.9 MB of
    // sealed archive AND `recovery.key` in the cache - and relaunching the app did not touch them.
    // `abandon` covers walking away and `offer` covers the next transfer; neither covers the process
    // simply ending, which Android does without asking.
    //
    // The key is the half that matters. It opens the whole backup, it lives in the Keystore, and it
    // is on disk only for the seconds a transfer needs it - so a kill turned "seconds" into
    // "indefinitely", which is a different security property than the one this was designed with.
    const { controller, archives, store, transport } = build();
    const a = await sealedArchive();
    archives.set('obalka-1000.backup', a);
    transport.hang();
    void (await controller.offer(manifest({ sizeBytes: a.length }))).done.catch(
      () => undefined,
    );
    // Exactly what the device showed: the archive, the documents and the key, with nobody connected.
    expect(store.files.has(`${runDirIn(store, 'out')}/recovery.key`)).toBe(true);

    // The next process of the app, over the same cache directory, with nothing of its own in flight.
    await build(undefined, { store }).controller.sweepStale();

    expect([...store.files.keys()].filter(k => k.startsWith('/work'))).toEqual([]);
  });

  it('is safe to sweep at start-up when nothing was ever staged', async () => {
    // It runs on every launch, including the first one on a phone that has never transferred - so a
    // missing directory has to be the desired state rather than an error on the way into the app.
    const { controller } = build();
    await expect(controller.sweepStale()).resolves.toBeUndefined();
  });

  it('sweeps even when the transfer fails', async () => {
    const { controller, archives, store, transport } = build();
    const a = await sealedArchive();
    archives.set('obalka-1000.backup', a);
    transport.fail(new Error('the other phone went away'));
    const offer = await controller.offer(manifest({ sizeBytes: a.length }));
    await expect(offer.done).rejects.toThrow('went away');
    expect([...store.files.keys()].filter(k => k.startsWith('/work/out'))).toEqual([]);
  });
});

describe('carrying the documents too (T014)', () => {
  it('sends this phone s Tier 2 objects beside the archive', async () => {
    const { controller, archives, store } = build(undefined, { backupDir: '/backups' });
    const a = await sealedArchive();
    archives.set('obalka-1000.backup', a);
    await store.fs.ensureDir('/backups');
    await store.fs.writeBytes('/backups/doc-aaaa', new Uint8Array([1, 2, 3]));
    await store.fs.writeBytes('/backups/doc-bbbb', new Uint8Array([4, 5]));
    // Not a document, and must not travel: it is another backup's archive.
    await store.fs.writeBytes('/backups/obalka-9.backup', new Uint8Array([9]));

    const offer = await controller.offer(docManifest({ sizeBytes: a.length }));
    const staged = (await store.fs.list(runDirIn(store, 'out'))).sort();
    await offer.done;

    expect(staged).toEqual(
      [TRANSFER_BACKUP_FILE, TRANSFER_KEY_FILE, 'doc-aaaa', 'doc-bbbb'].sort(),
    );
  });

  it('states the size of what MOVES, not what the bundle weighs', async () => {
    // The walk caught this saying "15 kB" while 6.9 MB of documents went across behind it. A number
    // 469 times too small is worse than no number, and FR-008 exists to stop exactly that.
    const { controller, archives, store } = build(undefined, { backupDir: '/backups' });
    const a = await sealedArchive();
    archives.set('obalka-1000.backup', a);
    await store.fs.ensureDir('/backups');
    await store.fs.writeBytes('/backups/doc-aaaa', new Uint8Array(4000));
    await store.fs.writeBytes('/backups/doc-bbbb', new Uint8Array(6000));

    const offer = await controller.offer(docManifest({ sizeBytes: a.length }));
    await offer.done;
    const bundle_ = packPortable(docManifest({ sizeBytes: a.length }), a);
    expect(offer.sizeBytes).toBe(bundle_.length + 10000);
  });

  it('says it is PREPARING before a phrase exists, not that it is waiting', async () => {
    // The other phone cannot be waited for until there is something to type into it. The walk
    // measured 25 seconds of the old message, which claimed otherwise the whole time.
    const { controller, archives, store } = build(undefined, { backupDir: '/backups' });
    const a = await sealedArchive();
    archives.set('obalka-1000.backup', a);
    await store.fs.ensureDir('/backups');
    await store.fs.writeBytes('/backups/doc-aaaa', new Uint8Array(10));

    const stages: string[] = [];
    const offer = await controller.offer(docManifest({ sizeBytes: a.length }), p =>
      stages.push(p.stage),
    );
    await offer.done;
    expect(stages[0]).toBe('preparing');
    // And it counts the documents as it goes, rather than sitting on one frozen line.
    expect(stages.filter(x => x === 'preparing').length).toBeGreaterThan(1);
  });

  it('sends only the objects its manifest lists, and none for a backup without documents (026)', async () => {
    const { controller, archives, store } = build(undefined, { backupDir: '/backups' });
    const a = await sealedArchive();
    archives.set('obalka-1000.backup', a);
    await store.fs.ensureDir('/backups');
    await store.fs.writeBytes('/backups/doc-aaaa', new Uint8Array([1]));
    await store.fs.writeBytes('/backups/doc-later', new Uint8Array([2]));

    const offer = await controller.offer(
      docManifest({ sizeBytes: a.length, documentObjects: ['doc-aaaa'] }),
    );
    const staged = (await store.fs.list(runDirIn(store, 'out'))).sort();
    await offer.done;
    expect(staged).toEqual([TRANSFER_BACKUP_FILE, TRANSFER_KEY_FILE, 'doc-aaaa'].sort());

    const bare = await controller.offer(manifest({ sizeBytes: a.length }));
    const stagedBare = (await store.fs.list(runDirIn(store, 'out'))).sort();
    await bare.done;
    expect(stagedBare).toEqual([TRANSFER_BACKUP_FILE, TRANSFER_KEY_FILE].sort());
  });

  it('carries on when this phone has no documents at all', async () => {
    const { controller, archives, store } = build(undefined, { backupDir: '/backups' });
    const a = await sealedArchive();
    archives.set('obalka-1000.backup', a);
    const offer = await controller.offer(docManifest({ sizeBytes: a.length }));
    await offer.done;
    expect(await store.fs.list('/work/out').catch(() => [])).toEqual([]);
  });

  it('counts what arrived, so the receiver can say', async () => {
    const { controller, store } = build(async (dir, s2) => {
      const b = await bundle();
      await s2.fs.writeBytes(`${dir}/${TRANSFER_BACKUP_FILE}`, b.bytes);
      await s2.fs.writeBytes(`${dir}/doc-aaaa`, new Uint8Array([1]));
      await s2.fs.writeBytes(`${dir}/doc-bbbb`, new Uint8Array([2]));
    });
    const got = await controller.receive('7K2M-ryba-kotva-duha-lampa');
    expect(got.documents).toBe(2);
    await controller.dispose(got);
    expect([...store.files.keys()].filter(k => k.startsWith('/work/in'))).toEqual([]);
  });
});

describe('never holding a document whole (025 review, 2026-09-15)', () => {
  it('copies each document into the outgoing directory a slice at a time', async () => {
    // It was `readBytes` then `writeBytes`: every document in the JS heap at once, and one of them
    // can be a 100 MB large-volume attachment or a signed original larger still.
    const { controller, archives, store, transport } = build(undefined, { backupDir: '/backups' });
    const a = await sealedArchive();
    archives.set('obalka-1000.backup', a);
    const big = new Uint8Array(1000).map((_, i) => (i * 13) % 251);
    await store.fs.ensureDir('/backups');
    await store.fs.writeBytes('/backups/doc-aaaa', big);
    await store.fs.writeBytes('/backups/doc-empty', new Uint8Array(0));
    // Nobody takes the send up, so what was staged is still there to be looked at.
    transport.hang();

    const offer = await controller.offer(docManifest({ sizeBytes: a.length }));
    void offer.done.catch(() => undefined);

    const staged = runDirIn(store, 'out');
    expect(Array.from(store.files.get(`${staged}/doc-aaaa`) ?? [])).toEqual(Array.from(big));
    expect(store.files.get(`${staged}/doc-empty`)).toEqual(new Uint8Array(0));
    expect(offer.sizeBytes).toBe(packPortable(docManifest({ sizeBytes: a.length }), a).length + 1000);
    expect(store.wholeReads.filter(p => p.includes('/doc-'))).toEqual([]);
    expect(store.largestWrite.get(`${staged}/doc-aaaa`)).toBeLessThanOrEqual(SLICE);
  });

  it('stops part-way through a large document when the transfer is stopped', async () => {
    // Between files was the only place a stop landed, so a large document went on copying for nobody
    // after the app had left the foreground (FR-014).
    const { controller, archives, store, transport } = build(undefined, { backupDir: '/backups' });
    const a = await sealedArchive();
    archives.set('obalka-1000.backup', a);
    await store.fs.ensureDir('/backups');
    await store.fs.writeBytes('/backups/doc-aaaa', new Uint8Array(1000).fill(7));
    const signal = { cancelled: false };
    let copied = 0;
    const write = store.fs.writeBytes;
    store.fs.writeBytes = async (p, b) => {
      if (/^\/work\/out\/[^/]+\/doc-aaaa$/.test(p)) {
        copied += b.length;
        signal.cancelled = true; // stopped as the first of it lands
      }
      await write(p, b);
    };
    const append = store.fs.appendBytes;
    store.fs.appendBytes = async (p, b) => {
      if (/^\/work\/out\/[^/]+\/doc-aaaa$/.test(p)) {
        copied += b.length;
      }
      await append(p, b);
    };

    await expect(
      controller.offer(docManifest({ sizeBytes: a.length }), undefined, signal),
    ).rejects.toBeInstanceOf(TransferCancelledError);
    expect(copied).toBeLessThan(1000);
    expect(transport.calls).toEqual([]);
    expect([...store.files.keys()].filter(k => k.startsWith('/work/out'))).toEqual([]);
  });
});

describe('receiving a transfer', () => {
  const plantGood = async (dir: string, store: ReturnType<typeof memoryFs>) => {
    const b = await bundle();
    await store.fs.writeBytes(`${dir}/${TRANSFER_BACKUP_FILE}`, b.bytes);
    await store.fs.writeBytes(
      `${dir}/${TRANSFER_KEY_FILE}`,
      encodeUtf8(KEY),
    );
  };

  it('reports what arrived and WRITES NOTHING to the archive', async () => {
    // FR-004, and the reason `receive` and `apply` are two calls rather than one.
    const { controller, stores } = build(plantGood);
    const got = await controller.receive('7K2M-ryba-kotva-duha-lampa');

    expect(got.restorable).toBe(true);
    expect(got.manifest.appVersion).toBe('1.4.0');
    expect(got.recoveryKey).toBe(KEY);
    expect(await stores.accounts.list()).toEqual([]);
  });

  it('judges compatibility from the MANIFEST, before the payload is trusted', async () => {
    // FR-002. A backup from a newer build is refused with its own sentence rather than half-read.
    const { controller } = build(async (dir, store) => {
      const b = await bundle({ schemaVersion: BACKUP_SCHEMA_VERSION + 5 });
      await store.fs.writeBytes(`${dir}/${TRANSFER_BACKUP_FILE}`, b.bytes);
    });
    const got = await controller.receive('7K2M-ryba-kotva-duha-lampa');
    expect(got.restorable).toBe(false);
    expect(got.compatibility).toMatchObject({ kind: 'tooNew', what: 'schema' });
  });

  it('says so plainly when the far side sent something that is not a backup', async () => {
    const { controller } = build(async (dir, store) => {
      await store.fs.writeBytes(`${dir}/holiday.jpg`, new Uint8Array([1, 2, 3]));
    });
    await expect(controller.receive('7K2M-ryba-kotva-duha-lampa')).rejects.toThrow(
      /did not send a backup/,
    );
  });

  it('refuses a bundle that is damaged, with the format error s own words', async () => {
    const { controller } = build(async (dir, store) => {
      await store.fs.writeBytes(
        `${dir}/${TRANSFER_BACKUP_FILE}`,
        new Uint8Array(64).fill(7),
      );
    });
    await expect(controller.receive('7K2M-ryba-kotva-duha-lampa')).rejects.toThrow(
      /Obálka backup/i,
    );
  });

  it('carries on without a key when none came with it', async () => {
    const { controller } = build(async (dir, store) => {
      const b = await bundle();
      await store.fs.writeBytes(`${dir}/${TRANSFER_BACKUP_FILE}`, b.bytes);
    });
    const got = await controller.receive('7K2M-ryba-kotva-duha-lampa');
    expect(got.recoveryKey).toBeNull();
    expect(got.restorable).toBe(true);
  });

  it('KEEPS what arrived until it is applied or let go of', async () => {
    // Deliberate, and the reason is Tier 2: an archive's documents are the one part of a transfer
    // that can be gigabytes, so they stay on disk rather than being held in memory across the
    // question the user still has to answer.
    const { controller, store } = build(plantGood);
    const got = await controller.receive('7K2M-ryba-kotva-duha-lampa');
    expect(got.dir).toMatch(/^\/work\/in\/[^/]+$/);
    expect([...store.files.keys()].filter(k => k.startsWith('/work/in')).length).toBeGreaterThan(0);
  });

  it('lets go of it when the user declines', async () => {
    const { controller, store } = build(plantGood);
    const got = await controller.receive('7K2M-ryba-kotva-duha-lampa');
    await controller.dispose(got);
    expect([...store.files.keys()].filter(k => k.startsWith('/work/in'))).toEqual([]);
  });

  it('sweeps on the way out when the receive itself failed', async () => {
    const { controller, store, transport } = build(plantGood);
    transport.fail(new Error('the other phone went away'));
    await expect(controller.receive('7K2M-ryba-kotva-duha-lampa')).rejects.toThrow();
    expect([...store.files.keys()].filter(k => k.startsWith('/work/in'))).toEqual([]);
  });
});

describe('applying what was received', () => {
  const plantGood = async (dir: string, store: ReturnType<typeof memoryFs>) => {
    const b = await bundle();
    await store.fs.writeBytes(`${dir}/${TRANSFER_BACKUP_FILE}`, b.bytes);
  };

  it('goes through the existing restore, and the box lands', async () => {
    // FR-003. If this ever stops being `restoreBackup`, the merge rules have been re-decided in the
    // one place where getting them wrong destroys somebody's archive.
    const { controller, stores } = build(plantGood);
    const got = await controller.receive('7K2M-ryba-kotva-duha-lampa');
    const report = await controller.apply(got, KEY, APPLY);

    expect(report.accountsAdded).toBe(1);
    expect((await stores.accounts.list()).map(a => a.boxId)).toEqual(['abc123']);
  });

  it('refuses to apply something it already said was not restorable', async () => {
    const { controller } = build(async (dir, store) => {
      const b = await bundle({ schemaVersion: BACKUP_SCHEMA_VERSION + 5 });
      await store.fs.writeBytes(`${dir}/${TRANSFER_BACKUP_FILE}`, b.bytes);
    });
    const got = await controller.receive('7K2M-ryba-kotva-duha-lampa');
    await expect(controller.apply(got, KEY, APPLY)).rejects.toThrow(/cannot be restored/);
  });

  it('does not fetch the archive again - the bytes are already here', async () => {
    // The receiving phone did not make this backup and must not start listing it as one of its own
    // just to be able to restore it.
    const { controller, stores } = build(plantGood);
    const got = await controller.receive('7K2M-ryba-kotva-duha-lampa');
    await controller.apply(got, KEY, APPLY);
    expect((await stores.accounts.list()).length).toBe(1);
  });

  it('sweeps what arrived once it has been applied', async () => {
    const { controller, store } = build(plantGood);
    const got = await controller.receive('7K2M-ryba-kotva-duha-lampa');
    await controller.apply(got, KEY, APPLY);
    expect([...store.files.keys()].filter(k => k.startsWith('/work/in'))).toEqual([]);
  });

  it('reports a wrong passphrase as what it is', async () => {
    const { controller } = build(plantGood);
    const got = await controller.receive('7K2M-ryba-kotva-duha-lampa');
    await expect(
      controller.apply(got, 'AAAA-BBBB-CCCC-DDDD-EEEE', APPLY),
    ).rejects.toThrow(/recovery key|could not be opened/i);
  });

  it('writes the documents that came with it back, signed original included (004)', async () => {
    // Until 2026-09-14 `apply` restored without the document tier: the objects crossed, were counted
    // and were swept, and the receiving phone's details went on pointing at the OLD phone's paths.
    const bytes: Record<string, Uint8Array> = {
      '/old/abc123/m1/0-rozhodnuti.pdf': Uint8Array.of(1, 2, 3),
      '/old/abc123/m1/DZ_m1.zfo': Uint8Array.of(9, 8, 7, 6),
    };
    const message = {
      boxId: 'abc123',
      messageId: 'm1',
      folder: 'received',
      subject: 'Rozhodnutí',
      sender: 'Úřad',
      senderAddress: null,
      recipient: null,
      recipientAddress: null,
      deliveryTime: 1,
      acceptanceTime: 2,
      state: 7,
      attachmentSize: 1,
      detailJson: JSON.stringify({
        id: 'm1',
        subject: 'Rozhodnutí',
        sender: 'Úřad',
        senderAddress: null,
        recipient: null,
        recipientAddress: null,
        deliveryTime: 1,
        acceptanceTime: 2,
        attachments: [
          {
            name: 'rozhodnuti.pdf',
            mimeType: 'application/pdf',
            metaType: 'main',
            contentBase64: '',
            localPath: '/old/abc123/m1/0-rozhodnuti.pdf',
            size: 3,
          },
        ],
        signedZfo: { fileName: 'DZ_m1.zfo', localPath: '/old/abc123/m1/DZ_m1.zfo', size: 4 },
      }),
      downloadedAt: 5,
    };

    // The sending phone's Tier 2 objects, sealed under its document key.
    const documentKey = new Uint8Array(32).fill(3);
    const objects = new Map<string, Uint8Array>();
    const source: DocumentSource = {
      sizeOf: async path => bytes[path]?.length ?? null,
      open: async path => {
        let given = false;
        return async () => {
          if (given) {
            return null;
          }
          given = true;
          return bytes[path];
        };
      },
    };
    const objectStore: SyncTarget = {
      listManifests: async () => [],
      putBackup: async () => {},
      getArchive: async () => new Uint8Array(),
      deleteBackup: async () => {},
      hasObject: async name => objects.has(name),
      putObject: async (name, read) => {
        const parts: number[] = [];
        for (let piece = await read(); piece != null; piece = await read()) {
          parts.push(...piece);
        }
        objects.set(name, Uint8Array.from(parts));
      },
    };
    const stored = await backupDocuments([message as never], source, objectStore, documentKey, {
      randomBytes: n => new Uint8Array(n).fill(1),
    });
    const payload = {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      accounts: [
        {
          boxId: 'abc123',
          loginName: 'novak',
          label: 'Jan Novak',
          alias: null,
          dbType: 'FO',
          authMethod: 'password',
          host: 'czebox',
          passwordExpiresAt: null,
          createdAt: 1,
        },
      ],
      messages: [message],
      drafts: [],
      reminders: [],
      settings: {},
      documents: stored.documents,
      documentKey: encodeDocumentKey(documentKey),
    };
    const archive = await seal(await encodePayload(payload as never), KEY, FAST);
    const withDocuments = manifest({
      sizeBytes: archive.length,
      tiers: { metadata: true, documents: true },
    });

    // This phone's attachment directory.
    const disk = new Map<string, Uint8Array>();
    const deviceFs: DocumentFs = {
      ensureDir: async () => {},
      writeBytes: async (path, b) => {
        disk.set(path, b.slice());
      },
      appendBytes: async (path, b) => {
        disk.set(path, Uint8Array.from([...(disk.get(path) ?? []), ...b]));
      },
      exists: async path => disk.has(path),
      move: async (from, to) => {
        disk.set(to, disk.get(from) as Uint8Array);
        disk.delete(from);
      },
      remove: async path => {
        disk.delete(path);
      },
    };

    const { controller, stores } = build(
      async (dir, s) => {
        await s.fs.writeBytes(`${dir}/${TRANSFER_BACKUP_FILE}`, packPortable(withDocuments, archive));
        for (const [name, body] of objects) {
          await s.fs.writeBytes(`${dir}/${name}`, body);
        }
      },
      {
        documents: s => ({
          fs: deviceFs,
          details: documentDetails(s),
          messageDir: (boxId, messageId) => `/new/${boxId}/${messageId}`,
        }),
      },
    );
    const got = await controller.receive('7K2M-ryba-kotva-duha-lampa');
    expect(got.documents).toBe(2);
    const report = await controller.apply(got, KEY, APPLY);

    expect(report.documents).toMatchObject({ restored: 2, missing: 0, failed: 0, orphaned: 0 });
    const detail = await stores.messages.getDetail('abc123', 'm1');
    expect(detail?.attachments[0].localPath).toBe('/new/abc123/m1/0-rozhodnuti.pdf');
    expect(detail?.signedZfo).toEqual({
      fileName: 'DZ_m1.zfo',
      localPath: '/new/abc123/m1/DZ_m1.zfo',
      size: 4,
    });
    expect(Array.from(disk.get('/new/abc123/m1/DZ_m1.zfo') ?? [])).toEqual([9, 8, 7, 6]);
  });
});

describe('saving what arrived, with nothing else meanwhile (025 review, 2026-09-15)', () => {
  const plant = async (dir: string, store: ReturnType<typeof memoryFs>) => {
    const b = await bundle();
    await store.fs.writeBytes(`${dir}/${TRANSFER_BACKUP_FILE}`, b.bytes);
    // Stands for a document the save has still to read.
    await store.fs.writeBytes(`${dir}/doc-still-needed`, new Uint8Array([1, 2, 3]));
  };

  /** A restore transaction that waits for the test to let it through. */
  function heldTransaction() {
    let enter: () => void = () => undefined;
    let release: () => void = () => undefined;
    const entered = new Promise<void>(resolve => {
      enter = resolve;
    });
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const transaction = async <T>(fn: () => Promise<T>): Promise<T> => {
      enter();
      await gate;
      return fn();
    };
    return { transaction, entered, release: () => release() };
  }

  it('starts nothing and sweeps nothing while a save is still reading what arrived', async () => {
    // The cancel row stayed on screen during the save, and a receive started after pressing it swept
    // the directory the save was still reading documents from.
    const held = heldTransaction();
    const { controller, store, transport, archives } = build(plant, {
      transaction: held.transaction,
    });
    const got = await controller.receive(PHRASE);
    const stages: string[] = [];
    const saving = controller.apply(got, KEY, { ...APPLY, onProgress: p => stages.push(p.stage) });
    await held.entered;
    expect(controller.isApplying()).toBe(true);

    await expect(controller.receive(PHRASE)).rejects.toBeInstanceOf(TransferBusyError);
    const a = await sealedArchive();
    archives.set('obalka-1000.backup', a);
    await expect(controller.offer(manifest({ sizeBytes: a.length }))).rejects.toBeInstanceOf(
      TransferBusyError,
    );
    await controller.dispose(got);
    await controller.sweepStale();
    expect(store.files.has(`${got.dir}/doc-still-needed`)).toBe(true);
    expect(transport.calls.filter(c => /^(receive|send):/.test(c))).toHaveLength(1);

    let settled = false;
    const waited = controller.whenApplied().then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    held.release();
    await saving;
    await waited;
    expect(stages).toContain('restoring');
    expect(controller.isApplying()).toBe(false);
    expect([...store.files.keys()].filter(k => k.startsWith('/work/in'))).toEqual([]);
    // And the next transfer is let through.
    await expect(controller.receive(PHRASE)).resolves.toMatchObject({ restorable: true });
  });

  it('keeps how a save ended until a screen takes it, and tells a listener it ended (2026-09-15)', async () => {
    // A save that finished while no transfer screen was open was reported nowhere.
    const { controller } = build(plant);
    expect(controller.takeOutcome()).toBeNull();
    let heard = 0;
    const stop = controller.subscribeOutcome(() => {
      heard += 1;
    });

    const applied = await controller.apply(await controller.receive(PHRASE), KEY, APPLY);
    expect(heard).toBe(1);
    expect(controller.takeOutcome()).toEqual({ ok: true, applied });
    // Handed out once, so two screens never both say it.
    expect(controller.takeOutcome()).toBeNull();

    stop();
    const again = await controller.receive(PHRASE);
    await expect(controller.apply(again, 'AAAA-BBBB-CCCC-DDDD-EEEE', APPLY)).rejects.toThrow();
    expect(heard).toBe(1);
    expect(controller.takeOutcome()).toMatchObject({ ok: false });
  });

  it('keeps the outcome before the caller hears the save end, so the screen that saw it can take it', async () => {
    const { controller } = build(plant);
    const got = await controller.receive(PHRASE);
    let found: unknown = 'not yet';
    await controller.apply(got, KEY, APPLY).then(() => {
      found = controller.takeOutcome();
    });
    expect(found).toMatchObject({ ok: true });
  });

  it('lets go of the save when it fails, so the next transfer is not refused forever', async () => {
    const { controller } = build(plant);
    const got = await controller.receive(PHRASE);
    await expect(controller.apply(got, 'AAAA-BBBB-CCCC-DDDD-EEEE', APPLY)).rejects.toThrow();
    expect(controller.isApplying()).toBe(false);
    await expect(controller.receive(PHRASE)).resolves.toMatchObject({ restorable: true });
  });

  it('passes keeping the display on to the transport, and never throws for it', () => {
    const { controller, transport } = build();
    controller.keepScreenOn(true);
    controller.keepScreenOn(false);
    expect(transport.calls).toEqual(['keepScreenOn:true', 'keepScreenOn:false']);
    transport.keepScreenOn = () => {
      throw new Error('no window');
    };
    expect(() => controller.keepScreenOn(true)).not.toThrow();
  });
});

describe('a stopped run never sweeps the files of the next one (025 review, 2026-09-15)', () => {
  // The native module runs one transfer at a time, so a stopped run lets go - and its cleanup runs -
  // at the very moment the transfer started after it begins. While both staged into the same `in/` or
  // `out/`, that cleanup took the new transfer's files.
  const sendsIn = (calls: string[]) => calls.filter(c => c.startsWith('send:'));

  it('keeps what the next receive is receiving when the stopped one lets go', async () => {
    const b = await bundle();
    const { controller, transport, store } = build();
    let firstStarted: () => void = () => undefined;
    const started = new Promise<void>(resolve => {
      firstStarted = resolve;
    });
    let letFirstGo: () => void = () => undefined;
    let first: Promise<unknown> = Promise.resolve();
    const dirs: string[] = [];
    transport.receive = async dir => {
      dirs.push(dir);
      if (dirs.length === 1) {
        firstStarted();
        await new Promise<void>(resolve => {
          letFirstGo = resolve;
        });
        throw new TransferCancelledError();
      }
      await store.fs.writeBytes(`${dir}/${TRANSFER_BACKUP_FILE}`, b.bytes);
      // Only now does the stopped run let go, and its cleanup runs while this one is still receiving.
      letFirstGo();
      await first.catch(() => undefined);
      return store.fs.list(dir);
    };
    const stop = { cancelled: false };
    first = controller.receive(PHRASE, undefined, stop);
    await started;
    stop.cancelled = true;

    await expect(controller.receive(PHRASE)).resolves.toMatchObject({ restorable: true });
    await expect(first).rejects.toBeInstanceOf(TransferCancelledError);
    expect(dirs[1]).not.toBe(dirs[0]);
  });

  it('keeps what the next offer staged when the abandoned one lets go', async () => {
    const { controller, archives, store, transport } = build();
    const a = await sealedArchive();
    archives.set('obalka-1000.backup', a);
    let letFirstGo: () => void = () => undefined;
    transport.send = async dir => {
      transport.calls.push(`send:${dir}`);
      if (sendsIn(transport.calls).length === 1) {
        await new Promise<void>(resolve => {
          letFirstGo = resolve;
        });
        throw new TransferCancelledError();
      }
      // Nobody takes the second one up while the test looks at what it staged.
      await new Promise<void>(() => {});
    };
    const stop = { cancelled: false };
    const first = await controller.offer(manifest({ sizeBytes: a.length }), undefined, stop);
    const firstDone = first.done.catch(() => undefined);
    // Walked away from the way the screen does it: stopped, and abandoned without waiting.
    stop.cancelled = true;
    void controller.abandon();

    const second = await controller.offer(manifest({ sizeBytes: a.length }));
    void second.done.catch(() => undefined);
    letFirstGo();
    await firstDone;

    const secondDir = sendsIn(transport.calls)[1].slice('send:'.length);
    expect((await store.fs.list(secondDir)).sort()).toEqual(
      [TRANSFER_BACKUP_FILE, TRANSFER_KEY_FILE].sort(),
    );
  });
});

describe('saying what a send carries (US1 scenario 1)', () => {
  it('counts boxes and messages from the archive, and documents from the manifest', async () => {
    const source = archiveOf({ abc123: { received: 2, sent: 1 }, def456: { received: 4, sent: 0 } });
    const { controller, archives } = build(undefined, { source });
    const a = await sealedArchive();
    archives.set('obalka-1000.backup', a);

    const offer = await controller.offer(
      manifest({
        sizeBytes: a.length,
        tiers: { metadata: true, documents: true },
        documentCount: 9,
      }),
    );
    await offer.done;
    expect(offer.contents).toEqual({ boxes: 2, messages: 7, documents: 9 });
  });

  it('counts messages exactly as a backup of the same archive would', async () => {
    // The count is only worth showing if it is the number the other phone will report, so it is
    // pinned to `buildPayload` rather than to a second idea of which folders a backup reads.
    const source = archiveOf({ abc123: { received: 3, sent: 2 }, def456: { received: 0, sent: 5 } });
    const { controller, archives } = build(undefined, { source });
    const a = await sealedArchive();
    archives.set('obalka-1000.backup', a);
    const payload = await buildPayload(source);

    const offer = await controller.offer(manifest({ sizeBytes: a.length }));
    await offer.done;
    expect(offer.contents).toMatchObject({
      boxes: payload.accounts.length,
      messages: payload.messages.length,
    });
  });

  it('says zero documents for a metadata-only backup, and "not known" when the manifest cannot say', async () => {
    const source = archiveOf({ abc123: { received: 1, sent: 0 } });
    const { controller, archives } = build(undefined, { source });
    const a = await sealedArchive();
    archives.set('obalka-1000.backup', a);

    const metadataOnly = await controller.offer(manifest({ sizeBytes: a.length }));
    await metadataOnly.done;
    expect(metadataOnly.contents?.documents).toBe(0);

    // Absent is not zero: a Tier 2 manifest without the count predates the question.
    const uncounted = await controller.offer(
      manifest({ sizeBytes: a.length, tiers: { metadata: true, documents: true } }),
    );
    await uncounted.done;
    expect(uncounted.contents?.documents).toBeNull();
  });

  it('still sends, stating the size alone, when the archive cannot be counted', async () => {
    const source = archiveOf({ abc123: { received: 1, sent: 0 } });
    source.listAccounts = async () => {
      throw new Error('database is locked');
    };
    const { controller, archives, transport } = build(undefined, { source });
    const a = await sealedArchive();
    archives.set('obalka-1000.backup', a);

    const offer = await controller.offer(manifest({ sizeBytes: a.length }));
    await offer.done;
    expect(offer.contents).toBeNull();
    expect(offer.sizeBytes).toBeGreaterThan(a.length);
    expect(transport.calls[0]).toMatch(/^send:/);
  });
});

describe('stopping a transfer (FR-014)', () => {
  it('never reaches the transport when stopped while staging, and leaves nothing staged', async () => {
    // The screen stops a run the moment the app leaves the foreground, and staging the documents is
    // the slow part - so that is where a stop lands. Carrying on into croc would open a relay
    // connection from a phone nobody is looking at.
    const { controller, archives, store, transport } = build(undefined, { backupDir: '/backups' });
    const a = await sealedArchive();
    archives.set('obalka-1000.backup', a);
    await store.fs.ensureDir('/backups');
    await store.fs.writeBytes('/backups/doc-aaaa', new Uint8Array([1, 2, 3]));
    await store.fs.writeBytes('/backups/doc-bbbb', new Uint8Array([4, 5]));
    const written: string[] = [];
    const write = store.fs.writeBytes;
    store.fs.writeBytes = async (p, b) => {
      written.push(p);
      await write(p, b);
    };

    const signal = { cancelled: false };
    const offer = controller.offer(
      docManifest({ sizeBytes: a.length }),
      p => {
        // Stopped after the first document has been copied.
        if (p.stage === 'preparing' && p.sent === 1) {
          signal.cancelled = true;
        }
      },
      signal,
    );

    await expect(offer).rejects.toBeInstanceOf(TransferCancelledError);
    expect(transport.calls).toEqual([]);
    // Copying stops between files rather than finishing the job for nobody.
    expect(written.filter(path => path.endsWith('/doc-bbbb'))).toEqual([]);
    expect(written.filter(path => path.endsWith('/doc-aaaa'))).toHaveLength(1);
    expect([...store.files.keys()].filter(k => k.startsWith('/work/out'))).toEqual([]);
  });

  it('tells the transport to stop at once, before anything else is awaited', async () => {
    // The signal reaches the native side on a JS timer, and Android pauses those while the app is in
    // the background - the very moment the screen stops a run for FR-014. So letting go of a run has
    // to stop the transport itself, and in the same turn, not after a sweep that crosses the bridge.
    const { controller, archives, transport } = build();
    const a = await sealedArchive();
    archives.set('obalka-1000.backup', a);
    transport.hang();
    void (await controller.offer(manifest({ sizeBytes: a.length }))).done.catch(
      () => undefined,
    );

    const letGo = controller.abandon();
    expect(transport.calls).toContain('cancel');
    await letGo;
  });

  it('does not start a receive that was stopped before it began', async () => {
    const { controller, transport } = build();
    await expect(
      controller.receive('7K2M-ryba-kotva-duha-lampa', undefined, { cancelled: true }),
    ).rejects.toBeInstanceOf(TransferCancelledError);
    expect(transport.calls).toEqual([]);
  });

  it('does not hand back a receive stopped while it ran, and sweeps what arrived', async () => {
    // The native side notices a stop between steps, so a transfer can finish in the moment before
    // it does. The user has been told it stopped; the recovery key that came with it must not be
    // left sitting in the cache for a transfer nobody is going to finish.
    const signal = { cancelled: false };
    const { controller, store } = build(async (dir, s) => {
      const b = await bundle();
      await s.fs.writeBytes(`${dir}/${TRANSFER_BACKUP_FILE}`, b.bytes);
      await s.fs.writeBytes(`${dir}/${TRANSFER_KEY_FILE}`, encodeUtf8(KEY));
      signal.cancelled = true;
    });

    await expect(
      controller.receive('7K2M-ryba-kotva-duha-lampa', undefined, signal),
    ).rejects.toBeInstanceOf(TransferCancelledError);
    expect([...store.files.keys()].filter(k => k.startsWith('/work/in'))).toEqual([]);
  });
});

describe('writing back the documents that travelled (US1 scenario 3)', () => {
  const DOCUMENT_KEY = new Uint8Array(32).fill(9);
  const OLD_PATH = '/old/attachments/abc123/m1/0-rozhodnuti.pdf';

  /** A backup made on the OLD phone: one box, one message, one downloaded attachment, Tier 2 on. */
  async function tier2Backup(file: Uint8Array) {
    const detail = {
      id: 'm1',
      subject: 'Rozhodnuti',
      sender: 'Urad',
      senderAddress: null,
      attachments: [
        {
          name: 'rozhodnuti.pdf',
          mimeType: 'application/pdf',
          metaType: 'main',
          contentBase64: '',
          localPath: OLD_PATH,
          size: file.length,
        },
      ],
    } as unknown as MessageDetail;
    const message = {
      boxId: 'abc123',
      messageId: 'm1',
      folder: 'received',
      subject: 'Rozhodnuti',
      sender: 'Urad',
      senderAddress: null,
      recipient: null,
      recipientAddress: null,
      deliveryTime: null,
      acceptanceTime: null,
      state: 7,
      attachmentSize: null,
      detailJson: JSON.stringify(detail),
      downloadedAt: 1,
    } as BackupMessage;
    const source: DocumentSource = {
      sizeOf: async path => (path === OLD_PATH ? file.length : null),
      open: async () => {
        let done = false;
        return async () => {
          if (done) {
            return null;
          }
          done = true;
          return file;
        };
      },
    };
    // The old phone's object store, which is what `offer` copies across.
    const objects = new Map<string, Uint8Array>();
    const store: SyncTarget = {
      listManifests: async () => [],
      putBackup: async () => {},
      getArchive: async () => new Uint8Array(),
      deleteBackup: async () => {},
      hasObject: async name => objects.has(name),
      putObject: async (name, pull) => {
        const parts: number[] = [];
        for (let piece = await pull(); piece; piece = await pull()) {
          parts.push(...piece);
        }
        objects.set(name, Uint8Array.from(parts));
      },
    };
    const stored = await backupDocuments([message], source, store, DOCUMENT_KEY, {
      randomBytes: n => new Uint8Array(n).fill(3),
    });
    const payload = {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      accounts: [
        {
          boxId: 'abc123',
          loginName: 'novak',
          label: 'Jan Novak',
          alias: null,
          dbType: 'FO',
          authMethod: 'password',
          host: 'czebox',
          passwordExpiresAt: null,
          createdAt: 1,
        },
      ],
      messages: [message],
      drafts: [],
      reminders: [],
      settings: {},
      documents: stored.documents,
      documentKey: encodeDocumentKey(DOCUMENT_KEY),
    };
    const archive = await seal(await encodePayload(payload as never), KEY, FAST);
    const m = manifest({
      sizeBytes: archive.length,
      tiers: { metadata: true, documents: true },
      documentCount: stored.documents.length,
    });
    return { bytes: packPortable(m, archive), objects };
  }

  it('restores the documents that arrived, through the same document restore as a backup', async () => {
    // It did not, until 2026-09-14: `apply` never passed the document restore, so the documents
    // were carried across, staged, and swept - and "restored" meant the metadata alone.
    const file = new Uint8Array(2500).map((_, i) => i % 251);
    const backup = await tier2Backup(file);
    const { controller } = build(
      async (dir, s) => {
        await s.fs.writeBytes(`${dir}/${TRANSFER_BACKUP_FILE}`, backup.bytes);
        for (const [name, body] of backup.objects) {
          await s.fs.writeBytes(`${dir}/${name}`, body);
        }
      },
      { documentsTo: '/new/attachments' },
    );

    const got = await controller.receive('7K2M-ryba-kotva-duha-lampa');
    const report = await controller.apply(got, KEY, APPLY);

    expect(report.documents).toMatchObject({ restored: 1, missing: 0, failed: 0, orphaned: 0 });
  });

  it('writes the bytes into this phone s own attachment directory, intact', async () => {
    const file = new Uint8Array(2500).map((_, i) => (i * 7) % 251);
    const backup = await tier2Backup(file);
    const { controller, store } = build(
      async (dir, s) => {
        await s.fs.writeBytes(`${dir}/${TRANSFER_BACKUP_FILE}`, backup.bytes);
        for (const [name, body] of backup.objects) {
          await s.fs.writeBytes(`${dir}/${name}`, body);
        }
      },
      { documentsTo: '/new/attachments' },
    );

    const got = await controller.receive('7K2M-ryba-kotva-duha-lampa');
    await controller.apply(got, KEY, APPLY);

    expect(
      Array.from(store.files.get('/new/attachments/abc123/m1/0-rozhodnuti.pdf') ?? []),
    ).toEqual(Array.from(file));
  });

  it('reads each document that arrived a slice at a time, never whole', async () => {
    // The staged target read every object whole and handed out pieces of that: a 100 MB enclosure
    // or a signed original in the JS heap at once, on the phone that has just been set up.
    const file = new Uint8Array(2500).map((_, i) => (i * 3) % 251);
    const backup = await tier2Backup(file);
    const { controller, store } = build(
      async (dir, s) => {
        await s.fs.writeBytes(`${dir}/${TRANSFER_BACKUP_FILE}`, backup.bytes);
        for (const [name, body] of backup.objects) {
          await s.fs.writeBytes(`${dir}/${name}`, body);
        }
      },
      { documentsTo: '/new/attachments' },
    );

    const got = await controller.receive('7K2M-ryba-kotva-duha-lampa');
    const report = await controller.apply(got, KEY, APPLY);

    expect(report.documents).toMatchObject({ restored: 1, failed: 0 });
    expect(
      Array.from(store.files.get('/new/attachments/abc123/m1/0-rozhodnuti.pdf') ?? []),
    ).toEqual(Array.from(file));
    expect(store.wholeReads.filter(p => p.includes('/doc-'))).toEqual([]);
  });

  /** Everything the old phone sends: the bundle and every object. */
  const plantAll =
    (backup: { bytes: Uint8Array; objects: Map<string, Uint8Array> }) =>
    async (dir: string, s: ReturnType<typeof memoryFs>) => {
      await s.fs.writeBytes(`${dir}/${TRANSFER_BACKUP_FILE}`, backup.bytes);
      for (const [name, body] of backup.objects) {
        await s.fs.writeBytes(`${dir}/${name}`, body);
      }
    };

  /** A Keychain and a settings table that remember what they were given. */
  function keyStores(
    over: {
      has?: boolean;
      saveFails?: boolean;
      /** What storing the passphrase rejects with, when it is not the generic failure. */
      saveRejects?: () => Error;
      documentKey?: string;
    } = {},
  ) {
    const settings = new Map<string, string>();
    if (over.documentKey) {
      settings.set('backup.documentKey', over.documentKey);
    }
    const saved: { passphrase: string; promptTitle: string }[] = [];
    const stores: RestoredKeyStores = {
      secret: {
        has: async () => over.has === true,
        save: async (passphrase, promptTitle) => {
          if (over.saveRejects) {
            throw over.saveRejects();
          }
          if (over.saveFails) {
            throw new Error('The prompt was declined.');
          }
          saved.push({ passphrase, promptTitle });
        },
      },
      settings: {
        getSetting: async key => settings.get(key) ?? null,
        setSetting: async (key, value) => {
          settings.set(key, value);
        },
      },
    };
    return { stores, saved, settings };
  }

  it('keeps the recovery key and the document key that arrived, as the backup screen s restore does (006)', async () => {
    // It kept neither. The receiving phone's backups stayed off, and turning them on minted a new
    // document key, so the first backup uploaded every document again under names nothing had.
    const backup = await tier2Backup(new Uint8Array(40).fill(5));
    const keys = keyStores();
    const { controller } = build(plantAll(backup), {
      documentsTo: '/new/attachments',
      keys: keys.stores,
    });
    const report = await controller.apply(await controller.receive(PHRASE), KEY, APPLY);

    expect(report.keysFailed).toBe(false);
    expect(keys.saved).toEqual([{ passphrase: KEY, promptTitle: APPLY.promptTitle }]);
    expect(keys.settings.get('backup.documentKey')).toBe(encodeDocumentKey(DOCUMENT_KEY));

    // A phone with keys of its own keeps them, exactly as the backup screen's restore does.
    const own = keyStores({ has: true, documentKey: 'ab'.repeat(32) });
    const second = build(plantAll(backup), { documentsTo: '/new/attachments', keys: own.stores });
    await second.controller.apply(await second.controller.receive(PHRASE), KEY, APPLY);
    expect(own.saved).toEqual([]);
    expect(own.settings.get('backup.documentKey')).toBe('ab'.repeat(32));
  });

  it('still reports the save when the password cannot be kept, keeps the document key, and says so', async () => {
    // Android asks for the screen lock when the password is stored, and that can be declined. The
    // archive is written by then, so this is not a failed transfer - but the screen has to say it.
    const backup = await tier2Backup(new Uint8Array(40).fill(5));
    const keys = keyStores({ saveFails: true });
    const { controller, stores } = build(plantAll(backup), {
      documentsTo: '/new/attachments',
      keys: keys.stores,
    });
    const report = await controller.apply(await controller.receive(PHRASE), KEY, APPLY);

    expect(report.keysFailed).toBe(true);
    expect(report.documents).toMatchObject({ restored: 1 });
    expect((await stores.accounts.list()).map(a => a.boxId)).toEqual(['abc123']);
    expect(keys.settings.get('backup.documentKey')).toBe(encodeDocumentKey(DOCUMENT_KEY));
  });

  it('traces a declined screen lock as the person s decision, and reports only a real failure (2026-09-15)', async () => {
    // Every refusal was reported as `backup.restore` / persist, so pressing cancel on the screen-lock
    // prompt landed in the failure reports beside a Keystore that had actually broken.
    const reported = jest.spyOn(telemetry, 'reportFailure').mockImplementation(() => undefined);
    const traced = jest.spyOn(telemetry, 'trace').mockImplementation(() => undefined);
    try {
      const backup = await tier2Backup(new Uint8Array(40).fill(5));
      const declined = keyStores({ saveRejects: () => new BackupPromptDeclinedError() });
      const first = build(plantAll(backup), {
        documentsTo: '/new/attachments',
        keys: declined.stores,
      });
      const report = await first.controller.apply(await first.controller.receive(PHRASE), KEY, APPLY);

      // Still not kept, and still said on screen - only the classification changed. (Other operations
      // may report on the way - the JS cipher fallback does in jest - so only this one is asserted.)
      expect(report.keysFailed).toBe(true);
      expect(reported).not.toHaveBeenCalledWith(
        'backup.restore',
        expect.anything(),
        expect.anything(),
      );
      expect(traced).toHaveBeenCalledWith('backup.restore', {
        stage: 'persist',
        outcome: 'declined',
      });

      const broken = new Error('Key permanently invalidated');
      const failing = keyStores({ saveRejects: () => broken });
      const second = build(plantAll(backup), {
        documentsTo: '/new/attachments',
        keys: failing.stores,
      });
      traced.mockClear();
      await second.controller.apply(await second.controller.receive(PHRASE), KEY, APPLY);
      expect(reported).toHaveBeenCalledWith('backup.restore', broken, { stage: 'persist' });
      expect(traced).not.toHaveBeenCalledWith('backup.restore', expect.anything());
    } finally {
      reported.mockRestore();
      traced.mockRestore();
    }
  });

  it('saves as one run of the backup controller s, keys included, so no automatic backup overlaps it (2026-09-15)', async () => {
    // The save went around the backup controller's run tracking, so on a phone with automatic backups
    // on, a backup scheduled by a sync a moment earlier could start while the archive was being written.
    const backup = await tier2Backup(new Uint8Array(40).fill(5));
    const keys = keyStores();
    const events: string[] = [];
    const runs: ArchiveRuns = {
      runRestore: async work => {
        events.push('run:start');
        const result = await work(progress => events.push(`run:${progress.stage}`));
        events.push(`run:end:keys=${keys.saved.length}`);
        return result;
      },
    };
    const { controller, stores } = build(plantAll(backup), {
      documentsTo: '/new/attachments',
      keys: keys.stores,
      runs,
    });
    const stages: string[] = [];
    const report = await controller.apply(await controller.receive(PHRASE), KEY, {
      ...APPLY,
      onProgress: p => stages.push(p.stage),
    });

    expect(events[0]).toBe('run:start');
    expect(events).toContain('run:restoring');
    // The keys were kept before the run ended - an automatic backup let in between would be the same
    // overlap - and the transfer screen still hears the progress the backup screen does.
    expect(events.at(-1)).toBe('run:end:keys=1');
    expect(stages).toContain('restoring');
    expect(report.documents).toMatchObject({ restored: 1 });
    expect((await stores.accounts.list()).map(a => a.boxId)).toEqual(['abc123']);
  });

  it('counts a document the sender did not carry, rather than dropping it silently', async () => {
    // The spec's edge case: the index names it, the objects did not come. `missing` is the counter
    // the receiving screen turns into a sentence.
    const backup = await tier2Backup(new Uint8Array(40).fill(5));
    const { controller } = build(
      async (dir, s) => {
        await s.fs.writeBytes(`${dir}/${TRANSFER_BACKUP_FILE}`, backup.bytes);
      },
      { documentsTo: '/new/attachments' },
    );

    const got = await controller.receive('7K2M-ryba-kotva-duha-lampa');
    const report = await controller.apply(got, KEY, APPLY);

    expect(report.documents).toMatchObject({ restored: 0, missing: 1 });
  });
});

describe('a build that cannot transfer', () => {
  it('says so rather than taking the screen with it', async () => {
    // FR-013, the rule `bulkCipher.ts` follows: a missing native module means the feature is absent,
    // not that the app is broken.
    const { controller, transport, archives } = build();
    const a = await sealedArchive();
    archives.set('obalka-1000.backup', a);
    transport.isAvailable = false;

    expect(controller.available()).toBe(false);
    await expect(controller.offer(manifest())).rejects.toBeInstanceOf(
      TransferUnavailableError,
    );
  });

  it('treats a native module that throws while being asked as a missing one', async () => {
    const { controller, transport } = build();
    transport.available = () => {
      throw new Error('Nitro is not linked');
    };
    expect(controller.available()).toBe(false);
  });
});

// One offer or receive at a time (audit 2026-09-23). A double tap on "Odeslat z tohoto telefonu", or
// two camera frames holding the same code, called the controller twice before the screen could
// re-render, and each call staged its own copy of the archive and handed the native side its own
// transfer. The second call is made here WITHOUT awaiting the first, the way the second press arrives.
describe('one offer or receive at a time (double tap)', () => {
  const sendsIn = (calls: string[]) => calls.filter(c => c.startsWith('send:'));
  const receivesIn = (calls: string[]) => calls.filter(c => c.startsWith('receive:'));
  const plantGood = async (dir: string, store: ReturnType<typeof memoryFs>) => {
    const b = await bundle();
    await store.fs.writeBytes(`${dir}/${TRANSFER_BACKUP_FILE}`, b.bytes);
  };

  async function offering() {
    const built = build();
    const a = await sealedArchive();
    built.archives.set('obalka-1000.backup', a);
    return { ...built, m: manifest({ sizeBytes: a.length }) };
  }

  it('refuses a second offer while the first is staging, and only one reaches the native side', async () => {
    const { controller, transport, store, m } = await offering();
    transport.hang();
    const first = controller.offer(m);
    const second = controller.offer(m);

    await expect(second).rejects.toBeInstanceOf(TransferRunningError);
    const offer = await first;
    expect(offer.phrase).toBeTruthy();
    expect(sendsIn(transport.calls)).toHaveLength(1);
    // One staged copy of the archive, not two.
    runDirIn(store, 'out');
  });

  it('refuses a second offer while the first waits for the other phone', async () => {
    const { controller, transport, m } = await offering();
    transport.hang();
    await controller.offer(m);
    await expect(controller.offer(m)).rejects.toBeInstanceOf(TransferRunningError);
    expect(sendsIn(transport.calls)).toHaveLength(1);
  });

  it('refuses a second receive while the first runs, and only one reaches the native side', async () => {
    const { controller, transport } = build(plantGood);
    const first = controller.receive(PHRASE);
    const second = controller.receive(PHRASE);

    await expect(second).rejects.toBeInstanceOf(TransferRunningError);
    await expect(first).resolves.toMatchObject({ restorable: true });
    expect(receivesIn(transport.calls)).toHaveLength(1);
  });

  it('refuses a receive while an offer is running, and an offer while a receive is', async () => {
    const { controller, transport, m } = await offering();
    transport.hang();
    await controller.offer(m);
    await expect(controller.receive(PHRASE)).rejects.toBeInstanceOf(TransferRunningError);

    const other = build(plantGood);
    const receiving = other.controller.receive(PHRASE);
    await expect(other.controller.offer(m)).rejects.toBeInstanceOf(TransferRunningError);
    await receiving;
  });

  it('is free again once the other phone has taken the offer', async () => {
    const { controller, transport, m } = await offering();
    const offer = await controller.offer(m);
    await offer.done;
    await (await controller.offer(m)).done;
    expect(sendsIn(transport.calls)).toHaveLength(2);
  });

  it('is free again once a receive has returned, or failed', async () => {
    const { controller, transport } = build(plantGood);
    await controller.receive(PHRASE);
    transport.fail(new Error('relay down'));
    await expect(controller.receive(PHRASE)).rejects.toThrow('relay down');
    await expect(controller.receive(PHRASE)).rejects.toThrow('relay down');
    expect(receivesIn(transport.calls)).toHaveLength(3);
  });

  it('is free again when staging fails', async () => {
    const { controller, archives, m } = await offering();
    archives.clear();
    // The chosen backup is gone, so each attempt says so - and neither holds the claim (026 FR-007).
    await expect(controller.offer(m)).rejects.toBeInstanceOf(TransferBackupGoneError);
    await expect(controller.offer(m)).rejects.toBeInstanceOf(TransferBackupGoneError);
  });

  it('never refuses the next run after a stop, even when the stopped offer never ends', async () => {
    // Nobody connected, so the stopped offer's `done` never settles. A guard that waited for it would
    // refuse every transfer after it.
    const { controller, transport, m } = await offering();
    transport.hang();
    const stop = { cancelled: false };
    await controller.offer(m, undefined, stop);
    stop.cancelled = true;
    const next = await controller.offer(m);
    expect(next.phrase).toBeTruthy();

    // Walked away from without a signal: `abandon` is the caller saying it is done with the run.
    void controller.abandon();
    await expect(controller.offer(m)).resolves.toMatchObject({ phrase: expect.any(String) });
  });
});
