# Tasks: Show the box's PDZ credit

**Feature**: `020-pdz-credit` | **Spec**: [spec.md](./spec.md)

No plan.md: the data was already fetched and already stored, so the whole feature is presentation
plus one targeted refresh. The design decisions that mattered are in the spec's requirements.

## Phase 1: The rule

- [x] T001 [P] `__tests__/messages/credit.test.ts` — unknown ≠ zero, a genuine zero is shown, a
  shortfall is flagged, no judgement without a price, never throws.
- [x] T002 `src/features/messages/state/credit.ts` — `formatCzk` (whole koruny, Czech non-breaking
  spaces) and `creditState(balance, price)` → `unknown | ok | short`.

## Phase 2: US1 — the compose cost card (P1)

- [x] T003 Strings (cs + en): `send.credit.balance`, `send.credit.short`.
- [x] T004 Show the balance on the paid cost card; a shortfall in danger tone, phrased as a caution.
- [x] T005 Refresh the balance when a PAID recipient is picked (FR-007) — not on every compose-open,
  because an OVM message is free and an ISDS call nobody needs is what 014 removed. A failed fetch
  leaves the stored value alone.
- [x] T006 Test the refresh both ways: fires for a paid recipient, never for a free one.

## Phase 3: US2 — the box switcher (P2)

- [x] T007 Show each box's known balance in its switcher row.
- [x] T008 Test the three states in the switcher, including the negative: an unknown balance renders
  NOTHING.

## Phase 4: Verification

- [x] T009 Full gate.
- [x] T010 Device walk. **Both halves confirmed 2026-08-17.** The switcher shows `Zbývá 50 Kč` on the
  box that has credit and real zeros on the two that do not. Composing a paid message from a 0 Kč box
  shows *"Zbývá 0 Kč — na tuto zprávu to nemusí stačit."* in danger tone on an EMPTY compose screen —
  the exact failure this feature exists to prevent, which previously appeared only after the whole
  message had been written.
- [x] T011 Update `specs/README.md`.

## Not done, deliberately

- **Staleness is not surfaced.** The balance is refreshed when a paid recipient is picked, so the
  number on the cost card is fresh at the moment it matters. The switcher's figure is as fresh as the
  last box refresh (on launch, after adding a box, after re-authentication, or on a pull-to-refresh of
  the all-boxes list) or the last time a paid recipient was picked on compose, and it says so nowhere. Adding "as of …" there would cost more
  attention than it returns; revisit if a stale figure ever misleads someone.
