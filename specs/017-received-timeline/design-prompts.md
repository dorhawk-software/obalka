# Claude Design prompt — a delivery timeline for RECEIVED messages

**Purpose**: a sent message gets a proper delivery timeline — a left rail, a state glyph per step,
timestamps, and a note when something stopped. A received message gets the same journey compressed
into one line of grey caption text inside the sender card: *"Dodáno 12.06.2026 14:58 · Doručeno
12.06.2026 14:58"*. The half of the app that carries **legal deadlines** is the half with the weaker
presentation.

**How to use**: historical. The prompt below was pasted together with the shared §0 context from
[009's design-prompts.md](../009-visual-redesign/design-prompts.md).

**Status**: ✅ sent and returned 2026-08-17 (see [design-system.md](./design-system.md)); ported and
walked on a device (tasks T001–T011); the unrecognised-state follow-up T012 closed 2026-09-14.

---

## The prompt

> A **received** message's detail needs the delivery timeline that a **sent** message already has.
>
> ### Where it stands
>
> - **Sent**: a vertical rail, one state glyph per step, each with a label and timestamp, joined by a
>   connector — Odesláno → Dodáno → Doručeno (or *Doručeno fikcí*, gold), with the journey **stopping**
>   and the remaining steps removed entirely when the message failed the virus check or the box was
>   invalid. A greyed-out step reads as "still coming", so nothing that is not coming is left greyed.
> - **Received**: everything above is a single caption inside the sender card —
>   *"Dodáno 12.06.2026 14:58 · Doručeno 12.06.2026 14:58"* — in the same muted grey as the box ID
>   beneath it. It is the least prominent text on a screen about a legally delivered document.
>
> ### The data you have for a received message, exactly
>
> - **Dodáno** — `dmDeliveryTime`, when the message landed in the box.
> - **Doručeno** — `dmAcceptanceTime`, when it was legally served: either by someone signing in, or
>   **by fiction** after 10 days if nobody did.
> - **The state**, one of: *dodáno* (4), *doručeno fikcí* (5), *doručeno přihlášením* (6), *přečteno*
>   (7), *obsah smazán* (9, ISDS erases content after 90 days), *v trezoru* (10, the paid Datový
>   trezor). A recipient never sees states 1–3 or 8 — those happen before, or instead of, the message
>   reaching them.
>
> ### Four things that make this NOT just the sent rail with different labels
>
> Please solve these rather than inheriting them:
>
> 1. **The journey is already over before the user can see it.** Merely listing an inbox is what
>    legally serves a message, so by the time a received row exists it has been served. The sent rail
>    shows something in progress; this one is always a completed record. Should it look different for
>    being finished?
> 2. **The two timestamps are frequently identical** — the example above is real: delivered and served
>    in the same minute. Two steps showing the same time look like a bug or like padding. Decide what
>    to do: collapse them, show the pair once, keep both and let them repeat, something else.
> 3. **"Přečteno" has no timestamp.** ISDS reports that the message was read but never says when. A
>    step with a label and no time on a rail of timestamped steps needs a deliberate treatment — or
>    needs to not be a step.
> 4. **States 9 and 10 are not delivery states.** *Obsah smazán* (the content erased after 90 days)
>    and *v trezoru* (kept in the paid vault) are what happened to the message **afterwards**. Do they
>    belong on the same rail, in their own block, or nowhere?
>
> ### Constraints
>
> - **Never imply a state ISDS did not report.** In particular nothing may suggest a step is still to
>   come when it is not, and *Doručeno fikcí* must stay visibly distinct from *Doručeno* — they are the
>   same legal outcome reached in opposite ways, and only one of them means nobody ever saw it.
> - **Reuse the sent rail's parts where they genuinely fit** (the glyphs and tones already exist:
>   `statusDelivered` blue, `statusRead` green, `statusFiction` gold, `statusStop` inverted). Tell me
>   where you deliberately diverged.
> - The sender card is directly above; say how the two relate — whether the timeline replaces the
>   caption, sits under the card, or absorbs the card.
> - Full **dark mode**, **WCAG AA**, no layout jumps, holds at **1.5×** font scale, Czech-first
>   copy (cs + en), existing palette, type and components.
>
> ### Deliver
>
> `sc-if` blocks for a received detail in each meaningful state — served by sign-in, **served by
> fiction**, read, content erased, in the vault, and the case where both timestamps are identical —
> plus a short rationale covering the four questions above.

---

## Notes for the port

See [design-system.md](./design-system.md) §Port notes and §Divergences. The grey caption was
replaced by `DeliveryRecordCard` (tasks T005).
