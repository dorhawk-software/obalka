// The printed objects' geometry (031, "Obálka is printed matter"): the numbers that make a stamp a
// stamp, a slip a slip and a glyph offset print. Read from the agreed canvas's source, never from a
// picture; their colours are in `theme.ts`, their shadows in `depth.ts`. DESIGN.md › The printed
// objects says what each object is for.

/** The offset glyphs: a 1.75 ink stroke on a 24 grid, the plane printed 1.3 off register. */
export const offsetPrint = {
  stroke: 1.75,
  /** The compose stamp's glyph, a touch heavier on the gold (board InboxA). */
  strokeOnFlap: 1.9,
  planeOffset: 1.3,
} as const;

/**
 * Perforations: a row of holes of `radius`, one every `pitch`, cut out of the object's edge.
 *
 * `inset` is the paper around the stamp's printed frame: the holes cut only that margin.
 *
 * - `stamp`: a stamp on its own (the cost of a send, board Main);
 * - `stampSmall`: the stamp stuck on a sent message's envelope (board Sent);
 * - `fab`: the gold stamp of the compose button (boards InboxA, Empty);
 * - `slip`: the torn-off top of a slip (the delivery record, the recovery key, the transfer code), a
 *   row of holes centred on the top edge, the first `pitch / 2` in; its bottom corners round by
 *   `corner`.
 */
export const perforation = {
  stamp: { radius: 4, pitch: 12, inset: 12 },
  stampSmall: { radius: 3.5, pitch: 10, inset: 9 },
  fab: { radius: 3.5, pitch: 10, inset: 7 },
  slip: { radius: 5, pitch: 14, corner: 14 },
} as const;

/**
 * The security tint inside an envelope: chevrons of the envelope's blue, `width` x `height`, a hairline
 * `stroke`, at `opacity` for the appearance. The lining of an open envelope is the finer `lining`
 * print in `theme.lining`.
 */
export const securityTint = {
  width: 16,
  height: 14,
  stroke: 1.1,
  opacity: { light: 0.16, dark: 0.12 },
  chevrons: 'M1 2.5l7 4.5 7-4.5M-7 9.5l7 4.5 7-4.5M9 9.5l7 4.5 7-4.5',
  /** Behind the lock: the tint fades towards the middle, to `centre` of itself (board Lock). */
  vignette: { cx: '50%', cy: '40%', r: '60%', centre: 0.25 },
} as const;

export const liningPrint = {
  width: 12,
  height: 10.5,
  stroke: 0.9,
} as const;

/**
 * The window's film: the light it catches.
 *
 * - `film`: two soft white strokes on a 300 x 120 sheet stretched over the window, blurred by `blur`,
 *   at `film` opacity. In dark they keep to the window's margins: solid to `darkMargin.solid` from the
 *   top and bottom edge, gone by `darkMargin.fade`, so no sheen lies over the words.
 * - `glint`: two diagonal highlights at `angle` (a CSS angle: 0 points up, 90 right), over the
 *   `windowGlint` cast, the whole layer at `glint` opacity. Each stop is [position, white's opacity].
 *   The angle follows the phone's tilt (board Motion).
 */
export const windowFilm = {
  film: { light: 0.9, dark: 0.55 },
  strokes: [
    { d: 'M-10 94C60 72 120 106 190 82S280 60 320 68', width: 12, opacity: 0.28 },
    { d: 'M40 16C90 26 150 8 230 20', width: 7, opacity: 0.22 },
  ],
  blur: 3,
  darkMargin: { solid: 5, fade: 9 },
  glint: 0.5,
  angle: 112,
  glintStops: {
    light: [[0.06, 0], [0.12, 0.5], [0.17, 0.1], [0.24, 0], [0.62, 0], [0.67, 0.3], [0.73, 0]],
    dark: [[0.06, 0], [0.12, 0.1], [0.17, 0.03], [0.24, 0], [0.62, 0], [0.67, 0.07], [0.73, 0]],
  },
  /**
   * The glint follows the phone's tilt (board Motion 4): up to `reach` either way, closing `lerp` of
   * the distance each frame; it stops once within `rest` (under a pixel), so a steady hand lays out
   * nothing.
   */
  tilt: { reach: 8, lerp: 0.06, rest: 0.25 },
} as const;

/**
 * The airmail strip (the test environment, R7): stripes at 135 degrees, envelope blue, paper, flap
 * gold, paper - each `width` wide - with the label on a paper band `inset` inside it.
 */
export const airmail = {
  angle: 135,
  stripes: [9, 5, 9, 5],
  inset: 6,
} as const;

/**
 * The postmark (board Detail): drawn on a 96 x 80 sheet - two rings round (56, 40), the words set on a
 * circle of `textRadius`, and three waves to the left of the rings.
 */
export const postmarkPrint = {
  width: 96,
  height: 80,
  cx: 56,
  cy: 40,
  rings: [31, 19],
  textRadius: 25,
  stroke: 1.5,
  waves: 'M2 30q5-4 10 0t10 0M2 42q5-4 10 0t10 0M2 54q5-4 10 0t10 0',
  /** The words round the ring, and the two lines in its middle (the date, then the time). */
  ringText: { size: 6.6, spacing: 1.2 },
  line1: { y: 39, size: 11 },
  line2: { y: 50, size: 9 },
} as const;

/** The envelope's corner, and the window's within it (inbox header and the large envelopes). */
export const envelopeShape = {
  radius: 20,
  windowRadius: 14,
  /** The inbox header's lower corners: the envelope front the list hangs from (InboxA). */
  headerRadius: 22,
  /**
   * The inbox header's flap, across the top down to the window: the sides end `side` above the
   * window, the point `point` above it, `half` either side of the middle (InboxA: 390 x 70). Lit from
   * the top: `printSheen` white at the top to `printShade` black at the bottom, at these opacities.
   */
  headerFlap: { side: 20, point: 3, shoulder: 7, half: 16, sheen: 0.12, shade: 0.07 },
  /** The two folds, on the message envelope's 358 x 150 sheet stretched over the envelope (Detail). */
  creases: { width: 358, height: 150, d: 'M0 150 L150 90 M358 150 L208 90', stroke: 1.5 },
} as const;

/**
 * The open envelope of the empty inbox (board Empty), on a 220 x 196 drawing: the flap up in the gold,
 * shaded since its inside faces us; the envelope's inside with the lining's print; the front pocket
 * with its two folds meeting in the middle.
 */
export const openEnvelope = {
  width: 220,
  height: 196,
  flap: 'M16 78 L104 10 Q110 5 116 10 L204 78 Z',
  back: { x: 10, y: 74, width: 200, height: 118, radius: 16 },
  front: 'M10 104 L110 156 L210 104 V176 Q210 192 194 192 H26 Q10 192 10 176 Z',
  folds: 'M10 104 L110 156 L210 104',
  foldStroke: 1.2,
  /** The lining: a tile of small chevrons, printed at `opacity`. */
  lining: {
    width: 12,
    height: 10.5,
    d: 'M.8 2l5.2 3.4L11.2 2M-5.2 7.2 0 10.6l5.2-3.4M6.8 7.2l5.2 3.4 5.2-3.4',
    stroke: 0.9,
    opacity: 0.55,
  },
} as const;

/**
 * The box's envelope while its sign-in waits (031 R8, agreed 2026-11-12): 300 by at least 186, laid
 * down 1.5 degrees, the flap shut across the top, the login name in a 200 window at the bottom.
 */
export const waitingEnvelope = {
  width: 300,
  minHeight: 186,
  tilt: '-1.5deg',
  creases: { width: 300, height: 186, d: 'M0 186 L124 110 M300 186 L176 110', stroke: 1.5 },
  flap: { width: 300, height: 66, d: 'M0 0H300V34L162 60Q150 64 138 60L0 34Z' },
  window: { width: 200, minHeight: 60, radius: 12 },
} as const;

/** The envelope's poses for the empty, failed and search states (031 R4), on a 220 x 140 front. */
export const envelopePose = {
  width: 220,
  height: 140,
  stackHeight: 150,
  creases: 'M0 140 L92 84 M220 140 L128 84',
  /** Under the shut flap the creases meet a little higher. */
  creasesSealed: 'M0 140 L92 82 M220 140 L128 82',
  /** To the paper's top edge and its sides; the pose clips it to the round corners. */
  flap: 'M0 0H220V9L118 74Q110 80 102 74L0 9Z',
  windowLines: 'M28 96h70M28 108h46',
  stackCreases: 'M10 146 L90 100 M200 146 L120 100',
} as const;

/**
 * The envelope as an avatar tile (board InboxA): `tile` corners; a sealed gold flap while unread, else
 * a fold line - both drawn on a 42 x 42 tile and scaled to the size.
 */
export const envelopeTile = {
  radius: 11,
  /** The small tile beside a sender in the register (24 pt): plain, its corner `smallRadius`. */
  smallRadius: 7,
  smallBelow: 30,
  flap: 'M0 0H42V5L24 16Q21 18 18 16L0 5Z',
  flapHeight: 20,
  fold: 'M5 9l16 11 16-11',
  foldStroke: 1.6,
} as const;

/**
 * The delivery record's marks (board Message; the sent result's slip uses them at 30): two rings on a
 * 34 grid, struck like a postmark, with what happened in the middle - a check for an arrival, clock
 * hands for fiction (served by time). A step still to come is the outer ring alone, dashed.
 *
 * The signed-in service is not on a board: the inner ring filled, the check knocked out of it - the
 * same "filled for service" the sent rail has always drawn, so arrival and service never share a mark.
 * The gold ring is drawn a touch heavier, as on the board: gold is the lighter ink.
 */
export const recordRing = {
  grid: 34,
  outer: 15,
  inner: 9.5,
  stroke: 1.4,
  strokeGold: 1.6,
  markStroke: 1.8,
  check: 'M12.6 17.2l3 3 5.8-6',
  clock: 'M17 12.5V17l3 2.4',
  /** A journey that stopped (a sent message ISDS could not deliver): a cross where the check would be. */
  cross: 'M13.8 13.8l6.4 6.4M20.2 13.8l-6.4 6.4',
  pendingDash: '2.5 3',
} as const;

/**
 * An attachment's icon (board Message): a sheet of paper 40 x 46 with its top corner folded, the file's
 * type printed on it. The board sets the type at 8.5; it is printed at 11, the smallest anything is
 * read at (practices, visual craft).
 */
export const docSheet = {
  width: 40,
  height: 46,
  sheet: 'M4 4h22l10 10v28H4z',
  fold: 'M26 4v10h10',
  stroke: 1.2,
  label: { y: 35, size: 11, maxLetters: 4 },
} as const;

/**
 * The cancellation (board Sent): where a postmark lands on a stamp, its waves run across the stamp in
 * `cancelInk`, the postmark's white would not show on the stamp's paper. Two waves on a 108 x 18
 * drawing, `x`/`y` from the stamp's top left (it starts 14 to the left of the stamp). The board's
 * drawing is 96 wide on an 84 wide stamp; the stamp here is 96 (its labels did not fit on Android,
 * see `SentResult`), so the waves are one 12 wide period longer and still cross it.
 */
export const cancellation = {
  width: 108,
  height: 18,
  x: -14,
  y: 34,
  d: 'M0 5q6-4 12 0t12 0t12 0t12 0t12 0t12 0t12 0t12 0t12 0M0 13q6-4 12 0t12 0t12 0t12 0t12 0t12 0t12 0t12 0t12 0',
  stroke: 1.5,
  opacity: 0.7,
} as const;

/**
 * The sealed envelope of the lock (board "Lock - sealed"), on its 160 tile: `radius` corners, the gold
 * flap folded down and lit from the top (`printSheen` at `sheen` to `printShade` at `shade`), and the
 * wax seal where the flap's point meets the envelope. The seal's face is lit from `light` (the share
 * of its width and height), `sealLight` fading to `sealShade` at `fade` of the way to its far corner;
 * pressed into it, a dashed ring and the padlock with the envelope's fold on it, on a 36 grid, in
 * `onSolid` at the given opacities.
 */
export const sealedEnvelope = {
  size: 160,
  radius: 40,
  flap: 'M24 46H136L92 88Q80 98 68 88Z',
  sheen: 0.14,
  shade: 0.08,
  /** The flap's fold, from the tile's top, and the depth it turns in (board Motion 3). */
  hinge: 46,
  perspective: 600,
  /** The seal breaking: each half tilts `breakTilt` degrees and drops `breakDrop`; a refusal nudges it `shake`. */
  breakTilt: 14,
  breakDrop: 6,
  shake: 4,
  seal: {
    x: 54,
    y: 66,
    size: 52,
    light: { x: 38, y: 32 },
    fade: 70,
    grid: 36,
    ring: { r: 14, stroke: 1.2, dash: '1.5 2.2', opacity: 0.35 },
    shackle: 'M13.5 16.5v-2.5a4.5 4.5 0 0 1 9 0v2.5',
    body: { x: 11, y: 16.5, width: 14, height: 10, radius: 2.4 },
    fold: 'M15 20l3 2 3-2',
    stroke: 1.7,
    opacity: 0.85,
  },
} as const;
