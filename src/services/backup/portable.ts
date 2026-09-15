// One file the user can carry away (006 T014).
//
// A backup that only exists inside the app's own storage is not a backup. It dies with the phone,
// which is the event it was made for. This is the format that leaves: a single file to put in a
// password manager, on a memory card, or in whatever cloud the user already trusts.
//
// WHY IT IS NOT JUST THE ARCHIVE. The sealed archive already carries a versioned header, so it can
// identify itself. What it cannot do is answer "can this build restore it?" without the passphrase:
// `schemaVersion`, `tiers` and `createdAt` live in the MANIFEST, and `listRestorable` has to judge
// compatibility before anyone is asked to unlock anything. Exporting the archive alone would mean
// importing it blind and only discovering a year-old incompatibility at the moment of restoring.
// So the two travel together, framed.
//
// The framing follows `envelope.ts`: magic first, version second, lengths big-endian. Same reason -
// bytes written today have to be readable by a build nobody has written yet, and the first thing
// that build must be able to do is recognise what it is holding and refuse politely if it is newer.
//
// NOT encryption. The archive inside is already sealed with the user's passphrase; this only wraps
// it. The manifest beside it is deliberately in the clear: a date, a size and a schema number are
// what let someone decide whether a file is worth keeping, and none of them says anything about the
// mail. Nothing here weakens the envelope, and nothing here can be used to read it.

import type { BackupManifest } from './schema';
import { decodeUtf8, encodeUtf8 } from '../text/textCodec';

/** `OBALKAP\0` - the envelope's magic with a P, so the two cannot be confused for one another. */
const MAGIC = new Uint8Array([0x4f, 0x42, 0x41, 0x4c, 0x4b, 0x41, 0x50, 0x00]);

export const PORTABLE_VERSION = 1;

/** magic + version + u32 manifest length. */
const HEADER_BYTES = MAGIC.length + 1 + 4;

/**
 * The extension an exported backup gets.
 *
 * Its own, rather than `.zip` or `.bin`: a file called `obalka-2026-09-12.obalka` is recognisably
 * this app's and recognisably not something to open by double-clicking, which is the right
 * expectation for a file whose contents are encrypted.
 */
export const PORTABLE_EXTENSION = 'obalka';

/** Thrown for a file this build cannot read, with a sentence meant for a person. */
export class PortableFormatError extends Error {}

/** Frame a manifest and its sealed archive into the single file the user takes away. */
export function packPortable(
  manifest: BackupManifest,
  archive: Uint8Array,
): Uint8Array {
  const json = encodeUtf8(JSON.stringify(manifest));
  const out = new Uint8Array(HEADER_BYTES + json.length + archive.length);
  const view = new DataView(out.buffer);
  out.set(MAGIC, 0);
  let o = MAGIC.length;
  out[o] = PORTABLE_VERSION;
  o += 1;
  view.setUint32(o, json.length, false); // big-endian: a file format, not a memory layout
  o += 4;
  out.set(json, o);
  o += json.length;
  out.set(archive, o);
  return out;
}

/**
 * Read one back.
 *
 * Every failure here is a file the user chose by hand, so every message says which of the three
 * things went wrong: it is not ours, it is from a newer build, or it is damaged. "Import failed"
 * would leave someone guessing whether their only backup is gone.
 */
export function unpackPortable(bytes: Uint8Array): {
  manifest: BackupManifest;
  archive: Uint8Array;
} {
  if (bytes.length < HEADER_BYTES) {
    throw new PortableFormatError('Not an Obálka backup: the file is too short.');
  }
  for (let i = 0; i < MAGIC.length; i++) {
    if (bytes[i] !== MAGIC[i]) {
      throw new PortableFormatError('Not an Obálka backup file.');
    }
  }
  let o = MAGIC.length;
  const version = bytes[o];
  o += 1;
  if (version > PORTABLE_VERSION) {
    throw new PortableFormatError(
      `This backup was exported by a newer version of the app (format ${version}; this build reads ${PORTABLE_VERSION}). Update the app to import it.`,
    );
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const jsonLength = view.getUint32(o, false);
  o += 4;
  // Checked before slicing: a corrupt length is the field most likely to be wrong in a truncated
  // file, and reading past the end would surface as a confusing JSON error instead of a clear one.
  if (jsonLength === 0 || o + jsonLength > bytes.length) {
    throw new PortableFormatError('This backup file is damaged (bad manifest length).');
  }
  let manifest: BackupManifest;
  try {
    manifest = JSON.parse(decodeUtf8(bytes.subarray(o, o + jsonLength))) as BackupManifest;
  } catch {
    throw new PortableFormatError('This backup file is damaged (unreadable manifest).');
  }
  o += jsonLength;
  const archive = bytes.subarray(o);
  if (archive.length === 0) {
    throw new PortableFormatError('This backup file is damaged (no archive inside).');
  }
  // The manifest travels in the clear, so its size claim is the one field an edit could use to make
  // a restore look wrong. Checking it here turns that into an honest "damaged" rather than a failure
  // deep inside the restore, where it would read as the ARCHIVE being broken.
  if (
    typeof manifest.sizeBytes === 'number' &&
    manifest.sizeBytes !== archive.length
  ) {
    throw new PortableFormatError(
      'This backup file is damaged (its size does not match what the manifest says).',
    );
  }
  return { manifest, archive };
}

/**
 * The name an exported file gets, from the moment the backup was made.
 *
 * Dated rather than sequential, because the question someone asks of a folder full of these is "how
 * old is this one?" and the answer should not require opening anything.
 */
export function portableFileName(manifest: BackupManifest): string {
  const d = new Date(manifest.createdAt);
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  return `obalka-${stamp}.${PORTABLE_EXTENSION}`;
}
