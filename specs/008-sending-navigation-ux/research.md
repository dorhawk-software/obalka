# Phase 0 Research: Sending & Navigation UX

Resolves the unknowns in the plan. Grounded in the existing code (`messagesStore`, `MessageList`,
`BoxList`, `AppDrawer`), the design doc, and the constitution. Format: **Decision / Rationale /
Alternatives**.

## 1. Sent-list caching — a `folder` dimension on the message cache

**Decision**: Cache sent messages **alongside** received in the existing `messages` table, distinguished
by a new **`folder TEXT` column** (`'received'` | `'sent'`), defaulting existing rows to `'received'`
(additive migration). `messagesStore.cacheList`/`getList` take a `folder`; `messagesController.listSent`
mirrors `listReceived` but calls `getSentMessages` and caches under `folder='sent'`. The
`Přijaté | Odeslané` segment selects which folder to read.

**Rationale**: `messagesStore` keys rows by `(boxId, messageId)` only — received and sent dmIDs would
otherwise share one bucket and interleave. A `folder` column is the minimal, reversible change; it
keeps one table + one search index (004 FTS still works) and the cache code stays symmetric. The sent
list is part of the **durable archive** (Principle IV) just like received.

**Alternatives**: A separate `sent_messages` table — rejected (duplicates the schema, the store, and
the search/sync code). Not caching sent (live-only) — rejected (offline-archive consistency + the
constitution).

**Open for the build**: confirm `GetListOfSentMessages` envelope orientation on czebox — `dmRecipient`
is the *recipient* (vs received's sender); the sent detail orients **you → recipient**. `getSentMessages`
+ `parseMessageList` already exist (used by the 005 no-double-charge reconcile + delivery confirmation).

## 2. Swipe-to-delete — library + the Principle IV guard

**Decision**: Use **`react-native-gesture-handler`** `ReanimatedSwipeable` (+ `react-native-reanimated`)
for a **trailing** (right-to-left) destructive swipe, behind a reusable `SwipeableRow` primitive that
ALWAYS pairs with the existing **overflow `⋯` menu** (the non-gesture, screen-reader path). Apply it to:
- **Box rows** (home) → reveals **Odebrat** → the existing remove-confirmation dialog (account removed,
  archive untouched).
- **Draft rows** (compose) → reveals **Zahodit** (drafts are ephemeral; already undoable via the
  snackbar).
- **Message rows** → reveals **Archivovat/secondary action, NOT a destructive delete** — see guard.

**Principle IV guard (the constitution watch-item)**: the durable local archive is sacred, so a swipe on
a *message* row MUST NOT silently delete archived mail. Resolution: message-row swipe does **not** offer
a destructive "delete from archive"; destructive swipe is reserved for **boxes** (confirmed) and
**drafts** (ephemeral + undoable). If a message-level action is wanted later it is a reversible one
(mark read / archive flag), never a silent purge.

**Rationale**: gesture-handler/reanimated is the RN-standard for swipe actions (Mail-style trailing
swipe, Apple HIG), runs on the **native UI thread** (Principle I), and `ReanimatedSwipeable` is the
current (non-deprecated) API. Keeping the overflow menu as a parallel path satisfies discoverability +
a11y (Principle V).

**Alternatives**: A pure-JS pan-responder swipe — rejected (janky, blocks the JS thread). Swipe-only
(no menu) — rejected (undiscoverable, fails screen-reader). A destructive message delete — rejected
(Principle IV).

**Build gate (B0)**: these are **new native deps** → an APK rebuild + **New-Architecture compatibility
check** (reanimated needs its Babel plugin + correct Fabric setup). The whole swipe/glass track is
gated on a clean build spike before anything in track 5 ships.

## 3. Platform design languages — iOS 26 Liquid Glass AND Android Material 3 (co-equal)

**Decision**: Track **both** current OS design languages as **peer references**, and make the visual
language **platform-adaptive** where the conventions genuinely diverge — not iOS-first with Android as an
afterthought. **Android is in fact our primary build/test platform**, so Material 3 conformance is at
least as load-bearing as the iOS finish. Adoption stays **research-gated + bounded** (no rewrite); both
sides share the same hard gates.

**iOS 26 — "Liquid Glass"** (WWDC 2025): translucent *floating* nav that insets from edges + shrinks on
scroll, specular highlights. RN has **no native glass material** → we only *approximate* (a blur/
translucent surface, a floating segmented island) with an **opaque fallback**; we do **not** reproduce
the native material.

**Android — Material 3 / "Material 3 Expressive"** (May 2025, Android 16): the current Android language —
**spring-based motion**, **dynamic color** (Material You, optional), emphasized typography, **ripple +
haptics** on press/dismiss, **tonal-elevation** surfaces (not blur), and updated component guidance.
Concrete, *load-bearing* divergences from iOS for this feature:
- **`Přijaté | Odeslané`** — iOS reads as a **segmented control**; M3 Expressive deprecates segmented
  buttons in favour of a **connected button group**. → our `SegmentedControl` is themed to read as the
  right idiom per platform (segmented pill on iOS, connected group on Android), one component.
- **Swipe-to-delete** — on Android, Material **swipe-to-dismiss** styling: ripple, the detach/haptic
  feel, Material easing; on iOS, the Mail-style trailing reveal. Same `SwipeableRow`, platform feel.
- **`☰` menu** — a modal drawer (scrim-tap / edge-swipe to dismiss) is fine and Material-consistent;
  note M3 Expressive's lean toward a navigation rail on larger screens (not needed at phone size).
- **Surfaces** — iOS leans translucent/glass; **Android leans tonal elevation** (no blur). Our floating/
  elevated surfaces use the guide's elevation scale; any blur is iOS-only with an Android tonal equivalent.

**Shared hard gates (both platforms):** WCAG AA contrast; **Reduce Transparency** → opaque; **Reduce
Motion** → no shrink-on-scroll / no spring flourishes; working **dark mode** intact; everything still
themed from `docs/ui-guide.md` (extended, not bypassed). If a platform finish can't meet AA + the a11y
fallbacks cleanly, **defer that finish** and ship the structural wins (segments, IA, overflow, banner)
on both.

**Rationale**: Honest scope (VI) + "modern, accessible" (V) on **both** platforms a cross-platform Czech
app actually ships to — and Android is where we validate. Forcing one platform's look on the other reads
as un-native; brand-consistent + platform-respectful is the bar.

**Alternatives**: iOS-led with Android "good enough" — rejected (Android is the primary platform; un-
Material Android feels off). Full native fidelity on each (separate native UIs) — rejected (one RN/
Tamagui codebase; out of scope). Heavy blur everywhere — rejected (perf + AA on Android, no native glass).

**Build**: fetch the live references first — Apple HIG <https://developer.apple.com/design/human-interface-guidelines>
+ iOS 26 "Liquid Glass" resources (WWDC 2025), **and** Material 3 <https://m3.material.io/> incl.
**Material 3 Expressive** (connected button group, swipe-to-dismiss, motion, dynamic color).

### 3a. Concrete bounded adoptions (T019 — fetched + decided)

Grounded in the live refs (Material 3 **button-groups** guidelines + shape scale; Apple HIG segmented
controls + iOS 26 Liquid Glass / WWDC25). M3 Expressive **deprecates segmented buttons in favour of the
connected button group** (segments separated by a small gap so they can animate width/shape; selected =
filled toggle). iOS keeps the **segmented control** idiom (a floating "island" under Liquid Glass). What
we actually ship in T022 — **one `SegmentedControl`** (`Platform.select`), bounded, no rewrite:

- **Android — Material 3 connected button group (ADOPT):** two segments as a *connected group* — a small
  gap (~3) between them, each a pill/rounded shape; the **selected** segment is *filled* with a tonal
  tint (`blueSoft` + brand text), the unselected is a quiet `surfaceAlt`. **Ripple** on press
  (`Pressable android_ripple`, brand-tinted, bounded to each segment). Material easing on change; no
  spring flourish. *Skip (bounded):* dynamic color / Material You (theming churn), Expressive shape-morph
  on press (perf/complexity), navigation rail (phone size).
- **iOS — segmented control + Liquid Glass (ADOPT lightly / DEFER glass):** the existing raised-pill
  segmented control already reads as the iOS idiom — keep it. **Liquid Glass is deferred to on-device iOS
  testing**: RN has no native glass; we'd only approximate a translucent floating island with an
  **opaque Reduce-Transparency fallback**. Ship the structural wins first; revisit the approximation after
  the IPA test (reversible).
- **Both:** the swipe action is one `SwipeableRow` (Mail-style trailing reveal on iOS, Material ripple
  feel on Android). **Haptics deferred** — needs a native module + another rebuild (out of the current
  bounded scope; RN `Vibration` is too crude to pass as "Material haptics").

**Hard gates unchanged:** WCAG **AA** in light+dark; **Reduce Transparency → opaque**; **Reduce Motion →
no flourish**; dark mode intact; everything themed from `docs/ui-guide.md` (extended, not bypassed). If a
finish can't meet the bar it's deferred, not shipped half-done.

Refs: M3 button groups <https://m3.material.io/components/button-groups/guidelines> · M3 shape scale
<https://m3.material.io/styles/shape/corner-radius-scale> · Apple HIG segmented controls
<https://developer.apple.com/design/human-interface-guidelines/segmented-controls> + iOS 26 Liquid Glass (WWDC25).

## 4. Persistent "Testovací" banner — shell-level

**Decision**: A new `TestEnvBanner` rendered **once in `AppShell`** (above `AppNavigator`), full-bleed
at the very top (below the status-bar inset), shown whenever the **active box's host is `czebox`**. Soft
gold (reuse `TestEnvBadge`'s cues: `goldSoft` bg, `warningInk` text) but full-width. The inline
`TestEnvBadge` is removed from the per-screen headers (it moves up); the home/box-card badge stays.

**Rationale**: Rendering once at the shell level guarantees it sits above every screen's header + survives
navigation (same approach as the 005 `SnackbarProvider`). Keyed off the **active** box so it reflects
the box you're in.

**Alternatives**: Per-screen banner — rejected (repetitive, drift-prone, can't sit above headers). A
color-tinted status bar only — rejected (too subtle; the whole point is it can't be missed).

**Open**: when no box is active (home with mixed environments), show the banner only if *all* boxes are
czebox, or suppress on the home (the per-card badge covers the home). Decide during the build.

## 5. Home IA + per-box overflow `⋯` menu

**Decision**: Remove the bare `+` from the `BoxList` top bar; move **"Přidat schránku"** into the
existing **`AppDrawer` (☰)** menu. Replace each box card's inline **pencil (`EditIcon`) + trash
(`TrashIcon`)** with a single **`⋯` overflow menu** (`BoxOverflowMenu`) → **Přejmenovat** (reuses the
existing `AliasEditor` modal) + **Odebrat** (existing remove-confirm). Compose stays **only inside a
box** (the `MessageList` header compose button from 005).

**Rationale**: One affordance per intent (design-doc action model); declutters the card; kills the
`+`-means-compose and pencil-means-compose ambiguity. Reuses `AliasEditor` + the remove dialog (no new
flows).

**Alternatives**: A labeled "+ Přidat schránku" row at the list end (design-doc option B) — acceptable
fallback if the menu feels hidden; decide during the build. Keep inline icons — rejected (the ambiguity
this feature exists to fix).

## 6. Segmented control

**Decision**: A small reusable **`SegmentedControl`** (Tamagui, themed) for `Přijaté | Odeslané` — two
pill segments, selected = `blueSoft` tint + brand text, per `docs/ui-guide.md`. Pure RN, no new dep.
It drives `MessageList`'s folder; each folder keeps its own load/refresh + cache.

**Rationale**: Conventional, scannable (design-doc Issue 1, option A); no native dep; matches the guide's
selector styling. An "Vše/All" segment stays out of scope (spec).

**Alternatives**: `@react-native-segmented-control` — rejected (native dep for a trivial control). Top
tabs (react-navigation/material-top-tabs) — heavier; the list already owns its header.
