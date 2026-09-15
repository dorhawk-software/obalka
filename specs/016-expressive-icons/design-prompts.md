# Claude Design prompt — oversized iconography

**Purpose**: the app is correct, calm and a bit *tame*. Every glyph in it is a 13–22px Lucide stroke at
roughly the same visual weight, so nothing on a screen is ever loud on purpose. This asks Claude Design
to introduce a deliberate **scale jump** in the iconography — big glyphs used as composition, not
decoration — in the visual language already established.

**How to use**: historical. Sent to Claude Design on 2026-08-17 with §0 of
[`../009-visual-redesign/design-prompts.md`](../009-visual-redesign/design-prompts.md) prepended; the
answer is recorded in [`design-system.md`](./design-system.md).

**Status**: ✅ **answered 2026-08-17** — see [`design-system.md`](./design-system.md) for the four tiers, the rule, the budget, and the three placements it declined.

---

## The prompt

> The design is calm, warm and legible, and I want to keep all of that. What it is missing is **any
> moment of visual confidence**. Every icon in the file is a 13–22px Lucide stroke at about the same
> weight, so no screen ever has a focal point that is not text. The app reads as tame.
>
> You already did the thing I want, exactly once: the **44px gold Bricolage numeral** beside "Vyžaduje
> pozornost". It is oversized, it is confident, it carries meaning, and it makes that one section feel
> designed rather than assembled. **I want that instinct applied deliberately across the app, using
> icons.**
>
> ### What I am asking for
>
> 1. **Define an icon scale with named tiers**, and say what each tier is for. Something like inline
>    (16–22px, what exists today), *feature* (~48px), and *hero* (~96–180px) — but pick the actual
>    numbers, and decide whether a hero glyph should be full-strength accent colour, a low-contrast
>    tint sitting behind content like a watermark, or a knockout inside a shape. **Show the same glyph
>    at every tier** so the relationship is visible.
> 2. **Choose where the big glyphs go and lay those screens out.** Do not sprinkle them evenly — pick
>    the moments that earn one and leave the rest alone. Candidates worth weighing, in roughly the
>    order I would guess (disagree freely, and propose moments I have not listed):
>    - **Empty and zero states** — no messages, no search results, an empty box, nothing to send.
>      These are the safest and most rewarding: there is no content to compete with, and today they
>      are a 48px outline glyph in border-grey, which is the tamest thing in the app.
>    - **The onboarding / welcome and the lock screen** — first impression, no data on screen.
>    - **Confirmation moments** — a message has been sent. The app currently says so in a snackbar and
>      moves on.
>    - **Settings and FAQ group headers** — long lists of text rows that could use anchors.
>    - **The message detail's section breaks** (attachments, the delivery-state block).
>    - **Error / offline states** — where the app has to explain something went wrong.
> 3. **Give me a rule for when NOT to use one**, in one or two sentences I can apply without you. A
>    budget helps: e.g. at most one hero glyph visible per screen.
>
> ### Constraints that are not negotiable
>
> - **This is a government mail client. An icon must never imply a status the app has not been told.**
>   A big glyph next to a message will be read as a statement about that message. If a hero glyph
>   appears anywhere near legal state — delivered, served by fiction, a deadline — it must correspond
>   to something the text already says, not add a new claim. When in doubt, put the big glyph where
>   there is no content to misread it against.
> - **Decorative glyphs must be decorative all the way down**, i.e. skippable by a screen reader. If a
>   big icon is the only thing saying something, it is not decoration and needs words too.
> - **No layout jumps.** Anything that appears asynchronously reserves its space up front. This has
>   bitten the app twice already.
> - **Full dark mode**, and **WCAG AA** for anything carrying meaning. A watermark tint may fall below
>   AA only if it is purely decorative and nothing depends on seeing it.
> - **Honour Reduce Motion.** If you propose any entrance for these, give the still version too.
> - Keep the existing palette, type and components. Reuse the Lucide set the file already uses — I am
>   not asking for a new icon family, illustrations, or a mascot.
> - Czech-first copy (cs + en) for anything new.
>
> ### Deliver
>
> - The scale, as tokens, with the one-line rule for each tier.
> - `sc-if` blocks for every screen or state you change, consistent with the rest of the file.
> - A short written rationale: which moments you chose, which you deliberately left tame, and why.
>   I care as much about where you did *not* put one.

---

## Notes for the port

Filled in — see [`design-system.md`](./design-system.md). In short: four tiers (`inline` 18 /
`feature` 44-in-72 / `emblem` 44-in-96 / `hero` 132), four hero empty-states, one emblem (message
sent), one feature (the notification explainer sheet). Nothing was placed near a legal state — the
design declined that placement itself, citing the same reason the prompt gave it.

One item needs a decision before any porting: the `feature` placement is the **notification primer
sheet**, a screen 014 deleted and 010 chose not to restore. Designing it back in is a proposal about
010's behaviour, not about icons, and is out of 016's scope.
