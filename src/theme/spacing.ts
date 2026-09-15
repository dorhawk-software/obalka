// DESIGN.md's spacing scale (its front matter `spacing:`), as tokens.
//
// A screen names the step it means - `space.gutter` - instead of typing a number that may or may not be
// on the scale. Typed numbers are how the Debug screen came to hold a 9 gap and 20 and 22 margins
// beside an 8, a 14 and an 18 (review, 2026-09-15): each looked close enough on its own, and nothing
// could tell a step from a near miss. `__tests__/theme/spacing.test.ts` reads DESIGN.md and holds these
// names and values to it, so the two cannot drift apart either.

export const space = {
  hair: 2,
  xs: 4,
  sm: 6,
  base: 8,
  md: 10,
  lg: 12,
  xl: 14,
  gutter: 18,
} as const;
