---
description: "Task list — Inbox-first navigation & box switcher (011)"
---

# Tasks: Inbox-first navigation & box switcher

**Input**: `specs/011-inbox-first-navigation/` — plan.md, spec.md (clarified), research.md, data-model.md,
contracts/navigation-contract.md, quickstart.md
**Branch**: `011-inbox-first-navigation`
**Tests**: Requested — unit tests for the `activeBoxId` fallback chain, a navigation smoke, and a
deep-link resolver (research D9). Reuses the 009-restyled components (no visual restyle).

User stories (spec.md): **US1** open into my inbox + switch via the sheet (P1) · **US2** add-box / settings
from the sheet (P2) · **US3** per-box ⋯ rename/remove from the sheet (P3).

## Format: `[ID] [P?] [Story?] Description with file path`
- **[P]** = parallelizable (different files, no incomplete deps). Story label only on user-story phases.

---

## Phase 1: Setup

- [X] T001 Create `src/app/navigationRef.ts` — a `createNavigationContainerRef<RootStackParamList>()` + a small `navigate(...)` helper, for imperative deep-link navigation (used by notifications).
- [X] T002 [P] Create an `activeBoxId` persistence helper (`src/features/accounts/state/activeBox.ts`): `readActiveBoxId(): Promise<string|null>` + `writeActiveBoxId(id: string|null): Promise<void>` over the existing on-device store; **crash-safe** — a read error/garbled value resolves to `null`, never throws (Principle II).

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ Inbox-first routing + persisted active box gate every user story.**

- [X] T003 Wire the nav ref into the container in `src/app/AppNavigator.tsx` (`<NavigationContainer ref={navigationRef}>`).
- [X] T004 `src/app/AppShell.tsx`: **seed `activeBoxId` from `readActiveBoxId()`** on load (replacing `list[0].boxId`); resolve to an existing box → use it; missing/garbled → first box; zero boxes → Welcome. Async, non-blocking, never throws.
- [X] T005 `src/app/AppShell.tsx`: **persist on change** — `writeActiveBoxId` on every switch + on add (new box becomes active); on **removal of the active box**, fall back to the first remaining (persist) or Welcome if none.
- [X] T006 `src/app/AppNavigator.tsx`: make the **inbox the ROOT** — initial route = `Messages` parameterized by the active box; **remove the `Home` (BoxList) route** from `RootStackParamList` + `Stack.Navigator`. `MessageDetail`/`Compose`/`Search`/`Settings` stay pushed.
- [X] T007 Back-stack rules: root inbox Android back exits to launcher (native-stack default) + sub-screens back to inbox; add a `BackHandler` (Android) that **closes the switcher sheet first** when it's open.

---

## Phase 3: US1 — Open into my inbox + switch via the sheet (P1)

**Goal**: Launch into the last-used box's inbox; switch boxes from a bottom sheet, in place.
**Independent test**: With ≥2 czebox boxes, launch → active box inbox; open sheet → switch → inbox updates in place; relaunch → last-used box.

- [X] T008 [US1] Extract `BoxList`'s box-row rendering into a reusable `BoxRow` (same 009 styling: avatar, name/sub, unread badge, **Testovací** tag, active ✓ slot, per-box `⋯`) so the sheet and any remaining surface share it — `src/features/accounts/screens/BoxList.tsx` → `BoxRow`.
- [X] T009 [US1] Create `src/features/accounts/screens/BoxSwitcherSheet.tsx` — a bottom sheet reusing the 009 sheet chrome (warm scrim, `surfaceAlt` sheet, grab handle) listing `BoxRow`s; open/close state; dismiss on scrim tap / swipe-down / back.
- [X] T010 [US1] `src/features/messages/screens/MessageList.tsx` inbox-as-home header: app **wordmark** (`LogoMark` + "Obálka"), a **search** button → `Search`, and a **box-switcher button** (active box avatar + name + ▾) → opens `BoxSwitcherSheet`; keep the **Testovací** tag; drop the per-box back chevron on the root inbox. *Amended 2026-09-14:* the wordmark was later dropped by the design; the inbox header is one sunken bar: box-switcher button | divider | search.
- [X] T011 [US1] Wire **box switch**: picking a non-active row sets + persists `activeBoxId` (T005) and updates the inbox **in place** (`navigation.replace('Messages', { box })` or shell-state re-render — no push/pop), then closes the sheet.
- [X] T012 [US1] **Notification deep-link** (FR-007): in `src/services/notifications/notifeeNotifier.ts` (+ the tap handler), resolve the owning box → **set active (persist) + `navigationRef.navigate('MessageDetail', …)`**; missing box/message → degrade to that box's inbox / the active inbox; queue a cold-start tap until the navigator + accounts are ready. Never crash (Principle II).
- [X] T013 [US1] **Retire the box-list home**: remove the `Home`/`BoxList` screen mounting (no longer a route); the `BoxRow` lives on for the sheet.
- [X] T014 [US1] Pull-to-refresh on `MessageList` refreshes the **active box** (keep/verify); **remove** any box-list "refresh all" home affordance (background `refreshAll` stays). *Amended by 014 (shipped 2026-08-14):* no background sync remains; `refreshAll` runs only on launch, add-box and re-auth.

---

## Phase 4: US2 — Add-box / Settings from the sheet (P2)

**Goal**: Add a box and open Settings from the switcher; retire the drawer.

- [X] T015 [US2] `BoxSwitcherSheet`: dashed **"Přidat schránku"** → the add-box flow (`AppShell` `setRoute('addBox')`); on success the new box becomes active + its inbox shows.
- [X] T016 [US2] `BoxSwitcherSheet`: **"Nastavení"** row → `Settings` (navigate); back → inbox.
- [X] T017 [US2] **Retire `src/features/accounts/screens/AppDrawer.tsx`** (remove the left drawer + its mount/usages); add-box/settings are now only via the sheet.
- [X] T018 [US2] Verify zero boxes → Welcome and **last box removed → Welcome** with the new active-box logic (T004/T005).

---

## Phase 5: US3 — Per-box ⋯ rename/remove from the sheet (P3)

**Goal**: Manage a box without a separate box-list screen.

- [X] T019 [US3] `BoxSwitcherSheet` rows: per-box **`⋯`** → the existing **rename** (`AliasEditor`) / **remove** (`RemoveBoxDialog`) actions (reuse `BoxOverflowMenu` logic); removing the active box falls back per T005.

---

## Phase 6: Polish & Verify

- [X] T020 [P] Unit test: `activeBoxId` persistence + **fallback chain** (existing id / missing id / deleted active box / zero boxes) in `__tests__/accounts/activeBox.test.ts`.
- [X] T021 [P] Navigation smoke test: root = inbox; switch updates in place; sub-screen back → inbox (mocked nav) in `__tests__/app/navigation.test.tsx`.
- [X] T022 [P] Deep-link resolver test: notification payload → (box, message) resolution incl. missing-box/message fallbacks in `__tests__/app/deeplink.test.ts`.
- [X] T023 No-layout-jump + no-UI-thread-block check on launch/switch; app-lock gate + shell **Testovací** banner unaffected; dark mode intact; 009 visuals unchanged.
- [X] T024 `npm run lint`, `npm test`, `tsc --noEmit` all clean.
- [X] T025 **czebox walkthrough** per quickstart.md — walked live on **two czebox boxes** (`c57mi5x` + `3ntmizt`): launch → last-used inbox ✓; open switcher (both boxes listed, active ✓) ✓; **switch in place** via the sheet (box 2 → box 1, no push/pop, content changed) ✓; **persist across force-stop relaunch** (reopened box 1) ✓; **back** — sheet open → closes sheet & stays in app, root inbox → exits to launcher ✓; **add-box from sheet** → new box becomes active + its inbox shows ✓. Remaining two sub-items are **unit-covered but not walked live**: notification deep-link (T022 resolver test — no controllable new-message notification on the emulator) and zero/last-box → Welcome (T020 fallback-chain test — a live check would delete the user's test boxes). Principle VII sign-off. Note: adding a **test** box requires expanding **Pokročilé → Prostředí → Testovací** (default is `Ostré`/production, per-box `host`); a test credential on production fails as `invalidCredentials` with a misleading OTP hint.

---

## Dependencies
- **Phase 1 → Phase 2 → Phase 3 (US1) → US2 → US3 → Polish.**
- T002 → T004/T005; T001 → T003 → T012; T006 → T010/T011/T013; T008 → T009 → T010/T011/T015/T016/T019.
- US2/US3 depend on the sheet (T009) + the switch wiring (T011).

## Parallel example (within a phase)
```
# Setup: T001 (nav ref) and T002 (persistence helper) — different files.
# Polish tests: T020, T021, T022 — different test files, [P].
```

## Implementation strategy
- **MVP** = Phase 2 (foundation) + **US1** (T008–T014): inbox-first launch (last-used) + working box
  switcher + deep-link. Fully usable.
- Then US2 (add/settings from the sheet, retire drawer) → US3 (per-box ⋯) → polish + czebox.
- Keep the **negative contract** in view: no box-list/dashboard screen, no `AppDrawer`, no refresh-all
  home button. Crash-safe fallbacks everywhere active box is resolved (Principle II).

**Totals**: 25 tasks — Setup 2 · Foundational 5 · US1 7 · US2 4 · US3 1 · Polish 6.
