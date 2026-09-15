# Implementation Plan: Inbox-first navigation & box switcher

**Branch**: `011-inbox-first-navigation` | **Date**: 2026-06-30 | **Spec**: [spec.md](./spec.md)
**Input**: Clarified [spec.md](./spec.md) (all 6 open questions resolved — see its Clarifications +
Decisions). Surfaced by the 009 redesign; reuses 009's restyled components.

## Summary

Restructure navigation from **box-list-first** to **inbox-first**: the app opens (and resumes) into the
**active box's inbox** (the **last-used** box, persisted as `activeBoxId`), and a **box-switcher bottom
sheet** — the *only* multi-box surface — switches boxes / adds a box / opens settings without leaving the
inbox. `BoxList`'s box rows are **repurposed** as the sheet's content; the `Home`/box-list route and the
left `AppDrawer` are **retired**. The inbox header regains the app wordmark + global search. A
notification deep-link **sets the owning box active and opens the message**. Back: sub-screens → inbox;
on the root inbox, **Android** exits to the launcher and **iOS** leaves via the OS home gesture (no
app-level back). **Presentation reuses 009** — no visual restyle; this is a routing/state refactor.

## Technical Context

**Language/Version**: TypeScript (strict), React Native 0.86 (bare CLI, New Architecture / Fabric).
**Primary Dependencies**: React Navigation **native-stack** (`src/app/AppNavigator.tsx`, routes
Home/Messages/MessageDetail/Compose/Search/Settings, initial `Home`); the shell router state machine
(`src/app/AppShell.tsx`, owns `accounts` + in-memory `activeBoxId` = first box + `refreshAll`); the
009-restyled box rows / sheet (`BoxList`, `BoxOverflowMenu`/`AppDrawer` sheet visuals), `MessageList`,
`Welcome`. Persistence via the existing on-device store (SecureStore/SQLite settings) for `activeBoxId`.
Notifications via the existing `notifeeNotifier` tap handler + a navigation ref.
**Storage**: One new **persisted key** `activeBoxId` (last-used box). No DB schema change; no new domain
entities. The local archive is untouched.
**Testing**: Jest + @testing-library/react-native (navigation/state unit + screen smoke); manual run on
the Android emulator against a czebox box (Principle VII).
**Target Platform**: Android (primary) + iOS.
**Project Type**: Mobile app (single RN project; `src/app/*`, `src/features/*`).
**Performance Goals**: 60 fps; box-switch updates the inbox **in place** (replace, not push/pop), no
visible transition stutter; no UI-thread block (Principle I).
**Constraints**: Reuse 009 visuals (no restyle); WCAG AA + no layout jumps preserved; Czech-first; dark
mode intact; the app-lock gate + shell **Testovací** banner keep working above the inbox.
**Scale/Scope**: Navigation + shell-state refactor touching ~6 files + one new `BoxSwitcherSheet`; one
persisted key; retire 2 surfaces (the box-list home, `AppDrawer`). Zero backend.

## Constitution Check

*GATE: must pass before Phase 0. Re-checked after Phase 1.*

| Principle | Assessment |
|---|---|
| **I — Never block the UI thread (NON-NEG)** | ✅ Routing/state only. Box-switch = `navigation.replace` (no heavy work on the JS thread); the sheet animates on the native thread (reanimated, present). Persistence read is async + non-blocking. |
| **II — Crash-resilient by contract (NON-NEG)** | ⚠️ **Watch:** a missing/garbled persisted `activeBoxId` (or a deleted box) MUST fall back to the first box (or Welcome if none) — never crash or strand. Deep-link to a non-existent box → resolve gracefully. Resolved in research §D2/§D5. |
| **III — Privacy, on-device only** | ✅ No network/backend; `activeBoxId` is a local key; no new secrets. |
| **IV — The local archive is sacred** | ✅ No message/box data changes; switching/persisting active box is UI state only. |
| **V — Modern, accessible, Czech-first** | ✅ Reuses 009 components; the switcher sheet keeps the a11y fallbacks; **no layout jumps**; in-place switch (no jarring push/pop); all copy reuses existing cs/en keys. |
| **VI — Honest scope** | ✅ Nothing fake; the all-boxes overview is intentionally retired (clarified), not stubbed. No dead controls. |
| **VII — Verify on czebox** | ✅ Launch/switch/persist/notification/back all walked on a czebox box (multi-box where possible) before done. |

**Gate result: PASS** (one NON-NEG watch-item — II — resolved in research with explicit fallbacks; no
violation). No Complexity-Tracking entries required.

## Project Structure

### Documentation (this feature)
```text
specs/011-inbox-first-navigation/
├── plan.md · spec.md · research.md · data-model.md · quickstart.md · contracts/ · tasks.md (Phase 2)
```

### Source Code (repository root)
```text
src/
├── app/
│   ├── AppShell.tsx          # persist+restore activeBoxId (last-used); zero-box→Welcome; host the switcher sheet
│   ├── AppNavigator.tsx      # ROOT route becomes the inbox (Messages w/ active box); drop the Home/BoxList route
│   ├── navigationRef.ts      # NEW (or existing) — imperative nav for notification deep-links
│   └── notifications/        # tap handler → resolve owning box → setActive + navigate(MessageDetail)
├── features/
│   ├── accounts/screens/
│   │   ├── BoxSwitcherSheet.tsx   # NEW — bottom sheet; reuses BoxList's box rows + dashed add + settings
│   │   ├── BoxList.tsx            # repurpose its row rendering into BoxSwitcherSheet; retire the home screen
│   │   └── AppDrawer.tsx          # RETIRED (add-box/settings move into the sheet)
│   └── messages/screens/
│       └── MessageList.tsx    # inbox-as-home header: wordmark + search + switcher button; pull-to-refresh = active box
├── features/accounts/state/   # activeBoxId persistence helper (last-used)
└── services/secureStore|db/   # the persisted activeBoxId key
```

**Structure Decision**: Single RN project. The refactor concentrates in `src/app` (shell + navigator +
notifications) plus a new `BoxSwitcherSheet` that reuses `BoxList`'s rows; `MessageList`'s header gains
the wordmark/search/switcher; `AppDrawer` and the box-list home are removed.

## Phase sequencing

1. **State foundation:** persist + restore `activeBoxId` (last-used, with fallback) in `AppShell`.
2. **Routing:** make the inbox the navigator root; box-switch = in-place `replace`; back-stack rules.
3. **Switcher sheet:** build `BoxSwitcherSheet` from `BoxList` rows + add-box/settings; wire the header
   switcher button; retire `AppDrawer` + the box-list home.
4. **Deep-links:** notification → set active box + open the message.
5. **Verify:** czebox walkthrough (launch/switch/persist/notification/back/zero-box) + tests.

## Complexity Tracking
*No constitution violations requiring justification.* (Reuses existing components + the present
reanimated/nav deps; the only new persisted value is a single `activeBoxId` key.)
