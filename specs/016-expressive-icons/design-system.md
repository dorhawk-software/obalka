# Icon scale — what Claude Design returned

Source of truth: **`Icon Scale.dc.html`** in the "Obálka app design overview" project (new file,
2026-08-17), plus the placements added to `Obalka Redesign.dc.html`. Read via `DesignSync`
(`projectId 2c15c7b1-3690-44ff-b610-4ea7620bdb6a`). This file records what it says so the port has a
local reference; **the design remains the source of truth** — code is corrected to it, never the
reverse.

## The four tiers

| Tier | Size | Treatment | Rule |
|---|---|---|---|
| `inline` | 18px, stroke 2 | `currentColor`, in the flow of text | The default. Needs no justification. |
| `feature` | 44px glyph in a 72px box, radius 22, stroke 1.9 | accent on its own tinted surface | Anchors one block on a screen. |
| `emblem` | 44px glyph in a 96px square, radius 28, stroke 1.9 | knockout, white on solid brand blue `#2D6CB5`, shadow `0 14px 34px rgba(33,50,90,.32)` | Only a fact the app knows **and the text already says**. |
| `hero` | 132px, stroke 1.25 | flat neutral tint, `aria-hidden` | Decoration only. Empty and zero states only. |

Tier colours:

| Token | Light | Dark |
|---|---|---|
| hero ink | `#D3C7AF` | `#4E4638` |
| feature surface / ink | `#E4ECF7` / `#2A5C9A` | `#1E2A3A` / `#8FB6E4` |
| emblem surface / ink | `#2D6CB5` / `#FFFFFF` | `#2D6CB5` / `#FFFFFF` |

Note the stroke weights move **against** size: 2 at inline, 1.9 at feature/emblem, 1.25 at hero. A
132px glyph at stroke 2 would be a slab; the taper is what keeps it atmospheric.

## The rule for when NOT to use one

> *"Velký glyf patří jen tam, kde není nic, o čem by mohl něco tvrdit — prázdný seznam, dokončená
> akce, obrazovka bez zprávy. Jakmile je na obrazovce jediná skutečná zpráva, největší ikona na ní
> zůstává **inline**."*
>
> A big glyph goes only where there is nothing it could be a statement about — an empty list, a
> finished action, a screen with no message on it. If a screen shows even one real message, the
> largest icon on it stays inline.

This is sharper than the spec's FR-004, which asked that a glyph near legal state correspond to
something the text already says. The design's version is a bright line drawn one step earlier: the
presence of *any* real message on the screen is what disqualifies the tier. Adopt the design's
wording — it is easier to apply and harder to argue around.

## Budget

- At most **one** feature/emblem/hero glyph per screen.
- **A hero is never gold** — gold means delivery by fiction in this app, and a decorative glyph must
  not borrow a tone that carries legal meaning. (Not something the spec thought of.)
- A hero **may fall below AA**, because nothing depends on seeing it. This is the FR-007 exemption
  being used deliberately, not by accident.

## Where the big glyphs are

| Where | Tier | Why (design's own reason) |
|---|---|---|
| Empty inbox / empty sent / empty search / load error | `hero` | No content to be misread, and these were the tamest surfaces in the app. |
| "Zpráva odeslána" confirmation | `emblem` | The only non-empty screen that earns one: the app knows it happened and the headline already says so. |
| Notification explainer sheet | `feature` | A sheet header with a decision underneath — exactly what the feature tier is for. |

*Two more hero placements were added later in code, not by the design - see [`plan.md`](./plan.md) › Summary.*

## Where it deliberately put none — and why

The design declined **three of the six** placements the prompt suggested, each with a better reason
than the suggestion:

| Declined | Design's reason |
|---|---|
| Welcome and Lock | Already carry the logo at 120px and 104px. A hero glyph would compete with the brand mark for the same job. |
| Settings / FAQ group headers | "Eight glyphs down the length of a scroll is sprinkling by definition, and breaks the budget on contact." |
| Message-detail section breaks | The closest thing to legal state. A big glyph above the delivery block would read as a verdict about that message. |

The third is the prompt's own hard constraint turned back on the prompt's own suggestion, which is
the outcome that most justifies having commissioned the work rather than guessing.

## Accessibility and motion, as designed

- Every hero and emblem glyph is `aria-hidden` (and `focusable="false"`) and sits above text that
  states the thing in words → satisfies FR-003 and FR-005.
- Every hero sits in a **fixed 132px box**, so nothing reflows when it renders → satisfies FR-006.
- **No new animation.** The glyphs ride the screen's existing entrance → satisfies FR-009 with
  nothing further to build.

## Port notes (written before the port, 2026-08-17)

*As built:* the tiers live in `src/theme/iconTiers.tsx`; every `EmptyState` caller passes a `HeroIcon`;
the emblem replaced a 58px glyph on the existing sent-success screen in `ComposeScreen.tsx` (there was
no snackbar - see [`tasks.md`](./tasks.md) T009).

- The tiers belong in `src/theme/icons.tsx`, which already copies each glyph's default size and
  stroke width from the design. A named scale replaces the per-glyph defaults for these four uses.
- `EmptyState` (`src/theme/EmptyState.tsx`) currently takes an `icon` node the caller sizes at 48px
  in `theme.borderStrong`. Hero is 132px in a new neutral tint, so this component and all its call
  sites change together.
- The `cSent` emblem lands in `ComposeScreen.tsx`, which today reports a send with a snackbar.
- The `feature` placement is the **notification primer sheet** — a screen 014 deleted
  (`NotificationPrime.tsx`) and 010 chose not to restore, asking for permission on the first reminder
  instead. Designing it back in is a proposal about 010's behaviour, not just its icons. It is
  **out of 016's scope** and needs its own decision before anything is ported there.
