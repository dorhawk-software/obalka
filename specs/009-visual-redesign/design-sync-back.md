# Sync-back to Claude Design — deviations the 009 build made

Claude Design (`Obalka Redesign.dc.html`) is the **source of truth**. During the port the implementation
had to deviate in a few places — almost entirely **WCAG AA contrast** corrections (the mock uses several
light inks that fail on small text), plus two **mock-only** prototype controls that shouldn't ship, plus
the logo. **These changes were NOT made to the design file** — paste the prompt below into Claude Design
so the design matches the code. (The code can then be re-synced from the updated design later.)

Nothing structural/layout changed — only specific token values + two control removals + the logo.

## Re-sync status (2026-06-30)
Re-imported after Claude Design was updated:
- ✅ **A (light text AA), B (avatar palette), C (dark ink on gold FAB + unread badge), E (logo)** — applied
  in the design and now **exactly match the code** (`#736A57`, `#8C6100`, `#2A744B`, `#B5362F`, the
  darkened avatar hues, FAB/badge ink `#211B12`). Colors/ink are fully in sync; no code change was needed.
- ⬜ **D (remove the two mock-only controls)** — **still outstanding in the design**: the Settings
  **"States"** section (`offlineToggle`/`errorToggle`) and the Mobile-Key **demo confirm** button
  (`mkConfirmedDemo`) are still present. The **code intentionally omits both** (prototype scaffolding /
  non-functional — Principle VI honesty), so no code change. Please re-run items **8 & 9** below in
  Claude Design to drop them, or confirm they should remain design-only prototype affordances.

## Round-trip 2 (2026-06-30) — Received list now date-grouped ✅
User flagged that **Received** showed a flat list (no headings) while **Sent** had date headings. Decision:
date-group **both**. This was a **design change**, so Claude Design was updated **first** (Received now uses
date-grouped `restSections` with `sec.title` headers — Dnes / Včera / Tento týden / Tento měsíc / month —
keeping "Vyžaduje pozornost" on top; the flat "Dříve" header is gone). Re-synced + matched in code
(`MessageList.tsx`: the received remainder runs `groupByDate`, the row component is chosen by **folder**
not section kind, the `'earlier'` section kind retired). Verified live on czebox (received shows "Tento
měsíc"). Design + code in sync.

---

## Paste this into Claude Design (the `Obálka app design overview` project)

> Update `Obalka Redesign.dc.html`. These are **WCAG AA contrast fixes** (several current colors fail
> ≥4.5:1 on small text) plus two mock-only controls to remove and the logo. Keep all layout/structure;
> change only the values/elements below.
>
> **A. Light-mode text colors that fail AA — darken them:**
> 1. Faint meta/timestamp text `fnt`: `#9A9180` → **`#736A57`** (currently ~2.7:1; the new value is ≥4.5:1).
> 2. Amber/warning ink (deadline-amber chip text, "approx. cost" warning ink): `#9A6B00` → **`#8C6100`**.
> 3. Green "Zdarma/free" + delivered chip text: `#2E7D52` → **`#2A744B`** (text only; solid-green fills/dots can stay `#2E7D52`).
> 4. Red urgent/danger chip text: `#BE3A34` → **`#B5362F`** (text only).
> 5. Gold-brown link text (`#B07F00` — "Obnovit", "Změnit", "Přidat přílohu"): → **`#8C6100`** (it currently fails AA on the paper bg).
>
> **B. Avatar circle/tile palette — darken three hues so the white initials pass AA** (white text needs ≥4.5:1):
> - teal `#0E8C8C` → **`#0E6E6E`**, purple `#7A6BC4` → **`#5A4CA8`**, green `#2E7D52` → **`#1B6E52`**, gold `#C98A00` → **`#8A5A18`**. Keep `#2A5C9A` and `#1E4E80`.
>
> **C. White-on-gold fails AA — make the ink dark:**
> 6. The compose FAB (the gold "Napsat" button): the pencil icon + label should be **dark `#211B12`**, not white.
> 7. The unread-count badge (the gold pill on a box avatar): its number should be **dark `#211B12`**, not white.
>
> **D. Remove two mock-only prototype controls (they don't represent real app behavior):**
> 8. In **Settings**, delete the whole **"Stavy/States"** section (the two preview toggles `offlineToggle`/`errorToggle`). The offline/error states are driven by real network/load conditions, not user toggles.
> 9. In the **Mobile-Key waiting** screen, delete the demo **"…confirmed"** button (`mkConfirmedDemo`). The real flow advances automatically when the Mobile-Key approval is confirmed in the separate app (a poll) — there's no in-app confirm button. Keep the waiting + expired/retry + cancel states.
>
> **E. Logo:** use the real **Obálka app icon** (the project's rounded-square envelope badge — blue body + gold flap) wherever the small inline envelope appears. On the **Welcome** screen, show that icon **on its own** at ~120px — NOT inside a separate blue tile (the icon is already a blue badge, so a blue tile makes the body read blue-on-blue). [Per the earlier "use our logo, theirs is too small" direction.]
>
> Czech-first; keep the dark-mode variants (they already pass AA — no change needed there).

---

## NOT design changes (as of 2026-06-30)
These differ in the **code** only because of current app scope/IA, and the design is correct for the
target state:

*Since then:* 011 built the inbox-first home, and the backup row ("Záloha archivu" › "Zálohovat
archiv") and the attachment-scan toggle ("Hledat termín v příloze") both exist. Reply and a "Detail
doručení" action bar are still not built; a delivery record (`DeliveryRecord.tsx`) exists instead.

- **Per-box inbox** keeps a back chevron (no top wordmark/search) — the design's wordmark + search belong
  to the eventual **inbox-first** top-level home; that IA refactor is a separate, later task.
- **Reply / "Detail doručení"** action bars (detail/sent), the **Zálohování/backup** settings row, and the
  **"Hledat termíny v dokumentech"** deadlines toggle are valid **future** designs (features 006 backup /
  010 deadlines) — the code just doesn't surface them yet. Keep them in the design.

## After Claude Design is updated
Re-import via the `claude_design` MCP and reconcile `design-system.md`; the code already matches these
values, so it should be a no-op diff (confirmation only).
