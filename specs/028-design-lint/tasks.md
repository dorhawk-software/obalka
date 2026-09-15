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
- [x] T011 The 185 left after the first pass, fixed the same day (owner: "how about you fix the 185 too"):
  - **Text (109):** five more roles the design had all along - `Overline` (the uppercase tracked section
    label, on 7+ screens), `Code` (recovery key, transfer code phrase), `Subheading` (15px Bricolage
    month and card headers), `Hero` (Welcome title) and `Numeral` (the attention count); `Tag` gained its
    0.3 tracking. Stray Bricolage sizes folded to the nearest role (16/18 → Heading, 20/22 → Title, 25 →
    Display), 16px Public Sans to 15, and explicit line heights and tracking dropped for the role's.
  - **Spacing (42):** three steps for full-screen moments - `loose` 28, `hero` 36, `empty` 60 - with 26 →
    28, 32/34/40 → 36, 56/64 → 60. The input paddings (40, 42, 48) were alignment, not spacing, and are now
    written as their derivation (icon inset + icon + gap; button inset + width + gap). The five icon
    nudges became `LineIcon`, a box one text line tall that centres an icon on the first line at any text
    size. The settings section gaps (9, 22) were left as they are: DESIGN.md records that moving them was
    tried on 2026-09-15 and reverted as a departure from the design.
  - **Radii (18):** onto steps - 8 for chips, 999 for anything fully round (badges, dots, bars, the grab
    handle), 11 for the attachment tile; the three brand tiles joined `ICON_TIER` (84/24, 104/30, 120/26).
  - **Colours (16):** eight shadows named in `depth.ts` (one was duplicated across two sheets), the
    avatar ring a theme token, and the colour arithmetic in a new palette file, `color.ts`.
  - Checked on the emulator against the first screenshots: the detail subject is 26px instead of 25, the
    licence text sits on the role's line, the rest unchanged.

## Phase 3: Plain errors

- [x] T012 The baseline reached zero on 2026-10-04: the rules are plain errors in `.eslintrc.js` (an override
  for `src/`; tests build fixtures from raw values on purpose), the plugin a `file:` devDependency so the
  editor shows them, and `design-lint.mjs` with its baseline is gone. CLAUDE.md now says: fix the finding,
  or grow the system - never disable the rule.
