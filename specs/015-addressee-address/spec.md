# Feature Specification: Addressee address — who exactly am I writing to?

**Feature Branch**: `015-addressee-address`
**Created**: 2026-08-17
**Design**: commissioned from Claude Design and returned 2026-08-17 — see
[`design-prompts.md`](./design-prompts.md) § *What came back*.
**Status**: Implemented and walked on a device 2026-08-17 (16/16).
**Input**: User description: "when searching for addressees to send a message, the list must also include the persons address and then the address should also be displayed in the message detail (preferably for received messages too) — because when I was sending a message to [someone with a common name], there were so many matches and the only way how to distinguish and find the correct [person] was seeing their address, without the address i would never know who to send the message to"

## Why this is not a cosmetic issue

A data message is a **legal delivery**. Sent to the wrong namesake it cannot be recalled, it is
served on that person, and whatever it contained — a contract, a filing, personal data — has been
handed to a stranger. The send screen is therefore the one place in the app where an ambiguous
identity is a safety problem rather than a usability one.

The app already asks ISDS for the address and already stores it. Before 015 it never showed it:

* the recipient search folds the name and the address into one string and then renders that string on
  a single clipped line, so the **address is the part that gets cut**;
* received and sent messages carry the counterparty's address in the local archive, where nothing
  reads it.

**Measured on the czebox test register, 2026-08-17.** Searching `Novak` returns, among others, three
separate people all called **Jan Novak**, all `Fyzická osoba`, all badged `Placená` — identical on every
visible axis except the address. And the rows read:

```
Jan Novak · Nová 1/777, 60200 Br…        Fyzická osoba · ezfam3k
Jan Novak · Vaclavske namesti 1, …       Fyzická osoba · irci5we
Jan Novak · Ujezd 450, 11000 Pra…        Fyzická osoba · vsxiu3c
```

This is worse than "the address disappears", and worse in a specific way: it survives just long enough
to look like it is there, and is cut at **the least useful point**. Two of those three lose the town
entirely — the one word that would separate a Brno Jan Novak from a Prague one. The row also spends its
remaining width on a `Placená` cost badge, so the pixels the address needs are already committed.

The one distinguishing datum that *is* fully visible is the box ID (`ezfam3k`, `irci5we`, `vsxiu3c`) —
which distinguishes nothing to a human being choosing between three strangers with the same name.

And there is nothing else to fall back on. ISDS returns a date of birth (`dbBiDate`) **only when the
searching box is an OVM** (public authority), and an IČO only for subjects that have one. A private
individual searching for another private individual is given a name, a box ID, and an address —
which makes the address the only human-meaningful way to tell two namesakes apart.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pick the right person out of a list of namesakes (Priority: P1)

Someone composing a message searches for a recipient by name and gets many matches with the same or
similar names. Each result shows the addressee's address, so they can recognise the one they mean —
and after picking, the chosen recipient still shows that address, so a wrong pick is caught before
the message is sent rather than after.

**Why this priority**: this is the reported failure, and the only one with an irreversible
consequence. It is also the whole feature's justification: the other stories are about understanding
mail that has already arrived.

**Independent Test**: search for a common Czech surname on a czebox test box, confirm every result
that ISDS gives an address for displays it legibly, and confirm the picked recipient carries the
address forward to the send confirmation.

**Acceptance Scenarios**:

1. **Given** a recipient search returning several boxes with the same owner name, **When** the
   results are shown, **Then** each result displays that box's address on its own line, not merged
   into the name and not cut off.
2. **Given** a result whose address is long, **When** it is shown, **Then** the address remains
   readable (wrapping if needed) and the owner's name is still fully visible.
3. **Given** ISDS returns no address for a result, **When** it is shown, **Then** the row shows the
   name, the box identifiers and a subordinate "Adresa neuvedena" stating that ISDS returned no
   address — never an invented address. *(Amended 2026-08-17 with FR-004.)*
4. **Given** a recipient has been picked, **When** the compose screen shows who the message is going
   to, **Then** it shows the same address that identified them in the results.
5. **Given** two results share a name **and** an address, **When** they are shown, **Then** the box
   ID (already displayed) remains visible as the last resort distinguisher.

---

### User Story 2 - See where a received message actually came from (Priority: P2)

Someone opening a received message sees the sender's address next to the sender's name, so "Městský
úřad" or a namesake individual is identifiable without leaving the app.

**Why this priority**: real value, no risk — the message has already arrived and nothing can be sent
to the wrong party. It is also the cheapest story in the feature: the address is already in the
local archive, so it needs **no ISDS call at all** and works offline.

**Independent Test**: open any received message in the archive and confirm the sender's address is
displayed; confirm with the network off.

**Acceptance Scenarios**:

1. **Given** a received message whose sender address is stored, **When** its detail is opened,
   **Then** the sender's address is shown with the sender.
2. **Given** a received message stored before the app recorded addresses, **When** its detail is
   opened, **Then** the screen renders normally, shows "Adresa neuvedena" where the address would be,
   and no error. *(Amended 2026-08-17 with FR-004.)*
3. **Given** the device is offline, **When** a received message's detail is opened, **Then** the
   address is shown from the local archive.

---

### User Story 3 - Confirm where a sent message went (Priority: P3)

Someone opening a message they sent sees the recipient's address, confirming after the fact which of
the namesakes actually received it.

**Why this priority**: it closes the loop on US1 — the record of *who* was written to should not be
thinner than the search screen that chose them — but by then the message is delivered, so it changes
nothing that can still be acted on.

**Independent Test**: open a sent message on a czebox box and confirm the recipient's address appears
with the recipient's name.

**Acceptance Scenarios**:

1. **Given** a sent message whose recipient address is stored, **When** its detail is opened,
   **Then** the recipient's address is shown with the recipient.
2. **Given** a sent message with no stored recipient address, **When** its detail is opened,
   **Then** the screen renders normally, shows "Adresa neuvedena" where the address would be, and no
   error. *(Amended 2026-08-17 with FR-004.)*

---

### Edge Cases

- **ISDS returns no address.** The app states only that the record has none ("Adresa neuvedena",
  visually subordinate) and implies nothing about the addressee — the app does not know whether the
  person has an address; it knows only that ISDS did not say (FR-004 as amended).
- **Addresses stored as empty or whitespace.** Treated exactly as absent.
- **Rows written before the address was recorded.** The archive's address columns were added by a
  later migration, so older messages legitimately hold nothing. The detail must handle that as a
  normal state, not a defect.
- **A very long address**, or a large font scale (1.5×). The address must not push the name out of
  view, and the row must not scroll horizontally.
- **An address that does not disambiguate** — many namesakes in the same city. The app surfaces what
  ISDS has; the box ID stays visible for the case where nothing else separates two results.
- **Displaying a person's address is displaying personal data.** It is already public in the ISDS
  register and is shown by the official web portal, but it must not leak anywhere the name does not
  already go — notably not into notifications (which are deliberately redacted on the lock screen).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A recipient search result MUST present the addressee's **name and address as separate
  pieces of information**, not as one combined string.
- **FR-002**: A recipient search result MUST display the **entire** address whenever ISDS provides one.
  Truncating it is the defect this feature exists to remove: the row currently keeps just enough of it
  to look present while cutting the part that distinguishes one person from another. No ellipsis, no
  clipping, no reliance on the name being short.
- **FR-002a**: Where the address has discernible structure, it MUST be presented structurally (the
  street line, the post code and town, the country) rather than as one run-on line, and the **post
  code and town MUST carry the visual weight** — that is the half that separates two people of the
  same name, so it is the half the eye must land on. *(The weighting comes from the design; the spec
  had asked only that the whole thing be visible.)* The structure MUST
  come from the separators ISDS itself put in the string — a line break at a comma is presentation; it
  is not the app re-ordering, relabelling or re-interpreting an official address (FR-003). Where the
  string does not have that shape, the whole of it MUST still be shown, wrapped.
- **FR-003**: The address MUST be displayed **exactly as ISDS composed it**. The app MUST NOT
  re-order, re-format, abbreviate, translate or complete it, and MUST NOT derive an address from any
  other source. (Principle VI: the app does not restate official data in its own words.)
- **FR-004** *(amended 2026-08-17, after the design came back)*: Where no address is available, the
  app MUST NOT imply anything about the **addressee** — it must not suggest the person has no address,
  no fixed abode, or an address the app is withholding. It MAY state what the **record** contains:
  that ISDS returned no address ("Adresa neuvedena" / "No address given"), visually subordinate to a
  real address so it can never be mistaken for one.

  *This first read "MUST show nothing in its place — no placeholder, no 'address not given'". The
  design shipped exactly that placeholder, and it is right: in a row that otherwise carries a
  two-line address, a silently missing line reads as a loading failure. The distinction the original
  wording missed is between a claim about a person (forbidden — the app does not know) and a
  statement about the register's response (permitted — it is the only thing the app does know).*
- **FR-004a**: Where several results in the same search share an owner name, the app MUST say so —
  both on the affected results and once for the set. This describes the result set, never a person,
  so it asserts nothing ISDS did not return. *(Added from the design, which solved a problem the spec
  only implied: the user must first NOTICE the names are identical before thinking to compare
  addresses.)*
- **FR-005**: Once a recipient is chosen, the compose screen MUST continue to show the address that
  identified them, so the send confirmation identifies the same person the search did.
- **FR-006**: Any avatar, initials or other derived display MUST be derived from the **owner's name
  alone**, never from a name-plus-address string.
- **FR-007**: A received message's detail MUST display the sender's address when one is stored.
- **FR-008**: A sent message's detail MUST display the recipient's address when one is stored.
- **FR-009**: Displaying either MUST NOT require a network call — the archive already holds them, and
  opening a message MUST NOT gain a new reason to contact ISDS. (Feature 014's boundary: the app
  makes no ISDS call the user did not ask for.)
- **FR-010** *(amended 2026-08-17 with FR-004)*: A message stored without an address MUST render
  normally, with the no-address statement in place of the address (Principle II — a missing field is
  never an error state).
- **FR-011**: Every new string MUST exist in Czech and English, Czech first.
- **FR-012**: The address MUST NOT appear in any notification, on the lock screen, or anywhere else
  the message subject is deliberately withheld.

### Key Entities

- **Addressee (search result)**: a data box found by searching — its owner name, its address as ISDS
  composed it, its box ID, its box type, and whether it accepts a paid message. The name and the
  address are distinct attributes of it (before 015 they were one combined `label`).
- **Message counterparty**: for a received message the sender, for a sent message the recipient —
  each with a name and an address recorded when the message entered the archive.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a search returning multiple same-name addressees, a user can identify the intended
  one **from the results list alone**, without opening anything, searching again, or consulting the
  ISDS web portal.
- **SC-002**: **100%** of search results for which ISDS returns an address display **every character**
  of it. Zero ellipses in an address, at any supported font scale or screen width. Before 015, in a
  search returning three same-named people, **all three** addresses were cut and two lost the town.
- **SC-003**: The address is readable at both 1.0× and 1.5× system font scale with no horizontal
  scrolling and with the owner's name still visible.
- **SC-004**: Every archived message that has a stored counterparty address shows it, with **zero
  additional ISDS calls** — verifiable by opening messages with the network switched off.
- **SC-005** *(amended 2026-08-17 with FR-004)*: A message opened without a stored address renders
  with no error; its address slot shows only the no-address statement.

## Assumptions

- **Scope is the two screens named**: the recipient search (and the picked-recipient confirmation on
  compose) and the message detail. **The inbox/sent list rows are out of scope** — the user asked for
  the detail, and a list row is a scanning surface where a second line of address for every message
  would cost more than it gives.
- **The address shown is `dbAddress` from the recipient search and the stored sender/recipient
  address for messages.** These are different sources for different screens, which is expected: one
  describes a box in the register, the other describes a party to a specific message as recorded at
  the time it was sent.
- **Searching *by* address is not part of this feature.** ISDS supports it (`searchType=ADDRESS`), and
  it is a plausible follow-up, but the reported problem is reading the results, not querying them.
- **Showing IČO / OVM identifiers is not part of this feature.** They are available for the subjects
  that have them and would help disambiguate organisations — but the reported case is two private
  individuals, who have neither.
- **Pagination of a large result set is unchanged.** "So many matches" is addressed here by making
  each match identifiable, not by returning fewer of them.
- **No new ISDS call and no new permission. One new stored value:** `drafts.recipientAddress`
  (migration v12), so a resumed draft keeps the address the search returned instead of showing
  "Adresa neuvedena". Everything else this feature displays is already fetched and already stored; the
  work is modelling and presentation.

## Non-goals

- Composing or normalising addresses from parts.
- Any address lookup, validation, geocoding or map display.
- Changing which boxes a search returns, or their order.
- Adding the address to notifications, list rows, or exported/printed output.
