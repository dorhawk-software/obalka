# Feature Specification: Inbox-first navigation & box switcher

**Feature Branch**: `011-inbox-first-navigation`
**Created**: 2026-06-30
**Status**: Implemented (25/25). Amended 2026-09-14 for later changes (FR-002, FR-005, FR-007,
FR-009). Scaffolded 2026-06-30 and surfaced from the 009 redesign:
the design's box-switcher **bottom sheet** implies an inbox-first information architecture. The 009
visual port shipped every screen in the **current** IA and **deferred** this routing change (see
`specs/009-visual-redesign/spec.md` Out-of-scope + `research.md` D5).
**Input**: The imported design (`Obalka Redesign.dc.html`) opens directly into a box's inbox and switches
boxes via a sheet — not the app's current box-list-home model. This spec captures that IA change as a
deliberate, separately-verified piece (it rewires navigation, distinct from the 009 re-skin).

## Problem / Why

Today the app is **box-list-first**: it opens to a home that lists the data boxes (`BoxList`), and a box's
messages are a **pushed** screen (`MessageList`) with a back chevron. Switching boxes means backing out
to the list and tapping another. Add-box / Settings live in a left slide-in drawer (`AppDrawer`).

The redesign is **inbox-first**: the app opens straight into the **active box's inbox** (the message list
*is* the home), and a **box-switcher button** in the header opens a **bottom sheet** to switch boxes,
add a box, or open settings — without leaving the inbox. This is faster for the common case (one primary
box, read mail immediately) and matches the design. It also resolves why the 009 per-box inbox kept a
back chevron instead of the app wordmark + search: those belong to the inbox-as-home.

## Clarifications

### Session 2026-06-30
- Q: What happens to the all-boxes overview (today's `BoxList` home)? → A: **Retire it** — the box-switcher bottom sheet (with per-box unread badges) is the **only** multi-box surface; no separate dashboard.
- Q: Which box opens on launch / app resume? → A: The **last-used box** (persisted `activeBoxId`); survives relaunch.
- Q: Tapping a new-mail notification for a non-active box? → A: **Switch that box active and deep-link straight to the message.**
- Q: Back / gesture behavior on the inbox-home? → A: Sub-screens (detail/compose/settings/sheets) **back to the inbox**; on the **root inbox**, **Android** back exits to the launcher (standard root behavior), **iOS** has **no app-level back** — the user leaves via the OS home gesture (swiping does **not** close the app).
- Q: (derived) Fate of `BoxList` / `AppDrawer`? → A: **Repurpose** `BoxList`'s box-row rendering as the **switcher-sheet content**; **retire `AppDrawer`** (its add-box/settings entries move into the sheet).
- Q: (derived) Refresh-all model? → A: Pull-to-refresh refreshes the **active box**; the existing **background sync** keeps all boxes current; **no separate "refresh all" home button** (an optional refresh-all may live in the switcher sheet).

## Current → Target IA

| | Current (shipped) | Target (this spec) |
|---|---|---|
| Launch destination | `BoxList` (list of boxes) | Active box's **inbox** (`MessageList`) |
| Box's messages | pushed screen + back chevron | **the home**, no back chevron |
| Switch box | back out → tap another card | **box-switcher bottom sheet** from the header |
| Add box / Settings | left `AppDrawer` | inside the switcher sheet |
| All-boxes overview | the `BoxList` home | **retired** — the switcher sheet (per-box unread badges) is the only multi-box surface |
| Header | box name + back | one sunken bar: switcher button \| divider \| **search** (the wordmark first specified here was later dropped by the design) |

## Scope

**In scope** (navigation/behavior):
- Make the active box's inbox the **home route** (`AppShell`/`AppNavigator`).
- The **box-switcher bottom sheet** (box rows + active ✓ + per-box `⋯` + "Přidat schránku" + "Nastavení"),
  opened from the inbox header's switcher button. The *visual* sheet was already extracted/restyled in
  009 (`design-system.md §6`, `BoxOverflowMenu`/`AppDrawer` re-skin) — this wires it as the switch surface.
- Restore the app **wordmark + global search** on the inbox header (009 intentionally omitted them on the
  per-box screen). *Amended: the wordmark was later dropped by the design — see FR-005.*
- Move **add-box / settings** entry points from `AppDrawer` into the sheet.
- **Zero boxes → Welcome** (009's Welcome screen) → add-box; **last box removed → Welcome**.
- **Repurpose `BoxList`'s box rows as the switcher-sheet content; retire `AppDrawer`** (add-box/settings move into the sheet).
- Back/gesture: sub-screens back to the inbox; on the root inbox, Android exits to launcher, iOS leaves via the OS home gesture (no app-level back).
- Notification / deep-link **switches the active box to the owning box and opens the message**.

**Out of scope**:
- Visual restyle of any screen — **done in 009** (this reuses those components).
- Deadlines/attention — **spec 010**. Sending — **005/008**.
- The `Vše/All` merged timeline segment — deferred here (008 out-of-scope). *Amended 2026-09-14:* the
  `Vše` merged view was later built by 024 as a mode of this same inbox.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Open into my inbox; switch boxes from a sheet (Priority: P1)
The app opens to my active box's inbox; tapping the header switcher opens a sheet of my boxes; picking
one swaps the inbox in place (no push/pop), and the active box is remembered for next launch.

**Independent Test**: With ≥2 boxes, launch → land on the active box's inbox; open the switcher → see all
boxes with the active one marked; pick another → inbox updates in place; relaunch → the last-active box opens.

**Acceptance Scenarios**:
1. **Given** ≥1 box, **When** I launch, **Then** I land on the active box's inbox (not a box list).
2. **Given** the inbox, **When** I tap the switcher button, **Then** a bottom sheet lists my boxes (active ✓, per-box ⋯, add-box, settings).
3. **Given** the sheet, **When** I pick another box, **Then** the inbox swaps to it in place and the sheet closes.
4. **Given** I switched boxes, **When** I relaunch, **Then** the previously-active (last-used) box opens.

### User Story 2 — Add a box / open settings from the switcher (Priority: P2)
The sheet's "Přidat schránku" enters the add-box flow; "Nastavení" opens settings — replacing the drawer.

**Acceptance Scenarios**:
1. **Given** the sheet, **When** I tap "Přidat schránku", **Then** the add-box flow opens; on success the new box can become active.
2. **Given** the sheet, **When** I tap "Nastavení", **Then** Settings opens.
3. **Given** I remove my last box, **Then** I land on Welcome.

### User Story 3 — Per-box `⋯` and rename/remove from the sheet (Priority: P3)
Each box row's `⋯` opens rename/remove (the existing actions), without a separate box-list screen.

### Edge Cases
- **Zero boxes** on launch → Welcome (not an empty inbox).
- **Hardware back / edge-swipe** on the root inbox → Android exits to the launcher; iOS leaves via the OS home gesture (no app-level back — swiping does not close the app).
- **Notification tap** for a message in a non-active box → switch active box + open the specific message.
- App-lock gate + the shell Testovací banner must still sit correctly above the inbox-home.
- A single box (no switching needed) — the switcher still shows it + add-box.

## Requirements *(mandatory)*

- **FR-001**: The system MUST launch (and resume) into the **active box's inbox** when ≥1 box exists, and into **Welcome** when none. The **active box = the last-used box**.
- **FR-002**: The system MUST provide a **box-switcher bottom sheet** from the inbox header listing all boxes (active indicator, per-box unread badge, per-box `⋯`), reusing the 009-restyled components. The sheet is the **only** multi-box surface (no separate box-list/dashboard). *Amended by 024:* the switcher also offers `Vše` (2+ boxes), and the inbox shows a one-line cross-box summary that opens the switcher; there is still no separate box-list/dashboard screen.
- **FR-003**: Switching boxes MUST update the inbox **in place** (no visible push/pop) and MUST persist a **`activeBoxId`** so the last-used box reopens across launches.
- **FR-004**: Add-box and Settings MUST be reachable from the sheet; `AppDrawer` is **retired** and `BoxList`'s box-row rendering is **repurposed** as the sheet's content.
- **FR-005**: The inbox header MUST carry the app wordmark + the global **search** entry (restoring what 009 omitted on the per-box screen). *Amended 2026-09-14:* the inbox header is one sunken bar: box-switcher button | divider | search. (The wordmark originally specified here was later dropped by the design and is not shown on the inbox.)
- **FR-006**: Removing the last box MUST route to Welcome; adding the first box MUST route to its inbox (and make it active).
- **FR-007**: A notification / deep-link MUST **set the owning box active and open the specific message** (deep-link into the inbox → that message). *Amended 2026-09-14:* 014 (shipped 2026-08-14) removed new-mail notifications; since 010 (2026-08-17) the only notification is a deadline reminder, whose tap is routed by `src/app/notifications/deepLinkRouter.ts`.
- **FR-008**: Back/gesture: from any sub-screen (detail/compose/settings/sheets) back MUST return to the inbox. On the **root inbox**: **Android** hardware/gesture back exits to the launcher (standard root-activity behavior); **iOS** has **no app-level back** (the user leaves via the OS home gesture — the app backgrounds, it is not closed). MUST NOT strand the user.
- **FR-009**: Refresh: **pull-to-refresh** on the inbox refreshes the **active box**; the existing **background sync** keeps all boxes current. No separate "refresh all" home control (it may optionally appear in the switcher sheet). *Amended by 014 (shipped 2026-08-14):* there is no background sync. `refreshAll` refreshes every box only on launch, add-box and re-auth; pull-to-refresh covers the active box (or all boxes in the `Vše` view); otherwise a box is only as current as its last user-initiated refresh.
- **FR-010**: MUST NOT regress the app-lock gate, the shell **Testovací** banner, sync, or any 009 visuals; MUST preserve existing rename/remove/add-box behaviors and the per-box `⋯` actions.

### Key Entities
- *No new persisted entities.* New persisted **UI state**: `activeBoxId` (the last-used box, persisted for
  launch restore). Box, message, draft entities unchanged.

## Success Criteria *(mandatory)*
- **SC-001**: With ≥2 boxes, launch lands on the active box's inbox and box-switching via the sheet works in place — verified on czebox.
- **SC-002**: Zero-box launch → Welcome; first-add → inbox; last-remove → Welcome.
- **SC-003**: A notification for a non-active box sets that box active and opens the specific message.
- **SC-004**: No regression to lock gate, Testovací banner, sync, or 009 visuals; `tsc`/`lint`/tests clean.
- **SC-005**: The last-used box (`activeBoxId`) reopens across relaunch.

## Decisions (resolved via /speckit.clarify, 2026-06-30)
All six prior open questions are resolved — see **Clarifications** above and folded into FR-001…FR-010:
Q1 active box = **last-used** (persisted `activeBoxId`) · Q2 all-boxes overview **retired** (switcher sheet
only) · Q3 refresh = **active-box pull-to-refresh + background all-sync** · Q4 back = **sub-screens→inbox;
root inbox: Android→launcher, iOS→OS home gesture (no app-level back)** · Q5 notification **switches box +
opens the message** · Q6 **repurpose `BoxList` rows into the sheet, retire `AppDrawer`**.

## Relationship to other features
- **008 (Sending & Navigation UX)** — 008 shipped the *current* box-list IA (add-box-in-menu, per-box `⋯`,
  sent segmented control, Testovací banner). 011 **changes** that home IA to inbox-first; it builds on 008's
  action model, it does not replace 008's sending/sent work.
- **009 (Visual redesign)** — 011 **reuses** the components 009 restyled (switcher sheet, box rows, inbox
  header, Welcome). 009 stayed visual-only and explicitly deferred this routing change here.
- **010 (Deadlines)** — unrelated; the inbox's attention section is unaffected by where the inbox sits.

## Assumptions
- The 009-restyled box-switcher sheet, box rows, dialogs, inbox header, and Welcome screen are reused as-is.
- No backend/ISDS change; this is on-device navigation + a persisted `activeBoxId`.
- Verified on czebox per Principle VII before "done".
