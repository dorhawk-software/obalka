// Pure helpers for streaming base64: the DECODE side used by the VoDZ attachment downloader, and the
// ENCODE side used by the attachment picker (at the bottom of the file).
//
// A large enclosure's base64 is read from disk in chunks and handed to a native base64 sink
// (RNBlobUtil `appendFile(…, 'base64')`) that decodes each piece to bytes. Each piece MUST be a whole
// number of base64 quartets (a multiple of 4 chars) or the decoded bytes misalign. XML base64 also
// carries line breaks/whitespace. This module does the alignment + whitespace stripping as a pure
// function so it can be unit-tested independently of the filesystem.

const NON_BASE64 = /[^A-Za-z0-9+/=]/g;

export interface AlignedBase64 {
  /** A whitespace-free, multiple-of-4 base64 slice ready to decode (may be ''). */
  emit: string;
  /** The 0–3 leftover chars to prepend to the next chunk (keeps quartet alignment across chunks). */
  carry: string;
}

/**
 * Combine the leftover `carry` from the previous chunk with a freshly read `raw` chunk, strip any
 * non-base64 characters (line breaks/whitespace), and split off the largest multiple-of-4 prefix to
 * emit; the remainder becomes the new carry. Feeding every chunk through this in order yields a
 * sequence of `emit`s whose concatenation (plus the final `carry`) is exactly the document's base64.
 */
export function alignBase64Chunk(carry: string, raw: string): AlignedBase64 {
  const s = (carry + raw).replace(NON_BASE64, '');
  const cut = s.length - (s.length % 4);
  return { emit: s.slice(0, cut), carry: s.slice(cut) };
}

// ---- Streaming base64 ENCODE (the attachment picker, 005 T006) ----
//
// The other direction. A picked file is read through RNBlobUtil `readStream(path, 'base64', size)`,
// and the native reader encodes every buffer ON ITS OWN - Android `Base64.encodeToString` per read,
// iOS `base64EncodedStringWithOptions` per NSData. A buffer whose byte count is not a multiple of 3
// ends in `=` padding, and padding in the middle of a concatenation is not base64 any more: the
// decoder either rejects it or, worse, some decoders stop there and the attachment arrives truncated.
// A multiple-of-3 buffer leaves no padding on any chunk but the last, so the chunks join into
// exactly the file's own base64.

/**
 * Bytes per `readStream` chunk: 3 × 512 KiB (1.5 MiB of file, 2 MiB of base64 per event).
 *
 * MUST stay a multiple of 3 (see above; asserted in `base64Stream.test.ts`). The size is a trade:
 * large enough that a 100 MB file is ~67 events rather than thousands crossing into JS, small enough
 * that progress still moves several times a second and no one event is a large allocation.
 */
export const READ_CHUNK_BYTES = 3 * 512 * 1024;

/** True when a base64 chunk carries `=` padding - which only the LAST chunk of a stream may. */
export function isPaddedBase64(b64: string): boolean {
  return b64.endsWith('=');
}

/**
 * How many bytes a whole (multiple-of-4, whitespace-free) base64 string decodes to, without decoding
 * it: three per quartet, less one per `=`. This is how the picker counts real progress - the chunk
 * that just arrived is exactly that many bytes of the file.
 */
export function decodedByteLength(b64: string): number {
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor(b64.length / 4) * 3 - pad;
}
