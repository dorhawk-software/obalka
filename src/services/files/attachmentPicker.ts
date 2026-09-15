// Attachment picker (feature 005, T006). Select documents, check that the message would still fit,
// then read each file as base64 in chunks the person can watch and stop.
//
// The read runs in native code (react-native-blob-util `readStream`): the file I/O and the base64
// encode happen on the library's own background queue, and each chunk arrives as its own event, so
// between chunks the JS thread is free to render frames and answer touches (constitution Principle
// I). The chunking is what makes progress and cancel possible at all - the whole-file `readFile` this
// replaced handed back one string at the end, with nothing to show before it and no way to stop it.
//
// Returns a typed outcome and never throws: every failure is one the compose screen can put into
// words (Principle II). The caller marks the first document as the "main" one (ISDS requires one).

import {
  pick,
  keepLocalCopy,
  errorCodes,
  isErrorWithCode,
} from '@react-native-documents/picker';
import RNBlobUtil from 'react-native-blob-util';
import type { OutgoingDocument } from '../isds/types';
import { VODZ_MAX_BYTES } from '../../features/messages/state/costModel';
import {
  READ_CHUNK_BYTES,
  decodedByteLength,
  isPaddedBase64,
} from './base64Stream';
import { localCopyCleanupPath, localCopyPath } from './localCopyPath';

/**
 * The pause the native reader takes between chunks, in ms - the library's own default, written down
 * so it is a decision rather than an accident. It paces the 2 MiB events so a fast disk cannot queue
 * several of them ahead of the frames and touches the JS thread also has to handle. At ~67 chunks for
 * the largest message ISDS accepts, it adds well under a second.
 */
const READ_TICK_MS = 10;

/** How far a pick has got. */
export interface ReadProgress {
  /**
   * `copying` while the picked files are copied into the app's cache - the picker hands out
   * `content://` URIs that cannot be streamed, and on Android a cloud file is downloaded here, so this
   * can take a while with no byte count to show. `reading` once the bytes are streaming in.
   */
  readonly stage: 'copying' | 'reading';
  /** Bytes of the files streamed in so far (0 while copying). */
  readonly readBytes: number;
  /** Bytes this pick will read: the picker's sizes while copying, the copies' real sizes after. */
  readonly totalBytes: number;
}

export interface PickOptions {
  /** Bytes already attached to this message. The cap is on the MESSAGE, not on each file. */
  readonly attachedBytes: number;
  /** Abort to cancel: the partial read is discarded, and nothing is attached. */
  readonly signal: AbortSignal;
  /** Called as the pick moves - first once the selection has passed the cap, then per chunk read. */
  readonly onProgress?: (progress: ReadProgress) => void;
}

export type PickOutcome =
  | { kind: 'picked'; documents: OutgoingDocument[] }
  /** The picker was closed without choosing anything. */
  | { kind: 'dismissed' }
  /** The person cancelled. Nothing was attached, and the cache copies are gone. */
  | { kind: 'cancelled' }
  /** Attaching the selection would take the message over what ISDS carries (`VODZ_MAX_BYTES`). */
  | { kind: 'tooLarge'; messageBytes: number; limitBytes: number }
  /** The picker, the copy or the read failed. Nothing was attached. */
  | { kind: 'failed' };

/** True when the user dismissed the picker (not a real error). */
function isCancel(e: unknown): boolean {
  return isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED;
}

/** A picked file copied into the app's cache, with its real size on disk. */
interface LocalCopy {
  fileName: string;
  mimeType: string;
  path: string;
  sizeBytes: number;
}

function tooLarge(messageBytes: number): PickOutcome {
  return { kind: 'tooLarge', messageBytes, limitBytes: VODZ_MAX_BYTES };
}

/** Remove the cache copies of a pick that will not be attached. Best effort: a leftover is harmless. */
async function discard(copies: readonly LocalCopy[]): Promise<void> {
  await Promise.all(
    copies.map(c => RNBlobUtil.fs.unlink(c.path).catch(() => {})),
  );
}

/**
 * Stream one file in as base64, reporting each chunk's byte count as it lands. Resolves `null` the
 * moment `signal` aborts, with everything read so far dropped; rejects on a read error, or on a
 * stream whose chunks cannot be joined into the file's base64.
 *
 * What cancel can and cannot do: `readStream` has no way to stop the native loop, so the reader runs
 * on to the end of the file on its background queue. Its remaining chunks still arrive and are
 * dropped on arrival - no copy, no progress - and the partial base64 is released at once, so the
 * person gets the screen back without waiting for a file they no longer want.
 */
async function readBase64(
  path: string,
  signal: AbortSignal,
  onBytes: (bytes: number) => void,
): Promise<string | null> {
  if (signal.aborted) {
    return null;
  }
  const stream = await RNBlobUtil.fs.readStream(
    path,
    'base64',
    READ_CHUNK_BYTES,
    READ_TICK_MS,
  );
  return new Promise<string | null>((resolve, reject) => {
    let chunks: string[] = [];
    let sawPadding = false;
    let settled = false;
    const settle = (done: () => void) => {
      if (!settled) {
        settled = true;
        signal.removeEventListener('abort', onAbort);
        done();
      }
    };
    function onAbort() {
      settle(() => {
        chunks = [];
        resolve(null);
      });
    }
    stream.onData(chunk => {
      if (settled) {
        return;
      }
      // Only the LAST chunk may carry padding (see READ_CHUNK_BYTES). Data after a padded chunk means
      // a short read in the middle of the file, and joining it would produce base64 that does not
      // decode to the file - an attachment that looks attached and is not the document.
      if (typeof chunk !== 'string' || sawPadding) {
        settle(() => reject(new Error('attachment stream is not joinable base64')));
        return;
      }
      sawPadding = isPaddedBase64(chunk);
      chunks.push(chunk);
      onBytes(decodedByteLength(chunk));
    });
    stream.onError(err => settle(() => reject(err)));
    // iOS emits `end` after an `error` too; `settle` keeps whichever answer came first. The join
    // briefly holds the chunks and the joined string together - twice the base64 for a moment, then
    // one string, the same shape `readFile` used to hand over - and it is bounded by the cap the
    // caller applied before any of this was read.
    stream.onEnd(() => settle(() => resolve(chunks.join(''))));
    signal.addEventListener('abort', onAbort);
    // Cancelled while `readStream` was resolving: never start the native read at all.
    if (signal.aborted) {
      onAbort();
      return;
    }
    try {
      stream.open();
    } catch (e) {
      settle(() => reject(e));
    }
  });
}

/**
 * Open the system document picker (multi-select) and read the chosen files as OutgoingDocuments with
 * base64 content. Never throws - see `PickOutcome`.
 */
export async function pickDocuments({
  attachedBytes,
  signal,
  onProgress,
}: PickOptions): Promise<PickOutcome> {
  let picked: Awaited<ReturnType<typeof pick>>;
  try {
    picked = await pick({ allowMultiSelection: true });
  } catch (e) {
    return isCancel(e) ? { kind: 'dismissed' } : { kind: 'failed' };
  }

  // The cap, first pass: on the sizes the picker reports, before one byte is copied or read. A 300 MB
  // video refused here costs the person nothing. Refused after the read, it would have cost them the
  // wait - and ~400 MB of base64 in a JS heap that does not have room for it.
  //
  // The cap counts attachments only, like the send-time check (`classifyCost`) it mirrors. A typed
  // body becomes a small PDF at send time that nobody can size yet; if that is what tips a message
  // over, the send-time `tooLarge` block still catches it.
  const reported = picked.reduce((sum, f) => sum + Math.max(0, f.size ?? 0), 0);
  if (attachedBytes + reported > VODZ_MAX_BYTES) {
    return tooLarge(attachedBytes + reported);
  }
  if (signal.aborted) {
    return { kind: 'cancelled' };
  }
  // Report before the copies: on Android a cloud file is fetched during the copy, and that wait
  // belongs to the progress the person is watching, not to a screen that looks idle.
  onProgress?.({ stage: 'copying', readBytes: 0, totalBytes: reported });

  const copies: LocalCopy[] = [];
  try {
    for (const f of picked) {
      const fileName = f.name ?? 'dokument';
      // content:// URIs aren't directly readable - copy to a local cache path first.
      const [copy] = await keepLocalCopy({
        files: [{ uri: f.uri, fileName }],
        destination: 'cachesDirectory',
      });
      if (copy.status !== 'success') {
        // This used to be a silent `continue`: pick three files, get two attached, and nothing says
        // which one is missing. A pick is now all of it or none of it, with a reason.
        await discard(copies);
        return { kind: 'failed' };
      }
      const entry: LocalCopy = {
        fileName,
        mimeType: f.type ?? f.nativeType ?? 'application/octet-stream',
        path: localCopyCleanupPath(copy.localUri),
        sizeBytes: 0,
      };
      // Listed before the decode and the stat, so a copy whose URI will not decode (a malformed
      // escape throws) or whose stat throws still gets cleaned up (2026-09-15: the decode used to run
      // first, and its throw left the copy in the cache).
      copies.push(entry);
      entry.path = localCopyPath(copy.localUri);
      entry.sizeBytes = Number((await RNBlobUtil.fs.stat(entry.path)).size);
      if (signal.aborted) {
        await discard(copies);
        return { kind: 'cancelled' };
      }
    }

    // Second pass, on what is actually on disk - still before reading it. The picker may not know a
    // size (`null` counts as 0 above), and the copy is the file that will be read and sent.
    const totalBytes = copies.reduce((sum, c) => sum + c.sizeBytes, 0);
    if (attachedBytes + totalBytes > VODZ_MAX_BYTES) {
      await discard(copies);
      return tooLarge(attachedBytes + totalBytes);
    }

    let readBytes = 0;
    onProgress?.({ stage: 'reading', readBytes, totalBytes });
    const documents: OutgoingDocument[] = [];
    for (const c of copies) {
      const contentBase64 = await readBase64(c.path, signal, bytes => {
        readBytes += bytes;
        onProgress?.({ stage: 'reading', readBytes, totalBytes });
      });
      if (contentBase64 == null) {
        await discard(copies);
        return { kind: 'cancelled' };
      }
      // The stream must have carried the whole file. Fewer bytes than the copy holds means the
      // document would go out truncated, and a truncated legal document is worse than none.
      if (decodedByteLength(contentBase64) !== c.sizeBytes) {
        await discard(copies);
        return { kind: 'failed' };
      }
      documents.push({
        fileName: c.fileName,
        mimeType: c.mimeType,
        sizeBytes: c.sizeBytes,
        contentBase64,
        isMain: false,
        // Kept so a big (VoDZ) file could one day be uploaded straight from disk. Today every send
        // still carries `contentBase64`: the read above is chunked, but what it produces is one string
        // in memory, bounded by the cap.
        localPath: c.path,
      });
    }
    return { kind: 'picked', documents };
  } catch {
    await discard(copies);
    return { kind: 'failed' };
  }
}
