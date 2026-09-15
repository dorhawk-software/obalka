// The backup envelope (006 Phase 1): a passphrase and some bytes in, ciphertext nobody else can read
// out - and back again, on a device that may not exist yet.
//
// This is the part of a backup feature that has to be right, because its failure mode is silent. A
// backup that cannot be opened does not announce itself when it is written; it announces itself on the
// day a phone is lost, which is the worst possible moment to discover a format decision.
//
// Three choices follow from that, and none of them is about the cipher:
//
// 1. **The header is versioned from the first byte.** Bytes written today must be readable by an app
//    built in three years, and an app built today must REFUSE bytes it does not understand rather than
//    misparse them into a wrong key and a confusing failure.
// 2. **The KDF parameters travel inside the file.** Argon2id costs get raised as phones get faster.
//    Hardcoding them means every raise orphans every existing backup; carrying them means an old
//    backup opens with its own parameters and a new one is written with today's.
// 3. **The key is generated, not typed.** A recovery key from a CSPRNG has no weak instances. A
//    passphrase people choose does, and the ones who most need a backup are the least likely to pick a
//    strong one. See `recoveryKey.ts`.
//
// Why the crypto is pure JavaScript: `@noble` needs no native module, which means it runs in jest and
// needs no rebuild on either platform. That is affordable HERE because the KDF runs once per backup
// and this envelope only carries the metadata tier (megabytes). It would not be affordable for the
// attachment tier - see research.md §3, which is why that tier is deliberately not built on this.

import { deriveArgon2id } from './argon2';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';

/** `OBALKA\x00` - so a truncated or foreign file is rejected before anything else is attempted. */
const MAGIC = new Uint8Array([0x4f, 0x42, 0x41, 0x4c, 0x4b, 0x41, 0x00]);

/**
 * Bumped only for a change that makes old files unreadable by new code, or vice versa. Adding a field
 * the reader can default is not a version bump; changing what a byte MEANS is.
 */
export const FORMAT_VERSION = 1;

/**
 * Argon2id cost, as written into new backups today.
 *
 * 64 MiB / 3 passes is the OWASP-style middle setting: about a second on a laptop, and the number
 * worth measuring on a mid-range phone before shipping (006 T005). It is recorded per file, so
 * raising it later costs nothing to anyone holding an older backup.
 */
export const KDF_DEFAULTS = { m: 65536, t: 3, p: 1 } as const;

const SALT_BYTES = 16;
const NONCE_BYTES = 24; // XChaCha20 - a random nonce per file is safe at this size

export interface KdfParams {
  /** Memory in KiB. */
  m: number;
  /** Passes. */
  t: number;
  /** Lanes. */
  p: number;
}

export class BackupFormatError extends Error {}

/** Everything before the ciphertext, in the order it is written. */
interface Header {
  formatVersion: number;
  kdf: KdfParams;
  salt: Uint8Array;
  nonce: Uint8Array;
}

const HEADER_BYTES =
  MAGIC.length + 1 + 4 + 4 + 4 + SALT_BYTES + NONCE_BYTES;

function u32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value, false); // big-endian: a file format, not a memory layout
}

function writeHeader(h: Header): Uint8Array {
  const out = new Uint8Array(HEADER_BYTES);
  const view = new DataView(out.buffer);
  out.set(MAGIC, 0);
  let o = MAGIC.length;
  out[o] = h.formatVersion;
  o += 1;
  u32(view, o, h.kdf.m);
  o += 4;
  u32(view, o, h.kdf.t);
  o += 4;
  u32(view, o, h.kdf.p);
  o += 4;
  out.set(h.salt, o);
  o += SALT_BYTES;
  out.set(h.nonce, o);
  return out;
}

function readHeader(bytes: Uint8Array): Header {
  if (bytes.length < HEADER_BYTES) {
    throw new BackupFormatError('Not a backup file: too short to hold a header.');
  }
  for (let i = 0; i < MAGIC.length; i++) {
    if (bytes[i] !== MAGIC[i]) {
      throw new BackupFormatError('Not a backup file: wrong magic.');
    }
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let o = MAGIC.length;
  const formatVersion = bytes[o];
  o += 1;
  if (formatVersion > FORMAT_VERSION) {
    // Refusing beats guessing: a newer file opened by older code would derive a key from parameters
    // it misread and fail as "wrong recovery key", sending the user to look for a key that is fine.
    throw new BackupFormatError(
      `This backup was written by a newer version of the app (format ${formatVersion}; this build reads ${FORMAT_VERSION}). Update the app to restore it.`,
    );
  }
  const kdf = {
    m: view.getUint32(o, false),
    t: view.getUint32(o + 4, false),
    p: view.getUint32(o + 8, false),
  };
  o += 12;
  const salt = bytes.slice(o, o + SALT_BYTES);
  o += SALT_BYTES;
  const nonce = bytes.slice(o, o + NONCE_BYTES);
  if (kdf.m <= 0 || kdf.t <= 0 || kdf.p <= 0) {
    throw new BackupFormatError('Backup header is corrupt: impossible KDF parameters.');
  }
  return { formatVersion, kdf, salt, nonce };
}

/**
 * Derive the file key. ASYNC, and that is the point of the whole signature.
 *
 * Argon2id at 64 MiB is real work - tens of milliseconds through the platform's native library, and
 * seconds in an interpreter. Either way it must not be done synchronously: that holds the JS thread
 * for the duration, so no spinner turns and nothing the user touches responds (Principle I), in the
 * one place the app asks them to wait. `services/backup/argon2` picks the fast path where it exists
 * and proves it agrees with the reference before using it.
 */
async function deriveKey(
  secret: string,
  salt: Uint8Array,
  kdf: KdfParams,
  onProgress?: (fraction: number) => void,
): Promise<Uint8Array> {
  return deriveArgon2id(secret, salt, kdf, onProgress);
}

/** Random bytes from the platform CSPRNG - the same source the SQLCipher key comes from. */
function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  globalThis.crypto.getRandomValues(out);
  return out;
}

/**
 * Encrypt a snapshot under a recovery key.
 *
 * The header is authenticated as additional data, so the parameters cannot be edited to weaken the
 * next attempt to open the file: change a byte of it and the tag stops matching.
 */
export async function seal(
  plaintext: Uint8Array,
  secret: string,
  kdf: KdfParams = KDF_DEFAULTS,
  onProgress?: (fraction: number) => void,
): Promise<Uint8Array> {
  const header = writeHeader({
    formatVersion: FORMAT_VERSION,
    kdf,
    salt: randomBytes(SALT_BYTES),
    nonce: randomBytes(NONCE_BYTES),
  });
  const { salt, nonce } = readHeader(header);
  const key = await deriveKey(secret, salt, kdf, onProgress);
  const ciphertext = xchacha20poly1305(key, nonce, header).encrypt(plaintext);
  const out = new Uint8Array(header.length + ciphertext.length);
  out.set(header, 0);
  out.set(ciphertext, header.length);
  return out;
}

export class BackupAuthError extends Error {}

/**
 * Decrypt a backup, or say why not.
 *
 * The two failures are deliberately different types: a wrong key is something the user can fix by
 * finding the right one, and a corrupt file is not. Collapsing them into one message is how someone
 * spends an evening hunting for a recovery key that was never the problem.
 */
export async function open(
  bytes: Uint8Array,
  secret: string,
  onProgress?: (fraction: number) => void,
): Promise<Uint8Array> {
  const header = readHeader(bytes);
  const key = await deriveKey(secret, header.salt, header.kdf, onProgress);
  const aad = bytes.slice(0, HEADER_BYTES);
  try {
    return xchacha20poly1305(key, header.nonce, aad).decrypt(
      bytes.slice(HEADER_BYTES),
    );
  } catch {
    throw new BackupAuthError(
      'This backup could not be opened with that recovery key. Either the key is wrong or the file has been altered.',
    );
  }
}
