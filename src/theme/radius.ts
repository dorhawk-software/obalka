// Nested rounded corners (2026-10-03).
//
// A rounded shape inside another one, close to its edge - a chip in a pill, the selected segment in a
// segmented control, a thumb in a track - only reads as one object when the two outlines run parallel
// around the corner. That needs the inner radius to be the outer radius MINUS the gap between them, and
// the gap to be the same on every side the corner touches. The pill's monogram chip had neither (7 dp
// around a 5 dp chip, 3 dp in on one side and 2 dp on the others), and the owner spotted it at once: the
// inner corner rounded at a different rate from the outer one. Every nested pair names its radius
// through this function, so the inner radius follows when either the outer radius or the gap changes.

/** The radius that keeps an inner rounded shape concentric with its container, `gap` dp inside it. */
export function concentric(outer: number, gap: number): number {
  return Math.max(0, outer - gap);
}
