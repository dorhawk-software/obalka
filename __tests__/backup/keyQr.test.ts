// The recovery-key QR (006 T012a) - verified by DECODING it.
//
// A QR test that only checks "the matrix has some dark modules" proves nothing about the thing that
// matters: whether a phone camera reads the key back. So these tests rasterize the matrix the way the
// renderer draws it and run an independent decoder (jsQR, dev-only) over the pixels. That includes
// the case the logo inlay exists for: modules knocked out of the middle must be RECONSTRUCTED by the
// error correction, not lost.

import jsQR from 'jsqr';
import {
  KEY_QR_PREFIX,
  encodeKeyQr,
  parseKeyQr,
  qrMatrix,
} from '../../src/services/backup/keyQr';
import { generateRecoveryKey } from '../../src/services/backup/recoveryKey';

const KEY = 'FKPX-9WQ2-7TDM-4RJH-2CVB';

/** Draw the matrix as RGBA pixels: `scale` px per module, plus the 4-module quiet zone. */
function rasterize(
  matrix: boolean[][],
  { scale = 8, quiet = 4, hole = 0 } = {},
): { data: Uint8ClampedArray; width: number } {
  const count = matrix.length;
  const width = (count + quiet * 2) * scale;
  const data = new Uint8ClampedArray(width * width * 4).fill(255);
  const holeFrom = Math.floor((count - hole) / 2);
  const holeTo = holeFrom + hole;
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      const covered =
        hole > 0 && row >= holeFrom && row < holeTo && col >= holeFrom && col < holeTo;
      if (!matrix[row][col] || covered) {
        continue;
      }
      for (let y = 0; y < scale; y++) {
        for (let x = 0; x < scale; x++) {
          const px = ((row + quiet) * scale + y) * width + (col + quiet) * scale + x;
          data[px * 4] = 0;
          data[px * 4 + 1] = 0;
          data[px * 4 + 2] = 0;
        }
      }
    }
  }
  return { data, width };
}

const decode = (matrix: boolean[][], hole = 0): string | null => {
  const { data, width } = rasterize(matrix, { hole });
  return jsQR(data, width, width)?.data ?? null;
};

describe('recovery key QR', () => {
  it('round-trips through a real decoder', () => {
    expect(decode(qrMatrix(encodeKeyQr(KEY)))).toBe(`${KEY_QR_PREFIX}${KEY}`);
  });

  it('still decodes with the middle covered by the logo', () => {
    const matrix = qrMatrix(encodeKeyQr(KEY));
    // 9x9 of a 29x29 symbol - LARGER than the renderer's 7x7 inlay, so this fails before a real logo
    // would break scanning rather than after.
    expect(decode(matrix, 9)).toBe(`${KEY_QR_PREFIX}${KEY}`);
  });

  it('fits a 29x29 symbol - big modules, scannable across a table', () => {
    expect(qrMatrix(encodeKeyQr(KEY))).toHaveLength(29);
  });

  it('holds any key the generator can produce', () => {
    for (let i = 0; i < 20; i++) {
      const key = generateRecoveryKey();
      expect(parseKeyQr(decode(qrMatrix(encodeKeyQr(key))) ?? '')).toBe(key);
    }
  });

  it('reads a scanned code back, forgiving how it was typed or cased', () => {
    expect(parseKeyQr(`${KEY_QR_PREFIX}${KEY}`)).toBe(KEY);
    expect(parseKeyQr(`obalka:fkpx-9wq2-7tdm-4rjh-2cvb`)).toBe(KEY);
    expect(parseKeyQr(`  ${KEY_QR_PREFIX}${KEY}\n`)).toBe(KEY);
  });

  it('refuses every QR code that is not ours', () => {
    // Without the prefix these would be tried as passphrases, and the user would be told their
    // backup could not be opened when they had simply scanned the wrong thing.
    expect(parseKeyQr('https://example.com')).toBeNull();
    expect(parseKeyQr('WIFI:S=cafe;T=WPA;P=hunter2;;')).toBeNull();
    expect(parseKeyQr(KEY)).toBeNull();
    expect(parseKeyQr(`${KEY_QR_PREFIX}FKPX-9WQ2`)).toBeNull();
  });
});
