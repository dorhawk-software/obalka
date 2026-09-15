# Phase 0 Research — Visual Redesign (009)

All decisions for a presentation-layer port. No NEEDS CLARIFICATION remain (the deadline/attention
behaviors are spec 010; the open "is reanimated present?" item is resolved below).

## D1 — Font bundling (Bricolage Grotesque + Public Sans)
**Decision**: Bundle **static weight instances** as `.ttf` under `assets/fonts/`, link via a new
`react-native.config.js` (`assets: ['./assets/fonts']`) + `npx react-native-asset`, and set `fontFamily`
in `src/theme/typography.ts` roles. Weights to ship: Bricolage Grotesque 600/700/800 (display/headings),
Public Sans 400/500/600/700/800 (body/UI). `fontFamily` strings must match the installed font name
(Android: file/family name; iOS: PostScript name) — verify both on a build.
**Rationale**: bare RN standard; bundled = renders **offline** (Principle III/SC-006) and never blocks
launch on a network fetch; static instances avoid RN's patchy variable-font support on Fabric/Android.
**Alternatives**: variable fonts (rejected — inconsistent weight rendering on Android/New-Arch);
`expo-font` (rejected — not an Expo app); Tamagui font config (rejected — the app styles via `useTheme()`,
not Tamagui tokens). Fallback: if a family fails to load, roles fall back to system sans with the **same
size/line-height** so layout never shifts.

## D2 — Centralized palette swap + dark-variant derivation
**Decision**: Swap values in `src/theme/theme.ts` only (29 keys → the paper values in `design-system.md
§4`), add `testBg/testFg/testBd` (both modes) and a `bodyText` token (design `text2`). The design's
**light-only accent literals** (`#EEF4FB` info, `#E4ECF7` user-tone, `#F7E4E1` danger-soft, `#E2F0E8`
success-soft, `#FBEFD0` gold-soft, `#D6E4F4` info-border, `#EAD9A8` gold-border) get **derived dark
counterparts** via the existing dark method (tinted-dark surface + brighter ink, AA-checked), exposed as
tokens (or a small `chipTone(kind, scheme)` helper for the deadline/cost/status chips).
**Rationale**: one-file cascade (confirmed by the inventory — screens consume `useTheme()` inline); no
light surface may appear in dark mode (Principle V); AA in both schemes (SC-002/003).
**Alternatives**: per-screen colors (rejected — violates consistency); keeping literals (rejected —
breaks dark mode).

## D3 — Hardcoded-color escapes (the only places a `theme.ts` swap won't reach)
**Decision**: Convert each to tokens during Phase 1: `Snackbar` `#222A33`+white → `text` fill / `surface`
ink / gold action; `#000` scrims → warm `rgba(33,27,18,.4)`; `src/theme/avatar.ts` palette → the design
hash palette; `src/theme/fileBadge.ts` → warm-scheme file-type tiles; confirm `logo.svg` (baked
blue/gold) reads on `bg #F4EEE2` (keep brand colors — matches the design's envelope).
**Rationale**: these bypass `useTheme()` (inventory §1) and would otherwise stay cool-navy.

## D4 — Primary-button colour change
**Decision**: Adopt the design's **dark high-contrast** primary (`text` fill, `surface` label); reserve
blue for selection/info/radios. Propagate to `docs/ui-guide.md §5` (the guide currently specifies a
brand-blue primary).
**Rationale**: pixel-faithful to the approved design; documenting it prevents silent style drift
(Principle V consistency / VI honesty).
**Alternatives**: keep blue primaries (rejected — diverges from the approved design).

## D5 — Inbox-first IA + box-switcher bottom sheet
**Decision**: Open into the active box's inbox; move box switching/add/settings into a **bottom sheet**
(`BOX SWITCHER` design) reached from the header switcher button. Reuse the existing box-switch / rename /
remove logic and the `AppDrawer` add-box/settings entries; the sheet replaces the drawer's box surface
and the standalone `BoxList` home.
**Rationale**: matches the design; a navigation/state change only — **no data change**. Preserves all
008 functional decisions (overflow menu, recipient search, test banner).
**Alternatives**: keep the full-screen box list (rejected — not the design); a left modal drawer
(rejected — the design uses a bottom sheet).

## D6 — Animations (rprog / rpulse / rspin)
**Decision**: `react-native-reanimated ^4.4.1` and `react-native-gesture-handler ^3.0.1` are **already
present** (added in 008). Use reanimated for the download **progress bar** (`rprog`), the Mobile-Key
**waiting halo** (`rpulse`), and spinners (`rspin`); all run on the **native** thread and **honour
Reduce-Motion** (static/opaque fallback).
**Rationale**: native-driver = Principle I; no new dependency.
**Alternatives**: RN `Animated` (acceptable fallback if a reanimated New-Arch issue surfaces).

## D7 — Inbox "Vyžaduje pozornost" data source (009 ↔ 010 seam)
**Decision**: The attention section + deadline chips are **visual shell** in 009, populated by the
**deterministic *fikce* signal** computed client-side from the already-stored `deliveryTime` /
`acceptanceTime` / `state` (010 US1, FR-001 — no scanning, no reminders). If 010 is deferred wholesale,
**gate the section off** and render a single received list (FR-008) so nothing is empty or fake.
**Rationale**: keeps 010's new *behaviors* out of 009 while letting the redesigned inbox show real data.
**Alternatives**: placeholder/fake chips (rejected — Principle VI); blocking 009 on full 010 (rejected —
they were deliberately split).

## D8 — Mock-only design bits to NOT port
**Decision**: Omit the Settings **"States"** section (`offlineToggle`/`errorToggle` — designer preview
scaffolding); the Mobile-Key **demo-confirm** button (`mkConfirmDemo` — in-app the screen advances on the
`mepWsStateUpdate2` **poll**, not a tap); and wire notif-priming **"Zapnout"** to the **real OS
permission request** (the mock just dismisses).
**Rationale**: these are static-prototype affordances; shipping them would be dishonest/incorrect
(Principle VI). Recorded in `design-system.md §7`.

## D9 — Testing strategy
**Decision**: Per-screen smoke tests rendered under **both** `lightTheme` and `darkTheme`; a
**hardcoded-hex audit** (no raw color literals outside `theme.ts`/`avatar.ts`/`fileBadge.ts`); a
no-layout-jump check on the sync line + transient states; a fonts-offline (airplane-mode) check; and the
Principle VII manual czebox walkthrough (cs/en).
**Rationale**: the redesign's risks are contrast/leak/jump, not logic — tests target those.
