# Tasks: The box's password - told in time, changed in the app

**Feature**: `030-password-change` | **Spec**: [spec.md](./spec.md)

No plan.md: one transport call, one screen, one notification kind, all on existing patterns.

## Phase 1: What ISDS does

- [x] T001 Capture an expired password's refusal and a live `GetPasswordInfo` answer on the test
  environment (2026-11-11); record them in `docs/accounts.md` and the code comments; the 200 answer is a
  fixture in `__tests__/isds/soap.test.ts`.

## Phase 2: The copy (US1)

- [x] T002 `login.error.invalidCredentials`, `reauth.intro.credentials`, `box.reauth.credentials`,
  `messages.reauth.credentials` say "wrong or expired"; the login error screen and the re-auth screen
  link to the portal for every refused password box.

## Phase 3: The change (US2)

- [x] T003 `passwordRules.ts` and its tests.
- [x] T004 `ChangeISDSPassword` request builder; `IsdsHttpTransport.changePassword`; transport tests over
  the fake HTTP client (changed, 401, refused with ISDS's message, the expiry read with the NEW password).
- [x] T005 `ChangePasswordForm` and its tests (rules ticked, blocked reasons, wrong current password,
  ISDS's refusal, success with the date).
- [x] T006 The `changePassword` route in `AppShell`; entry from the expiry strip and the switcher menu.

## Phase 4: The nudge (US3)

- [x] T007 `passwordNudge.ts` (pure timers) and `Notifier.syncPasswordNudges`; Notifee implementation on a
  channel of its own; tests.
- [x] T008 The shell syncs the nudges whenever it reads the accounts, asks for permission once, and routes
  a tapped nudge to the change screen or the inbox.
- [x] T009 010 FR-010 and the `notifications.ts` header amended (FR-007).

## Phase 5: Closing

- [x] T010 Changelog (both languages), `docs/accounts.md`, `specs/README.md`.
- [ ] T011 Walk it on a device against the test box: change the password in the app, see the new date,
  see the notifications scheduled (a date moved close to now on a debug build).
