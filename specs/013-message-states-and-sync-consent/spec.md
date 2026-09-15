# Feature Specification: Message states & background-sync consent

**Feature Branch**: `013-message-states-and-sync-consent`
**Created**: 2026-08-16
**Status**: **Implemented 2026-07-26 — this spec is RETROSPECTIVE. Partly superseded by 014.**
**Input**: User description: "I would like to extend support for all various states based on the
discussion. Also… for sent messages [background sync] would run without a problem always… for received
messages, we should explicitly inform the user if they want THIS kind of background sync… these seem
like design changes, so you should only craft a detailed prompt for claude design"

> **Written after the code, not before it.** 013 ran design-first — hand-off → Claude Design → diff →
> port — and `design-prompts.md` says so explicitly: *"No spec.md/plan.md — this hand-off was
> deliberately front-run so the design work could overlap the spec work, the way 012 Phase D did."* The
> overlap happened; the catch-up did not, until now.
>
> **Read the superseding note below before trusting any sync requirement here.** Feature 014 removed
> background sync entirely, and with it roughly a third of what this spec describes.

## Problem / Why

Two defects, one research pass. A reading of the ISDS Provozní řád and the operator's developer
bulletins (`docs/isds-ws-news/`) surfaced both.

**1. The app modelled 3 delivery states where ISDS has 10 — and two of the missing ones are failures
the app was reporting as success or as permanent limbo.**

`sentStatus.ts` collapsed `dmMessageStatus` 1–3 into *Odesláno* and 5–10 into *Doručeno*. Consequences,
both live in the shipped app:

- **State 8 (`nedoručitelná`, undeliverable)** — the recipient's box was invalidated and the message
  will never arrive — was displayed as **Doručeno**. The app told users a message had been legally
  served when it had not been delivered at all. This is the worst class of error the app can make: it
  is wrong about a legal fact, in the reassuring direction.
- **State 3 (`neprošla antivirovou kontrolou`)** — the message failed the virus check and was never
  delivered to anyone — sat on **Odesláno** forever, indistinguishable from a message still in transit.
- A code comment had **5 and 6 swapped** (5 is *doručena fikcí*, 6 is *doručena přihlášením*; source:
  `docs/isds-ws-news/2179_Info_pro_vyvojare_2020_9.md` §3.2).

**2. One background-sync setting did two incomparable things.**

A single `syncInterval` drove both folder polls. Polling the **sent** list reads the user's own outbox
and serves nothing to anybody. Polling the **received** list is, under §17(3) of Act 300/2008, *signing
in to the data box*: it legally serves every message waiting there, starts every deadline, and drops
ISDS retention from at least three years to 90 days. Presenting these as one preference — defaulted to
hourly — meant the app performed an ongoing legal act on the user's behalf that they had never been
told about.

A third finding fell out of the same pass: **the fikce countdown could almost never fire where it was
built.** 009 put it on received messages, but listing the inbox is what moves a message out of state 4,
so by the time the list renders the countdown is already over.

## Clarifications

### Session 2026-07-26

- Q: How many visual treatments for ten states? → A: **Five.** Several states differ only in ways a
  user cannot act on. 1–2 → `sent`; 4 → `delivered`; 5 → `fiction`; 6, 7 (+9, 10 as annotations) →
  `accepted`; 3 and 8 → `stop`, sharing one treatment because the user's next move is identical for
  both: send it another way.
- Q: Should the sent list show a chip for every state? → A: **No.** A chip appears only when the news
  is not what you would assume from a message you sent — fiction or a terminal failure. Ordinary
  progress is carried by the row's glyph alone, so the common row keeps its two-line height.
- Q: Two toggles for the two sync sides? → A: **No — deliberately asymmetric.** Delivery receipts get a
  plain toggle; received-side sync gets a navigating row showing its current value, behind a consent
  screen. Two toggles side by side would imply the choices are comparable.
- Q: Where does the fikce countdown belong? → A: **The sent side**, where it is genuinely still running.
  The received side gets a notice about a message *already* served by fiction instead.

## User Scenarios & Testing

### User Story 1 — I can tell a failure from a success (Priority: P1)

A user who sent a message that failed the antivirus check, or went to an invalidated box, sees that it
failed and what to do instead — rather than seeing "Doručeno" or a message stuck on "Odesláno".

**Why this priority**: It corrects a false statement about a legal fact that was live in the app.

**Independent Test**: `messageStatus()` over all ten `dmMessageStatus` values; the detail timeline for a
state-3 and a state-8 message.

**Acceptance Scenarios**:

1. **Given** a sent message in state 8, **When** the user opens it, **Then** it reads *Nedoručitelné*
   with an inverted treatment, and the timeline stops rather than showing remaining steps as pending.
2. **Given** a sent message in state 3, **When** the user opens it, **Then** it explains the message
   failed the virus check and was never delivered to anyone.
3. **Given** any `dmMessageStatus` outside 1–10, **When** it is classified, **Then** it degrades to
   "in transit" — never to a legally significant outcome.

---

### User Story 2 — I know when the app is serving my mail (Priority: P1)

A user is told, before it happens, that letting the app check for new messages in the background will
legally deliver them — and can decline without losing the app.

**Why this priority**: Equal-first. The app was performing this act by default.

**Independent Test**: The consent screen in both states; the settings row showing its current value.

**Acceptance Scenarios**:

1. **Given** a fresh install, **When** the user reaches settings, **Then** received-side sync is **off**.
2. **Given** an install upgrading from `syncInterval: hourly`, **When** settings load, **Then**
   received-side sync is **off** and the cadence is preserved.
3. **Given** the consent screen, **When** the user reads it, **Then** four numbered facts state what
   turning it on does, with an equal-weight decline.

> **Superseded by 014.** This story no longer exists in the app: the answer to "may an app do this at
> all" turned out to be no, so consent was the wrong mechanism. See the note below.

---

### User Story 3 — I can see how long the recipient has (Priority: P2)

A user who sent a message sees, on that message, how long remains before it is served by fiction.

**Why this priority**: Genuinely useful and previously unreachable — the countdown existed but was
built on the side where it cannot fire.

**Acceptance Scenarios**:

1. **Given** a sent message in state 4, **When** the user views the list, **Then** it shows
   *Adresát dosud nepřevzal · fikce za N dní*.
2. **Given** a message served by fiction (state 5), **When** the user opens it, **Then** it says so and
   gives the date — no countdown, because there is nothing left to count.

### Edge Cases

- **States we can never see from the sender's side.** Since 2019 ISDS stops reporting state 7 (*read*)
  to senders (bulletin 2184), so 6 is terminal for us and nothing may imply a read receipt is coming.
- **States 9 and 10** (content erased, in the vault) are annotations on a finished journey, not states
  of their own.
- **A garbled envelope.** Out-of-range values degrade to `sent`.

## Requirements

### Functional Requirements

- **FR-001**: All ten `dmMessageStatus` values MUST map to exactly one of five treatments, with 3 and 8
  distinguished from every success state.
- **FR-002**: The list row and the detail MUST derive their state from one shared function, so the two
  can never disagree.
- **FR-003**: A terminal failure MUST drop the remaining timeline steps rather than greying them out —
  a greyed step reads as "still coming".
- **FR-004**: A sent list row MUST show a text chip only for fiction or a terminal failure.
- **FR-005**: The fikce countdown MUST appear on sent messages in state 4, and a served-by-fiction
  notice on state 5.
- **FR-006**: No timestamp may be fabricated. States without a time from ISDS show none. *(009's
  standing rule.)*
- ~~**FR-007**: Background sync MUST be two settings — sent-side default on, received-side default off
  behind a consent screen.~~ **Removed by 014.**
- ~~**FR-008**: The `syncInterval` key MUST NOT be migrated into `syncReceived`.~~ **Moot after 014** —
  neither key is read any more, and the row is left in place unread.
- ~~**FR-009**: A delivery-receipt notification MUST fire when a sent message reaches a terminal
  outcome.~~ **Removed by 014.**
- **FR-010**: Notification switches MUST actually gate what they claim to gate. *(Added during the
  014 follow-up, when they were found to be stored and never read. Moot once notifications went.)*

### Key Entities

- **`MessageStateKind`** — the five treatments: `sent`, `delivered`, `accepted`, `fiction`, `stop`.
- **`MessageStatus`** — kind, label key, chip tone, terminal flag, optional annotation.
- **`MessageAnnotation`** — `erased` (9) or `vault` (10).
- ~~**`SyncCadence`**, **`NotifChannels`**~~ — removed by 014.

## Success Criteria

- **SC-001**: No `dmMessageStatus` value produces a label contradicting its legal meaning. *(Met.)*
- **SC-002**: The fikce countdown is visible on a real message for the first time. *(Met — verified on
  a live czebox message: `Adresát dosud nepřevzal · fikce za 1 den`, delivered 16.07 19:34.)*
- **SC-003**: An upgrading install lands on received-sync **off** with its cadence preserved. *(Met on
  device — then made moot by 014.)*
- **SC-004**: The five treatments are distinguishable in dark mode, including the inverted `stop`.
  *(Met.)*

## Assumptions

- `dmMessageStatus` is documented as 1–10 and the asymmetry holds: as sender we see 1–6 and 8–10, never
  7; as recipient 4–7 and 9–10, never 1–3 or 8.
- Bulletin 2179 defines states 5 and 6; bulletin 2184's contradicting text is a typo.
- ~~The fikce deadline is approximated as `delivery + 10 × 24 h`.~~ **Resolved 2026-08-16** by reading
  §17(4) directly: the period is counted in CALENDAR DAYS and service falls on the last day of it.
  The flat arithmetic was off by one for most of the final day. See `fikce.ts` and 013's tasks T015.

## What 014 later removed

Roughly a third of this spec no longer describes the app. Recorded here so a reader does not go looking
for screens that were deleted three weeks after they shipped:

| 013 built | Fate |
|---|---|
| Ten-state model, five treatments, `messageState.ts` | **Survives** — the core of the feature |
| Timeline with failure branches, stop reasons, annotations | **Survives** |
| Sent-side fikce countdown + served-by-fiction notice | **Survives** |
| `showsListChip` rule | **Survives** |
| Split background sync (`syncSent` / `syncReceived`) | Removed by 014 |
| `SyncReceivedScreen` consent screen | Removed by 014 |
| Delivery-receipt notifications, three channels, `NotificationsScreen` | Removed by 014 |
| `SyncCadence` picker | Removed by 014 |

The reason is in [`014-no-background-sync/spec.md`](../014-no-background-sync/spec.md): the Provozní řád
of 26 June 2026 — which the team did not hold when 013 was designed — requires locally-installed
applications to sign in only on a manual user command. Consent was the wrong mechanism because the
capability was never the user's to grant. 013 asked the right question and got the best answer available
from the sources it had.
