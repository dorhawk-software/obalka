// Theme palettes for Obálka (light + dark) - the "paper" redesign (feature 009; see
// specs/009-visual-redesign/design-system.md). A WARM neutral ramp (replacing the old cool-navy one)
// with the brand blue/gold accents retained. Dark mode = a warm near-black base whose surfaces get
// LIGHTER as they raise, with near-white (not pure white) text. Same keys in both themes so components
// stay theme-agnostic. Consumed via useTheme(). The few light-only accent surfaces from the design get
// derived AA dark variants here; chip tones live in src/theme/chipTone.ts.

export interface Theme {
  name: 'light' | 'dark';

  // Neutral surfaces (3-level hierarchy: bg < surface < surfaceAlt) + borders
  bg: string;
  surface: string;
  surfaceAlt: string;
  /** A recessed tonal panel - clearly distinct from bg, no border (segmented track, icon-button bg). */
  surfaceSunken: string;
  border: string;
  borderStrong: string;

  // Text hierarchy
  text: string;
  /** Long-form body copy (design `text2`) - a touch softer than `text`. */
  bodyText: string;
  textMuted: string;
  textFaint: string;

  // Brand
  blue: string; // primary action / selection background
  blueDark: string; // headings / strong brand text (dark-on-light, light-on-dark)
  blueSoft: string; // tinted selected/info surface
  onBlue: string; // text/icon on blue
  /**
   * White, in BOTH appearances - the ink for a glyph or knob knocked out of a SOLID, saturated fill
   * that is itself theme-independent: an avatar hue, the brand tile, a switch knob.
   *
   * It exists because `onBlue` used to be that colour by accident. `onBlue` means one thing - "ink
   * that sits on `theme.blue`" - and when dark mode's `blue` was brightened, its ink correctly
   * flipped to near-black (6.79:1 on every primary button). Six sites were reading it as "white",
   * and three of them were not on `theme.blue` at all:
   *
   *   * every avatar monogram, on the six fixed hues in `avatar.ts` - **2.11–3.05:1** in dark mode,
   *     on the app's most repeated element, while `avatar.ts` promised ≥4.5:1 in both themes;
   *   * the `EmblemIcon` glyph on `brandTile` - 3.36:1, where its own docstring and `brandTile`'s
   *     token comment both say "a white glyph";
   *   * the `Toggle` knob, documented as "near-white", rendering near-black at night.
   *
   * The lesson is in the name, not the value: an "on X" token is only safe on X. Anything painted on
   * a fill that does not change with the appearance takes THIS instead.
   */
  onSolid: string;
  /** Solid brand-blue tile behind logo/lock marks - fixed in both modes so a white glyph stays AA. */
  brandTile: string;
  /**
   * Ink for a HERO-tier glyph (016): the 132px decorative mark on an empty or zero state.
   *
   * Deliberately its own token rather than `borderStrong`, which is close but not the design's value
   * - and it is allowed to fall BELOW AA, because a hero glyph is decoration with the words beside
   * it doing the work. Nothing else in the app may borrow it for text.
   */
  heroInk: string;
  gold: string; // signature accent (compose FAB, unread)
  goldSoft: string;
  onGold: string; // text/icons on the bright gold (dark in both themes - gold stays light)
  /** The design's brighter gold, used ONLY for a snackbar action label on `snackbarBg`. */
  goldBright: string;
  /** Hairline on any goldSoft surface (test banner, paid-cost card) - design #EAD9A8. */
  goldBorder: string;
  /** Draft marker (compose draft tile) - the design's violet, also a sender-avatar hue. */
  violet: string;
  violetSoft: string;
  /** Switch OFF track (design `trackOff`); the ON track is `blue`. */
  trackOff: string;
  /**
   * Hairline around the switch's OFF track.
   *
   * The track alone is 1.70:1 on `surface` in light and 1.54:1 in dark, so an OFF switch had no
   * discernible boundary at all - WCAG 1.4.11 asks 3:1 of the visual information that identifies a
   * control's state. Outlining rather than darkening the fill keeps the design's track colour, and
   * it is what Material 3's own unselected switch does.
   */
  trackOffBorder: string;
  /**
   * Gold at a strength that can carry MEANING rather than decoration.
   *
   * `gold` is the design's accent and stays the fill everywhere it already is, but in light mode it
   * measures **2.17:1** on `surface` and **1.91:1** on `bg` - under the 3:1 that WCAG 1.4.11 asks of
   * anything a user must see to understand a state or a value. Three places needed it and had
   * nothing else to fall back on: the unread dot (the only unread cue a sighted user gets), the
   * oversized attention numeral (a count stated nowhere else), and the compose FAB's boundary
   * against the paper. Each takes this as a ring, an ink, or an outline - never as a new fill, so
   * the design's gold is still the colour you see.
   *
   * In dark mode `gold` already measures 6.26:1, so this IS `gold` there and every ring drawn with
   * it is invisible by construction.
   */
  goldInk: string;

  // Semantic
  success: string;
  danger: string;
  warning: string;
  /** A legible warning ink for text/icons on light surfaces (plain `warning` is too low-contrast). */
  warningInk: string;

  // Test environment (czebox) banner + tag - its own soft-gold tokens, both modes.
  testBg: string;
  testFg: string;
  testBd: string;

  /**
   * Modal/sheet scrim ink as an `r,g,b` triple, for composing at the design's alpha.
   *
   * The design draws scrims as `rgba(33,27,18,α)` - a warm near-black, correct over the light paper.
   * In DARK mode that ink (#211B12) is *lighter* than the ground it covers (#1A1712), so the scrim
   * lightened the backdrop by a hair instead of darkening it, and a sheet had no separation from the
   * screen behind it at all. Dark mode uses black; `useScrim` explains the alpha that goes with it.
   */
  scrimRgb: string;
  /**
   * The same scrim as an OPAQUE backdrop, for when the OS "Reduce Transparency" setting is on - no
   * see-through, only the alpha changes.
   */
  scrimOpaque: string;

  /**
   * The snackbar bar and the text on it. Deliberately the SAME warm near-black in both themes: the
   * snackbar is a transient overlay that has to stand out from whatever screen it covers, so it does
   * not follow the appearance the way a surface does.
   *
   * These exist because `Snackbar.tsx` said exactly that in its own header - "a conventional dark bar
   * (theme-independent)" - while painting itself with `text`, which is near-white in dark mode. The
   * bar therefore flipped to near-white at night and took the gold action label with it, to **1.52:1**.
   * With the ink named, the bar is dark in both themes as documented (action 9.6:1, message 15.8:1).
   */
  snackbarBg: string;
  snackbarInk: string;

  // Playful accents for the appearance/theme icons (sun = warm, moon = indigo, device = teal).
  accentSun: string;
  accentMoon: string;
  accentDevice: string;
}

export const lightTheme: Theme = {
  name: 'light',
  bg: '#F4EEE2',
  surface: '#FFFDF8',
  surfaceAlt: '#FBF6EA',
  surfaceSunken: '#F2EADB',
  border: '#ECE3D2',
  borderStrong: '#DCD2BF',
  text: '#211B12',
  bodyText: '#3F392E',
  textMuted: '#6B6253',
  textFaint: '#736A57', // design `fnt`, darkened to AA (≥4.5 on bg/surfaces) for meta/timestamp content (T043)
  blue: '#2A5C9A',
  blueDark: '#1E4E80',
  blueSoft: '#EEF4FB',
  onBlue: '#FFFFFF',
  onSolid: '#FFFFFF',
  brandTile: '#2D6CB5',
  heroInk: '#D3C7AF',
  gold: '#E8A100',
  goldSoft: '#FBEFD0',
  onGold: '#211B12',
  goldBright: '#F5B81E',
  goldBorder: '#EAD9A8',
  violet: '#5A4CA8',
  violetSoft: '#E7E6F6',
  trackOff: '#CFC4AE',
  trackOffBorder: '#8E7F62', // 3.63:1 on surface/surfaceAlt - the OFF switch's only boundary
  goldInk: '#A87400', // 3.40:1 on every ground - rings/inks the gold that has to be seen
  success: '#2E7D52',
  danger: '#B5362F',
  warning: '#E8A100',
  warningInk: '#8C6100', // dark amber, AA (≥4.5) on light + goldSoft (T043)
  testBg: '#FAE7B0',
  testFg: '#6E5200',
  testBd: '#E8D49A',
  scrimRgb: '33,27,18', // the design's warm ink, over the light paper
  scrimOpaque: '#211B12',
  snackbarBg: '#211B12',
  snackbarInk: '#FBF6EA',
  accentSun: '#E8920C',
  accentMoon: '#7A6BC4',
  accentDevice: '#0E8C8C',
};

export const darkTheme: Theme = {
  name: 'dark',
  bg: '#1A1712',
  surface: '#2A251E',
  surfaceAlt: '#221E18',
  surfaceSunken: '#322C24',
  border: '#3A332A',
  borderStrong: '#4A4236',
  text: '#F2ECE0',
  bodyText: '#D8D0C2',
  textMuted: '#A89D8B',
  // 4.96:1 on `surface`. The previous #8A8070 measured 3.91 - fine for a 3:1 large-text floor, but
  // this token labels 12px captions, which AA holds to 4.5 (T043 audit).
  textFaint: '#9C9282',
  blue: '#6BA3DE', // brightened for the warm-dark base
  blueDark: '#9BC2EC',
  blueSoft: '#233140', // derived tinted-dark info surface
  // Dark ink, not white - and this file's header is what says it should be. `blue` was brightened
  // for the warm-dark base without re-deriving the ink that sits ON it, leaving white-on-light-blue
  // at **2.65:1** on every primary button in dark mode: below AA, below even the 3:1 floor for large
  // text. The warm near-black gives 6.79:1. Found by the T043 contrast audit, 2026-09-08.
  onBlue: '#1A1611',
  onSolid: '#FFFFFF', // white in BOTH themes - see the token's doc comment
  brandTile: '#2D6CB5',
  heroInk: '#4E4638',
  gold: '#E8A100',
  goldSoft: '#3A2F12', // derived dark gold surface
  onGold: '#211B12',
  goldBright: '#F5B81E', // `snackbarBg` is dark in BOTH themes → same action gold
  goldBorder: '#4A3D1C', // derived dark gold hairline
  violet: '#B0A4EE', // brightened for the warm-dark base (AA on violetSoft)
  violetSoft: '#2C2545', // derived tinted-dark violet surface
  trackOff: '#4A4236', // design dark `trackOff`
  trackOffBorder: '#877B67', // 3.66:1 on surface/surfaceAlt
  goldInk: '#E8A100', // = `gold`: it already measures 6.26:1 here, so every ring draws nothing
  success: '#57B484',
  danger: '#E27A73',
  warning: '#E8A100',
  warningInk: '#E7B85C', // on dark, a bright amber is the legible one
  testBg: '#352B12',
  testFg: '#E6C46A',
  testBd: '#4A3D1C',
  scrimRgb: '0,0,0', // the warm ink is LIGHTER than the dark ground - see the token's doc comment
  scrimOpaque: '#000000',
  snackbarBg: '#211B12', // NOT inverted for dark - see the token's doc comment
  snackbarInk: '#FBF6EA',
  accentSun: '#F2A93B',
  accentMoon: '#9B8FE0',
  accentDevice: '#39BDBD',
};
