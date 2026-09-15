# Feature Specification: Appearance, Settings & Localization

**Feature Branch**: `007-appearance-and-settings` (built on `master` alongside 001/002)
**Created**: 2026-06-12
**Status**: Implemented (design system + dark mode + theme/language settings + build version); live-validated on the emulator. **Superseded in part:** the Reddit-style home described below (drawer, `+`, box list, pull-to-refresh on the boxes) was replaced by 011's inbox-first navigation and switcher sheet, and 009 redesigned the header. 009 also superseded FR-003 (radius/elevation - see [`DESIGN.md`](../../DESIGN.md)), FR-007 (the brand band; `BrandHeader.tsx` is unused) and FR-008 (the selector look and the appearance icons), and the first-run language toggle in US3 is gone - language is chosen in Settings only. `react-native-reanimated` and `react-native-gesture-handler` are now dependencies, so the constraint argued under *Deferred* no longer holds. User-orderable boxes are still not built.
**Input**: Roadmap feature 007 — "Design system & accessibility: theming (working dark mode), Czech
l10n, Dynamic Type, density mode." Turn the ad-hoc styling into a consistent, accessible system, and
give the user control over appearance and language (the incumbent's broken dark mode + Czech-only UI
are explicit pain points).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Legible, consistent UI (Priority: P1, cross-cutting)

Every screen uses a shared typography scale and AA-contrast colors; nothing is too small or too
faint. Spacing, radius, borders and shadows are consistent (a component looks the same on every
screen).

**Independent Test**: Audit each screen — body text ≥13px and ≥4.5:1 contrast; the same component
(e.g. method-selector rows) has identical metrics across screens.

### User Story 2 - Choose a theme: light / dark / match system (Priority: P1)

The user opens Settings and picks Light, Dark or System (follows the OS). The choice
applies immediately and persists across restarts. Dark mode is a real, fully-themed mode.

**Acceptance Scenarios**:

1. **Given** Settings is open, **When** the user taps Dark, **Then** the whole app switches to the
   dark palette immediately.
2. **Given** Dark (or Light) is chosen, **When** the app is force-quit and reopened, **Then** the
   choice is restored.
3. **Given** System is chosen, **When** the OS theme changes, **Then** the app follows it.

### User Story 3 - Choose a language: Czech / English (Priority: P1)

The user picks Czech (🇨🇿) or English (🇬🇧) in Settings; the whole UI re-localizes and the choice
persists. Default is **Czech** (the primary audience). ~~A non-Czech user can also switch language
right on the first-run add-box screen, before doing anything else.~~ *Amended 2026-09-14:* language is
chosen only in Settings; the first-run screen is now 009's Welcome (`Welcome.tsx`), and neither it
nor the add-box form offers a language toggle.

**Acceptance Scenarios**:

1. **Given** Settings is open, **When** the user picks English, **Then** every screen re-localizes
   (including plural forms — "1 message" / "2 messages").
2. **Given** a language was chosen, **When** the app restarts, **Then** the language is restored.
3. **Given** a fresh install (no boxes), **When** the user opens the add-box screen, **Then** a
   language toggle is shown so a non-Czech user can switch before signing in.
   **Not in the app today:** neither the first-run Welcome screen (009) nor the add-box form offers a
   language toggle; language is chosen only in Settings.

### User Story 4 - See the app version (Priority: P3)

Settings → About shows the build version.

## Requirements *(mandatory)*

- **FR-001** Typography is a code library: `src/theme/typography.ts` (scale) + `Typography.tsx`
  (role components Display/Title/Heading/Body/BodyStrong/Value/Label/Caption/Badge). Screens compose
  these, never raw `fontSize`/`color`.
- **FR-002** WCAG **AA** contrast: min content size 13px (the smallest role, not enforced - see
  SC-003); `textFaint` darkened to ≥4.5:1 (labels, metadata and timestamps); `warningInk` for amber on
  light; `onGold` for text on the gold accent.
- **FR-003** Consistent radius scale {8/10/14/16/999}, hairline (1) resting borders, an elevation
  scale (`depth.sm/md/lg`) with nested controls flat. Documented in `docs/ui-guide.md` §2–4.
  *Superseded by 009:* radii are 8/11/12/13/14/16/20/24/999 and depth is tonal first (`depth.lg` for
  dialogs and sheets) - see [`DESIGN.md`](../../DESIGN.md) › Shapes and › Elevation & Depth.
- **FR-004** Theme mode `light | dark | system` resolved in `App` (system → OS scheme) and provided
  via `AppThemeProvider(isDark)`; both palettes in `theme.ts`.
- **FR-005** Reactive i18n: `strings.ts` holds cs + a full en map; `setActiveLocale`/`getActiveLocale`
  drive `t()`/`plural()`. A language change re-localizes **in place, without a remount**: each
  native-stack screen subscribes via `useLocale()` (SettingsProvider) so it (and the screen behind
  it) re-renders with the new locale while navigation / scroll / form state is preserved — no reset
  to home, no reload flash. (Replaces the old `<AppShell key={locale}>` remount.)
- **FR-006** Settings (theme mode + language) persist in the `app_settings` key/value table via
  `getSetting`/`setSetting`, loaded by `SettingsProvider` on launch (`ready` gate avoids a flash).
- **FR-007 (withdrawn).** ~~The brand header is a full-bleed tonal band (`surfaceSunken`, rounded, no
  border) whose content sits on the standard content margins, with an optional right action (the
  settings gear).~~ The full-bleed tonal band was built, reverted to a plain brand row, and then
  replaced by 009/011's inbox header; `src/theme/BrandHeader.tsx` is no longer used.
- **FR-008** Single-choice pickers use a compact **grouped selector** (`theme/OptionGroup.tsx`):
  one rounded, bordered container with the options split by hairline dividers (not separate cards
  with gaps). The selected option keeps the highlighted **blue border** (drawn as an inset overlay so
  selecting never shifts layout) + tinted fill + filled radio; dividers adjacent to the selected row
  are dropped. Used by Settings (theme, language), the add-box method picker, and the re-auth method
  picker. The appearance icons are colourful — sun (`accentSun`, warm), moon (`accentMoon`, indigo),
  system/device (`accentDevice`, teal) — so the section reads playful, not grey.
  **Superseded by 009:** `OptionGroup` shows selection only by the filled radio; every row keeps its
  hairline and nothing is tinted. It is used by Settings (theme, language) and the Debug screen. The
  add-box and re-auth method pickers draw their own cards (1.5px blue border + `blueSoft`). The theme
  options carry no icons, and the `accentSun/Moon/Device` tokens are defined but unused.

## Success Criteria

- **SC-001** Theme + language each apply immediately and survive a force-quit + relaunch (validated
  live: Dark + English persisted across a cold restart).
- **SC-002** English UI is complete (no Czech leaking through) including plurals (validated live).
- **SC-003** ~~No body text below 13px or below AA contrast (typography roles enforce it).~~
  **Not met as written:** 13px is the smallest typography role, but about a hundred call sites
  override below it (see [`DESIGN.md`](../../DESIGN.md) › Typography); AA contrast is asserted by
  `__tests__/theme/contrast.test.ts`.

## Notes

- App version is a constant (`src/app/appInfo.ts`) kept in sync with package.json (avoids bundling
  the whole manifest); a native build number could be surfaced later.

## Home navigation (Reddit-style, 2026-06-13)

The home was reworked to a Reddit-app-like layout (user request):

- **Fixed top app bar**: `☰ menu · Obálka brand · +` (a hairline separates it from the list).
- **`+`** (top-right) adds a box — replaces the bottom "Přidat schránku" button.
- **Left slide-in drawer** (`AppDrawer.tsx`, RN `Animated` + `Modal` — deliberately no
  `@react-navigation/drawer` to avoid reanimated/gesture-handler native deps): brand header, a
  **Nastavení** row (→ Settings), and the version footer. Opened by `☰`, dismissed by the overlay.
- **Pull-to-refresh** (RN `RefreshControl`, themed) on the boxes `FlatList` — replaces the header
  reload button. (Per-box "Obnovování…" indicators still show during the refresh.)

## Deferred / TODO

- **TODO(header-separation):** give the app header a proper visual separation from the content (a
  tonal "header bar"). The first attempt — a full-bleed rounded band — looked bad (rounded corners
  jammed against the screen edges) and was reverted to the plain aligned brand row. Revisit with a
  better treatment (e.g. an inset rounded panel whose content still aligns with the page margins, or
  a subtler non-full-bleed approach). `theme.surfaceSunken` is in place for it. *(BrandHeader.tsx)*
  *Obsolete - the header it refers to was replaced by 009/011.*
- **TODO(branded-pull-refresh):** the pull-to-refresh uses the native `RefreshControl` spinner. A
  branded reveal animation (like Reddit's mascot peeking out as you pull) would need a custom scroll
  implementation, which fights Android's overscroll physics — revisit if we want the flourish.
- **Deferred: user-orderable boxes.** Let the user reorder the home box list (pin the boxes they care
  about to the top); the chosen order persists. Today boxes are ordered by `createdAt`
  (`accountsStore.list()`), so this needs:
  - **Data:** a `position` (sort-order) column on `accounts` (new migration); `list()` orders by it;
    a store method to persist a new order (e.g. `reorder(boxIds[])`) + reconcile on add/remove.
  - **UX (NEEDS RESEARCH — user is unsure):** candidate patterns — long-press → **drag-to-reorder**
    (iOS Settings style); a persistent **grip handle** (≡) per row in an "edit" mode; an **Edit-mode**
    toggle reusing the existing per-box edit/trash affordances; or simple **up/down move buttons**
    (accessible, no gesture lib). Look at references (e.g. Mobbin) before
    picking.
  - **⚠️ Dependency constraint:** drag-to-reorder via the popular `react-native-draggable-flatlist`
    requires **reanimated + gesture-handler**, which this project has *deliberately avoided* (see the
    custom drawer above). So either accept those native deps if true drag is wanted, build drag with
    `PanResponder` + `Animated` (more work), or choose a non-drag UX (edit-mode move buttons). This
    trade-off is the main decision to resolve.
