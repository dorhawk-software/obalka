// A scroll view that ends at the screen's bottom edge has to end ABOVE the gesture bar.
//
// The bottom safe-area inset is 0 on a device with hardware navigation keys and on most emulator
// images - which is why four screens shipped with a bare `paddingBottom: 28` (settings, the OTP form,
// the message detail) or `96` (the inbox, clearing the compose FAB) and looked correct every single
// time anyone checked. On any phone with a gesture bar the last row sat under it, and on the inbox the
// last message sat under the FAB.
//
// `useContentBottom(gap)` is the fix and this is the rule: inside a `contentContainerStyle`, a bottom
// padding is a computed value, never a literal.

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(__dirname, '../..');
const SRC = join(ROOT, 'src');

/**
 * Scroll views that do NOT end at the screen edge: each one sits above a footer pinned to the bottom
 * of the same screen, and that footer carries the inset (`paddingBottom={insets.bottom + …}`). Their
 * literal padding is the gap to the FOOTER, which is a fixed distance and correctly a literal.
 *
 * The exemption is checked rather than trusted - the assertion below fails if one of these files
 * stops applying the inset in its footer, which is the change that would make the literal wrong.
 */
const ABOVE_A_PINNED_FOOTER = [
  'src/features/accounts/screens/ReauthForm.tsx',
  'src/features/accounts/screens/AddBoxForm.tsx',
  'src/features/messages/screens/ComposeScreen.tsx',
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return sourceFiles(full);
    }
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

/** `contentContainerStyle={{ … }}` - the objects are flat, so a brace ends one. */
const LITERAL_BOTTOM = /contentContainerStyle=\{\{[^}]*paddingBottom:\s*\d/;

describe('scroll content and the bottom inset', () => {
  const files = sourceFiles(SRC);

  it('scans the whole app', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('never hardcodes the padding under a scroll view', () => {
    const offenders = files
      .filter(f => LITERAL_BOTTOM.test(readFileSync(f, 'utf8')))
      .map(f => relative(ROOT, f))
      .filter(f => !ABOVE_A_PINNED_FOOTER.includes(f))
      .map(f => `${f} - use useContentBottom(gap) / useFabClearance()`);
    expect(offenders).toEqual([]);
  });

  it('each exempt screen really does pin a footer that carries the inset', () => {
    for (const f of ABOVE_A_PINNED_FOOTER) {
      const text = readFileSync(join(ROOT, f), 'utf8');
      expect([f, /paddingBottom=\{[^}]*insets\.bottom/.test(text)]).toEqual([
        f,
        true,
      ]);
    }
  });
});
