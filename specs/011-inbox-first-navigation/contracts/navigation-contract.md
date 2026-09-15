# Phase 1 Navigation Contract — Inbox-first (011)

The app's "interface" here is its **navigation + the switcher sheet**. This states the contract each must
satisfy. Visuals are 009's (reused) — not re-specified.

## C1 — Route contract (native-stack)
- **Root = the active box's inbox** (`Messages`). On launch with ≥1 box, the navigator mounts here for
  the **last-used** box; with 0 boxes the shell shows **Welcome** (navigator not mounted).
- Pushed on top of the root: `MessageDetail`, `Compose`, `Search`, `Settings`. Each **backs to the
  inbox**.
- The `Home`/box-list route does **not** exist.
- **Box switch** updates the root inbox **in place** (no visible push/pop; back-stack does not grow with
  boxes).
- **Back**: sub-screen → inbox; root inbox → Android exits to launcher (sheet open → back closes sheet
  first); iOS root → no app-level back (OS home gesture).

## C2 — Box-switcher sheet contract (`BoxSwitcherSheet`)
Opened from the inbox header's switcher button. Contains, reusing 009 components:
- One **row per box** (reused from `BoxList`): avatar, name + sub/ID, unread badge, **Testovací** tag for
  czebox, **active ✓** on the current box, a per-box **`⋯`** (→ rename/remove, existing actions).
- Tapping a non-active row → **switch to that box** (set+persist `activeBoxId`) and **close** the sheet;
  the inbox updates in place.
- A dashed **"Přidat schránku"** → the add-box flow (new box becomes active on success).
- A **"Nastavení"** row → Settings.
- Dismiss: tap scrim / swipe down / back (Android) → close, no state change.
Accessibility: every row/button labeled; the sheet is the non-gesture-accessible path (no swipe-only
actions). No layout jumps.

## C3 — Inbox header contract (`MessageList` as home)
- ~~Left: app **wordmark** (LogoMark + "Obálka") — restored (009 omitted it on the per-box screen).~~
  *Amended 2026-09-14:* the inbox header is one sunken bar: box-switcher button | divider | search. The
  wordmark originally specified here was later dropped by the design and is not shown on the inbox.
- A **box-switcher button** (active box avatar + name + ▾) → opens C2.
- A **search** entry → `Search`.
- A **Testovací** tag when the active box is czebox; the shell **Testovací banner** still sits above.
- Pull-to-refresh refreshes the **active box**.

## C4 — Deep-link contract (notification)
- A deadline-reminder notification tap **sets the owning box active** and **opens that message**
  (`MessageDetail`). *(Amended 2026-09-14: this read "new-mail notification". 014 removed those; since
  010 the only notification is a deadline reminder, routed by `src/app/notifications/deepLinkRouter.ts`.)*
- Owning box missing → that box's inbox if resolvable, else the active inbox. Message missing → the box's
  inbox. Never crash. Cold-start tap is honored once the navigator + accounts are ready.

## C5 — Negative contract (do not ship)
- No standalone box-list/dashboard screen (retired).
- No `AppDrawer`.
- No "refresh all" home button. ~~(background sync only)~~ *Amended by 014 (shipped 2026-08-14):* there
  is no background sync either; `refreshAll` refreshes every box only on launch, add-box and re-auth,
  and pull-to-refresh covers the active box (or all boxes in the `Vše` view).
- No fake/empty multi-box overview.

## C6 — Acceptance signal
Done when C1–C4 hold on a czebox box (multi-box where possible): launch lands on the last-used inbox;
switching via the sheet works in place + persists across relaunch; a notification opens the right
box+message; back behaves per platform; zero/last-box → Welcome. Tracked in `quickstart.md`.
