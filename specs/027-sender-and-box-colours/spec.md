# Feature Specification: The sender in compose, and a colour of its own for every box

**Feature Branch**: `027-sender-and-box-colours`
**Created**: 2026-10-03
**Status**: Implemented 2026-10-03 (see `tasks.md`).
**Input**: Owner walk-through, 2026-10-03:
*"In the writing message dialog, the sender should be there too and it should be possible to change the
sender there. On messages overview of "Vše" schranky there should be the send button too, on clicking,
sender is empty and needs to be selected (until a sender is selected, once selected it cannot be
unselected). Allow changing of color of the data box. In the all boxes overview it is difficult to
differentiate the receiving box based on the pill …"* Decided the same day from a design doc with variants
for each change: **1A, 2B, 3C** - "implement your recommended options".

## Why

Compose sent from whichever box it was opened in and never said which; the merged view ("Vše") could
not compose at all. A box's colour was a hash of its ID over six hues, so two boxes could share one and
nothing could change it - and the merged list told boxes apart by a 7 dp dot and a legal-form code,
which for three boxes of one owner ("Ondřej Dvořák" as FO, PFO and the company) is two letters.

## User Scenarios

### US1 - See and change the sender (P1) - decision 1A

1. **Given** compose opened from a box, **Then** an "Od" card above the recipient shows that box
   (avatar in its colour, name, legal form and, when known, its PDZ credit).
2. **Given** more than one box, **Then** "Změnit" on the card opens a sheet listing every box; picking one
   makes it the sender. The draft (recipient, subject, text, attachments) is kept.
3. **Given** a box that needs a new sign-in, **Then** it is listed but cannot be picked, and says why.
4. The sender cannot be changed once the message is sent.

### US2 - Compose from "Vše" (P1) - decision 1A

1. **Given** the merged view, **Then** the same "Napsat" button is there.
2. **Given** compose opened from it, **Then** the sender starts empty: a dashed "Vyberte schránku, ze které
   posíláte" prompt, with the rest of the form shown but inactive until a sender is chosen.
3. **Given** a sender is chosen, **Then** compose continues as in US1; the sender can change to another box
   but never back to empty.

### US3 - A colour for every box (P1) - decision 2B

1. Boxes get colours from a palette of ten, each keeping white letters at WCAG AA. A new box gets the first
   colour no other box has; boxes added before this get distinct colours once, in the order they were
   added.
2. The box's ⋯ menu offers "Upravit schránku": one sheet with the box's own name and its colour, with a
   live preview. A colour another box already has is marked, and allowed.
3. The colour is used wherever the box appears: the switcher, the inbox header, the merged-list pill, the
   "Jinde" line, the re-auth screen and compose.
4. The colour travels with backups and phone transfers, like the box's name.

### US4 - See which box a message arrived in (P1) - decision 3C

1. **Given** the merged view, **Then** each message's box pill is filled with the box's colour and carries
   the box's monogram and its name (the user's own name for it, when set), in white.

## Requirements

- **FR-001** `DataBoxAccount.color` (optional hex from `BOX_COLORS`), column `accounts.color`
  (migration 16), `AccountsStore.setColor`.
- **FR-002** `boxColor(account)` is the one way to read a box's colour; it falls back to the old hash for a
  box without one, so nothing ever renders colourless.
- **FR-003** Backup schema 3 carries `color` per account; migration 2→3 adds `color: null`; restore writes it.
- **FR-004** Compose takes the sender from its route: `Compose { boxId: string | null }`; null opens the
  sender gate. `ComposeScreen` gets `accounts` and `onChangeSender`.
- **FR-005** Every string in Czech and English; sheets reuse `BottomSheet`, rows reuse the settings-card
  metrics.

## Out of scope

- A prompt to name boxes that share an owner's name (raised in the design doc as a question, not decided).
