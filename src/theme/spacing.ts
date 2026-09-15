// DESIGN.md's spacing scale (its front matter `spacing:`), as tokens.
//
// A screen names the step it means - `space.gutter` - instead of typing a number that may or may not be
// on the scale. Typed numbers are how the Debug screen came to hold a 9 gap and 20 and 22 margins
// beside an 8, a 14 and an 18 (review, 2026-09-15): each looked close enough on its own, and nothing
// could tell a step from a near miss. `row`, `inset` and `section` joined on 2026-10-04 (spec 028): the
// design used 13, 16 and 24 throughout, and the nearby 20s and 22s were one step written three ways. `__tests__/theme/spacing.test.ts` reads DESIGN.md and holds these
// names and values to it, so the two cannot drift apart either.

export const space = {
  hair: 2,
  xs: 4,
  sm: 6,
  base: 8,
  md: 10,
  lg: 12,
  /** A list row's vertical padding (DESIGN.md › Layout). */
  row: 13,
  xl: 14,
  /** Side padding of settings-shaped scroll content and cards. */
  inset: 16,
  gutter: 18,
  /** The space before the next section. */
  section: 24,
  // The full-screen moments only (Welcome, Lock, sign-in progress, empty states, the send result):
  // spec 028 found them typing 26-64 between them, one rhythm written eleven ways.
  /** Between the parts of a full-screen moment. */
  loose: 28,
  /** A full-screen moment's own padding. */
  hero: 36,
  /** How far an empty state sits below the top of its list. */
  empty: 60,
} as const;
