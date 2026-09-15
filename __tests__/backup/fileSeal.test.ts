// Sealing an attachment, and every way a sealed one can come back wrong (006 T019, T023).
//
// The round trip is the easy half. The half worth the effort is the set of edits somebody can make
// to a sealed file WITHOUT being able to read a byte of it: reorder the chunks, drop the tail, or
// splice in a chunk from another file sealed with the same key. Each of those leaves every
// individual chunk verifying perfectly, so a naive reader hands back a document that decrypts
// cleanly and is not what was backed up. Those are the tests below.

import {
  CHUNK_BYTES,
  FILE_HEADER_BYTES,
  FileSealError,
  chunkNonce,
  deriveFileKey,
  openFile,
  readFileHeader,
  sealFile,
  FILE_SALT_BYTES,
  sealedSizeOf,
  writeFileHeader,
} from '../../src/services/backup/fileSeal';
import { BULK_NONCE_BYTES } from '../../src/services/backup/bulkCipher';

const key = () => new Uint8Array(32).fill(7);
const salt = (fill = 3) => new Uint8Array(FILE_SALT_BYTES).fill(fill);

/** Feeds `bytes` out in `chunk`-sized pieces, the way a file reader would. */
function source(bytes: Uint8Array, chunk: number) {
  let o = 0;
  return async () => {
    if (o >= bytes.length) {
      return null;
    }
    const piece = bytes.subarray(o, Math.min(o + chunk, bytes.length));
    o += piece.length;
    return piece;
  };
}

function collector() {
  const parts: Uint8Array[] = [];
  return {
    parts,
    sink: async (b: Uint8Array) => {
      parts.push(b.slice());
    },
    get bytes() {
      const total = parts.reduce((n, p) => n + p.length, 0);
      const out = new Uint8Array(total);
      let o = 0;
      for (const p of parts) {
        out.set(p, o);
        o += p.length;
      }
      return out;
    },
  };
}

/** Reads a sealed blob back the way `openFile` asks for it: header, then fixed-size pieces. */
function sealedSource(bytes: Uint8Array) {
  let o = 0;
  return async (n: number) => {
    if (o >= bytes.length) {
      return null;
    }
    const piece = bytes.subarray(o, Math.min(o + n, bytes.length));
    o += piece.length;
    return piece;
  };
}

const roundTrip = async (plain: Uint8Array, chunk = 64) => {
  const out = collector();
  await sealFile(key(), salt(), source(plain, chunk), out.sink, chunk);
  const back = collector();
  await openFile(key(), sealedSource(out.bytes), back.sink);
  return { sealed: out.bytes, plain: back.bytes };
};

describe('a sealed attachment', () => {
  it('comes back byte for byte', async () => {
    const data = new Uint8Array(200).map((_, i) => i % 251);
    const { plain } = await roundTrip(data);
    expect(Array.from(plain)).toEqual(Array.from(data));
  });

  it.each([
    ['empty', 0],
    ['one byte', 1],
    ['exactly one chunk', 64],
    ['one chunk plus a byte', 65],
    ['several chunks exactly', 256],
  ])('survives a %s file', async (_label, size) => {
    // Chunk boundaries are where a streaming format goes wrong, and an EMPTY file is the one that
    // looks like a truncation unless it is deliberately written as a single final chunk.
    const data = new Uint8Array(size).map((_, i) => (i * 7) % 251);
    const { plain } = await roundTrip(data, 64);
    expect(plain.length).toBe(size);
    expect(Array.from(plain)).toEqual(Array.from(data));
  });

  it('seals the chunk size the HEADER promises, whatever sizes the source hands back', async () => {
    // The bug this pins: the sealer used to seal each piece the source gave it as one chunk. A
    // filesystem hands back whatever it happens to read - 700 bytes here, 64 KB there - so the file
    // ended up with a header promising 64-byte chunks and a body made of something else, and every
    // reader carved it up wrongly and refused a document that was perfectly intact.
    const data = new Uint8Array(300).map((_, i) => (i * 13) % 251);
    const ragged = [7, 1, 100, 64, 3, 125];
    let at = 0;
    const uneven = async () => {
      if (at >= data.length) {
        return null;
      }
      const size = ragged[Math.min(ragged.length - 1, at % ragged.length)];
      const piece = data.subarray(at, Math.min(at + size, data.length));
      at += piece.length;
      return piece;
    };
    const out = collector();
    await sealFile(key(), salt(), uneven, out.sink, 64);
    expect(out.bytes.length).toBe(sealedSizeOf(300, 64));
    const back = collector();
    await openFile(key(), sealedSource(out.bytes), back.sink);
    expect(Array.from(back.bytes)).toEqual(Array.from(data));
  });

  it('opens when the reader answers with less than it was asked for', async () => {
    // A target reading over a network answers short all the time. Treating a short answer as the end
    // of the stream would truncate documents that are entirely fine.
    const data = new Uint8Array(300).map((_, i) => (i * 5) % 251);
    const out = collector();
    await sealFile(key(), salt(), source(data, 64), out.sink, 64);
    let o = 0;
    const stingy = async (n: number) => {
      if (o >= out.bytes.length) {
        return null;
      }
      // Never more than 13 bytes, whatever is asked for.
      const piece = out.bytes.subarray(o, Math.min(o + Math.min(n, 13), out.bytes.length));
      o += piece.length;
      return piece;
    };
    const back = collector();
    await openFile(key(), stingy, back.sink);
    expect(Array.from(back.bytes)).toEqual(Array.from(data));
  });

  it('costs exactly what sealedSizeOf promised, so the user can be told up front', async () => {
    for (const size of [0, 1, 63, 64, 65, 200]) {
      const { sealed } = await roundTrip(new Uint8Array(size), 64);
      expect(sealed.length).toBe(sealedSizeOf(size, 64));
    }
  });
});

describe('a sealed attachment somebody edited', () => {
  const build = async (size = 256, chunk = 64) => {
    const data = new Uint8Array(size).map((_, i) => i % 251);
    const out = collector();
    await sealFile(key(), salt(), source(data, chunk), out.sink, chunk);
    return { sealed: out.bytes, chunk, sealedChunk: chunk + 16 };
  };

  it('refuses reordered chunks, even though each one is intact', async () => {
    // The attack the per-chunk nonce exists for. Nothing here is forged; two valid chunks simply
    // swap places, and a reader that trusts each chunk on its own hands back a scrambled document.
    const { sealed, sealedChunk } = await build();
    const a = FILE_HEADER_BYTES;
    const b = a + sealedChunk;
    const swapped = sealed.slice();
    swapped.set(sealed.subarray(b, b + sealedChunk), a);
    swapped.set(sealed.subarray(a, a + sealedChunk), b);

    const back = collector();
    await expect(openFile(key(), sealedSource(swapped), back.sink)).rejects.toThrow(
      FileSealError,
    );
  });

  it('refuses a truncated file rather than returning a shorter document', async () => {
    // The worst outcome in this whole feature: half a decision, decrypting cleanly, with nothing to
    // tell the reader it is half. The final-chunk flag in the AAD is what makes this fail.
    const { sealed, sealedChunk } = await build();
    const cut = sealed.subarray(0, sealed.length - sealedChunk);
    const back = collector();
    await expect(openFile(key(), sealedSource(cut), back.sink)).rejects.toThrow(
      /incomplete|does not verify/i,
    );
  });

  it('refuses a chunk spliced in from another file sealed with the same key', async () => {
    // Same key, same chunk index, different file: only the base nonce differs, which is exactly
    // what the per-file random nonce is there to make matter.
    const mine = await build();
    const otherOut = collector();
    const otherData = new Uint8Array(256).fill(9);
    await sealFile(key(), salt(200), source(otherData, 64), otherOut.sink, 64);
    const spliced = mine.sealed.slice();
    spliced.set(
      otherOut.bytes.subarray(
        FILE_HEADER_BYTES,
        FILE_HEADER_BYTES + mine.sealedChunk,
      ),
      FILE_HEADER_BYTES,
    );

    const back = collector();
    await expect(openFile(key(), sealedSource(spliced), back.sink)).rejects.toThrow(
      FileSealError,
    );
  });

  it('refuses when the header says a different chunk size than it was sealed with', async () => {
    // The header is authenticated into every chunk, so editing it to make the reader carve the
    // stream differently breaks every chunk rather than yielding a plausible misread.
    const { sealed } = await build();
    const edited = sealed.slice();
    new DataView(edited.buffer).setUint32(9, 32, false);
    const back = collector();
    await expect(openFile(key(), sealedSource(edited), back.sink)).rejects.toThrow(
      FileSealError,
    );
  });

  it('refuses the wrong key without saying which part was wrong', async () => {
    const { sealed } = await build();
    const back = collector();
    await expect(
      openFile(new Uint8Array(32).fill(8), sealedSource(sealed), back.sink),
    ).rejects.toThrow(FileSealError);
  });
});

describe('the header', () => {
  it('refuses a file that is not one of ours', () => {
    expect(() => readFileHeader(new Uint8Array(FILE_HEADER_BYTES).fill(0x41))).toThrow(
      /Not a sealed attachment/,
    );
  });

  it('refuses a newer format, and says to update rather than claiming damage', () => {
    const h = writeFileHeader({
      formatVersion: 9,
      chunkBytes: CHUNK_BYTES,
      salt: salt(),
    });
    expect(() => readFileHeader(h)).toThrow(/newer version of the app/);
  });

  it('refuses an impossible chunk size instead of looping on it', () => {
    const h = writeFileHeader({
      formatVersion: 1,
      chunkBytes: CHUNK_BYTES,
      salt: salt(),
    });
    new DataView(h.buffer).setUint32(9, 0, false);
    expect(() => readFileHeader(h)).toThrow(/impossible chunk size/);
  });
});

describe('chunk nonces', () => {
  it('never repeat within a file', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) {
      seen.add(chunkNonce(i).join(','));
    }
    expect(seen.size).toBe(5000);
  });

  it('are the counter and nothing else, which is only safe with a per-file key', () => {
    // AES-GCM's nonce is 96 bits: too small to hold per-file randomness AND a counter. The
    // randomness lives in the KEY instead (`deriveFileKey`), so the counter gets the whole nonce.
    expect(Array.from(chunkNonce(0))).toEqual(new Array(BULK_NONCE_BYTES).fill(0));
    expect(chunkNonce(1)[BULK_NONCE_BYTES - 1]).toBe(1);
    expect(chunkNonce(258)[BULK_NONCE_BYTES - 1]).toBe(2);
    expect(chunkNonce(258)[BULK_NONCE_BYTES - 2]).toBe(1);
  });

  it('gives two files different keys from the same backup key', () => {
    // The property the whole construction rests on: same key material, different salt, no shared
    // keystream. Without this the counter-only nonce would be catastrophic rather than fine.
    const a = deriveFileKey(key(), salt(1));
    const b = deriveFileKey(key(), salt(2));
    expect(Array.from(a)).not.toEqual(Array.from(b));
    expect(a.length).toBe(32);
  });
});
