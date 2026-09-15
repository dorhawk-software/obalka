// The QR path the renderer actually draws (006 T012a).
//
// `keyQr.test.ts` proves a matrix with a hole in it still decodes; this proves the RENDERER punches
// the same hole in the same place, so the two tests together cover the drawn code rather than an
// idealised one.

import jsQR from 'jsqr';
import { qrPathData } from '../../src/theme/QrCode';
import { encodeKeyQr, qrMatrix } from '../../src/services/backup/keyQr';

const KEY = 'FKPX-9WQ2-7TDM-4RJH-2CVB';
const QUIET = 4;
const HOLE = 7;

/** Read the drawn path back into pixels - one rectangle subpath per dark module, `M<x> <y>h1v1h-1z`. */
function rasterizePath(d: string, span: number, scale = 8) {
  const width = span * scale;
  const data = new Uint8ClampedArray(width * width * 4).fill(255);
  for (const [, sx, sy] of d.matchAll(/M(\d+) (\d+)h1v1h-1z/g)) {
    const col = Number(sx);
    const row = Number(sy);
    for (let y = 0; y < scale; y++) {
      for (let x = 0; x < scale; x++) {
        const px = (row * scale + y) * width + col * scale + x;
        data[px * 4] = 0;
        data[px * 4 + 1] = 0;
        data[px * 4 + 2] = 0;
      }
    }
  }
  return { data, width };
}

describe('QrCode drawing', () => {
  const matrix = qrMatrix(encodeKeyQr(KEY));
  const d = qrPathData(matrix, HOLE);

  it('is still readable as drawn, hole and all', () => {
    const { data, width } = rasterizePath(d, matrix.length + QUIET * 2);
    expect(jsQR(data, width, width)?.data).toBe(encodeKeyQr(KEY));
  });

  it('omits exactly the modules the logo plate covers', () => {
    const dark = matrix.flat().filter(Boolean).length;
    const from = Math.floor((matrix.length - HOLE) / 2);
    let covered = 0;
    for (let row = from; row < from + HOLE; row++) {
      for (let col = from; col < from + HOLE; col++) {
        if (matrix[row][col]) {
          covered++;
        }
      }
    }
    expect([...d.matchAll(/M/g)]).toHaveLength(dark - covered);
    expect(covered).toBeGreaterThan(0); // otherwise this test proves nothing
  });

  it('leaves the full quiet zone around the code', () => {
    const coords = [...d.matchAll(/M(\d+) (\d+)/g)].flatMap(m => [Number(m[1]), Number(m[2])]);
    expect(Math.min(...coords)).toBeGreaterThanOrEqual(QUIET);
    expect(Math.max(...coords)).toBeLessThan(matrix.length + QUIET);
  });
});
