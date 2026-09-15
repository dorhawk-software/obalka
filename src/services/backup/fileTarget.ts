// Backups as files on the device (006 T011b) - the `SyncTarget` that needs no cloud account.
//
// This is not a stepping stone to the real thing. It is export/import for anyone who does not want
// their government mail in an iCloud or Google account at all, and - because it needs no entitlement
// - it is the only backup path that can be walked on an unsigned iOS build.
//
// The filesystem is injected. `react-native-blob-util` is native, so the wiring below cannot run in
// jest; the LOGIC around it (which files are backups, what happens when one is corrupt, how a
// manifest maps to its archive) is the part worth testing, and it is testable this way.

import type { BackupManifest } from './schema';
import type { SyncTarget } from './backupService';
import type { ChunkSource } from './fileSeal';
import { chunksOnRequest } from '../files/sliceSource';
import { reportFailure } from '../telemetry/telemetry';

/** The sliver of a filesystem this needs. Implemented over blob-util in `deps.ts`. */
export interface BackupFs {
  ensureDir(path: string): Promise<void>;
  list(path: string): Promise<string[]>;
  readText(path: string): Promise<string>;
  writeText(path: string, text: string): Promise<void>;
  readBytes(path: string): Promise<Uint8Array>;
  /**
   * Read a file a slice at a time, so a sealed document can be read back without holding it whole
   * (025 review, 2026-09-15).
   *
   * `readBytes` is for what is small by construction - a manifest, an archive of metadata. A document
   * object can be a 100 MB large-volume attachment or a signed original bigger than that, and reading
   * one whole puts all of it in the JS heap, as base64 first. A missing file rejects with a message
   * that says so ("no such file"), which is how a restore tells a document that never travelled from
   * one that did not survive.
   */
  open(path: string): Promise<ChunkSource>;
  writeBytes(path: string, bytes: Uint8Array): Promise<void>;
  /**
   * Append, so a sealed document can be written a chunk at a time (006 T019).
   *
   * Without this the whole sealed file would have to exist in memory before the first byte reached
   * disk, which is the thing chunking was for.
   */
  appendBytes(path: string, bytes: Uint8Array): Promise<void>;
  exists(path: string): Promise<boolean>;
  /**
   * Rename, so a file written under a scratch name can become the real one without being copied.
   *
   * The first version of `putObject` read the finished temporary file back and wrote it out again,
   * which quietly undid the whole reason documents are sealed a chunk at a time: a 40 MB attachment
   * landed in memory whole at the last step. A move is the operation that was actually wanted.
   */
  move(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
}

const MANIFEST_SUFFIX = '.manifest.json';

export function fileSyncTarget(fs: BackupFs, dir: string): SyncTarget {
  const path = (name: string) => `${dir}/${name}`;
  return {
    async listManifests() {
      await fs.ensureDir(dir);
      const names = (await fs.list(dir)).filter(n => n.endsWith(MANIFEST_SUFFIX));
      const out: BackupManifest[] = [];
      for (const name of names) {
        try {
          out.push(JSON.parse(await fs.readText(path(name))) as BackupManifest);
        } catch (e) {
          // One unreadable manifest must not hide the others. A folder with a corrupt file in it is
          // exactly when someone needs the backups that are still fine - and a backup that has
          // silently become unlistable is a backup the user believes they have.
          reportFailure('backup.restore', e, { stage: 'parse' });
        }
      }
      return out;
    },

    async putBackup(manifest, archive) {
      await fs.ensureDir(dir);
      // Archive first, manifest second, deliberately: the manifest is what makes a backup visible, so
      // an interruption leaves an orphaned archive (invisible, harmless) rather than a manifest
      // pointing at bytes that were never finished.
      await fs.writeBytes(path(manifest.archiveName), archive);
      await fs.writeText(
        path(`${manifest.archiveName}${MANIFEST_SUFFIX}`),
        JSON.stringify(manifest),
      );
    },

    getArchive(archiveName) {
      return fs.readBytes(path(archiveName));
    },

    // ── Tier 2 documents ────────────────────────────────────────────────────────────────────────
    //
    // Flat, beside the archives, named by the keyed content id. Flat because the names are already
    // unique by construction and a directory tree would only add a second thing to keep consistent.

    async hasObject(name) {
      await fs.ensureDir(dir);
      return fs.exists(path(name));
    },

    async putObject(name, source) {
      await fs.ensureDir(dir);
      // Written to a temporary name and moved into place at the end. An interrupted write must not
      // leave a SHORT file under the real name: the name is a content id, so a later run would find
      // it, believe the document is already stored, and skip it forever. A partial file under a
      // scratch name is merely litter.
      const temp = path(`${name}.part`);
      await fs.remove(temp).catch(() => undefined);
      let first = true;
      for (;;) {
        const chunk = await source();
        if (chunk == null) {
          break;
        }
        if (first) {
          await fs.writeBytes(temp, chunk);
          first = false;
        } else {
          await fs.appendBytes(temp, chunk);
        }
      }
      if (first) {
        await fs.writeBytes(temp, new Uint8Array(0));
      }
      await fs.remove(path(name)).catch(() => undefined);
      await fs.move(temp, path(name));
    },

    async getObject(name) {
      // A slice at a time, the way the write path already was (025 review, 2026-09-15). This used
      // to read the object whole on the grounds that a restore runs once and ISDS bounds what one
      // message carries - but a large-volume attachment is up to 100 MB and a signed original is
      // larger than what it seals, and a restore that runs out of memory on the one document that
      // mattered is not a rare case to accept. The signature was a puller for exactly this.
      return chunksOnRequest(await fs.open(path(name)));
    },

    async deleteBackup(archiveName) {
      // Manifest first, archive second - the mirror image of writing. The manifest is what makes a
      // backup visible, so removing it first means an interrupted delete leaves an invisible orphan
      // rather than a listed backup whose bytes are gone.
      for (const name of [`${archiveName}${MANIFEST_SUFFIX}`, archiveName]) {
        try {
          await fs.remove(path(name));
        } catch {
          // Already gone is the desired state, not a failure.
        }
      }
    },
  };
}
