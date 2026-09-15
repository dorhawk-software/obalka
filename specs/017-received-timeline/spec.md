# Feature Specification: The received delivery record (Doručenka)

**Feature Branch**: `017-received-timeline`
**Created**: 2026-08-17
**Design**: returned 2026-08-17 — [design-system.md](./design-system.md)
**Status**: Implemented and walked on a device 2026-08-17; the unrecognised-state edge case closed 2026-09-14 (tasks T012). 12/12. The spec was written after the design, deliberately (see below).
**Input**: User description: "On received messages, i do not like that Dodano, Doruceno,... is just a
text in the sender box, it should also be some timeline, just like for sent messages"

## Why

A **sent** message gets a delivery rail: a glyph per step, timestamps, notes, and the journey stopping
outright when something failed. A **received** message gets the same journey compressed into one line
of grey caption inside the sender card — *"Dodáno 12.06.2026 14:58 · Doručeno 12.06.2026 14:58"* — in
the same muted grey as the box ID beneath it.

The half of the app that carries **legal deadlines** has the weaker presentation. Every deadline a
user of this app cares about runs from the moment in that grey line.

**The spec follows the design here, not the other way round.** The prompt asked for "the timeline the
sent side has"; the design declined that framing and returned something better named and better
shaped — a *Doručenka*, the Czech legal term for a proof-of-delivery record. Writing requirements
first would have locked in the worse idea.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read the delivery record of a message I received (Priority: P1)

Someone opening a received message sees a titled record of how it reached them — what happened, when,
and (where it matters) why — instead of a grey line under the sender's name.

**Why this priority**: it is the whole feature. Everything else is a refinement of this block.

**Independent Test**: open any received message in the archive, offline, and read the record.

**Acceptance Scenarios**:

1. **Given** a received message delivered and served at different times, **When** its detail is
   opened, **Then** the record shows both steps, each with its own timestamp.
2. **Given** a message whose delivery and service render as the same time, **When** the record is
   shown, **Then** it shows **one** merged step, with a note explaining that the box was signed in
   when the message arrived — never the same timestamp printed twice.
3. **Given** a message served by fiction, **When** the record is shown, **Then** the header says so,
   the step is visibly distinct from ordinary service, and a note states that nobody signed in for
   ten days.
4. **Given** the device is offline, **When** the detail is opened, **Then** the record renders from
   the local archive with no ISDS call.

---

### User Story 2 - Understand what "read" does and does not mean (Priority: P2)

Someone who has opened a message sees that the app knows it was opened, that this has no legal
weight, and that ISDS never says when.

**Why this priority**: it removes a real misconception — that opening a message is what "delivers" it
— at the exact moment the user is looking for the delivery facts. Second only because a message can
be understood without it.

**Acceptance Scenarios**:

1. **Given** a message in state 7 (read), **When** the record is shown, **Then** "read" appears as a
   footnote, **not** as a step on the rail, and says both that it carries no legal significance and
   that no time is available.
2. **Given** a message not yet read, **When** the record is shown, **Then** no such footnote appears.

---

### User Story 3 - See what became of the message afterwards (Priority: P3)

Someone opening an old message sees that ISDS erased its content, or that it is kept in the vault.

**Why this priority**: true and useful, but about storage rather than delivery — and it is the part
most easily mistaken for a delivery step, which is why the design puts it off the rail.

**Acceptance Scenarios**:

1. **Given** a message in state 9 (content erased) or 10 (in the vault), **When** the record is
   shown, **Then** it appears as an annotation below the steps, not as a step.

---

### Edge Cases

- **Delivered but not yet served** (`acceptanceTime` absent). The record shows what happened and does
  not invent, imply or grey-in a step that has not occurred. 013's rule stands: a greyed step reads
  as "still coming".
- **A missing or garbled timestamp** — the record still renders (Principle II).
- **Both timestamps present but a second apart.** They render identically at minute granularity; see
  FR-003 for why that merges.
- **1.5× font scale**, long labels, dark mode.
- **A message whose state the app does not recognise.** It must not be forced onto the rail.
  *Met 2026-09-14 (tasks T012).* Service is read off the state only for a whole-number state from 4
  to 10. Anything else (99, 11, 0, a non-number, a fraction, the sender-only 1–3) draws no service
  step, no merged row and no fiction header, even when both timestamps are present. The arrival step
  stays when its time is usable: it comes from ISDS's own delivery time, never from the state, and
  hiding it would take the delivery facts off real messages, because the stores save state 0 for a
  received detail cached before any list row. With no usable arrival time either, the record is
  empty and no card is drawn. Within the range, *served* comes from 013's state model, so 8
  (undeliverable) is never drawn as served. Until that date the builder treated any state ≥ 5 as
  served, and the only garbage test asserted that nothing threw.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A received message's detail MUST present its delivery facts as a titled record, not as
  a caption inside the sender block.
- **FR-002**: The record MUST name what it is, and MUST distinguish service by fiction from ordinary
  service in that title.
- **FR-003**: Where delivery and service **render as the same time**, the record MUST show a single
  merged step with an explanatory note. The merge MUST be keyed to what the user actually sees: if
  the two rendered timestamps are identical, printing both is showing the same fact twice; if they
  differ at all, both MUST be shown separately.
- **FR-004**: "Read" MUST NOT appear as a step. Where the message is read, it MUST appear as a
  subordinate note that states (a) that it has no legal significance and (b) that no time is
  available — the absence being ISDS's, not the app's.
- **FR-005**: Post-delivery states (content erased, kept in the vault) MUST appear as annotations,
  visually separated from the delivery steps.
- **FR-006**: The record MUST NOT imply a step that has not happened, and MUST NOT render a step with
  a borrowed or invented timestamp.
- **FR-007**: Rendering MUST require no ISDS call — everything comes from the local archive
  (feature 014's boundary).
- **FR-008**: Crash-resilient (Principle II): a missing or nonsensical timestamp degrades the record,
  never the screen.
- **FR-009**: cs + en, Czech first.
- **FR-010**: Light + dark, WCAG AA, no layout jump, holds at 1.5× font scale.

### Key Entities

- **Delivery record**: the titled block — an outcome in its header, an ordered list of steps, an
  optional read note, and optional post-delivery annotations.
- **Step**: a label, a time, an optional note, and a kind that selects its glyph.

## Success Criteria *(mandatory)*

- **SC-001**: A user can answer "when was this delivered to me, when was it served, and how?" from
  the detail screen without scrolling to another surface or opening the FAQ.
- **SC-002**: **Zero** received messages render the same timestamp twice.
- **SC-003**: "Read" is never presented as part of the legal journey.
- **SC-004**: Zero ISDS calls attributable to this block; the record renders offline.
- **SC-005**: Correct in light and dark at 1.0× and 1.5×, with no clipping and no layout shift.

## Assumptions

- **The design is the source of truth** for structure, wording and tone; this spec fixes the rules the
  port must not break.
- **The merge rule is the port's decision**, because the design's own logic sits past the size cap on
  reading its file. Keying it to the rendered string is chosen deliberately: the defect being fixed is
  *printing the same thing twice*, so the test for it is *would we print the same thing twice*.
- **Scope is the received detail.** The sent rail is untouched.

## Non-goals

- Changing the sent timeline.
- Any new ISDS field or call.
- Explaining fiction in general — the FAQ already does that.
