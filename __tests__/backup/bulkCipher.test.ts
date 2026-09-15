// The bulk cipher, and the one property the native swap rests on (006 T018).
//
// Tier 2 seals attachments with AES-256-GCM: `react-native-quick-crypto` on a phone, `@noble/ciphers`
// everywhere else - jest, and any build where the native side is not linked. AES rather than the
// envelope's XChaCha20 because quick-crypto cannot do XChaCha without libsodium, which its default
// build omits - measured on a device, not assumed. That is only safe if
// the two produce the SAME bytes, because a backup written on a phone with the fast path has to open
// on one without it, and vice versa. Jest cannot load the native module, so these tests pin the
// fallback's behaviour and the contract the native path has to meet: same key size, same nonce size,
// tag appended, AAD authenticated.

import {
  BULK_KEY_BYTES,
  BULK_NONCE_BYTES,
  BULK_TAG_BYTES,
  bulkCipherIsNative,
  openBulk,
  sealBulk,
} from '../../src/services/backup/bulkCipher';

const key = (fill = 7) => new Uint8Array(BULK_KEY_BYTES).fill(fill);
const nonce = (fill = 3) => new Uint8Array(BULK_NONCE_BYTES).fill(fill);
const aad = () => new Uint8Array([1, 2, 3]);

describe('the bulk cipher', () => {
  it('falls back to JS under jest, which is what these tests are pinning', () => {
    // If this ever reports true, the assertions below are measuring the native path instead and the
    // fallback has stopped being covered.
    expect(bulkCipherIsNative()).toBe(false);
  });

  it('round-trips', () => {
    const data = new Uint8Array(1000).map((_, i) => i % 251);
    expect(Array.from(openBulk(key(), nonce(), sealBulk(key(), nonce(), data, aad()), aad()))).toEqual(
      Array.from(data),
    );
  });

  it('appends exactly one Poly1305 tag, so sizes are predictable before sealing', () => {
    // `sealedSizeOf` in fileSeal.ts computes what a backup will cost from this constant. If the
    // cipher ever framed its output differently, that promise would silently drift.
    for (const size of [0, 1, 1000]) {
      expect(sealBulk(key(), nonce(), new Uint8Array(size), aad()).length).toBe(
        size + BULK_TAG_BYTES,
      );
    }
  });

  it('refuses a wrong key, nonce or AAD, without saying which', () => {
    const sealed = sealBulk(key(), nonce(), new Uint8Array([9, 9, 9]), aad());
    expect(() => openBulk(key(8), nonce(), sealed, aad())).toThrow();
    expect(() => openBulk(key(), nonce(4), sealed, aad())).toThrow();
    expect(() => openBulk(key(), nonce(), sealed, new Uint8Array([1, 2, 4]))).toThrow();
  });

  it('refuses a flipped bit anywhere in the ciphertext', () => {
    const sealed = sealBulk(key(), nonce(), new Uint8Array(64).fill(1), aad());
    for (const at of [0, 32, sealed.length - 1]) {
      const edited = sealed.slice();
      edited[at] ^= 0x01;
      expect(() => openBulk(key(), nonce(), edited, aad())).toThrow();
    }
  });

  it('rejects key and nonce sizes rather than letting a caller guess', () => {
    // The native and JS paths differ in how loudly they complain about this, so it is checked before
    // either is reached - the failure must not depend on which build you are running.
    expect(() => sealBulk(new Uint8Array(16), nonce(), new Uint8Array(1), aad())).toThrow(
      /32 bytes/,
    );
    // 24 bytes was the XChaCha nonce this started out with; GCM's is 96 bits, and handing it the
    // old size must fail loudly rather than be quietly truncated or padded.
    expect(() => sealBulk(key(), new Uint8Array(24), new Uint8Array(1), aad())).toThrow(
      /12 bytes/,
    );
  });

  it('refuses something too short to even hold a tag', () => {
    expect(() => openBulk(key(), nonce(), new Uint8Array(4), aad())).toThrow(
      /too short/,
    );
  });
});
