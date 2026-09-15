# Feature Specification: A design-system linter that tells the agent how to fix it

**Feature Branch**: `028-design-lint`
**Created**: 2026-10-04
**Status**: Implemented 2026-10-04 (see `tasks.md`): phases 0 and 1, and the first pass of 2. The owner took
every recommendation ("yes", 2026-10-04); where the result differs from the sketch, `tasks.md` says how.
**Input**: Owner, 2026-10-04: *"some new open source project aimed at some kind of frontend style
linter. Its premise was to add a hard guardrail when someone was not adhering to design library, eg using
a button and overriding its padding … when a violation was found, it returned a very nice and detailed
readable error message to be consumed by an ai agent."* That project is
[`@shadcn/lint`](https://github.com/shadcn-ui/lint); asked to sketch the same for this app.

## Why

`@shadcn/lint` is an ESLint plugin whose rules encode a design system (`no-restyle`, `no-raw-colors`,
`no-arbitrary-values`, …) and whose messages carry the fix, drawn from the system itself:

> "p-4" is not allowed on &lt;Button&gt;: &lt;Button&gt; owns its spacing. Use a size (sm, lg), or margin
> here or gap on the parent for space around it.

It is Tailwind-only, so it cannot run here. The idea transfers directly, and this app already half-has
it: `check-no-raw-hex.sh`, `spacing.test.ts`, `fontScale.test.ts`, `contentBottomInset.test.ts`,
`noTypedHitSlop.test.ts`, `concentric.test.tsx` and others are each a design rule enforced by a scan, most
with a message that says what to do. What they lack is what the shadcn tool gets from being a linter: a
`file:line` on the offending prop, in the editor and in `npm run lint`, one consistent message shape an
agent can act on without opening the rule, and a rule set that covers the props screens actually
override. Constitution V already says spacing, radii and type come only from the scale; nothing enforces
it for most props.

## What the code does today (scanned 2026-10-04, `src/` outside `src/theme/`)

| Deviation | On the scale | Off it | Notes |
|---|---|---|---|
| Text role restyled (`fontSize`, `lineHeight`, `fontFamily`, `fontWeight`, `letterSpacing` on `Body`, `Caption`, …) | - | **481 props in 39 files** | By size: 12px ×79, 14px ×38, 13px ×34 (mostly the role's own size again), 15px ×17, 11px ×12 |
| `borderRadius` literal | 125 | **16** | 2, 3, 5, 6, 7, 9, 10, 26, 30 - none a DESIGN.md step |
| `padding*` / `margin*` / `gap` literal | 441 | **255** | 16 ×38, 1 ×32, 13 ×25, 11 ×24, 3 ×16, 22 ×15, 20 ×14, … |
| Hand-built card (`XStack`/`YStack` with radius + border + background) | - | **59** | `Card` exists, but only in `app/settings/SettingsSection.tsx` |

Two readings of those numbers shape the plan:

1. **Part of it is the scale, not the screens.** 12px and 14px text appear 117 times because the design
   uses them and the type scale has no role for either - every screen that needed one sized a role by
   hand. A linter that only says "don't" would push those to a role of the wrong size. The scale has to
   be completed first (D1).
2. **It cannot land as a wall of errors.** 750-odd findings fail CI on day one, so the rules start
   against a recorded baseline that may only shrink (D3).

## The rules (proposed)

A local ESLint plugin, `obalka/*`, in the repo. Each rule reads its truth from the theme, never from a
copy (see Implementation).

| Rule | Reports | Truth | Message points to |
|---|---|---|---|
| `obalka/role-typography` | a type prop on a text role | `type` in `typography.ts` | the role of that size and weight; or "missing role, add it here" |
| `obalka/radius-steps` | a `borderRadius` not on DESIGN.md's steps and not `concentric(…)` | DESIGN.md › Shapes (as tokens) | the nearest step and what it is used for; `concentric()` when the element is nested |
| `obalka/space-scale` | a spacing literal not in `space` | `spacing.ts` | the nearest `space.*` token |
| `obalka/no-raw-color` | a hex or `rgba(` literal | `theme.ts` | the theme tokens with that value, if any. Replaces `check-no-raw-hex.sh`; the palette files stay exempt |
| `obalka/use-card` | a hand-built card | the shared `Card` | `<Card>` (D4) |
| `obalka/concentric` (stretch) | a rounded child whose radius is not `parent − gap` where both are literals in one component | DESIGN.md › The Concentric Rule | `concentric(parent, gap)` |

Each rule has a narrow escape hatch: `// eslint-disable-next-line obalka/<rule> -- <reason>` with the
reason required (`eslint-comments/require-description`), so an exception says why it exists.

### The message contract

Every message, from every rule, has the same four parts - this is what makes it something an agent
can act on without reading the rule:

1. **What**: the element and prop as written, and what the system says it should be.
2. **Fix**: the concrete replacement - a role, a token, a component - taken from the theme.
3. **If none fits**: where the system itself gets extended (a file and a DESIGN.md section), and an
   explicit "not here".
4. **Why**: one line, naming the rule in DESIGN.md or the constitution.

A spike of `role-typography` (in the scratchpad, not the repo) run on `SenderPicker.tsx` - a file written
on 2026-10-03, which shows the rules catch new code, not only old - produced these, verbatim:

```
68:23  <BodyStrong fontSize={14}> restyles a text role. BodyStrong is 15/21 Public Sans 700 by design
       (src/theme/typography.ts).
         Use instead: <Value> (14/19 Public Sans 600).
         Why: one size per role is what keeps two screens from drifting apart (constitution V).

71:20  <Caption fontSize={12}> restyles a text role. Caption is 13/17 Public Sans 500 by design
       (src/theme/typography.ts).
         No role is 12px. If the design really uses 12px text, that is a MISSING ROLE: add it to `type`
         in src/theme/typography.ts and to DESIGN.md › Typography, then use it here. Do not size it per
         screen.
         Why: …

53:14  <Label fontFamily={…}> restyles a text role. Label is 13/17 Public Sans 600 by design.
         Use instead: a role with the weight you want - <Caption> (Public Sans 500), <Badge> (Public
         Sans 700).
         Why: …
```

The first shows the honest edge of "use instead": `Value` is 14px but 600, not 700, so the suggestion
names the difference instead of hiding it. The finished rule would list only roles that match on size
AND face, and otherwise fall through to "missing role".

## Rollout

1. **Phase 0 - complete the scale.** Add the roles the design actually uses (D1), each checked against
   the Claude Design source (it is the source of truth, see the pixel-parity rule), and the spacing steps
   (D2). DESIGN.md first, then `typography.ts` / `spacing.ts`, with the existing parity tests.
2. **Phase 1 - the rules, with a ratchet.** The plugin lands in `npm run lint` (so in `verify` and CI)
   with `design-lint-baseline.json`: per file, per rule, the count of findings today. CI fails when a
   count rises or a new file has any. A test also fails when a count FALLS without the baseline being
   lowered, so the ratchet tightens itself and never silently loosens. New code is clean from day one.
3. **Phase 2 - burn down**, one screen at a time, each a normal change with its emulator check (no
   layout jumps, pixel parity). Restyles that turn out to be real design variants become roles or props
   on the component, never disables.
4. **Phase 3 - delete the baseline.** The rules become plain errors, and the scan-based tests they
   replace (`check-no-raw-hex.sh`, parts of `spacing.test.ts`) are removed.
5. **For agents**: one line in CLAUDE.md - after any UI change run `npm run lint`; its `obalka/*`
   messages carry the fix. That closes the loop the shadcn tool is built around.

## Implementation notes

- **ESLint 8, legacy config** (`.eslintrc.js`): a local plugin `tools/eslint-plugin-obalka/` added as a
  `file:` devDependency, so `plugins: ['obalka']` resolves without publishing anything. Pure JS, no new
  third-party dependency.
- **Truth, not copies**: the rules need the role table, the spacing scale, the radius steps and the
  palette. A small script emits `tools/eslint-plugin-obalka/tokens.json` from `src/theme/*` and
  DESIGN.md; a jest test fails when it is stale, as `spacing.test.ts` already does for DESIGN.md.
- **Tests**: ESLint's `RuleTester` per rule, with the full message text asserted - the message is the
  product, so a reworded message is a reviewed change.
- **Scope**: `src/**/*.tsx` outside `src/theme/` (the theme is where the system is defined, so it may
  use raw values).

## Decisions (taken 2026-10-04: all as recommended)

- **D1 - the missing text roles.** Add roles for the sizes the design uses (likely 12px "meta", 14px
  "body small", 11px "micro"; exact sizes, weights and line heights read from the design), or map every
  12/14/11 override onto today's roles (fewer roles, but visible changes on many screens). *Recommended:
  add them*: the design is the source of truth, and mapping would knowingly redesign ~130 places.
- **D2 - spacing steps.** 16 (×38), 20 (×14) and 22 (×15) are used often and are not on the scale. Add
  the ones the design really has; fold the rest to neighbours. *Recommended: decide per value against the
  design in Phase 0.*
- **D3 - ratchet, or fix everything first.** *Recommended: ratchet.* It protects new code immediately,
  and the burn-down can follow the screens being touched anyway.
- **D4 - promote `Card` to `src/theme`** and make the 59 hand-built cards use it (or a `Card` with a
  `tone`/`padding` variant where they genuinely differ). *Recommended: yes*, as part of Phase 2.

## Out of scope

- Publishing the plugin. It encodes this app's design system and nobody else's.
- Lint rules for behaviour (touch targets, accessibility labels): those stay in their existing tests,
  which render the components and measure what a linter cannot see.
