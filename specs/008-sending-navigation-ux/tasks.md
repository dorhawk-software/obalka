# Tasks: Sending & Navigation UX

**Input**: Design documents from `/specs/008-sending-navigation-ux/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: INCLUDED where they add value (the project convention from 005: unit-test stores/controllers
over the fakes; smoke-test screens). UI-only visual tweaks are verified manually on czebox (Principle VII).

**Organization**: By user story, derived from the spec's desired outcomes. **Recipient search (outcome 3)
is already shipped in 005 — not a task here.**

- **US1 (P1)** — See **sent messages** (the most-wanted; headline). 🎯 MVP
- **US2 (P2)** — **Unambiguous "new message"**: home IA + per-box overflow menu.
- **US3 (P3)** — **Persistent "Testovací" banner** (never mistake a test box).
- **US4 (P4)** — **Modern design**: swipe-to-delete + bounded iOS Liquid Glass / Android Material 3 finish.

## Format: `[ID] [P?] [Story] Description with file path`

- **[P]** = parallelizable (different files, no dependency on an incomplete task)
- **[Story]** = US1–US4 (story phases only)

---

## Phase 1: Setup

- [X] T001 Add all feature-008 i18n keys (cs primary + en mirror) to `src/i18n/strings.ts` — segment labels (`Přijaté`/`Odeslané`), sent empty/error states, overflow menu (`Možnosti schránky`/`Přejmenovat`/`Odebrat`), `Přidat schránku` (menu), `Testovací` banner, swipe action labels (`Odebrat`/`Zahodit`)

---

## Phase 2: Foundational

No cross-story blocking work — each user story is independently implementable. (The folder-aware cache
migration lives inside US1; the swipe native-dep spike lives inside US4.)

---

## Phase 3: User Story 1 — See sent messages (P1) 🎯 MVP

**Goal**: A `Přijaté | Odeslané` segmented control in the box message list, with the sent list fetched,
cached per box, and shown (you → recipient).

**Independent test**: Open a box → toggle to **Odeslané** → a previously-sent message appears; kill the
network → it still shows from cache; an empty sent box shows "Žádné odeslané zprávy."

- [X] T002 [P] [US1] Migration v8: `ALTER TABLE messages ADD COLUMN folder TEXT;` (NULL ⇒ `received` via COALESCE) in `src/services/db/migrations.ts`
- [X] T003 [US1] `MessagesStore` folder-aware — `cacheList(boxId, folder, …)` / `getList(boxId, folder)` in both `InMemoryMessagesStore` + `SqliteMessagesStore` (`src/services/db/messagesStore.ts`)
- [X] T004 [US1] `MessagesController.listSent` (folder-generic `loadFolder` via `getSentMessages`, caches `folder='sent'`) + `getCachedMessages(boxId, folder='received')` (`src/features/messages/state/messagesController.ts`)
- [X] T005 [P] [US1] `SegmentedControl` component (raised selected pill, `accessibilityRole="tab"`) in `src/theme/SegmentedControl.tsx`
- [X] T006 [US1] `MessageList`: `Přijaté | Odeslané` segment; folder-aware load / pull-to-refresh / cache; per-folder empty states; sent rows show the recipient (`src/features/messages/screens/MessageList.tsx`)
- [X] T007 [US1] `MessageDetail` + `AppNavigator` route `folder`: sent orients **you → recipient** (recipient first) + skips mark-read (received-only op)
- [X] T008 [P] [US1] Tests: `listSent` caches under sent + no collision + serverFault surfaces (screen falls back); `SegmentedControl` smoke (renders + switches). 215 green.

**Checkpoint**: Sent view works end-to-end on czebox — US1 is a demoable MVP.

---

## Phase 4: User Story 2 — Unambiguous "new message" (P2)

**Goal**: Drop the bare `+` (compose-ambiguous) from the home; move "add box" into the `☰` menu; replace
the per-box inline pencil + trash with a single `⋯` overflow menu. Compose stays only inside a box.

**Independent test**: Home has no bare `+` and no compose; "Přidat schránku" in the `☰` menu adds a box;
each box card shows only `⋯` → Přejmenovat / Odebrat.

- [X] T009 [US2] `AppDrawer`: add a **"Přidat schránku"** entry → `onAddBox` (`src/features/accounts/screens/AppDrawer.tsx`) *(the drawer was later retired by 011)*
- [X] T010 [US2] `BoxList`: remove the bare `+` top-bar add-box button; add-box reachable only via the menu (`src/features/accounts/screens/BoxList.tsx`) *(`BoxList` later became 011's switcher sheet)*
- [X] T011 [P] [US2] `BoxOverflowMenu` component (`⋯` → **Přejmenovat** / **Odebrat**, `accessibilityLabel` "Možnosti schránky") in `src/features/accounts/screens/BoxOverflowMenu.tsx`
- [X] T012 [US2] `BoxList`/box card: replace inline `EditIcon` + `TrashIcon` with the `⋯` overflow menu — Přejmenovat → existing `AliasEditor`, Odebrat → existing remove-confirm (archive untouched, Principle IV) (`src/features/accounts/screens/BoxList.tsx`) *(`BoxList` later became 011's switcher sheet)*
- [X] T013 [P] [US2] Tests: `BoxList` smoke — no bare `+`, no inline pencil/trash, `⋯` present; overflow actions route to rename/remove (`__tests__/accounts/`). 217 green. *(superseded by 011's `BoxSwitcherSheet` tests)*

**Checkpoint**: The three create/act intents are each unambiguous.

---

## Phase 5: User Story 3 — Persistent "Testovací" banner (P3)

**Goal**: A shell-level full-width "Testovací" bar above every header when the active box is czebox.

**Independent test**: In a czebox box, the banner sits above every screen's header (list/detail/compose/
reauth); switching to a production box (or none) hides it; meets AA contrast in light + dark.

- [X] T014 [P] [US3] `TestEnvBanner` component — full-bleed top bar, `goldSoft` bg / `warningInk` text, "Testovací" (`src/app/TestEnvBanner.tsx`)
- [X] T015 [US3] `TestEnvBanner` is a NORMAL-FLOW bar (never an overlay — overlap is forbidden, constitution V) rendered at the top of each box-context screen (`MessageList`/`MessageDetail`/`ComposeScreen`/`ReauthForm`) when `account.host==='czebox'`; it pushes the header down and the header drops its status-bar padding. Per-screen so it slides in WITH the screen (no navigator-wide shift).
- [X] T016 [US3] Remove the inline `TestEnvBadge` from the box-context headers (`MessageList`, `MessageDetail`, reauth form); keep the home/box-card + Search badges (Compose had none)
- [X] T017 [P] [US3] Tests: `viewedBoxId` route→box mapping; `TestEnvBanner` shows for czebox / nothing otherwise (`__tests__/app/testEnvBanner.test.tsx`). 221 green. Verified on czebox vs production box on the emulator.

**Checkpoint**: A test box can never be mistaken for a live one.

---

## Phase 6: User Story 4 — Modern design + swipe-to-delete (P4)

**Goal**: Add swipe-to-delete (with the overflow menu as the a11y fallback) and selectively adopt the
current OS design languages — **iOS 26 Liquid Glass AND Android Material 3 (Expressive), co-equal** —
platform-adaptive, within accessibility limits. **Gated on the B0 build spike.**

**Independent test**: Trailing-swipe a box row → Odebrat (confirm); a draft row → Zahodit (undoable); a
message row offers **no** destructive archive-delete; with Reduce Motion the swipe works without
animation and the `⋯` menu offers the same actions.

- [X] T018 [US4] **B0 SPIKE (gate) ✅ PASSED**: added `react-native-gesture-handler@3` + `react-native-reanimated@4` (+ `react-native-worklets`); babel `react-native-worklets/plugin` (v4), `react-native-gesture-handler` import in `index.js`, `GestureHandlerRootView` root in `App.tsx`; clean x86_64 rebuild (JDK17) succeeds and a trailing-swipe row works on czebox emulator
- [X] T019 [P] [US4] **Fetch + learn** the live references and record the concrete, bounded adoptions per platform in `research.md` — Apple HIG / iOS 26 "Liquid Glass" + Material 3 / "Expressive" (connected button group, swipe-to-dismiss, motion, dynamic color)
- [X] T020 [US4] `SwipeableRow` primitive — trailing actions via `ReanimatedSwipeable`, native UI thread, honours **Reduce Motion** (no draggable gesture → overflow-menu fallback) (`src/theme/SwipeableRow.tsx`)
- [X] T021 [US4] Apply swipe: **box rows** → Odebrat (→ confirm) ✅ verified on-device; **draft rows** → Zahodit (→ undoable "Koncept zahozen" snackbar; inline trash is the a11y fallback, same undoable discard) ✅. **Message rows: NO destructive archive-delete** (Principle IV) — message rows stay un-swipeable. (`src/features/accounts/screens/BoxList.tsx`, `src/features/messages/screens/ComposeScreen.tsx`)
- [X] T022 [US4] Platform-adaptive finish ✅: `SegmentedControl` now branches on `Platform.OS` — **iOS** keeps the raised-pill (`surface` + shadow, press-dim); **Android** is an **M3 connected button group** (selected = `blueSoft` tonal fill, no shadow; small gap; brand-tinted `android_ripple` via RN `Pressable`, clipped to the segment). **Verified on the czebox emulator in light + dark** (fill moves on tap, AA holds: `blueDark` on `blueSoft` both modes). Selection **haptics deferred** to a real-device build (needs VIBRATE; can't be felt on the emulator — ripple is the visible M3 feedback). No blur surfaces exist yet, so the iOS-only-blur / Android-tonal / Reduce-Transparency rule is documented in the ui-guide rather than coded. (`src/theme/SegmentedControl.tsx`)
- [X] T023 [P] [US4] Tests: `SwipeableRow` smoke (action renders; Reduce-Motion drops the gesture → overflow-menu fallback) + jest mocks for reanimated/gesture-handler (`__tests__/theme/SwipeableRow.test.tsx`, `jest.setup.js`). 221 green.

**Checkpoint**: Expected gestures present; the app reads as current on both platforms within a11y limits.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T024 [P] Extend `docs/ui-guide.md` with the new patterns (segmented control / M3 connected group, `SwipeableRow`, shell top banner, platform-adaptive finish + the a11y fallbacks)
- [X] T025 Green gate ✅: `tsc --noEmit` clean, `eslint` **0 errors** (warnings pre-existing), `jest` **233 green**; cs/en string parity verified — every non-plural key in both, plural keys follow each language's CLDR categories (cs `one/few/many`, en `one/other`).
- [X] T026 [P] czebox acceptance ✅: live on the emulator — sent view (incl. the 20 MB row), the new segment (light + dark, fill moves on tap), the `Testovací` banner (normal-flow, no overlap), offline status, overflow `⋯`, and swipe-to-delete were all exercised across this feature's sessions.
- [X] T027 [P] Dark-mode + WCAG AA ✅: segment validated in dark on-device (`blueDark` #7FB3E8 on `blueSoft` #16273A, selection clear via fill + bold-vs-muted text); banner / overflow menu / swipe actions use the same semantic tokens (theme.ts) that already pass AA in §6 of the ui-guide.

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → then stories. T001 (strings) is referenced by all stories.
- **US1 (P1)**: T002 → T003 → T004 (cache chain); T005 ∥ ; T006 needs T004+T005; T007 needs T004; T008 after.
- **US2 (P2)**: T009 ∥ T011; T010 after T009; T012 needs T011; T013 after. Independent of US1.
- **US3 (P3)**: T014 → T015 → T016; T017 after. Independent of US1/US2.
- **US4 (P4)**: **T018 (spike) gates everything else in US4**; T019 ∥; T020 needs T018; T021/T022 need T020; T023 after. Independent of US1–US3 structurally (but best last — it touches rows the other stories create).
- **Polish (Phase 7)** last.

## Parallel opportunities

- US1, US2, US3 are mutually independent → can proceed in parallel by different contributors.
- Within US1: T002 + T005 in parallel. Within US2: T009 + T011. Within US4: T019 alongside T018.

## Implementation strategy (MVP first)

1. **Ship US1 (Sent view)** — the most-requested, self-contained, no new deps. That alone closes the
   biggest gap.
2. Then **US2** (unambiguous create) + **US3** (test banner) — both pure RN, low risk, high clarity gain.
3. **US4 last** — it's the only track needing new native deps (gated on the B0 build spike) and the
   research-gated platform finish; the structural wins (US1–US3) don't depend on it.
