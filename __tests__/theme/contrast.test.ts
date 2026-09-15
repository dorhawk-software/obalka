// Every colour pair the app puts text on carries its weight (001 T043, constitution V).
//
// `theme.ts` promises this in its own header - "the few light-only accent surfaces from the design
// get derived AA dark variants here" - and `chipTone.ts` repeats it for the chips. Nothing checked
// it, and the audit that produced this file found the promise broken in two places, both dark-mode:
//
//   * `onBlue` on `blue` measured **2.65:1**. `blue` had been brightened for the warm-dark base and
//     the ink on it stayed white, so the label on every primary button in dark mode sat below AA and
//     below even the 3:1 floor for large text. It is dark ink now, at 6.79.
//   * `textFaint` on `surface` measured 3.91 - a 3:1 pass, but this token labels 12px captions and AA
//     holds normal text to 4.5. Now 4.96.
//
// The ratios are computed here rather than trusted, because a palette is edited by eye and a number
// that used to pass is exactly the thing nobody re-measures.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// The NEXT audit (2026-09-09) found what this file's own shape had let through. The first fix above
// changed what `onBlue` MEANS - from "white" to "ink that sits on `theme.blue`" - and the list below
// checked the new meaning against the one ground where it held, `blue`, and against none of the
// three where it did not. `onBlue` was still painting an avatar monogram (2.11–3.05:1 on six fixed
// hues, on every row of the inbox), the emblem glyph on `brandTile` (3.36), and the switch knob.
//
// A hand-written list of pairs cannot catch that, because the pair that breaks is by definition the
// one nobody thought to write down. So the pairs below are now derived from where a token is ACTUALLY
// painted - `AVATAR_COLORS` is imported, not transcribed - and the file asserts two floors, not one:
// AA 4.5 for text, and 1.4.11's 3:1 for the non-text marks that carry a state or a value on their own.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

import { darkTheme, lightTheme, type Theme } from '../../src/theme/theme';
import { chipTone, type ChipKind } from '../../src/theme/chipTone';
import { scrimColor } from '../../src/theme/useScrim';
import { AVATAR_COLORS } from '../../src/theme/avatar';
import { statusStripColors } from '../../src/theme/StatusStrip';

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h.slice(0, 6);
  const channels = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255);
  const linear = channels.map(c =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

/** WCAG contrast ratio, 1 (identical) to 21 (black on white). */
function contrast(fg: string, bg: string): number {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

/** AA for normal text. Everything in `pairs` labels body copy or a control. */
const AA = 4.5;
/**
 * WCAG 1.4.11 - the floor for a mark that is not text but still carries meaning: a state dot, a
 * count, a control's own edge. Lower than AA because these are shapes, not glyphs to be read.
 */
const NON_TEXT = 3;

const THEMES: [string, Theme][] = [
  ['light', lightTheme],
  ['dark', darkTheme],
];

/** Pairs the app genuinely renders - foreground token on the surface it sits on. */
const pairs = (t: Theme): [string, string, string][] => [
  ['text on bg', t.text, t.bg],
  ['text on surface', t.text, t.surface],
  ['text on surfaceAlt', t.text, t.surfaceAlt],
  ['bodyText on bg', t.bodyText, t.bg],
  ['textMuted on surface', t.textMuted, t.surface],
  ['textFaint on surface', t.textFaint, t.surface],
  ['onBlue on blue', t.onBlue, t.blue],
  // `onSolid` is white in BOTH themes, and these are the theme-independent fills it is white ON.
  // Derived from `avatar.ts` rather than copied, so a new hue is covered the day it is added.
  ['onSolid on brandTile', t.onSolid, t.brandTile],
  ...AVATAR_COLORS.map(
    (hue): [string, string, string] => [`onSolid on avatar ${hue}`, t.onSolid, hue],
  ),
  ['onGold on gold', t.onGold, t.gold],
  ['warningInk on goldSoft', t.warningInk, t.goldSoft],
  ['testFg on testBg', t.testFg, t.testBg],
  // The two top-of-screen strips, read from the component's own tone table: a tone that is repainted
  // there is measured here, not left to the pair above that happens to match it today.
  ...(['test', 'chrome'] as const).map((tone): [string, string, string] => {
    const strip = statusStripColors(tone, t);
    return [`status strip (${tone}) label`, strip.ink, strip.background];
  }),
  ['snackbarInk on snackbarBg', t.snackbarInk, t.snackbarBg],
  ['goldBright on snackbarBg', t.goldBright, t.snackbarBg],
];

const CHIP_KINDS: ChipKind[] = [
  'fikceRed', 'fikceAmber', 'userBlue', 'estSoft', 'costFree', 'costPaid',
  'statusSent', 'statusDelivered', 'statusRead', 'statusFiction', 'statusStop',
  'info', 'dangerSoft',
];

describe.each(THEMES)('%s theme', (_name, theme) => {
  it.each(pairs(theme))('%s reaches AA', (_label, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(AA);
  });

  // chipTone.ts says each tone "carries a derived AA dark variant so chips never show a light surface
  // in dark mode". This is that sentence, as a test.
  it.each(CHIP_KINDS)('chip %s is legible on its own surface', kind => {
    const c = chipTone(kind, theme);
    expect(contrast(c.fg, c.bg)).toBeGreaterThanOrEqual(AA);
  });

  // ── Marks that are not text, and have no text beside them saying the same thing ────────────────
  //
  // Each of these was below 3:1 in light mode and each was the only cue it had:
  //   * the unread dot - plain `gold` at 2.17 on `surface`, and the row says "unread" only to a
  //     screen reader;
  //   * the attention numeral - a count printed nowhere else on the screen;
  //   * the compose FAB's edge, which had a drop shadow standing in for a boundary;
  //   * the OFF switch, whose track is 1.70 on the row behind it.
  // All four now carry a ring, an ink, or an outline. In dark mode `goldInk` IS `gold`, so the first
  // three assert the same value twice on purpose - that equality is the thing worth protecting.
  const GROUNDS: [string, string][] = [
    ['bg', theme.bg],
    ['surface', theme.surface],
    ['surfaceAlt', theme.surfaceAlt],
  ];

  it.each(GROUNDS)('the unread dot has an edge on %s', (_g, ground) => {
    expect(contrast(theme.goldInk, ground)).toBeGreaterThanOrEqual(NON_TEXT);
  });

  it.each(GROUNDS)('the attention numeral is legible on %s', (_g, ground) => {
    // A 44px numeral is large text, which AA holds to 3:1 - the same floor, reached the same way.
    expect(contrast(theme.goldInk, ground)).toBeGreaterThanOrEqual(NON_TEXT);
  });

  it.each(GROUNDS)('the OFF switch has a boundary on %s', (_g, ground) => {
    expect(contrast(theme.trackOffBorder, ground)).toBeGreaterThanOrEqual(
      NON_TEXT,
    );
  });

  it('the ON switch is distinguishable from the OFF switch', () => {
    // The two states must differ from each OTHER, not merely each be visible.
    expect(contrast(theme.blue, theme.trackOff)).toBeGreaterThanOrEqual(
      NON_TEXT,
    );
  });
});

// A scrim is the other thing this file's maths can settle. It is not a text pair - it is a colour laid
// over the whole screen - and its whole job is to take luminance OUT of what is behind it.
//
// The design draws it as a warm near-black, `rgba(33,27,18,α)`, which is right over the light paper.
// In dark mode that ink is LIGHTER than the ground it covers (#211B12 over #1A1712), so the scrim was
// lightening the backdrop by a hair: sheets and dialogs had no separation from the screen behind them
// at all. Eyeballing a dark scrim on a dark screen is exactly the judgement a person cannot make, so
// it is composited and measured here.
describe('the scrim', () => {
  /** Alpha-composite over an opaque backdrop, the way the compositor does - in sRGB, not linear. */
  function composite(scrim: string, bg: string): number {
    const [, rgb, a] = scrim.match(/^rgba\((.+),([\d.]+)\)$/) ?? [];
    const [r, g, b] = rgb.split(',').map(Number);
    const back = bg.replace('#', '');
    const alpha = Number(a);
    const mixed = [0, 2, 4]
      .map((i, k) => {
        const under = parseInt(back.slice(i, i + 2), 16);
        const over = [r, g, b][k];
        return Math.round(under * (1 - alpha) + over * alpha);
      })
      .map(v => v.toString(16).padStart(2, '0'))
      .join('');
    return luminance(`#${mixed}`);
  }

  // The two alphas the app actually passes: 0.4 for a sheet, 0.45 for a dialog.
  const CASES: [string, Theme, number][] = [
    ['light sheet', lightTheme, 0.4],
    ['light dialog', lightTheme, 0.45],
    ['dark sheet', darkTheme, 0.4],
    ['dark dialog', darkTheme, 0.45],
  ];

  it.each(CASES)('%s darkens the screen behind it', (_label, theme, alpha) => {
    const behind = luminance(theme.bg);
    const front = composite(scrimColor(theme, alpha, false), theme.bg);
    // Not merely "darker": half the luminance or less, or it is decoration rather than a scrim.
    expect(front).toBeLessThanOrEqual(behind * 0.5);
  });

  it('never lightens it, which is the bug this measures', () => {
    for (const [, theme, alpha] of CASES) {
      expect(composite(scrimColor(theme, alpha, false), theme.bg)).toBeLessThan(
        luminance(theme.bg),
      );
    }
  });

  it('goes fully opaque for Reduce Transparency, still darker than the ground', () => {
    for (const theme of [lightTheme, darkTheme]) {
      const opaque = scrimColor(theme, 0.4, true);
      expect(opaque).toBe(theme.scrimOpaque);
      expect(luminance(opaque)).toBeLessThan(luminance(theme.bg));
    }
  });
});

// The snackbar is the one surface that does NOT follow the appearance, and the reason it has its own
// tokens at all: it used to paint itself with `text`, which is near-black in light and near-white in
// dark. The bar therefore inverted at night while the gold action label stayed gold - 1.52:1, on the
// only tappable thing in it. The pairs above measure it in both themes; this measures the assumption
// underneath them, which is that there is only one bar.
describe('the snackbar', () => {
  it('is the same ink in both themes', () => {
    expect(darkTheme.snackbarBg).toBe(lightTheme.snackbarBg);
    expect(darkTheme.snackbarInk).toBe(lightTheme.snackbarInk);
  });

  it('is dark - it is an overlay, not a surface', () => {
    // Below the midpoint of the light/dark split, i.e. unambiguously a dark bar rather than a
    // near-white one that merely happens to pass with the ink currently on it.
    expect(luminance(lightTheme.snackbarBg)).toBeLessThan(0.1);
  });
});

describe('the ratio maths itself', () => {
  // Guarding the guard: a scorer that always returned a big number would make every test above pass.
  it('matches known WCAG values', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrast('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 2);
    // The defect this suite was written for, kept as a fixture so its number stays visible.
    expect(contrast('#FFFFFF', '#6BA3DE')).toBeLessThan(3);
  });
});
