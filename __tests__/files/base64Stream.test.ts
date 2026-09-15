import {
  READ_CHUNK_BYTES,
  alignBase64Chunk,
  decodedByteLength,
  isPaddedBase64,
} from '../../src/services/files/base64Stream';
import { base64 } from '../../src/services/isds/httpClient';

/** Feed `b64` to the aligner split into `size`-char chunks; return the concatenated decode stream. */
function streamThrough(b64: string, size: number): string {
  let carry = '';
  let out = '';
  for (let i = 0; i < b64.length; i += size) {
    const { emit, carry: next } = alignBase64Chunk(carry, b64.slice(i, i + size));
    // Every emitted slice must be a whole number of base64 quartets, or the bytes misalign.
    expect(emit.length % 4).toBe(0);
    out += emit;
    carry = next;
  }
  return out + carry;
}

describe('alignBase64Chunk (streaming base64 decode)', () => {
  // Varied content (NOT all-zero) - exercises real data, unlike the padded test PDF.
  const b64 = base64('Příliš žluťoučký kůň úpěl ďábelské ódy 0123456789'.repeat(50));

  it('reassembles the base64 byte-for-byte across arbitrary chunk boundaries', () => {
    for (const size of [1, 2, 3, 4, 7, 64, 77, 1000, b64.length, b64.length + 5]) {
      expect(streamThrough(b64, size)).toBe(b64);
    }
  });

  it('strips line breaks / whitespace that XML base64 carries (wrapped at 76 chars)', () => {
    const wrapped = (b64.match(/.{1,76}/g) ?? []).join('\r\n');
    expect(streamThrough(wrapped, 50)).toBe(b64);
    expect(streamThrough(`  ${b64}\n\t`, 13)).toBe(b64);
  });

  it('threads the 0–3 char carry so a split quartet is never lost or duplicated', () => {
    const a = alignBase64Chunk('', 'QU'); // "QU" - not yet a full quartet
    expect(a).toEqual({ emit: '', carry: 'QU' });
    const b = alignBase64Chunk(a.carry, 'JDx'); // "QUJDx" → one full quartet emitted, "x" carried
    expect(b).toEqual({ emit: 'QUJD', carry: 'x' });
  });
});

// The ENCODE direction (005 T006). The native reader base64-encodes every buffer on its own, so the
// picker can only join its chunks if no chunk but the last carries `=` padding.
describe('streaming base64 encode (the attachment picker)', () => {
  /** Varied bytes, so a join that happens to line up on zeros cannot pass. */
  const bytes = Buffer.from(Array.from({ length: 100 }, (_, i) => (i * 37 + 11) % 256));

  /** Encode `data` the way the native reader does: each `size`-byte buffer on its own. */
  const encodeInChunks = (data: Buffer, size: number): string[] => {
    const chunks: string[] = [];
    for (let i = 0; i < data.length; i += size) {
      chunks.push(data.subarray(i, i + size).toString('base64'));
    }
    return chunks;
  };

  it('reads in a buffer size that is a multiple of 3 bytes', () => {
    expect(READ_CHUNK_BYTES % 3).toBe(0);
    expect(READ_CHUNK_BYTES).toBeGreaterThan(0);
  });

  it('joins into the whole base64 when the buffer is a multiple of 3 - and only then', () => {
    const whole = bytes.toString('base64');
    for (const size of [3, 6, 30, 99, 102]) {
      const chunks = encodeInChunks(bytes, size);
      expect(chunks.join('')).toBe(whole);
      // Padding, if any, is on the last chunk alone.
      expect(chunks.slice(0, -1).some(isPaddedBase64)).toBe(false);
    }
    // Why the constant matters: any other size pads a chunk in the middle, and the join is not the file.
    for (const size of [4, 5, 7, 50]) {
      const chunks = encodeInChunks(bytes, size);
      expect(chunks.slice(0, -1).some(isPaddedBase64)).toBe(true);
      expect(chunks.join('')).not.toBe(whole);
    }
  });

  it('counts the bytes a base64 string carries without decoding it', () => {
    for (const n of [0, 1, 2, 3, 4, 5, 6, 7, 99, 100]) {
      const b64 = bytes.subarray(0, n).toString('base64');
      expect(decodedByteLength(b64)).toBe(n);
      expect(isPaddedBase64(b64)).toBe(n % 3 !== 0);
    }
  });
});
