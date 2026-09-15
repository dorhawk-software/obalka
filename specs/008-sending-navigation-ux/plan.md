# Implementation Plan: Sending & Navigation UX

> **As built, later.** 011 replaced the drawer and the box list with the switcher sheet
> (`BoxSwitcherSheet.tsx`), so box rows no longer swipe, and the inline `TestEnvBadge` is gone — the
> test environment shows as the `TestEnvBanner` bar on the message detail only, and a *Testovací* tag
> on the list header and box rows.

**Branch**: `008-sending-navigation-ux` | **Date**: 2026-06-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-sending-navigation-ux/spec.md` + design doc
[`docs/ux/sending-navigation-ux-plan.md`](../../docs/ux/sending-navigation-ux-plan.md)

## Summary

Sending (005) broke the read-only navigation model: three "create/act" intents (compose / add box /
rename box) now collide on a bare `+` and a pencil, and there's **no way to see sent mail**. This
feature re-establishes a coherent action model and modernizes the UI, with **no new backend** (all the
ISDS plumbing exists). Five tracks: (1) a **`Přijaté | Odeslané` segmented control** in the box message
list backed by a folder-aware cache; (2) **home IA** — drop the bare `+`, move "add box" into the `☰`
menu, keep compose only inside a box; (3) a per-box **overflow `⋯` menu** (rename / remove) replacing
the inline pencil+trash; (4) a shell-level **persistent "Testovací" banner** for czebox boxes; (5)
**design-system conformance + modernization** — conform to/extend `docs/ui-guide.md`, add
**swipe-to-delete** (with the overflow menu as the a11y fallback), and *evaluate + selectively adopt*
**both** current OS design languages as **co-equal** references — **iOS 26 Liquid Glass** *and* **Android
Material 3 / "Expressive"** (Android is our primary build/test platform) — platform-adaptive where they
diverge (segmented control ↔ connected button group; glass ↔ tonal elevation; Material ripple/haptics +
spring motion), within bare-RN + accessibility limits.

**Already done (reconciled from 005, NOT re-planned):** fulltext recipient search via `ISDSSearch3`
(all box types, debounced, 🔍 + free/paid badges). The spec's "recipient search" item is **complete**.

## Technical Context

**Language/Version**: TypeScript (strict), React Native 0.86 (bare CLI, New Architecture / Fabric).
**Primary Dependencies**: React Navigation (native-stack), Tamagui (UI, via `src/theme/*` tokens +
`docs/ui-guide.md`), `react-native-blob-util`. **NEW (for swipe):** `react-native-gesture-handler` +
`react-native-reanimated` — **currently MISSING**, must be added (native deps → APK rebuild; verify
New-Arch compatibility). 
**Storage**: SQLite (encrypted at rest) via the existing `messagesStore` + migration runner; the sent
list is cached alongside received (needs a `folder` dimension — see data-model).
**Testing**: Jest + @testing-library/react-native (unit + screen smoke); manual run-through on the
Android emulator against a czebox test box (Principle VII).
**Target Platform**: Android + iOS (this repo currently builds/validates on the Android emulator).
**Project Type**: Mobile app (single RN project; feature code under `src/features/*`, `src/app/*`).
**Performance Goals**: 60 fps lists; swipe gestures + any blur run on the native UI thread, never the
JS thread (Principle I). Sent-list fetch is async + cancellable.
**Constraints**: Czech-first; working dark mode preserved; **WCAG AA** contrast; honour **Reduce
Transparency / Reduce Motion** (opaque, motionless fallbacks); the durable local archive is sacred
(Principle IV) — destructive gestures must not silently delete archived mail.
**Scale/Scope**: UI-heavy, low-backend-risk. ~5 tracks, a handful of screens/components; one new DB
migration; two new native deps gated behind a research spike.

## Constitution Check

*GATE: must pass before Phase 0. Re-checked after Phase 1.*

| Principle | Assessment |
|---|---|
| **I — Never block the UI thread (NON-NEG)** | ✅ Sent-list fetch is async/cancellable (reuses the typed-outcome controller). Swipe + any Liquid-Glass blur run on the **native** UI thread (gesture-handler/reanimated) — *better* than JS-driven animation. Risk: reanimated misconfig on New Arch → spike B0 verifies a clean build before relying on it. |
| **II — Crash-resilient by contract (NON-NEG)** | ✅ `listSent` mirrors `listReceived`: typed outcome, offline cache fallback, localized error+retry, never throws. |
| **III — Privacy, on-device only** | ✅ No new network beyond ISDS `GetListOfSentMessages` (already wired); no backend; no new secrets. |
| **IV — The local archive is sacred** | ⚠️ **Watch item.** Swipe-to-delete on **message** rows must NOT silently delete archived mail. Resolution (research §swipe): the destructive swipe is **Archive/safe** for messages, is reserved for **drafts** (ephemeral) and **box removal** (the existing confirm dialog) where deletion is intended, and any message-level removal keeps the durable archive. No silent loss. |
| **V — Modern, accessible, Czech-first** | ✅ This feature *is* Principle V. Swipe keeps a non-gesture overflow-menu fallback (a11y); glass honours Reduce Transparency + AA; dark mode not regressed; all strings cs/en. |
| **VI — Honest scope** | ✅ iOS 26 Liquid Glass is "*evaluate + selectively adopt*", not a literal promise (RN has no native glass). Nothing announced before it works. |
| **VII — Verify on czebox** | ✅ Sent view + swipe validated on a czebox box on the emulator before done. |

**Gate result: PASS** (one watch-item — Principle IV — resolved in research, tracked in the plan; no
NON-NEGOTIABLE violation). No Complexity-Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/008-sending-navigation-ux/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions (sent cache, swipe lib, glass scope, banner, menu)
├── data-model.md        # Phase 1 — folder-aware message cache, segment/sent entities
├── quickstart.md        # Phase 1 — czebox acceptance scenarios
├── contracts/           # Phase 1 — UI contracts (segmented list, overflow menu, swipe row, banner)
└── tasks.md             # Phase 2 — /speckit.tasks (NOT created here)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── AppNavigator.tsx          # route wiring (Messages screen gains a folder param/segment)
│   ├── AppShell.tsx              # mount the shell-level Testovací banner here
│   └── TestEnvBanner.tsx         # NEW — full-width "Testovací" top bar (shell-level)
├── features/
│   ├── accounts/screens/
│   │   ├── BoxList.tsx           # drop bare `+`; per-box ⋯ overflow menu; swipe-to-remove a box
│   │   ├── AppDrawer.tsx         # gains "Přidat schránku" (add box moves here)
│   │   └── BoxOverflowMenu.tsx   # NEW — ⋯ menu (Přejmenovat / Odebrat)
│   └── messages/
│       ├── screens/
│       │   ├── MessageList.tsx   # Přijaté | Odeslané segmented control; folder-aware load
│       │   ├── MessageDetail.tsx # sent orientation (you → recipient)
│       │   └── SegmentedControl.tsx  # NEW (or theme/) — the Received|Sent segments
│       └── state/messagesController.ts  # NEW listSent() (mirrors listReceived), folder-aware cache reads
├── services/db/
│   ├── messagesStore.ts          # folder-aware cache (received|sent)
│   └── migrations.ts             # NEW migration: messages.folder column
└── theme/                        # SwipeableRow primitive; any floating/translucent surface tokens
```

**Structure Decision**: Single RN project (Option 3 "mobile", no API tier — direct device→ISDS).
Feature code lands in the existing `src/features/{accounts,messages}` + `src/app` + `src/services/db`
trees; the only new top-level concept is the shell `TestEnvBanner` and a reusable `SwipeableRow`.

## Phase sequencing (research-gated)

1. **Spike B0 (gate):** add `react-native-gesture-handler` + `react-native-reanimated`, confirm a clean
   New-Arch Android build + a working trailing-swipe row, AND fetch/learn the iOS 26 Liquid Glass +
   Material 3 references to decide the *concrete, bounded* visual adoption (or defer it). Nothing in
   track 5 ships before this spike resolves.
2. Tracks 1–4 (Sent view, home IA, overflow menu, Testovací banner) are **independent of the spike**
   and can proceed in parallel — pure RN + existing deps.

## Complexity Tracking

*No constitution violations requiring justification.* (The two new native deps are standard RN
animation/gesture libraries, gated behind a build spike; the `folder` cache column is a minimal
additive migration.)
