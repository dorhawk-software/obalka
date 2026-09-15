// The backup envelope (006 T004).
//
// The failure this format has to survive is silent: a backup written today, never opened, and needed
// in two years on a phone that does not exist yet. So these tests are less about "does it encrypt" -
// @noble answers that - and more about the decisions that keep a file openable later, and the ones
// that make a failure legible when it happens.

import { decodeUtf8, encodeUtf8 } from '../../src/services/text/textCodec';
import {
  BackupAuthError,
  BackupFormatError,
  FORMAT_VERSION,
  KDF_DEFAULTS,
  open,
  seal,
} from '../../src/services/backup/envelope';

/** Cheap parameters: these tests are about the format, not about how long Argon2id takes. */
const FAST = { m: 256, t: 1, p: 1 };
const KEY = 'FKPX-9WQ2-7TDM-4RJH';
const payload = () => encodeUtf8('{"messages":[{"subject":"Rozhodnuti"}]}');

describe('seal / open', () => {
  it('round-trips a snapshot', async () => {
    const sealed = await seal(payload(), KEY, FAST);
    expect(decodeUtf8(await open(sealed, KEY))).toContain('Rozhodnuti');
  });

  it('produces different bytes every time, from the same input', async () => {
    // A fresh salt and nonce per file. Identical ciphertext for identical input would leak that two
    // backups are the same, which for an archive is close to leaking that nothing arrived.
    const a = await seal(payload(), KEY, FAST);
    const b = await seal(payload(), KEY, FAST);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  it('reveals nothing in the clear', async () => {
    const sealed = await seal(payload(), KEY, FAST);
    const asText = Buffer.from(sealed).toString('utf8');
    expect(asText).not.toContain('Rozhodnuti');
    expect(asText).not.toContain('messages');
  });
});

describe('when it will not open', () => {
  it('says a wrong key is a wrong key', async () => {
    const sealed = await seal(payload(), KEY, FAST);
    await expect(open(sealed, 'WRONG-KEY-0000-0000')).rejects.toThrow(BackupAuthError);
  });

  it('refuses a file altered anywhere - header or ciphertext', async () => {
    const sealed = await seal(payload(), KEY, FAST);
    // The header is authenticated as additional data, so editing the KDF cost is not a way to make
    // the next attempt cheaper: it just stops the tag matching.
    for (const at of [10, 20, sealed.length - 1]) {
      const tampered = Uint8Array.from(sealed);
      tampered[at] ^= 0x01;
      await expect(open(tampered, KEY)).rejects.toThrow();
    }
  });

  it('rejects something that is not a backup at all, before trying to decrypt it', async () => {
    const notABackup = encodeUtf8('PK this is a zip file');
    await expect(open(notABackup, KEY)).rejects.toThrow(BackupFormatError);
    await expect(open(new Uint8Array(4), KEY)).rejects.toThrow(BackupFormatError);
  });

  it('refuses a NEWER format instead of misreading it', async () => {
    // The important half. Older code that guessed would derive a key from misread parameters and
    // report "wrong recovery key" - sending someone to hunt for a key that was never the problem.
    const sealed = await seal(payload(), KEY, FAST);
    const fromTheFuture = Uint8Array.from(sealed);
    fromTheFuture[7] = FORMAT_VERSION + 1; // the version byte, straight after the magic
    await expect(open(fromTheFuture, KEY)).rejects.toThrow(/newer version of the app/);
  });
});

describe('the KDF parameters travel with the file', () => {
  it('opens an older backup with ITS parameters rather than today equivalents', async () => {
    // This is what lets the cost be raised later without orphaning every backup already written.
    const sealed = await seal(payload(), KEY, { m: 256, t: 1, p: 1 });
    await expect(open(sealed, KEY)).resolves.toBeInstanceOf(Uint8Array);
  });

  it('actually uses what the header says', async () => {
    // Two files, same key, different costs: both open. If the reader ignored the header and used a
    // constant, one of them could not.
    const cheap = await seal(payload(), KEY, { m: 256, t: 1, p: 1 });
    const dearer = await seal(payload(), KEY, { m: 512, t: 2, p: 1 });
    expect(await open(cheap, KEY)).toEqual(await open(dearer, KEY));
  });

  it('ships a default cost worth the name', () => {
    // Not a style assertion: a KDF that is cheap to run is cheap to attack, and the security of a
    // backup sitting in someone cloud account rests on this number.
    expect(KDF_DEFAULTS.m).toBeGreaterThanOrEqual(65536); // >= 64 MiB
    expect(KDF_DEFAULTS.t).toBeGreaterThanOrEqual(3);
  });
});
