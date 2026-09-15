# Quickstart / Acceptance: Sending & Navigation UX

> **As built, later.** 011 replaced the ☰ drawer and the box list with the box switcher sheet; box rows
> no longer swipe; the Testovací banner shows on the message detail only. Scenarios 3, 5 and 6 carry
> notes on what to check today.

Manual run-through on the Android emulator against a **czebox** test box (Principle VII). Each scenario
maps to a desired outcome / contract.

## Setup
- A czebox box added (password or OTP); at least one **sent** message exists (send one via 005 first —
  e.g. the validated free send to an OVM).
- Reduce Transparency / Reduce Motion toggles available in the OS accessibility settings for track 5.

## Scenarios

1. **See sent messages (outcome 1).** Open a box → a **`Přijaté | Odeslané`** control shows at the top.
   Tap **Odeslané** → the sent list loads (the message you sent appears, you→recipient). Switch back to
   **Přijaté** instantly. Kill the network and re-open → the sent list still shows from cache (offline).
   An empty sent box shows "Žádné odeslané zprávy."

2. **Sent detail orientation.** Open a sent message → it reads **you → recipient**, with delivery/
   acceptance times. Opening + closing an attachment does not freeze the screen (002 fix).

3. **Unambiguous create (outcome 2).** On the **home**: there is **no bare `+`** and **no compose**
   action. "Přidat schránku" is in the **`☰`** menu and still adds a box. Compose is reachable **only**
   inside a box (the box's "Nová zpráva").
   *As built, later:* "Přidat schránku" is in the box switcher sheet.

4. **Box overflow (outcome 2).** Each box card shows a single **`⋯`** (no inline pencil/trash). It opens
   **Přejmenovat** (the alias editor) and **Odebrat** (the confirm dialog). After removing a box, its
   **locally-archived messages are not destroyed** by the app's archive (Principle IV).

5. **Swipe-to-delete (outcome 5).** **Trailing-swipe** a **box** row → **Odebrat** → confirm. Trailing-
   swipe a **draft** row → **Zahodit** (undoable). A **message** row swipe offers **no** destructive
   archive-delete. With **Reduce Motion** on, the swipe still works without animation; the **`⋯`** menu
   offers the same actions for screen-reader users.
   *As built, later:* only draft rows swipe (Zahodit, undoable); a box is removed via ⋯ → Odebrat.

6. **Testovací banner (outcome 4).** In a czebox box, a full-width **"Testovací"** bar sits at the very
   **top — above every header** (Přijaté/Odeslané, detail, compose, reauth). It can't be missed and
   meets AA contrast in light + dark.
   *As built, later:* the banner sits above the message-detail header; the list header and switcher
   rows show the Testovací pill.

7. **Design conformance (outcome 5).** Spot-check screens against `docs/ui-guide.md` (tokens, radii,
   elevation, type). IF a glass/floating finish shipped: with **Reduce Transparency** on it falls back to
   an **opaque** surface; dark mode is intact; contrast still AA.

## Definition of done (per constitution)
- UI never blocks the JS thread during any sent-list load, swipe, or animation (I).
- Every list/segment/swipe has a localized error/empty/retry state and never hard-crashes (II/V).
- The local archive is never silently deleted by any gesture (IV).
- cs primary + en mirror for all new strings; dark mode + AA preserved (V).
- All exercised on a czebox box on the emulator (VII); `tsc`/`eslint`/`jest` clean.
