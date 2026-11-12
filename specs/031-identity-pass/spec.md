# Feature Specification: The identity pass - Obálka is printed matter, through the whole app

**Feature Branch**: `main` (normal history since 2026-11-10)
**Created**: 2026-11-12
**Status**: Inventory graded; round 1 on the canvas and picked (2026-11-12); round 2 (R8 sign-in and
waiting, R9 sheets and dialogs) next. Nothing of the new identity is built yet (see `tasks.md`).
**Input**: The owner agreed the identity and its first screens on 2026-11-11, on the design canvas
<https://claude.ai/artifact/NXmjzrevs3JuX9N7H71QbL> (canvas version 17, after an impeccable critique and
polish). The owner calls this pass "the second step": the canvas covers the practices' iterations 1 and 2,
so this is **iteration 3, the whole app, re-audited and polished**
(`.practices/docs/ui/identity-pass.md`).

## Why

The 009 "paper" redesign gave Obálka a warm, quiet system, but next to the company website (an envelope,
a cellophane window) and a sibling app with a strong look, the app "lacked identity". The agreed answer is
one physical idea from the product's own name. The showcase screens prove the idea; the app is done only
when every screen, state, control, transient surface, process and motion holds to it.

**Rating** (identity-pass.md, "Scale of change"): **bland, pushed far** - the palette, type and voice
stay, six objects and an icon family are new.

## The agreed identity (the canvas is the source; this restates it)

**Obálka is printed matter.** Mail from the state that reads like mail. Every bit of play is a real
postal object with **one job**. The chrome around the objects stays as quiet as it is today.

| Object | Czech | Its one job | Where (agreed) |
|---|---|---|---|
| Envelope | obálka | a box, and what arrives in it | box avatars take its silhouette; on a sender's tile a sealed flap means unread and replaces the dot; Welcome, Lock, the inbox header, a message |
| Window | okénko | who it is addressed to | the inbox's box switcher, "Komu" on a message and on the sent envelope |
| Security tint | potisk | the inside, the private | behind the lock, empty states, the recovery key and backup; never behind text you need to read |
| Postmark | razítko | a date ISDS certifies | delivered, delivered by fiction (in gold ink), sent. Only real timestamps |
| Stamp | známka | what a send costs | free or paid PDZ, seen before Odeslat; cancelled by a postmark when sent; Napsat is a blank stamp |
| Slip | dodejka | a record you keep | the delivery receipt, the recovery key, a transfer code |

Bonus: the test-environment strip in **airmail stripes**.

**Rules:** one object, one job; objects play, chrome doesn't; motion answers an action (ease-out
220-320 ms, no overshoot, no spring, a haptic thump where paper lands); buildable with react-native-svg
and Reanimated 4, no Skia.

**Icons:** twenty "offset print" glyphs (Přijaté, Odeslané, Napsat, Hledat, Příloha, Pečeť, Lhůta,
Doručeno fikcí, Schránky, Zámek, Archiv, Přenos, Nastavení, Upozornění, Stáhnout, Doručenka, Razítko,
Přečteno, Koncept, Připomínka), each a 1.75 round ink stroke on a 24 grid with one plane in the
envelope's blue printed 1.3 px off register. Plain controls (chevrons, close, more) stay Lucide.

**Motion:** four moments - opening a message (the letter rises out of its envelope, 280 ms), sending
(the postmark lands when ISDS accepts, one firm haptic), unlocking (the seal breaks, then the flap opens;
cold start only), the window film (a glint that follows tilt). Reduce Motion: a crossfade; the haptic
stays.

### Families and line weights (visual-craft, "A line weight per family")

| Family | Weight | Cap/join |
|---|---|---|
| Offset icons, 24 grid (inline 18, in a well 24 in 40) | 1.75 ink + one plane offset 1.3 | round/round |
| The same icons at 16 on a chip | 2 | round/round |
| Plain controls (Lucide) | Lucide's own, 2 | round/round |
| Postmark (34-150 px) | 1.4-1.6 rings, 1.5 waves | round |
| Envelope creases | 1.5, non-scaling | round |
| Avatar flap V | 1.6 at 40 | round/round |

### Tokens the canvas adds (to `src/theme/` and DESIGN.md before any screen uses them)

`envelope #2563A6` and `envelope-inside #1A4C86` (fixed in both themes), `flap #FFC305` (fixed),
`icon-plane #CFE0F5 / #2F4A6E`, `icon-plane-gold #F3D891 / #5A4716`, the window film and inset shadow,
the sheet shadow (`0 1px 2px rgba(33,27,18,.08), 0 8px 16px -10px rgba(33,27,18,.28)`), the envelope
shadow, the slip's perforation and the stamp's perforation, the tint pattern, the airmail stripes.
Values are copied from the canvas's source, never from a picture.

## Requirements

- **FR-001** Every item in `tasks.md`'s inventory is graded against the canvas and
  `.practices/docs/ui/visual-craft.md` (matches / drifts / misses) and ends checked as "matches" or
  "fixed".
- **FR-002** What drifts or misses is redrawn on the same canvas first, in real context (the real header
  and status bar, real Czech copy, both themes), with two or three variants where the choice is open and
  a one-line recommendation; at most four questions to the owner at a time; losers stripped after a
  pick.
- **FR-003** Only what the owner agreed is built, one to one with the canvas's source. New colours, sizes
  or radii go into `src/theme/` and DESIGN.md first; the `obalka/*` lint rules then hold the screens to
  them (spec 028).
- **FR-004** Each object is one drawing in one source file, used everywhere it appears (visual-craft,
  "One object, one drawing").
- **FR-005** Drawn objects use react-native-svg; motion uses Reanimated; every motion has a
  reduced-motion form that still reads.
- **FR-006** The postmark shows only timestamps ISDS certifies; gold keeps its one meaning (unread,
  fiction, paid, the flap).
- **FR-007** Every touched screen is checked in Czech and English at the longest Czech strings. Obálka
  has no pseudo-locale; adding one is the owner's call.
- **FR-008** No layout jumps (constitution V): a postmark, stamp or flap that arrives later has its room
  reserved.
- **FR-009** The final designs go through the `impeccable` skill (critique, then polish), with two
  isolated reviewers: a design review and the automated detector.
- **FR-010** Built screens are captured from the app in demo mode (`src/dev/demoData.ts`, a clean AVD or
  the iOS Simulator, never `Medium_Phone_API_36.0`) and compared side by side with the canvas.

## Success criteria

- **SC-001** The inventory checklist is fully checked; the owner has seen every redrawn item.
- **SC-002** The last critique of the built app finds nothing new.
- **SC-003** The canvas shows only agreed designs and matches the built app.

## Out of scope

Behaviour changes. This pass changes how things look and move, not what they do; a behaviour gap found on
the way goes to `docs/engineering/not-now.md` or its own spec.
