# Tasks: The received delivery record

**Feature**: `017-received-timeline` | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

## Phase 1: The record (pure)

- [x] T001 [P] Write `__tests__/messages/deliveryRecord.test.ts`: two distinct times → two steps;
  identical rendered times → one merged step with the note; fiction → fiction header, distinct step
  kind and its note; not-yet-served → one step only, nothing greyed in; read → a read note and NOT a
  step; states 9/10 → annotations, not steps; garbled input → no throw.
- [x] T002 Implement `deliveryRecord(envelope, fmt)` in
  `src/features/messages/state/deliveryRecord.ts` — total, pure, taking the formatter so the merge
  rule is testable without a clock (plan §"The one decision").

## Phase 2: US1 — the card (P1)

- [x] T003 [P] [US1] Add the strings (cs + en) to `src/i18n/strings.ts`, from the design:
  `recv.head`, `recv.head.fiction`, `recv.merged`, `recv.merged.note`, `recv.read.note`,
  `recv.fiction.note`.
- [x] T004 [US1] Build `src/features/messages/screens/DeliveryRecord.tsx` per the design — header
  band, steps with connector and glyphs, label left / time right (both wrapping).
- [x] T005 [US1] Mount it in `MessageDetail.tsx` for received messages and delete the grey caption.

## Phase 3: US2 — the read footnote (P2)

- [x] T006 [US2] Render the read note below a divider with the eye glyph, only when read.

## Phase 4: US3 — post-delivery annotations (P3)

- [x] T007 [US3] Render `obsah smazán` / `v trezoru` as annotations under their own divider.

## Phase 5: Verification

- [x] T008 Full gate: tsc, eslint, jest, attributions.
- [x] T009 Device walk on czebox: the merged case (the system-box message delivers and serves in the
  same minute — the exact case FR-003 exists for), light + dark, 1.0× + 1.5×. **Walked in light at 1.0× on the production box 2026-08-17**, which
  carries both cases: the Česká pošta message (delivered and served in the same minute → ONE merged
  step with its note) and the ISDS message (15:40 vs 18:28 → two steps). **Dark and 1.5× done too** — the header band goes deep green, glyphs and the dotted connector keep their tones, and at 1.5× each label and time still holds one line while the read note wraps. No clipping, no horizontal scroll.
  Two defects found by looking rather than by testing, both now fixed and covered:
  - every step drew the same filled disc, so *dodáno* and *doručeno* looked like one event. The sent
    rail had always distinguished them; the record now uses the SAME `DeliveryStateIcon` component,
    which is what should have happened first (Principle V).
  - the read note said the *state* does not pass on the time, which on a message from Česká pošta
    reads as a claim about the sender. Reworded to name ISDS.
- [x] T010 Update `specs/README.md`.
- [x] T011 Consider the SENT rail's identical timestamps. **Done 2026-08-17, and the diagnosis changed on inspection.** The same message shows *Odesláno 10:09 /
  Dodáno 10:09* — the very repetition 017 removed from the received side, still present on the sent
  side. Out of 017's scope (its spec says the sent rail is untouched) and noted rather than silently
  fixed, because merging there looked like it meant something different. It does — but not in the way assumed.
  "Odesláno" and "Dodáno" are not two events that coincide: they are **one ISDS field**
  (`dmDeliveryTime`) rendered under two labels, because ISDS reports no separate submission time at
  all. Printing it twice implied the app knew two moments. Collapsed into `Odesláno a dodáno` with a
  note saying ISDS gives a single time — and NOT collapsed while the message is still on its way,
  where the two rows are a genuine progression. Shares `mergeSameTimeHead` with nothing else yet, but
  the rule ("never print the same timestamp twice") is the same one the Doručenka enforces.

## Follow-up (recorded and closed 2026-09-14)

- [x] T012 Honour the spec's unrecognised-state edge case: `deliveryRecord` computed
  `served = state >= MESSAGE_STATE.servedByFiction`, so a state outside 1–10 (e.g. 99) with both
  timestamps was drawn as delivered + accepted (or merged) steps. Bound the builder to the received
  states and add a test for state 99 with both timestamps present.
  **Done 2026-09-14.** `src/features/messages/state/deliveryRecord.ts` now reads service off the
  state only for a whole-number state from 4 (delivered) to 10 (in the vault). Anything else degrades
  to arrival alone. That covers 99, 11, 0, negatives, NaN, Infinity, fractions and the sender-only
  1–3: no service step, no merged row, no fiction header, no read note and no annotations. The
  arrival step stays when the delivery time is usable, because it comes from `dmDeliveryTime` and
  never from the state. With no usable delivery time the record is empty and the card draws nothing.
  Inside the range, *served* now comes from 013's `messageStateKind` instead of `state >= 5`. That
  also stops 8 (undeliverable) being drawn as served: it keeps only the arrival step, which matches
  the sent rail. A recipient never receives state 8, so this is defensive. States 4, 5, 6, 7, 9 and
  10 draw the same steps as before.
  A first version of this fix hid the whole card for any unrecognised state. It was replaced the same
  day. The edge case asks only that the state is not forced onto the rail, and state 0 is not
  hypothetical: both message stores save it for a received detail cached before any list row
  (`cacheDetail` in `src/services/db/messagesStore.ts`), and a restored backup row without a state
  becomes 0 (`src/services/backup/stores.ts`). Those are real received messages, and the detail
  screen shows their delivery time nowhere but this card.
  Evidence:
  - `__tests__/messages/deliveryRecord.test.ts`:
    - *does NOT force an unrecognised state onto the rail, even with both timestamps (017 T012)*
    - *does not merge an unrecognised state either, when the two times coincide*
    - *does not fall back to the acceptance time when an unrecognised state has no arrival*
    - *draws no service step for %s* (11, 1000, Infinity, 5.5, 6.5)
    - *never draws an undeliverable message (8) as served*
    - *keeps the arrival for %s* (0, −1, NaN, 1, 3)
    - *keeps every state a recipient can actually see on the rail* (guards 4–7, 9, 10)
  - `__tests__/messages/deliveryRecordCard.test.tsx`:
    - *shows only the arrival for an unrecognised state carrying both timestamps* (cs and en)
    - *draws no card when an unrecognised state has no arrival time to show*
    - *keeps the card for a received message the store saved without a list row (state 0)*
    - *draws the full card for a served message - so the cases above cannot pass vacuously*

  Against the builder before T012, 12 of these fail: the 99, merge, missing-arrival, service-step and
  state-8 cases, and the card's arrival-only (cs and en) and no-card cases. Against the first
  version, 15 fail, including all five *keeps the arrival* cases and the state-0 card. The two
  guards, *keeps every state a recipient can actually see on the rail* and the served-card check,
  pass on both by design. No device walk yet: an out-of-range state cannot be produced from a real
  box, so the unit and render tests are the evidence.
