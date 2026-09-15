# Quickstart — Inbox-first navigation (011) acceptance

**Walked per `tasks.md` T025 on two czebox boxes:** launch, switcher, in-place switch, relaunch
persistence, back and add-box passed, and those rows are ticked below. Notification deep-link and
zero/last-box → Welcome are unit-covered only (`__tests__/app/deeplink.test.ts`,
`__tests__/accounts/activeBox.test.ts`) and were not walked. Unticked rows were not recorded as walked.

Czebox + emulator walkthrough (Principle VII). Ideally add **two** czebox test boxes to exercise
switching + last-used persistence. Run the relevant rows in light + dark.

## Setup
1. Build/run the x86_64 debug APK on the AVD (JDK 17), Metro running.
2. Sign in to **one** czebox box; then add a **second** czebox box (via the switcher) if available.

## Launch & active box
- [ ] **First launch (1 box)**: lands directly on that box's **inbox** (not a box list).
- [ ] **Zero boxes**: lands on **Welcome** → add-box.
- [x] **Last-used restore**: switch to box B, fully close + relaunch → opens **box B** (the last-used).
- [ ] **Stale/missing persisted id** (e.g., box removed): app falls back to the first box (or Welcome) — no crash.

## Box switcher (the only multi-box surface)
- [x] Tapping the header **switcher button** opens the bottom sheet listing all boxes (active ✓, unread
      badge, Testovací tag on czebox, per-box ⋯). *(T025 recorded both boxes listed with the active ✓;
      the badge, tag and ⋯ were not itemised.)*
- [x] Picking another box **switches in place** (inbox updates, no push/pop) and the sheet closes.
- [x] **"Přidat schránku"** from the sheet enters add-box; on success the new box is active + its inbox shows.
- [ ] **"Nastavení"** from the sheet opens Settings; back → inbox.
- [ ] Per-box **⋯** → rename/remove still work; removing the active box falls back to another (or Welcome).
- [ ] No standalone box-list screen and no left drawer exist anymore.

## Inbox header
- [ ] Shows one sunken bar: the **switcher button** | divider | **search** (the wordmark originally
      specified here was later dropped by the design); **Testovací** tag on a czebox box; the shell
      Testovací banner sits above.
- [ ] **Pull-to-refresh** refreshes the **active box**.

## Notifications / deep-link
- [ ] A deadline-reminder notification for the **non-active** box → tapping it **switches to that box** and
      opens the **specific message** (MessageDetail). *(Was "new-mail notification"; 014 removed those.)*
- [ ] Notification for a removed box/message → degrades to that box's inbox / the active inbox, no crash.

## Back / gesture
- [ ] From detail/compose/settings → back returns to the **inbox**.
- [x] On the **root inbox** (Android): back **exits to the launcher**; with the switcher sheet open, back
      **closes the sheet** first.
- [ ] iOS: edge-swipe pops sub-screens to the inbox; on the root inbox there's **no app-level back** (leave
      via the OS home gesture).

## Cross-cutting
- [ ] App-lock gate + shell Testovací banner unaffected; dark mode intact; **no layout jumps** on switch.
- [ ] No UI-thread block on launch/switch (scroll stays smooth — Principle I).
- [ ] `npm run lint`, `npm test`, `tsc --noEmit` clean; the 009 visuals are unchanged.
