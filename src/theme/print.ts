// The printed objects' geometry (031, "Obálka is printed matter"): the numbers that make a stamp a
// stamp, a slip a slip and a glyph offset print. Read from the agreed canvas's source, never from a
// picture; their colours are in `theme.ts`, their shadows in `depth.ts`. DESIGN.md › The printed
// objects says what each object is for.

/** The offset glyphs: a 1.75 ink stroke on a 24 grid, the plane printed 1.3 off register. */
export const offsetPrint = {
  stroke: 1.75,
  planeOffset: 1.3,
} as const;

/**
 * Perforations: a row of holes of `radius`, one every `pitch`, cut out of the object's edge.
 *
 * - `stamp`: the stamp on an envelope (the compose and sent boards' larger stamp);
 * - `stampSmall`: the compose button and the stamp on a sent message's envelope;
 * - `slip`: the torn-off top of a slip (the delivery record, the recovery key, the transfer code).
 */
export const perforation = {
  stamp: { radius: 4, pitch: 12, inset: 12 },
  stampSmall: { radius: 3.5, pitch: 10, inset: 9 },
  slip: { radius: 5, pitch: 14 },
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
} as const;

export const liningPrint = {
  width: 12,
  height: 10.5,
  stroke: 0.9,
} as const;

/**
 * The window's film: the light it catches. `film` is the soft reflection's opacity; `glint` the two
 * diagonal highlights' (whose angle follows the phone's tilt, board Motion).
 */
export const windowFilm = {
  film: { light: 0.9, dark: 0.55 },
  glint: 0.5,
  angle: 112,
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

/** The envelope's corner, and the window's within it (inbox header and the large envelopes). */
export const envelopeShape = {
  radius: 20,
  windowRadius: 14,
} as const;
