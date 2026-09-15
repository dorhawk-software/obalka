// The file target (006 T011b) - everything around the filesystem, which is the part that can go wrong.
//
// blob-util itself is native and cannot run here; what is testable is the logic: which files count as
// backups, what a corrupt one does to the others, and the write ORDER that decides what an
// interruption leaves behind.

import { fileSyncTarget, type BackupFs } from '../../src/services/backup/fileTarget';
import type { BackupManifest } from '../../src/services/backup/schema';

const manifest = (name: string): BackupManifest => ({
  formatVersion: 1,
  schemaVersion: 1,
  appVersion: '0.0.1',
  createdAt: 5,
  tiers: { metadata: true, documents: false },
  sizeBytes: 3,
  archiveName: name,
});

function memoryFs() {
  const files = new Map<string, string | Uint8Array>();
  const order: string[] = [];
  /** Every path read WHOLE, which is what a document must never be (025 review, 2026-09-15). */
  const wholeReads: string[] = [];
  let failOn: string | null = null;
  const fs: BackupFs = {
    ensureDir: async () => {},
    list: async () => [...files.keys()].map(k => k.split('/').pop() as string),
    readText: async p => {
      const v = files.get(p);
      if (typeof v !== 'string') {
        throw new Error('not text');
      }
      return v;
    },
    writeText: async (p, t) => {
      if (failOn === p) {
        throw new Error('interrupted');
      }
      order.push(p);
      files.set(p, t);
    },
    readBytes: async p => {
      wholeReads.push(p);
      const v = files.get(p);
      if (!(v instanceof Uint8Array)) {
        throw new Error('not bytes');
      }
      return v;
    },
    // Sixteen bytes a slice, so any document worth the name takes several.
    open: async p => {
      const v = files.get(p);
      if (!(v instanceof Uint8Array)) {
        throw new Error(`no such file: ${p}`);
      }
      let at = 0;
      return async () => {
        if (at >= v.length) {
          return null;
        }
        const piece = v.slice(at, at + 16);
        at += piece.length;
        return piece;
      };
    },
    writeBytes: async (p, b) => {
      order.push(p);
      files.set(p, b);
    },
    appendBytes: async (p, b) => {
      const prev = files.get(p);
      const head = prev instanceof Uint8Array ? prev : new Uint8Array(0);
      const out = new Uint8Array(head.length + b.length);
      out.set(head, 0);
      out.set(b, head.length);
      files.set(p, out);
    },
    exists: async p => files.has(p),
    move: async (from, to) => {
      const v = files.get(from);
      if (v == null) {
        throw new Error(`no such file: ${from}`);
      }
      order.push(to);
      files.set(to, v);
      files.delete(from);
    },
    remove: async p => {
      files.delete(p);
    },
  };
  return { fs, files, order, wholeReads, failWriting: (p: string) => { failOn = p; } };
}

describe('the file target', () => {
  it('round-trips a backup', async () => {
    const { fs } = memoryFs();
    const target = fileSyncTarget(fs, '/docs/backups');
    const archive = new Uint8Array([1, 2, 3]);
    await target.putBackup(manifest('b1.backup'), archive);
    expect(await target.listManifests()).toHaveLength(1);
    expect(await target.getArchive('b1.backup')).toEqual(archive);
  });

  it('writes the archive BEFORE the manifest', async () => {
    // The manifest is what makes a backup visible. Writing it first would mean an interruption leaves
    // a listed backup whose bytes were never finished - a backup that exists until you need it.
    const { fs, order } = memoryFs();
    await fileSyncTarget(fs, '/docs/backups').putBackup(manifest('b1.backup'), new Uint8Array([1]));
    expect(order).toEqual(['/docs/backups/b1.backup', '/docs/backups/b1.backup.manifest.json']);
  });

  it('leaves an interrupted backup invisible rather than broken', async () => {
    const { fs, failWriting } = memoryFs();
    const target = fileSyncTarget(fs, '/docs/backups');
    failWriting('/docs/backups/b1.backup.manifest.json');
    await expect(target.putBackup(manifest('b1.backup'), new Uint8Array([1]))).rejects.toThrow();
    // The orphaned archive is harmless; nothing lists it, and the next backup overwrites the name.
    expect(await target.listManifests()).toEqual([]);
  });

  it('does not let one corrupt manifest hide the others', async () => {
    // A folder with a damaged file in it is exactly when the surviving backups matter most.
    const { fs, files } = memoryFs();
    const target = fileSyncTarget(fs, '/docs/backups');
    await target.putBackup(manifest('good.backup'), new Uint8Array([1]));
    files.set('/docs/backups/bad.backup.manifest.json', '{ this is not json');
    const found = await target.listManifests();
    expect(found.map(m => m.archiveName)).toEqual(['good.backup']);
  });

  it('ignores files that are not backups at all', async () => {
    const { fs, files } = memoryFs();
    files.set('/docs/backups/notes.txt', 'hello');
    expect(await fileSyncTarget(fs, '/docs/backups').listManifests()).toEqual([]);
  });
});

// ── Tier 2 documents (006 T020, T021) ────────────────────────────────────────────────────────────

describe('storing documents', () => {
  const pull = (bytes: Uint8Array, chunk: number) => {
    let o = 0;
    return async () => {
      if (o >= bytes.length) {
        return null;
      }
      const piece = bytes.subarray(o, Math.min(o + chunk, bytes.length));
      o += piece.length;
      return piece;
    };
  };

  const drain = async (
    get: (n: number) => Promise<Uint8Array | null>,
    step = 8,
  ) => {
    const out: number[] = [];
    for (;;) {
      const piece = await get(step);
      if (!piece || piece.length === 0) {
        break;
      }
      out.push(...piece);
    }
    return out;
  };

  it('writes a document in pieces and reads it back whole', async () => {
    const { fs } = memoryFs();
    const t = fileSyncTarget(fs, '/b');
    const data = new Uint8Array(100).map((_, i) => i);
    await t.putObject!('doc-abc', pull(data, 7));
    expect(await drain(await t.getObject!('doc-abc'))).toEqual(Array.from(data));
  });

  it('reads a document back a slice at a time, never whole', async () => {
    // It read the object whole and handed out pieces of that, so a 100 MB large-volume attachment
    // or a signed original had to fit in the JS heap at once during a restore.
    const { fs, wholeReads } = memoryFs();
    const t = fileSyncTarget(fs, '/b');
    const data = new Uint8Array(100).map((_, i) => 255 - i);
    await t.putObject!('doc-big', pull(data, 30));

    const get = await t.getObject!('doc-big');
    const pieces: number[] = [];
    for (let piece = await get(40); piece != null; piece = await get(40)) {
      expect(piece.length).toBeLessThanOrEqual(16);
      pieces.push(...piece);
    }
    expect(pieces).toEqual(Array.from(data));
    expect(wholeReads).not.toContain('/b/doc-big');
  });

  it('knows what it already holds, which is what makes a resume possible', async () => {
    const { fs } = memoryFs();
    const t = fileSyncTarget(fs, '/b');
    expect(await t.hasObject!('doc-abc')).toBe(false);
    await t.putObject!('doc-abc', pull(new Uint8Array([1, 2, 3]), 2));
    expect(await t.hasObject!('doc-abc')).toBe(true);
  });

  it('leaves no half-written object under a name a later run would trust', async () => {
    // The failure that matters: the name is a content id, so a short file under the REAL name would
    // make every future backup skip that document, permanently. A partial write must be invisible.
    const { fs, files } = memoryFs();
    const t = fileSyncTarget(fs, '/b');
    let served = 0;
    await expect(
      t.putObject!('doc-abc', async () => {
        served += 1;
        if (served === 1) {
          return new Uint8Array([1, 2, 3]);
        }
        throw new Error('battery died');
      }),
    ).rejects.toThrow('battery died');

    expect(await t.hasObject!('doc-abc')).toBe(false);
    expect([...files.keys()].some(k => k.endsWith('doc-abc'))).toBe(false);
  });

  it('stores an empty document as an empty object rather than nothing', async () => {
    const { fs } = memoryFs();
    const t = fileSyncTarget(fs, '/b');
    await t.putObject!('doc-empty', async () => null);
    expect(await t.hasObject!('doc-empty')).toBe(true);
    expect(await drain(await t.getObject!('doc-empty'))).toEqual([]);
  });
});
