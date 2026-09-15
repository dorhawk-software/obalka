# Phase 0 Research — Inbox-first navigation (011)

A navigation/state refactor; decisions below resolve the plan's watch-items. No NEEDS CLARIFICATION
remain (the spec is clarified). Format: Decision / Rationale / Alternatives.

## D1 — Inbox as the navigator root
**Decision**: Make the **inbox** the root of the native-stack: the navigator's first/initial route is the
active box's message list (the current `Messages` screen, parameterized by the active box). The `Home`
route (BoxList) is **removed**. Sub-screens (`MessageDetail`, `Compose`, `Search`, `Settings`) remain
pushed on top. `AppShell` passes the active box to the root and re-mounts/updates it on switch.
**Rationale**: Smallest change to the existing native-stack; the inbox-as-root makes Android back exit
to the launcher naturally (root of the stack) and detail/compose/etc. back to the inbox.
**Alternatives**: a tab/drawer navigator (rejected — design is a single inbox + sheet); keeping `Home`
and auto-navigating to `Messages` on mount (rejected — leaves a phantom box-list under the stack + a
back-to-box-list step).

## D2 — Persist the active box (last-used) + safe fallback (Principle II)
**Decision**: Persist `activeBoxId` (string|null) in the existing on-device store (the settings/secure
store used elsewhere). `AppShell` currently sets `activeBoxId` to `list[0].boxId` in `useState`; change
to: **on load, read the persisted id**; if it matches an existing box, use it; **else fall back to the
first box** (or → Welcome when zero boxes). **Write** `activeBoxId` on every switch and on add (new box
becomes active). On box **removal**, if the removed box was active, fall back to the first remaining box
(or Welcome). A read error/garbled value is treated as "none" → first box. Never throws.
**Rationale**: last-used is low-surprise (clarified Q1); the fallback chain guarantees the app always
lands somewhere valid (Principle II — crash-resilient, never strand).
**Alternatives**: in-memory only (rejected — doesn't survive relaunch, fails SC-005); a "primary box"
flag (rejected per Q1).

## D3 — Box-switcher bottom sheet (reuse 009 visuals)
**Decision**: New `BoxSwitcherSheet` — a bottom sheet (reuse the 009-restyled sheet chrome from
`BoxOverflowMenu`/`AppDrawer`: warm scrim, `surfaceAlt` sheet, grab handle) hosting **`BoxList`'s box
rows** (avatar + name/sub + unread badge + Testovací tag + active ✓ + per-box `⋯`), a dashed **"Přidat
schránku"**, and a **"Nastavení"** row. Opened from the inbox header's switcher button; picking a box
calls the switch (D4) and closes; `⋯` opens the existing rename/remove actions. Mounted at the
shell/inbox level so it overlays the inbox.
**Rationale**: maximal reuse (the rows + sheet are already built/restyled in 009); the sheet is the sole
multi-box surface (clarified Q2/Q6).
**Alternatives**: a full-screen switcher (rejected — design is a sheet); a left drawer (rejected — retire
`AppDrawer`).

## D4 — Switch box in place (no push/pop)
**Decision**: Switching sets `activeBoxId` (state + persist) and updates the inbox **in place** — either
the root `Messages` screen reads the active box from shell state/context and re-renders, or
`navigation.replace('Messages', { box })` (no visible push/pop, no back-stack growth). Drafts/scroll for
the previous box are discarded as today (box change = fresh inbox).
**Rationale**: clarified FR-003 (in place); avoids a misleading back-stack of boxes.
**Alternatives**: `push` (rejected — back would cycle through previously-viewed boxes).

## D5 — Notification / deep-link → box + message (Principle II)
**Decision**: Reuse the existing `notifeeNotifier` tap handler. On tap, resolve the **owning box** from
the notification payload; if it exists, **set it active** (state + persist) and **navigate to
`MessageDetail`** for that message via a navigation ref (`navigationRef.ts`). If the box or message no
longer exists, fall back to that box's inbox, else the active inbox — never crash. Cold-start taps queue
the intent until the navigator + accounts are ready.
**Rationale**: clarified Q5/FR-007 (switch + open the message); the fallback keeps it crash-safe.
**Alternatives**: open only the inbox (rejected per Q5); a parameter-only nav without setting active box
(rejected — leaves "which box am I in" ambiguous).

## D6 — Back / gesture behavior
**Decision**: Sub-screens back to the inbox via the native stack (default). On the **root inbox**:
**Android** hardware/gesture back exits to the launcher (root-of-stack default; if the switcher sheet is
open, back closes the sheet first via a `BackHandler`/sheet dismiss). **iOS**: no app-level back on the
root (the user leaves via the OS home gesture; the edge-swipe only acts when there's a screen to pop).
**Rationale**: clarified Q4; matches platform conventions (the user confirmed iOS doesn't "close" via
swipe).
**Alternatives**: back → switcher (rejected per Q4); a custom no-op (rejected — non-standard).

## D7 — Refresh model
**Decision**: `MessageList` pull-to-refresh refreshes the **active box** (already wired). The shell's
`refreshAll` stays for **background sync** (cold-launch + background fetch) keeping all boxes current.
**No** separate "refresh all" home control (the old `BoxList` all-refresh affordance is removed).
**Rationale**: clarified Q3; inbox-first naturally scopes manual refresh to the active box.
**Alternatives**: a refresh-all button in the sheet (deferred — optional, not built unless asked).
*Amended by 014 (shipped 2026-08-14):* there is no background sync. `refreshAll` refreshes every box
only on launch, add-box and re-auth; pull-to-refresh covers the active box (or all boxes in the `Vše`
view).

## D8 — Retire `AppDrawer` + the box-list home
**Decision**: Remove the `Home`/box-list route and the `AppDrawer` slide-in. `BoxList`'s row component is
**extracted/reused** by `BoxSwitcherSheet`; the standalone `BoxList` screen is deleted (or reduced to the
row component). Add-box/settings entries live in the sheet.
**Rationale**: clarified Q6; the sheet replaces both surfaces.
**Alternatives**: keep `BoxList` hidden (rejected — dead code/route).

## D9 — Testing
**Decision**: Unit-test the `activeBoxId` persistence + fallback chain (existing id / missing id / deleted
active box / zero boxes); navigation smoke (root = inbox; switch replaces in place; sub-screen back →
inbox); a deep-link resolver test (valid box+msg / missing). Manual czebox walkthrough (Principle VII),
ideally with **two** test boxes to exercise switching + last-used persistence.
**Rationale**: the risk is routing/fallback correctness, not visuals (009-verified).
