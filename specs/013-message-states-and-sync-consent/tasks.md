# Tasks: Message states & background-sync consent

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

> **Retrospective.** Reconstructed from `713ac0a` (the feature), `437c8f5` (the on-device fixes) and
> the merge `59fd19d`, three weeks after the fact. Marked `[x]` because the work shipped on 2026-07-26,
> not because it was worked through in this order. Tasks struck through were later **removed by 014**;
> they are kept rather than deleted so the history stays legible.

## Phase 1 — Hand-off

- [x] **T001** Research pass over the Provozní řád + `docs/isds-ws-news/` bulletins; establish the ten
      `dmMessageStatus` values and which are reachable from which side.
- [x] **T002** Write `design-prompts.md` — §0 shared context through §6 — and send it to Claude Design.
      (Per the standing rule: screens are designed, not invented in code.)
- [x] **T003** Pull the returned `.dc.html`, diff it (+17 023 chars, 24 hunks), and record the
      DesignSync 256 KiB truncation caveat.

## Phase 2 — The state model

- [x] **T004** Add `src/features/messages/state/messageState.ts`: `MESSAGE_STATE` (1–10),
      `MessageStateKind` (five treatments), `messageStatus()`, `stopReasonKey()`, `showsListChip()`.
      Delete `sentStatus.ts`. (FR-001, FR-002)
- [x] **T005** Fix the two shipped bugs this exposes: state 8 reported as *delivered*, state 3 stuck on
      *Odesláno*. Fix the swapped 5/6 comment, citing bulletin 2179 §3.2. (FR-001)
- [x] **T006** Guard out-of-range `dmMessageStatus` to `sent` rather than to a legally significant
      outcome. (D3)
- [x] **T007** Add `statusFiction` (gold) and `statusStop` (inverted, derived from theme tokens) to
      `chipTone.ts`; add `StatusStopIcon`, `ContentErasedIcon`, `VaultIcon` to `icons.tsx`. (D2)
- [x] **T008** `__tests__/messages/messageState.test.ts` — all ten values, the 5-vs-6 distinction, the
      terminal pair, annotations, the chip rule, and the garbled-envelope degradation.

## Phase 3 — Timeline & list

- [x] **T009** Rebuild the sent-message timeline in `MessageDetail`: failure branches that **drop** the
      remaining steps, a `stopWhy` explanation, and 9/10 as footnote annotations. (FR-003)
- [x] **T010** Apply `showsListChip` in `MessageList` — a chip only for fiction or stop. (FR-004)
- [x] **T011** Update `DeliveryStateIcon` for the five treatments, including the inverted stop disc.
- [x] **T012** Add the five-glyph legend to the FAQ's `deliveredVsServed` answer, drawn from the same
      icon component so it cannot go stale.
- [x] **T013** No fabricated timestamps — the stop step shows an em-dash, annotations show no date.
      (FR-006, divergence 1)

## Phase 4 — Fikce countdown relocation

- [x] **T014** Rewrite `fikce.ts`: replace `computeFikce` with `sentFictionCountdown` (state 4 only) and
      `servedByFiction` (state 5 only, returning the acceptance epoch). (FR-005)
- [x] **T015** Keep the arithmetic a flat `delivery + 10 × 24 h` **deliberately**, pending a primary
      source. Encoding an unverified refinement into a legally significant countdown would be worse than
      an honest approximation. *(**Resolved 2026-08-16** — §17(4) read directly; now counted in calendar
      days. The approximation turned out to be off by one for most of the final day.)*
- [x] **T016** Rewrite `__tests__/messages/fikce.test.ts` for the new shape.

## Phase 5 — Sync split & consent *(all later removed by 014)*

- [x] ~~**T017** Split `runBackgroundSync` into a sent pass and a received pass; put the `received`
      guard around `listReceived` itself, not around its notification.~~ (D4)
- [x] ~~**T018** Add `receiptChanges()` reporting only NEW terminal outcomes, so a receipt is never
      announced twice.~~
- [x] ~~**T019** Replace `SyncInterval` with `SyncCadence` + `syncSent` / `syncReceived` /
      `notifChannels` in `SettingsProvider`; do not migrate `syncInterval` into `syncReceived`.~~ (D5)
- [x] ~~**T020** Build `SyncReceivedScreen` — four numbered facts, equal-weight decline, a "why there is
      no other way" counterweight.~~
- [x] ~~**T021** Build `NotificationsScreen` — three channels with a locked/unlocked preview.~~
- [x] ~~**T022** Add the delivery-receipt notification; route `stop` to the alerts channel.~~
- [x] ~~**T023** `applyBackgroundSync({sent, received, minutes})`; stop the task outright when both are
      off; re-read both switches on every headless run.~~

## Phase 6 — On-device pass (`437c8f5`)

- [x] **T024** The locked notification preview drew a literal em-dash from a `color: 'transparent'`
      placeholder — visible, and read aloud by the screen reader. Replaced with an empty fixed slot.
- [x] **T025** At 1.5× font scale the consent screen's decline button ellipsized to *"Nechat vypn…"*.
      Added a stacking breakpoint above ~1.3×.
- [x] **T026** Every `Toggle` was unlabelled to a screen reader. Made `label` a required prop — this
      also fixed the pre-existing app-lock toggle.

## Phase 7 — Record

- [x] **T027** Write `port-notes.md`: what the design chose, the six divergences, verification owed.
- [x] **T028** Update `specs/README.md`.
- [x] **T029** Write this spec, plan and task list *(2026-08-16, three weeks late)*.

## Left open by this feature

- ~~**The fikce day-counting rule** (T015).~~ Closed 2026-08-16 — §17(4) of the Act settles the
  counting; the working-day question is argued in `fikce.ts` and deliberately not applied.
- **The "manual user command" question**, listed here as owed and answered on 2026-08-14. The answer
  removed Phase 5 entirely — see [`014`](../014-no-background-sync/spec.md).
