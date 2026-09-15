# Feature Specification: Visual Redesign — "Paper" theme port

**Feature Branch**: `009-visual-redesign`
**Created**: 2026-06-30
**Status**: Implemented (48/48). It ran **specs-first** (no UI code until specs + design-prompts were approved, per a
decision on 2026-06-30). Later features changed some files named below: `src/theme/fileBadge.ts` and `TestEnvBadge` have since been removed, `NotificationPrime` went with 014, and `BoxList` / `AppDrawer` became 011's switcher sheet. Design source + tokens: [`design-system.md`](./design-system.md). Prompts for
screens the design omits: [`design-prompts.md`](./design-prompts.md).
**Input**: User adopted a new design direction (warm "paper" palette + Bricolage Grotesque / Public
Sans), authored in the Claude Design project and imported as `Obalka Redesign.dc.html`. Directive:
*port **all** currently-implemented features to the new design; use **our** logo (the design's envelope
mark is too small); new features the design introduces → a separate spec (010); any existing feature
the design has **no** section for → produce a Claude Design prompt rather than invent the screen.*

## Problem / Why

The app's current look (cool-navy ramp, single-family type) is being replaced wholesale by a warmer,
more distinctive "paper" identity with a two-family type system and a reorganized inbox. This is a
**re-skin + re-layout of existing functionality**, not new behavior. It must land without regressing
any shipped feature, dark mode, accessibility, or the Czech-first copy.

## Scope

**In scope** — porting every implemented screen/feature to the new design:
- Inbox (message list), message detail, compose (+ recipient search & cost), search.
- Settings, app-lock, OTP login, add-box (method → credentials → prod/test env).
- Box switcher, per-box overflow menu, rename dialog, remove dialog, snackbar.
- Welcome/first-run screen (the design adds one; build it as part of the re-skin).
- The global **palette swap** (`src/theme/theme.ts`) + **typography** (bundle Bricolage Grotesque +
  Public Sans) + restyling shared primitives in `src/theme/*`.
- Replacing the design's inline envelope mark with **our `LogoMark`** at the design's sizes.

**Out of scope** (separate specs / later):
- New behaviors the design implies — "Vyžaduje pozornost" grouping, deadline chips, term reminders,
  on-device attachment scanning → **spec 010** (spec-only for now; the inbox grouping renders from the
  deterministic *fikce* signal so the section isn't empty — see 010).
- Backup Hub / Setup / Restore — designed here but is the unbuilt **feature 006**; not built in 009.
- Screens the design omits but we already ship → designed via [`design-prompts.md`](./design-prompts.md),
  then ported in a follow-up.
- The **"Vše/All"** chronological segment (a 3rd segment merging received + sent) — stays **deferred**
  (originally 008 out-of-scope; see `008/spec.md` + `docs/ux/sending-navigation-ux-plan.md`). The
  redesign keeps the 2-segment `Přijaté | Odeslané` control; revisit "Vše" later if users ask.

## Relationship to feature 008

009 **supersedes the *visual* direction** of 008 track 5 (the "evaluate iOS 26 Liquid Glass / Material
3" modernization) with this concrete design. It **preserves 008's functional decisions**: a Sent view
exists, add-box lives in the menu (no bare `+`), per-box overflow `⋯` (rename/remove), fulltext
recipient search with free/paid badges, and the persistent **Testovací** banner. Two 008 elements have
**no section in the new design** and are routed to `design-prompts.md`: the `Přijaté | Odeslané`
**sent-mail** control and the **Testovací** banner.

## Design decisions (confirmed)

- **Centralized re-color.** Screens consume `useTheme()` semantic tokens, so the palette swap is one
  file (`theme.ts`, 29 keys) per [`design-system.md` §4](./design-system.md), plus a short list of
  hardcoded-color exceptions (Snackbar `#222A33`, `#000` scrims, `avatar.ts`/`fileBadge.ts` palettes).
- **Two-family type.** Bricolage Grotesque (display/headings) + Public Sans (body/UI), bundled as
  app fonts; set via the existing `typography.ts` roles.
- **Dark primary buttons.** The design's primary action is a near-black `text`-filled button (blue is
  reserved for selection/info). This **changes `docs/ui-guide.md` §5** — update the guide to match.
- **Our logo.** `src/assets/logo.svg` (blue body + gold flap) is the brand mark wherever the design
  draws its small envelope; keep brand blue+gold (the design's envelope is the same idea).
- **Box switcher becomes a bottom sheet** (avatar rows + active check + per-row `⋯` + dashed "Přidat
  schránku" + "Nastavení"), replacing/augmenting today's `BoxList` + left `AppDrawer`.
- **Inbox reorganizes** into a "Vyžaduje pozornost" group + a "Dříve" list, a sunken box-switcher
  button in the header, a search icon-button, and a gold compose FAB. (The attention grouping's data
  comes from 010; visual shell ships in 009.)

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Re-skin without regressions (Priority: P1)

Every existing screen renders in the new "paper" design — light **and** dark — with no feature lost,
no copy changed, and no layout jump, on the Android emulator against a czebox box.

**Why this priority**: This is the entire feature; it must not regress shipped functionality (II/IV).

**Independent Test**: Walk every route (home/switcher → inbox → detail → compose → search → settings →
add-box → otp → lock → dialogs/snackbar) in both color schemes and both languages; confirm parity with
the pre-redesign behavior and the design's pixels.

**Acceptance Scenarios**:
1. **Given** the app on light mode, **When** I open each screen, **Then** colors/type/spacing/radii
   match `design-system.md` and `Obalka Redesign.dc.html`.
2. **Given** dark mode, **When** I open each screen, **Then** every surface/text/accent has an
   AA-passing dark value (no light-only literal leaks; no black-on-black).
3. **Given** Czech and English, **When** I switch language, **Then** all copy is unchanged from today
   and re-renders correctly.
4. **Given** a transient indicator (sync line, spinner, badge) appears/disappears, **When** it toggles,
   **Then** no neighbor shifts (Principle V — no layout jumps).

### User Story 2 — New visual identity applied consistently (Priority: P1)

The palette, type, and component metrics come **only** from the documented scale (`design-system.md`),
reused identically across screens (Principle V).

**Why this priority**: Visual consistency is a top constitutional priority; the whole point of the
redesign is a coherent identity.

**Independent Test**: Diff the shared primitives (`Avatar`, `Fab`, `SegmentedControl`, `ScreenHeader`,
`Snackbar`, dialogs, sheets) — each uses the same tokens/metrics everywhere it appears.

**Acceptance Scenarios**:
1. **Given** two screens using the same pattern (e.g. a selector row), **When** compared, **Then** they
   share padding/radius/border/elevation.
2. **Given** the new fonts, **When** the app loads offline, **Then** Bricolage/Public Sans render from
   the bundle (not a network fetch).

### User Story 3 — Our brand mark, sized per design (Priority: P2)

Our `LogoMark` appears wherever the design used its (too-small) envelope — welcome, inbox header, lock,
add-box, switcher — at the design's sizes and legible on `bg`.

**Why this priority**: Explicit user requirement; brand correctness.

**Independent Test**: Confirm `LogoMark` (not the design's inline SVG) renders at each placement and
passes contrast on the paper background.

**Acceptance Scenarios**:
1. **Given** the welcome/inbox/lock screens, **When** rendered, **Then** our envelope logo shows at the
   specified size with adequate contrast in light and dark.

### Edge Cases
- A token used by a screen has no dark value yet (light-only accent literal) → must be derived before
  ship; no light surface may appear in dark mode.
- The new fonts fail to load on a device → fall back to system sans without breaking layout/line-height.
- Long Czech strings (compound words) in the tighter headings → must not clip or force layout jumps.
- Reduce-Motion / Reduce-Transparency settings → animations/translucency degrade to static/opaque.

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: The system MUST render all currently-implemented screens in the new design tokens
  (light + dark) without removing or altering any existing capability or copy.
- **FR-002**: The palette swap MUST be centralized in `src/theme/theme.ts` per `design-system.md §4`;
  the listed hardcoded-color exceptions MUST be converted to tokens.
- **FR-003**: Every color literal MUST have an AA-passing value in **both** schemes; no light-only
  literal may leak into dark mode.
- **FR-004**: The system MUST bundle Bricolage Grotesque + Public Sans as app fonts and apply them via
  the `typography.ts` roles; text MUST render offline.
- **FR-005**: Our `LogoMark` MUST replace the design's inline envelope at every placement, at the
  design's sizes.
- **FR-006**: The primary-button style MUST become the design's dark high-contrast form; `docs/ui-guide.md`
  MUST be updated to reflect the new primary, fonts, and warm ramp.
- **FR-007**: Shared primitives MUST be restyled once and reused; the same pattern MUST share metrics
  across screens (no per-screen hand-tuning).
- **FR-008**: The inbox MUST present the new layout (box-switcher header button, search icon-button,
  "Vyžaduje pozornost" + "Dříve" sections, gold compose FAB). The attention/chips data binding is
  specified in 010; in 009 the section renders from the deterministic fikce signal (010 P1) or, if 010
  is deferred, is gated so the inbox degrades to a single received list with no empty section.
- **FR-009**: The box switcher MUST be the new bottom sheet (box rows + active check + per-row overflow
  + add-box + settings), preserving today's box-switching, rename, and remove behaviors.
- **FR-010**: No transient/async element may cause a layout jump (Principle V); reserve space up front.
- **FR-011**: The redesign MUST NOT introduce any UI-thread-blocking work or remove an existing
  error/retry path (Principles I, II).
- **FR-012**: Sent mail and the Testovací banner MUST keep working; their new-design layout is taken
  from the approved Claude Design outputs (`design-prompts.md`) — 009 does not invent them.

### Key Entities
- *(none new — this is a presentation-layer change; data entities are unchanged. New deadline entities
  live in 010.)*

## Success Criteria *(mandatory)*

- **SC-001**: 100% of implemented routes render in the new design in light **and** dark with no feature
  regression (manual walk-through on czebox).
- **SC-002**: Zero light-only color literals remain in dark mode (audit of hardcoded hex).
- **SC-003**: All visible text meets WCAG AA (≥4.5:1 body, ≥3:1 large) in both schemes.
- **SC-004**: No layout jump observed when any transient indicator toggles on any screen.
- **SC-005**: `npm run lint`, `npm test`, `tsc --noEmit` pass; the app launches without blocking the UI
  thread (Principle I).
- **SC-006**: Fonts render with the app offline (airplane mode).

## Assumptions
- The new palette maps onto the existing 29 semantic keys (+ a couple of additions) — confirmed by the
  inventory; no screen reads raw hex except the listed exceptions.
- Backup (006) and the deadline behaviors (010) are **not** built here; 009 is presentation-only.
- The design's status-bar / gesture-nav chrome is mock-only; the real OS provides those.
- Light-only accent literals (`#EEF4FB`, `#F7E4E1`, `#E2F0E8`, `#FBEFD0`) get derived dark counterparts
  during the port.
- Native font bundling triggers an APK/IPA rebuild (Android x86_64 emulator loop per project memory).
