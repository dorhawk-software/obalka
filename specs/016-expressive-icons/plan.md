# Implementation Plan: Expressive iconography

**Branch**: `016-expressive-icons` | **Date**: 2026-08-17 | **Spec**: [spec.md](./spec.md)
**Design**: [design-system.md](./design-system.md) — the returned scale, rules, budget and placements.

> **Order, stated honestly.** This feature was commissioned from Claude Design before it was planned,
> and `Icon Scale.dc.html` *is* the plan: it fixes the tiers, the treatments, the rule and the
> placements, in more detail than a plan.md would have. This file records the engineering decisions
> the design does not make, and was written alongside the port rather than before it. That is the same
> design-first shape 013 used, and it is labelled here for the same reason.

## Summary

Four named tiers replace "whatever size looked right". Five placements ship: four hero-tier empty and
zero states, and one emblem on the send confirmation. No behaviour changes, no new data, no new
dependency.

*As built, later:* two more hero placements under the same rule - the re-auth state with nothing
cached (`CloudOffGlyph`, `MessageList.tsx`) and the empty search query (`SearchScreen.tsx`, after the
2026-09-09 critique) - so six hero sites and one emblem. Both were added in code, not by the design.

## Technical Context

**Dependencies**: none new — the glyphs are already in `lucide-react-native`.
**Constraints**: no layout jump; decorative glyphs hidden from assistive tech; light + dark; AA where
meaning is carried; 1.5× font scale.

## Constitution Check

| Principle | Status |
|---|---|
| I — Never block the UI thread | ✅ static SVG, no animation added |
| II — Crash-resilient | ✅ presentation only, no new failure path |
| III — Privacy first | ✅ nothing leaves the device |
| IV — Archive is sacred | ✅ untouched |
| V — Accessible, Czech-first | ✅ tiers come from one scale, not per-screen taste; decorative glyphs are hidden from screen readers; no new strings needed |
| VI — Honest scope | ✅ the load-bearing one — see below |
| VII — Test environment | ✅ walked on the emulator |

**Principle VI is the whole design of this feature.** A big glyph beside a message is read as a claim
about that message. The design's own rule is stricter than the spec's FR-004 and is what ships:

> A big glyph goes only where there is nothing it could be a statement about. If a screen shows even
> one real message, the largest icon on it stays inline.

## Key engineering decisions (not made by the design)

1. **Tiers as components, not a `size` prop.** `iconTiers.tsx` exports `HeroIcon` / `EmblemIcon`
   taking a Lucide glyph. A `size` prop on the existing wrappers would have invited "just make it
   bigger here", which is precisely the discipline this feature is trying to install — the tier is a
   claim about the screen, not a preference about the picture.
2. **The existing per-glyph wrappers stay.** Each hardcodes the inline stroke width the design gave
   it; the tiers need their own stroke (1.25 hero, 1.9 emblem), so the tier components take the raw
   glyph. Four raw glyphs are re-exported from `icons.tsx` for that.
3. **`heroInk` is a new theme token**, not `borderStrong`. They are close (`#DCD2BF` vs `#D3C7AF`)
   and pixel parity with the design is a stated project priority. It is also the one token allowed
   below AA, which is worth stating where it is defined rather than discovering later.
4. **`brandTile` (`#2D6CB5`) already existed** and is exactly the emblem's fill — no new colour.
5. **The `feature` tier is defined but not implemented.** Its only placement is the notification
   primer sheet, a screen 014 deleted and 010 chose not to restore. The tier arrives with the screen
   that needs it, if that screen is ever agreed.

## Complexity Tracking

Nothing to justify.
