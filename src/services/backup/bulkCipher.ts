// AES-256-GCM for BULK, which on a phone means native and hardware-accelerated (006 T018).
//
// The envelope already seals Tier 1 with `@noble/ciphers`, and that was the right call for it: the
// metadata archive is kilobytes, so the cipher never showed up next to Argon2id. Tier 2 is the first
// time real bytes go through one. A single scanned decision can be tens of megabytes and an archive
// is the sum of them, so the same JS loop that was invisible at 8 KB becomes the whole cost.
//
// The split mirrors `argon2.ts` exactly, for the same reason: resolve the native module PER CALL and
// fall back rather than import it at module scope, because a throwing import takes the screen with
// it while a missing module should only ever mean "slower". Jest has no native side at all, so the
// fallback is also what makes any of this testable.
//
// NOT the envelope's XChaCha20-Poly1305, and that was measured rather than chosen. quick-crypto
// lists `xchacha20-poly1305`, but on a device it answers:
//
//     XChaCha20Poly1305Cipher: libsodium must be enabled (BLSALLOC_SODIUM)
//
// The default build does not link libsodium, so the one algorithm this app already uses is the one
// algorithm the native module cannot do. `aes-256-gcm` and `chacha20-poly1305` both work, verified
// on the emulator.
//
// AES-256-GCM of the two, because the whole reason to be here is bulk throughput and ARMv8 has AES
// instructions - a software ChaCha would give up most of what the native dependency was added for.
// It costs Tier 2 a different primitive from Tier 1, which is a real cost: two things to reason
// about instead of one. The alternative was keeping XChaCha20 in JavaScript for tens of megabytes
// per attachment, which is the failure Principle I is about.

import { gcm } from '@noble/ciphers/aes.js';
import { reportFailure } from '../telemetry/telemetry';

/** Key and nonce sizes. The nonce is GCM's 96-bit one, NOT the envelope's 192-bit XChaCha nonce. */
export const BULK_KEY_BYTES = 32;
export const BULK_NONCE_BYTES = 12;
/** GCM tag, appended by both implementations. */
export const BULK_TAG_BYTES = 16;

const ALGORITHM = 'aes-256-gcm';

interface NativeCipher {
  createCipheriv(a: string, k: Uint8Array, n: Uint8Array): NativeCipherHandle;
  createDecipheriv(a: string, k: Uint8Array, n: Uint8Array): NativeDecipherHandle;
}
interface NativeCipherHandle {
  setAAD(aad: Uint8Array): unknown;
  update(data: Uint8Array): Uint8Array;
  final(): Uint8Array;
  getAuthTag(): Uint8Array;
}
interface NativeDecipherHandle {
  setAAD(aad: Uint8Array): unknown;
  setAuthTag(tag: Uint8Array): unknown;
  update(data: Uint8Array): Uint8Array;
  final(): Uint8Array;
}

/**
 * Resolved per call, never at import.
 *
 * `react-native-quick-crypto` reaches for Nitro at module scope, which throws on a build where the
 * native side is not linked - jest, or an app bundle from before the rebuild. Reported once per
 * failure rather than swallowed: falling back is correct and must stay silent to the USER, but a
 * phone quietly doing megabytes of AEAD in JavaScript is exactly Principle I's failure mode.
 */
function nativeCipher(): NativeCipher | null {
  try {
    const mod = require('react-native-quick-crypto') as {
      default?: NativeCipher;
      createCipheriv?: NativeCipher['createCipheriv'];
      createDecipheriv?: NativeCipher['createDecipheriv'];
    };
    const candidate = (mod?.default ?? mod) as NativeCipher | undefined;
    return typeof candidate?.createCipheriv === 'function' &&
      typeof candidate?.createDecipheriv === 'function'
      ? candidate
      : null;
  } catch (e) {
    reportFailure('backup.bulkCipher', e, { stage: 'native' });
    return null;
  }
}

/** True when the fast path is available. Only for reporting; both paths produce the same bytes. */
export function bulkCipherIsNative(): boolean {
  return nativeCipher() != null;
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function checkSizes(key: Uint8Array, nonce: Uint8Array): void {
  if (key.length !== BULK_KEY_BYTES) {
    throw new Error(`bulk key must be ${BULK_KEY_BYTES} bytes, got ${key.length}`);
  }
  if (nonce.length !== BULK_NONCE_BYTES) {
    throw new Error(`bulk nonce must be ${BULK_NONCE_BYTES} bytes, got ${nonce.length}`);
  }
}

/**
 * Seal one chunk. Returns ciphertext with the 16-byte tag appended, as `@noble` does.
 *
 * `aad` is authenticated but not encrypted, and the caller is expected to put the chunk's position
 * in it - see `fileSeal.ts`. Without that a sealed file can be reordered or truncated by someone who
 * cannot read a byte of it, and every individual chunk still verifies.
 */
export function sealBulk(
  key: Uint8Array,
  nonce: Uint8Array,
  plaintext: Uint8Array,
  aad: Uint8Array,
): Uint8Array {
  checkSizes(key, nonce);
  const native = nativeCipher();
  if (native) {
    const c = native.createCipheriv(ALGORITHM, key, nonce);
    c.setAAD(aad);
    const body = concat(c.update(plaintext), c.final());
    return concat(body, c.getAuthTag());
  }
  return gcm(key, nonce, aad).encrypt(plaintext);
}

/** Open one chunk. Throws when the tag, the key, the nonce or the AAD does not match. */
export function openBulk(
  key: Uint8Array,
  nonce: Uint8Array,
  sealed: Uint8Array,
  aad: Uint8Array,
): Uint8Array {
  checkSizes(key, nonce);
  if (sealed.length < BULK_TAG_BYTES) {
    throw new Error('sealed chunk is too short to hold a tag');
  }
  const native = nativeCipher();
  if (native) {
    const body = sealed.subarray(0, sealed.length - BULK_TAG_BYTES);
    const tag = sealed.subarray(sealed.length - BULK_TAG_BYTES);
    const d = native.createDecipheriv(ALGORITHM, key, nonce);
    d.setAAD(aad);
    d.setAuthTag(tag);
    return concat(d.update(body), d.final());
  }
  return gcm(key, nonce, aad).decrypt(sealed);
}
