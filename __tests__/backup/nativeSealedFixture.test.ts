// Bytes sealed by the NATIVE cipher on a real device, opened here by the JS fallback.
//
// `bulkCipher.ts` claims the two implementations are interchangeable: a backup written on a phone
// with quick-crypto linked has to open on a build without it, and the other way round. Jest cannot
// load the native module, so nothing in this suite could check that claim - it was a comment.
//
// This is the check. The hex below was produced on an Android emulator by the native AES-256-GCM
// path (`native=true`, verified in the same run) sealing 100 known bytes through `sealFile` with a
// 32-byte chunk size. If the fallback ever stops agreeing with it - a changed nonce derivation, a
// different HKDF info string, a reordered header - this fails, and it fails for every existing
// backup at the same moment.
//
// It is also 006 T028 in miniature: a stored artifact from one build, restored by today's code.

import { openFile } from '../../src/services/backup/fileSeal';

/** Sealed on device 2026-09-12 with key = 32 bytes of 0x01, salt = 16 bytes of 0x05. */
const DEVICE_SEALED_HEX =
  '4f42414c4b414600010000002005050505050505050505050505050505b7852a1d602469' +
  '02bde49c10f4a38e3a551eaeb36c935a05197232429add9dce64b67a2eef6e66565886df' +
  'ce374a3e248a4ea85a2be54aabebfbfcc10a99a482a0a43e2d2e788aa5154e7bf0522019' +
  '22b453b63b9c9730d4eaad8d7bbe180a4b9a00cacebd49ccc84dd7a64c96d62320b78ba8' +
  '3ca3a48539ecf35522e78b8825f4915db8b42278c0425be84546d25764f6d554eb33ebdb' +
  '0f59f3810d2b162f0bf29e36a2';

const bytes = (() => {
  const hex = DEVICE_SEALED_HEX.replace(/[^0-9a-f]/g, '');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
})();

describe('a file sealed by the native cipher', () => {
  it('opens on the JavaScript fallback, byte for byte', async () => {
    let read = 0;
    const got: number[] = [];
    await openFile(
      new Uint8Array(32).fill(1),
      async n => (read >= bytes.length ? null : bytes.subarray(read, (read += n))),
      async b => {
        got.push(...b);
      },
    );
    // The device sealed 100 bytes of (i * 7) & 0xff.
    expect(got).toEqual(Array.from({ length: 100 }, (_, i) => (i * 7) & 0xff));
  });
});
