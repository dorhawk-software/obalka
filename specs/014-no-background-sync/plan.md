# Implementation Plan: No background sync

**Spec**: [spec.md](./spec.md) · **Status**: implemented 2026-08-14 · **Retrospective** — records what
was done and why, not a plan that was followed.

## Constitution Check

| Principle | Effect |
|---|---|
| I — Never Block the UI Thread | Unaffected. Removing work cannot add main-thread work. |
| II — Crash-Resilient by Contract | Preserved. Re-auth detection was rehomed before the pass that owned it was deleted, so a box still reports an invalid session rather than failing silently. |
| III — Privacy First, On-Device Only | **Strengthened.** Two OS permissions dropped (`POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`; `WAKE_LOCK` is blob-util's and stayed); two native modules removed; no ISDS call can happen while the app is closed. *(010 later re-added notifee and both permissions for user-set reminders, which make no network call.)* |
| IV — The Local Archive | Unaffected here. The adjacent fix `ef338ff` (list renders the archive, not the server response) matters more to it. |
| V — Modern, Accessible, Consistent | Settings loses its sync and notifications sections; the absence is explained in the FAQ. |
| VI — Honest Scope | **This principle drove the feature.** See spec §"What actually forced the decision". Also produced constitution 2.0.0 afterwards, when the same audit found the constitution itself claiming background polling. |
| VII — Verify Against the Test Environment | Emulator + a live czebox box and the author's production box. iOS unverified at merge time; confirmed by the user 2026-08-16. |

No violations. The feature removes capability, so the usual complexity justification does not apply.

## Two passes, deliberately

**014 — received side** (`081f9fd`, merged `e1d9ad6`). 17 files, +470/−947.

Removed `syncReceived`, 013's `SyncReceivedScreen` consent screen and its route, and the received pass
in `runBackgroundSync` — narrowing `BackgroundSyncDeps.messages` to `getCachedMessages | listSent` so
the type no longer even offers `listReceived`. The "new messages" notification channel went with it,
along with `notifyNewMessages` and the Android `messages` channel (deleted at runtime so an upgraded
install keeps no orphan switch).

Two things were moved rather than dropped: **re-auth detection** onto the sent pass, because it had hung
off the received pass and its loss would have meant a box quietly ceasing to sync; and the **cadence
picker** onto the one remaining background job.

**014b — everything else** (`c33661e`, merged `253c7c6`). 26 files, +36/−2413.

Once the FAQ shipped quoting §17, keeping the sent-side poll made the app's own help text false. This
pass removed the scheduler, the headless task, the sync engine, the notifier, the channels, the
permission primer, the notification deep-link router, the notifications settings screen, and the sync
and cadence settings. Nothing could fire a notification once the sync was gone, so the whole
notification surface went with it rather than remaining as controls that do nothing.

Deleted outright: `backgroundFetch.ts`, `backgroundSync.ts`, `notifications.ts`, `notifeeNotifier.ts`,
`NotificationPrime.tsx`, `deepLinkRouter.ts`, `deepLink.ts`, `NotificationsScreen.tsx`, and four test
files. (010 later re-created `notifications.ts`, `notifeeNotifier.ts`, `deepLink.ts` and
`deepLinkRouter.ts`, for reminders only.)

### Why two passes and not one

The received side had an independent, stronger justification — it legally delivers mail — and was
decided first. The sent side turned on a rule the user had explicitly scoped *out* of the first request
("lets remove the received messages automatic fetch"). Bundling them would have taken a decision the
user had not made. It was put to them separately, with the trade-off stated (removing it costs the
notification feature entirely), and they chose full removal.

## Technical decisions

**D1 — Dependencies uninstalled, not left parked.** `@notifee/react-native` and
`react-native-background-fetch` were removed from `package.json`. Keeping them installed but unimported
would have left `POST_NOTIFICATIONS` / `RECEIVE_BOOT_COMPLETED` declared in the merged manifest for
capabilities the app no longer has (`WAKE_LOCK` is `react-native-blob-util`'s and stays — see the
correction in spec.md) — an over-declaration that Principle III should not
tolerate — and would have left native code in the binary that the bundle-derived attribution list
cannot see. Verified after rebuild with `aapt2 dump permissions`.

**D2 — Settings rows are abandoned, not migrated away.** `syncInterval`, `syncReceived`, `syncSent`,
`syncCadence`, `notifPrimed` and `notifChannels` stay in `app_settings` and are never read. A migration
that deletes user data can go wrong; an unread row cannot.

**D3 — The absence is explained in the FAQ** (`noBackgroundFetch`, both locales), quoting §17 and
§17(3); Constitution 2.0.0 records the constraint. *(The interim Settings and channel lines from the
first pass did not survive 014b.)*

**D4 — `ChannelSwitches` parsing moved to the notification boundary before the boundary was deleted.**
An intermediate step in 014 gave the stored `"n,r,a"` triple a shared parser with a tolerant read for
the older three-field format. 014b deleted it along with everything else. Recorded because the
intermediate state is visible in the history and looks like churn otherwise.

## Adjacent fixes made in the same session

Not part of this feature, but interleaved with it and easy to mistake for it:

- **`1009abe`** — the iOS lock-screen privacy claim was false (no iOS branch existed at all). Fixed by
  adding a notification category, then made moot two commits later when notifications were removed.
- **`ef338ff`** — the inbox rendered the live server response instead of the local archive, so a message
  ISDS had purged vanished from the list. Surfaced *by* this feature's testing: it was the residual
  "flash" after the box-switcher bug was fixed.
- **`949c612`** — constitution 2.0.0, correcting the background-polling constraint and, separately, a
  Mobile Key claim found by the same audit.

## Verification

- Gate: tsc 0, eslint 0 errors, **344 tests** (down from 372 — the deleted suites covered deleted code).
- Android: rebuilt and reinstalled on the emulator; walked welcome, FAQ, settings.
- Permissions: **this check silently failed and its failure was reported as a pass** — see the
  correction at the end of `spec.md`. Re-verified 2026-08-17: `POST_NOTIFICATIONS` and
  `RECEIVE_BOOT_COMPLETED` are genuinely absent; `WAKE_LOCK` is present and always was.
- Attributions: rescanned from a fresh release bundle, **174 → 172** components.
- iOS: unverified at merge; the user confirmed a device test on 2026-08-16 with no remarks.

## Known gaps

- The user can no longer learn of new post from this app at all. That is the intended outcome, not a
  regression, and the FAQ says so — but it is the feature's real cost and should not be softened.
- ~~`specs/013-…/` still owes `spec.md`/`plan.md`/`tasks.md`.~~ Written 2026-08-16, also retrospectively;
  013's spec records which of its parts this feature removed.
