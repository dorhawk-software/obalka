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
  /** The compose FAB, a gold glow. */
  fab: '0px 8px 20px rgba(184,128,0,0.4)',
  /** The selected segment in a segmented control. */
  segment: '0px 1px 2px rgba(33,27,18,0.12)',
  /** A switch's knob. */
  knob: '0px 1px 3px rgba(0,0,0,0.25)',
  /** A bottom sheet's edge in dark mode: `lg`'s white bevel is a harsh line against the dark scrim. */
  sheetDark: 'inset 0px 1px 1px rgba(255,255,255,0.06), 0px -2px 18px rgba(0,0,0,0.45)',
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
