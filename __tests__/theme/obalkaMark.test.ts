// The colourable brand mark is a SECOND copy of the paths in `assets/logo.svg` (react-native-svg-
// transformer bakes the fills, so a black-and-white version cannot reuse the import). This is the
// guard that makes the copy safe: change the logo and this fails, naming the file to update.

import { readFileSync } from 'fs';
import { join } from 'path';

const read = (p: string) => readFileSync(join(__dirname, '../..', p), 'utf8');

describe('ObalkaMark', () => {
  it('draws exactly the paths in assets/logo.svg', () => {
    const paths = [...read('src/assets/logo.svg').matchAll(/ d="([^"]+)"/g)].map(m => m[1]);
    const mark = read('src/theme/ObalkaMark.tsx');

    expect(paths).toHaveLength(2);
    for (const d of paths) {
      // If this fails, the logo changed: copy the new `d` values into src/theme/ObalkaMark.tsx.
      expect(mark).toContain(d);
    }
  });

  it('keeps the brand colours as its defaults', () => {
    const svg = read('src/assets/logo.svg');
    const mark = read('src/theme/ObalkaMark.tsx');
    for (const colour of [...svg.matchAll(/fill="(#[0-9A-Fa-f]{6})"/g)].map(m => m[1])) {
      expect(mark).toContain(colour);
    }
  });
});
