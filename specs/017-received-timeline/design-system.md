# The received delivery record — what Claude Design returned

Source of truth: `Obalka Redesign.dc.html` in the "Obálka app design overview" project (updated
2026-08-17), read via `DesignSync`. Recorded here so the port has a local reference; **the design
remains the source of truth**.

## It is not a timeline. It is a *Doručenka*.

The prompt asked for "the timeline the sent side has". The design declined the framing, and the
markup says so in a comment: **"delivery record: a finished journey, not a rail in progress"**.

It is a card with a tinted header band naming the outcome — **`Doručenka`** / *Delivery record*, or
**`Doručenka · fikcí`** / *Delivery record · by fiction* — with the steps inside it.

That is a better answer than the one requested. *Doručenka* is the actual Czech legal term for the
proof-of-delivery record, so the block is now named after the thing it is, and a user who has ever
dealt with one recognises it instantly. A sent message shows a journey still moving; a received
message shows a receipt for a journey that finished before they could see it.

## The four questions, and how it answered them

### 1. Should a finished journey look different? — Yes, and it gets a different noun

Header band + card, not a bare rail. See above.

### 2. The two timestamps are frequently identical — MERGE them, and say why

Rather than printing the same minute twice, the two steps collapse into one:

> **Dodáno a doručeno** — *Delivered and accepted*
> *"Schránka byla v tu chvíli přihlášená, zpráva se doručila hned po dodání."*
> *"The box was signed in at that moment, so the message was accepted as soon as it arrived."*

The repetition was never padding — it was a *fact* about how the message was served, and the design
turned it into the explanation instead of hiding it.

### 3. "Přečteno" has no timestamp — demote it, and say why it has none

It is not a step on the rail. It is a footnote below a divider, with an eye glyph:

> *"Přečteno — bez právního významu, stát čas nepředává."*
> *"Opened — no legal significance, and the state never reports the time."*

Two claims in eleven words, both of which the app must make: opening a message changes nothing
legally (service already happened), and the missing timestamp is ISDS's silence rather than the app's
omission. Exactly the Principle VI move — say what is not known, and whose gap it is.

### 4. States 9 and 10 are not delivery states — annotations, not steps

`obsah smazán` (content erased at 90 days) and `v trezoru` (kept in the paid vault) render as a
separate annotation list under their own divider, each with its own small glyph. Off the rail, still
on the card.

## Step rendering

| Step | Glyph |
|---|---|
| Dodáno | bare check, stroke 2.4 |
| Doručeno (accepted) | filled circle, knocked-out check |
| Doručeno fikcí | filled circle, knocked-out check, fiction tone |

Steps carry a connector between them, an optional per-step note, the label left and the time right
(both wrapping), and the fiction step gets:

> *"Deset dní se do schránky nikdo nepřihlásil, doručil ji zákon."*
> *"Nobody signed in for ten days, so the law accepted it."*

## Also changed in the same pass

The counterparty's box ID is now conditional (`dParty.hasBoxId`) rather than always rendered.

## Port notes

- Replaces the `d.metaLine` caption under the sender in `MessageDetail.tsx`.
- The sent rail's `steps` builder is the precedent, but this is a different component: different
  container, merged step, footnote, annotations.
- The merge rule needs deciding in code: the design's sample data drives it, and `dRec`'s own logic
  sits in the part of the file past `get_file`'s 256 KiB cap. **Deriving "delivered and accepted are
  the same moment" is a judgement the port has to make explicit** — equal to the second? to the
  minute? — and it must degrade to two separate steps whenever they genuinely differ.
- New strings: `recvHead`, `recvHeadFiction`, `recvMerged`, `recvMergedNote`, `recvReadNote`,
  `recvFictionNote` (cs + en, all captured above).


## Divergences from the design, and why

1. **The read note's wording.** The design wrote *"Přečteno — bez právního významu, stát čas
   nepředává."* Changed to *"…ISDS čas přečtení neuvádí."* after reading it on a real message: on mail
   from **Česká pošta**, "stát" is read as the *sender*, and the sentence then looks plainly false to
   the person reading it. The claim was never about who wrote to you — it is about what the ISDS
   system reports, which is nothing. Same fact, no misreading available. (Principle VI outranks
   pixel-parity when the pixels say something untrue.)

2. **No italic anywhere.** No italic face is bundled and React Native will not synthesise one for a
   named family, so an italic instruction renders upright and silently. Weight and colour carry the
   distinctions instead.

3. **The card is a sibling of the sender card, not nested inside it.** Ported wrong first, caught on
   the device: nested, the record read as a sub-detail *of the sender*, when it is the message's own
   legal receipt. The design has two cards; so do we now.

4. **The connector is dotted, not solid.** The design drew the record's connector
   `border-left: 2px solid`; the sent rail's is dotted. Changed to dotted on the user's instruction,
   and the reasoning holds up: the sent rail stays dotted **even on a fully completed message**, so
   solid-versus-dotted was never carrying "finished" against "in progress" — it was a second style
   for the same idea, on the one screen a user flips between most often. It now uses the sent rail's
   connector prop for prop.
