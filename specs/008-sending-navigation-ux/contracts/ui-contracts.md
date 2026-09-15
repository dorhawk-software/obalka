# UI Contracts: Sending & Navigation UX

> **As built, later.** 011 replaced the drawer and the box list with the switcher sheet
> (`BoxSwitcherSheet.tsx`), so box rows no longer swipe, and the inline `TestEnvBadge` is gone — the
> test environment shows as the `TestEnvBanner` bar on the message detail only, and a *Testovací* tag
> on the list header and box rows.

The "interfaces" this feature exposes are screens/components + their behaviour. Each contract states the
inputs, the states, and the invariants a test/implementation must honour.

## 1. `SegmentedControl` (Přijaté | Odeslané)

- **Props:** `segments: { key, label }[]`, `value`, `onChange(key)`.
- **States:** each segment selected (brand `blueSoft` tint + brand text, per `ui-guide.md`) / unselected.
- **Invariants:** exactly one selected; ≥44pt touch targets; `accessibilityRole="tab"` + selected state
  announced; switching does **not** lose the other folder's scroll/cache.

## 2. `MessageList` — folder-aware

- **Input:** `account`, current `folder` (`received|sent`), the existing `onOpenMessage`, `onCompose`.
- **Behaviour:** renders the `Přijaté | Odeslané` segments above the list; loading/empty/error/offline
  states are **per folder**; pull-to-refresh refreshes the **current** folder; the drafts entry +
  compose button stay (compose only here, inside a box).
- **Invariants:** never blocks the UI thread; switching folders is instant from cache then refreshes;
  a failed sent fetch falls back to the cached sent list (Principle II); empty sent list shows a clear
  "Žádné odeslané zprávy."

## 3. `MessageDetail` — sent orientation

- **Input:** `account`, `messageId`, `folder`.
- **Behaviour:** for `sent`, the envelope reads **you → recipient** (label the recipient prominently);
  delivery/acceptance times shown as for received. Attachment download (002) unchanged.
- **Invariants:** the attachment-open fix (AppState reset + deferred launch) applies to both folders.

## 4. `BoxOverflowMenu` (per-box `⋯`)

- **Props:** `onRename()` (→ `AliasEditor`), `onRemove()` (→ remove-confirm dialog).
- **Invariants:** replaces the inline pencil + trash; `accessibilityLabel` "Možnosti schránky"; the
  destructive **Odebrat** always routes through the existing confirmation (Principle IV — account
  removed, **local archive untouched**).

## 5. Home IA

- **Contract:** no bare `+` in the `BoxList` top bar; **"Přidat schránku"** lives in the `AppDrawer`
  (`☰`) menu; **no compose affordance anywhere on the home or a box card** (compose is reachable only
  inside a box). Adding a box still opens the existing add-box flow.

## 6. `SwipeableRow` primitive

- **Props:** `children`, `trailingActions: { label, tone: 'destructive'|'normal', onPress }[]`.
  *As built:* `children`, `rightAction: { label, icon?, color, background, onPress, testID? }`,
  `onPress`, `bodyBackground`, `enabled`. Used on compose draft rows (Zahodit, undoable) and the backup
  list. Box rows have not swiped since 011's switcher; a box is removed via the ⋯ menu.
- **Behaviour:** trailing (RTL) swipe reveals actions (Mail-style); runs on the native UI thread
  (gesture-handler/reanimated). A parallel **overflow menu** offers the same actions (a11y/discoverability).
- **Invariants:** **message rows expose NO destructive archive-delete** (Principle IV); destructive swipe
  exists only for **boxes** (→ confirm) and **drafts** (→ already undoable); honours **Reduce Motion**
  (no animation) and keeps a tappable fallback; never blocks the JS thread. *As built:* the destructive
  swipes are drafts (undoable) and backups (Smazat, confirmed); boxes no longer swipe.

## 7. `TestEnvBanner`

- ~~**Contract:** rendered once in `AppShell` above the navigator; full-bleed top bar (below the
  status-bar inset) shown when the **active box** is on `czebox`; soft-gold (`goldSoft`/`warningInk`),
  text "Testovací". Sits **above every screen header**. Removed from per-screen headers; the home/box
  card badge stays.~~
- **As built:** rendered in normal flow at the top of `MessageDetail` only (received and sent) when
  `account.host === "czebox"`, styled with `testBg`/`testFg`/`testBd`, label "Testovací prostředí".
  The message-list header and the box-switcher rows carry the `Testovací` pill (`TestTag`) instead;
  add-box/login use their own environment toggle.
- **Invariants:** AA contrast; doesn't overlap interactive headers (insets content); ~~reflects the
  active box (switching boxes updates it)~~. *As built:* never an overlay — it takes real layout space
  and pushes the message-detail header down, so it cannot cover content.

## 8. Platform modernization finish (optional, gated, platform-adaptive)

Track **both** OS design languages as co-equal; render the right idiom per platform (one RN/Tamagui
codebase, `Platform.OS` / themed variants), never one platform's look forced on the other.

- **iOS (26 "Liquid Glass"):** approximated translucent/floating surfaces (blur view) — any such surface
  MUST provide an **opaque fallback** under **Reduce Transparency** and disable shrink-on-scroll under
  **Reduce Motion**.
- **Android (Material 3 / "Expressive"):** **tonal-elevation** surfaces (not blur), Material **ripple**
  on press, swipe-to-dismiss with Material easing/haptics, optional **dynamic color**; the
  `Přijaté | Odeslané` reads as a **connected button group** (M3 deprecates segmented buttons), and the
  `☰` menu as a Material modal drawer. **Reduce Motion** disables spring flourishes.
- **Both:** meet **WCAG AA** (light + dark); keep `docs/ui-guide.md` tokens as the brand baseline. If a
  platform's finish can't meet AA + the a11y fallbacks cleanly, that finish is **omitted** and the
  structural UX still ships on both.
