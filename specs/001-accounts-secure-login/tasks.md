---
description: "Task list for feature 001 — Accounts & Secure Login"
---

# Tasks: Accounts & Secure Login

**Input**: Design documents from `/specs/001-accounts-secure-login/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: INCLUDED — the constitution (Principle II) and SC-002 require the login state machine and
the never-throwing `AuthService` to have full unit coverage of every typed outcome. Test tasks are
written before the implementation they cover.

**Organization**: Grouped by user story. US1 + US2 = P1 (MVP). US3 + US4 = P2. US5 = P3.
All ISDS testing targets the **test environment** (`ws1.datovka-test.gov.cz`, formerly `ws1.czebox.cz`).

**Progress (2026-06-12)**: Device-independent testable core landed and green (36 Jest tests, `tsc`
+ ESLint clean): domain types, login state machine (total/never-throws), the never-throwing
`AuthService` (password + OTP orchestration), an in-memory `AccountsStore`, and Czech-first error
copy — T006, T014–T016, T019–T020, T029. Plus **schema-driven wire models**: the official ISDS v20
WSDL/XSD are vendored and the data models are generated from them (T006a) — the transport will map
these to the lean app models. The **real ISDS transport** now exists and is fixture-tested (56 Jest
tests): endpoints, SOAP build/parse, and the **password** path (HTTP Basic → `/DS/dz` →
`GetOwnerInfoFromLogin` → `OwnerInfo`) are production-faithful; the **OTP** (`as/processLogin`) path
has correct URLs but PROVISIONAL response handling marked `TODO(czebox)` — T009–T011, T017. The whole
US1 **logic** layer is now complete and tested (67 Jest tests, tsc + ESLint clean): `GetPasswordInfo`
enriches `OwnerInfo` with password expiry (T018), a secret-redacting logger (T012), a `SecureStore`
interface + in-memory fake, and the `AccountsController` that persists/restores/removes accounts and
keeps the metadata row + enclave secret consistent (T022). Only the thin `FetchHttpClient` is
un-unit-tested (the `fetch` boundary). **Both the password AND the TOTP/SMS OTP paths are now
validated end-to-end against a real czebox test box** — password via Basic on `/DS/DsManage`; OTP via
the portal `as/processLogin` flow (one-time code appended to the password, `DummyOperation` body,
302 + `Set-Cookie`, then SOAP under `{portal}/apps/DS/DsManage`) — T030/T031/T033 done (details in
research.md). **Pending (device-bound)**: real `op-sqlite` + Keychain/biometric adapters (T007–T008),
the screens (T021/T023/US2, incl. OtpStep T032), and on-device cookie handling (`@react-native-cookies`).


## Status audit, 2026-09-08

This file had 25 unticked tasks while the feature shipped a year of work on top of it, which is the
failure `specs/README.md` warns about in its own header: a status that contradicts the code. Every one
was checked against `src/` and annotated below — `[x]` where the work exists, `[~]` where a later
feature replaced the approach and the task will never be done as written, and `[ ]` where the gap is
real.

**Genuinely still open**: T046 ~~alone~~ — the quickstart script has never been walked end to end. T041,
T042, T043, T044 and T047 were all closed on 2026-09-08.

*Amended 2026-09-14:* T046 is not alone. Also open: **forced-password-change detection** (T041 and T038,
now `[~]`: no transport path returns `passwordChangeRequired`, so it surfaces as `serverFault`); **the
box password unreadable while locked** (T028, reopened as `[ ]`: not built as written — the requirement
is not met); and **resetting the lock when the last box is removed** (T037, now `[~]`). Counts at that
point: 40 of 48 tasks done, 6 partial or superseded (T005, T027, T035, T037, T038, T041), 2 open (T028, T046).

*Closed 2026-09-14 (later the same day):* T037, T038 and T041 — each task below says how, with the
tests. The forced password change is an inference from the stored expiry date, not an ISDS status
code; its limits are in the FR-009 note in `spec.md`. Counts: 43 of 48 tasks done, 3 partial or
superseded (T005, T027, T035), 2 open (T028, T046).

*Closed 2026-09-15:* T028 - box passwords and session cookies are sealed under one vault key, which
with the app lock on sits behind the biometric gate and is held in memory only while the app is
unlocked; see the task below. Counts: 44 of 48 tasks done, 3 partial or superseded (T005, T027,
T035), 1 open (T046).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US5 (user story phases only)

## Path Conventions

Mobile single codebase per plan.md: app code under `src/`, tests under `__tests__/`, native projects
in `android/`/`ios/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and dependencies

- [x] T001 Install runtime deps and link native modules: `@react-navigation/native` + stack, `react-native-keychain`, `fast-xml-parser`, `op-sqlite`, `@react-native-cookies/cookies`, `react-native-safe-area-context` (already present) in `package.json` **[2026-09-08 audit]** Done — see package.json; the tree has diverged since (op-sqlite, notifee, blob-util…).
- [x] T002 [P] Configure TypeScript strict mode and path aliases (`@/*` → `src/*`) in `tsconfig.json`; align ESLint/Prettier from scaffold **[2026-09-08 audit]** Done in substance: `strict` comes from `@react-native/typescript-config`. The `@/*` alias was never adopted — the codebase uses relative imports throughout, consistently, so the alias would now be a second way to say the same thing.
- [x] T003 [P] Create the feature-first folder structure under `src/` (`app/`, `features/accounts/`, `services/isds/`, `services/secureStore/`, `services/db/`, `i18n/`, `theme/`) per plan.md **[2026-09-08 audit]** Done — that structure is what `src/` looks like today.
- [x] T004 [P] Scaffold i18n with `cs` (primary) + `en` resource files in `src/i18n/` and theme tokens (light/dark) in `src/theme/` **[2026-09-08 audit]** Done — `src/i18n/strings.ts` (cs + en, both complete) and `src/theme/theme.ts`.
- [~] T005 Add a build/config host switch (`czebox` default, `production` release-only) in `src/services/isds/config.ts` **[2026-09-08 audit]** **Superseded.** There is no build-wide host switch and there should not be: 001 assumed one environment per BUILD, and czebox work established that the environment is per BOX (`account.host`, chosen on the add-box form). Endpoints live in `src/services/isds/endpoints.ts`. Nothing to do.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T006 Define shared domain types (`DataBoxAccount`, `AuthMethod`, `LoginOutcome`, `LoginErrorCode`, `AuthSession`) in `src/services/isds/types.ts` — **as built:** no `AuthSession` type; a box's session was `DataBoxAccount.sessionCookie` (018) until 2026-09-15, and is now a sealed Keychain item read at call time (T028); the field is gone.
- [x] T006a Vendor the official ISDS v20 WSDL/XSD in `src/services/isds/schema/v20/` and generate wire models from XSD via `scripts/codegen-isds.mjs` (`npm run codegen:isds`) → `src/services/isds/generated/isdsTypes.ts` (313 types). The transport maps these to the lean app models.
- [x] T007 [P] Implement encrypted SQLite via `op-sqlite` (SQLCipher) with migrations and `accounts` + `app_settings` tables, exposing `AccountsStore` in `src/services/db/sqliteAccountsStore.ts` (DB key via CSPRNG in Keychain; live-verified at-rest encryption + restart persistence)
- [x] T008 [P] Implement `SecureStore` over `react-native-keychain` (one entry per box) in `src/services/secureStore/keychainSecureStore.ts` — no biometric access control on the box secret (see T028). *As built since 2026-09-15 (T028):* `keychainSecureStore.ts` is `KeychainSecretItems`, the raw items; the `SecureStore` the app uses is `VaultSecureStore`, which seals each box's password and session under the vault key.
- [x] T009 [P] Implement ISDS endpoints/access-point map (hosts + `/DS/dz`, `as/processLogin` paths) in `src/services/isds/endpoints.ts`
- [x] T010 Implement SOAP 1.1 envelope build + response parse (`fast-xml-parser`) in `src/services/isds/soap.ts`
- [x] T011 Implement ISDS transport over native `fetch` with cookie handling, timeouts, and `AbortSignal` in `src/services/isds/transport.ts` — **as built:** `httpClient.ts` (`FetchHttpClient`: native fetch, timeouts, AbortSignal, `useJar`/`cookie`) and `isdsTransport.ts` (`IsdsHttpTransport`); `transport.ts` holds the interface and result types.
- [x] T012 [P] Implement structured logging that redacts secrets (never log passwords/cookies) in `src/services/logging/logger.ts`
- [x] T013 App shell + navigation + lock-gate placeholder in `src/app/App.tsx` and `src/app/navigation/` **[2026-09-08 audit]** Done — `src/app/AppShell.tsx`, `src/app/AppNavigator.tsx`, `src/app/lock/LockGate.tsx`.

**Checkpoint**: Foundation ready — user stories can begin.

---

## Phase 3: User Story 1 - Sign in with username + password (Priority: P1) 🎯 MVP

**Goal**: Add a password box, authenticate against `/DS/dz`, persist securely, stay signed in.

**Independent Test**: Add a czebox password box → reach signed-in home; relaunch → no re-entry;
wrong password → recoverable error, no crash.

### Tests for User Story 1 ⚠️ (write first, must fail before implementation)

- [x] T014 [P] [US1] Unit tests for the login state machine — all transitions + totality (never throws) in `__tests__/accounts/loginMachine.test.ts`
- [x] T015 [P] [US1] Unit tests asserting `AuthService.beginLogin` (password) NEVER rejects and returns a typed `LoginOutcome` for every branch in `__tests__/accounts/authService.password.test.ts`
- [x] T016 [P] [US1] Unit tests for `AccountsStore` add/list/remove + duplicate `boxId` rejection in `__tests__/db/accountsStore.test.ts`

### Implementation for User Story 1

- [x] T017 [US1] Implement ISDS password auth (HTTP Basic on `/DS/dz`) + session cookie capture in `src/services/isds/auth.ts` — **as built:** `src/services/isds/isdsTransport.ts`, with HTTP Basic on `/DS/DsManage` rather than `/DS/dz` (research.md)
- [x] T018 [US1] Implement `GetOwnerInfoFromLogin` + `GetPasswordInfo` operations (verify login, fetch box id/label/expiry) in `src/services/isds/operations.ts` — **as built:** builders and parsers in `src/services/isds/soap.ts`, called from `isdsTransport.ts`
- [x] T019 [US1] Implement the login state machine (states/transitions from data-model.md) in `src/features/accounts/state/loginMachine.ts`
- [x] T020 [US1] Implement the never-throwing `AuthService` (`beginLogin` + `submitOtp`/`resendSms`/`reauthenticate`) per contract in `src/features/accounts/state/authService.ts`
- [x] T021 [US1] Build `AddBox` + `PasswordStep` screens with cancellable, non-blocking progress in `src/features/accounts/screens/` — **as built:** `AddBoxForm.tsx` + `LoginFlow.tsx`
- [x] T022 [US1] On success, persist account via `AccountsStore` and secret via `SecureStore`; restore session from stored secret on relaunch in `src/features/accounts/state/accountsController.ts`
- [x] T023 [US1] Localized (cs/en) error + retry UI for all password outcomes in `src/features/accounts/components/LoginError.tsx` — **as built:** the error and retry states live in `LoginFlow.tsx`

**Checkpoint**: US1 fully functional and independently testable (the MVP login).

---

## Phase 4: User Story 2 - Biometric app-lock (Priority: P1)

**Goal**: Gate all content behind biometrics with a PIN fallback; secrets only readable after unlock.

**Independent Test**: Background/resume → biometric prompt; force biometric failure → PIN fallback;
no content shown before unlock.

### Tests for User Story 2 ⚠️

- [x] T024 [P] [US2] Unit tests for `AppLock` (biometric success; failure → PIN fallback; locked state hides content) in `__tests__/app/appLock.test.ts` **[2026-09-08 audit]** Done — `__tests__/app/LockGate.test.tsx`.

### Implementation for User Story 2

- [x] T025 [US2] Implement `AppLock` (biometric via keychain access control + app-PIN fallback) in `src/app/lock/appLock.ts` **[2026-09-08 audit]** Done — `src/services/appLock/keychainAppLock.ts`. *Since 2026-09-15 (T028):* that file is gone; the `AppLock` is the `Vault` (`src/services/secureStore/vault.ts`), whose unlock is the read of the vault key.
- [x] T026 [US2] Enforce the lock gate on cold launch and resume (with `lockGraceSeconds`); render nothing sensitive until unlocked in `src/app/lock/LockGate.tsx` **[2026-09-08 audit]** Done — `src/app/lock/LockGate.tsx`. *Amended 2026-09-14:* done without a grace period. LockGate re-locks immediately on 'background'; `lockGraceSeconds` was not built.
- [~] T027 [US2] PIN-fallback setup flow when no biometric hardware/enrollment in `src/app/lock/PinSetup.tsx` **[2026-09-08 audit]** **Superseded, and deliberately.** No app-specific PIN exists. The Keychain entry uses `BIOMETRY_ANY_OR_DEVICE_PASSCODE`, so the fallback is the DEVICE passcode — enforced by the OS, with no PIN for this app to store, verify or get wrong. The Settings copy says exactly that ("otiskem prstu, obličejem nebo kódem zařízení"). Nothing to do.
- [x] T028 [US2] Route `SecureStore.getSecret` through the unlock so passwords are unreadable while locked in `src/services/secureStore/secureStore.ts` **[2026-09-08 audit]** ~~Done — `KeychainSecureStore` stores under an access-control-gated entry, so the OS gates every read.~~ *Amended 2026-09-14:* **Not built as written.** The box password is stored `WHEN_UNLOCKED_THIS_DEVICE_ONLY` with no access control, so it is readable whenever the device is unlocked. The app lock (LockGate + KeychainAppLock) gates the UI, not the Keychain read. Gating each read would prompt on every password-box WS call. The requirement this task served — passwords unreadable while locked — is NOT MET. *Closed 2026-09-15:* **built as the vault key** (plan "The vault key", research R6b); the lock stays opt-in (owner decision). One random 256-bit key (`crypto.getRandomValues`) seals each box's password and session cookie with XChaCha20-Poly1305 - versioned text, a key id, the kind and the box as associated data (`seal.ts`) - each in its own Keychain item, `cz.obalka.box.<boxId>` and `cz.obalka.session.<boxId>` (`vaultSecureStore.ts`). With the lock off the key is in an ungated `WHEN_UNLOCKED_THIS_DEVICE_ONLY` item; with it on the same key is behind `BIOMETRY_ANY_OR_DEVICE_PASSCODE`, the lock screen's unlock is the read of it (one prompt), and going to the background drops it (`vault.ts`, `keychainVaultKeyStorage.ts`, `LockGate.tsx`). Toggling moves the key only. Every controller reads the password and session at call time through `credentialsFor`, which waits while locked, so the launch refresh and every other ISDS call - the VoDZ send and the signed-original download included - wait behind the lock screen; a read that cannot happen right now becomes `messages.error.credentials` / `send.error.credentials` and is never re-auth. A new key is made only when none exists or the stored one is proven permanently unreadable; after a real loss every old seal reads as `lost`, each box re-authenticates, and `VaultLostNotice` says why once. The cookie left `DataBoxAccount` and the accounts row: a launch migration (started from `App.tsx`) seals plain passwords and the `sessionCookie` column, reads each seal back before the plain copy goes, resumes after a crash, and empties the column, which nothing writes again. Removing a box deletes both items; removing the last box deletes the key in both placements and switches the lock off (T037). Tests: `__tests__/security/vaultSeal.test.ts` (round trip, tampering, lost key, moved seals); `vaultKey.test.ts` (one prompt to enable and to unlock, none in use, a cancel never makes a key, the toggle moves the key, loss, recovery, 'keeps no key from an unlock whose prompt was still out when the app went to the background'); `vaultSecureStore.test.ts` (sealed items, locked reads wait, an abandoned read is `unavailable`, the toggle re-encrypts nothing, loss, the migration including crashes between steps, 'keeps the newer password when a save was killed before it removed an old plain copy', 'still uses a table cookie when the launch migration could not run at all', 'answers a read abandoned while the migration waits for the unlock as unavailable'); `vaultCallSites.test.ts` (the launch refresh, credit, mark-read, search, ordinary and VoDZ send, message and signed-original downloads all wait for the unlock with no extra prompt; an abandoned or failed read is not re-auth; a lost key sends each box to re-auth over the real transport; removal deletes both items and the last takes the key); `__tests__/app/LockGate.test.tsx`; `__tests__/app/vaultLostNotice.test.tsx`; `keychainPrompts.test.ts`; `__tests__/db/sqliteAccountsStore.test.ts`; `noPlaintextSecrets.test.ts`; `__tests__/accounts/accountsController.test.ts`. **Not walked on a device:** switching the lock on and off, background → relock → refresh, and a screen lock removed or biometrics changed - what happens to the gated item then is the platform's, which is why the dialog says "for example after the screen lock was turned off". *Review 2026-09-15:* three problems found and fixed. (1) The lock gate dropped the key on every 'background', and the vault voids an unlock that sees a lock after it started; on Android 10 and older the passcode screen behind "Use PIN" is an activity of its own and React Native reports the app as backgrounded while it is up, so a passcode unlock could never succeed there and the lock screen asked again for ever. `LockGate` now holds its lock while an unlock is out, and an unlock that finished in the background keeps the key only if the app is back in the foreground within 1.5 s (`UNLOCK_RETURN_MS`); otherwise the key is dropped and the return asks again. (2) A background between a successful unlock and the reveal dropped the key, but the pending reveal still opened the app: the return showed it with no prompt, and every refresh waited for an unlock nothing asked for. The lock screen now cancels the reveal. (3) A lock that would not switch off let the Settings switch spring back without a word; a dialog now says it is still on (`lock.disableFailed.*`). Also: 'answers a read abandoned while locked as unavailable - never absent' aborted before its read reached the key wait, and passed with that branch returning `absent`; it now waits first. Tests: `__tests__/app/LockGate.test.tsx` ('unlocks with the phone passcode even though its screen sends the app to the background', in both orders; 'keeps no key from a prompt that answered after the user really left, and asks again on return'; 'stays locked when the app goes to the background between the unlock and the reveal'; and a guard that the window applies to 'background' only, so an unlock landing while iOS shows its own sheet ('inactive') opens at once: 'opens at once when the unlock lands while iOS still shows its own sheet, with no second prompt'), `__tests__/app/lockToggle.test.tsx` ('says the lock stayed on when the Keychain would not take the key back'). Each failed against the code before its fix. The other new vault tests were checked by reverting the behaviour each names, one at a time (16 targeted reversions); all failed, after the fix above to the one that did not. **Also not walked:** "Use PIN" on an Android 10 or older phone. *Edge cases, 2026-09-15:* four gaps closed. (1) With the lock on, a gated read that kept failing on a Keychain error not recognised as permanent loss left the lock screen on "try again" for ever. The vault now counts those failures - never a cancel or a failed or locked-out prompt (`isPromptOutcome`: Android BiometricPrompt codes 3, 5, 7, 9, 10 and 13, "Not assigned current activity", and iOS errSecUserCanceled, errSecAuthFailed, errSecInteractionNotAllowed) - and from the third in a row answers `keyUnreadable`. The lock screen says so (`lock.keyUnreadable`) and puts "Nastavit zámek znovu" in the hint's slot, over the invisible hint so nothing moves; it opens a confirmation (`lock.reset.*`), which closes in the background, and only its yes calls `Vault.resetKey`. That refuses unless the vault really got there, keeps the old item when no screen lock could hold a new one, and otherwise deletes the gated item and takes the lost-key path: a new key behind the gate read back in one prompt, or with the lock off a new ungated key. (2) With the lock off, Android losing the Keystore key under the ungated item while the item survives made every read fail - react-native-keychain generates a new key under the same alias (`CipherStorageBase.extractGeneratedKey`) and reports "Decryption failed: Authentication tag verification failed" (read from the library's source) - and the vault answered `unavailable` for ever. That read is now a proven loss, the same path as a gated key the phone invalidated. (3) RN's native cookie jar kept the last login's session after capture. Every request path was read through: each WS `http.send` in `isdsTransport.ts` passes `useJar: false`, the two VoDZ downloads `omitCookies`, `FetchHttpClient` has no other user, and only login requests ride the jar. `passwordLogin`, `otpSubmit` and `mepConfirm` now empty the jar once their last request is over, however it ended (018 T007). (4) `VaultLostNotice`, an RN Modal, could draw over the lock cover right after an unlock; `LockGate` now provides whether its cover is up, `useAppCovered` adds the background, and the notice waits, hidden rather than dismissed. Tests: `vaultKey.test.ts` ('treats an ungated key whose Keystore key Android lost as lost - a new key, not "unavailable" for ever', 'still makes no key for a plain read that fails for any other reason, however often', the whole of 'a key behind the gate that keeps failing to read', 'what counts as the prompt’s own answer rather than the Keychain failing'); `vaultSecureStore.test.ts` ('reads as lost, not unavailable for ever, when Android lost the Keystore key under the ungated key', 'reads every old secret as lost once the lock was set up again over a key that kept failing'); `__tests__/app/LockGate.test.tsx` ('explains a key that keeps failing to read and offers to set the lock up again - acting only on a yes', 'closes the confirmation when the app goes to the background, and keeps the key', 'never offers the reset for a prompt that keeps being cancelled'); `__tests__/app/vaultLostNotice.test.tsx` ('waits for the lock screen to go - never drawn over it while an unlock is still revealing', 'goes while the app is in the background, and is back - still unread - once the app is unlocked again', 'with the lock off, goes while the app is in the background and is back on return', 'is not opened for a loss found while the app is in the background'); `__tests__/isds/sessionIsolation.test.ts` (018 T007). The two plain-key tests and the seven new jar tests fail on the code before their change. The rest were checked by reverting one behaviour at a time - cancels counted, no counting, the reset's refusal, the count kept past a good read, the reset's screen-lock check, the dialog left open in the background, the notice ignoring the cover, the cover never provided, and the previous vault and lock screen whole - and each reversion failed at least one of them. **Not walked on a device:** a Keychain that keeps failing (not reproducible on demand), the reset's prompt on either platform, the link at large font sizes, the notice after a real unlock and a return from the background, and the jar empty after a real sign-in. *Review of the edge cases, 2026-09-15:* three problems found and fixed. (1) With the lock on, every Android BiometricPrompt error other than the person's own answer counted towards `keyUnreadable` - the sensor unavailable (code 1), a vendor error (8), nothing enrolled (11). None of them is about the key, and the new key a reset makes is read through the same prompt, which Android asks on the gated write already: the reset deleted the owner's key, failed where the old read had, and left every box to sign in again with no further offer. With the lock on those errors are now `failed` (`isBiometricPromptError`); with the lock off, where the reset takes an ungated key without a prompt, they still count. (2) iOS reports 'active' again after Control Center or a system sheet without the app having left, so the reset confirmation stayed open while the lock screen started an unlock of its own; that attempt was still out when the person answered, and `run` refuses a second one, so the yes closed the dialog and did nothing. The lock screen now starts no attempt while the confirmation is open. (3) The reset link had a button role and no accessibility label. Also corrected in docs/accounts.md and 018 (T007, FR-003, the edge case): a sign-in whose first step is refused or fails - a wrong password on the SMS request, a refused Mobile Key start - keeps its cookie in the jar like one abandoned between its steps; the docs said every login empties the jar once its last request is over. The transport was not changed for it, since another change is editing its responses. And research.md no longer says the VoDZ download rides the jar (018 T015 closed it). Tests: `vaultKey.test.ts` ('never offers a reset with the lock on for a prompt that itself keeps failing', for codes 1 and 8; 'with the lock off, still offers it for a prompt that itself keeps failing - that reset asks nothing'; 'what counts as the biometric prompt failing rather than the Keychain'); `__tests__/app/LockGate.test.tsx` ('starts no unlock under the open confirmation when the app reports active again, so its yes still counts', and the link's label in 'explains a key that keeps failing to read and offers to set the lock up again - acting only on a yes'). Each failed with its fix reverted. The first pass's evidence was re-run: the seven jar tests fail on the transport at 5e03e03, the four notice tests on the notice at 5e03e03, the two reset tests on the lock screen at 5e03e03, the two plain-key tests with that read rethrown, and the two cancel guards with cancels counted. **Not walked:** a biometric sensor that keeps failing with the lock on, and Control Center pulled down over the open confirmation. *Jar and box items, 2026-09-15:* three gaps closed and two comments corrected. (1) A sign-in that ended before the request that signs in - its SMS request or a resend refused, failed or timed out, a Mobile Key start refused, failed or timed out, a push declined or not delivered, the approval window run out, a status poll failed or timed out, or the sign-in cancelled or its screen left while it waited for a code or an approval - left its half-finished handshake's cookie in RN's native cookie jar, outside the vault and readable while the app is locked. `IsdsAuthService` now empties the jar at each of those ends (`IsdsHttpTransport.abandonLogin`), and a sign-in the person leaves at that moment (`LoginController.cancel`, and `dispose` from `useLoginController` when the screen goes by a system Back or an edge swipe) rather than when the request or wait it aborted next wakes, by which time another sign-in may have started; only a sign-in waiting for its code keeps the cookie (018 T007). (2) Removing a box no longer empties the jar (018 T010, FR-004): nothing of a box's stays there between sign-ins, and a removal queued behind a long one, or finished later, emptied the whole jar and broke a sign-in under way. (3) A box item (`cz.obalka.box.*`, `cz.obalka.session.*`) whose own Android Keystore key was lost failed every read with "Authentication tag verification failed", the words the vault key's loss is recognised by, and `VaultSecureStore` read it as `unavailable` for ever - a "try again" that never worked. It now reads as `lost` for that box only: the box asks to sign in again, no `VaultLostNotice` shows, the vault key, the other boxes’ items and the archive are untouched, nothing is deleted, and signing in again writes the item over; any other Keychain error stays `unavailable`. (4) `appLock.ts` (`needsRecovery`) and `LockGate.tsx` no longer say a restore carries the lock setting, which is device-local, and the jar comment at `forgetSecrets` went with the jar step. Tests: `__tests__/isds/unfinishedSignIn.test.ts`, `loginController.test.ts` ('a sign-in the person leaves'), `otpArrivesFirst.test.tsx` ('ends the sign-in when the code screen goes without its Cancel, as a system Back does') - all 21 fail on 7d41e20, and the cancel case also with the aborted-signal check taken out; `sessionIsolation.test.ts` ('lets a sign-in waiting for its SMS code finish when a box is removed meanwhile', which fails on 7d41e20 with the jar wired as removal wired it there); `vaultSecureStore.test.ts` ('reads a password item whose own Keystore key Android lost as lost - that box only, and a Keychain hiccup elsewhere stays unavailable', 'reads a session item whose own Keystore key Android lost as lost, and leaves the box’s password readable') and `vaultCallSites.test.ts` ('sends only the box whose own Keychain item lost its Android Keystore key to sign in again - the other box and the archive untouched', 'sends a password box whose own password item lost its Android Keystore key to sign in again, and leaves the SMS box syncing'), all four failing with the new read branch taken out. That branch is not a guess at a transient failure: react-native-keychain 10.0.0 makes a new Keystore key only when the alias is missing or holds an incompatible key, serialises every call behind one mutex with a cipher per thread, and reports `AEADBadTagException` - the tag of this ciphertext failing under the key it now has - in exactly those words, so the same read fails the same way until the item is written again (read from `CipherStorageBase.kt`, `CipherCache.kt`, `KeychainModule.kt`). Not covered: a process killed mid-sign-in, or a response that lands after its cancel, leaves a handshake cookie until the next sign-in starts. **Not walked on a device:** a refused, declined, cancelled or left sign-in followed by a look at the jar, and a box item whose Keystore key is lost (not reproducible on demand). *Review of the jar and box items, 2026-09-15:* the evidence above re-run and holding (the 21 sign-in tests against 7d41e20's `src`, the four box item tests with the new read branch taken out). One race closed: a first SMS request still out when a resend or a new sign-in took over emptied the jar under that newer handshake when it failed; `IsdsAuthService` now empties the jar at a step's end only while that step is still the latest (018 T007, review). `AppShell`'s removal comment no longer says a removal empties the jar. **Not walked:** a resend tapped while the first SMS request is still out.

**Checkpoint**: US1 + US2 = a reliable, secure MVP login.

---

## Phase 5: User Story 3 - Sign in with OTP (Priority: P2)

**Goal**: SMS-code (TOTP) login via `as/processLogin`, never crashing at the final step.

**Independent Test**: OTP box → password step → SMS sent, code prompt → valid code
signs in; invalid/expired code → recoverable error; background mid-OTP → no crash.

### Tests for User Story 3 ⚠️

  *Device walk 2026-09-15 (Android emulator `Obalka_Demo`, debug build installed over an archive written
  before the vault):* the app launched on the new build with no crash and no error in the log, and the
  existing boxes and archive loaded as before - the upgrade path the migration covers. The lock was walked
  the same day with the device PIN: switching it on asked once ("Odemknout Obálku"), going to the home
  screen and back brought the prompt up over the app, and the PIN unlocked it where it was left; no error
  in the log. Still to walk: a refresh behind the lock and a biometric change.
- [x] T029 [P] [US3] Unit tests for OTP flows — TOTP two-phase (`needsOtpSms`→submit), `invalidOrExpiredOtp`, `smsNotDelivered`, network failure — all via mock transport, none throw, in `__tests__/accounts/authService.otp.test.ts`

### Implementation for User Story 3

- [x] T030 [US3] Implement OTP auth flows (`as/processLogin?type=totp&sendSms=true`, `type=totp`) + cookie reuse against `/DS/dz` in `src/services/isds/auth.ts` — **as built:** `isdsTransport.ts` + `endpoints.ts` (`processLoginUrl`), on the portal host rather than `ws1`
- [x] T031 [US3] Extend the login state machine with `awaitingSmsCode` + `resendSms`, mapping ISDS partial-success in `src/features/accounts/state/loginMachine.ts`
- [x] T032 [US3] Build the `OtpStep` screen (code entry, resend SMS, countdown, cancel) in `src/features/accounts/screens/OtpStep.tsx` — **as built:** `OtpForm.tsx`
- [x] T033 [US3] Implement `AuthService.submitOtp` + `resendSms` (never-throwing) and localized OTP error states in `src/features/accounts/state/authService.ts`

**Checkpoint**: All supported auth methods work.

---

## Phase 6: User Story 4 - Manage multiple data boxes (Priority: P2)

**Goal**: Add several boxes, switch active in ≤2 taps, remove a box purging its secret.

**Independent Test**: Add 2 boxes → both listed → switch ≤2 taps → remove one → its secret gone, the
other intact.

### Tests for User Story 4 ⚠️

- [x] T034 [P] [US4] Unit tests: add second box, switch active, remove purges Keychain secret + row, others untouched, in `__tests__/accounts/multiBox.test.ts` **[2026-09-08 audit]** Done — `__tests__/accounts/accountsController.test.ts`, plus `__tests__/security/noPlaintextSecrets.test.ts` (T044) for the removal path.

### Implementation for User Story 4

- [~] T035 [US4] Build `BoxList` screen with active-box switch (≤2 taps) in `src/features/accounts/screens/BoxList.tsx` **[2026-09-08 audit]** **Superseded by 011.** The box list became the switcher sheet (`BoxSwitcherSheet.tsx`), which reaches any box in one tap rather than two. Nothing to do.
- [x] T036 [US4] Generalize add/auth so each box holds an independent session/secret in `src/features/accounts/state/accountsController.ts` **[2026-09-08 audit]** Done — every box holds its own secret, and since 018 its own session.
- [x] T037 [US4] Implement remove-box: purge `SecureStore` secret + `accounts` row, reset lock if last box, in `src/features/accounts/screens/RemoveBox.tsx` **[2026-09-08 audit]** Done — `RemoveBoxDialog.tsx` + `AccountsController.removeAccount`; the purge is pinned by T044. *Amended 2026-09-14:* done except 'reset lock if last box': removing the last box returns to Welcome and leaves the app-lock setting as it was. *Closed 2026-09-14:* the removal sequence moved out of `AppShell.handleRemove` into `src/features/accounts/state/removeBox.ts`, which, when no box remains, disarms `KeychainAppLock` and switches the app-lock setting off — the same two steps as the Settings toggle. `AppLock` and `SecureStore` interfaces unchanged. Tests: `__tests__/accounts/removeBox.test.ts` ('resets the app lock when it was the last box - disarmed AND switched off', 'leaves the lock alone while another box remains', 'decides on what is actually left - a removal that failed resets nothing', 'purges everything else held for the box, in order, and only for that box', and a source check that `AppShell` removes boxes through `removeBox`). Not walked on a device. *Review 2026-09-14:* the reset was skipped whenever a step after the row delete threw - a Keychain that would not delete the secret, an archive that would not clear - leaving an app with no box and the lock still armed. `removeBox` now decides on what the store holds after a failure too, and still rethrows it. Tests: `removeBox.test.ts` ('still resets the lock when the last row is gone but the Keychain refuses the secret', 'still resets the lock when a purge fails after the last row is gone', 'reports the removal’s own error even when the store cannot be listed afterwards'; 'decides on what is actually left' now keeps the box listed, as a failed row delete does). *Amended 2026-09-15 (T028):* `KeychainAppLock` is gone; the reset is `Vault.forget`, which deletes the vault key in both placements (and the old placeholder item) and writes the setting off. The key is deleted rather than moved back to the ungated item because every seal it opened went with its box, and the next box starts a fresh one. Test: `__tests__/security/vaultCallSites.test.ts` ('deletes both of a box’s Keychain items, and the last box takes the key and the lock with it'). *Review 2026-09-15:* a removal that failed was lost. `BoxSwitcherSheet` closed and called `onRemove` without waiting, `removeBox` rejected, and nothing caught the rejection: no message, and the list and the active box were not updated until a later refresh, so a box whose row was already gone stayed listed. A failure after the row went also stopped the sequence there, leaving the archive, its files, the reminders and the scan dismissals of a box nothing could reach any more. `removeBox` now never rejects: it resolves with what it did and what the store holds afterwards, and once the row is gone it runs every later step even when one fails (while the row is still listed, or the store cannot say, it touches nothing else - constitution IV). `settleRemoval` turns that into the list, the active box and the route, and `AppShell` shows a dialog when the removal did not finish (`box.removeFailed.*`: the box is still here / it is gone but some of its data stayed / the app cannot tell), whose Zkusit znovu runs the removal again. Downloaded attachment files and signed originals: nothing in 001, 002 or 004 requires keeping them - the only reason ever given was a code comment deferring them to 004 (004 research R6) - and `clearBoxCache`, the first purge, has deleted them since 2026-09-14 (002 FR-015, 004 plan D7), reporting a file that will not delete without failing the removal; `docs/accounts.md` still said they were left on disk and is corrected. Tests: `removeBox.test.ts` ('still resets the lock when the last row is gone but the Keychain refuses the secret', which now also checks the purges ran; 'still resets the lock, and runs the later purges, when a purge fails after the last row is gone'; 'purges once the row went, even when the store cannot be listed afterwards'; 'resolves with the failure when the lock will not reset, rather than rejecting'; the block 'what the screen shows after a removal' for `settleRemoval`); `__tests__/app/boxRemoval.test.tsx`, which mounts the shell and removes a box from the switcher ('says the box is still here when its row would not delete, and removes it on retry', 'moves off a removed active box even when a later step failed, and says the removal did not finish', 'reaches Welcome when the last box goes, and says there that part of it stayed'). Each failed against the code before the change. Not walked on a device - including whether iOS presents the dialog while the switcher sheet is still fading out. *Second review 2026-09-15:* four gaps that change left. (a) Two removals could run at once - the switcher closes before a removal settles - and `removeBox` read the remaining boxes BEFORE its purges: the removal to settle last put a box the other had removed back on screen (and made it active), could miss the last box going and leave the lock armed, and cleared the other removal's failure dialog. Removals now run one at a time in the order asked (`AppShell.handleRemove` queues `removeOne`), `removeBox` lists the store after its purges, and a removal that settles clears only its own box's notice. (b) While the active box's row was gone and its purges still ran, any re-read of the table (opening the switcher) left `activeBoxId` naming a box no longer listed, and the navigator drew nothing - header and switcher included - until the removal settled; the shell now moves to the first remaining box. (c) The failure dialog is an RN Modal that names the box, and Modals draw above the lock overlay: it now closes when the app goes to the background (`useCloseOnBackground`) and is not opened while it is there. (d) `clearBoxCache` kept a removed box's files when its archive rows would not clear; the files go regardless now, and the rows' failure still fails the step. The shell's comment said a closed dialog left the retry in the switcher, which is false for a box already gone: corrected, and `docs/accounts.md` records what stays until the box is added and removed again, and why there is no stored retry marker (the settings table travels in backups, so a restored marker could delete a restored archive). Tests, each failing against the code before this pass: `removeBox.test.ts` ('decides the lock, and what the screen shows, on what is left AFTER the purges'); `boxRemoval.test.tsx` ('shows a box that is still there, not a blank screen, when the list is read again', 'finishes one removal before the next: nothing removed comes back, and no notice is lost', 'closes when the app goes to the background', 'is not opened by a removal that settles while the app is in the background'); `__tests__/messages/messages.test.ts` ('still removes the files when the rows will not clear, and says the rows did not'). Not walked on a device. *Third review 2026-09-15:* seven gaps closed, in code and tests, not walked on a device. (a) A removal that did not finish was never finished: closing its dialog, or a process killed halfway, left what stayed of a box already gone until the same box was added and removed again. `removeBox` now marks the box before its row goes, in the device-local setting `unfinishedRemovals` (`unfinishedRemovals.ts`), and clears the mark once every step went or the box turns out to be listed after all; `resumeRemoval` finishes a marked removal at the next launch and when its dialog closes. It never touches a box that is listed (added again or restored), never deletes a row, and asks the store again before every purge; it opens no dialog, and a resume that fails again waits for the next launch. Adding a box waits for the removal queue (`RemovalQueue.idle`), so the old removal cannot clear the new box or reset the lock over its key. (b) The mark and the app-lock setting are device-local through one list, `DEVICE_LOCAL_SETTINGS` (`app/settings/settingsKeys.ts`), left out of every snapshot and skipped by every restore and phone transfer (006 T006, 025 T014); a lock restored as "on" armed a gate on a phone whose vault key had not travelled. (c) With the row gone and the store unreadable afterwards, `settleRemoval` kept the whole old list on screen, the removed box included: it now takes the list on screen and drops that box, and says the removal did not finish. (d) A second failed removal replaced the first dialog: dialogs queue (`app/shellNotices.ts`). (e) With the last box the screen stayed empty until the purges ended: a box leaves the screen as soon as its row is gone (`onRowGone`), so Welcome appears at once, and the shell draws Welcome for a home with no box rather than an empty navigator. (f) Unhandled rejections in `AppShell`: the launch read and the read after adding a box now end on the launch screen saying `app.loadFailed` with a retry that runs the step again; a rename that will not save opens `box.aliasFailed` with a retry, and one that saved but will not re-read shows the name in place; the re-read after a re-auth and the navigator's reloads report and carry on, and the refresh after a re-auth still runs. (g) Every failed step was reported as `db.write` / `persist`, the Keychain included: `removalFailureReport` names each step (`keychain.write` / `native` for the Keychain, `db.read` for the list, `settings.write` for the scan dismissals and the mark, `appLock.arm` for the lock reset). `AccountsController.removeAccount` is split into `removeRow` and `forgetSecrets` so the removal knows which failed. One expectation changed on purpose: a store that cannot be listed after the row went now stops before the purges, with the Keychain items already gone and the mark kept ('deletes the secrets once the row went, and clears nothing it cannot check, when the store cannot be listed'). Tests failing against the code before this pass: `__tests__/app/boxRemoval.test.tsx` ('is finished at the next launch, and a box listed again is left alone', 'is finished when the dialog saying it did not finish is closed', 'takes the removed box off the screen, and says the removal did not finish', 'shows both notices, one after the other, and closing one about a box still listed deletes nothing', 'shows Welcome as soon as its row is gone, while the rest of it is still being cleared', 'holds a box added from that Welcome until the removal has finished', 'reports a Keychain that refused as the Keychain, not as a database write'); `__tests__/app/shellRecovery.test.tsx` (the launch retry twice, the retry after adding a box, the rename retry, the rename that saved but will not re-read, a reload that will not read, the refresh after a re-auth); `__tests__/backup/deviceLocalSettings.test.ts` (4). New units: `removeBox.test.ts` (the mark, `resumeRemoval`, the settlement, the report), `removalQueue.test.ts`, `unfinishedRemovals.test.ts`, `__tests__/app/shellNotices.test.ts`. ~~Not covered: a restore that brings the box back while a purge that already passed its check is running.~~ *(Closed 2026-09-15, below.)* Not walked on a device: the launch resume, Welcome during the purges, the load-failed screen. *Review of the third pass 2026-09-15:* the new shell tests were run against the code before the pass, with the old controller's `removeAccount` added back to the fake the removal tests mount: the seven removal tests and the eight recovery tests fail there, and the device-local tests fail against the old snapshot and restore. Two gaps closed, in code and tests, not walked on a device. (a) When the saved boxes would not load, the launch screen said nothing to a screen reader - the spinner is hidden from it once the message is up - so the launch simply went quiet; `AppShell.failLoad` now announces the message with the retry's label every time the load fails, a retry that fails again straight away included. Test: `__tests__/app/shellRecovery.test.tsx` ('tells a screen reader, and names the way on, each time'), failing against the pass before. (b) The diagnostics answer (`telemetry`) travelled in backups and transfers and replaced the receiving phone's own answer; it is device-local now (006 T006). Still not covered, recorded in `docs/accounts.md` under "Finishing a removal later": ~~a sync already out for a box when its removal starts writes what ISDS returns into the archive after the purge, with the mark already gone;~~ *(closed 2026-09-15, below)* ~~a removal or resume queued behind a long one empties the cookie jar when its turn comes, which fails a sign-in started meanwhile;~~ *(closed 2026-09-15: removal no longer empties the jar, 018 T010)* ~~a dialog closed by the app going to the background, or a removal that settles there, is not shown on return, because the shell cannot tell when the lock screen has been passed (the removal itself is still finished);~~ *(closed 2026-09-15, below)* and a mark that will not write leaves the next launch nothing to finish from, though closing the dialog still does. *Removal against work in flight, 2026-09-15:* four gaps closed, in code and tests, not walked on a device. (a) A launch or refresh-all sync already out for a box when its removal started wrote the box's envelopes back into the archive after the purge - `loadFolder` cached the list after the ISDS call without asking whether the box was listed, and `refreshAll`'s signal was never aborted - and a download, a signed original or a large-volume walk landing late did the same with the box's files. `BoxWork` (`src/features/messages/state/boxWork.ts`, one for the app in `deps.ts`) now aborts every call of a box when its removal starts (`removeBox`, and `resumeRemoval` once the box is known not to be listed); refuses every write of the box's archive and files while the removal runs, and afterwards for a box the store does not list (a store that cannot say refuses too, reported as `db.read`); and `clearBoxCache` waits for a write that got in first, so it lands before the purge. `MessagesController` runs every call under it and routes every archive and file write through it; `refreshAll` runs each box under the same signal (`forBox`) and neither flags nor credits a box whose call was stopped. (b) A backup restore or a transfer's save could run while a removal's purges were still going, and a box it brought back could be cleared by a purge that had already passed its check. Restores now run apart from removals (`RemovalQueue.runApart`): after the removals queued before them, and a removal asked for meanwhile waits. The queue moved from the shell into `deps.ts`, whose backup controller wraps `restore` and `runRestore` (006 T008). (c) A removal notice closed by the app going to the background, or one that settled there, was never shown on return. The shell now holds its notices while `useAppCovered` - the cover state `LockGate` provides, plus the background - says the app is covered, and shows them once it is in the foreground and unlocked; only the user closes them. (d) `SettingsProvider.setAppLock` wrote with `void`, so a failed write - the last box's lock reset included - was an unhandled rejection: it is settled and reported as `settings.write`. Tests: `__tests__/accounts/removalVsSync.test.ts` (a real removal raced against a listing, a listing already being written, a download, a signed original, a large-volume walk, and a stored message opened mid-removal); `__tests__/messages/boxWork.test.ts` (the rules as units); `__tests__/app/refreshAll.test.ts` ('a box removed while it is being refreshed', three); `__tests__/accounts/removalQueue.test.ts` ('work kept apart from removals', three); `__tests__/backup/restoreApartFromRemovals.test.ts` (the app's own wiring: a transfer's save and the backup screen's restore wait for a removal, and a removal waits for a save); `__tests__/app/boxRemoval.test.tsx` ('goes while the app is in the background, and is back on return', 'shows a removal that settled while the app was in the background once the app is back', 'is never drawn over it: a removal that settled in the background shows once the app is unlocked', mounted behind a real `LockGate`, and 'is stopped when the removal starts, and the box that stays is not'); `__tests__/app/settingsProvider.test.tsx` ('reports a write that failed, and keeps showing what the vault did'). With the seven source files the change touches put back as they were at 7d41e20 (`boxWork.ts` kept so the tests load), all 20 new or rewritten tests in those files fail and every other test there passes (run again on the finished change: 20 of 20 fail there, and `npm run verify` passes with 2293 tests). The two notice tests replace 'closes when the app goes to the background' and 'is not opened by a removal that settles while the app is in the background', which pinned the old behaviour. Still not covered, in `docs/accounts.md`: a restore asked for while a removal runs shows no progress until it starts, only its button saying it is working; a removal whose row then stays has stopped that box's calls, so its open inbox can say the messages could not be loaded until the next refresh; and the mark above. **Not walked on a device:** a removal during the launch sync, a restore started right after a removal, and a removal notice across a background and an unlock. *Review of the removal against work in flight, 2026-09-15:* the 20 new or rewritten tests were run again against the seven source files as they were at 7d41e20 and all fail there. Two gaps closed, in code and tests, not walked on a device. (a) Marking a message read and fetching the credit catch every error and report it, and their signals had never been aborted before: a removal stopping them was reported as `isds.markRead` or `isds.credit` failing. They now report only a call that was not stopped, as every other abort in the app is treated. Tests: `__tests__/accounts/removalVsSync.test.ts` ('a call its box’s removal stopped': marking read and the credit, each also checking that a failure of its own is still reported), both failing against the pass before. (b) `resumeRemoval` stops the box's work once the box is known not to be listed, and no test failed with that stop removed. Test: `removalVsSync.test.ts` ('a removal finished later': a call still out for a box whose row is gone is stopped and writes nothing, and a box listed again keeps syncing), failing with the stop removed.

**Checkpoint**: Multi-box management complete.

---

## Phase 7: User Story 5 - Graceful re-auth & forced password change (Priority: P3)

**Goal**: Detect invalid/expired sessions and forced password changes; scoped re-auth; survive updates.

**Independent Test**: Invalidate one box's session on czebox → scoped re-auth prompt → other boxes
stay signed in; app update preserves accounts.

### Tests for User Story 5 ⚠️

- [x] T038 [P] [US5] Unit tests: session-invalid → `reauthRequired` scoped to box; `passwordChangeRequired` guided; persisted accounts survive a simulated update, in `__tests__/accounts/reauth.test.ts` **[2026-09-08 audit]** Partial — session-invalid is covered by 018 (sessionIsolation, expiredSession); passwordChangeRequired is only mapped from a mock transport (authService.password.test.ts). *Closed 2026-09-14:* `passwordChangeRequired` is now produced and guided, and tested where each part is decided rather than in one `reauth.test.ts`: `loginController.test.ts` ('a refused password on a box whose stored password has expired' — expired date → `passwordChangeRequired`; future or unknown date → `invalidCredentials`; SMS, Mobile Key and the other environment unaffected), `reauthPasswordExpired.test.tsx` (the re-auth screen end to end, including the portal link), `classifyFailure.test.ts`, `reauthCopy.test.ts`, `passwordExpiry.test.ts` ('mustChangePassword'), `staleBanner.test.tsx` ('a password box refused after its password expired') and `BoxSwitcherSheet.test.tsx`. The third clause (accounts surviving an update) was not part of the gap this audit recorded and was not re-examined.

### Implementation for User Story 5

- [x] T039 [US5] Detect `401`/SOAP auth fault on operations → transition to `reauthRequired` scoped to the affected box in `src/services/isds/transport.ts` + `loginMachine.ts` **[2026-09-08 audit]** Done — and corrected twice since: 018 for a missing session, then 2026-08-19 for an EXPIRED one (ISDS answers a dead cookie with HTTP 200 and whitespace).
- [x] T040 [US5] Build the scoped `ReAuth` prompt (single box; others untouched) and `AuthService.reauthenticate` in `src/features/accounts/screens/ReAuth.tsx` **[2026-09-08 audit]** Done — `ReauthForm.tsx`, scoped to one box.
- [x] T041 [US5] Surface forced-password-change + expiry warnings from `GetPasswordInfo` with guided messaging in `src/features/accounts/components/PasswordExpiryNotice.tsx` **[2026-09-08 audit]** Expiry half done 2026-09-08 — `passwordExpiry.ts` (pure) plus a blue (`info`-tone) strip in `MessageList.tsx`, hidden while the re-auth strip is up; `reauthAccount` refreshes the date. Before this, `passwordExpiresAt` was rendered nowhere. Forced password change NOT built: no transport path returns `passwordChangeRequired` (isdsTransport.ts interpretOwnerInfo TODO), so it surfaces as serverFault. *Closed 2026-09-14:* the forced-change half, built from the same `GetPasswordInfo` date because ISDS gives the app nothing else. `mustChangePassword` (`passwordExpiry.ts`) marks a password box refused after that date; `reauthCopy.ts` picks the expired sentence (`box.`/`messages.`/`send.`/`reauth.intro.passwordExpired`); `classifyFailure` records `passwordExpired` (refresh-all skips it, the switcher row says 'Heslo vypršelo'); `LoginController` turns the refusal into `passwordChangeRequired`; the inbox re-auth strip carries a 'Změnit v portálu' action beside 'Přihlásit znovu', and the login error screen a portal link, both opening `portalUrl(host)` — which also fixed the expiry strip always opening the PRODUCTION portal. The `interpretOwnerInfo` TODO stays, reworded: no forced-change status code has been captured, so none is mapped. No `PasswordExpiryNotice.tsx`; the strips live in `MessageList.tsx`. Not walked on a device. *Review 2026-09-14:* the inbox strip read the verdict at the render clock, so a password box refused shortly BEFORE its stored date turned into "expired" on a later re-render while the strip was on screen, growing it by a row of actions (constitution V) and disagreeing with the `reauth` flag `classifyFailure` had stored. It is now read at the moment of the refusal (`refusedAt` in `MessageList.tsx`). Tests: `staleBanner.test.tsx` ('keeps the verdict of the refusal while the clock passes the expiry date'); also added `refreshAllSkip.test.ts` (refresh-all skips a `passwordExpired` box, not only `reauth`) and `__tests__/db/sqliteAccountsStore.test.ts` (the device store reads `passwordExpired` back, so the skip survives a restart). Comments and docs no longer state as fact that ISDS refuses an expired password with the same auth fault as a wrong one - that is assumed, not captured. *Review 2026-09-15:* (1) The re-auth screen told the user to change an expired password on the portal and gave no way there until a sign-in had been tried and refused - the one attempt that sentence exists to prevent. It now links to the portal under the intro (`reauthPortal`, the login error screen's text link, opening `portalUrl(host)` through `LoginFlow`). (2) The switcher row showed the flag stored at refresh-all's refusal, while the re-auth screen re-derived the verdict from the clock, so a box refused before its date read "Přihlášení vypršelo" on the row and "password expired" on the screen once the date had passed. Both read the stored verdict now: `refusedForExpiredPassword` (`passwordExpiry.ts`) returns it, and falls back to the date only for a box with nothing stored - one sent to sign in by the inbox's own sync, which keeps its verdict on screen (`refusedAt`) and does not store it. The screen decides once, when it opens (`storedReauthKey`), so the link cannot appear under a form being filled in. (3) Refresh-all's loading mark (024 FR-003) was decided by a second copy of the skip, written `!== 'reauth'`, so a `passwordExpired` box read "načítá se…" through a refresh that never fetched it; the fetch and the mark are one rule now, `boxesToFetch` in `src/app/refreshAll.ts`. Tests: `reauthPasswordExpired.test.tsx` ('offers the portal before the attempt too, for the box’s own environment'; 'the switcher row and the re-auth screen give one answer', two cases), `crossBoxRefreshing.test.tsx` ('never marks a box waiting for a password change as loading') - each failed against the code before the change - and unit tests of the new functions: `passwordExpiry.test.ts` (`refusedForExpiredPassword`), `reauthCopy.test.ts` ('the re-auth screen’s wording'), `refreshAllSkip.test.ts` (now runs `refreshAll.ts` instead of reading the shell's source). Not walked on a device. *Second review 2026-09-15:* the inbox strip still judged at its own refusal while the row and the re-auth screen read the stored verdict, so a box refused before its date (stored `reauth`) and refused again by its inbox after the date read "change it on the portal" on the strip and "sign in again" on the row and on the re-auth screen the strip leads to - a disagreement the change above introduced. The strip now asks `refusedForExpiredPassword` and `storedReauthKey` at `refusedAt` as well. ~~What remains: with nothing stored, a refusal just before the date and a re-auth screen opened just after it can still read differently.~~ Closed in the third review below. Test: `staleBanner.test.tsx` ('gives the verdict already stored for the box, the one its switcher row and re-auth screen give'), failing against the code before this pass. Not walked on a device. *Third review 2026-09-15:* one moment for a box with nothing stored, in code and tests, not walked on a device. The strip judged at its refusal and the re-auth screen when it opened. The strip now hands `refusedAt` on (`MessageList` `onReauth(refusedAt)` → `AppNavigator` → `AppShell.handleReauth` → `LoginFlow` `reauthRefusedAt` → `ReauthForm` `refusedAt`), and the screen judges at it; only a screen opened without one - from the merged view's strip, whose boxes all have a verdict stored - judges when it opens. Tests: `__tests__/accounts/reauthPasswordExpired.test.tsx` ('is judged on the re-auth screen at the moment ISDS refused it, not when the screen opened'); `__tests__/app/shellRecovery.test.tsx` ('give one answer for a box refused just before its password expired and opened just after', which mounts the shell, lets the inbox be refused a minute before the date and taps "Přihlásit znovu" two minutes later). Both fail against the code before the change.

**Checkpoint**: All user stories independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T042 [P] Accessibility pass (Dynamic Type, screen-reader labels, focus order) across all login screens **[2026-09-08 audit]** Audit finding, before the fix: Never run as a dedicated pass. Accessibility work happened inside 009/013/016 (labels, Dynamic Type at 1.5×, the delivery-state legend), but no one has walked the login screens specifically. **Done 2026-09-08 — and it found less than expected, which is the finding.** Every pressable on Welcome / AddBoxForm / OtpForm already carries a label or a role, and `PressScale` announces `disabled`, carries the blocked reason as a hint, and hides its own visual child from the a11y tree. Two gaps were real: the app had **zero** `accessibilityRole="header"` anywhere, so a screen reader had nothing to jump between (screen titles now carry it), and the primary buttons plus the OTP input capped their own height, which crops the label at large font scale (`height` → `minHeight`; no visual change at 1×). Pinned by `__tests__/accounts/loginA11y.test.tsx`. **Extended app-wide the same day**, because the login pass proved the audit finds real things: fourteen more containers across compose, the message detail, the shared screen header and three dialogs were capping their own labels, and the header role now comes from the shared components — `ScreenHeader` (every sub-screen at once), Settings' `Section`, the FAQ's `GroupLabel`, and the inbox's section headers, which is where jumping by heading is worth most. **Still needs a human**: an actual TalkBack/VoiceOver walk, and a 200% font-scale pass on a device — neither is reachable from jest.
- [x] T043 [P] Verify light/dark theming on every screen (no black-on-black regressions) **[2026-09-08 audit]** Audit finding, before the fix: Never run as a dedicated pass. 009 re-skinned every screen in both themes, so the risk is low, but that is an argument, not a check. **Done 2026-09-08.** `scripts/check-no-raw-hex.sh` had existed since 009 and was run by nothing; it is now `npm run check:colors` and a CI step. The substantive half was contrast: `__tests__/theme/contrast.test.ts` measures every text-on-surface pair and every chip tone in BOTH themes against WCAG AA, and found the promise in `theme.ts`'s own header broken twice in dark mode — `onBlue` on `blue` at **2.65:1** (white ink left on a blue that had been brightened for the dark base: every primary button), and `textFaint` at 3.91 on 12px captions. Now 6.79 and 4.96.
- [x] T044 Add an audit test/lint asserting no plaintext secrets in the DB or logs (SC-006) in `__tests__/security/noPlaintextSecrets.test.ts` **[2026-09-08 audit]** **Done 2026-09-08** — `__tests__/security/noPlaintextSecrets.test.ts`. Pins four things that were architecture-by-convention: the password reaches the Keychain and never a column, the session cookie is stored deliberately and dies with its box, `redact()` covers the shapes the transport actually produces, the SQLCipher key is CSPRNG + enclave with no literal fallback, and nothing in `src/` writes to the console. Each guard was checked by breaking the invariant and watching it fail. *Amended 2026-09-15 (T028):* the session cookie is no longer the database exception - it is sealed in the Keychain like the password - and the suite now pins that the accounts row holds none and that `sqliteAccountsStore.ts` never writes a value into the old column.
- [x] T045 [P] Implement the "federated login not available" messaging + guidance to supported methods (Principle VI) in `src/features/accounts/screens/AddBox.tsx` **[2026-09-08 audit]** Done, in the FAQ rather than the login screen (012, `loginMethods`): it names Identita občana / BankID / mojeID and says ISDS does not expose them to third-party apps. Amended by the Mobile Key finding — that one IS available and is implemented.
- [ ] T046 Run `quickstart.md` manual acceptance against czebox test boxes (password + OTP + multi-box); record results **[2026-09-08 audit]** Partially. Individual flows have been walked on czebox and on two production SMS boxes many times (018 acceptance, 010, 015, 017), but the `quickstart.md` script has never been run start to finish as written.
- [x] T047 [P] Document the accounts feature (setup, flows, czebox) in `docs/accounts.md` **[2026-09-08 audit]** **Done 2026-09-08** — `docs/accounts.md`, written from the code rather than from this spec, since several of 001's decisions were superseded (per-box host, device passcode, the switcher sheet). It covers where each of the three secrets lives, the two DIFFERENT expiries, and the czebox trap.

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → no deps.
- **Foundational (Phase 2)** → after Setup; BLOCKS all user stories.
- **US1 (P1)** → after Phase 2. The MVP gate.
- **US2 (P1)** → after Phase 2; integrates with `SecureStore` (T008) and US1 persistence (T022).
- **US3 (P2)** → after Phase 2; extends US1's auth/state machine (T017–T020).
- **US4 (P2)** → after Phase 2; builds on US1 persistence (T022).
- **US5 (P3)** → after Phase 2; builds on US1 auth + transport (T011, T017–T020).
- **Polish (Phase 8)** → after the desired stories.

### Within each story

- Tests (T0xx) first and failing → models/services → screens → integration.

### Parallel opportunities

- Setup: T002, T003, T004 in parallel.
- Foundational: T007, T008, T009, T012 in parallel (distinct files); T010/T011 follow T009.
- Tests within a story (T014–T016, etc.) run in parallel.
- After Phase 2, US3/US4/US5 can be staffed in parallel with US1/US2 (independent files), though US1
  is the priority to land the MVP first.

---

## Implementation Strategy

### MVP first (US1 + US2)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. US1 (password login) → **validate against czebox** →
4. US2 (biometric lock) → validate. This is a shippable, secure, reliable login MVP.

### Incremental delivery

US1+US2 (MVP) → US3 (OTP) → US4 (multi-box) → US5 (re-auth) → Polish. Each story is an independently
testable increment that doesn't break the previous ones.

---

## Notes

- [P] = different files, no incomplete-task dependency.
- Every `AuthService` method is contract-bound to never throw; tests must prove it for each outcome (SC-002).
- Development uses test-environment boxes added under Pokročilé → Testovací (host `czebox`). The
  environment is chosen per box (`account.host`); there is no build- or release-level switch (T005).
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.

---

## Amendment 2026-09-23 — one sign-in request at a time (audit), in code and tests, not walked on a device

A read-only audit found actions a fast double tap fired twice. The screens guarded them with React
state (`busy`, `loading`, `opening`, PressScale's `busy`), which takes effect only after a re-render,
and a double tap delivers both presses before it. The shared fix is `src/app/useSingleFlight.ts`: a
guard checked and claimed synchronously in the tap, released when the run settles (with `release()`
for a run that can outlive what it waited for), never throwing on a refused call - tested in
`__tests__/app/useSingleFlight.test.tsx`. Every double-tap test below takes the handler out of ONE
render and calls it twice in the same tick (`__tests__/helpers/doubleTap.ts`), or calls the controller
twice without awaiting. Each double-tap test was run against the pre-fix source and failed there; the
tests beside them that check the guard lets go again - after a success, a failure or a stop - or holds
back nothing it should not, pass on either source by design.

- **`LoginController`** (`src/features/accounts/state/loginController.ts`): `start`, `retryWithMethod`,
  `submitOtp` and `resendSms` run exclusively. The in-flight `AbortController` is claimed before the
  first await and a second call while it is set is a no-op - no second `beginLogin`, no second SMS, no
  second code check. It used to be overwritten instead, so a second Mobile Key start left the first
  poll loop running where Cancel could no longer reach it. `cancel` and `dispose` still abort the
  request and free the claim at once, so a new attempt never waits for the aborted one; a request that
  was cancelled does not free a newer one's claim when it finally returns. The state machine is
  unchanged. Tests: `__tests__/accounts/loginController.test.ts` › "a second request while one is
  running (double tap)". `__tests__/isds/unfinishedSignIn.test.ts` had pinned the old behaviour - a
  resend while the first SMS request was still out - and now asserts that resend is refused, keeping
  its point: a request that fails after a cancel and a new sign-in leaves the new handshake alone.
- **A cancelled request's late answer is dropped** (review, same day). Freeing the claim at the cancel
  lets the person start again before the aborted request has come back - a Mobile Key wait notices its
  abort only after the pause between polls - and that late answer used to be applied: an `OUTCOME` in
  the new attempt's `authenticating` or `awaitingMobileKey` replaced its screen with the old attempt's
  "cancelled" error (the new attempt's own answer was then ignored), a late poll status overwrote the
  new wait's, and a late `signedIn` would have stored a box under the new attempt's credentials.
  `applyOutcome` and the Mobile Key status callback now ignore an aborted request. A request that
  throws, against the auth service's promise, still frees the claim. Tests:
  `loginController.test.ts` › "a cancelled request that answers after a new sign-in started", and
  "a request that throws still frees the controller".
- **"Poslat SMS znovu"** (`OtpForm`) is disabled while a code is being sent or checked - dimmed, the
  same size, so nothing moves (constitution V) - and guarded at the tap for its own request. Tests:
  `__tests__/accounts/otpResendDoubleTap.test.tsx` (including the whole flow: one `resendSms` for a
  double tap, disabled until ISDS answers). The review found the code screen's resend, once a code had
  been sent, wired to the bare `resendSms` rather than the path that marks the code as not yet sent, so
  while it asked again the screen still said the code had been sent and spun "checking" on the submit
  button; it now says "Žádáme o jednorázový kód…", and the flow test asserts it.
- **Device walk owed:** on an SMS box, double-tap "Poslat SMS znovu" and check that one SMS arrives;
  start a Mobile Key sign-in with a double tap, cancel, and check that no approval request is left
  waiting in the Mobilní klíč app.

---

## Amendment 2026-09-24 — react-native-keychain's deprecated AES-CBC storage, open

The lint now reports deprecated APIs, and `keychainVaultKeyStorage.ts` names
`Keychain.STORAGE_TYPE.AES_CBC`, which react-native-keychain 10.0.0 deprecates ("Use AES_GCM_NO_AUTH
instead"). Read from the library's Android source before touching it, because this is the file that
holds the vault key:

- **The constant chooses nothing.** No call in this app passes a `storage` option (the vault key, the
  box items, the database key and the backup secret alike), so every write takes the library's own
  choice (`getSelectedStorage` → `getCipherStorageForCurrentAPILevel`, `KeychainModule.kt`), and every
  read decrypts with the cipher recorded beside the item (`getGenericPassword`, `KeychainModule.kt`
  lines 255-263). There is no write cipher to switch and nothing to re-key. `AES_CBC` appears only in
  `UNGATED_STORAGE`, the list a gated write's reported storage is checked against so that an app lock
  the phone could not gate is refused (`NoScreenLockError`). It stays there, under a line-scoped
  `eslint-disable-next-line` that says why: in 10.0.0 AES-CBC and AES-GCM-no-auth both score 23 in
  that fallback (`CipherStorageBase.getCapabilityLevel`, neither needs authentication), a tie settled by
  the iteration order of the name-to-cipher `HashMap` (`KeychainModule.kt` lines 126, 576-588) - which
  today lands on AES-GCM-no-auth, and is not a contract. Test: `keychainPrompts.test.ts` › 'refuses a
  gated write the OS silently stored without a gate (AES-CBC)', which fails with the entry removed.

- [ ] T049 Before upgrading react-native-keychain to a release that drops AES-CBC
  (`CipherStorageKeystoreAesCbc`), make sure no item of this app is still recorded under
  `KeystoreAESCBC`: a read resolves the cipher by that recorded name and has no fallback
  (`getCipherStorageByName(storageName)` then `cipher!!`, `KeychainModule.kt` lines 261-263), so such an
  item - the vault key included - would stop being readable, and without the vault key every box has
  to sign in again. 10.0.0 does not write one for this app (above), but an item written by an older
  version of the library, or by an Android build whose `HashMap` orders the tie the other way, could
  carry it. A read reports the storage it used (`credentials.storage`, line 268), so the migration,
  if one is needed, is: on reading `KeystoreAESCBC`, write the same value again under the same
  service without a `storage` option, read it back and compare before relying on it, and keep using
  the value already read if either step fails - the library overwrites the entry only once the new
  encryption has succeeded (`encryptToResult` before `storeEncryptedEntry`, lines 194-196). The gated copy asks for the unlock on that write. Then take `AES_CBC` out
  of `UNGATED_STORAGE` together with the upgrade.

---

## Amendment 2026-09-24 — a Keychain that fails on every call, in code and tests, not walked on a device

Seen on the Android emulator (debug build, app lock on, three boxes): after an in-process JS reload,
react-native-keychain 10 rejected every call with `java.lang.IllegalStateException: There are multiple
DataStores active for the same file: .../RN_KEYCHAIN.preferences_pb`, and the app showed a blank dark
screen - no lock screen, no inbox, no message - with `Uncaught (in promise, id: 0)` in the log. The
reload itself is a development accident, but a Keychain that fails is not: vendor Keystore bugs and
corrupted stores do the same on real phones, and Principle II owes a clear, localized, recoverable
state then.

- **The unhandled rejection, and the blank screen.** The database key is a Keychain item
  (`src/services/db/database.ts`, `getOrCreateDbKey`), so the first failing call is its read, and every
  database read fails with it. The first read at launch is the settings (`SettingsProvider`), which ran
  in a `void (async () => …)()` with nothing to catch it: that was the rejection. The app root draws
  nothing but a plain background until the settings are `ready` - it must know whether the lock screen
  goes up first - and `ready` was set only after that read, so the background stayed for good. The
  vault, the lock screen and the sealed box items were not the cause: every one of their Keychain calls
  is already caught (`Vault.unlock`, `useKey`, `VaultSecureStore.read` and `prepare`).
- **What it does now.** A settings read that fails is reported (`settings.read`) and the root shows the
  launch screen saying the saved boxes could not be loaded (`app.loadFailed`), with its retry - the
  same screen, moved into `src/app/LaunchScreen.tsx` so the shell and the root share it (constitution
  V). It is announced to a screen reader, as the shell's own is. It does not fall back to the defaults:
  they say the lock is off, and drawing the app on that guess would open a locked archive the moment the
  database answered. The retry is guarded against a double tap.
- **A retry that can succeed.** `getDb` kept a failed open for the rest of the run, so no retry anywhere
  - the root's, the shell's `loadFailed`, the inbox's - could ever succeed without killing the app. A
  failed open is now dropped and the next read opens again. A failed key read still never makes a new
  database key (only a Keychain that answers "no item" does), and a vault key is still never replaced
  because a read failed (`keyUnreadable`, unchanged).
- **The inbox over a failing database.** With the settings answered but the rest of the database
  failing, `MessageList`'s first cache read rejected unhandled and the sync after it never started, so
  the sync bar ran over an empty list; its re-read on focus and its draft counts rejected the same way.
  A cache that will not read now counts as empty and the sync runs (ending in its own error and retry);
  the re-reads keep what is shown.
- **Tests** (each mounts the real `<App />` with every react-native-keychain method rejecting,
  `__tests__/helpers/brokenKeychain.ts`, and fails on any unhandled rejection):
  `__tests__/app/keychainFailureLaunch.test.tsx` (the launch screen and its retry, still failing),
  `keychainFailureLaunchRecovers.test.tsx` (the Keychain answers again; the retry opens Welcome),
  `keychainFailureLockOff.test.tsx` and `keychainFailureLockOn.test.tsx` (settings answered, lock off
  and on, the box list failing: the shell's `loadFailed`, under the lock screen saying `lock.failed`
  for the lock on; recovered through the unlock and the retry), `keychainFailureLockOffBoxes.test.tsx`
  (the inbox saying `messages.error.credentials` with its retry), `keychainFailureLockOnBoxes.test.tsx`
  (the lock screen over the inbox), `keychainFailureUnlockRecovers.test.tsx` (the lock screen's button
  unlocks once the Keychain answers, with the key already stored). All seven fail against the code
  before this change; with only `database.ts` put back, the four with a retry fail; with only
  `MessageList.tsx` put back, the three with a box fail.
- **Device walk owed:** reload the app on the emulator with the lock on (the DataStore duplication), and
  check that the launch screen says the boxes could not be loaded, with its retry, instead of a blank
  screen, and that no red "Uncaught (in promise)" is logged. The duplication lasts until the process
  restarts, so there the retry fails again - which is the point of offering it rather than a way out;
  the recovery itself is covered only by the tests above.
