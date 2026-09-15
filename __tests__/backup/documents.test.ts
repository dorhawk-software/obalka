// Tier 2 end to end (006 T021-T023): the documents themselves, not the description of them.
//
// The two properties under test are the ones that decide whether this feature is usable at all.
//
// 1. A re-backup of an unchanged archive uploads NOTHING. An archive only grows, and re-sending all
//    of it after every sync is not a slow feature, it is one nobody can leave switched on.
// 2. One bad document costs one document. A file deleted under the app, an object missing from the
//    store, a disk that fails - none of them may take the other four hundred with it, and the report
//    has to SAY how many, because a restore that silently drops documents is the failure the whole
//    feature exists to prevent.
//
// The crypto itself is pinned by `fileSeal.test.ts` and `contentId.test.ts`; what is measured here is
// what the two of them are wired into.

import {
  backupDocuments,
  decodeDocumentKey,
  documentCandidates,
  encodeDocumentKey,
  estimateDocuments,
  restoreDocuments,
  type DocumentDetails,
  type DocumentFs,
  type DocumentSource,
} from '../../src/services/backup/documents';
import type { SyncTarget } from '../../src/services/backup/backupService';
import type { BackupMessage } from '../../src/services/backup/schema';
import type { MessageDetail } from '../../src/services/isds/types';

const KEY = new Uint8Array(32).fill(9);
const OTHER_KEY = new Uint8Array(32).fill(4);
/** Deterministic "randomness": the salt only has to be unique per file, not unpredictable in a test. */
const salts = (start = 1) => {
  let n = start;
  return (size: number) => new Uint8Array(size).fill(n++ % 251);
};

const detail = (id: string, files: string[]): MessageDetail =>
  ({
    id,
    subject: 'Rozhodnuti',
    sender: 'Urad',
    senderAddress: null,
    attachments: files.map((path, i) => ({
      name: `priloha-${i}.pdf`,
      mimeType: 'application/pdf',
      metaType: 'main',
      contentBase64: '',
      localPath: path,
      size: 1,
    })),
  }) as unknown as MessageDetail;

const message = (
  boxId: string,
  messageId: string,
  files: string[],
): BackupMessage =>
  ({
    boxId,
    messageId,
    folder: 'received',
    subject: 'Rozhodnuti',
    sender: null,
    senderAddress: null,
    recipient: null,
    recipientAddress: null,
    deliveryTime: null,
    acceptanceTime: null,
    state: 7,
    attachmentSize: null,
    detailJson: JSON.stringify(detail(messageId, files)),
    downloadedAt: 1,
  }) as BackupMessage;

/** A disk of attachment files, and a count of how often each was read. */
function memorySource(files: Record<string, Uint8Array>) {
  const reads: string[] = [];
  const failReads = new Set<string>();
  const source: DocumentSource = {
    async sizeOf(path) {
      return files[path] ? files[path].length : null;
    },
    async open(path) {
      reads.push(path);
      if (failReads.has(path)) {
        throw new Error('the disk gave up');
      }
      const bytes = files[path];
      let offset = 0;
      return async () => {
        if (offset >= bytes.length) {
          return null;
        }
        // Small pieces on purpose: a document that arrives in one call would never exercise the
        // streaming name or the multi-chunk seal.
        const piece = bytes.subarray(offset, Math.min(offset + 700, bytes.length));
        offset += piece.length;
        return piece;
      };
    },
  };
  return { source, reads, failReads };
}

/** A target that holds objects in memory and counts the writes, which is what T021 is about. */
function memoryObjectTarget() {
  const objects = new Map<string, Uint8Array>();
  const written: string[] = [];
  let failPuts = false;
  const target: SyncTarget = {
    listManifests: async () => [],
    putBackup: async () => {},
    getArchive: async () => new Uint8Array(),
    deleteBackup: async () => {},
    hasObject: async name => objects.has(name),
    async putObject(name, source) {
      if (failPuts) {
        throw new Error('no space left on device');
      }
      const parts: Uint8Array[] = [];
      for (;;) {
        const piece = await source();
        if (piece == null) {
          break;
        }
        parts.push(piece.slice());
      }
      const total = parts.reduce((n, p) => n + p.length, 0);
      const out = new Uint8Array(total);
      let at = 0;
      for (const part of parts) {
        out.set(part, at);
        at += part.length;
      }
      objects.set(name, out);
      written.push(name);
    },
    async getObject(name) {
      const bytes = objects.get(name);
      if (!bytes) {
        throw new Error(`no such file: ${name}`);
      }
      let offset = 0;
      return async (byteCount: number) => {
        if (offset >= bytes.length) {
          return null;
        }
        const piece = bytes.subarray(offset, Math.min(offset + byteCount, bytes.length));
        offset += piece.length;
        return piece;
      };
    },
  };
  return {
    target,
    objects,
    written,
    breakPuts: () => {
      failPuts = true;
    },
    mendPuts: () => {
      failPuts = false;
    },
  };
}

function memoryFs() {
  const files = new Map<string, Uint8Array>();
  const dirs = new Set<string>();
  /** Moves out of these paths fail, as a full or failing disk makes them. */
  const failMovesFrom = new Set<string>();
  /** Removals of these paths fail, as a file iOS will not let go of does. */
  const failRemovesOf = new Set<string>();
  const fs: DocumentFs = {
    ensureDir: async path => {
      dirs.add(path);
    },
    writeBytes: async (path, bytes) => {
      files.set(path, bytes.slice());
    },
    appendBytes: async (path, bytes) => {
      const head = files.get(path) ?? new Uint8Array(0);
      const out = new Uint8Array(head.length + bytes.length);
      out.set(head, 0);
      out.set(bytes, head.length);
      files.set(path, out);
    },
    exists: async path => files.has(path),
    move: async (from, to) => {
      const v = files.get(from);
      if (!v) {
        throw new Error(`no such file: ${from}`);
      }
      if (failMovesFrom.has(from)) {
        throw new Error(`EIO: ${from}`);
      }
      // As iOS does: a move never writes over a file.
      if (files.has(to)) {
        throw new Error(`EEXIST: ${to}`);
      }
      files.set(to, v);
      files.delete(from);
    },
    remove: async path => {
      if (failRemovesOf.has(path)) {
        throw new Error(`EPERM: ${path}`);
      }
      files.delete(path);
    },
  };
  return { fs, files, dirs, failMovesFrom, failRemovesOf };
}

function memoryDetails(seed: Record<string, MessageDetail> = {}) {
  const held = new Map(Object.entries(seed));
  const details: DocumentDetails = {
    getDetail: async (boxId, messageId) => held.get(`${boxId}/${messageId}`) ?? null,
    putDetail: async (boxId, messageId, d) => {
      held.set(`${boxId}/${messageId}`, d);
    },
  };
  return { details, held };
}

const doc = (byte: number, size: number) => new Uint8Array(size).fill(byte);

describe('finding what Tier 2 would carry', () => {
  it('takes the attachment paths out of the details Tier 1 already read', () => {
    const found = documentCandidates([
      message('abc123', 'm1', ['/data/attachments/abc123/m1/0-a.pdf']),
      message('abc123', 'm2', ['/data/attachments/abc123/m2/0-b.pdf']),
    ]);
    expect(found.map(c => c.fileName)).toEqual(['0-a.pdf', '0-b.pdf']);
    // The name travels; the path does not. On iOS the container directory changes on every
    // reinstall, so an absolute path from another device is stale the moment it lands.
    expect(found[0].boxId).toBe('abc123');
  });

  it('ignores messages whose body was never downloaded', () => {
    const bare = { ...message('abc123', 'm1', []), detailJson: null };
    expect(documentCandidates([bare])).toEqual([]);
  });

  it('ignores an attachment that was never written to disk', () => {
    const inline = {
      ...message('abc123', 'm1', []),
      detailJson: JSON.stringify({
        id: 'm1',
        attachments: [{ name: 'a.pdf', contentBase64: 'AAA', metaType: 'main' }],
      }),
    };
    expect(documentCandidates([inline])).toEqual([]);
  });

  it('survives a detail that will not parse rather than failing the backup', () => {
    // Tier 1 keeps whatever it holds. A detail this build cannot read simply carries no documents.
    const broken = { ...message('abc123', 'm1', []), detailJson: '{not json' };
    expect(documentCandidates([broken])).toEqual([]);
  });

  it('carries a message s signed original with its attachments (004)', () => {
    // The .zfo is the document a dispute about the message turns on, and ISDS drops it at 90 days
    // with everything else.
    const paths = ['/data/attachments/abc123/m1/0-a.pdf'];
    const withOriginal = {
      ...message('abc123', 'm1', paths),
      detailJson: JSON.stringify({
        ...detail('m1', paths),
        signedZfo: {
          fileName: 'DZ_m1.zfo',
          localPath: '/data/attachments/abc123/m1/DZ_m1.zfo',
          size: 9,
        },
      }),
    };
    expect(documentCandidates([withOriginal]).map(c => c.fileName)).toEqual([
      '0-a.pdf',
      'DZ_m1.zfo',
    ]);
  });
});

describe('storing documents', () => {
  it('stores each document once and says so', async () => {
    const { source } = memorySource({
      '/d/m1/0-a.pdf': doc(1, 3000),
      '/d/m2/0-b.pdf': doc(2, 10),
    });
    const { target, objects } = memoryObjectTarget();
    const report = await backupDocuments(
      [message('abc123', 'm1', ['/d/m1/0-a.pdf']), message('abc123', 'm2', ['/d/m2/0-b.pdf'])],
      source,
      target,
      KEY,
      { randomBytes: salts() },
    );
    expect(report.uploaded).toBe(2);
    expect(report.reused).toBe(0);
    expect(objects.size).toBe(2);
    expect(report.documents.map(d => d.sizeBytes)).toEqual([3000, 10]);
  });

  it('UPLOADS NOTHING when the archive has not changed', async () => {
    // T021, and the property the whole tier stands on. An archive is the sum of every document ever
    // received; re-sending it after each sync is a feature nobody can leave switched on.
    const files = { '/d/m1/0-a.pdf': doc(1, 5000) };
    const { source } = memorySource(files);
    const { target, written } = memoryObjectTarget();
    const messages = [message('abc123', 'm1', ['/d/m1/0-a.pdf'])];

    const first = await backupDocuments(messages, source, target, KEY, { randomBytes: salts() });
    const second = await backupDocuments(messages, source, target, KEY, { randomBytes: salts(50) });

    expect(first.uploaded).toBe(1);
    expect(second.uploaded).toBe(0);
    expect(second.reused).toBe(1);
    expect(written).toEqual(written.slice(0, 1)); // exactly one write, across both runs
    // And the index is identical, so the backup it goes into describes the same objects.
    expect(second.documents).toEqual(first.documents);
  });

  it('picks up where an interrupted run stopped', async () => {
    // The other half of T021: the run that died halfway does not start over.
    const { source } = memorySource({
      '/d/m1/0-a.pdf': doc(1, 900),
      '/d/m2/0-b.pdf': doc(2, 900),
    });
    const { target, breakPuts, mendPuts, written } = memoryObjectTarget();
    const messages = [
      message('abc123', 'm1', ['/d/m1/0-a.pdf']),
      message('abc123', 'm2', ['/d/m2/0-b.pdf']),
    ];
    const partial = await backupDocuments(messages, source, target, KEY, {
      randomBytes: salts(),
    });
    expect(partial.uploaded).toBe(2);

    // Now a third document appears and the store already holds the first two.
    breakPuts();
    const blocked = await backupDocuments(
      [...messages, message('abc123', 'm3', ['/d/m3/0-c.pdf'])],
      source,
      target,
      KEY,
      { randomBytes: salts(9) },
    );
    mendPuts();
    // The two that were already there were not re-sent even though the run failed on the third.
    expect(blocked.reused).toBe(2);
    expect(written.length).toBe(2);
  });

  it('counts a file that is no longer on disk without calling it a failure', async () => {
    // The archive says the message had an attachment; the file is gone. Tier 1 still carries the
    // description, which is what the app shows as "no longer available".
    const { source } = memorySource({});
    const { target } = memoryObjectTarget();
    const report = await backupDocuments(
      [message('abc123', 'm1', ['/d/m1/0-a.pdf'])],
      source,
      target,
      KEY,
      { randomBytes: salts() },
    );
    expect(report).toMatchObject({ gone: 1, failed: 0, uploaded: 0 });
    expect(report.documents).toEqual([]);
  });

  it('lets ONE document fail without taking the run with it', async () => {
    const { source, failReads } = memorySource({
      '/d/m1/0-a.pdf': doc(1, 100),
      '/d/m2/0-b.pdf': doc(2, 100),
      '/d/m3/0-c.pdf': doc(3, 100),
    });
    failReads.add('/d/m2/0-b.pdf');
    const { target } = memoryObjectTarget();
    const report = await backupDocuments(
      [
        message('abc123', 'm1', ['/d/m1/0-a.pdf']),
        message('abc123', 'm2', ['/d/m2/0-b.pdf']),
        message('abc123', 'm3', ['/d/m3/0-c.pdf']),
      ],
      source,
      target,
      KEY,
      { randomBytes: salts() },
    );
    expect(report).toMatchObject({ uploaded: 2, failed: 1 });
    expect(report.documents.map(d => d.messageId)).toEqual(['m1', 'm3']);
  });

  it('stops when the user cancels, rather than counting it as a failed document', async () => {
    const { source } = memorySource({
      '/d/m1/0-a.pdf': doc(1, 100),
      '/d/m2/0-b.pdf': doc(2, 100),
    });
    const { target } = memoryObjectTarget();
    const signal = { cancelled: false };
    await expect(
      backupDocuments(
        [message('abc123', 'm1', ['/d/m1/0-a.pdf']), message('abc123', 'm2', ['/d/m2/0-b.pdf'])],
        source,
        target,
        KEY,
        {
          randomBytes: salts(),
          onProgress: done => {
            if (done === 1) {
              signal.cancelled = true;
            }
          },
          signal,
        },
      ),
    ).rejects.toThrow(/cancelled/i);
  });

  it('reports progress as a real count, not a spinner', async () => {
    const { source } = memorySource({ '/d/m1/0-a.pdf': doc(1, 10), '/d/m2/0-b.pdf': doc(2, 10) });
    const { target } = memoryObjectTarget();
    const seen: [number, number][] = [];
    await backupDocuments(
      [message('abc123', 'm1', ['/d/m1/0-a.pdf']), message('abc123', 'm2', ['/d/m2/0-b.pdf'])],
      source,
      target,
      KEY,
      { randomBytes: salts(), onProgress: (done, total) => seen.push([done, total]) },
    );
    expect(seen).toEqual([
      [0, 2],
      [1, 2],
      [2, 2],
    ]);
  });

  it('refuses a destination that cannot hold objects, rather than reporting a backup it did not make', async () => {
    const { source } = memorySource({ '/d/m1/0-a.pdf': doc(1, 10) });
    const metadataOnly: SyncTarget = {
      listManifests: async () => [],
      putBackup: async () => {},
      getArchive: async () => new Uint8Array(),
      deleteBackup: async () => {},
    };
    await expect(
      backupDocuments([message('abc123', 'm1', ['/d/m1/0-a.pdf'])], source, metadataOnly, KEY, {
        randomBytes: salts(),
      }),
    ).rejects.toThrow(/cannot hold documents/);
  });
});

describe('putting documents back', () => {
  /** Store two documents, then restore them onto an empty device. */
  async function roundTrip(sizes: number[]) {
    const files: Record<string, Uint8Array> = {};
    sizes.forEach((size, i) => {
      files[`/old/m1/${i}-a.pdf`] = doc(i + 1, size);
    });
    const paths = Object.keys(files);
    const { source } = memorySource(files);
    const store = memoryObjectTarget();
    const messages = [message('abc123', 'm1', paths)];
    const stored = await backupDocuments(messages, source, store.target, KEY, {
      randomBytes: salts(),
    });
    const fs = memoryFs();
    // The restored device holds the detail Tier 1 just wrote - with the OLD device's paths in it.
    const details = memoryDetails({ 'abc123/m1': detail('m1', paths) });
    const report = await restoreDocuments(
      stored.documents,
      store.target,
      fs.fs,
      details.details,
      (boxId, messageId) => `/new/attachments/${boxId}/${messageId}`,
      KEY,
    );
    return { report, fs, details, store, files, stored };
  }

  it('writes the bytes back exactly, into this device s own directory', async () => {
    const { report, fs, files } = await roundTrip([3000, 1]);
    expect(report).toMatchObject({ restored: 2, failed: 0, missing: 0, orphaned: 0 });
    expect(Array.from(fs.files.get('/new/attachments/abc123/m1/0-a.pdf') ?? [])).toEqual(
      Array.from(files['/old/m1/0-a.pdf']),
    );
    expect(fs.files.get('/new/attachments/abc123/m1/1-a.pdf')?.length).toBe(1);
  });

  it('repoints the detail at where the files actually landed', async () => {
    // The point of T022. `localPath` in a backup is an absolute path on ANOTHER device; restoring
    // the bytes without rewriting it would leave documents on disk that nothing can open.
    const { details } = await roundTrip([50]);
    const restored = details.held.get('abc123/m1') as MessageDetail;
    expect(restored.attachments[0].localPath).toBe('/new/attachments/abc123/m1/0-a.pdf');
    expect(restored.attachments[0].size).toBe(50);
  });

  it('leaves nothing half-written under the real name when a document does not verify', async () => {
    const { report, fs, store, stored } = await roundTrip([2000]);
    expect(report.restored).toBe(1);

    // Corrupt the stored object and restore again onto a clean device.
    const name = [...store.objects.keys()][0];
    const damaged = store.objects.get(name)!.slice();
    damaged[damaged.length - 1] ^= 0x01;
    store.objects.set(name, damaged);

    const fresh = memoryFs();
    const details = memoryDetails({
      'abc123/m1': detail('m1', ['/old/m1/0-a.pdf']),
    });
    const second = await restoreDocuments(
      stored.documents,
      store.target,
      fresh.fs,
      details.details,
      (boxId, messageId) => `/new/attachments/${boxId}/${messageId}`,
      KEY,
    );
    expect(second).toMatchObject({ restored: 0, failed: 1 });
    // Neither the real name nor the scratch one is left behind: a half-written attachment under the
    // real name is a document the app would open and show as if it were the one that was received.
    expect(fresh.files.has('/new/attachments/abc123/m1/0-a.pdf')).toBe(false);
    expect(fresh.files.has('/new/attachments/abc123/m1/0-a.pdf.part')).toBe(false);
    expect(fs.files.size).toBeGreaterThan(0); // the first, undamaged restore still stands
  });

  // 2026-09-24. On the phone that made the backup every downloaded attachment is already under the name
  // its restore writes to, and that copy was removed before the new one was moved in: a move that then
  // failed lost both.
  it('replaces a copy already under the name once the new one is whole, leaving nothing aside', async () => {
    const { fs, stored, store, files } = await roundTrip([700]);
    const final = '/new/attachments/abc123/m1/0-a.pdf';
    fs.files.set(final, doc(9, 5));
    const again = await restoreDocuments(
      stored.documents,
      store.target,
      fs.fs,
      memoryDetails({ 'abc123/m1': detail('m1', ['/old/m1/0-a.pdf']) }).details,
      (boxId, messageId) => `/new/attachments/${boxId}/${messageId}`,
      KEY,
    );
    expect(again).toMatchObject({ restored: 1, failed: 0 });
    expect(Array.from(fs.files.get(final) ?? [])).toEqual(Array.from(files['/old/m1/0-a.pdf']));
    expect([...fs.files.keys()].filter(k => k.startsWith(final))).toEqual([final]);
  });

  it('keeps the copy already under the name when the new one cannot be moved over it', async () => {
    const { fs, stored, store } = await roundTrip([700]);
    const final = '/new/attachments/abc123/m1/0-a.pdf';
    fs.files.set(final, doc(9, 5));
    fs.failMovesFrom.add(`${final}.part`);
    const again = await restoreDocuments(
      stored.documents,
      store.target,
      fs.fs,
      memoryDetails({ 'abc123/m1': detail('m1', ['/old/m1/0-a.pdf']) }).details,
      (boxId, messageId) => `/new/attachments/${boxId}/${messageId}`,
      KEY,
    );
    expect(again).toMatchObject({ restored: 0, failed: 1 });
    expect(Array.from(fs.files.get(final) ?? [])).toEqual(Array.from(doc(9, 5)));
    expect([...fs.files.keys()].filter(k => k.startsWith(final))).toEqual([final]);
  });

  it('leaves that copy aside, never removed, when it cannot be put back either', async () => {
    const { fs, stored, store } = await roundTrip([700]);
    const final = '/new/attachments/abc123/m1/0-a.pdf';
    fs.files.set(final, doc(9, 5));
    fs.failMovesFrom.add(`${final}.part`);
    fs.failMovesFrom.add(`${final}.old`);
    await restoreDocuments(
      stored.documents,
      store.target,
      fs.fs,
      memoryDetails({ 'abc123/m1': detail('m1', ['/old/m1/0-a.pdf']) }).details,
      (boxId, messageId) => `/new/attachments/${boxId}/${messageId}`,
      KEY,
    );
    expect(Array.from(fs.files.get(`${final}.old`) ?? [])).toEqual(Array.from(doc(9, 5)));
  });

  // Review, 2026-09-24: nothing read an aside copy back, and a stale one that will not delete made the
  // document impossible to replace on iOS, whose move refuses a destination that exists.
  it('puts back a copy a stopped replacement left aside, even when the new one cannot go in', async () => {
    const { fs, stored, store } = await roundTrip([700]);
    const final = '/new/attachments/abc123/m1/0-a.pdf';
    fs.files.delete(final);
    fs.files.set(`${final}.old`, doc(9, 5));
    fs.failMovesFrom.add(`${final}.part`);
    const again = await restoreDocuments(
      stored.documents,
      store.target,
      fs.fs,
      memoryDetails({ 'abc123/m1': detail('m1', ['/old/m1/0-a.pdf']) }).details,
      (boxId, messageId) => `/new/attachments/${boxId}/${messageId}`,
      KEY,
    );
    expect(again).toMatchObject({ restored: 0, failed: 1 });
    expect(Array.from(fs.files.get(final) ?? [])).toEqual(Array.from(doc(9, 5)));
    expect([...fs.files.keys()].filter(k => k.startsWith(final))).toEqual([final]);
  });

  it('replaces a document even when a stale copy aside will not delete', async () => {
    const { fs, stored, store, files } = await roundTrip([700]);
    const final = '/new/attachments/abc123/m1/0-a.pdf';
    fs.files.set(final, doc(9, 5));
    fs.files.set(`${final}.old`, doc(8, 5));
    fs.failRemovesOf.add(`${final}.old`);
    const again = await restoreDocuments(
      stored.documents,
      store.target,
      fs.fs,
      memoryDetails({ 'abc123/m1': detail('m1', ['/old/m1/0-a.pdf']) }).details,
      (boxId, messageId) => `/new/attachments/${boxId}/${messageId}`,
      KEY,
    );
    expect(again).toMatchObject({ restored: 1, failed: 0 });
    expect(Array.from(fs.files.get(final) ?? [])).toEqual(Array.from(files['/old/m1/0-a.pdf']));
    expect([...fs.files.keys()].filter(k => k.startsWith(final)).sort()).toEqual([
      final,
      `${final}.old`,
    ]);
  });

  it('counts a document the store does not have, and carries on', async () => {
    // A portable export carries the archive and not the objects, so the index names documents that
    // are simply not there. One missing object must not cost the others.
    const files = { '/old/m1/0-a.pdf': doc(1, 20), '/old/m1/1-b.pdf': doc(2, 20) };
    const { source } = memorySource(files);
    const store = memoryObjectTarget();
    const paths = Object.keys(files);
    const stored = await backupDocuments(
      [message('abc123', 'm1', paths)],
      source,
      store.target,
      KEY,
      { randomBytes: salts() },
    );
    store.objects.delete([...store.objects.keys()][0]);

    const fs = memoryFs();
    const details = memoryDetails({ 'abc123/m1': detail('m1', paths) });
    const report = await restoreDocuments(
      stored.documents,
      store.target,
      fs.fs,
      details.details,
      (boxId, messageId) => `/new/${boxId}/${messageId}`,
      KEY,
    );
    expect(report).toMatchObject({ restored: 1, missing: 1, failed: 0 });
  });

  it('does not litter the disk for a message this device does not have', async () => {
    const files = { '/old/m1/0-a.pdf': doc(1, 20) };
    const { source } = memorySource(files);
    const store = memoryObjectTarget();
    const stored = await backupDocuments(
      [message('abc123', 'm1', ['/old/m1/0-a.pdf'])],
      source,
      store.target,
      KEY,
      { randomBytes: salts() },
    );
    const fs = memoryFs();
    const report = await restoreDocuments(
      stored.documents,
      store.target,
      fs.fs,
      memoryDetails().details, // nothing on this device
      (boxId, messageId) => `/new/${boxId}/${messageId}`,
      KEY,
    );
    // Files nothing in the app can reach, that removing the box would never clean up, are worse than
    // documents that were not restored.
    expect(report).toMatchObject({ restored: 0, orphaned: 1 });
    expect(fs.files.size).toBe(0);
  });

  it('cannot be opened with a different backup s key', async () => {
    const files = { '/old/m1/0-a.pdf': doc(1, 40) };
    const { source } = memorySource(files);
    const store = memoryObjectTarget();
    const stored = await backupDocuments(
      [message('abc123', 'm1', ['/old/m1/0-a.pdf'])],
      source,
      store.target,
      KEY,
      { randomBytes: salts() },
    );
    const fs = memoryFs();
    const details = memoryDetails({ 'abc123/m1': detail('m1', ['/old/m1/0-a.pdf']) });
    const report = await restoreDocuments(
      stored.documents,
      store.target,
      fs.fs,
      details.details,
      (boxId, messageId) => `/new/${boxId}/${messageId}`,
      OTHER_KEY,
    );
    expect(report).toMatchObject({ restored: 0, failed: 1 });
  });

  it('puts a signed original back and repoints the detail at it (004)', async () => {
    const files = { '/old/m1/0-a.pdf': doc(1, 30), '/old/m1/DZ_m1.zfo': doc(2, 700) };
    const { source } = memorySource(files);
    const store = memoryObjectTarget();
    // A new object each call: the restore rewrites the detail it is handed.
    const onOldPhone = (): MessageDetail => ({
      ...detail('m1', ['/old/m1/0-a.pdf']),
      signedZfo: { fileName: 'DZ_m1.zfo', localPath: '/old/m1/DZ_m1.zfo', size: 700 },
    });
    const stored = await backupDocuments(
      [{ ...message('abc123', 'm1', []), detailJson: JSON.stringify(onOldPhone()) }],
      source,
      store.target,
      KEY,
      { randomBytes: salts() },
    );
    expect(stored.documents.map(d => d.fileName)).toEqual(['0-a.pdf', 'DZ_m1.zfo']);

    const fs = memoryFs();
    const details = memoryDetails({ 'abc123/m1': onOldPhone() });
    const report = await restoreDocuments(
      stored.documents,
      store.target,
      fs.fs,
      details.details,
      (boxId, messageId) => `/new/attachments/${boxId}/${messageId}`,
      KEY,
    );
    expect(report).toMatchObject({ restored: 2, orphaned: 0, failed: 0 });
    const restored = details.held.get('abc123/m1') as MessageDetail;
    expect(restored.signedZfo).toEqual({
      fileName: 'DZ_m1.zfo',
      localPath: '/new/attachments/abc123/m1/DZ_m1.zfo',
      size: 700,
    });
    expect(restored.attachments[0].localPath).toBe('/new/attachments/abc123/m1/0-a.pdf');
    expect(Array.from(fs.files.get('/new/attachments/abc123/m1/DZ_m1.zfo') ?? [])).toEqual(
      Array.from(files['/old/m1/DZ_m1.zfo']),
    );
  });
});

describe('the document key', () => {
  it('round-trips', () => {
    expect(Array.from(decodeDocumentKey(encodeDocumentKey(KEY)))).toEqual(Array.from(KEY));
  });

  it('refuses a key of the wrong size rather than sealing weakly', () => {
    expect(() => decodeDocumentKey('aabb')).toThrow(/wrong size/);
  });
});

describe('what the switch is allowed to promise', () => {
  it('costs what sealedSizeOf says, before a byte is read', async () => {
    // 006 T024: the size has to be shown BEFORE the switch moves, and an estimate that drifts from
    // the real number is worse than none. This one is arithmetic on the file lengths, so it cannot.
    const files = { '/d/m1/0-a.pdf': doc(1, 4000), '/d/m2/0-b.pdf': doc(2, 6000) };
    const { source } = memorySource(files);
    const messages = [
      message('abc123', 'm1', ['/d/m1/0-a.pdf']),
      message('abc123', 'm2', ['/d/m2/0-b.pdf']),
    ];
    const estimate = await estimateDocuments(messages, source);
    const { target } = memoryObjectTarget();
    const real = await backupDocuments(messages, source, target, KEY, { randomBytes: salts() });

    expect(estimate.count).toBe(2);
    expect(estimate.plainBytes).toBe(10000);
    expect(estimate.sealedBytes).toBe(real.sealedBytes);
  });

  it('counts the files that are gone separately, rather than promising to back them up', async () => {
    const { source } = memorySource({ '/d/m1/0-a.pdf': doc(1, 10) });
    const estimate = await estimateDocuments(
      [
        message('abc123', 'm1', ['/d/m1/0-a.pdf']),
        message('abc123', 'm2', ['/d/m2/vanished.pdf']),
      ],
      source,
    );
    expect(estimate).toMatchObject({ count: 1, gone: 1 });
  });
});
