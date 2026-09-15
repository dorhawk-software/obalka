# Feature Specification: Sending & Navigation UX

**Feature Branch**: `008-sending-navigation-ux`
**Created**: 2026-06-15
**Status**: Implemented (27/27). Design + decisions in [`docs/ux/sending-navigation-ux-plan.md`](../../docs/ux/sending-navigation-ux-plan.md). Later features moved some of it: 011 replaced the drawer and the box list with the switcher sheet, so box rows no longer swipe, and the inline `TestEnvBadge` is gone — the test environment now shows as the `TestEnvBanner` bar on the message detail only, and a *Testovací* tag on the list header and box rows.
**Input**: Adding message sending (005) broke the read-only navigation model. Three affordances are now
ambiguous and there's no Sent view. From user UX pointers (2026-06-15) + an on-device czebox finding.

## Problem

The app's information architecture assumed a **read-only** client, so there was exactly one "create"
concept — **add a data box** — and a bare **`+`** + a **pencil** were unambiguous. Sending introduces
three distinct intents the user must tell apart at a glance — **compose**, **add box**, **edit box** —
so the bare `+` (add box) now reads as "compose", and the per-box pencil (rename) reads as "compose"
too. There is also **no way to see sent messages**.

## Desired outcomes *(what & why)*

1. **See sent messages.** A user can view what a box has *sent*, not only received (ISDS exposes
   `GetListOfSentMessages`; our parser already supports it).
2. **Unambiguous "new message".** Compose is visibly distinct from "add box" and "rename box"; "create
   new (message)" semantics live only with compose, only inside a box.
3. **Recipient search that just works** by typing a name across **all box types** (like the web
   portal), with the **free-vs-paid** cost shown per recipient (OVM = free; private = paid PDZ 🪙).
4. **Never mistake a test box for the real one.** While the active box is on **czebox (Testovací)**,
   the user can always tell — at a glance, on every screen — that this is *not* their live (Ostrá)
   data-box, so test actions are never confused with real legal mail.
5. **Modern, platform-current, consistent design.** The app follows a documented style guide and the
   current platform design languages, so it reads as a 2026 app — not just "functional". Common
   expected gestures (e.g. **swipe-to-delete**) are present, and the visual language tracks the latest
   OS direction on **both platforms** — iOS 26 *Liquid Glass* **and** Android **Material 3 (Expressive)**
   — rather than drifting dated.

## Confirmed direction *(decisions — see the design doc for rationale/options)*

- **Sent messages:** a `Přijaté | Odeslané` **segmented control** in the box message list (not a
  timeline).
- **Add box:** moved into the top-left **menu (☰)**; **no bare `+`** on the home; compose never appears
  on the home or the box card.
- **Box card:** a per-box **overflow (⋯)** menu for **rename / remove** (drop the inline pencil + trash).
- **Recipient search:** ISDS **`ISDSSearch`** fulltext over **all** box types — a single field, **no
  type selector** — matching the web; each hit shows its type + a free/paid badge. (Rewires the
  `findRecipients` committed in 005, which used the structured `FindDataBox2` and hit czebox
  `dbStatusCode 1101` "must specify box type".)
- **Persistent test-environment banner (a11y, reported 2026-06-16):** when the active box's host is
  `czebox`, pin a **full-width "Testovací" bar at the very top of the screen — above every header**
  (Přijaté/Odeslané list, message detail, compose, reauth). Today the only signal is the quiet inline
  `TestEnvBadge` gold pill tucked in the header, which is easy to miss; promote it to an
  always-visible top bar so a test box can never be mistaken for a live (Ostrá) one. Render it once at
  the shell/navigation level (not per screen) so it sits above all headers and the system status bar
  inset; keep `TestEnvBadge`'s quiet styling cues (soft gold) but full-bleed. The home/box list can
  keep the per-card badge.
- **Design-system conformance + modernization (reported 2026-06-16).** Treat
  [`docs/ui-guide.md`](../../docs/ui-guide.md) as the **living style guide** — every screen conforms to
  its tokens/spacing/typography/elevation rules, and the guide is **extended** (not bypassed) as new
  patterns are added. Two concrete tracks:
  1. **Close interaction gaps users expect.** Add **swipe-to-delete** to list rows (boxes on the home,
     and message/draft rows) — a **trailing** (right-to-left) swipe revealing a destructive Delete/
     Archive action, per Apple HIG (the Mail-app standard); keep a non-gesture path too (the planned
     overflow `⋯` menu) for discoverability + accessibility. Pair destructive swipes with the existing
     remove-confirmation. *(RN: e.g. `react-native-gesture-handler` `Swipeable`/`ReanimatedSwipeable`;
     Android uses the same gesture, Material-styled.)*
  2. **Track the current OS design language — both platforms, co-equal.** **Fetch + learn** the latest
     references before building (research-gated), giving **iOS and Android equal weight** (Android is the
     primary build/test platform):
     - **iOS 26 — Apple HIG / "Liquid Glass"**: translucent *floating* nav that insets from edges +
       shrinks on scroll, specular highlights. RN has **no native glass** → only *approximate* (blur +
       opaque fallback); don't reproduce the native material.
     - **Android — Material 3 / "Material 3 Expressive"** (May 2025, Android 16): **spring motion**,
       **dynamic color** (Material You, optional), emphasized type, **ripple + haptics**, **tonal-
       elevation** surfaces (not blur). Note divergences that matter here: M3 prefers a **connected
       button group** over a segmented control (style the `Přijaté | Odeslané` per platform), Material
       **swipe-to-dismiss** styling for the swipe action, and a Material modal drawer for the `☰` menu.
     **Selectively adopt** what fits a bare-RN, cross-platform app + our brand, **platform-adaptive**
     where the idioms diverge — never force one platform's look on the other. Hard constraints (both):
     **WCAG AA contrast**, honour **Reduce Transparency / Reduce Motion** (opaque/motionless fallback),
     don't regress dark mode, keep `docs/ui-guide.md` as the brand baseline. This is a *direction to
     evaluate + selectively adopt*, not a literal "make everything glass" (or "make everything Material").
  References to pull during the build: Apple HIG <https://developer.apple.com/design/human-interface-guidelines>
  + iOS 26 "Liquid Glass" (WWDC 2025); **Material 3 <https://m3.material.io/> incl. Material 3 Expressive**
  (connected button group, swipe-to-dismiss, motion, dynamic color).

## Out of scope (later)

- "Nejčastější adresáti" (frequent recipients) + a personal address book ("Můj adresář").
- An "Vše/All" chronological timeline segment.
- The actual message **send** (`CreateMessage`/VoDZ) + attachments — **delivered in 005** (merged to
  main; VoDZ live-validated). 008 only adds the *navigation/UX* around it.

## Notes

This feature is cross-cutting (touches 002 messages, 005 sending, 007 navigation). Full analysis,
options considered, the action-model table, and the task outline live in
[`docs/ux/sending-navigation-ux-plan.md`](../../docs/ux/sending-navigation-ux-plan.md), which seeds the
`/speckit.plan` step.
