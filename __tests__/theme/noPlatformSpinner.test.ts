// The app's waits are its own (031 I76, R8 and R12, agreed 2026-11-12; T042 Q1 "busy buttons keep
// their small spinner"): where an object waits, the waiting bar; on a line or in a busy button, R12's
// ring (`ArcSpinner`). The platform's spinner is a bare arc in a colour and rhythm of its own on each
// system. Until 2026-11-15 eleven places drew it; this keeps the twelfth from arriving.

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(__dirname, '../..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walk(path, out);
    } else if (/\.tsx?$/.test(name)) {
      out.push(path);
    }
  }
  return out;
}

/** A platform spinner: React Native's, or Tamagui's (`Spinner`, never `ArcSpinner`). */
export function platformSpinners(source: string): number {
  return (source.match(/\bActivityIndicator\b|(?<![A-Za-z])Spinner\b/g) ?? []).length;
}

describe('the app draws its own waits', () => {
  it('uses no platform spinner anywhere in src', () => {
    const offenders = walk(join(ROOT, 'src'))
      .filter(f => platformSpinners(readFileSync(f, 'utf8')) > 0)
      .map(f => relative(ROOT, f));
    expect(offenders).toEqual([]);
  });

  it('is judged by the import and the element, and lets the ring through', () => {
    expect(platformSpinners("import { Spinner } from 'tamagui';\n<Spinner size=\"small\" />")).toBe(2);
    expect(platformSpinners("import { ActivityIndicator } from 'react-native';")).toBe(1);
    expect(platformSpinners('<ArcSpinner track={a} ink={b} />')).toBe(0);
  });
});

// Pull to refresh is the one wait the platform draws (R14: "pull to refresh retries"). Android puts
// its arrow on a disc that is white unless told otherwise: in dark mode, a white blob on the dark
// paper (walked 2026-11-15, 031 I122). Every one sets the disc to the card's surface.
/** The `<RefreshControl …>` elements in a file, each as its own source text. */
export function refreshControls(source: string): string[] {
  return source.match(/<RefreshControl\b[^>]*>/g) ?? [];
}

describe("pull to refresh's disc", () => {
  it('takes the surface in both themes, never the platform white', () => {
    const offenders = walk(join(ROOT, 'src')).flatMap(f =>
      refreshControls(readFileSync(f, 'utf8'))
        .filter(el => !el.includes('progressBackgroundColor={theme.surface}'))
        .map(() => relative(ROOT, f)),
    );
    expect(offenders).toEqual([]);
  });

  it('is judged by the element itself', () => {
    expect(refreshControls('<RefreshControl a={1}\n b={2} />')).toHaveLength(1);
  });
});
