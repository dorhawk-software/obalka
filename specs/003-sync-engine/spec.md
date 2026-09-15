# Feature Specification: Reliable Sync Engine & Notifications

**Feature Branch**: `003-sync-engine`
**Created**: 2026-06-13
**Status**: Implemented 2026-06, then **removed by [014](../014-no-background-sync/spec.md) on 2026-08-14.** The app no longer syncs in the background or posts new-mail and re-auth notifications: the ISDS operating rules allow an application on a local station to sign in only on the user's manual command, and listing messages is itself legal delivery. What survives is refresh on the user's request and re-auth scoped to one box; the only notification today is 010's user-set deadline reminder. Kept as the record of what was built.
**Input**: Roadmap feature 003 — off-main-thread incremental sync, background fetch + local
notifications for new mail, progress UI that never blocks. The incumbent app's #1 gripe is "neaktualizuje
poštu" (doesn't sync) + freezes. Plus a user request: notify (ONCE) when a background sync fails on
credentials so the user knows to re-auth.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Get notified about new mail (Priority: P1)

While the app is backgrounded/closed, it periodically syncs the boxes; when a box receives new
messages, a local notification tells the user.

### User Story 2 - Get told (once) that a box needs re-auth (Priority: P1)

When a background sync fails because a box's login/session is no longer valid, the user is notified —
**exactly once** per failure episode — that they likely need to re-authenticate. They are never
spammed about the same failure.

### User Story 3 - Understand notifications before granting (Priority: P1, UX)

Before the OS permission dialog, the app **explains** what notifications it will send (new mail, re-auth)
so the user can make an informed choice (a context-free system prompt gets denied).

### User Story 4 - Sensitive content hidden on a locked phone (Priority: P1, privacy)

Notifications name a box and carry message info — government correspondence. On a **secure, locked**
phone the content is **concealed**; it is revealed only after unlock.

## Requirements *(mandatory)*

- **FR-001 (background sync, user-set cadence)** Periodic background sync via
  `react-native-background-fetch` (WorkManager on Android / BGTaskScheduler on iOS) + a **Headless JS**
  task so it runs even when the app is terminated (registered in `index.js`). The user picks the
  cadence in Settings — **Off / ~hourly / ~6 hours / once a day** (`syncInterval`, default hourly).
  `applyBackgroundSync(minutes)` (re)configures on launch + whenever the setting changes; **Off**
  stops it entirely (only the foreground launch-sync + pull-to-refresh remain). The interval is an OS
  **minimum/floor** — the OS batches background work, so the real cadence is "at most this often,"
  surfaced honestly in the UI ("přibližně – načasování řídí systém"). Less-frequent / Off also reduces
  background §17/3 auto-delivery.
- **FR-002 (engine)** `runBackgroundSync` (pure, dependency-injected → unit-tested) refreshes every
  box, NEVER throws, and decides what to notify. It reuses the existing controllers (no UI). Skips
  boxes already flagged `reauth`.
- **FR-003 (new-message notify)** A box whose sync returns messages **not previously cached** triggers
  a new-message notification (count). The **first population** (empty cache) is suppressed so a
  freshly-added box doesn't "storm".
- **FR-004 (re-auth notify, EXACTLY once)** A sync failure classified as `reauth` (`classifyFailure`,
  shared with the home) notifies the user — but only on the **transition into** reauth: boxes already
  flagged `reauth` are skipped (never re-notified), and the flag is persisted (`syncError`), so a box
  stuck needing re-auth is notified once; a successful re-auth clears the flag, re-arming a future
  notice. Transient errors never notify.
- **FR-005 (permission priming)** A one-time `NotificationPrime` dialog explains the notifications
  (new mail + re-auth) BEFORE calling `requestNotificationPermission()` (which shows the OS dialog).
  "Teď ne" defers; the `notifPrimed` setting ensures it shows once.
- **FR-006 (styling, two types, two channels)** Two notification channels so the user can mute/tune
  each independently: **"Nové zprávy"** (`messages`) for new mail — an envelope (`ic_notification`)
  in **brand blue**; **"Upozornění"** (`alerts`) for sync-failed/re-auth warnings — an alert triangle
  (`ic_notification_alert`) in **amber** (`#D97706`). Monochrome icons tinted via `color`; the old
  combined `sync` channel is deleted on first run. On-brand + the warning reads as a warning at a glance.
- **FR-007 (lock-screen privacy)** Notifications are `AndroidVisibility.PRIVATE`: shown on a secure
  lock screen but with their content **concealed** by the OS until the phone is unlocked (validated
  live — a locked phone showed only "Obálka"; unlocked showed the box + count).
- **FR-008 (never throws)** The Notifier + the engine swallow all errors — a notification or sync
  failure must not crash the task or block the app (Principle II).

## Success Criteria

- **SC-001** A new-message notification fires for genuinely new mail, not on first add (unit-tested).
- **SC-002** A box transitioning into reauth notifies exactly once; an already-reauth box is skipped
  (unit-tested).
- **SC-003** The styled notification renders (brand icon + color) and conceals its content on a secure
  locked phone, revealing it on unlock (validated live).

## Architecture

`runBackgroundSync` (`features/messages/state/backgroundSync.ts`) ← injected `AccountsController` +
`MessagesController` slices + a `Notifier`. `Notifier` interface (`services/notifications/`) with an
in-memory fake (tests) + `NotifeeNotifier` (device). Scheduling + headless wiring in `app/sync/
backgroundFetch.ts` (foreground `configure` + `backgroundSyncHeadlessTask` in `index.js`).
`classifyFailure` moved out of `AppShell` into the controller so the headless task can reuse it.

## Notes / Deferred

- **Cadence is the OS's call** — `minimumFetchInterval` is a floor; the OS batches background work. No
  true push (ISDS has none). The cross-client read-state reconciliation (002 deferred) folds in here.
- **Deep-link from a notification** to the box/message — future (currently taps open the app).
- **Retry/backoff** — the OS reschedules failed fetches; explicit backoff is a future refinement.
- **iOS** — BGTaskScheduler needs Info.plist + AppDelegate config (not done; no Mac to validate).
- **Notification icon** — `ic_notification` is a hand-drawn envelope vector; a designer pass could
  refine it.
- ~~**BACKLOG — re-enable notifications from Settings.** Today the priming dialog (`NotificationPrime`,
  "Zůstaňte v obraze") shows only while `!notifPrimed`; tapping **"Teď ne"** sets `notifPrimed = true`
  permanently (`AppShell.tsx` gate + `useSettings`), so a user who declined can **never** get the
  prompt — or notifications — back. Add a **Settings → Notifications** entry (feature 007, lives in
  `AppDrawer.tsx`) that, when notifications are **not** actually enabled, lets the user re-trigger the
  flow: re-show `NotificationPrime` → `requestNotificationPermission()`. Gate on the **real OS
  permission state** (`notifeeNotifier`/`notifee.getNotificationSettings`), not just `notifPrimed`,
  since the user may have toggled it off in system settings later; if the OS has hard-denied it, deep-link
  to the system notification settings instead of re-asking. (Reported 2026-06-16.)~~
  *Moot: 014 deleted `NotificationPrime` and stopped reading `notifPrimed` (T014, T015), and 011 had
  already retired the drawer; since 010 the app asks for notification permission when the user sets a
  first reminder.*
