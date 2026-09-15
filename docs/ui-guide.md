# Obálka UI guide - modern, clean, trustworthy

> **Superseded.** The current design system is [`DESIGN.md`](../DESIGN.md); tokens are code in
> `src/theme/theme.ts`, `typography.ts` and `chipTone.ts`. §1 and the spacing values in §3 are the
> pre-009 cool-navy guide, kept as history. Still current: the no-layout-jumps rule and "same pattern
> → same metrics" (§3), and the haptics vocabulary (§5a). *Amended 2026-09-14:* the elevation scale
> (§2), the radius scale (§3), §4, §5, §5a, §6 and §7 were corrected against the code; where this
> file and `DESIGN.md` disagree, `DESIGN.md` wins.
>
> *History:* on 2026-06-30 the 009 "paper" redesign (warm palette, Bricolage Grotesque + Public Sans,
> a dark high-contrast primary button) first superseded this guide and pointed at
> [`specs/009-visual-redesign/design-system.md`](../specs/009-visual-redesign/design-system.md), the
> design as imported; shipped values have moved since.

A practical guide for making the UI look modern. Synthesized from Sajid's UI-colors method
(<https://www.iamsajid.com/ui-colors/>) and established modern-UI principles, tailored to this app.
Tokens live in `src/theme/theme.ts` (+ `src/theme/chipTone.ts`); primitives in `src/theme/ui.tsx`.

## 1. Color: three roles, limited palette

A limited, well-chosen palette beats a complex one. Use exactly three roles:

- **Neutral** (≈60% of the UI): backgrounds, surfaces, text, borders. Build the grey ramp by varying
  **lightness** at near-zero saturation, with a **faint cool tint** for cohesion (our neutrals lean
  slightly blue). Light → dark: `bg #F6F8FB → surface #FFFFFF → surfaceAlt #EEF1F6 → border #E3E8EF →
  borderStrong #C7CFDB → textFaint #9AA3B2 → textMuted #5A6573 → text #15202E`.
- **Primary / brand** (≈30%): actions, links, selected state - the official Datové schránky blue
  `#2563A6` (dark `#1E4E80`, tinted surface `#E9F1FA`).
- **Semantic** (≈10%, used sparingly): `success #1E8E5A`, `danger #D14343`, `warning #E0A800`, plus the
  brand **gold #FFC305** as the signature accent (logo / title underline).

Rules:
- **Never pure black or white.** Background is off-white; primary text is near-black navy.
- **Text hierarchy:** sharp/high-contrast headings, muted secondary text (reduces eye strain).
- **60-30-10** balance: mostly neutral, a clear primary, a little accent.
- Prefer generating shades in **OKLCH/HSL** (even lightness steps; no saturation loss at extremes).

## 2. Surfaces & depth (simulate light)

- **Layer with 3 background levels** (`bg` < `surface` < raised) instead of flat color.
- **"Highlight borders to simulate light":** light comes from the top - keep top edges/borders a touch
  lighter, shadows below. Use **subtle** shadows for elevation, never heavy.
- Selected/active surfaces use the **tinted** brand surface (`blueSoft`), not a hard fill.

**Elevation scale** (`src/theme/depth.ts`: `depth.sm` / `md` / `lg`). *Amended 2026-09-14:* depth is
tonal first (see [`DESIGN.md`](../DESIGN.md) › Elevation & Depth). `depth.lg` = dialogs and sheets;
`depth.sm` = the sign-in retry button only; `depth.md` is unused. The pre-009 role table (`sm` for
resting cards, unselected rows and the refresh button; `md` for primary buttons and selected rows;
`lg` for dialogs) no longer applies.

Rule: **a shadow means "floats above the page."** Controls **nested inside an already-raised surface**
(icon buttons in a card, a button inside a card's notice strip, label/badge pills) are **flat - no
shadow.** Don't give the same component pattern different elevation on different screens.

## 3. Spacing & shape

- **Visual consistency is the top priority** (constitution V). Spacing/padding comes from the scale
  below - **never hand-tune a one-off value per screen**; reused patterns share metrics.
- **Spacing scale** (keep to these - don't invent in-between values): `4` hairline gaps inside a chip ·
  `8` label→field / icon→text · `12` related items in a group · `14` a row's vertical inset and the
  matching gap into a list · `16` screen side gutters & card insets · `20`–`24` separating distinct
  groups · `32`+ major section breaks. **Stacked elements use a uniform gap** - e.g. the message-list
  header runs a single 14 rhythm (above tabs = tabs→status = status→first row), not three different gaps.
- Consistent rhythm on an ~8pt grid; be **generous** with whitespace - it reads as "designed".
- Group label→field tight (8), separate groups loose (20–24).
- **Radius scale** (keep to these - don't invent in-between values; *amended 2026-09-14* to the
  shipped steps): `8` chips · `11` row tiles, avatars, segmented track · `12` search field · `13`
  in-content buttons · `14` cards, form inputs, buttons · `16` FAB (and the Welcome and Lock primary
  buttons) · `20` dialog · `24` sheet top · `999` pills, dots and circular icon buttons. Circles use
  `999` (or width/2).
- **Border width:** resting surfaces (cards, dialogs, inputs, inset panels) are a **hairline `1`**;
  reserve `1.5`+ for a **selected/emphasis** state (and keep it constant across select/unselect so the
  layout doesn't shift). Elevation comes from the shadow, not a heavy border.
- **Same pattern → same metrics.** A component reused on two screens (e.g. the method-selector rows)
  must share padding, radius, border and shadow - don't hand-tune per screen.
- **Color use is semantic, never literal:** `text`/`textMuted` for content, `surface`/`surfaceAlt` for
  layers, `onBlue`/`onGold` for text on a filled accent, `warningInk` for warnings on light. No raw hex
  in screens.
- **NO LAYOUT JUMPS (hard rule).** Content must **never shift, reflow, or resize** when an async/
  transient element appears or disappears - spinners, loaders, "syncing" indicators, badges, error/
  empty lines, expanding rows. The user finds these jumps jarring. Always **reserve the space up front**:
  a fixed-height/`minHeight` container (or a fixed-width slot) that holds the indicator's footprint
  whether or not it's showing; prefer a **text-only** indicator (constant line height) over a spinner
  that changes a row's height; keep selected/unselected and loading/loaded states the **same size**.
  If something must change height, it's a deliberate, animated transition - not a flicker. When adding
  any "appears while loading" UI, verify it doesn't move its neighbours.

## 4. Typography

Defined once in `src/theme/typography.ts` (the scale) and exposed as role components in
`src/theme/Typography.tsx` - **screens compose these, never raw `fontSize`/`color`** - so sizing and
contrast stay consistent. Clear hierarchy, few sizes, **negative letter-spacing** on headings.

| Role | size / line-height | weight | default color | used for |
|------|--------------------|--------|---------------|----------|
| `Display` | 26 / 31 | 800 | text | the home screen title |
| `Title` | 21 / 26 | 800 | text | stack-header titles, dialog titles, a message subject |
| `Heading` | 17 / 22 | 700 | text | section headers, a box owner's name |
| `Body` | 15 / 21 | 400 | text | primary readable text |
| `BodyStrong` | 15 / 21 | 700 | text | emphasized body |
| `Value` | 14 / 19 | 600 | text | the value paired with a label (box id, login) |
| `Label` | 13 / 17 | 600 | textMuted | form / metadata field labels |
| `Caption` | 13 / 17 | 500 | textMuted | metadata, timestamps, helper text |
| `Badge` | 13 / 16 | 700 | text (pills set their own) | pill text |

**Accessibility rules (WCAG AA):**

- **Minimum content size is 13px** (only icon-like glyphs - the unread count chip, the "i" info dot -
  may be 12). No body text below 13. *Amended 2026-09-14:* **not met.** 13 is the smallest role
  size, but about a hundred call sites override below it, and whether 13 is an enforced floor is an
  open decision - see [`DESIGN.md`](../DESIGN.md) › Typography.
- **All text content meets ≥4.5:1 contrast** against its background. The default role colors do;
  `textFaint` (#736A57 light / #9C9282 dark) meets 4.5:1 and labels metadata and timestamps.
  Tertiary hierarchy comes from **size/weight**, not from fading colour below AA.
- **Amber text uses `warningInk`** (#8C6100 light / #E7B85C dark), not `warning` (#E8A100) - use it
  for any warning text/icon sitting on a light or `goldSoft` surface.

## 5. Components (as applied)

- **Inputs:** `surface` fill, 1px `borderStrong` border, radius 14, height 50; focus → 1.5px brand
  blue. No heavy grey fills.
- **Selectors:** grouped `OptionGroup` rows show selection by the filled radio only; the add-box and
  re-auth method cards add a 1.5px blue border and `blueSoft` tint. (Avoid chunky filled buttons for
  choices.)
- **Primary button (009):** **dark high-contrast** - `theme.text` fill, `theme.surfaceAlt` label,
  radius 14 (16 on Welcome and Lock), bold; flat except on Welcome and Lock (and `depth.sm` on the
  sign-in retry). (Blue fills only in-content actions such as downloading attachments, never a
  screen's primary action.)
- **Links / tertiary:** chromeless, brand-blue text.

### 5a. Navigation & gesture patterns (feature 008)

Platform-adaptive within accessibility limits - **iOS 26 idioms and Android Material 3 co-equal** (one
component each, themed per `Platform.OS`). Decisions + references: `specs/008-sending-navigation-ux/research.md` §3.

- **Segmented control** (`src/theme/SegmentedControl.tsx`) - `Přijaté | Odeslané` on the message list.
  *Amended 2026-09-14:* a `surfaceSunken` track; the selected segment is a raised `surface` pill with
  a soft warm shadow and a `text` label (unselected: `textMuted`), the same on both platforms (009).
  It slides between segments (snapping under Reduce Motion) and ticks a `selection` haptic on switch.
  Android adds a brand-tinted `android_ripple` and a 3px gap (2 on iOS); iOS dims to 0.6 on press.
  The 008 platform split this replaced - an iOS raised pill against an Android tonal `blueSoft` fill,
  with haptics left as a follow-up - is gone. (iOS 26 "Liquid Glass" is still deferred.)
- **SwipeableRow** (`src/theme/SwipeableRow.tsx`) - a trailing-swipe reveals one action (Mail-style on
  iOS, Material swipe-to-dismiss feel on Android). Applied to **draft rows** (→ *Zahodit*, undoable;
  an inline *Zahodit* button is the always-present fallback) and **backup rows** on the *Záloha
  archivu* screen (→ *Smazat*, confirmed by a dialog). *Amended 2026-09-14:* box rows are not
  swipeable; a box is removed from its `⋯` menu. **Never to message rows** (Principle IV - no
  destructive archive-delete of legally-delivered mail). **Reduce Motion** drops the draggable gesture
  entirely.
- **Test-environment banner** (`src/app/TestEnvBanner.tsx`, *Testovací prostředí*) - a soft-gold band
  shown on the **message detail only** (received and sent), in **normal flow** above the header, never
  overlapping it. Elsewhere a test box is marked by a *Testovací* pill beside its name (inbox header,
  box switcher), and the add-box form has its own *Ostré* | *Testovací* toggle. *Amended 2026-09-14:*
  this was first a shell-level band at the top of every screen.
- **Surfaces & a11y fallbacks** - any blur/translucent surface is **iOS-only**; Android uses **tonal
  elevation** (the depth scale, §2), and a **Reduce-Transparency** setting forces an **opaque** fallback.
  *Amended 2026-09-14:* no blur surface ships. The translucent surfaces are the modal and sheet scrims
  (`src/theme/useScrim.ts`), drawn on both platforms; when the OS reports Reduce Transparency they turn
  opaque (`theme.scrimOpaque`).
- **Haptics** (`src/services/haptics.ts`) - the 2026 "feel, don't just see" idiom (M3 Expressive / iOS
  feedback), used sparingly via a semantic vocabulary, never as decoration: `selection` (segment/tab
  switch), `light` (pull-to-refresh fires), `medium` (a weighted commit - swipe-to-delete), `success`
  (message sent), `warning` (a paid-send confirm appears), `error` (send failed). It honours the OS
  haptics setting and is fully guarded - a missing native module just no-ops, never breaking the tap.

## 6. Theming (light + dark)

Both palettes live in `src/theme/theme.ts` (`lightTheme` / `darkTheme`) behind `useTheme()`
(`src/theme/ThemeProvider.tsx`). The appearance is the user's choice in Settings - Light, Dark or
System (follows the OS) - resolved in `App.tsx`. Screens style with **semantic tokens** (`theme.bg`,
`theme.surface`, `theme.text`, `theme.blue`, …) so they adapt automatically - add a color once, in
both palettes. Dark mode is a warm near-black base whose surfaces get lighter as they raise, with
near-white text and a brighter blue. `App.tsx` also flips the status-bar style.

## 7. Open

- `src/theme/ui.tsx` still re-exports Tamagui primitives cast to `any` (`TODO(tamagui-types)`); see
  [`docs/tamagui-setup.md`](./tamagui-setup.md). Colours stay in `theme.ts` behind `useTheme()` by
  design (009).

*Amended 2026-09-14:* the earlier to-do list is closed. The brand mark ships (`src/assets/logo.svg`,
`src/theme/ObalkaMark.tsx`), and so do the micro-interactions (`PressScale`, the sliding segmented
indicator, `src/services/haptics.ts`); the CodePen technique became `src/theme/depth.ts`; and 009
chose `useTheme()` tokens over migrating to Tamagui's own themes.
