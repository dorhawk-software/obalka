---
name: Obálka - datová schránka
description: A warm-paper design system for Czech data-box mail, where every surface is a sheet and every raise is a change in tone.
colors:
  paper: "#F4EEE2"
  surface: "#FFFDF8"
  surface-alt: "#FBF6EA"
  surface-sunken: "#F2EADB"
  hairline: "#ECE3D2"
  hairline-strong: "#DCD2BF"
  ink: "#211B12"
  body-ink: "#3F392E"
  muted-ink: "#6B6253"
  faint-ink: "#736A57"
  brand-blue: "#2A5C9A"
  brand-blue-deep: "#1E4E80"
  brand-blue-soft: "#EEF4FB"
  brand-tile: "#2D6CB5"
  on-blue: "#FFFFFF"
  on-solid: "#FFFFFF"
  gold: "#E8A100"
  gold-ink: "#A87400"
  gold-bright: "#F5B81E"
  gold-soft: "#FBEFD0"
  gold-edge: "#EAD9A8"
  on-gold: "#211B12"
  violet: "#5A4CA8"
  violet-soft: "#E7E6F6"
  success: "#2E7D52"
  danger: "#B5362F"
  warning-ink: "#8C6100"
  track-off: "#CFC4AE"
  track-off-edge: "#8E7F62"
  hero-ink: "#D3C7AF"
  snackbar-bg: "#211B12"
  snackbar-ink: "#FBF6EA"
typography:
  display:
    fontFamily: "BricolageGrotesque-ExtraBold, Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: "31px"
    letterSpacing: "-0.5px"
  headline:
    fontFamily: "BricolageGrotesque-ExtraBold, Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "21px"
    fontWeight: 800
    lineHeight: "26px"
    letterSpacing: "-0.4px"
  title:
    fontFamily: "BricolageGrotesque-Bold, Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: "22px"
    letterSpacing: "-0.2px"
  body:
    fontFamily: "PublicSans-Regular, Public Sans, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "21px"
  label:
    fontFamily: "PublicSans-SemiBold, Public Sans, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: "17px"
rounded:
  chip: "8px"
  tile: "11px"
  field: "12px"
  button: "13px"
  card: "14px"
  fab: "16px"
  sheet: "24px"
  pill: "999px"
spacing:
  hair: "2px"
  xs: "4px"
  sm: "6px"
  base: "8px"
  md: "10px"
  lg: "12px"
  xl: "14px"
  gutter: "18px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface-alt}"
    rounded: "{rounded.card}"
    height: "52px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.on-blue}"
    rounded: "{rounded.card}"
    height: "48px"
  button-neutral:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    height: "48px"
  fab:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.on-gold}"
    rounded: "{rounded.fab}"
    height: "54px"
    padding: "0 20px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "14px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    height: "50px"
    padding: "0 15px"
  screen-header:
    backgroundColor: "{colors.surface-alt}"
    textColor: "{colors.ink}"
    height: "54px"
    padding: "0 6px"
  chip:
    backgroundColor: "{colors.brand-blue-soft}"
    textColor: "{colors.brand-blue-deep}"
    rounded: "{rounded.chip}"
    height: "22px"
    padding: "0 9px"
  switch-on:
    backgroundColor: "{colors.brand-blue}"
    rounded: "{rounded.pill}"
    width: "48px"
    height: "28px"
  switch-off:
    backgroundColor: "{colors.track-off}"
    rounded: "{rounded.pill}"
    width: "48px"
    height: "28px"
---

# Design System: Obálka - datová schránka

## Overview

**Creative North Star: "The Paper Envelope"**

*Obálka* means envelope. The system takes that literally, and the literalism is what makes it
decidable: `paper #F4EEE2` is the stock, `surface #FFFDF8` is the enclosed sheet, `hairline #ECE3D2`
is the fold, `ink #211B12` is what was printed on it. When a question comes up about a new surface -
should this be a card, should this have a border, how dark is this text - the envelope answers it
before taste has to.

The app holds legally binding government mail: records with consequences, deadlines that expire, and
a delivery fiction that lands whether or not anyone opened the message. The design's whole job is to
carry that weight without feeling like a government form. Warmth does the humanity, precision does
the authority, and neither is allowed to borrow from the other - the palette never gets cheerful and
the typography never gets bureaucratic.

The system replaced a cool-navy neutral ramp in feature 009. That is the one confirmed
anti-reference: **not cool greys, not a blue-tinted "productivity app" neutral.** The brand blue and
gold survived the change; the greys did not.

**Key characteristics:**
- Warm neutrals throughout - there is no true grey and no pure white anywhere in the palette.
- Two families, strictly divided: Bricolage Grotesque says what a thing *is*, Public Sans says what
  it *contains*.
- Depth is tone, not shadow. Dark mode raises by getting **lighter**.
- Gold is spent sparingly: unread, the active box, compose, and the fiction and paid-send chips.
- Nothing moves once it is on screen. Space is reserved before it is needed.

## Colors

A warm paper ramp with two accents - a brand blue that acts, and a gold that notices.

### Primary
- **Brand Blue** (`#2A5C9A` light / `#6BA3DE` dark): every selection, every link, and in-content
  actions such as downloading attachments or accepting a scan suggestion - not a screen's primary
  button, which is `ink`. Among the accents, it is the one that means "this does something".
- **Brand Blue Deep** (`#1E4E80` / `#9BC2EC`): brand headings and strong brand text - the darker
  register when blue has to be read rather than pressed.
- **Brand Tile** (`#2D6CB5`, **fixed in both appearances**): the solid tile behind the logo and lock
  marks. It does not follow the theme, which is precisely why the glyph on it uses `on-solid`.

### Secondary
- **Gold** (`#E8A100`, both appearances): the compose FAB, the unread dot and count badge, the active
  box's check mark, and the accent of the fiction and paid-send chips. Its scarcity is the point -
  see The One Job Rule.
- **Gold Ink** (`#A87400` light / `#E8A100` dark): gold at a strength that can be *seen*. Plain gold
  is 2.17:1 on `surface` in light mode, so anything gold that carries meaning rather than decoration
  - the unread dot's ring, the attention numeral, the FAB's own edge - takes this instead.
- **Violet** (`#5A4CA8` / `#B0A4EE`): the draft marker, and one of the six avatar hues.

### Neutral
- **Paper** (`#F4EEE2` / `#1A1712`): the page. The stock everything is printed on.
- **Surface** (`#FFFDF8` / `#2A251E`): the enclosed sheet - cards, inputs, raised rows.
- **Surface Alt** (`#FBF6EA` / `#221E18`): bars, headers, sheets and dialogs.
- **Surface Sunken** (`#F2EADB` / `#322C24`): recessed panels - the segmented track, icon-button
  wells. The one surface that goes *down*.
- **Hairline** (`#ECE3D2` / `#3A332A`): every resting edge in the app.
- **Hairline Strong** (`#DCD2BF` / `#4A4236`): input borders and emphasis edges.
- **Ink** (`#211B12` / `#F2ECE0`), **Body Ink** (`#3F392E` / `#D8D0C2`), **Muted Ink**
  (`#6B6253` / `#A89D8B`), **Faint Ink** (`#736A57` / `#9C9282`): four registers of text, and no
  fifth. Faint Ink is the floor - it is already the AA-corrected value, not the design's original.

### Named Rules

**The One Job Rule.** Solid gold marks unread (the dot and the count badge), the active box's check
mark and the compose FAB; `gold-ink` draws the attention numeral. The gold chip tones
(`statusFiction`, `fikceAmber`, `costPaid`) mean delivery by fiction or a paid send, which is why a
decorative glyph is never gold (016). Soft gold carries the test banner and pill, the paid-cost card
and the paid-send confirmation, the missing-attachments notice, and the pressed add-box row in the
box switcher. Beyond that, gold appears only in fixed artwork (the logo's flap, the lock's keyhole)
and as `gold-bright` on the snackbar's action, for contrast on its dark bar. Gold takes on no other
meaning: every new gold thing on a screen dilutes the ones already there.

**The On-X Rule.** A token named `on-<something>` is safe **only on that something**. `on-blue` is
ink that sits on `brand-blue`; in dark mode it is near-black, because dark mode's blue is bright.
Anything painted on a fill that does *not* follow the theme - an avatar hue, the brand tile, a
switch knob - takes `on-solid`, which is white in both appearances. This rule exists because it was
broken: `on-blue` was silently doing both jobs, and when dark mode's blue was brightened, every
avatar monogram in the app fell to 2.1–3.0:1.

**The Measured Palette Rule.** Every foreground/background pair the app renders is asserted in
`__tests__/theme/contrast.test.ts`, and the pairs are *derived* from where tokens are painted, not
transcribed. A palette is edited by eye, and a number that used to pass is exactly the thing nobody
re-measures.

## Typography

**Display font:** Bricolage Grotesque (fallback: system sans)
**Body font:** Public Sans (fallback: system sans)

**Character:** Bricolage is a wide, slightly irregular grotesque with real personality in its
ExtraBold - it gives a screen title and an oversized numeral something to be. Public Sans is a
plain, civic, unfussy workhorse; it is a US government typeface, which is a quiet joke that lands
well in an app for Czech government mail. The pairing splits cleanly: Bricolage names things, Public
Sans holds them.

### Hierarchy
- **Display** (Bricolage ExtraBold, 26/31, −0.5): the main screen title - home and welcome only.
- **Headline** (Bricolage ExtraBold, 21/26, −0.4): stack-header titles, dialog titles, a message
  subject.
- **Title** (Bricolage Bold, 17/22, −0.2): section headers, a box owner's name.
- **Body** (Public Sans Regular, 15/21): primary readable text.
- **Body Strong** (Public Sans Bold, 15/21): emphasised body.
- **Value** (Public Sans SemiBold, 14/19): the value paired with a label - a box ID, a login name.
- **Label** (Public Sans SemiBold, 13/17): form and metadata field labels.
- **Caption** (Public Sans Medium, 13/17): metadata, timestamps, helper text.
- **Badge** (Public Sans Bold, 13/16): pill text.

**13 is the floor of the scale, and the scale is not what ships.** There is no 12 and no 11 among the
roles - but 96 call sites across 24 files (counted 2026-09-14) override a role's `fontSize` down to
12, 11 or 10, and the inbox alone has twelve of them. Every metadatum with legal weight - the row
date, the deadline chip, the fiction chip, the stale banner - currently sits in that tier, and the
"Testovací" pill renders at 10. The two strips across the top of a screen left that tier on
2026-09-15, when they became one `StatusStrip` on the Badge step; counted that day as `fontSize={10}`,
`{11}` or `{12}` under `src/` - a method that need not match the count above - the tier holds 101 call
sites across 24 files.

This is stated as it is, not as it was meant to be: an earlier draft of this file claimed the floor
held with "two places that render smaller", which was never measured and was wrong by a factor of
thirty-eight. Whether 13 should be the enforced floor is a live decision, not a settled rule. Until
it is settled and tested, it is a scale, not a floor - and an override at least rescales the line box
with the size, which is the one part that does work.

### Named Rules

**The Face-Per-Weight Rule.** Both families ship as 4-style groups, so Medium / SemiBold / ExtraBold
are *separate families* that `fontFamily + fontWeight` cannot reach. Overriding a weight must switch
the face. `Typography.tsx` resolves this centrally; a screen that sets `fontWeight` by hand gets the
base face and the "all weights look identical" bug.

**The Growing Box Rule.** React Native scales `fontSize` *and* `lineHeight` with the system text
size; a container measured in dp does not scale with them. Every box that holds text uses
`minHeight`, never `height`. Asserted by `__tests__/theme/fontScale.test.ts`.

**The Dense Rule.** The design sets ~1.4 leading on prose and leaves the font's tight metric leading
on single-line list rows. Pass `dense` for a row; without it every row renders ~9dp taller than the
design.

**The Whole Ink Rule.** iOS cuts a glyph off at the edge of its line box; Android paints past it. So a
line too short for its ink looks right on every Android screen and in every test, and loses the top of
a letter on an iPhone - the attention count's 44pt "2" on its 36pt line did (2026-09-24). No text
may sit on a line shorter than the one below for its face - on iOS. The role components enforce it
themselves: given a shorter design line they draw, on iOS, on a safe one taller by a whole dp or more
on each side (never half of one: 1.5px at 3x is left to Yoga's rounding) and take the extra back with
negative margins of the same whole dp, so the text occupies the design's line to the pixel - and, drawn
from its own height up, sits its glyphs exactly where Android and the design do. On Android they draw
the caller's line and margins untouched: Android never clipped, and there the swap is not
layout-neutral. It measures a Text in whole pixels, `ceil(lineHeight × density)`
(`CustomLineHeightSpan.kt`), at a density like 2.625 where no dp is a whole pixel - so a 19dp line is
drawn 50px and a 21dp one 56px, margins of 2.625px are snapped to the grid, and a taller line with the
difference taken back came out a fraction of a pixel taller per Text. The inbox's attention header grew
~4px that way and pushed every row below it down (2026-09-24). A raw `Text` or a style object that sets
a line has to meet the rule itself, and may branch on `Platform.OS` to do it on iOS alone. At a larger
system text size the line grows with the text and the margins do not, so such a Text takes a little more
room on iOS than its design line scaled - never less (The Growing Box Rule).

*The model* (React Native 0.86, Fabric, iOS; `src/theme/inkClipping.ts` has it with the sources). A
`lineHeight` L becomes `minimumLineHeight = maximumLineHeight = L` (`RCTAttributedTextUtils.mm`), scaled
with the font, so only r = L / fontSize matters. TextKit sets the baseline one descent above the bottom
of the line; when L reaches the font's own height H = ascender + descender + lineGap (`UIFont.lineHeight`),
`RCTApplyBaselineOffsetForRange` raises the ink by (L − H) / 2, centring it as CSS and Android's
`CustomLineHeightSpan` do; below H it does nothing, so the ink stays pushed up and the top is cut. In
ems, the baseline sits r − d below the line's top when r < H and r/2 + (a − d)/2 when r ≥ H, and a
glyph is cut when its ink rises above that or falls below the line. A Text with no `lineHeight` gets
r = H - which clips too wherever a face's ink outgrows its own ascender, as Public Sans's Ů does.

*The numbers*, read from the bundled `.ttf` files (`hhea` ascender/descender - equal to `OS/2` typo here,
line gap 0 - and each glyph's `glyf` box, which contains the drawn outline and overstates it by at most
0.004em) over printable ASCII, every Czech letter in both cases, the cedillas and the UI's symbols:

| Face | ascender / descender | own line H | tallest ink | deepest ink | safe lineHeight / fontSize |
|---|---|---|---|---|---|
| `BricolageGrotesque-SemiBold` | 0.930 / 0.270 | 1.200 | Č 0.913 | ş 0.239 | 1.183 |
| `BricolageGrotesque-Bold` | 0.930 / 0.270 | 1.200 | Č 0.918 | ş 0.235 | 1.188 |
| `BricolageGrotesque-ExtraBold` | 0.930 / 0.270 | 1.200 | Č 0.923 | ş 0.232 | 1.193 |
| `PublicSans-Regular` | 0.950 / 0.225 | 1.175 | Ů 0.9875 | Ç 0.206 | 1.250 |
| `PublicSans-Medium` | 0.950 / 0.225 | 1.175 | Ů 0.988 | Ç 0.2075 | 1.251 |
| `PublicSans-SemiBold` | 0.950 / 0.225 | 1.175 | Ů 0.9885 | Ç 0.2095 | 1.252 |
| `PublicSans-Bold` | 0.950 / 0.225 | 1.175 | Ů 0.989 | Ç 0.2125 | 1.253 |
| `PublicSans-ExtraBold` | 0.950 / 0.225 | 1.175 | Ů 0.9905 | Ç 0.216 | 1.256 |
| System font (SF Pro, no `fontFamily`) | 0.952 / 0.241 | 1.193 | taken as the ascender | taken as the descender | 1.193 |

Public Sans's ring on a capital Ů rises past the face's own ascender, so no line shorter than 1.25 of
the size - its own height included - holds it; without Ů the face would be safe at about 1.16. Ink
cut by under 0.05dp is let through: a sixth of a pixel at 3x, the size of the glyph boxes' own error.
Outside the measured set, Slovak ĺ is the one letter that would raise a face - Bricolage to 1.254.

*The audit* has two halves, both in `npm test` (so in `npm run verify`).
`__tests__/theme/lineHeightClipping.test.ts` reads every file under `src/` as syntax: literal `fontSize`,
`lineHeight` and `fontFamily` on a JSX element in any order, and in any object literal; a value that
branches on the platform (`Platform.OS === 'ios' ? a : b`, `Platform.select`) is read as its iOS branch.
At render time, `jest.setup.js` wraps React Native's `Text` so every Text any test draws as iOS - the
suite's platform, pinned in `jest.config.js`; a render a test makes as Android is not judged by an iOS
model - after the roles, Tamagui and a parent Text have resolved its face, size and line, is held to it; `jest.afterEnv.js` fails the
test that drew one that clips, naming its text, testID and component stack. A Text in a face that has
no numbers here fails as well: it cannot be checked. So does a role nested inside another Text that had
to lift its line: a span has no margins to take the extra back with, and the paragraph's line would grow. `__tests__/theme/inkClipping.test.tsx`
pins this table to the font files and this section, the model to the iPhone's "2", and the roles to
both platforms: the caller's line and margins exactly on Android, the design line to the pixel on iOS.

## Layout

A single column, capped and centred. `ContentColumn` limits content to **720dp** and lets the margins
take anything wider - the answer print has used for centuries, and the reason a tablet or an unfolded
foldable does not get inbox rows a thousand pixels wide. On a phone the cap never binds.

Screen structure is invariant: a **54dp header bar** on `surface-alt` below the safe-area inset, with
a 1px hairline under it; then content on `paper`; then, where the screen has one primary action, a
FAB 22dp above the safe-area bottom. Header top padding and content bottom padding both come from
hooks (`useHeaderTop`, `useContentBottom`) that derive from the real insets - never a hardcoded
guess, which is what put content under the gesture bar on every device that has one.

**Spacing rhythm:** 2 / 4 / 6 / 8 / 10 / 12 / 14 / 18. The gutter is 18 on list rows and message
content, 16 on settings-shaped scroll content. Row padding is 13 vertical, 18 horizontal.

**Orientation:** portrait on phones, both platforms. Large screens (≥600dp) are governed by the OS
from Android 16 onward, which is exactly what the 720dp cap is for.

## Elevation & Depth

**Depth is a change in tone, not a cast shadow.** The surface ramp is the primary mechanism and it
runs in both directions:

```
light:  paper #F4EEE2  <  surface-alt #FBF6EA  <  surface #FFFDF8
dark:   paper #1A1712  <  surface-alt #221E18  <  surface #2A251E
sunken: #F2EADB (light) / #322C24 (dark) - the one step downward
```

Dark mode raises by getting **lighter**, the Material tonal model in a warm ramp. This is the single
most load-bearing idea in the system: a new surface asks "which tonal level am I", not "how much
shadow do I get".

Where tone alone cannot separate two planes - `surface-alt` on `paper` measures 1.06:1, which is
nothing - a **1px hairline** finishes the job. Every header bar's bottom edge, every list-row
divider, every card boundary is a hairline. That is not a fallback; it is the second half of the
mechanism.

### Shadow vocabulary

Shadow is reserved for objects that float, plus a few brand moments:

- **`depth.lg`** (`inset 0 1px 2px rgba(255,255,255,.45), 0 4px 6px rgba(0,0,0,.18), 0 6px 10px rgba(0,0,0,.08)`):
  dialogs and sheets. The layered stack - an inset top highlight, a tight contact shadow, a soft
  ambient one - which is why it reads in both appearances: the dark shadows carry in light mode, the
  top highlight carries in dark. Bottom sheets in dark mode swap it for a faint highlight and a soft
  ambient lift.
- **FAB** (`0 8px 20px rgba(184,128,0,.4)`): a gold-tinted lift, atmosphere rather than boundary.
  The FAB's actual edge is a 1px `gold-ink` outline, because a shadow is not a boundary.
- **Snackbar** (`0 8px 24px rgba(33,27,18,.32)`): the toast that floats above the content.
- **Emblem** (`0 14px 34px rgba(33,50,90,.32)`): the 96dp brand tile on a success screen and the
  104dp tile on the lock screen.
- **Welcome logo** (`0 18px 42px rgba(33,50,90,.35)`) and the **Welcome and Lock primary button**
  (`0 6px 16px rgba(33,27,18,.25)`): brand moments, not floating objects.
- **Switch knob** (`0 1px 3px rgba(0,0,0,.25)`): one soft drop. No inset, no ambient layer.
- **Selected segment** (`0 1px 2px rgba(33,27,18,.12)`): the raised pill in the segmented control.
- **`depth.sm`**: the retry button on the sign-in error screen, its one use.

### Named Rules

**The Tonal-First Rule.** Reach for a tonal level, then a hairline, then - only if the object truly
floats - a shadow. `depth.md` exists and is currently unused, and `depth.sm` has a single use (the retry button on the
sign-in error screen); that is correct, not an oversight.

## Shapes

Radii are **fixed steps, not a ratio**. A 38dp avatar and a 52dp avatar do not get proportional
corners; they get 11 and 14, because those are the steps.

```
8   chips and status pills
11  list-row tiles and avatars (36–42dp), the segmented track
12  the search field, the scan-suggestion buttons, menu and switcher rows, inset panels
13  in-content buttons (download or re-download attachments, add an attachment, the list's retry),
    attachment and draft rows, the recipient card
14  cards, form inputs, dialog and form buttons, the 52dp detail avatar  ← most-used radius in the app
16  the FAB, the Welcome and Lock primary buttons
20  dialog container
24  bottom sheets (top corners only)
999 fully round - switch track, unread dot, icon buttons, radio marks
```

Borders are 1px hairlines almost everywhere; 1.5px on a focused input; 2px on a radio ring and on the
badge cut-out that separates an unread count from the surface behind it.

The recurring silhouette is the **rounded square** - the FAB, the avatar, the brand tile and the icon
wells are all the same family of shape at different sizes. Circles are reserved for controls that are
genuinely round in the platform sense: switch tracks, radio marks, icon buttons.

## Components

Character line for the whole set: **tactile but never playful.** Everything responds to touch with
real physical feedback - a dip, a haptic, a refusal - and nothing bounces, springs, overshoots or
moves without being asked.

### Buttons
- **Shape:** 14dp radius (`rounded.card`; 16 on Welcome and Lock), mostly 48–52dp minimum height (54
  on Welcome and Lock).
- **Primary:** `ink` fill with a `surface-alt` label - the dark high-contrast button, full width in a
  form footer. Blue fills only in-content actions: downloading attachments, accepting a scan
  suggestion.
- **Danger:** `danger` fill, `on-blue` ink. Used only where something is destroyed.
- **Neutral:** `surface` fill with a `hairline-strong` border and `ink` text.
- **Press:** scale to 0.97 over 90ms, timing curve, native driver. A dip, not a bop.
- **Busy vs blocked:** a *busy* button (action already running) swallows the press - the spinner is
  the answer. A *blocked* button (a requirement unmet) still receives the press and answers with a
  ±4px lateral shake, a warning haptic, and focus moved to whatever is missing. The distinction is
  owned by `PressScale`, because a disabled `Pressable` discards the touch before any handler runs,
  so a screen cannot even learn that someone tried.

### Chips
- **Style:** 22dp tall, 8dp radius, 9dp horizontal padding, Badge type at 11–13.
- **Tones:** thirteen named kinds in `chipTone.ts` - delivery fiction (red / amber), user deadline
  (blue), scan estimate (soft), cost (free / paid), five ISDS delivery states (sent, delivered, read,
  served by fiction, stopped), and two general tones (`info`, `dangerSoft`). Each carries a
  derived AA dark variant; a chip never shows a light surface in dark mode.
- A chip states a fact the app knows. It never states a legal conclusion the app inferred.

### Cards / containers
- **Corner:** 14dp. **Background:** `surface`. **Border:** 1px `hairline`.
- **Shadow:** none. Cards are flat; see Elevation.
- **Padding:** 14dp, 18dp for message content.

### Settings sections
- **Label:** Public Sans Bold 12, uppercase, 0.4 letter-spacing, `faint-ink` - the design's settings
  section label (`specs/009-visual-redesign/design-system.md` §2), drawn by `Section` above the cards of
  every settings-shaped screen. It is one of the 12-tier overrides counted under Typography, and it is
  the design's value, not a near miss of the Label step.

### Inputs
- **Style:** `surface` fill, 1px `hairline-strong` border, 14dp radius, 50dp tall (the search field:
  12dp radius, 44dp, a `paper` fill and a `hairline` border).
- **Focus:** border shifts to `brand-blue` at 1.5px. No glow.
- **Keyboard:** `keyboardAppearance` follows the *app's* theme, not the OS's - injected once in
  `theme/ui.tsx`, because a bright keyboard under a dark UI is the same defect class as a mismatched
  system bar.
- **Autofocus:** the `autoFocus` prop does not survive Tamagui. Use `useAutoFocus`, which waits for
  the screen transition to settle.

### Navigation
- **Header:** one component, `ScreenHeader` - a 54dp `surface-alt` bar, a 44dp back chevron, a
  Bricolage 18/700 title announced as a heading, and a 1px hairline below. Two variants: a title, or
  a control that fills the row (search). The message list and detail are the documented exemptions;
  everything else uses this.
- **Back:** the iOS left-edge swipe is never disabled. Screens outside the native stack get an
  equivalent pan; Android's system Back is routed, never hijacked.
- **Bottom sheets:** 24dp top corners, `surface-alt`, a 40×4 grabber, slide-in over a scrim at
  0.40–0.45 alpha, swipe-down to dismiss, capped at the content width.

### Status strips
- **One component:** `StatusStrip` (`src/theme/StatusStrip.tsx`) - the full-width strip above a
  screen's header that states a condition the whole screen is under. Two use it: the *Testovací
  prostředí* banner on the message detail, and Debug mode's *Režim ladění zaznamenává* on every screen
  but the Debug screen. A third strip belongs in this component, not in a copy of it: the recording
  strip began as a copy of the banner and kept its off-scale numbers with it (5 padding, a 7 gap, a
  12/15 label), until both moved here on 2026-09-15.
- **Metrics:** 6dp vertical and 14dp horizontal padding, an 8dp gap, 14dp glyphs, the Badge label
  (13/16) and a 1px hairline below. Every strip reserves the same 28dp row at the default text size -
  a `minHeight`, so a larger text size still grows it. A strip that is a button is also at least 48dp
  tall counting the status-bar inset it clears; on a phone with a status bar the inset already pays
  for that, so its row is the same as every other strip's.
- **Tones:** `test` - `testBg` fill, `testFg` ink, `testBd` hairline; `chrome` - `surface-alt` fill,
  `ink`, `hairline`, and a `muted-ink` chevron when the strip opens something. Both label pairs are
  measured in `contrast.test.ts`, read from the component's own tone table.
- **Placement:** normal flow, never an overlay. The strip clears the status bar itself and the
  screen under it is handed a spent top inset. It never appears or disappears on the screen in front
  of the person: the banner is fixed by the box, and the recording strip changes only while the Debug
  screen covers it.
- **Label:** free to wrap. Pinned to one line, "Režim ladění zaznamenává" - 166dp in Public Sans Bold
  13 - needs about 398dp for its row at 200 % text, and would be drawn past both edges of the screen.

### Signature component - the attention block
The inbox opens with an oversized `gold-ink` Bricolage numeral beside "Vyžaduje pozornost" and a
one-line reason. It is the app's loudest moment and it earns it: the number is a count of things with
legal consequences, stated nowhere else on the screen. Everything below it returns to the ordinary
row rhythm.

## Do's and Don'ts

### Do
- **Do** take every colour from `useTheme()`. `scripts/check-no-raw-hex.sh` fails the build on a raw
  hex literal outside the sanctioned palette files.
- **Do** use `minHeight` on anything containing text, so it grows with the system text size.
- **Do** derive a touch target from the drawn size with `touchSlop()` (`textSlop()` for a text
  button). A control may be drawn smaller than 48dp - the switch is 48×28, a segment is 34 - but its
  *touch area* never is. `__tests__/theme/noTypedHitSlop.test.ts` fails on any `hitSlop` that does not
  come from one of the two.
- **Do** reserve space for anything that will arrive later. A spinner, a chip or a badge that appears
  must not move the content around it (constitution V).
- **Do** reach for a tonal level first, a hairline second, and a shadow only if the thing floats.
- **Do** put a new shared pattern in `src/theme/` **and then use it everywhere it applies.** Three
  components in this repo were written to prevent drift and then adopted once each; the drift
  happened anyway.

### Don't
- **Don't** use `Alert.alert` or any other system dialog. The app draws its own; enforced by
  `__tests__/theme/noSystemAlert.test.ts` with no allowlist.
- **Don't** paint an `on-<x>` token on anything but `<x>`. Use `on-solid` for white-on-a-fixed-fill.
- **Don't** give gold a new meaning.
- **Don't** hand-tune spacing, radii or type per screen. The same pattern keeps the same numbers; a
  value that differs from the scale is a bug, not a refinement.
- **Don't** animate anything that was not asked for. Motion answers an action; it never decorates
  one. Every animation yields to Reduce Motion, and the haptic and focus change survive when it does.
- **Don't** write a docstring asserting a measured property without a test that measures it. Three
  comments in this codebase promised contrast ratios that had silently stopped being true.
