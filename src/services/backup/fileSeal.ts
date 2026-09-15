// Sealing one attachment, a chunk at a time (006 T019).
//
// Tier 1 seals a whole archive in one call because the archive is kilobytes. An attachment is not:
// a scanned decision runs to tens of megabytes, and holding one in JS memory as plaintext AND
// ciphertext at once is how a phone runs out of room. So a file is sealed in fixed chunks, and the
// caller streams them.
//
// WHY EACH CHUNK CARRIES ITS POSITION. Sealing chunks independently and concatenating them is the
// obvious design and it is broken: someone who cannot read a single byte can still reorder the
// chunks, drop the last ones, or splice chunks from a different file sealed with the same key, and
// every individual chunk still verifies. The result decrypts cleanly into a document that is not
// what was backed up.
//
// So this is the STREAM construction: every chunk's nonce carries its index, and the index plus a
// final-chunk flag are authenticated as additional data. Move a chunk and the nonce is wrong. Drop
// the tail and the last chunk you kept is not marked final, so opening fails rather than returning a
// truncated file that looks whole.
//
// PER-FILE KEY, and not by preference. AES-GCM's nonce is 96 bits - see `bulkCipher.ts` for why the
// algorithm is AES at all - which is too little to hold both per-file randomness and a chunk counter
// without one eating the other. So the randomness moves into the KEY: each file gets a 16-byte salt,
// the file's key is HKDF'd from the backup key and that salt, and the nonce is then nothing but the
// counter. Two files never share a key, so two files never share a keystream, and the counter has
// the whole nonce to itself.
//
// The header is authenticated into every chunk too, so the chunk size cannot be edited to make a
// reader carve the stream up differently.

import { hkdf } from '@noble/hashes/hkdf.js';
import { encodeUtf8 } from '../text/textCodec';
import { sha256 } from '@noble/hashes/sha2.js';
import {
  BULK_KEY_BYTES,
  BULK_NONCE_BYTES,
  BULK_TAG_BYTES,
  openBulk,
  sealBulk,
} from './bulkCipher';

/** `OBALKAF\0` - the envelope's magic with an F, so a file and an archive cannot be confused. */
const MAGIC = new Uint8Array([0x4f, 0x42, 0x41, 0x4c, 0x4b, 0x41, 0x46, 0x00]);

export const FILE_FORMAT_VERSION = 1;

/**
 * 1 MiB of plaintext per chunk.
 *
 * Big enough that the per-chunk 16-byte tag is noise (0.0015% overhead) and small enough that one
 * chunk's plaintext, ciphertext and base64 staging all fit comfortably while the rest of the app is
 * still running. It is written into the header rather than assumed, so a later build can change it
 * without orphaning every backup made before the change.
 */
export const CHUNK_BYTES = 1024 * 1024;

/** Per-file HKDF salt. 128 bits: collisions are what would put two files on one key. */
export const FILE_SALT_BYTES = 16;

/** magic + version + u32 chunk size + salt. */
export const FILE_HEADER_BYTES = MAGIC.length + 1 + 4 + FILE_SALT_BYTES;

export class FileSealError extends Error {}

export interface FileHeader {
  formatVersion: number;
  chunkBytes: number;
  salt: Uint8Array;
}

/**
 * Info string, so a key derived here can never collide with one derived for another purpose.
 *
 * Encoded through the app's own `encodeUtf8` rather than `new TextEncoder()`: Hermes does not have
 * one, which `__tests__/security/hermesGlobals.test.ts` exists to catch and duly did. `@noble`'s
 * `hkdf` wants `Uint8Array | undefined` for info, so this is bytes either way.
 */
const HKDF_INFO = encodeUtf8('obalka/backup/file/v1');

/**
 * The key this file is sealed with: HKDF-SHA256 of the backup key and the file's own salt.
 *
 * Cheap (once per file, not per chunk) and deliberately kept in JavaScript: it is a few hundred
 * bytes of hashing, so there is nothing to gain from a second native branch to keep in step.
 */
export function deriveFileKey(backupKey: Uint8Array, salt: Uint8Array): Uint8Array {
  if (backupKey.length !== BULK_KEY_BYTES) {
    throw new FileSealError('bad backup key');
  }
  if (salt.length !== FILE_SALT_BYTES) {
    throw new FileSealError('bad file salt');
  }
  return hkdf(sha256, backupKey, salt, HKDF_INFO, BULK_KEY_BYTES);
}

export function writeFileHeader(h: FileHeader): Uint8Array {
  const out = new Uint8Array(FILE_HEADER_BYTES);
  const view = new DataView(out.buffer);
  out.set(MAGIC, 0);
  let o = MAGIC.length;
  out[o] = h.formatVersion;
  o += 1;
  view.setUint32(o, h.chunkBytes, false); // big-endian: a file format, not a memory layout
  o += 4;
  out.set(h.salt, o);
  return out;
}

export function readFileHeader(bytes: Uint8Array): FileHeader {
  if (bytes.length < FILE_HEADER_BYTES) {
    throw new FileSealError('Not a sealed attachment: too short to hold a header.');
  }
  for (let i = 0; i < MAGIC.length; i++) {
    if (bytes[i] !== MAGIC[i]) {
      throw new FileSealError('Not a sealed attachment.');
    }
  }
  let o = MAGIC.length;
  const formatVersion = bytes[o];
  o += 1;
  if (formatVersion > FILE_FORMAT_VERSION) {
    throw new FileSealError(
      `This attachment was sealed by a newer version of the app (format ${formatVersion}; this build reads ${FILE_FORMAT_VERSION}).`,
    );
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunkBytes = view.getUint32(o, false);
  o += 4;
  // A zero or absurd chunk size would make the reader carve the stream into the wrong pieces, or
  // loop forever. Checked here so it fails as a corrupt header rather than as a decrypt error.
  if (chunkBytes === 0 || chunkBytes > 64 * 1024 * 1024) {
    throw new FileSealError('This attachment is damaged (impossible chunk size).');
  }
  return {
    formatVersion,
    chunkBytes,
    salt: bytes.slice(o, o + FILE_SALT_BYTES),
  };
}

/**
 * The nonce for chunk `index`: the counter, big-endian, in an otherwise zero 96-bit nonce.
 *
 * Safe only because the key is per-file (see `deriveFileKey`). With a shared key this would be the
 * classic catastrophic reuse; with a per-file key the counter has the whole nonce space to itself
 * and two chunks of one file can never collide.
 */
export function chunkNonce(index: number): Uint8Array {
  if (!Number.isInteger(index) || index < 0) {
    throw new FileSealError('bad chunk index');
  }
  const out = new Uint8Array(BULK_NONCE_BYTES);
  const view = new DataView(out.buffer);
  view.setUint32(4, Math.floor(index / 0x100000000), false);
  view.setUint32(8, index >>> 0, false);
  return out;
}

/**
 * What each chunk authenticates besides its own bytes: the header, its index, and whether it ends
 * the file. The final flag is what makes truncation a failure rather than a shorter document.
 */
export function chunkAad(
  header: Uint8Array,
  index: number,
  isFinal: boolean,
): Uint8Array {
  const out = new Uint8Array(header.length + 8 + 1);
  out.set(header, 0);
  const view = new DataView(out.buffer, header.length, 9);
  view.setUint32(0, Math.floor(index / 0x100000000), false);
  view.setUint32(4, index >>> 0, false);
  view.setUint8(8, isFinal ? 1 : 0);
  return out;
}

/** How large one sealed chunk is on disk, for a given plaintext length. */
export const sealedChunkBytes = (plaintextBytes: number) =>
  plaintextBytes + BULK_TAG_BYTES;

/**
 * The size a sealed file will occupy, computable BEFORE anything is written.
 *
 * 006 T024 requires the user to be told what enabling documents will cost before they enable it, and
 * an estimate that drifts from the real number is worse than none.
 */
export function sealedSizeOf(plainBytes: number, chunkBytes = CHUNK_BYTES): number {
  if (plainBytes < 0) {
    throw new FileSealError('negative size');
  }
  // An empty file is still one (empty, final) chunk: it has to be distinguishable from a truncation.
  const chunks = plainBytes === 0 ? 1 : Math.ceil(plainBytes / chunkBytes);
  return FILE_HEADER_BYTES + plainBytes + chunks * BULK_TAG_BYTES;
}

/** Reads the next piece of plaintext, or null at the end. */
export type ChunkSource = () => Promise<Uint8Array | null>;
/** Writes one piece of the sealed file, in order. */
export type ChunkSink = (bytes: Uint8Array) => Promise<void>;

/**
 * The sealed file as something that is PULLED: header first, then one sealed chunk per call, then
 * null.
 *
 * Pull rather than push because that is the shape an upload wants - a target asks for the next piece
 * when it is ready for it, which is what lets a cloud target apply backpressure and what lets the
 * file target write straight through without staging the whole sealed file anywhere. `sealFile`
 * below is this same machine with a push adapter on it, so the chunk accounting (and in particular
 * which chunk is marked final) exists once rather than twice.
 *
 * Neither side ever holds more than a chunk, which is the whole point: a 40 MB attachment costs
 * about a megabyte of working memory rather than eighty.
 */
export function sealedSource(
  backupKey: Uint8Array,
  salt: Uint8Array,
  source: ChunkSource,
  chunkBytes = CHUNK_BYTES,
): ChunkSource {
  const key = deriveFileKey(backupKey, salt);
  const header = writeFileHeader({
    formatVersion: FILE_FORMAT_VERSION,
    chunkBytes,
    salt,
  });
  let index = 0;
  let done = false;
  let sentHeader = false;
  // RE-CHUNKED here rather than trusted from the source. A filesystem hands back whatever it happens
  // to read - a 700-byte piece, a 64 KB one - and sealing each of those as its own chunk produced a
  // file whose header promised 1 MiB chunks and whose body was nothing of the sort, so every reader
  // carved it up wrongly and refused it. What the header says is what the chunks are.
  const pending: Uint8Array[] = [];
  let buffered = 0;
  let ended = false;

  /** Read until there is provably MORE than one chunk buffered, or the plaintext has run out. */
  async function fill(): Promise<void> {
    while (!ended && buffered <= chunkBytes) {
      const piece = await source();
      if (piece == null) {
        ended = true;
        return;
      }
      if (piece.length > 0) {
        pending.push(piece);
        buffered += piece.length;
      }
    }
  }

  /** Take exactly `count` bytes off the front of what is buffered. */
  function take(count: number): Uint8Array {
    const out = new Uint8Array(count);
    let at = 0;
    while (at < count) {
      const head = pending[0];
      const want = Math.min(head.length, count - at);
      out.set(head.subarray(0, want), at);
      at += want;
      if (want === head.length) {
        pending.shift();
      } else {
        pending[0] = head.subarray(want);
      }
    }
    buffered -= count;
    return out;
  }

  return async () => {
    if (done) {
      return null;
    }
    if (!sentHeader) {
      sentHeader = true;
      return header;
    }
    await fill();
    // One chunk is always written, even for an empty file: "no chunks at all" and "the tail was cut
    // off" would otherwise be the same thing on disk.
    const plain = take(Math.min(chunkBytes, buffered));
    const isFinal = ended && buffered === 0;
    const sealed = sealBulk(
      key,
      chunkNonce(index),
      plain,
      chunkAad(header, index, isFinal),
    );
    if (isFinal) {
      done = true;
    } else {
      index += 1;
    }
    return sealed;
  };
}

/** The push form of `sealedSource`, for callers that own a sink rather than being asked. */
export async function sealFile(
  backupKey: Uint8Array,
  salt: Uint8Array,
  source: ChunkSource,
  sink: ChunkSink,
  chunkBytes = CHUNK_BYTES,
): Promise<void> {
  const pull = sealedSource(backupKey, salt, source, chunkBytes);
  for (;;) {
    const piece = await pull();
    if (piece == null) {
      return;
    }
    await sink(piece);
  }
}

/** Reads the next piece of the sealed file, or null at the end. */
export type SealedSource = (byteCount: number) => Promise<Uint8Array | null>;

/**
 * Open a sealed file, one chunk at a time, writing plaintext to `sink`.
 *
 * Fails rather than returning a short file when the stream ends without a chunk marked final, which
 * is the case a naive reader gets wrong: a truncated backup that opens cleanly into half a document
 * is worse than one that refuses, because nobody checks a document they were told is fine.
 */
export async function openFile(
  backupKey: Uint8Array,
  source: SealedSource,
  sink: ChunkSink,
): Promise<void> {
  // A `SealedSource` is asked for a size and may answer with LESS - that is what reading from a
  // network or a file descriptor does, and treating a short answer as the end of the stream would
  // truncate perfectly good documents. Only `null` (or nothing at all) means the end.
  const readExactly = async (want: number): Promise<Uint8Array> => {
    const parts: Uint8Array[] = [];
    let have = 0;
    while (have < want) {
      const piece = await source(want - have);
      if (piece == null || piece.length === 0) {
        break;
      }
      parts.push(piece);
      have += piece.length;
    }
    if (parts.length === 1) {
      return parts[0];
    }
    const out = new Uint8Array(have);
    let at = 0;
    for (const part of parts) {
      out.set(part, at);
      at += part.length;
    }
    return out;
  };

  const headerBytes = await readExactly(FILE_HEADER_BYTES);
  if (headerBytes.length < FILE_HEADER_BYTES) {
    throw new FileSealError('Not a sealed attachment: too short to hold a header.');
  }
  const header = readFileHeader(headerBytes);
  const key = deriveFileKey(backupKey, header.salt);
  const sealedChunk = sealedChunkBytes(header.chunkBytes);

  // READ ONE AHEAD, rather than inferring the end from a short read. A file whose length is an exact
  // multiple of the chunk size ends with a FULL chunk, so "short means last" is wrong precisely when
  // the arithmetic is tidiest - it refused every such file, which the boundary tests caught.
  // Knowing whether another chunk exists is the only reliable way to know this one is final.
  let piece = await readExactly(sealedChunk);
  for (let index = 0; ; index++) {
    if (piece.length === 0) {
      throw new FileSealError(
        'This attachment is incomplete: it ends without a final chunk.',
      );
    }
    const next = await readExactly(sealedChunk);
    const isFinal = next.length === 0;
    try {
      await sink(
        openBulk(
          key,
          chunkNonce(index),
          piece,
          chunkAad(headerBytes.subarray(0, FILE_HEADER_BYTES), index, isFinal),
        ),
      );
    } catch {
      throw new FileSealError(
        isFinal
          ? 'This attachment is incomplete or was altered: its last chunk does not verify.'
          : `This attachment is damaged: chunk ${index} does not verify.`,
      );
    }
    if (isFinal) {
      return;
    }
    piece = next;
  }
}
