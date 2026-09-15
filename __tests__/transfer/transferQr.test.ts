// The transfer phrase as a QR (025).
//
// Two codes now exist in this app that a camera might see, and both are secrets on a screen. The
// tests that matter are the ones that keep them apart and keep everything else out.

import {
  TRANSFER_QR_PREFIX,
  encodeTransferQr,
  parseTransferQr,
} from '../../src/services/transfer/transferQr';
import { encodeKeyQr, parseKeyQr, qrMatrix } from '../../src/services/backup/keyQr';
import { generateCodePhrase } from '../../src/services/transfer/codePhrase';

describe('a transfer phrase as a code', () => {
  it('round-trips', () => {
    for (let i = 0; i < 25; i++) {
      const phrase = generateCodePhrase();
      expect(parseTransferQr(encodeTransferQr(phrase))).toBe(phrase);
    }
  });

  it('stays inside QR s alphanumeric charset, so the symbol stays small', () => {
    // The phrase is lowercase words; alphanumeric mode is uppercase only. Upper-casing on the way in
    // is what keeps this a code somebody can scan across a table rather than a dense byte-mode one.
    const payload = encodeTransferQr(generateCodePhrase());
    expect(payload).toMatch(/^[0-9A-Z$%*+\-./: ]+$/);
    // And it really does encode in that mode.
    expect(() => qrMatrix(payload)).not.toThrow();
  });

  it('CANNOT be confused with a recovery key, in either direction', () => {
    // Both are secrets this app shows on a screen and both get scanned by the same camera. Feeding
    // one into the other's field would report "wrong password" for something that was never one.
    const phrase = generateCodePhrase();
    const key = 'FKPX-9WQ2-7TDM-4RJH-2CVB';
    expect(parseKeyQr(encodeTransferQr(phrase))).toBeNull();
    expect(parseTransferQr(encodeKeyQr(key))).toBeNull();
  });

  it('refuses every other code in the world', () => {
    // A camera pointed at a table sees timetables, Wi-Fi codes and payment QRs. PAKE gives one guess
    // per attempt, so a wrong candidate is not free.
    for (const junk of [
      'https://example.com',
      'WIFI:S:cafe;T:WPA;P:hunter2;;',
      '7K2M-ryba-kotva-duha-lampa',
      '',
      TRANSFER_QR_PREFIX,
    ]) {
      expect(parseTransferQr(junk)).toBeNull();
    }
  });

  it('is forgiving about the prefix s own case, and nothing else', () => {
    const phrase = generateCodePhrase();
    expect(parseTransferQr(encodeTransferQr(phrase).toLowerCase())).toBe(phrase);
    expect(parseTransferQr(`OBALKAX:${phrase}`)).toBeNull();
  });
});
