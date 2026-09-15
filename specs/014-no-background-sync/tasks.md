# Tasks: No background sync

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

> **Retrospective.** These tasks were reconstructed from the two commits after the fact; they were not
> written before the work and not worked through in this order. They are recorded so the change set is
> reviewable at task granularity like every other feature, and marked `[x]` because the work shipped on
> 2026-08-14. Nothing here is outstanding.

## Phase 1 — Received side (014, `081f9fd` → `e1d9ad6`)

- [x] **T001** Remove the received pass from `runBackgroundSync`; narrow `BackgroundSyncDeps.messages`
      to `getCachedMessages | listSent` so the delivering call is not reachable from the type.
- [x] **T002** Move re-auth detection onto the sent pass — it hung off the received pass and would have
      been lost with it, leaving a box to stop syncing with nothing said. (FR-009)
- [x] **T003** Delete `SyncReceivedScreen.tsx`, its `RootStackParamList` entry, route and navigation
      call sites. (FR-003)
- [x] **T004** Remove `syncReceived` from `SettingsProvider`; leave the stored row unread. (FR-008)
- [x] **T005** Remove the `newMessages` notification channel, `notifyNewMessages`, and the Android
      `messages` channel — plus a runtime `deleteChannel('messages')` so upgraded installs keep no
      orphan switch. (FR-007, US3-2)
- [x] **T006** Rehome the cadence picker onto the surviving background job rather than losing it with
      the screen it lived on.
- [x] **T007** Correct the notification primer, which promised new-message alerts the app could no
      longer send. (FR-007)
- [x] **T008** Add the FAQ entry `noBackgroundFetch` (cs + en) explaining the received side. (FR-006)
- [x] **T009** Add the settings line stating that new mail is not fetched in the background. (FR-005)
      *(No longer present: Settings has no sync section; see FR-005.)*
- [x] **T010** Fix `MessageList`'s `refresh` depending on the account *object*: `reloadAccounts()` runs
      on every screen focus and every box-switcher open, so identity churn re-ran the open-folder
      effect and fired an extra `listReceived` — a legal delivery from a tap that only opened a
      switcher. Read the account from a ref at call time. (FR-001, US1-2)
- [x] **T011** Add `__tests__/messages/messageListDelivery.test.tsx`, pinning that an equal-but-new
      account object does not re-sync while a real box change does. Verified to fail against the
      pre-T010 code.

## Phase 2 — Sent side and the rest (014b, `c33661e` → `253c7c6`)

- [x] **T012** Delete `src/app/sync/backgroundFetch.ts` — scheduler, headless task, `applyBackgroundSync`
      — and its registration in `index.js`. (FR-002)
- [x] **T013** Delete `src/features/messages/state/backgroundSync.ts`. (FR-001)
- [x] **T014** Delete the notification stack: `notifications.ts`, `notifeeNotifier.ts`,
      `NotificationPrime.tsx`, `deepLinkRouter.ts`, `deepLink.ts`, `NotificationsScreen.tsx`, and the
      `Notifications` route. Nothing could fire a notification once the sync was gone. (FR-007)
- [x] **T015** Remove `syncSent`, `syncCadence`, `notifPrimed`, `notifChannels` and `syncCadenceMinutes`
      from `SettingsProvider`, and the sync + notifications sections from `SettingsScreen`. (FR-003)
- [x] **T016** Unwire `AppShell` — the deep-link resolver, the foreground/cold-start notification
      handlers, and the primer mount.
- [x] **T017** Strip 78 orphaned `notif.*` / `sync.*` / `settings.sync.*` keys from both locales.
- [x] **T018** Rewrite the FAQ entry to answer **both** halves in one place: incoming mail (fetching it
      *is* delivery) and sent-message outcomes (still an automatic sign-in), closing on what the user
      does get. (FR-006)
- [x] **T019** `npm uninstall @notifee/react-native react-native-background-fetch`; delete their jest
      mocks. (FR-004, D1)
- [x] **T020** Rescan the release bundle and regenerate attributions — 174 → 172 components. (SC-004)
- [x] **T021** Rebuild the APK and verify with `aapt2 dump permissions` that `POST_NOTIFICATIONS`,
      `RECEIVE_BOOT_COMPLETED` are gone. (SC-002) *(This check silently failed at the time — the
      glob matched three build-tools versions and aapt2 exited 255 into `2>/dev/null`. Re-run
      correctly on 2026-08-17: both are indeed absent; `WAKE_LOCK` is blob-util's and remains.)*
- [x] **T022** Walk the emulator: welcome, FAQ entry rendering in full, settings without the removed
      sections. (VII)

## Phase 3 — Record (2026-08-16)

- [x] **T023** Mark 013's `port-notes.md` decision RESOLVED — it still read "nothing was changed in the
      code for this yet", written before either pass.
- [x] **T024** Amend the constitution to **2.0.0**: Technical Constraints still specified "New-message
      alerts via scheduled background polling". (Also corrected an unrelated Mobile Key claim found by
      the same audit.)
- [x] **T025** Write this spec, plan and task list. (`specs/README.md` row updated.)

## Not done, deliberately

- **No migration deleting the abandoned settings rows.** See plan D2.
- **No replacement notification mechanism.** `RegisterForNotifications` needs certificate-based access
  we do not have; reminders (010) are a separate feature and remain permissible.
