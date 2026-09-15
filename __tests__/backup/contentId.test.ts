// Naming a stored document (006 T020).
//
// The property that matters is not "identical files get identical names" - any hash does that. It is
// that identical files get identical names FOR ONE USER and unrelated names for anybody else, so a
// storage provider cannot hash the ISDS welcome letter they already have and learn who received it.
// That is the difference between content addressing and a searchable index of somebody's mail.

import {
  ContentIdError,
  contentIdOf,
  contentIdStream,
  deriveContentIdKey,
  objectNameFor,
} from '../../src/services/backup/contentId';

const backupKey = (fill: number) => new Uint8Array(32).fill(fill);
const doc = (byte: number, size = 500) => new Uint8Array(size).fill(byte);

describe('naming a document', () => {
  it('gives the same name to the same bytes, which is what makes dedup and resume work', () => {
    const k = deriveContentIdKey(backupKey(1));
    expect(contentIdOf(k, doc(7))).toBe(contentIdOf(k, doc(7)));
  });

  it('gives different names to different bytes', () => {
    const k = deriveContentIdKey(backupKey(1));
    expect(contentIdOf(k, doc(7))).not.toBe(contentIdOf(k, doc(8)));
  });

  it('gives TWO USERS unrelated names for the very same document', () => {
    // The whole reason this is an HMAC. Both users back up the identical ISDS welcome letter; the
    // storage sees two unrelated names and cannot tell it is the same well-known file, nor hash its
    // own copy to check.
    const letter = doc(42, 2048);
    const mine = contentIdOf(deriveContentIdKey(backupKey(1)), letter);
    const theirs = contentIdOf(deriveContentIdKey(backupKey(2)), letter);
    expect(mine).not.toBe(theirs);
  });

  it('is not the plain hash of the content', () => {
    // Guards the actual mistake: someone "simplifying" this to sha256(bytes) later. If that ever
    // happens the name below starts matching, and the privacy property is silently gone.
    const { sha256 } = require('@noble/hashes/sha2.js');
    const letter = doc(42, 2048);
    const plain = Array.from(sha256(letter) as Uint8Array, (b: number) =>
      b.toString(16).padStart(2, '0'),
    )
      .join('')
      .slice(0, 32);
    expect(contentIdOf(deriveContentIdKey(backupKey(1)), letter)).not.toBe(plain);
  });

  it('names a file the same whether it arrives whole or in pieces', () => {
    // Attachments are named while streaming, so the streamed answer has to equal the whole-buffer
    // one or dedup would break for exactly the large files it exists for.
    const k = deriveContentIdKey(backupKey(1));
    const whole = new Uint8Array(5000).map((_, i) => i % 251);
    const s = contentIdStream(k);
    for (let o = 0; o < whole.length; o += 512) {
      s.update(whole.subarray(o, Math.min(o + 512, whole.length)));
    }
    expect(s.digest()).toBe(contentIdOf(k, whole));
  });

  it('uses a different key from anything that seals', () => {
    // Naming and sealing are different jobs. Sharing a key would let a bug in one reach the other.
    const { deriveFileKey } = require('../../src/services/backup/fileSeal');
    const idKey = deriveContentIdKey(backupKey(1));
    const fileKey = deriveFileKey(backupKey(1), new Uint8Array(16).fill(0));
    expect(Array.from(idKey)).not.toEqual(Array.from(fileKey));
  });

  it('refuses a key of the wrong size rather than naming things weakly', () => {
    expect(() => deriveContentIdKey(new Uint8Array(16))).toThrow(ContentIdError);
    expect(() => contentIdStream(new Uint8Array(8))).toThrow(ContentIdError);
  });

  it('cannot be updated after the name is taken', () => {
    const s = contentIdStream(deriveContentIdKey(backupKey(1)));
    s.update(doc(1));
    s.digest();
    expect(() => s.update(doc(2))).toThrow(/already taken/);
  });
});

describe('the stored object name', () => {
  it('says nothing about the document', () => {
    const name = objectNameFor(contentIdOf(deriveContentIdKey(backupKey(1)), doc(3)));
    expect(name).toMatch(/^doc-[0-9a-f]{32}$/);
    // No extension, no size, no date: the name is not a second channel.
    expect(name).not.toMatch(/\.(pdf|zip|xml|txt)$/i);
  });
});
