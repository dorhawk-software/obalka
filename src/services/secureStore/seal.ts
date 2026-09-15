// Sealing one box secret under the vault key (001 T028, research R6b).
//
// A box password or session cookie is stored as its own Keychain item, but what keeps it unreadable
// while the app is locked is not that item's protection - it is this seal. The key it is sealed under
// sits behind the biometric gate whenever the app lock is on, so an item read straight out of the
// Keychain is ciphertext until somebody has unlocked the app.
//
// Three choices, each for a failure that would otherwise be silent:
//
// 1. **Versioned text.** Keychain values are strings, and a value written today has to be told apart
//    from the plain `{"password": …}` JSON every earlier build wrote (the migration reads both), and
//    from a format a later build might write. A newer version is refused, not guessed at.
// 2. **A key id.** When the phone invalidates the gated key and a new one takes its place, every old
//    seal stops opening. That has to read as "sealed under a key this phone no longer has" - the user
//    is told why and signs in again - rather than as tampering, which is a different story to tell.
// 3. **Associated data naming the kind and the box.** Without it a sealed password could be copied
//    into another box's item, or into the cookie slot, and open there. With it, it does not.
//
// XChaCha20-Poly1305 from @noble, the cipher the backup envelope already ships: pure JS, and for a
// secret of a few hundred bytes a matter of microseconds, so no thread hop is needed (Principle I).
// Its 24-byte nonce is safe drawn at random, so nothing has to count.

import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { decodeUtf8, encodeUtf8 } from '../text/textCodec';

/** The vault key is 256 bits. */
export const VAULT_KEY_BYTES = 32;

const KEY_ID_BYTES = 8;
const NONCE_BYTES = 24;
const TAG_BYTES = 16;
const FORMAT_VERSION = 1;

/** Everything sealed starts with this, followed by the format version and a colon. */
const SEAL_PREFIX = 'obalka-vault-';

/** What a seal holds. Part of the associated data, so one kind cannot be opened as the other. */
export type SecretKind = 'password' | 'session';

/**
 * Why a stored value did not open.
 *
 * - `format` - not a seal this code understands the shape of (damaged, or not a seal at all).
 * - `version` - a seal from a newer build. Refused rather than misread.
 * - `keyMismatch` - sealed under a different vault key: the one this phone had before it lost it.
 * - `tampered` - the right key, and the tag does not match: changed bytes, or moved to another
 *   box's or kind's slot.
 */
export type SealFailure = 'format' | 'version' | 'keyMismatch' | 'tampered';

export class SealError extends Error {
  constructor(readonly reason: SealFailure, message: string) {
    super(message);
    this.name = 'SealError';
  }
}

/** Random bytes from the platform CSPRNG, like every other key in this app. */
function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  globalThis.crypto.getRandomValues(out);
  return out;
}

function assertKey(key: Uint8Array): void {
  if (key.length !== VAULT_KEY_BYTES) {
    // A programming error, never user data: a short key would still "work" and seal everything weakly.
    throw new Error(`The vault key must be ${VAULT_KEY_BYTES} bytes.`);
  }
}

/**
 * A short, non-secret fingerprint of the key.
 *
 * An HMAC under the key rather than a hash of it, so the id says nothing about the key to someone who
 * reads it out of the Keychain - it only lets the holder of a key recognise its own seals.
 */
export function keyIdOf(key: Uint8Array): Uint8Array {
  assertKey(key);
  return hmac(sha256, key, encodeUtf8('obalka/vault/key-id/v1')).slice(0, KEY_ID_BYTES);
}

function associatedData(kind: SecretKind, boxId: string): Uint8Array {
  return encodeUtf8(`obalka/vault/v1/${kind}/${boxId}`);
}

/** Whether a stored value is a seal (of any version), as opposed to a pre-vault plain value. */
export function isSealed(stored: string): boolean {
  return stored.startsWith(SEAL_PREFIX);
}

/** Seal `plaintext` for one box and kind. The result is safe to store anywhere; it is text. */
export function sealSecret(
  key: Uint8Array,
  kind: SecretKind,
  boxId: string,
  plaintext: string,
  random: (n: number) => Uint8Array = randomBytes,
): string {
  assertKey(key);
  const nonce = random(NONCE_BYTES);
  const ciphertext = xchacha20poly1305(key, nonce, associatedData(kind, boxId)).encrypt(
    encodeUtf8(plaintext),
  );
  const body = new Uint8Array(KEY_ID_BYTES + NONCE_BYTES + ciphertext.length);
  body.set(keyIdOf(key), 0);
  body.set(nonce, KEY_ID_BYTES);
  body.set(ciphertext, KEY_ID_BYTES + NONCE_BYTES);
  return `${SEAL_PREFIX}${FORMAT_VERSION}:${bytesToHex(body)}`;
}

/** Open a seal written by {@link sealSecret}, or throw a {@link SealError} saying why not. */
export function openSecret(
  key: Uint8Array,
  kind: SecretKind,
  boxId: string,
  stored: string,
): string {
  assertKey(key);
  if (!isSealed(stored)) {
    throw new SealError('format', 'Not a sealed value.');
  }
  const colon = stored.indexOf(':', SEAL_PREFIX.length);
  const version = colon < 0 ? NaN : Number(stored.slice(SEAL_PREFIX.length, colon));
  if (!Number.isInteger(version) || version < 1) {
    throw new SealError('format', 'The seal has no readable version.');
  }
  if (version > FORMAT_VERSION) {
    throw new SealError(
      'version',
      `Sealed by a newer version of the app (format ${version}; this build reads ${FORMAT_VERSION}).`,
    );
  }
  const hex = stored.slice(colon + 1);
  const minHex = (KEY_ID_BYTES + NONCE_BYTES + TAG_BYTES) * 2;
  if (hex.length < minHex || hex.length % 2 !== 0 || !/^[0-9a-f]+$/.test(hex)) {
    throw new SealError('format', 'The seal is truncated or damaged.');
  }
  const body = hexToBytes(hex);
  const expectedId = keyIdOf(key);
  for (let i = 0; i < KEY_ID_BYTES; i++) {
    if (body[i] !== expectedId[i]) {
      throw new SealError('keyMismatch', 'Sealed under a vault key this phone no longer has.');
    }
  }
  const nonce = body.slice(KEY_ID_BYTES, KEY_ID_BYTES + NONCE_BYTES);
  let plaintext: Uint8Array;
  try {
    plaintext = xchacha20poly1305(key, nonce, associatedData(kind, boxId)).decrypt(
      body.slice(KEY_ID_BYTES + NONCE_BYTES),
    );
  } catch {
    throw new SealError('tampered', 'The seal does not verify for this box.');
  }
  return decodeUtf8(plaintext);
}
