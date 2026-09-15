// What a stored document is called, and why it is not a hash of the document (006 T020).
//
// Objects in a backup are named by their content so the same file is stored once and an interrupted
// run can skip what is already there. The obvious way to do that is SHA-256 of the bytes, and for
// this app it would be a privacy hole rather than an optimisation.
//
// Government mail is full of identical documents. Every data box receives the same ISDS welcome
// letter; every sole trader gets the same VAT notice template; a whole street gets the same
// municipal decision. With a plain hash, anyone holding the storage - a cloud provider, or whoever
// ends up with a copy of the backup - can hash a document they already have and learn, without
// decrypting anything, whether it is in there. That turns "an encrypted backup" into "an encrypted
// backup with a searchable index of which well-known letters you received".
//
// So the name is an HMAC under a key only the user has, derived from the backup key. Identical files
// still collide for THAT user, which is what makes deduplication and resume work, and mean nothing
// to anybody else: without the key, two users' names for the same document are unrelated, and no
// document can be recognised by name at all.
//
// Streaming, because the input is an attachment and attachments are large. Never assemble the file
// to name it.

import { hmac } from '@noble/hashes/hmac.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { BULK_KEY_BYTES } from './bulkCipher';
import { encodeUtf8 } from '../text/textCodec';

/** Its own info string, so this key can never be the one that seals anything. */
const HKDF_INFO = encodeUtf8('obalka/backup/content-id/v1');

/** Hex characters kept from the 256-bit HMAC. 128 bits: far past collision risk for one archive. */
const ID_CHARS = 32;

export class ContentIdError extends Error {}

/**
 * The naming key, derived from the backup key.
 *
 * Separate from the file-sealing key on purpose. Naming and sealing are different jobs, and a key
 * that does both would mean a bug in one reaching the other.
 */
export function deriveContentIdKey(backupKey: Uint8Array): Uint8Array {
  if (backupKey.length !== BULK_KEY_BYTES) {
    throw new ContentIdError('bad backup key');
  }
  return hkdf(sha256, backupKey, undefined, HKDF_INFO, BULK_KEY_BYTES);
}

/**
 * Names a document as its chunks arrive.
 *
 * `update` takes the same pieces the sealer takes, so a file is read once and both consumed from
 * that single pass rather than read twice.
 */
export function contentIdStream(idKey: Uint8Array): {
  update: (chunk: Uint8Array) => void;
  digest: () => string;
} {
  if (idKey.length !== BULK_KEY_BYTES) {
    throw new ContentIdError('bad content-id key');
  }
  const h = hmac.create(sha256, idKey);
  let done = false;
  return {
    update(chunk) {
      if (done) {
        throw new ContentIdError('content id already taken');
      }
      h.update(chunk);
    },
    digest() {
      done = true;
      const full = h.digest();
      let out = '';
      for (let i = 0; out.length < ID_CHARS; i++) {
        out += full[i].toString(16).padStart(2, '0');
      }
      return out.slice(0, ID_CHARS);
    },
  };
}

/** The whole-buffer form, for small inputs and for tests. */
export function contentIdOf(idKey: Uint8Array, bytes: Uint8Array): string {
  const s = contentIdStream(idKey);
  s.update(bytes);
  return s.digest();
}

/**
 * The object name a content id gets in the target.
 *
 * Prefixed and extensionless: nothing about the stored name should suggest what the file is, and the
 * prefix keeps documents from colliding with the metadata archive in a flat store.
 */
export const objectNameFor = (contentId: string) => `doc-${contentId}`;
