# Tasks: A design-system linter that tells the agent how to fix it

**Feature**: `028-design-lint` | **Spec**: [spec.md](./spec.md)

No plan.md: the spec carried the decisions (D1-D4, all taken as recommended on 2026-10-04).

## Phase 0: Complete the scale (D1, D2)

- [x] T001 Text roles `Small` (14/20 Regular), `SmallStrong` (14/20 Bold), `Meta` (12/16 Medium), `Tag` (11/14
  Bold, pill text only) in `typography.ts`, `Typography.tsx` and DESIGN.md (front matter, hierarchy). The
  open "is 13 the floor?" question is settled: 12, with `Tag` the one exception. Line heights are the
  design's prose leading (14→20, 12→16), which the existing `leading.test.ts` already pinned.
- [x] T002 Spacing steps `row` (13), `inset` (16), `section` (24) in `spacing.ts` and DESIGN.md. **Differs from
  the sketch:** 13 was to be folded to 14, but DESIGN.md › Layout names it as the row padding, and the
  design is the source of truth - so it became a step.
- [x] T003 Converted, by AST codemod: 244 text-role overrides (to the role of that size and face; weight kept
  as `fontWeight`, colour made explicit where the role's default differed; the lone 10px to `Tag`); spacing
  20 and 22 → 24, 3/5/7/9/11/15 → the even step above (128 values), and 26 `gap={1}` / text `marginTop={1}`
  removed. Optical 1dp nudges on icon wrappers were kept, in the baseline.
- [x] T004 Checked on the Android emulator (`Obalka_Demo`) against screenshots taken before: 14 screens,
  same typography, spacing a little looser where 20/22 became 24 and odd values went up.

## Phase 1: The rules and the ratchet (D3)

- [x] T005 `tools/eslint-plugin-obalka`: `role-typography`, `space-scale`, `radius-steps`, `no-raw-color`
  (replaces `scripts/check-no-raw-hex.sh`, same exempt palette files, now also `rgba(`), `use-card`. One
  message contract (`message.js`): what, fix, if nothing fits, why.
- [x] T006 `tokens.json` derived from the theme and DESIGN.md by `__tests__/lint/designTokens.test.ts`, which
  fails when it is stale (`UPDATE_TOKENS=1` regenerates it).
- [x] T007 `scripts/design-lint.mjs` (`npm run lint:design`, in `verify` and CI in place of `check:colors`):
  per-file, per-rule counts against `design-lint-baseline.json`; a rise fails with the full messages, a fall
  fails until the baseline is lowered, and `--update` refuses to raise it.
- [x] T008 `__tests__/lint/designRules.test.ts`: RuleTester cases asserting the whole message text.
- [x] T009 CLAUDE.md: run `npm run lint:design` after a UI change; never raise the baseline.

## Phase 2: Burn down (D4 and the rest)

- [x] T010 `Card` moved to `src/theme/Card.tsx` (look owned; layout and clipping the caller's), re-exported
  from the settings screens; the 24 hand-built cards identical to it converted, and `LicencesScreen`'s
  private copy deleted. The other radius+border+surface shapes are different objects the design specifies
  (16dp hero cards, 13dp attachment and draft rows, pills), so `use-card` does not report them.
- [ ] T011 The 185 findings left on 2026-10-04: 109 text (mostly explicit line heights that differ from the
  role's, and display sizes with no role - 16/18/20/22/25/34/44px Bricolage), 42 spacing (layout values
  such as 28-64, and the kept 1dp nudges), 18 radii, 16 raw colours (`rgba` scrims and shades). Each is
  either a missing role or token (add it to the system) or a screen to bring onto it.

## Phase 3: Plain errors

- [ ] T012 When the baseline is empty: the rules move into `.eslintrc.js` as errors (a `file:`
  devDependency for the plugin, so the editor shows them too) and `design-lint.mjs` goes.
