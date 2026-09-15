# Design System — "Paper" redesign (009)

**Source:** Claude Design project *"Obálka app design overview"*
(`2c15c7b1-3690-44ff-b610-4ea7620bdb6a`), file **`Obalka Redesign.dc.html`** (+ `support.js`),
imported 2026-06-30 via the `claude_design` MCP. This file is the 2026-06-30 extraction of the
design's tokens, type, and component metrics as imported, made so the port stays pixel-faithful and the
values live in the repo (not only in the design tool).

> *Amended 2026-09-14:* shipped values have since changed (the AA corrections in
> [`design-sync-back.md`](./design-sync-back.md), the T043 contrast audit). The current tokens are
> `src/theme/theme.ts`, `typography.ts` and `chipTone.ts`, documented in [`DESIGN.md`](../../DESIGN.md).
> Read the tables below as the design as imported, not as the values that ship.

The new direction is a **warm "paper"** neutral ramp (replacing the cool-navy ramp) with the brand
**blue / gold** accents retained, plus a two-family type system. Same semantic-token model as today —
so the swap is centralized in `src/theme/theme.ts` (see §4 mapping).

## 1. Palette (raw design values)

| design key | role | Light | Dark |
|---|---|---|---|
| `bg` | page background | `#F4EEE2` | `#1A1712` |
| `s` | bars / headers / sheets / dialogs surface | `#FBF6EA` | `#221E18` |
| `card` | cards / inputs / raised rows (lightest) | `#FFFDF8` | `#2A251E` |
| `sunken` | recessed panels / segmented track / icon-button bg | `#F2EADB` | `#322C24` |
| `bd` | hairline border (resting) | `#ECE3D2` | `#3A332A` |
| `bds` | strong border / input border / emphasis | `#DCD2BF` | `#4A4236` |
| `text` | primary text **and the dark primary-button fill** | `#211B12` | `#F2ECE0` |
| `text2` | body copy (message body) | `#3F392E` | `#D8D0C2` |
| `mut` | secondary text | `#6B6253` | `#A89D8B` |
| `fnt` | faint text (meta/timestamps/placeholder) | `#9A9180` | `#8A8070` |
| `trackOff` | toggle off-track | `#CFC4AE` | `#4A4236` |
| `testBg` | test-env banner/tag surface (v2) | `#FAE7B0` | `#352B12` |
| `testFg` | test-env banner/tag ink (v2) | `#6E5200` | `#E6C46A` |
| `testBd` | test-env banner/tag border (v2) | `#E8D49A` | `#4A3D1C` |
| `backdrop` | device bezel backdrop (design chrome only) | `#d9d2c4` | `#0c0a07` |

### Accent literals (mostly theme-independent in the design)
- **Brand blue:** primary text/icon on light `#2A5C9A`; logo tile `#2D6CB5`; deep `#1E4E80`;
  tinted info surface `#EEF4FB` (and `#E4ECF7` for the user-deadline tone).
- **Gold / amber:** compose FAB + unread badge `#E8A100`; envelope flap + snackbar action `#F5B81E`;
  warning ink `#9A6B00`; amber surface `#FBEFD0` / border `#EAD9A8`; link/"restore" text `#B07F00`.
- **Red (urgent / danger):** `#BE3A34`; surface `#F7E4E1`.
- **Green (free / success):** `#2E7D52`; surface `#E2F0E8` / border `#CFE6D9`.
- **Avatar hash palette:** `['#2A5C9A','#0E8C8C','#7A6BC4','#2E7D52','#C98A00','#1E4E80']`.

> ⚠️ These accents are written as **literals** in the design and don't currently have light/dark
> variants. For dark mode we must derive AA-passing equivalents (the tinted surfaces especially —
> `#EEF4FB`/`#F7E4E1`/`#E2F0E8`/`#FBEFD0` are light-only and need dark counterparts). Tracked in the
> port tasks; the chip tones live in §3.

## 2. Typography

Two families (Google Fonts in the design; must be **bundled** for RN, not fetched):
- **Bricolage Grotesque** — display/headings (the `.bg` class), weights 500–800, tight tracking
  (−.3 to −1px). Used for: app title, screen-header titles, section headers ("Vyžaduje pozornost",
  "Dříve"), message subjects, dialog/sheet titles, success headlines.
- **Public Sans** — body & UI, weights 400–800. Everything else.

Observed sizes → maps onto the existing 9 `TextRole`s in `src/theme/typography.ts` (sizes are close;
the change is mainly **fontFamily** + slightly tighter heading tracking):

| role | design usage | size/weight |
|---|---|---|
| `display` (Bricolage) | welcome title | 34 / 800 (welcome); home wordmark 20 / 800 |
| `title` (Bricolage) | screen-header titles, detail subject | 18 (header) / 25 (detail subject) / 700 |
| `heading` (Bricolage) | section headers, card subjects | 15–16 / 600–700 |
| `body` (Public Sans) | message body | 15 / 400, color `text2` |
| `bodyStrong` | sender names, list rows | 14 / 700 |
| `value` | field values | 14 / 600 |
| `label` | form labels | 13 / 600, color `mut` |
| `caption` | meta/timestamps/helper | 12–13 / 500, color `fnt` |
| `badge` | chip/pill text | 11–12 / 700 |

Settings section labels: 12 / 700, **uppercase**, letter-spacing .4, color `fnt`.

**Font install (RN bare) — DONE:** the 8 OFL `.ttf`s are bundled under `assets/fonts/` (Public Sans
400/500/600/700/800 from uswds/public-sans; Bricolage Grotesque 600/700/800 from ateliertriay/bricolage),
linked via `react-native.config.js` + `npx react-native-asset` (copied to
`android/app/src/main/assets/fonts/`, registered in iOS `Info.plist UIAppFonts`). On-device rendering
was verified in T046/T048 (`tasks.md`).

**Pinned `fontFamily` names (F3)** — verified from the `.ttf` name tables; reference each FACE by its
**PostScript name** (= the file basename → identical on iOS & Android). Per-face names are mandatory
because both families use 4-style grouping (Medium/SemiBold/ExtraBold are *separate* families that
`family + fontWeight` can't reach):

| role | fontFamily | weight |
|---|---|---|
| display / title | `BricolageGrotesque-ExtraBold` | 800 |
| heading | `BricolageGrotesque-Bold` | 700 |
| (avail.) | `BricolageGrotesque-SemiBold` | 600 |
| body | `PublicSans-Regular` | 400 |
| caption | `PublicSans-Medium` | 500 |
| value / label | `PublicSans-SemiBold` | 600 |
| bodyStrong / badge | `PublicSans-Bold` | 700 |
| (avail.) | `PublicSans-ExtraBold` | 800 |

## 3. Component metrics

- **Radii:** cards 16 · inputs/buttons/rows 14 · chips 8–9 · small tiles/avatars 10–14 · sheets 24
  (top) · dialogs 20 · pills/dots/circles 999 · toggle track 14.
- **Borders:** 1px hairline (`bd`) resting; 1.5px (`bds`) selected/emphasis (radios, OTP input).
- **Screen header:** 54px, `s` bg, 1px bottom `bd`, 44px back-chevron tap target, Bricolage 18 title.
- **Primary button:** **dark, high-contrast** — `text` fill, `s` label, radius 14, height 50–54,
  soft shadow; disabled → opacity .45. *(This is a deliberate departure from the old brand-blue
  primary; the design uses near-black primaries with blue reserved for selection states. `ui-guide.md`
  §5 must be updated.)*
- **Secondary / link:** chromeless gold-brown text `#B07F00`.
- **Selector rows/cards:** label + circular radio; selected = blue border `#2A5C9A` + tint `#EEF4FB`
  + filled radio.
- **Toggle:** 48×28 track, 22 knob, on = `#2A5C9A`, off = `trackOff`.
- **Avatars:** rounded squares (radius 10–14), hashed bg color, white initials.
- **Deadline chip (pill):** tone bg/fg, clock icon + label. **Tones** (from `support.js` `decorate`):
  - `fikce` (unopened, 10-day clock): red ≤3 days (`#F7E4E1`/`#BE3A34`), amber ≤7
    (`#FBEFD0`/`#9A6B00`), gold >7 (`#FBEFD0`/`#9A6B00`).
  - `user` (reminder set): blue (`#E4ECF7`/`#2A5C9A`).
  - `est` (scan estimate): soft/grey (`sunken`/`mut`).
- **FAB (compose):** gold `#E8A100` pill, bottom-right, icon + "Napsat", glow shadow.
- **Bottom sheet:** scrim `rgba(33,27,18,.4)`, `s` sheet, radius-24 top, 40×4 grab handle.
- **Dialog:** centered, scrim `.45`, `s`, radius 20, lg shadow.
- **Snackbar:** `text`-fill bar at bottom, message in `s`, gold action label `#F5B81E`.
  *(Replaces the current hardcoded `#222A33` Snackbar — see §4 exceptions.)*

## 4. Mapping to the existing theme (`src/theme/theme.ts`, 29 keys)

The current `Theme` interface stays; only values change (+ a couple of additions). Proposed mapping by
**role** (design value → existing key):

| existing key | Light | Dark | notes |
|---|---|---|---|
| `bg` | `#F4EEE2` | `#1A1712` | design `bg` |
| `surface` | `#FFFDF8` | `#2A251E` | design `card` (cards/inputs) |
| `surfaceAlt` | `#FBF6EA` | `#221E18` | design `s` (bars/headers/sheets) |
| `surfaceSunken` | `#F2EADB` | `#322C24` | design `sunken` (tracks/recessed) |
| `border` | `#ECE3D2` | `#3A332A` | design `bd` |
| `borderStrong` | `#DCD2BF` | `#4A4236` | design `bds` |
| `text` | `#211B12` | `#F2ECE0` | design `text` |
| `textMuted` | `#6B6253` | `#A89D8B` | design `mut` |
| `textFaint` | `#9A9180` (verify AA) | `#8A8070` | design `fnt` — **check ≥4.5:1**; darken if needed (placeholder-only per ui-guide) |
| `blue` | `#2A5C9A` | `#5E97D6`* | brand blue (selection); *dark variant to derive |
| `blueDark` | `#1E4E80` | `#9BC2EC`* | headings/strong brand |
| `blueSoft` | `#EEF4FB` | `#22303F`* | tinted info/selected surface; *derive dark |
| `onBlue` | `#FFFFFF` | `#FFFFFF` | |
| `gold` | `#E8A100` | `#E8A100` | FAB/unread |
| `goldSoft` | `#FBEFD0` | derive | amber surface |
| `onGold` | `#211B12` | `#211B12` | |
| `success` | `#2E7D52` | `#4FB07D`* | |
| `danger` | `#BE3A34` | `#E0716B`* | |
| `warning` | `#E8A100` | `#E8A100` | |
| `warningInk` | `#9A6B00` | `#E7B85C`* | AA on amber surface |
| `accentSun/Moon/Device` | keep or retune to warm palette | | settings appearance icons |

New tokens worth adding (so screens stop hardcoding): `bodyText` (= design `text2`, message body),
`trackOff` (toggle off), and chip-tone surfaces (or compute in a `chipTone()` helper).

### Hardcoded colors to fix during the port (won't follow a `theme.ts` swap)
- `src/app/Snackbar.tsx` bar `#222A33` + white text → token-drive (`text`/`surface`).
- `#000` scrims (drawer/overlays) → `rgba(33,27,18,.4)` warm scrim.
- `src/theme/avatar.ts` palette (8 fixed hex) → align to the design hash palette (§1).
- `src/theme/fileBadge.ts` file-type palette → reconcile with warm surfaces.
- `src/assets/logo.svg` fills are baked (`#2563A6`/`#FFC305`) → keep brand blue+gold (matches the
  design's envelope), confirm it reads on `bg #F4EEE2`. **Our logo replaces the design's small inline
  envelope everywhere** (per the user). No recolor required unless contrast demands it.

## 5. Screen inventory (design → status)

See `spec.md` for the full port table and `design-prompts.md` for the screens the design omits.
18 design states extracted: welcome · inbox · detail · compose(+sent) · search · settings · lock ·
add-box method · add-box creds · otp · backup hub · backup setup · restore · box-switcher sheet ·
box action menu · rename dialog · remove dialog · snackbar.

## 6. v2 additions — Claude Design prompts 1 & 2 (imported 2026-06-30)

The design file was extended in place with the two critical-path gaps. **Confirmed.**

### Sent mail — decision: a `Přijaté | Odeslané` segmented control
- IA: a 2-segment control in the **inbox header** (state `folder: 'received' | 'sent'`), selected
  segment = `card` bg + `0 1px 2px rgba(33,27,18,.12)` shadow, idle = transparent + `mut` text. This
  is the **existing `src/theme/SegmentedControl.tsx` pattern** → straight re-skin, no rebuild. Strings
  `t.received` "Přijaté" / `t.sentFolder` "Odeslané".
- **Sent list**: date sections (`thisWeek` / `earlier`), rows oriented **you → recipient** (→ arrow
  icon + recipient name + date + subject + a **delivery-state chip**). No attention grouping on sent.
  Sent-state chip = `{label, stBg, stFg}` keyed off message state (mirror the received chip metrics).
- **Sent detail** (`SENT DETAIL` section / `isSentDetail`): delivery-state banner; subject; a **"Komu"
  (To) card** (recipient avatar + name + box ID); a **delivery-status timeline** (`sd.steps` — dot +
  label + time, e.g. Odesláno → Dodáno → Doručeno); attachment card; action bar = **"Detail doručení"**
  (`t.deliveryDetail`) — no Reply/Termín. Strings `t.to`, `t.deliveryStatus`, `t.deliveryDetail`.

### Test environment — decision: persistent shell banner + per-box tag
- **Shell banner** (`activeIsTest`): full-width band placed **between the status bar and the screen
  area** (normal flow, pushes content down — never overlaps), flask icon + `t.testEnv` "Testovací
  prostředí", styled with the new `testBg/testFg/testBd` tokens. Render once at the shell
  (`AppShell`/navigator) level → already matches `src/app/TestEnvBanner.tsx`'s intent.
- **Per-box tag** (`box.isTest` / `b.isTest`): a small "Testovací" (`t.testTag`) pill on the inbox
  switcher button and box-switcher rows.

### List/sync/empty states (bonus — partial prompt 6)
- **Sync line**: a **constant-height 26px** row under the header — `refreshing` → 13px spinner +
  `t.syncing` "Aktualizuji…"; else `t.synced` "Aktualizováno · právě teď". Constant height = **no
  layout jump** (Principle V). Maps to the existing pull-to-refresh + sync-status line.
- **Empty states**: received (`t.recvEmptyTitle/Sub`) and sent (`t.sentEmptyTitle/Sub`), envelope/paper
  icon + title + one line. (The remaining offline/error states are still prompt 6.)

### New strings to add (cs/en) — `src/i18n/strings.ts`
`received`, `sentFolder`, `syncing`, `synced`, `recvEmptyTitle`, `recvEmptySub`, `sentEmptyTitle`,
`sentEmptySub`, `to` (Komu), `deliveryStatus`, `deliveryDetail`, `testEnv`, `testTag`.

### Theme additions
Add `testBg`/`testFg`/`testBd` to the `Theme` interface (the current app only has the gold
`TestEnvBadge`; the redesign gives the test env its own tokens, both modes — see §1).

## 7. v3 additions — Claude Design prompts 3–7 (imported 2026-06-30)

All confirmed. New `sc-if` sections + state added to `Obalka Redesign.dc.html`. New animations:
`rprog` (download/progress bar), `rpulse` (Mobile-Key waiting halo) → reanimated, **honor Reduce-Motion**.

- **Mobile Key waiting** (`isMkWait`): pulsing logo + `mkWaitTitle`/`mkWaitSub` + expiry hint (waiting);
  clock + `mkExpiredTitle`/`mkExpiredSub` + `mkRetry` (expired); cancel. Maps to `authService` MEP poll
  (`MEP_TIMEOUT_MS`, `mepWsStateUpdate2`). ⚠️ `mkConfirmDemo` is a **mock** confirm button — in-app the
  screen advances on the **poll result**, not a tap.
- **OTP suggestion** (`showOtpSuggest`, in the add-box creds screen): blue card `otpSuggestTitle`/`Sub`
  + `useSmsMethod` link → switches the add-box method to SMS.
- **Re-auth** (`isReauth`): `reauthTitle`/`reauthIntro` + **locked identity card** (avatar/name/sub +
  lock glyph) + method-label chip (`reauthMethodLabel`) + error banner (`reauthErrorMsg`) + password +
  eye + submit. Plus an inbox **"session expired" strip** (`activeNeedsReauth` → `reauthExpiredStrip`
  → `goReauth`). Maps to `ReauthForm`. Note: design draws the **password** case; SMS/Mobile-Key boxes
  reuse the OTP / MK-waiting screens (our `ReauthForm` keeps the method picker).
- **Notification priming** (`notifPrime` sheet): bell + `notifTitle`/`notifSub` + `notifEnable` /
  `notifLater`; plus a Settings **"Upozornění"** row (`notifRow` → `openNotifPrime`). Maps to
  `NotificationPrime`. ⚠️ `notifEnable` must fire the **real OS permission request**, not just dismiss.
- **Paid-send confirm** (`payConfirm` sheet): 🪙 + `payTitle` + `payDesc` + `payCredit` strip +
  `paySendLabel` / cancel. Maps to the existing Compose paid-PDZ confirm modal.
- **Detail — multiple attachments** (`detailHasAtts`): "Přílohy" + count; `detailAtts` rows (file-type
  badge from `fileBadge.ts`, name, size, `savedOffline` ✓); `downloading` progress bar (`downloadingL`);
  all-or-nothing **`downloadAll`** ("Stáhnout přílohy"); plus the **90-day unavailable** state
  (`detailExpired` → `attUnavailTitle`/`attUnavailSub`). Maps to `MessageDetail` (all-or-nothing
  `MessageDownload`, local archive).
- **Compose — attachments** (`hasCompAtts`): `cAtts` chip rows (badge/name/size/remove) + dashed
  **`addCompAtt`** ("Přidat přílohu", `addAtt`). Maps to `ComposeScreen` + `attachmentPicker`.
- **Inbox — offline & error** (partial prompt 6): `offline` strip (`offlineStrip`); `loadError` view
  (`loadErrorTitle`/`Sub` + `retryLoad`/`retry`), gated by `showInboxList`. **Search** empty state
  (`searchEmpty`). Driven by **real** outcomes (offline/typed-failure), constant-height where transient.

### ⚠️ Do NOT port (mock-only scaffolding)
- **Settings "States" section** (`statesSection`, `offlineToggle`/`errorToggle` + their track/knob vars)
  — a designer affordance to preview the offline/error states in the static mock. The app drives those
  states from network/load reality, so this section is **omitted** from the port.

### New strings to add (cs/en)
MK: `mkWaitTitle mkWaitSub mkExpiryHint mkExpiredTitle mkExpiredSub mkRetry` · OTP-suggest:
`otpSuggestTitle otpSuggestSub otpSuggestBtn` · Re-auth: `reauthTitle reauthIntro reauthMethodLabel
reauthErrorMsg reauthExpiredStrip` · Notif: `notifTitle notifSub notifEnable notifLater notifRow` ·
Paid: `payTitle payDesc payCredit paySendLabel` · Attachments: `attachments downloadingL downloadAll
attUnavailTitle attUnavailSub addAtt` · States: `offlineStrip loadErrorTitle loadErrorSub retry
searchEmpty(+Sub)`. (Skip the demo `statesSection/offlineToggle/errorToggle`.)
