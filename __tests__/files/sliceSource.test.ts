// Reading a document for the backup a slice at a time (004 amendment, 2026-09-14).
//
// Tier 2 now carries signed originals, which are larger than any attachment, so the device reader no
// longer reads a file whole. What is checked here is the arithmetic that replaced "whole": every byte
// exactly once, in order, never more than a slice held - and a file that changes size while it is
// being read is refused rather than stored as something it is not.

import { chunksOnRequest, sliceSource } from '../../src/services/files/sliceSource';

function file(size: number) {
  const bytes = new Uint8Array(size).map((_, i) => (i * 7) % 251);
  const asked: [number, number][] = [];
  const readRange = async (start: number, end: number) => {
    asked.push([start, end]);
    return bytes.slice(start, end);
  };
  return { bytes, asked, readRange };
}

async function drain(read: () => Promise<Uint8Array | null>): Promise<Uint8Array[]> {
  const pieces: Uint8Array[] = [];
  for (let piece = await read(); piece != null; piece = await read()) {
    pieces.push(piece);
  }
  return pieces;
}

describe('reading a file a slice at a time', () => {
  it('hands out every byte once, in order, one slice at a time', async () => {
    const { bytes, asked, readRange } = file(2_500_000);
    const pieces = await drain(sliceSource(bytes.length, 1_000_000, readRange));
    expect(asked).toEqual([
      [0, 1_000_000],
      [1_000_000, 2_000_000],
      [2_000_000, 2_500_000],
    ]);
    expect(Buffer.concat(pieces).equals(Buffer.from(bytes))).toBe(true);
  });

  it('reads nothing at all for an empty file', async () => {
    const { asked, readRange } = file(0);
    expect(await drain(sliceSource(0, 1_000_000, readRange))).toEqual([]);
    expect(asked).toEqual([]);
  });

  it('refuses a file that changed while it was being read', async () => {
    const { readRange } = file(1_500_000);
    // The stat said 2 MB; the file on disk is now shorter.
    const read = sliceSource(2_000_000, 1_000_000, readRange);
    await read();
    await expect(read()).rejects.toThrow(/changed/);
  });
});

// Reading a sealed document BACK a slice at a time (025 review, 2026-09-15). A restore asks for bytes
// by count; the file hands them out by slice. This is what sits between the two, so that neither the
// file target nor the transfer has to read a document whole to answer.
describe('answering requests for bytes from a slice reader', () => {
  /** A source of these chunks, counting how often it was pulled. */
  function chunks(...sizes: number[]) {
    let next = 0;
    let value = 0;
    const source = {
      pulls: 0,
      read: async () => {
        source.pulls += 1;
        if (next >= sizes.length) {
          return null;
        }
        return new Uint8Array(sizes[next++]).map(() => value++ % 251);
      },
    };
    return source;
  }

  it('gives every byte once, in order, never more than was asked for', async () => {
    const source = chunks(10, 10, 5);
    const ask = chunksOnRequest(source.read);
    const pieces: Uint8Array[] = [];
    for (let piece = await ask(4); piece != null; piece = await ask(4)) {
      expect(piece.length).toBeLessThanOrEqual(4);
      pieces.push(piece);
    }
    expect(Array.from(Buffer.concat(pieces))).toEqual(
      Array.from({ length: 25 }, (_, i) => i % 251),
    );
  });

  it('holds one slice at a time, reading the next only once this one is spent', async () => {
    const source = chunks(10, 10);
    const ask = chunksOnRequest(source.read);
    await ask(3);
    await ask(3);
    await ask(3);
    expect(source.pulls).toBe(1);
    await ask(3); // the tenth byte
    expect(source.pulls).toBe(1);
    await ask(3);
    expect(source.pulls).toBe(2);
  });

  it('passes over an empty slice rather than reporting the end early', async () => {
    // `openFile` reads an empty piece as the end of the file, and a truncated document is refused.
    const source = chunks(3, 0, 2);
    const ask = chunksOnRequest(source.read);
    expect((await ask(8))?.length).toBe(3);
    expect((await ask(8))?.length).toBe(2);
    expect(await ask(8)).toBeNull();
    expect(await ask(8)).toBeNull();
  });
});
