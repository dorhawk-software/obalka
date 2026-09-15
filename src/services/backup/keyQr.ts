// The recovery key as a QR code (006 T012a).
//
// Typing 20 symbols on a phone that has just been restored is where a good backup design goes to
// die, so the source phone shows the key as a QR and the target phone scans it. What matters here is
// what goes INSIDE the code, and there are three deliberate choices:
//
//   * A prefix. `OBALKA:` lets the scanner ignore every other QR in the world - a Wi-Fi code, a
//     payment code, a URL - instead of silently trying it as a passphrase and reporting "wrong key".
//   * Alphanumeric mode. The key's alphabet, the dashes and the colon are all inside QR's
//     alphanumeric charset, which packs 5.5 bits per character instead of 8. The whole payload lands
//     in a version-3 symbol (29x29) - big modules, easy to scan across a table.
//   * Error correction H (30%). The highest level, which is what pays for the logo sitting in the
//     middle: the modules it covers are RECONSTRUCTED, not lost. `__tests__/backup/keyQr.test.ts`
//     decodes the rendered result to prove that, rather than trusting the arithmetic.
//
// This QR carries the key to the archive, so it is as sensitive as the key itself: it belongs on a
// screen the user is looking at, and nowhere else.

import qrcode from 'qrcode-generator';
import { parseRecoveryKey } from './recoveryKey';

export const KEY_QR_PREFIX = 'OBALKA:';

/** What the source phone displays. */
export function encodeKeyQr(recoveryKey: string): string {
  return `${KEY_QR_PREFIX}${recoveryKey}`;
}

/**
 * Read a scanned code.
 *
 * Returns the canonical key, or null when this is not one of ours. The prefix is required: accepting
 * a bare key would mean every QR code in the camera's view is a candidate passphrase, and the user
 * would be told "that backup could not be opened" when in truth they scanned a bus timetable.
 */
export function parseKeyQr(scanned: string): string | null {
  const text = scanned.trim();
  const upper = text.toUpperCase();
  if (!upper.startsWith(KEY_QR_PREFIX)) {
    return null;
  }
  return parseRecoveryKey(text.slice(KEY_QR_PREFIX.length));
}

/**
 * The QR itself, as a square grid of dark/light modules.
 *
 * Returning the MATRIX rather than an SVG string is what lets the renderer draw the code in the
 * app's own shapes and knock a hole in the middle for the logo - and lets the test rasterize it and
 * decode it with an independent decoder.
 */
export function qrMatrix(payload: string): boolean[][] {
  const qr = qrcode(0, 'H');
  qr.addData(payload, 'Alphanumeric');
  qr.make();
  const count = qr.getModuleCount();
  const rows: boolean[][] = [];
  for (let row = 0; row < count; row++) {
    const cells: boolean[] = [];
    for (let col = 0; col < count; col++) {
      cells.push(qr.isDark(row, col));
    }
    rows.push(cells);
  }
  return rows;
}
