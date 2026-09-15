# Phase 1 Data Model — Inbox-first navigation (011)

A navigation/state refactor: **no new domain entities, no DB schema change.** The only model additions
are one **persisted UI key** and the **navigation/shell state** shape. Box, message, draft entities are
unchanged.

## Persisted state

| Key | Type | Where | Meaning | Rules |
|---|---|---|---|---|
| `activeBoxId` | `string \| null` | existing on-device store (settings/secure store) | the **last-used** box, restored on launch | Written on every switch + on add (new box becomes active). On read: if it names an existing box → use it; else → first box; if zero boxes → `null` → Welcome. Read error/garbled → treated as `null`. Never throws (Principle II). |

## Shell / navigation state (in `AppShell`)

- `accounts: DataBoxAccount[]` — unchanged.
- `activeBoxId: string \| null` — now **seeded from the persisted key** (was `list[0].boxId`); the
  derived **active account** = `accounts.find(a => a.boxId === activeBoxId)` (fallback to `accounts[0]`).
- `route` state machine — unchanged set (`loading | welcome | addBox | reauth | home`); `home` now mounts
  the inbox-first navigator (root = inbox) instead of the box-list.
- **Switcher sheet visibility**: ephemeral boolean (open/closed), shell- or inbox-level.

### State transitions (active box)
- **Launch**: read persisted `activeBoxId` → resolve to an existing box → mount its inbox; none → Welcome.
- **Switch** (from sheet): set `activeBoxId` (state + persist) → inbox updates in place.
- **Add box**: new box becomes active (set + persist) → its inbox.
- **Remove box**: if removed == active → fall back to first remaining (set + persist); if none → Welcome.
- **Notification deep-link**: set owning box active (set + persist) → navigate to its `MessageDetail`.

## Navigation model (after refactor)

Native-stack routes: **`Messages` (root = the active box's inbox)** → `MessageDetail` · `Compose` ·
`Search` · `Settings` (pushed). The `Home`/box-list route is **removed**. The **box-switcher sheet** is a
global overlay (not a stack route). Param flow: the root inbox reads the active box from shell
state/context; box-switch re-renders/`replace`s in place (no push/pop).

## Retired
- `Home` route + `BoxList`-as-home screen (rows reused by `BoxSwitcherSheet`).
- `AppDrawer` (add-box/settings move into the sheet).
- The box-list "refresh all" home affordance. ~~(background sync retained)~~ *Amended by 014 (shipped
  2026-08-14): there is no background sync; `refreshAll` runs only on launch, add-box and re-auth.*
