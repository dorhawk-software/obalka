// Reading a file for the backup a slice at a time (004 amendment, 2026-09-14).
//
// Tier 2 used to read each document whole - `readFile(path, 'base64')`, which on Android is a native
// string of 4/3 the file - on the grounds that ISDS caps a message at 20 MB. A large-volume (VoDZ)
// enclosure is up to 100 MB, and a message's signed original, which Tier 2 now carries, is larger than
// the documents it seals. So the device reader copies one slice at a time to a scratch file and reads
// that; this is the part of it that decides what a slice is, kept free of the filesystem so it is
// tested.

import type { ChunkSource, SealedSource } from '../backup/fileSeal';

/**
 * A puller over bytes [0, size) of a file, `sliceBytes` at a time, then null.
 *
 * `readRange` must hand back exactly the bytes asked for. A short or long answer means the file
 * changed under the backup, and naming or sealing a document that is not the one on disk would store
 * something the restore then puts back as if it were - so it throws, and the backup counts that one
 * document as failed.
 */
export function sliceSource(
  size: number,
  sliceBytes: number,
  readRange: (start: number, end: number) => Promise<Uint8Array>,
): ChunkSource {
  let offset = 0;
  return async () => {
    if (offset >= size) {
      return null;
    }
    const end = Math.min(offset + sliceBytes, size);
    const piece = await readRange(offset, end);
    if (piece.length !== end - offset) {
      throw new Error('The file changed while it was being read.');
    }
    offset = end;
    return piece;
  };
}

/**
 * A `ChunkSource`'s bytes, handed out in pieces no larger than each caller asks for, then null.
 *
 * The shape `SyncTarget.getObject` answers with and `openFile` reads. It holds one of the source's
 * chunks at a time and never more, which is what lets a restore read a sealed document back a slice
 * at a time (025 review, 2026-09-15). The file target and the transfer's staged target used to read
 * the object whole and cut pieces off that, so a large-volume attachment (up to 100 MB) or a signed
 * original, larger still, had to fit in the JS heap at once - as base64 first.
 */
export function chunksOnRequest(source: ChunkSource): SealedSource {
  let held: Uint8Array = new Uint8Array(0);
  let ended = false;
  return async (byteCount: number) => {
    // Empty chunks are skipped rather than passed on: `openFile` reads an empty piece as the end.
    while (held.length === 0 && !ended) {
      const next = await source();
      if (next == null) {
        ended = true;
      } else {
        held = next;
      }
    }
    if (held.length === 0) {
      return null;
    }
    const piece = held.subarray(0, Math.min(byteCount, held.length));
    held = held.subarray(piece.length);
    return piece;
  };
}
