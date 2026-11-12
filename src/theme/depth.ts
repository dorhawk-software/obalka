// Layered "depth" shadows - the technique from CodePen LEGRBzp ("Depth"): each level combines an
// INSET top highlight (light hitting the top edge), a tight dark CONTACT shadow, and a soft AMBIENT
// shadow, scaling up per level. Works in light (dark shadows read) and dark (the top highlight reads).
//
// Uses the CSS `boxShadow` string, supported by React Native 0.76+ on the New Architecture (multiple
// shadows + inset). Apply via a component's `style` prop, e.g. style={{ boxShadow: depth.md }}.

export const depth = {
  // Named shadows (spec 028): each lived as a string on the one screen that drew it, so the same shadow
  // was written three ways and nothing said which object casts which. Raw colours belong here, in a
  // palette file, not in a screen.
  /** The large brand tile on the lock screen and the emblem icons. */
  heroTile: '0px 14px 34px rgba(33,50,90,0.32)',
  /** The Welcome screen's app mark. */
  mark: '0px 18px 42px rgba(33,50,90,0.35)',
  /** The Welcome and Lock primary buttons. */
  primaryButton: '0px 6px 16px rgba(33,27,18,0.25)',
  /** The snackbar, floating over content. */
  snackbar: '0px 8px 24px rgba(33,27,18,0.32)',
  /** The selected segment in a segmented control. */
  segment: '0px 1px 2px rgba(33,27,18,0.12)',
  /** The same, printed on the envelope (the inbox header): its shade is the envelope's ink. */
  segmentOnEnvelope: '0px 1px 2px rgba(9,30,64,0.25)',
  /** A switch's knob. */
  knob: '0px 1px 3px rgba(0,0,0,0.25)',
  /** A bottom sheet's edge in dark mode: `lg`'s white bevel is a harsh line against the dark scrim. */
  sheetDark: 'inset 0px 1px 1px rgba(255,255,255,0.06), 0px -2px 18px rgba(0,0,0,0.45)',
  /**
   * A floating card's edge in dark mode - a dialog, the rename box: one even hairline all round. `lg`'s
   * top-only bevel, bent round the corners, read as a bright top edge fading out down the sides and gone
   * at the bottom (owner, 2026-11-11, on the notification dialog: "the border looks weird, non uniform
   * top and bottom").
   */
  floatDark: 'inset 0px 0px 0px 1px rgba(255,255,255,0.07), 0px 8px 24px rgba(0,0,0,0.5)',
  sm:
    'inset 0px 1px 2px rgba(255,255,255,0.18), ' +
    '0px 1px 2px rgba(0,0,0,0.18), 0px 2px 4px rgba(0,0,0,0.08)',
  md:
    'inset 0px 1px 2px rgba(255,255,255,0.30), ' +
    '0px 2px 4px rgba(0,0,0,0.18), 0px 4px 8px rgba(0,0,0,0.08)',
  lg:
    'inset 0px 1px 2px rgba(255,255,255,0.45), ' +
    '0px 4px 6px rgba(0,0,0,0.18), 0px 6px 10px rgba(0,0,0,0.08)',
};

/**
 * The printed objects' shadows (031), read from the agreed canvas's source, light and dark. "Paper has
 * weight": an object lies ON the screen, so it casts a soft shadow below it and no bevel. Chrome keeps
 * `depth` above and `raised` below.
 *
 * - `sheet`: every resting card (Cards B, agreed 2026-11-12): the surface and this, no hairline.
 * - `sheetEdge`: the second envelope's edge under an attention sheet.
 * - `envelope`: a whole envelope on the paper (message, compose, sent, sign-in).
 * - `envelopeHeader`: the inbox header, the envelope front the list hangs from.
 * - `letter`: the letter rising out of its envelope, shading the envelope's lip.
 * - `window`: the envelope's paper lying over the window's edge (an inset).
 * - `seal`: the lock's wax seal, raised and lit.
 *
 * `slip`, `stamp` and `stampFab` are filters (`drop-shadow`), not box shadows: the perforated edge is
 * cut out of the object, and the shadow has to follow the holes.
 */
type ObjectShadow = 'sheet' | 'sheetEdge' | 'envelope' | 'envelopeHeader' | 'letter' | 'window' | 'seal';
type ObjectFilter = 'slip' | 'stamp' | 'stampFab' | 'openEnvelope';

const OBJECT_SHADOWS: Record<'light' | 'dark', Record<ObjectShadow, string>> = {
  light: {
    sheet: '0px 1px 2px rgba(33,27,18,0.08), 0px 8px 16px -10px rgba(33,27,18,0.28)',
    sheetEdge: '0px 1px 2px rgba(33,27,18,0.12)',
    envelope: '0px 22px 34px -26px rgba(20,32,60,0.7)',
    envelopeHeader: '0px 18px 30px -22px rgba(20,32,60,0.6)',
    letter: '0px -6px 14px -10px rgba(20,32,60,0.35)',
    window: 'inset 0px 2px 4px -1px rgba(9,30,64,0.28)',
    seal:
      '0px 4px 8px rgba(9,30,64,0.45), inset 0px 1px 1px rgba(255,255,255,0.35), ' +
      'inset 0px -2px 3px rgba(0,0,0,0.25)',
  },
  dark: {
    // A dark sheet is lighter than the paper already; the shadow fades to a faint edge (R3).
    sheet: '0px 0px 0px 1px rgba(255,255,255,0.04), 0px 8px 16px -10px rgba(0,0,0,0.7)',
    sheetEdge: '0px 1px 2px rgba(33,27,18,0.12)',
    envelope: '0px 0px 0px 1px rgba(255,255,255,0.06), 0px 22px 34px -24px rgba(0,0,0,0.9)',
    envelopeHeader: '0px 18px 30px -22px rgba(20,32,60,0.6)',
    letter: '0px -6px 14px -10px rgba(0,0,0,0.7)',
    window: 'inset 0px 2px 4px -1px rgba(0,0,0,0.55)',
    seal:
      '0px 4px 8px rgba(9,30,64,0.45), inset 0px 1px 1px rgba(255,255,255,0.35), ' +
      'inset 0px -2px 3px rgba(0,0,0,0.25)',
  },
};

const OBJECT_FILTERS: Record<'light' | 'dark', Record<ObjectFilter, string | undefined>> = {
  light: {
    // The canvas also casts a 1 px `border` edge first; the Slip draws that edge as a shape, since iOS
    // keeps only one drop-shadow of a chain.
    slip: 'drop-shadow(0px 4px 10px rgba(33,27,18,0.07))',
    stamp: 'drop-shadow(0px 6px 10px rgba(20,32,60,0.18))',
    stampFab: 'drop-shadow(0px 8px 14px rgba(184,128,0,0.38))',
    openEnvelope: 'drop-shadow(0px 16px 22px rgba(33,50,90,0.22))',
  },
  dark: {
    // Only the 1 px edge at night, which the Slip draws.
    slip: undefined,
    stamp: 'drop-shadow(0px 6px 10px rgba(20,32,60,0.18))',
    stampFab: 'drop-shadow(0px 8px 14px rgba(184,128,0,0.38))',
    openEnvelope: 'drop-shadow(0px 16px 22px rgba(33,50,90,0.22))',
  },
};

/** A printed object's shadow (`boxShadow`) for the theme it is drawn in. */
export function objectShadow(themeName: 'light' | 'dark', kind: ObjectShadow): string {
  return OBJECT_SHADOWS[themeName][kind];
}

/**
 * A perforated object's shadow (`filter`), which follows the holes cut out of its edge; undefined where
 * the object casts none (a slip at night).
 */
export function objectFilter(themeName: 'light' | 'dark', kind: ObjectFilter): string | undefined {
  return OBJECT_FILTERS[themeName][kind];
}

/**
 * The shadow of a surface that floats over the screen, for the theme it is drawn in: the full bevel in
 * light mode, and in dark mode an edge that does not draw a bright line along the top. One function, so
 * no surface can take `lg` in dark mode again by forgetting a branch - three did (2026-11-11).
 *
 * `sheet` rises from the bottom edge and only its top shows; `float` is a card with all four edges.
 */
export function raised(themeName: 'light' | 'dark', kind: 'float' | 'sheet'): string {
  if (themeName === 'light') {
    return depth.lg;
  }
  return kind === 'sheet' ? depth.sheetDark : depth.floatDark;
}
