---
description: "Task list — Visual Redesign (009) paper-theme port"
---

> **As built, later.** Some files named below were removed or replaced after 009 shipped:
> `src/theme/fileBadge.ts` is gone, `TestEnvBadge` became the `TestEnvBanner` bar plus a *Testovací* tag on
> box rows, `BoxList` / `AppDrawer` became 011's `BoxSwitcherSheet`, and `NotificationPrime` was deleted by 014.
> T019's received-side countdown was replaced: listing the inbox serves a message (013), so the fiction
> countdown lives on sent messages (`messageState.ts` `fictionCountdownTone`) and the attention group comes
> from `attention.ts` (010). T020's "Dříve" section became date sections (`groupByDate`, see
> `design-sync-back.md`). T035's "Upozornění" row went with the notification screens in 014. T033's shell banner
> "above all headers" was later narrowed to the message detail only (`src/app/TestEnvBanner.tsx`), and the
> "three sanctioned palette files" of T003/T042 have grown to the allow-list in `scripts/check-no-raw-hex.sh`.

# Tasks: Visual Redesign — "Paper" theme port

**Input**: `specs/009-visual-redesign/` — plan.md, spec.md, research.md, data-model.md,
contracts/ui-contracts.md, design-system.md, quickstart.md
**Branch**: `009-visual-redesign`
**Tests**: Light (smoke/contrast/no-jump audits) — appropriate to a presentation re-skin; no new logic
to TDD. New behaviors (deadlines/attention) are **out of scope** (spec 010).

User stories (spec.md): **US1** re-skin every screen without regressions (P1) · **US2** one consistent
visual identity (P1) · **US3** our brand mark at the design's placements (P2). The heavy lifting is the
**Foundation** phase (cascades to all stories); US1 is the per-screen ports; US2/US3 are focused passes.

## Format: `[ID] [P?] [Story?] Description with file path`
- **[P]** = parallelizable (different files, no incomplete deps). Story label only on user-story phases.

---

## Phase 1: Setup

- [X] T001 Acquired the 8 OFL `.ttf` weights into `assets/fonts/` (Public Sans 400/500/600/700/800; Bricolage Grotesque 600/700/800) — downloaded from the official uswds/public-sans + ateliertriay/bricolage repos.
- [X] T002 `react-native.config.js` created; `npx react-native-asset` ran (fonts copied to `android/app/src/main/assets/fonts/`, registered in iOS `Info.plist UIAppFonts`); `fontFamily` PostScript names pinned in typography.ts + design-system.md §2. *(The on-device rebuild followed; fonts were verified on device in T046/T048.)*
- [X] T003 [P] Add a hardcoded-hex guard (lint rule or test) asserting screens use no raw color literals outside `src/theme/theme.ts`, `src/theme/avatar.ts`, `src/theme/fileBadge.ts`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ Cascades to every screen — must complete before Phase 3.**

- [X] T004 Swap `src/theme/theme.ts` to the paper palette — all 29 keys, both `lightTheme`/`darkTheme`, per design-system.md §4.
- [X] T005 Extend the `Theme` interface + both palettes with `testBg`/`testFg`/`testBd` and `bodyText` (design `text2`), per data-model.md.
- [X] T006 Add chip-tone surfaces (or a `chipTone(kind, scheme)` helper) with **derived AA dark variants** for the light-only accent literals (`#EEF4FB`/`#F7E4E1`/`#E2F0E8`/`#FBEFD0`/`#E4ECF7`/`#D6E4F4`/`#EAD9A8`) — research D2.
- [X] T007 Wire `fontFamily` into the roles in `src/theme/typography.ts` (Bricolage Grotesque → display/title/heading; Public Sans → body/bodyStrong/value/label/caption/badge); confirm `src/theme/Typography.tsx` inherits; system-sans fallback at the **same metrics**.
- [X] T008 [P] Restyle `src/theme/SegmentedControl.tsx` to the paper segmented control (selected = `surface`+subtle shadow, idle transparent + `textMuted`).
- [X] T009 [P] Restyle `src/theme/Avatar.tsx` and re-point `src/theme/avatar.ts` to the design hash palette `['#2A5C9A','#0E8C8C','#7A6BC4','#2E7D52','#C98A00','#1E4E80']`.
- [X] T010 [P] Restyle `src/theme/Fab.tsx` → gold (`#E8A100`) compose FAB with glow shadow.
- [X] T011 [P] Restyle `src/theme/ScreenHeader.tsx` → 54px header, `surfaceAlt` bg, hairline bottom border, Bricolage title, 44px back-chevron.
- [X] T012 [P] Restyle `src/theme/EmptyState.tsx` + `src/theme/Skeleton.tsx` to paper tokens.
- [X] T013 [P] Restyle `src/theme/OptionGroup.tsx`, `PressScale.tsx`, `KeyboardAwareScrollView.tsx`, `BrandHeader.tsx` token usage.
- [X] T014 [P] (fileBadge done; TestEnvBadge testBg swap folded into T033/T034) Restyle `src/theme/TestEnvBadge.tsx` to the new `testBg/testFg/testBd`; reconcile `src/theme/fileBadge.ts` to warm file-type tiles.
- [X] T015 [P] Primary-button style → dark high-contrast (`text` fill / `surface` label) wherever the shared button pattern lives (`src/theme/ui.tsx` usages); keep blue for selection/radios.
- [X] T016 Fix hardcoded-color escapes: `src/app/Snackbar.tsx` `#222A33`+white → tokens; `#000` scrims → warm `rgba(33,27,18,.4)`; confirm `src/assets/logo.svg` reads on `bg`.
- [X] T017 Update `docs/ui-guide.md`: warm neutral ramp, two-family type, **dark high-contrast primary button**, new test tokens (supersede the cool-navy/brand-blue-primary guidance).
- [X] T018 Add the new cs/en strings to `src/i18n/strings.ts` (received/sentFolder/syncing/synced/recvEmpty*/sentEmpty*/to/deliveryStatus/deliveryDetail/testEnv/testTag/mkWait*/mkExpired*/mkRetry/otpSuggest*/reauth*/notif*/pay*/attachments/downloadingL/downloadAll/attUnavail*/addAtt/offlineStrip/loadError*/retry/searchEmpty) — Czech-first, plural forms where counted.
- [X] T019 Implement the deterministic **fikce-doručení** display helper in `src/features/messages/state/messagesController.ts` (a `decorate`/selector): for an **unopened** message compute whole days-until-fiction from stored `deliveryTime + 10 days` (Europe/Prague), exposing `{ inAttention, daysRemaining, tone }` to drive the inbox grouping/chips. **Presentation-derived only — NO storage, NO reminders/scanning (those are spec 010).** This is the **sole data source** for "Vyžaduje pozornost" in 009; if it yields nothing the section is omitted (analysis F1 / research D7). Crash-safe: a missing/garbled timestamp yields no chip, never throws (Principle II).

---

## Phase 3: US1 — Screen ports (parity re-skin)

**Goal**: Every screen matches its design section (light+dark, cs+en) with behavior unchanged.
**Independent test**: Walk each route per quickstart.md; parity with pre-redesign behavior + design pixels.

### Messages
- [X] T020 [US1] `src/features/messages/screens/MessageList.tsx` — new inbox layout: switcher-button header (+ Testovací tag), `Přijaté | Odeslané` segmented control, **constant-height sync line**, "Vyžaduje pozornost" + "Dříve" sections **populated by the T019 fikce helper** (section omitted when the helper yields none — no empty/fake section), offline strip, `loadError` + **Zkusit znovu** view, reauth strip, gold compose FAB.
- [X] T021 [US1] `src/features/messages/screens/MessageList.tsx` — **Sent** folder: recipient-oriented rows + delivery-state chip + week/earlier sections + empty state (reuse existing `listSent`).
- [X] T022 [US1] `src/features/messages/screens/MessageDetail.tsx` — postmark sender card; **multi-attachment list** (file-type tiles, name/size, saved✓); all-or-nothing **Stáhnout přílohy** + progress; 90-day **"Příloha už není dostupná"** state (keep local-archive distinction).
- [X] T023 [US1] `src/features/messages/screens/MessageDetail.tsx` — **Sent Detail** orientation: "Komu" card + delivery **timeline** (Odesláno→Dodáno→Doručeno) + "Detail doručení".
- [X] T024 [US1] `src/features/messages/screens/ComposeScreen.tsx` — recipient search + free/paid cost; subject/body + note; **attachment chips + "Přidat přílohu"**; drafts list; sent-success screen.
- [X] T025 [US1] `src/features/messages/screens/ComposeScreen.tsx` — **paid-send confirm sheet** before a PDZ send (`payConfirm` — coin, credit line, confirm/cancel).
- [X] T026 [US1] `src/features/messages/screens/SearchScreen.tsx` — re-skin results (box pill) + **empty state**.

### Accounts
- [X] T027 [US1] `src/features/accounts/screens/BoxList.tsx` + `AppDrawer.tsx` — **box-switcher bottom sheet** (rows + Testovací tag + active ✓ + ⋯ + dashed "Přidat schránku" + "Nastavení"); inbox-first IA.
- [X] T028 [US1] `src/features/accounts/screens/AddBoxForm.tsx` — method picker, Pokročilé → Ostré/Testovací, creds (eye toggle, MK hint), **OTP-suggestion card** (→ switch to SMS).
- [X] T029 [US1] `src/features/accounts/screens/LoginFlow.tsx` (+ Mobile-Key waiting view) — pulsing halo (`rpulse`, **Reduce-Motion** static), waiting/expired/retry/cancel; advance on the `mepWsStateUpdate2` **poll** — **do NOT add the demo-confirm button**.
- [X] T030 [US1] `src/features/accounts/screens/OtpForm.tsx` — re-skin 6-digit input + confirm + resend.
- [X] T031 [US1] `src/features/accounts/screens/ReauthForm.tsx` — **locked identity card**, method chip, error banner, password+eye, submit; (+ inbox "session expired" strip wired in T020).
- [X] T032 [US1] `src/features/accounts/screens/BoxOverflowMenu.tsx` + `AliasEditor.tsx` + `RemoveBoxDialog.tsx` — ⋯ action sheet + rename + remove dialogs.

### App
- [X] T033 [US1] `src/app/AppShell.tsx` — inbox-first routing; splash re-skin; mount the shell **Testovací banner above all headers** (normal flow, pushes content down).
- [X] T034 [US1] `src/app/TestEnvBanner.tsx` — restyle to paper test tokens (`activeIsTest` band).
- [X] T035 [US1] `src/app/settings/SettingsScreen.tsx` — re-skin appearance/language/security/backup/about; add **"Upozornění"** row (opens priming); keep the deadlines/scan row **gated to 010**; **OMIT the demo "States" section** (negative contract).
- [X] T036 [US1] `src/app/lock/LockGate.tsx` (`LockScreen`) — re-skin (logo, unlock title/sub/hint).
- [X] T037 [US1] `src/app/notifications/NotificationPrime.tsx` — re-skin sheet; **"Zapnout" fires the REAL OS permission request** (not a dismiss).
- [X] T038 [US1] `src/app/Snackbar.tsx` — paper `text`-fill bar + gold action (markup/layout pass; colors already token-fixed in T016).
- [X] T039 [US1] Welcome/first-run screen in the add-box entry path — built with logo, tagline and [Přidat datovou schránku], plus a FAQ link. ~~**[Obnovit ze zálohy] was deliberately not shipped** (see the `Welcome.tsx` header).~~ *2026-09-24:* [Obnovit ze zálohy] ships under the primary action, since backup (006) and the transfer (025) exist - on Android it reads "Obnovit z jiného telefonu nebo ze zálohy". It opens the backup screen in a first-run mode (025 note of the same date). Welcome also has a language switch in its top corner. Tests: `__tests__/accounts/welcome.test.tsx`. Its metrics are the app's own text-button ones, not read off the design, which was not re-synced for it - check against Claude Design on the next design pass. *2026-09-24, after the owner's emulator review:* the text button read as a caption, so it is now a **secondary button** directly under the primary - the primary's 300dp cap, 54dp height and radius 16, outlined as TelemetryConsent's "Neodesílat" (1px `borderStrong`, `text` label, no fill or shadow), `space.md` between the two, the backup glyph (`BackupIcon`, the one the screens behind it use) leading the label at 18dp with `space.md` as on the lock screen's Odemknout. Copy cut to fit one line: "Obnovit z telefonu nebo zálohy" / "Restore from phone or backup" (iOS "Obnovit ze zálohy" / "Restore from a backup") - measured from Public Sans Bold's advance widths at 16pt (234.8 / 230.4dp + 28 for the icon, against 268dp inside the button on a 360dp phone; kerning not counted, which only narrows it). The language corner is now a **picker**: the language in use (flag, own name, a 16dp chevron as on "Pokročilé") opening `LanguageSheet` - every entry of `LANGUAGES`, as the same rows Settings shows (`LanguageChoice`), in the shared `theme/BottomSheet` (the Termín picker's chrome, which it now uses too). Tests: `welcome.test.tsx`, `welcomeLanguages.test.tsx` (a list of three), `__tests__/app/localeRace.test.tsx` (English picked on a first launch coming back as Czech). Still owed: the same check against Claude Design, and the device walk in 025's amendment.

---

## Phase 4: US3 — Brand mark placements

**Goal**: Our `LogoMark` (not the design's inline envelope) at the design's sizes, legible on `bg`.

- [X] T040 [US3] Place `src/assets/logo.svg` (`LogoMark`) on welcome (128), inbox header (28), lock (104), add-box header, and box-switcher; verify contrast in light + dark; recolor only if AA demands. *As built, later:* the logo is on Welcome (120), the launch screen (84) and Licences (40); Lock shows a 104px brand tile with the brand padlock instead; the inbox header, add-box header and box switcher do not carry it.

---

## Phase 5: US2 — Visual-identity consistency

**Goal**: One coherent identity; same pattern → same metrics everywhere.

- [X] T041 [US2] Reuse audit: confirm every screen composes the shared `src/theme/*` primitives + `Typography` roles; fix any per-screen hand-tuned spacing/radius/border so reused patterns share metrics (design-system.md §3).
- [X] T042 [US2] Run the hardcoded-hex guard (T003) across `src/` — zero raw color literals outside the three sanctioned palette files.

---

## Phase 6: Polish & Cross-Cutting

- [X] T043 [P] Dark-mode **contrast (AA) audit** across all screens; confirm no light-only literal leaks (chips, faint text, warning ink, info/danger/success surfaces).
- [X] T044 [P] **No-layout-jump audit**: sync line, badges, spinners, offline/reauth strips all reserve space; neighbors never move.
- [X] T045 [P] Screen **smoke tests** rendered under both `lightTheme` and `darkTheme` in `__tests__/` (inbox, detail, compose, settings, add-box, switcher).
- [X] T046 [P] **Fonts-offline** (airplane-mode) check + missing-font fallback keeps metrics.
- [X] T047 `npm run lint`, `npm test`, `tsc --noEmit` all clean.
- [X] T048 **czebox manual walkthrough** per quickstart.md (cs/en × light/dark, every screen) — Principle VII sign-off.

---

## Dependencies

- **Phase 1 → Phase 2 → Phase 3 → (Phase 4, Phase 5) → Phase 6.**
- Phase 2 internal: T004→T005→T006 (tokens) and T007 (fonts, needs T001/T002) first; then T008–T016 (primitives/escapes, mostly [P]); T017–T018 [P] anytime after tokens; **T019 (fikce helper)** anytime in Phase 2 — it gates the inbox attention section (T020).
- Phase 3: independent **across files** (most [US1] tasks touch different screens). Same-file pairs are sequential: T020→T021 (MessageList), T022→T023 (MessageDetail), T024→T025 (ComposeScreen); T032 bundles 3 dialog files (split if parallelizing).
- Phase 4/5 depend on Phase 3 complete; Phase 6 last.

## Parallel example (after Foundation)
```
# Restyle primitives together (Phase 2):
T008, T009, T010, T011, T012, T013, T014, T015  (all [P], different files)
# Port screens together (Phase 3), one agent per file:
T022(+T023), T024(+T025), T026, T028, T030, T031, T033, T034, T035, T036, T037, T039
```

## Implementation strategy
- **MVP** = Phase 2 (Foundation, incl. T019 fikce helper) + the core US1 screens **T020, T022, T024**
  (inbox/detail/compose) → a usable, on-brand app. Full parity = all of Phase 3.
- Deliver incrementally per screen; each screen is independently verifiable in both schemes/languages.
- Keep the **negative contract** in view (T029 poll-not-demo, T035 no "States" section, T037 real OS
  prompt). New deadline behaviors stay in 010.

**Totals**: 48 tasks — Setup 3 · Foundational 16 · US1 20 · US3 1 · US2 2 · Polish 6. Parallel
opportunities: ~8 primitives (Phase 2) and ~12 screens (Phase 3).
