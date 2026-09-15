# Phase 1 Data Model — Visual Redesign (009)

> **As built, later.** Some files named below were removed or replaced after 009 shipped:
> `src/theme/fileBadge.ts` is gone, `TestEnvBadge` became the `TestEnvBanner` bar plus a *Testovací* tag on
> box rows, `BoxList` / `AppDrawer` became 011's `BoxSwitcherSheet`, and `NotificationPrime` was deleted by 014.

> **The raw-hex allow-list has grown since.** The sanctioned palette files are the ones listed in
> `scripts/check-no-raw-hex.sh`; `fileBadge.ts` no longer exists.

This is a **presentation-layer** feature: **no new persisted entities, no DB migration, no ISDS field
changes.** The only "model" change is the in-code **theme token shape** and the **typography role →
font-family** mapping. (The sent/`folder` cache and all message/box entities are unchanged from 008.)

## Theme token shape (`src/theme/theme.ts`)

The `Theme` interface keeps its 29 keys (values change to the paper palette — see `design-system.md §4`)
and gains a few keys:

| New key | Role | Light | Dark |
|---|---|---|---|
| `testBg` | test-env banner/tag surface | `#FAE7B0` | `#352B12` |
| `testFg` | test-env banner/tag ink | `#6E5200` | `#E6C46A` |
| `testBd` | test-env banner/tag border | `#E8D49A` | `#4A3D1C` |
| `bodyText` | long-form body copy (design `text2`) | `#3F392E` | `#D8D0C2` |

**Derived chip-tone surfaces** (light-only literals in the design get dark variants — D2). Either add
tokens or a helper `chipTone(kind, scheme) → { bg, fg, accent }` for `kind ∈ {fikce-red, fikce-amber,
user-blue, est-soft, cost-free, cost-paid, status-*, info, danger-soft}`. Light values come from the
design literals (`#F7E4E1`/`#BE3A34`, `#FBEFD0`/`#9A6B00`, `#E4ECF7`/`#2A5C9A`, `#E2F0E8`/`#2E7D52`,
`#EEF4FB`/`#1E4E80`, …); dark values are derived (tinted-dark surface + brighter ink, AA-checked).

**Invariant**: both `lightTheme` and `darkTheme` define **every** key (build-time enforced by the
`Theme` type). No screen reads a raw hex except the three sanctioned palette files
(`theme.ts`, `avatar.ts`, `fileBadge.ts`).

## Typography role → family (`src/theme/typography.ts`)

Each existing `TextRole` gains a `fontFamily`. No new roles.

| Role | family | weight (as today) |
|---|---|---|
| `display`, `title`, `heading` | **Bricolage Grotesque** | 600–800 |
| `body`, `bodyStrong`, `value`, `label`, `caption`, `badge` | **Public Sans** | 400–800 |

Family strings must resolve to bundled fonts (D1); a missing family falls back to system sans at the
**same metrics** (no layout shift).

## Avatar / file-badge palettes (`src/theme/avatar.ts`, `src/theme/fileBadge.ts`)
Not theme tokens but hardcoded arrays — re-point to the design hash palette
(`['#2A5C9A','#0E8C8C','#7A6BC4','#2E7D52','#C98A00','#1E4E80']`) and warm file-type tiles. Shipped
(AA-darkened, see `design-sync-back.md` B): `['#2A5C9A','#0E6E6E','#5A4CA8','#1B6E52','#8A5A18','#1E4E80']`
in `src/theme/avatar.ts`; same values in light/dark (white initials read on all).

## State (not persisted)
The redesign introduces only **ephemeral UI state** already implied by existing screens (segmented
`folder`, sheet open/closed, `refreshing`). The Settings demo `offlineToggle`/`errorToggle` state is
**not** ported (D8). No new SecureStore/SQLite keys.
