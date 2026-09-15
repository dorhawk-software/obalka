# Feature Specification: Show the box's PDZ credit

**Feature Branch**: `020-pdz-credit`
**Created**: 2026-08-17
**Status**: Implemented and walked on a device 2026-08-17 (11/11).
**Input**: User: *"display current credits for a box, eg there should be some credits for the Fyzická
osoba production box, because I bought some"*

## Why

A commercial message (PDZ) is charged to the sending box's credit. The app already tells you a
message will cost about 10 Kč — and never tells you whether you can afford it. The first time that
matters is the moment the send fails: **"Nedostatek kreditu pro odeslání."**, after the recipient,
subject, body and attachments have all been written.

The balance is **already fetched and already stored**: `DataBoxCreditInfo` runs on every launch
refresh and lands in `accounts.pdzCreditCzk` (migration 9). Nothing displays it. Like 015's address,
this is a presentation gap, not a data one — no new ISDS call, no new permission, no migration.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Know the cost is affordable before writing the message (Priority: P1)

Someone composing a paid message sees, next to the price, what the box has — and is told plainly if
it is not enough, while there is still time to do something about it.

**Why this priority**: it is the moment the number changes a decision. Everywhere else it is trivia.

**Acceptance Scenarios**:

1. **Given** a paid (PDZ) message is being composed, **When** the cost card is shown, **Then** it
   shows the sending box's balance beside the price.
2. **Given** the balance is lower than the price, **Then** the card says the credit will not cover it
   — before the message is written, not after the send fails.
3. **Given** the message is free (an OVM recipient), **Then** no balance is shown; it is irrelevant.
4. **Given** the balance is unknown, **Then** the card shows **no** balance rather than a zero.

---

### User Story 2 - Compare boxes at a glance (Priority: P2)

Someone with several boxes sees each one's credit in the box switcher, where they choose which box to
send from.

**Acceptance Scenarios**:

1. **Given** several boxes, **When** the switcher is opened, **Then** each box with a known balance
   shows it.
2. **Given** a box whose balance is unknown, **Then** its row shows no balance and no placeholder.

---

### Edge Cases

- **The balance is unknown** (never refreshed, refresh failed, ISDS declined). Nothing is shown. The
  app must not print `0 Kč` for "we do not know" — that is a false statement about the user's money.
- **The balance is stale.** It is only as fresh as the last successful refresh; buying credit or
  sending elsewhere changes it without the app knowing.
- **Zero credit** is a real, knowable value and must be shown as `0 Kč` — distinct from unknown.
- **The estimate is approximate.** The app already says *"Cena je přibližná"*; a comparison against
  it therefore cannot be stated as certainty.

## Requirements *(mandatory)*

- **FR-001**: Where a message is paid, the compose cost card MUST show the sending box's known
  balance alongside the price.
- **FR-002**: Where the known balance is below the estimated price, the app MUST say so before the
  message is sent.
- **FR-003**: An unknown balance MUST render as nothing at all — never as `0 Kč`, never as a dash
  that could read as zero.
- **FR-004**: A balance of zero MUST be shown as zero. Unknown and empty are different facts.
- **FR-005**: The box switcher MUST show each box's known balance.
- **FR-006**: Displaying the balance MUST NOT weaken the estimate's own hedge: the comparison is
  between an approximate price and a possibly-stale balance, and MUST NOT be phrased as a guarantee
  that a send will or will not succeed.
- **FR-007** *(amended 2026-08-17)*: The balance MUST be refreshed when a paid recipient is picked on
  compose (not on every compose-open, since an OVM message is free; a user-initiated action, so within
  014's boundary), and a failed refresh MUST leave the last known value rather than blanking it.
  *This first read "refreshed when compose opens"; tasks T005 narrowed it.*
- **FR-008**: cs + en, Czech first. Amounts formatted for the locale.

## Success Criteria *(mandatory)*

- **SC-001**: A user can tell whether a paid message is affordable **before** writing it.
- **SC-002**: **Zero** cases where an unknown balance is rendered as a number.
- **SC-003**: No new ISDS call beyond the one the compose screen already triggers.

## Assumptions

- **The switcher shows the balance; it does not explain it.** Anyone who has never sent a paid
  message does not need a lesson in PDZ pricing in a box list.
- **No "top up" action.** Credit is bought in the ISDS portal; an in-app button would be a promise
  the app cannot keep.

## Non-goals

- Buying credit, or linking out to buy it.
- A spend history or per-message accounting.
- Predicting the exact price — ISDS's own figure is approximate and stays that way.
