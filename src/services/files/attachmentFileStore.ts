// Attachment content lives as plain files in the app's private storage; the SQLCipher DB keeps only
// metadata + the path. A real file makes native share/view "just work", the size comes from disk
// metadata (no content in memory), memory stays flat, and the DB stays lean. One directory per message
// under DocumentDir/attachments, so a box's files are wiped in one call when it's removed.
// (App-level file encryption is a deferred opt-in feature - today files inherit OS at-rest protection
// inside the sandbox.) Abstracted behind an interface so the controller depends on a fake in tests.

import RNBlobUtil from 'react-native-blob-util';
import { reportFailure } from '../telemetry/telemetry';
import type { MessageAttachment, SignedOriginal } from '../isds/types';

/** Every message's attachment directory lives under this one. */
export const ATTACHMENTS_ROOT = `${RNBlobUtil.fs.dirs.DocumentDir}/attachments`;
const LEGACY_VODZ = `${RNBlobUtil.fs.dirs.DocumentDir}/vodz`; // pre-unification VoDZ files

/** Filesystem-safe path segment. */
function seg(s: string): string {
  return s.replace(/[^A-Za-z0-9._-]/g, '_') || '_';
}

/**
 * The file name of a message's signed original (004 amendment).
 *
 * It starts with a letter, and every attachment file in the same directory starts with its index
 * (`0-…`, or `0_…` for a VoDZ enclosure), so the two cannot collide - which the backup relies on when
 * it puts a stored document back in its place by name.
 */
export function signedOriginalFileName(messageId: string): string {
  return `DZ_${seg(messageId)}.zfo`;
}

const RESERVED = /[\\/:*?"<>|]/g;
/** Keep the original (extension-bearing) name minus path-hostile chars, so the viewer + file-type
    badge still recognise it. */
function safeFileName(name: string, fallback: string): string {
  return name.replace(RESERVED, '_').trim() || fallback;
}

/** Directory holding one message's attachment files (shared with the VoDZ downloader). */
export function attachmentMessageDir(boxId: string, messageId: string): string {
  return `${ATTACHMENTS_ROOT}/${seg(boxId)}/${seg(messageId)}`;
}

export interface AttachmentFileStore {
  /**
   * Write any inline (base64) attachments to disk, returning them with `localPath` + `size` set and
   * `contentBase64` cleared. Attachments already on disk (VoDZ, `localPath` present) pass through.
   */
  persist(
    boxId: string,
    messageId: string,
    attachments: MessageAttachment[],
  ): Promise<MessageAttachment[]>;
  /**
   * Write a message's signed original - `dmSignature`, base64 - to its .zfo file (004 amendment).
   *
   * Null when it could not be written: reported, and never allowed to sink the download it came with,
   * because the attachments beside it are still the user's documents.
   */
  persistSignedZfo(
    boxId: string,
    messageId: string,
    signatureBase64: string,
  ): Promise<SignedOriginal | null>;
  /** Delete a box's whole attachment directory - attachments and signed originals (on box removal). */
  removeForBox(boxId: string): Promise<void>;
  /** Whether a persisted file still exists on disk. */
  exists(localPath: string): Promise<boolean>;
  /**
   * The decoded file's bytes, or null when it is not there any more.
   *
   * Added for the on-device deadline scan (010 US3), which needs to hand a parser the raw PDF. The
   * read goes through base64 rather than blob-util's `'ascii'` mode: `'ascii'` returns a JS array
   * with one boxed number PER BYTE, so a 5 MB document becomes a five-million-element array on the
   * JS heap. One base64 string plus one `Uint8Array` is a fraction of that.
   */
  readBytes(localPath: string): Promise<Uint8Array | null>;
}

class BlobUtilAttachmentFileStore implements AttachmentFileStore {
  async persist(
    boxId: string,
    messageId: string,
    attachments: MessageAttachment[],
  ): Promise<MessageAttachment[]> {
    const { fs } = RNBlobUtil;
    const dir = attachmentMessageDir(boxId, messageId);
    let ensured = false;
    const out: MessageAttachment[] = [];
    for (let i = 0; i < attachments.length; i++) {
      const a = attachments[i];
      // Already a file (VoDZ, or a migrated one): just backfill the size from disk if it's missing.
      if (a.localPath) {
        if (a.size != null) {
          out.push(a);
        } else {
          try {
            out.push({ ...a, size: Number((await fs.stat(a.localPath)).size) });
          } catch (e) {
            // Principle IV again: a downloaded attachment that is no longer on disk is a piece of
            // the archive that has gone missing without anybody being told.
            reportFailure('file.read', e, { stage: 'native' });
            out.push(a); // file gone - leave it; the detail's missing-file handling takes over
          }
        }
        continue;
      }
      if (!a.contentBase64) {
        out.push(a);
        continue;
      }
      if (!ensured) {
        if (!(await fs.exists(dir))) {
          await fs.mkdir(dir);
        }
        ensured = true;
      }
      const path = `${dir}/${i}-${safeFileName(a.name, `priloha-${i}`)}`;
      // ISDS base64 can be line-wrapped; strip whitespace, which strict decoders reject ("bad base-64").
      const b64 = a.contentBase64.replace(/\s+/g, '');
      try {
        await fs.writeFile(path, b64, 'base64');
      } catch (e) {
        // The user asked for this file and it did not land. Whatever the screen says, a write that
        // fails on a full disk looks identical to one that fails on a decode bug.
        reportFailure('file.write', e, { stage: 'native', byteSize: b64.length });
        // A malformed attachment (e.g. base64 the decoder rejects) must NOT sink the whole message
        // download - drop its content and leave it without a localPath, so the message + every other
        // attachment still load. The detail shows it as un-processable (no file, can't open).
        await fs.unlink(path).catch(() => {});
        out.push({ ...a, contentBase64: '' });
        continue;
      }
      const size = Number((await fs.stat(path)).size);
      out.push({ ...a, contentBase64: '', localPath: path, size });
    }
    return out;
  }

  async persistSignedZfo(
    boxId: string,
    messageId: string,
    signatureBase64: string,
  ): Promise<SignedOriginal | null> {
    const { fs } = RNBlobUtil;
    const dir = attachmentMessageDir(boxId, messageId);
    const fileName = signedOriginalFileName(messageId);
    const path = `${dir}/${fileName}`;
    // Stripped for the same reason as an attachment's: XML base64 may be line-wrapped, and the native
    // decoder rejects whitespace. What lands on disk is the exact bytes ISDS signed.
    const b64 = signatureBase64.replace(/\s+/g, '');
    try {
      if (!(await fs.exists(dir))) {
        await fs.mkdir(dir);
      }
      await fs.writeFile(path, b64, 'base64');
      return { fileName, localPath: path, size: Number((await fs.stat(path)).size) };
    } catch (e) {
      // Principle IV: the original was in hand and did not reach the archive. Reported, and the
      // download it came with still stands.
      reportFailure('file.write', e, { stage: 'native', byteSize: b64.length });
      await fs.unlink(path).catch(() => {});
      return null;
    }
  }

  async removeForBox(boxId: string): Promise<void> {
    const { fs } = RNBlobUtil;
    // Both the unified dir and the legacy VoDZ dir (fixes a pre-existing orphan: clearBox never
    // deleted on-disk VoDZ files). unlink removes a directory recursively.
    for (const dir of [`${ATTACHMENTS_ROOT}/${seg(boxId)}`, `${LEGACY_VODZ}/${seg(boxId)}`]) {
      if (await fs.exists(dir)) {
        await fs.unlink(dir);
      }
    }
  }

  exists(localPath: string): Promise<boolean> {
    return RNBlobUtil.fs.exists(localPath);
  }

  async readBytes(localPath: string): Promise<Uint8Array | null> {
    try {
      if (!(await RNBlobUtil.fs.exists(localPath))) {
        return null;
      }
      const b64 = await RNBlobUtil.fs.readFile(localPath, 'base64');
      return base64ToBytes(typeof b64 === 'string' ? b64 : '');
    } catch (e) {
      // Principle IV: the local archive is sacred and is NEVER silently lost. A file that exists but
      // will not read is precisely a silent loss, and this was the only place it could happen
      // without anybody finding out.
      reportFailure('file.read', e, { stage: 'native' });
      return null; // a file that cannot be read is "no text", not a crash
    }
  }
}

/** base64 → bytes, via the platform's `atob` (RN polyfills it; also present under Jest's jsdom). */
function base64ToBytes(b64: string): Uint8Array | null {
  const clean = b64.replace(/[\r\n\s]/g, '');
  if (clean === '') {
    return null;
  }
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

/** Device attachment file store (singleton). */
export const attachmentFileStore: AttachmentFileStore =
  new BlobUtilAttachmentFileStore();
