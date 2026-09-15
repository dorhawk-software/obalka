# Quickstart — Visual Redesign (009) acceptance

> **As built, later.** Some files named below were removed or replaced after 009 shipped:
> `src/theme/fileBadge.ts` is gone, `TestEnvBadge` became the `TestEnvBanner` bar plus a *Testovací* tag on
> box rows, `BoxList` / `AppDrawer` became 011's `BoxSwitcherSheet`, and `NotificationPrime` was deleted by 014.

> **The raw-hex allow-list has grown since.** The sanctioned palette files are the ones listed in
> `scripts/check-no-raw-hex.sh`; `fileBadge.ts` no longer exists.

Czebox + emulator walkthrough (Principle VII). Run **each** check in **light and dark** and in **cs and
en**. The redesign is "done" when every row passes and nothing regressed from the pre-redesign behavior.

## Setup
1. Build the x86_64 APK (`-PreactNativeArchitectures=x86_64`, JDK 17) and run on the AVD.
2. Sign in to a **czebox** test box (so the Testovací banner + tag are exercised).
3. Toggle Settings → Appearance between Light / Dark / System, and Language cs ↔ en, for every check.

## Foundation
- [ ] **Fonts**: headings render in Bricolage Grotesque, body in Public Sans — and still render in
      **airplane mode** (bundled, offline). Missing-font fallback keeps layout (no shift).
- [ ] **Palette**: every screen uses the warm-paper ramp; **no cool-navy leftover**; **no light surface
      in dark mode**; AA holds (spot-check chips, faint text, warning ink).
- [ ] **No raw hex** audit passes (only `theme.ts`/`avatar.ts`/`fileBadge.ts`).
- [ ] **Primary buttons** are dark high-contrast; selection/radios are blue. `docs/ui-guide.md` updated.
- [ ] **Logo**: our `LogoMark` (not the design's inline envelope) shows on welcome/inbox/lock/add-box/
      switcher, legible on `bg`. *(As built, later: the logo is on Welcome, the launch screen and
      Licences; Lock shows a brand tile with the brand padlock instead, and the inbox header, add-box
      header and box switcher do not carry it - see `tasks.md` T040.)*

## Screens (behavior preserved + matches design)
- [ ] **Inbox**: switcher header (+ Testovací tag on the czebox box); `Přijaté | Odeslané` switches
      folders; **sync line is constant height** (toggling refreshing/synced moves nothing); pull-to-
      refresh works; "Vyžaduje pozornost" + date sections (Dnes / Včera / Tento týden …) render; gold
      compose FAB opens compose.
- [ ] **Offline/error**: kill the network → offline strip shows (no jump); force a load failure →
      loadError view + **Zkusit znovu** retries; an expired box → reauth strip → Re-auth.
- [ ] **Sent**: switch to Odeslané → recipient-oriented rows + delivery-state chip + week/earlier;
      empty box shows the empty state; open one → **Sent Detail** (Komu card + delivery timeline).
- [ ] **Detail**: postmark card (Dodáno/Doručeno); **multiple attachments** list with file-type tiles;
      "Stáhnout přílohy" downloads all-or-nothing with progress; downloaded rows show saved✓; a >90-day
      message shows "Příloha už není dostupná" (archive distinction intact).
- [ ] **Compose**: recipient search + free/paid cost; **attachment chips + Přidat přílohu**; a paid PDZ
      recipient → **paid-send confirm sheet** before send; drafts list; send → success screen.
- [ ] **Search**: results render with box pill; empty query → hint; no match → empty state.
- [ ] **Settings**: appearance/language/security/backup/about re-skinned; ~~**Upozornění** row opens the
      priming sheet;~~ *(removed by 014 - no notifications screen)* the **"States" demo section is
      absent**; deadlines/scan row present (010-gated).
- [ ] **Add-box**: method picker, Pokročilé → Ostré/Testovací; creds (eye toggle, MK hint, **OTP-suggest
      card** offers SMS); password sign-in works on czebox.
- [ ] **OTP**: SMS code entry + confirm + resend.
- [ ] **Mobile-Key waiting**: pulsing halo + waiting copy; on **real poll** approval it advances (the
      demo-confirm button is absent); timeout → expired + retry; Reduce-Motion → static.
- [ ] **Re-auth**: locked identity card (uneditable), method chip, wrong-password error + retry.
- [ ] ~~**Notif priming**: sheet enable → **real OS permission prompt** appears; later → dismisses, no nag.~~
      *(removed by 014 - no notifications screen)*
- [ ] **Box switcher / ⋯ / rename / remove**: switch boxes, rename (alias), remove (confirm) all work.
- [ ] **Snackbar**: discard a draft → snackbar + **Vrátit zpět** restores it.

## Cross-cutting
- [ ] **No layout jumps** anywhere a transient element toggles (sync line, badges, spinners, banners).
- [ ] **No UI-thread block** on launch or during a sync/download (scroll stays smooth — Principle I).
- [ ] `npm run lint`, `npm test`, `tsc --noEmit` clean.
- [ ] Dark mode not regressed; Reduce-Motion / Reduce-Transparency respected.
