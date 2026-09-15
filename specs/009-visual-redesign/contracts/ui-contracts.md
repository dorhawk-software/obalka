# Phase 1 UI Contracts — Visual Redesign (009)

> **As built, later.** Some files named below were removed or replaced after 009 shipped:
> `src/theme/fileBadge.ts` is gone, `TestEnvBadge` became the `TestEnvBanner` bar plus a *Testovací* tag on
> box rows, `BoxList` / `AppDrawer` became 011's `BoxSwitcherSheet`, and `NotificationPrime` was deleted by 014.

> **The raw-hex allow-list has grown since.** The sanctioned palette files are the ones listed in
> `scripts/check-no-raw-hex.sh`; `fileBadge.ts` no longer exists.

The app's "external interface" is its UI. The **design contract** was
[`../design-system.md`](../design-system.md) (tokens, type, component metrics, per-screen specs §1–§7), the
2026-06-30 import; the values that shipped now live in [`DESIGN.md`](../../../DESIGN.md) and `src/theme/`.
This file states the **acceptance contract** each surface must satisfy when ported.

## C0 — Token & type contract (foundation)
- Every color comes from a `useTheme()` token; **zero raw hex** in screens (only `theme.ts`,
  `avatar.ts`, `fileBadge.ts`). Both `lightTheme`/`darkTheme` define every key incl. `testBg/testFg/testBd`,
  `bodyText`.
- Every text node uses a `Typography` role (no raw `fontSize`/`fontWeight`/`color`). Display/headings =
  Bricolage Grotesque; body/UI = Public Sans; fonts render **offline**.
- Radii/spacing/borders come from the `design-system.md §3` scale; the **same pattern shares metrics**
  across screens. Primary buttons = dark high-contrast (`text` fill / `surface` label).
- Both schemes pass **WCAG AA**; no light-only literal appears in dark mode.
- Any transient/async element occupies **reserved space** — no layout jump.

## C1 — Per-screen contract (matches `Obalka Redesign.dc.html`)
Each screen, in **light + dark** and **cs + en**, matches the referenced design section and preserves
its current behavior:

| Surface | Must render (design ref) | Preserves |
|---|---|---|
| **Welcome** | logo, tagline, [Přidat datovou schránku], FAQ link ([Obnovit] not shipped) | first-run / add-box entry |
| **Inbox** | switcher-button header (+ test tag), `Přijaté\|Odeslané` segmented, constant-height sync line, "Vyžaduje pozornost" + date sections (Dnes / Včera / Tento týden …; the flat "Dříve" header was retired, see `design-sync-back.md`), offline strip, loadError+retry, reauth strip, gold FAB | message list, pull-to-refresh, sync status, compose entry |
| **Sent list** | recipient-oriented rows + delivery-state chip, week/earlier sections, empty state | 008 sent view (`listSent`) |
| **Detail** | deadline banner, subject, postmark sender card, body, **multi-attachment list** + download-all + saved✓ + 90-day "unavailable" | attachment all-or-nothing download, local-archive distinction |
| **Sent Detail** | recipient "Komu" card + delivery **timeline** + "Detail doručení" | sent-message metadata |
| **Compose** | recipient search + free/paid cost, subject/body + note, **attachment chips + add**, **paid-send confirm sheet**, drafts, sent success | send flow, cost model, drafts, attachments |
| **Search** | input, count + results (boxPill), **empty state** | offline archive search |
| **Settings** | appearance, language, deadlines(scan — 010), security(app-lock), ~~**Upozornění row**~~ *(removed by 014)*, backup, about | settings behavior; **OMIT demo "States" section** |
| **Lock** | ~~logo~~ brand tile + brand padlock *(as built, see tasks.md T040)*, unlock title/sub, [Odemknout], hint | biometric gate |
| **Add-box** | method picker, env (Pokročilé), creds (+eye, mk hint, **OTP-suggest card**) | 2-step add-box, prod/czebox |
| **OTP** | 6-digit input, confirm, resend | SMS login |
| **Mobile-Key waiting** | pulsing halo, waiting/expired, retry/cancel | MEP poll (`mepWsStateUpdate2`) — **not** the demo button |
| **Re-auth** | locked identity card, method chip, error, pwd+eye, submit | re-auth an expired box |
| ~~**Notif priming**~~ | *removed by 014* | *removed by 014* |
| **Box switcher** | box rows (+ test tag, active ✓, ⋯), dashed add, settings | switch/add/settings |
| **Box ⋯ / Rename / Remove** | action sheet + dialogs | rename (alias) / remove (confirm) |
| **Snackbar** | `text`-fill bar + gold action | draft saved/discarded + undo |

## C2 — Negative contract (do NOT ship)
- The Settings **"States"** preview section.
- The Mobile-Key **demo-confirm** button.
- Any notif-enable that only dismisses (must request OS permission).
- New deadline **behaviors** (reminders, scanning) — those are 010; 009 ships the chip **visuals** fed by
  the deterministic fikce signal (or gated off).

## C3 — Acceptance signal
A surface is "done" when: it matches its design section in both schemes + both languages, keeps its
behavior, passes AA, jumps nowhere, and is exercised on a czebox box (Principle VII). Tracked screen-by-
screen in `quickstart.md`.
