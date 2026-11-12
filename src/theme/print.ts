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
