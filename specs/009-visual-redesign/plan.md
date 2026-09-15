# Implementation Plan: Visual Redesign — "Paper" theme port

**Branch**: `009-visual-redesign` | **Date**: 2026-06-30 | **Spec**: [spec.md](./spec.md)
**Input**: [spec.md](./spec.md) + the imported design (`Obalka Redesign.dc.html`) captured in
[`design-system.md`](./design-system.md); confirmed Claude Design outputs tracked in
[`design-prompts.md`](./design-prompts.md).

## Summary

Re-skin **and** re-layout every currently-implemented screen to a new warm-"paper" identity (new
neutral ramp, brand blue/gold retained) with a two-family type system (**Bricolage Grotesque** display
+ **Public Sans** body) and the design's reorganized inbox (box-switcher header button, `Přijaté |
Odeslané` segmented control, "Vyžaduje pozornost" + "Dříve" sections, gold compose FAB, constant-height
sync line). **Presentation-layer only** — no new behavior, no backend, no new persisted data. The
re-color is centralized in `src/theme/theme.ts` (29 semantic keys + 3 new test-env keys) consumed via
`useTheme()`, so it cascades from one file; the work is (a) the token swap, (b) bundling two fonts and
wiring the `typography.ts` roles, (c) restyling the shared `src/theme/*` primitives once, (d) the
per-screen layout deltas the design introduces, (e) replacing the design's inline envelope with our
`LogoMark`, and (f) fixing the handful of hardcoded-color escapes. New deadline/attention behaviors are
**out of scope** (spec 010); the inbox attention section renders from the deterministic *fikce* signal
(010 US1) or is gated so the list degrades cleanly if 010 isn't built yet.

## Technical Context

**Language/Version**: TypeScript (strict), React Native 0.86 (bare CLI, New Architecture / Fabric).
**Primary Dependencies**: React Navigation (native-stack); Tamagui primitives via `src/theme/ui.tsx` +
the `useTheme()` palette (NOT Tamagui theme tokens); `react-native-svg` + `react-native-svg-transformer`
(the `LogoMark`). **NEW:** two bundled font families (`Bricolage Grotesque`, `Public Sans` `.ttf`s) via
`react-native.config.js` assets + `npx react-native-asset` (Android `assets/fonts`, iOS `UIAppFonts`).
Design animations `rprog`/`rpulse`/`rspin` map to RN `Animated` (or `react-native-reanimated` **iff**
already present from 008 — NEEDS CHECK; simple loops don't require it). 
**Storage**: None new. Theme tokens are code constants; the sent/`folder` cache already exists (008).
No migration.
**Testing**: Jest + @testing-library/react-native — screen smoke in **both** color schemes + a
hardcoded-hex audit; manual run-through on the Android emulator against a czebox box (Principle VII).
**Target Platform**: Android (primary build/test, x86_64 emulator) + iOS.
**Project Type**: Mobile app (single RN project; `src/features/*`, `src/app/*`, `src/theme/*`).
**Performance Goals**: 60 fps; **font load + theme resolve MUST NOT block launch or the UI thread**
(Principle I); transient indicators are constant-height (no reflow).
**Constraints**: Czech-first (copy unchanged); real dark mode (no light-only literal may leak); **WCAG
AA**; **no layout jumps**; honour Reduce-Motion / Reduce-Transparency; the local archive stays sacred
(no destructive change). 
**Scale/Scope**: ~18 design states across ~14 screen files + ~12 shared `src/theme/*` primitives; one
theme file; one typography wiring; font bundling (APK/IPA rebuild). UI-only, zero backend risk.

## Constitution Check

*GATE: must pass before Phase 0. Re-checked after Phase 1.*

| Principle | Assessment |
|---|---|
| **I — Never block the UI thread (NON-NEG)** | ✅ Pure presentation. Risk: a font-load stall on launch → mitigate by bundling fonts (no network), system-sans fallback, and never gating first paint on fonts. Animations are native-driver/`Animated` loops, not JS-thread churn. |
| **II — Crash-resilient by contract (NON-NEG)** | ✅ No new flows. The re-skinned error/offline/retry states (inbox `loadError`, reauth error) preserve the existing typed-outcome + retry paths; never throw. |
| **III — Privacy, on-device only** | ✅ No network, no secrets, no backend. Fonts are bundled assets. |
| **IV — The local archive is sacred** | ✅ No data changes; the re-skinned attachment "unavailable" state still distinguishes "in local archive" from "gone from ISDS". |
| **V — Modern, accessible, Czech-first** | ✅ This feature *is* Principle V. Watch-items, all tracked: AA contrast in **both** schemes (derive dark variants for the light-only accent literals); **no layout jumps** (constant-height sync line, reserved slots); consistency (tokens/metrics from `design-system.md` only); copy unchanged + new strings cs/en. |
| **VI — Honest scope** | ✅ Mock-only bits are explicitly **not** ported (Settings "States" preview toggles; the MK demo-confirm button; the notif-enable must call the real OS prompt). The **primary-button** colour change is propagated to `docs/ui-guide.md` (no silent drift). |
| **VII — Verify on czebox** | ✅ Every re-skinned screen walked on a czebox box (both schemes, cs/en) before done. |

**Gate result: PASS.** No NON-NEGOTIABLE violation; no Complexity-Tracking entries required. The two
new native deps from 008 (gesture-handler/reanimated) are **not** required by 009 — animations degrade
to `Animated`; if reanimated is already in the tree it may be used.

## Project Structure

### Documentation (this feature)

```text
specs/009-visual-redesign/
├── plan.md              # This file
├── spec.md              # The what & why
├── design-system.md     # Authoritative token/type/component + per-screen reference (the UI contract)
├── design-prompts.md    # Claude Design prompts (all confirmed) for screens the base design omitted
├── research.md          # Phase 0 — font bundling, dark-variant derivation, swap strategy, IA, animations
├── data-model.md        # Phase 1 — Theme token additions (no persisted entities)
├── quickstart.md        # Phase 1 — czebox acceptance walkthrough (both schemes, cs/en)
├── contracts/
│   └── ui-contracts.md  # Phase 1 — per-screen port contract + the token/typography contract
└── tasks.md             # Phase 2 — /speckit.tasks (NOT created here)
```

### Source Code (repository root)

> **As built, later.** Some files named below were removed or replaced after 009 shipped:
> `src/theme/fileBadge.ts` is gone, `TestEnvBadge` became the `TestEnvBanner` bar plus a *Testovací* tag on
> box rows, `BoxList` / `AppDrawer` became 011's `BoxSwitcherSheet`, and `NotificationPrime` was deleted by 014.

```text
assets/
└── fonts/                         # NEW — BricolageGrotesque-*.ttf, PublicSans-*.ttf
react-native.config.js             # NEW/edit — assets: ['./assets/fonts']
src/
├── theme/
│   ├── theme.ts                   # ⭐ palette swap (29 keys → paper values) + testBg/testFg/testBd (+ bodyText)
│   ├── typography.ts              # fontFamily per role (Bricolage display/heading; Public Sans body)
│   ├── Typography.tsx             # role components inherit the new families
│   ├── ui.tsx / theme primitives  # SegmentedControl, Avatar, Fab, ScreenHeader, EmptyState, Skeleton,
│   │                              #   OptionGroup, SwipeableRow, PressScale, TestEnvBadge — restyle once
│   ├── avatar.ts / fileBadge.ts   # reconcile hardcoded palettes with the warm scheme
│   └── icons.tsx                  # re-themeable stroke icons (color via tokens) — add any new glyphs
├── app/
│   ├── AppShell.tsx               # inbox-first IA; splash; mount the shell test banner above headers
│   ├── TestEnvBanner.tsx          # restyle to the paper test tokens (activeIsTest band)
│   ├── Snackbar.tsx               # drop hardcoded #222A33 → token-driven (text fill, gold action)
│   ├── settings/SettingsScreen.tsx# re-skin sections; add "Upozornění" row; OMIT the demo "States" section
│   ├── lock/LockGate.tsx          # re-skin LockScreen
│   └── notifications/NotificationPrime.tsx # re-skin sheet; keep the real OS-permission request
├── features/
│   ├── messages/screens/
│   │   ├── MessageList.tsx        # new inbox layout: switcher header, segmented control, attention/earlier,
│   │   │                          #   sync line, offline/error states, sent list, FAB
│   │   ├── MessageDetail.tsx      # postmark card; multi-attachment list + download-all + unavailable; (sent detail orientation)
│   │   ├── ComposeScreen.tsx      # recipient/cost/drafts re-skin; attachment chips + add; paid-send confirm sheet
│   │   └── SearchScreen.tsx       # re-skin; empty state
│   └── accounts/screens/
│       ├── BoxList.tsx / AppDrawer.tsx        # box-switcher BOTTOM SHEET (rows + active + ⋯ + add + settings)
│       ├── AddBoxForm.tsx / LoginFlow.tsx     # method picker, creds, env, OTP-suggestion card, MK waiting
│       ├── OtpForm.tsx / ReauthForm.tsx       # re-skin; reauth locked-identity card + inbox expired strip
│       ├── BoxOverflowMenu.tsx                # ⋯ action sheet
│       └── AliasEditor.tsx / RemoveBoxDialog.tsx # rename / remove dialogs
└── i18n/strings.ts                # add the new cs/en keys (sent/test/sync/empty/attach/reauth/notif/…)
docs/ui-guide.md                   # update: warm ramp, two-family type, dark high-contrast primary button
```

**Structure Decision**: Single RN project (no API tier). All changes land in the existing
`src/theme`, `src/features/{messages,accounts}`, `src/app`, `src/i18n` trees plus a new `assets/fonts`.
The one cross-cutting concept is the centralized token swap in `theme.ts`.

## Phase sequencing

1. **Foundation (cascades everywhere):** `theme.ts` palette swap + new test tokens; font bundling +
   `typography.ts` wiring; restyle the shared `src/theme/*` primitives; fix the hardcoded-color escapes
   (Snackbar, scrims, `avatar.ts`/`fileBadge.ts`); update `docs/ui-guide.md`. After this the whole app
   is re-colored/typed; screens then only need layout deltas.
2. **Screens (parallelizable):** messages (inbox/detail/compose/search), accounts (switcher/add-box/
   otp/reauth/dialogs/overflow), app (settings/lock/snackbar/notif-prime/test-banner).
3. **Polish & verify:** dark-mode contrast audit (no light-only leak), no-layout-jump audit, fonts-offline
   check, czebox walkthrough (cs/en, light/dark).

## Complexity Tracking

*No constitution violations requiring justification.* (No new deps mandated; no data model; the font
bundle is standard RN asset linking. The 3 mock-only design bits are intentionally not ported.)
