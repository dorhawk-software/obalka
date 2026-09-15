# Tasks: Expressive iconography

**Feature**: `016-expressive-icons` | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

Written alongside the port (see plan.md for why the order differs from the usual loop).

## Phase 1: The scale

- [x] T001 Add the `heroInk` theme token (light `#D3C7AF`, dark `#4E4638`) in `src/theme/theme.ts`,
  documented as the one token permitted below AA.
- [x] T002 Create `src/theme/iconTiers.tsx` — `ICON_TIER` (the sizes and strokes) plus `HeroIcon` and
  `EmblemIcon`. Both hidden from assistive technology; hero in a fixed 132px box.
- [x] T003 Re-export the raw Lucide glyphs the tiers need from `src/theme/icons.tsx`
  (`MailGlyph`, `SendGlyph`, `SearchGlyph`, `CloudOffGlyph`).
- [x] T004 [P] Write `__tests__/theme/iconTiers.test.tsx`: decorative glyphs are hidden from screen
  readers, the hero box is fixed, and the stroke tapers as size grows.

## Phase 2: US1 — the empty and zero states (P1)

- [x] T005 [US1] Empty inbox → hero (`MailGlyph`), `MessageList.tsx`.
- [x] T006 [US1] Empty sent → hero (`SendGlyph`), `MessageList.tsx`.
- [x] T007 [US1] Load error / offline → hero (`CloudOffGlyph`), `MessageList.tsx`.
- [x] T008 [US1] Empty search → hero (`SearchGlyph`), `SearchScreen.tsx`.

## Phase 3: US3 — the confirmation moment (P3)

- [x] T009 [US3] Send confirmation → emblem (`SendGlyph`) in `ComposeScreen.tsx`, replacing the bare
  58px blue glyph. The screen already existed, so this is an icon change and not a flow change.

## Phase 4: US2 — anchors in long text screens (P2)

- [x] T010 [US2] **Not built — the design declined it.** Settings and FAQ group headers were one of
  the six placements suggested, and it rejected them: "eight glyphs down the length of a scroll is
  sprinkling by definition, and breaks the budget on contact." Recorded rather than silently dropped,
  because the spec's US2 asked for it and a reader deserves to know it was answered, not forgotten.

## Phase 5: Verification

- [x] T011 Full gate: tsc, eslint, jest.
- [x] T012 Device walk: the hero renders on the emulator (empty search), warm neutral at 132px.
- [~] T013 Walk the remaining three hero states and the emblem on device, in dark mode and at 1.5×.
  **Partly done 2026-08-17.** The empty-SEARCH hero was walked in light, in dark, and at 1.5× — the
  glyph reads as atmosphere in both themes (warm neutral on paper, `#4E4638` on near-black) and
  nothing clips or shifts at the larger scale.
  **Not reachable on this device, and not claimed:** the empty-inbox and empty-sent heroes need a
  folder with no messages (both boxes have some), the error hero needs a load failure with nothing
  cached, and the emblem needs a *successful send* — which the czebox box cannot do (no PDZ credit)
  and which on the production box would mean sending real mail to check an icon. All four render
  through the same two components as the verified one, and the tier rules are unit-tested; what is
  unverified is the composition on those specific screens, which is worth saying plainly rather than
  ticking.
- [~] T014 ~~Decide the notification primer sheet (the `feature` tier's only placement).~~
  **Superseded.** 010 decided not to restore the primer sheet; notification permission is requested
  when the first reminder is set (`remindersController.ts:64`, 010 T026). The `feature` tier stays
  unimplemented (`iconTiers.tsx:18-21`) until a feature proposes that screen. Nothing to do.
- [x] T015 Update `specs/README.md` when 016 merges.
