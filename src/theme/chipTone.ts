// Chip / status tones for the redesign (009). The design wrote these as light-only literals; here each
// tone carries a derived AA dark variant so chips never show a light surface in dark mode (Principle V).
// `soft`/`none` fall back to theme neutrals. Returns { bg, fg, accent }. See design-system.md §3/§6/§7.

import type { Theme } from './theme';

export type ChipKind =
  | 'fikceRed' // delivery-fiction ≤3 days
  | 'fikceAmber' // delivery-fiction ≤7 days (and the gold >7 bucket reuses amber)
  | 'userBlue' // a user-set reminder (010)
  | 'estSoft' // an on-device scan estimate (010)
  | 'costFree' // free OVM message
  | 'costPaid' // paid PDZ
  | 'statusSent' // odesláno (dmMessageStatus 1–2)
  | 'statusDelivered' // dodáno (4)
  | 'statusRead' // doručeno přihlášením (6–7, and the archival 9–10)
  | 'statusFiction' // doručeno FIKCÍ (5) - served by law, nobody signed in
  | 'statusStop' // nedoručitelné / neprošlo kontrolou (8 / 3) - terminal failure
  | 'info'
  | 'dangerSoft';

export interface ChipColors {
  bg: string;
  fg: string;
  accent: string;
  /**
   * A soft tinted hairline, distinct from the saturated `accent`. The design specifies one only for
   * the compose cost card (`cCostBorder`), so only the cost tones carry it; everything else falls
   * back to `accent` at the call site.
   */
  border?: string;
}

type Pair = { light: ChipColors; dark: ChipColors };

/** Tones the design derives from theme tokens rather than fixing as literals - see `chipTone`. */
type DerivedKind = 'estSoft' | 'statusStop';

const TONES: Record<Exclude<ChipKind, DerivedKind>, Pair> = {
  fikceRed: {
    light: { bg: '#F7E4E1', fg: '#B5362F', accent: '#B5362F' },
    dark: { bg: '#3A211E', fg: '#E58A84', accent: '#E27A73' },
  },
  fikceAmber: {
    light: { bg: '#FBEFD0', fg: '#8C6100', accent: '#E8A100' },
    dark: { bg: '#34290F', fg: '#E7B85C', accent: '#E8A100' },
  },
  userBlue: {
    light: { bg: '#E4ECF7', fg: '#2A5C9A', accent: '#2A5C9A' },
    dark: { bg: '#223040', fg: '#8FB6E6', accent: '#6BA3DE' },
  },
  costFree: {
    light: { bg: '#E2F0E8', fg: '#2A744B', accent: '#2A744B', border: '#CFE6D9' },
    dark: { bg: '#18271F', fg: '#5FB98A', accent: '#57B484', border: '#274035' },
  },
  costPaid: {
    light: { bg: '#FBEFD0', fg: '#8C6100', accent: '#E8A100', border: '#EAD9A8' },
    dark: { bg: '#34290F', fg: '#E7B85C', accent: '#E8A100', border: '#4A3D1C' },
  },
  statusSent: {
    light: { bg: '#F2EADB', fg: '#6B6253', accent: '#9A9180' },
    dark: { bg: '#322C24', fg: '#A89D8B', accent: '#8A8070' },
  },
  statusDelivered: {
    light: { bg: '#E4ECF7', fg: '#2A5C9A', accent: '#2A5C9A' },
    dark: { bg: '#223040', fg: '#8FB6E6', accent: '#6BA3DE' },
  },
  statusRead: {
    // Deeper than the `costFree` green it used to share (#2A744B): legal delivery is the terminal,
    // load-bearing state, and it now also has to carry a SOLID glyph, where the lighter green went
    // muddy. The design changed only this tone - costFree stays where it was.
    light: { bg: '#E2F0E8', fg: '#1B6E52', accent: '#1B6E52' },
    dark: { bg: '#18271F', fg: '#5FB98A', accent: '#57B484' },
  },
  statusFiction: {
    // Gold, deliberately NOT the green of `statusRead`: state 5 is legally the same outcome but
    // nobody read the message - the law signed for them. It is also NOT the fikce red, which means
    // "hurry"; by the time this shows, there is nothing left to hurry for.
    light: { bg: '#FBEFD0', fg: '#8C6100', accent: '#E8A100' },
    dark: { bg: '#34290F', fg: '#E7B85C', accent: '#E8A100' },
  },
  info: {
    light: { bg: '#EEF4FB', fg: '#1E4E80', accent: '#2A5C9A', border: '#D6E4F4' },
    dark: { bg: '#1F2C3A', fg: '#9BC2EC', accent: '#6BA3DE', border: '#2E4258' },
  },
  dangerSoft: {
    light: { bg: '#F7E4E1', fg: '#B5362F', accent: '#B5362F' },
    dark: { bg: '#3A211E', fg: '#E58A84', accent: '#E27A73' },
  },
};

/**
 * Tone colors for a chip `kind` in the active theme. Two tones are derived from theme tokens instead
 * of fixed literals: `estSoft` (neutral surface/muted) and `statusStop`, which the design draws
 * INVERTED - ink-on-paper swapped - so a terminal failure reads as a full stop rather than as another
 * coloured status. Inverting means it flips with the theme instead of carrying its own pair.
 */
export function chipTone(kind: ChipKind, theme: Theme): ChipColors {
  if (kind === 'estSoft') {
    return { bg: theme.surfaceSunken, fg: theme.textMuted, accent: theme.borderStrong };
  }
  if (kind === 'statusStop') {
    return { bg: theme.text, fg: theme.surfaceAlt, accent: theme.text };
  }
  const pair = TONES[kind];
  return theme.name === 'dark' ? pair.dark : pair.light;
}
