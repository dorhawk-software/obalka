# Plan: The identity pass (031)

**Spec**: `spec.md` · **Tasks**: `tasks.md` · **Canvas**: <https://claude.ai/artifact/NXmjzrevs3JuX9N7H71QbL>
**Process**: `.practices/docs/ui/identity-pass.md` (iteration 3), `.practices/docs/ui/visual-craft.md`,
`.practices/docs/ui/design-before-build.md`.

## Approach

1. **Inventory from the code, graded** (done, `tasks.md` Phase 1). Every view, state, control, transient
   surface, process and motion, graded M (matches) / D (drifts) / X (misses) against the canvas and the
   craft rules.
2. **Redraw on the same canvas**, below the agreed boards under a title "Iteration 3 - round 1". New
   boards in place, never a separate file: the real status bar and header, real Czech copy from
   `src/i18n/strings.ts`, both themes, the demo data's made-up names and ids
   (`src/dev/demoData.ts`). Where a choice is open, two or three variants and one recommendation.
   Derived boards (the agreed objects applied to a state that has no board yet) have no variants; they
   are shown for review and become agreed when the owner has seen them (SC-001).
3. **Ask** at most four questions at a time; strip the losers and their labels after each pick.
4. **Build** in the order below, only what is agreed, one to one with the canvas's source.
5. **Check**: capture each built screen on the clean `Obalka_Demo` AVD (never `Medium_Phone_API_36.0`)
   or the iOS Simulator, both themes, Czech and English, side by side with its board.
6. **Critique**: `impeccable` with two isolated reviewers (a design review and the automated
   detector), fixes, a re-audit with the owner, then the canvas is synced and DESIGN.md records it.

## Round 1 boards

| Board | Covers (tasks.md) | Kind | Recommendation |
|---|---|---|---|
| R1 Welcome | I04 | A / B / C | **A** - an envelope addressed to nobody yet; the same window later carries the box |
| R2 Compose and the stamp | I38, I40, I74 | A / B | **A** - the stamp in the Komu row, seen before Odeslat |
| R3 Cards: tone or hairline | every `Card` (I43 and the rest) | A / B / C | **B** - the agreed inbox sheet's weight, no line |
| R4 Empty, error, search | I21, I23, I24, I42, I79 | A / B | **A** - an envelope in the pose its state needs |
| R5 The inbox's other states | I15, I16, I19, I20, I27, I12-I13 | derived | - |
| R6 Slips | I45, I46 | derived | - |
| R7 Sent message, detail states, airmail | I30, I31, I35, I37 | derived | - |

The questions (round 1): Q1 Welcome A/B/C, Q2 Compose A/B, Q3 Cards A/B/C, Q4 Empty states A/B.
**Picked 2026-11-12**, each the recommendation: Welcome A, Compose A, Cards B, Empty states A; the
losers are stripped (canvas version 21).

**Round 2** reuses round 1's answers. **Picked 2026-11-12**, each the recommendation (canvas version 23):
Q1 a screen that waits shows its object still and one waiting bar (R8), Q2 every question is the paid
send's bottom sheet (R9), Q3 the dark iOS icon is the envelope itself (R8). R10 (backup and transfer,
every state) is derived, for review.

- **R8** sign-in and the Mobile Key wait, spinners, the launch, done states (I03, I10, I76).
- **R9** sheets, dialogs, menus and transient surfaces (I49, I52-I61). The first grading called them
  "matches" from the code alone; the owner asked where the modals were, and with Cards B they change
  too, so they are drawn: a confirm and a destructive dialog, the language, sender and term sheets, the
  box overflow menu, the alias editor, What's new, the snackbar, both themes, each with its Reduce
  Motion form.

**Round 3** draws every surface that still had no board (R11-R14), after the owner agreed R5-R7 and
R10 as drawn. **Picked 2026-11-12**, each the recommendation (canvas version 25): Q1 the recipient is
searched in the envelope's window (R12), Q2 the PDF from the typed text is a Czech letter on A4 (R12),
Q3 a sign-in method is chosen in one card of choices (R11), Q4 the scanner shows a window to aim
through (R13). The owner then agreed R11-R14 as drawn (after moving the inbox's debug strip onto the
flap), so every board on the canvas is agreed (canvas version 27) and the build can start.

## Build order

1. **Foundations** (agreed, no open choice): tokens in `src/theme/` and DESIGN.md with contrast tests
   (T020); the offset icon family (T021); one source file per object (T022). React Native SVG for every
   drawn object, Reanimated for motion, a Reduce Motion form for each.
2. **The agreed boards** (T030-T036): inbox, empty inbox, message (both themes), sent result, lock,
   motion.
3. **Round 1's picks**, then the derived boards R5-R7.
4. **Round 2** (R8-R10), the typesetting items (I82, I83), the leftovers (I63, I64, I80).
5. **Round 3** (R11-R14), each screen once its board is agreed.
6. **Close** (T050-T052).

Each step is its own commit through `.practices/bin/lint` and `npm test`, with a CHANGELOG line where a
user sees it.

## Risks and decisions

- **DESIGN.md says every card boundary is a hairline; the practices say "tone, not outlines".** The
  agreed inbox already uses tone. R3 asks; whichever wins, DESIGN.md and the `obalka/*` rules are changed
  in the same commit as `Card`, never one screen at a time.
- **Two leftovers on the agreed Message boards**: "Archivovat" and "Další akce" in the header, which the
  app does not have. Building them is a behaviour change (out of scope); the next canvas edit removes
  them unless the owner wants archiving, which would get its own spec.
- **The Lock board says "Obálka je zapečetěná"; the code says "Odemknout Obálku"** (`lock.prompt`). The
  board is the agreed design, so the build takes its copy (both languages).
- **Gold keeps one meaning** (unread, fiction, paid, the flap). A board that wants gold for anything else
  is wrong.
- **Text floor**: the practices' floor is 11 px, DESIGN.md's is 12 with Tag at 11 as the one exception
  (a word or two inside a coloured shape). The boards' 11 px text is all of that kind: box pills, avatar
  initials, the count badge, the stamp's "ZDARMA"; the build uses the Tag role for each.
- **Motion and battery**: the window glint follows tilt with `useAnimatedSensor`; it runs only while the
  window is on screen and is off under Reduce Motion.
- **No layout jumps** (constitution V): postmarks, stamps and flaps that arrive later get their room
  reserved.
