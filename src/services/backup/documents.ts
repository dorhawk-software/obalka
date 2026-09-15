// Tier 2: the documents themselves (006 T021-T022).
//
// Tier 1 backs up what the archive SAYS - envelopes, bodies, the description of each attachment.
// Tier 2 backs up the attachments: the scanned decision, the PDF with the deadline in it, the thing
// the whole archive exists to hold on to after ISDS deletes its own copy at 90 days.
//
// Two properties shape everything below, and neither is about encryption.
//
// **A re-backup of an unchanged archive must upload nothing.** An archive is the sum of every
// document ever received and it only grows; re-uploading all of it after every sync is not a slow
// feature, it is an unusable one. So each document is named by its content (`contentId.ts`) and a
// name already present in the store is skipped. That also makes an interrupted run resumable for
// free: the next one simply finds most of the work already done.
//
// **One bad document costs one document.** A file that has been deleted under the app, a disk that
// fails halfway, an object missing from the store - each of those is one attachment, and none of
// them may take the other four hundred with it. Every per-file step is wrapped, counted and stepped
// over, and the report says how many, because a restore that silently drops documents is the exact
// failure this feature exists to prevent (Principle IV).
//
// The document key is NOT derived from the recovery key here. It is a random key carried inside the
// sealed payload (`schema.ts`), which is what lets a backup run cost one Argon2id derivation rather
// than two, and what lets a restored phone go on naming documents the way the old one did - without
// that, every object already in the store would become unreachable litter and the first backup after
// a restore would upload the entire archive again.

import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { contentIdStream, deriveContentIdKey, objectNameFor } from './contentId';
import { openFile, sealedSizeOf, sealedSource, type ChunkSource } from './fileSeal';
import { BULK_KEY_BYTES } from './bulkCipher';
import { BackupAbortedError, throwIfCancelled, type CancelSignal } from './progress';
import { reportFailure } from '../telemetry/telemetry';
import type { BackupDocument, BackupMessage } from './schema';
import type { SyncTarget } from './backupService';
import type { MessageDetail } from '../isds/types';
import { moveIntoPlace } from '../files/moveIntoPlace';

/** Reading this device's attachment files. Two operations, so it is trivial to fake in a test. */
export interface DocumentSource {
  /** The file's size, or null when it is not on disk any more - which is not an error. */
  sizeOf(path: string): Promise<number | null>;
  /** Read the file in pieces, never whole. A fresh reader per call: the backup makes two passes. */
  open(path: string): Promise<ChunkSource>;
}

/** Writing them back. The subset of `BackupFs` a restore needs, named for what it is used for. */
export interface DocumentFs {
  ensureDir(path: string): Promise<void>;
  writeBytes(path: string, bytes: Uint8Array): Promise<void>;
  appendBytes(path: string, bytes: Uint8Array): Promise<void>;
  exists(path: string): Promise<boolean>;
  /** Neither platform's move writes over a file: iOS refuses, Android deletes the destination first. */
  move(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
}

/**
 * Reading and rewriting a message's stored detail.
 *
 * The restore has to touch this because `localPath` in `detailJson` is an ABSOLUTE path recorded on
 * whichever device made the backup. On iOS the app container's directory changes on every reinstall,
 * so those paths are stale the moment they land - restoring the bytes without repointing the detail
 * at them would put the documents on disk where nothing in the app would ever open them.
 */
export interface DocumentDetails {
  getDetail(boxId: string, messageId: string): Promise<MessageDetail | null>;
  putDetail(boxId: string, messageId: string, detail: MessageDetail): Promise<void>;
}

export type DocumentProgress = (
  done: number,
  total: number,
  detail?: string,
) => void;

export interface DocumentBackupReport {
  /** The index that goes into the payload. */
  documents: BackupDocument[];
  /** Stored for the first time by this run. */
  uploaded: number;
  /** Already in the store under the same name, so not uploaded again (T021). */
  reused: number;
  /** Named in the archive but no longer on disk. Not a failure: Tier 1 still carries the fact. */
  gone: number;
  /** Could not be read or stored. Counted, never fatal. */
  failed: number;
  /** What the index occupies in the store, sealed. */
  sealedBytes: number;
}

/**
 * The document key as it travels and as it is stored: hex.
 *
 * Hex rather than base64 because the payload is JSON read by two implementations already (the app
 * and, during the T014 walk, a script on a laptop), and a wrong `atob` polyfill is a silent way to
 * lose the one key that makes every stored object readable.
 */
export const encodeDocumentKey = (key: Uint8Array): string => bytesToHex(key);

export function decodeDocumentKey(hex: string): Uint8Array {
  const key = hexToBytes(hex);
  if (key.length !== BULK_KEY_BYTES) {
    throw new Error('The backup carries a document key of the wrong size.');
  }
  return key;
}

/** One attachment file, as this device holds it. */
export interface DocumentCandidate {
  boxId: string;
  messageId: string;
  fileName: string;
  path: string;
}

/** Everything Tier 2 could carry, found in the details Tier 1 has already read. */
export function documentCandidates(
  messages: readonly BackupMessage[],
): DocumentCandidate[] {
  const out: DocumentCandidate[] = [];
  const seen = new Set<string>();
  for (const message of messages) {
    if (!message.detailJson) {
      continue;
    }
    let detail: MessageDetail;
    try {
      detail = JSON.parse(message.detailJson) as MessageDetail;
    } catch {
      continue; // Tier 1 keeps whatever it holds; an unparseable detail simply carries no documents
    }
    // The signed original goes with the attachments (004 amendment): it is the one document a dispute
    // about the message turns on, and ISDS drops it with the rest after 90 days.
    const paths = [
      ...(detail.attachments ?? []).map(attachment => attachment.localPath),
      detail.signedZfo?.localPath,
    ];
    for (const path of paths) {
      if (!path) {
        continue; // never downloaded, or a legacy inline detail - there is no file to carry
      }
      const fileName = baseName(path);
      // One file per message per name. A detail that lists the same path twice is not two documents.
      const key = `${message.boxId} ${message.messageId} ${fileName}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      out.push({ boxId: message.boxId, messageId: message.messageId, fileName, path });
    }
  }
  return out;
}

/** The last path segment, without a path module React Native does not ship. */
export function baseName(path: string): string {
  const cut = path.lastIndexOf('/');
  return cut < 0 ? path : path.slice(cut + 1);
}

/**
 * Store every document the archive still has on disk, skipping what the target already holds.
 *
 * TWO passes over each file, deliberately. The first names it, the second seals it - and the second
 * runs only when the name turns out to be new. The alternative, sealing as it names, would mean
 * writing a full sealed copy of every attachment on every backup and throwing almost all of it away,
 * which is precisely the cost T021 exists to remove. Two reads and no writes is the right shape for
 * the case that happens every time: nothing has changed.
 */
export async function backupDocuments(
  messages: readonly BackupMessage[],
  source: DocumentSource,
  target: SyncTarget,
  documentKey: Uint8Array,
  options: {
    randomBytes: (n: number) => Uint8Array;
    onProgress?: DocumentProgress;
    signal?: CancelSignal;
  },
): Promise<DocumentBackupReport> {
  if (documentKey.length !== BULK_KEY_BYTES) {
    throw new Error('bad document key');
  }
  const { hasObject, putObject } = target;
  if (!hasObject || !putObject) {
    throw new Error('This backup destination cannot hold documents.');
  }
  const idKey = deriveContentIdKey(documentKey);
  const candidates = documentCandidates(messages);
  const report: DocumentBackupReport = {
    documents: [],
    uploaded: 0,
    reused: 0,
    gone: 0,
    failed: 0,
    sealedBytes: 0,
  };
  options.onProgress?.(0, candidates.length);

  for (let i = 0; i < candidates.length; i++) {
    throwIfCancelled(options.signal);
    const candidate = candidates[i];
    try {
      const sizeBytes = await source.sizeOf(candidate.path);
      if (sizeBytes == null) {
        // The file the detail names is not on disk. Tier 1 still carries the description of it,
        // which is what the app shows as "no longer available" - a fact, not a failure.
        report.gone++;
      } else {
        const contentId = await nameOf(idKey, await source.open(candidate.path));
        const objectName = objectNameFor(contentId);
        if (await hasObject(objectName)) {
          report.reused++;
        } else {
          await putObject(
            objectName,
            sealedSource(
              documentKey,
              options.randomBytes(FILE_SALT),
              await source.open(candidate.path),
            ),
          );
          report.uploaded++;
        }
        report.documents.push({
          boxId: candidate.boxId,
          messageId: candidate.messageId,
          fileName: candidate.fileName,
          contentId,
          sizeBytes,
        });
        report.sealedBytes += sealedSizeOf(sizeBytes);
      }
    } catch (e) {
      if (e instanceof BackupAbortedError) {
        throw e; // a cancel is the user's decision and passes through every per-file guard
      }
      // One document, not the run. The count is what the user is told; the report is for us.
      reportFailure('backup.document', e, { stage: 'persist' });
      report.failed++;
    }
    options.onProgress?.(i + 1, candidates.length, candidate.fileName);
  }
  return report;
}

/** Per-file HKDF salt, as `fileSeal` sizes it. */
const FILE_SALT = 16;

/** Stream a file through the naming HMAC without ever holding it whole. */
async function nameOf(idKey: Uint8Array, read: ChunkSource): Promise<string> {
  const stream = contentIdStream(idKey);
  for (;;) {
    const piece = await read();
    if (piece == null) {
      return stream.digest();
    }
    stream.update(piece);
  }
}

export interface DocumentRestoreReport {
  /** Written back to disk and pointed at by the message's detail. */
  restored: number;
  /** The object is not in the store - a metadata-only copy of a backup that had documents. */
  missing: number;
  /** No message or no attachment on this device to attach the file to. */
  orphaned: number;
  /** Fetched but could not be opened or written. Counted, never fatal. */
  failed: number;
  bytes: number;
}

/**
 * Put the documents back, and make the paths in `detailJson` point at them.
 *
 * Grouped per MESSAGE rather than per file, because the detail is rewritten once for all of a
 * message's attachments - and because a message that is not on this device has nowhere to put its
 * documents, which is worth knowing before fetching any of them.
 */
export async function restoreDocuments(
  documents: readonly BackupDocument[],
  target: SyncTarget,
  fs: DocumentFs,
  details: DocumentDetails,
  messageDir: (boxId: string, messageId: string) => string,
  documentKey: Uint8Array,
  options: { onProgress?: DocumentProgress; signal?: CancelSignal } = {},
): Promise<DocumentRestoreReport> {
  const report: DocumentRestoreReport = {
    restored: 0,
    missing: 0,
    orphaned: 0,
    failed: 0,
    bytes: 0,
  };
  if (documents.length === 0) {
    return report;
  }
  if (documentKey.length !== BULK_KEY_BYTES) {
    throw new Error('bad document key');
  }

  const groups = new Map<string, BackupDocument[]>();
  for (const document of documents) {
    const key = `${document.boxId} ${document.messageId}`;
    const group = groups.get(key);
    if (group) {
      group.push(document);
    } else {
      groups.set(key, [document]);
    }
  }

  let done = 0;
  const step = (fileName?: string) =>
    options.onProgress?.(++done, documents.length, fileName);

  for (const group of groups.values()) {
    throwIfCancelled(options.signal);
    const { boxId, messageId } = group[0];
    const detail = await details.getDetail(boxId, messageId);
    if (!detail) {
      // Writing the bytes anyway would leave files on disk that nothing in the app can reach and
      // that removing the box would never clean up. Better counted than littered.
      report.orphaned += group.length;
      for (const document of group) {
        step(document.fileName);
      }
      continue;
    }
    const dir = messageDir(boxId, messageId);
    let touched = false;
    for (const document of group) {
      throwIfCancelled(options.signal);
      const attachment = (detail.attachments ?? []).find(
        a => a.localPath != null && baseName(a.localPath) === document.fileName,
      );
      // Or the message's signed original (004 amendment), matched by name the same way. The names
      // cannot collide: an attachment's starts with its index, an original's with a letter.
      const original =
        detail.signedZfo != null && baseName(detail.signedZfo.localPath) === document.fileName
          ? detail.signedZfo
          : null;
      if (!attachment && !original) {
        report.orphaned++;
        step(document.fileName);
        continue;
      }
      const final = `${dir}/${document.fileName}`;
      const partial = `${final}.part`;
      try {
        if (!target.getObject) {
          throw new Error('This backup destination does not hold documents.');
        }
        const read = await target.getObject(objectNameFor(document.contentId));
        await fs.ensureDir(dir);
        await fs.remove(partial).catch(() => undefined);
        let first = true;
        let written = 0;
        await openFile(documentKey, read, async bytes => {
          if (first) {
            await fs.writeBytes(partial, bytes);
            first = false;
          } else {
            await fs.appendBytes(partial, bytes);
          }
          written += bytes.length;
        });
        if (first) {
          await fs.writeBytes(partial, new Uint8Array(0));
        }
        // Into place only once the whole file has verified. A half-written attachment under the real
        // name is a document the app would open and show as if it were the one that was received. On the
        // phone that made the backup a downloaded copy is already under that name, and it is moved aside,
        // never removed first (2026-09-24): a move that failed after a removal lost both.
        await moveIntoPlace(fs, partial, final);
        if (attachment) {
          attachment.localPath = final;
          attachment.size = written;
          attachment.contentBase64 = '';
        } else if (original) {
          original.localPath = final;
          original.size = written;
        }
        report.restored++;
        report.bytes += written;
        touched = true;
      } catch (e) {
        if (e instanceof BackupAbortedError) {
          throw e;
        }
        await fs.remove(partial).catch(() => undefined);
        // Told apart because the remedies differ: a missing object means this copy of the backup
        // never carried the documents, and a failure means this one did not survive.
        if (isMissingObject(e)) {
          report.missing++;
        } else {
          reportFailure('backup.document', e, { stage: 'persist' });
          report.failed++;
        }
      }
      step(document.fileName);
    }
    if (touched) {
      await details.putDetail(boxId, messageId, detail);
    }
  }
  return report;
}

/**
 * What the documents would cost, without reading a byte of them (006 T024).
 *
 * The switch has to say what enabling documents will occupy BEFORE it is enabled, and an estimate
 * that drifts from the real number is worse than no number at all. This one does not drift: the
 * sealed size of a file is arithmetic on its length (`sealedSizeOf`), and the length comes from the
 * filesystem. What it cannot know is how much of that the store already holds, so it is an upper
 * bound - and the copy that shows it says so.
 */
export async function estimateDocuments(
  messages: readonly BackupMessage[],
  source: DocumentSource,
): Promise<{ count: number; plainBytes: number; sealedBytes: number; gone: number }> {
  let count = 0;
  let plainBytes = 0;
  let sealedBytes = 0;
  let gone = 0;
  for (const candidate of documentCandidates(messages)) {
    const size = await source.sizeOf(candidate.path).catch(() => null);
    if (size == null) {
      gone++;
      continue;
    }
    count++;
    plainBytes += size;
    sealedBytes += sealedSizeOf(size);
  }
  return { count, plainBytes, sealedBytes, gone };
}

/**
 * "The object is not there", as every target says it differently.
 *
 * Matched on the message rather than on a type because the targets are a filesystem today and an
 * HTTP API tomorrow, and neither throws anything this module defines.
 */
function isMissingObject(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  return /not exist|no such file|ENOENT|not found|404/i.test(message);
}
