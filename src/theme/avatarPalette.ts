// Deterministic per-sender avatar colour - a mail-app pattern that makes a long list scannable
// (each correspondent keeps a stable identity colour) without resorting to photos. The palette is
// curated to harmonise with the brand (the first entry IS the brand blue) and every colour is dark
// enough that the white initial stays ≥4.5:1 (WCAG AA) in both light and dark themes.

// Redesign (009): the design's avatar hues, each kept ≥4.5:1 with white initials (some design hues
// were lightened for the mock - darkened here so white text stays AA; tracked in T043).
//
// Exported so `__tests__/theme/contrast.test.ts` can measure the monogram against every hue rather
// than against a transcribed copy of this list. That is not a detail: for a while the monogram was
// painted with `onBlue`, which is near-black in dark mode, and every one of these hues carried it at
// 2.11–3.05:1 while the comment above still claimed AA. A derived test covers a hue added tomorrow;
// a hand-written one covers the hues someone remembered.
export const AVATAR_COLORS = [
  '#2A5C9A', // brand blue
  '#0E6E6E', // teal (design hue, AA-darkened)
  '#5A4CA8', // purple (design hue, AA-darkened)
  '#1B6E52', // green
  '#8A5A18', // bronze (design gold hue, AA-darkened)
  '#1E4E80', // deep blue
] as const;

/** Stable colour for a correspondent's initial avatar (same name → same colour). */
export function avatarColor(name: string | null | undefined): string {
  const key = (name ?? '').trim();
  if (!key) {
    return AVATAR_COLORS[0];
  }
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** Mix a hex colour toward white by `amount` (0–1) - a lighter tone for dark-mode text on a dark tint. */
export function lighten(hex: string, amount: number): string {
  const n = hex.replace('#', '');
  const ch = (i: number) => {
    const c = parseInt(n.slice(i, i + 2), 16);
    const m = Math.round(c + (255 - c) * amount);
    return Math.max(0, Math.min(255, m))
      .toString(16)
      .padStart(2, '0');
  };
  return `#${ch(0)}${ch(2)}${ch(4)}`;
}

/** The avatar colour at a given alpha - for a soft tonal fill. */
export function avatarTint(name: string | null | undefined, alpha: number): string {
  const n = avatarColor(name).replace('#', '');
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Czech and common foreign academic degrees, as written before or after a name: "Ing. Ondřej Dvořák"
 * is OD, not IO, and a person's two boxes (FO and PFO) no longer look like two people (031 T050).
 * Matched with their dot (or a comma after them), so a word that only spells like one stays.
 */
const DEGREES = new Set([
  'bc', 'mgr', 'ing', 'arch', 'mudr', 'mddr', 'mvdr', 'judr', 'phdr', 'rndr', 'pharmdr', 'thdr', 'paeddr',
  'icdr', 'thlic', 'thmgr', 'dr', 'doc', 'prof', 'akad', 'phd', 'csc', 'drsc', 'dis', 'mba', 'llm', 'msc',
]);
const DOTLESS = new Set(['mba', 'msc']);

function isDegree(word: string): boolean {
  const bare = word.replace(/[.,]/g, '').toLowerCase();
  return DEGREES.has(bare) && (/[.,]$/.test(word) || word.includes('.') || DOTLESS.has(bare));
}

/**
 * 1–2 letter monogram: initials of the first two words of the name (or the first two letters of a
 * single word), its degrees left out.
 */
export function monogram(name: string | null | undefined): string {
  const all = (name ?? '')
    .trim()
    .split(/\s+/)
    .filter(w => /[\p{L}\p{N}]/u.test(w));
  // "et" joins two degrees ("Mgr. et Mgr."), and goes with them.
  const named = all.filter(
    (w, i) => !isDegree(w) && !(w === 'et' && isDegree(all[i - 1] ?? '') && isDegree(all[i + 1] ?? '')),
  );
  const words = named.length > 0 ? named : all;
  if (words.length === 0) {
    return '?';
  }
  if (words.length === 1) {
    const w = words[0].replace(/[^\p{L}\p{N}]/gu, '');
    return (w.slice(0, 2) || '?').toUpperCase();
  }
  const first = words[0].replace(/[^\p{L}\p{N}]/gu, '')[0] ?? '';
  const second = words[1].replace(/[^\p{L}\p{N}]/gu, '')[0] ?? '';
  return (first + second).toUpperCase();
}
