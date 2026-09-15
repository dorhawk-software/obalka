// A box's own colour (027 US3).
//
// It used to be a hash of the box ID over the six sender-avatar hues, so two boxes could land on the
// same one and nothing could change it - and the merged list, which tells boxes apart by colour, then
// could not. Now each box stores a colour: a new box takes the first one no other box has, boxes from
// before this get distinct ones once (`AccountsController.listAccounts`), and the user can pick any of
// them ("Upravit schránku").
//
// Ten hues chosen to be told apart from each other, not just from the paper: no two blues, no two
// greens. Every one keeps the white monogram at WCAG AA (`__tests__/theme/contrast.test.ts` measures
// each), and they do not follow the theme, like the sender avatars.

import { avatarColor } from './avatar';

export const BOX_COLORS = [
  '#2A5C9A', // brand blue
  '#0E6E6E', // teal
  '#5A4CA8', // purple
  '#1B6E52', // green
  '#8A5A18', // bronze
  '#9B3B4E', // rose
  '#3D5A1E', // olive
  '#A23E2E', // rust
  '#7A3E8C', // plum
  '#2D6A8C', // steel
] as const;

export type BoxColor = (typeof BOX_COLORS)[number];

/** Each colour's name, for the string key a screen reader is read (`boxColor.<name>`). */
const NAMES: Record<BoxColor, string> = {
  [BOX_COLORS[0]]: 'blue',
  [BOX_COLORS[1]]: 'teal',
  [BOX_COLORS[2]]: 'purple',
  [BOX_COLORS[3]]: 'green',
  [BOX_COLORS[4]]: 'bronze',
  [BOX_COLORS[5]]: 'rose',
  [BOX_COLORS[6]]: 'olive',
  [BOX_COLORS[7]]: 'rust',
  [BOX_COLORS[8]]: 'plum',
  [BOX_COLORS[9]]: 'steel',
};

/** The colour's name as the string key under which it is translated. */
export function boxColorKey(color: BoxColor): `boxColor.${string}` {
  return `boxColor.${NAMES[color]}`;
}

export function isBoxColor(value: unknown): value is BoxColor {
  return typeof value === 'string' && (BOX_COLORS as readonly string[]).includes(value);
}

/**
 * The one way to read a box's colour. A box that has none yet (between an upgrade and the backfill)
 * falls back to the old hash of its ID, so nothing ever renders colourless.
 */
export function boxColor(account: { boxId: string; color?: string | null }): string {
  return isBoxColor(account.color) ? account.color : avatarColor(account.boxId);
}

/** The first palette colour none of `taken` uses, or - all ten taken - the least used one. */
export function nextBoxColor(taken: readonly (string | null | undefined)[]): BoxColor {
  const counts = new Map<string, number>(BOX_COLORS.map(c => [c, 0]));
  for (const c of taken) {
    if (c != null && counts.has(c)) {
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  let best: BoxColor = BOX_COLORS[0];
  for (const c of BOX_COLORS) {
    if ((counts.get(c) ?? 0) < (counts.get(best) ?? 0)) {
      best = c;
    }
  }
  return best;
}
