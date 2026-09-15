# Feature Specification: Accounts & Secure Login

**Feature Branch**: `001-accounts-secure-login`
**Created**: 2026-06-12
**Status**: Implemented, with gaps. Tasks: 44/48 done, 3 partial or superseded, 1 open (T046). Open: T046 (quickstart walked end to end). Closed 2026-09-15: T028, passwords and sessions unreadable while the app is locked (the vault key; FR-004 and FR-006 notes; not walked on a device). Closed 2026-09-14: forced-password-change detection (FR-009 / US5 scenario 2 — inferred from the stored password-expiry date after an auth fault, T038 and T041; see the FR-009 note for its limits) and resetting the lock when the last box is removed (T037). Superseded: the environment is per box; the lock falls back to the device passcode, not an app PIN; the box list became 011's switcher sheet; Mobile Key IS available and implemented (FR-011, edge cases, Assumptions); ~~the session cookie is stored per box in the encrypted DB, not the Keychain (018, FR-004)~~ since 2026-09-15 the session cookie is sealed per box in the Keychain like the password (T028). [`docs/accounts.md`](../../docs/accounts.md) describes the feature as built.
**Input**: User description: "Accounts and secure login for ISDS data boxes: add multiple boxes, username+password and OTP auth, biometric app-lock, secure on-device credential storage that never crashes"

## User Scenarios & Testing *(mandatory)*

This feature is the foundation of the app: until a user can reliably and safely get signed in
to at least one data box, nothing else has value. It directly targets the incumbent's most-cited
failures — crashing at the last step of login, forced re-login after every update, no biometric
unlock — and the praise for managing several boxes in one place.

### User Story 1 - Sign in to a data box with username + password (Priority: P1)

A person who owns an ISDS data box opens the app, adds their box by entering their data-box
login name and password, and reaches a signed-in state where the app is ready to work with that
box. Their credentials are stored only in the device's secure storage; they are not asked to
re-enter them on the next launch.

**Why this priority**: This is the minimum viable slice — the most common credential type and the
gateway to every other feature. Shipping only this already delivers a usable, trustworthy login.

**Independent Test**: With a username+password test box (czebox), enter valid credentials and
confirm the app reaches the signed-in state; force-quit and relaunch and confirm no re-entry is
needed. Enter wrong credentials and confirm a clear, recoverable error with no crash.

**Acceptance Scenarios**:

1. **Given** a fresh install with no accounts, **When** the user enters a valid box login name and
   password and confirms, **Then** the app authenticates and shows the signed-in home for that box.
2. **Given** valid credentials are being submitted, **When** the network is slow, **Then** the UI
   shows non-blocking progress and stays responsive (the user can cancel) and never freezes.
3. **Given** the user entered an incorrect password, **When** authentication fails, **Then** a
   clear localized error is shown with a retry option and the app does not crash or get stuck.
4. **Given** a box was successfully added, **When** the user force-quits and reopens the app,
   **Then** the account is still present and no credentials need re-entering.

---

### User Story 2 - Protect the app with biometric lock (Priority: P1)

After adding a box, the app is protected by the device biometric (Face ID / Touch ID /
fingerprint). On each launch or return from background, the user unlocks with biometrics instead of
re-typing a password; if biometrics are unavailable or fail, a device-passcode / app-PIN fallback
is offered.

**Why this priority**: Users explicitly ask for biometric unlock instead of typing a PIN, and the
app holds sensitive government correspondence — an at-rest lock is a baseline trust requirement.
Pairs with US1 so a v1 login is both reliable and safe.

**Independent Test**: Enable the lock, send the app to background and return, confirm the biometric
prompt gates access; simulate a failed/absent biometric and confirm the passcode/PIN fallback works
and that contents are never shown before a successful unlock.

**Acceptance Scenarios**:

1. **Given** at least one account exists and biometrics are enrolled, **When** the app is launched
   or resumed, **Then** the user must pass biometric authentication before any box content is shown.
2. **Given** biometrics fail or are unavailable, **When** the user attempts to unlock, **Then** a
   passcode / app-PIN fallback is offered and works.
3. **Given** the device has no biometric hardware enrolled, **When** the user sets up the app,
   **Then** they are guided to set an app-PIN so the lock is still enforced.

---

### User Story 3 - Sign in to a box that requires a one-time code (OTP) (Priority: P2)

A user whose data box requires two-factor login (a one-time code by SMS or a security/OTP code in
addition to the password) can add and authenticate that box: after the password step, the app
prompts for the one-time code and completes sign-in.

**Why this priority**: A meaningful share of boxes are configured for OTP login, and the incumbent
notoriously crashes precisely at this final OTP step. Supporting it correctly is a headline
reliability win, but it builds on the US1 credential flow.

**Independent Test**: With an OTP-enabled test box, complete the password step, enter a valid
one-time code, and confirm sign-in; then repeat with an invalid/expired code and confirm a clear,
recoverable error with no crash at the final step.

**Acceptance Scenarios**:

1. **Given** a box requires a one-time code, **When** the user submits a valid password, **Then**
   the app prompts for the one-time code without crashing or freezing.
2. **Given** the one-time code prompt is shown, **When** the user enters a valid code, **Then**
   sign-in completes and the box becomes available.
3. **Given** an invalid or expired one-time code is entered, **When** the user submits it, **Then**
   a clear localized error and retry path are shown and the app remains stable.
4. **Given** the user backgrounds the app during OTP entry, **When** they return, **Then** the flow
   resumes or fails gracefully with a clear message — never a crash.

---

### User Story 4 - Manage multiple data boxes (Priority: P2)

A user with more than one data box adds several, sees them listed, switches the active box, and can
remove a box. Each box is authenticated independently.

**Why this priority**: "All my boxes in one app" is a top reason people love the category; the
incumbent handles multi-box poorly. Valuable but depends on the single-box login (US1) working.

**Independent Test**: Add two test boxes, confirm both appear and can be switched between in ≤2
taps, remove one and confirm its credentials are purged from secure storage while the other remains.

**Acceptance Scenarios**:

1. **Given** one box is signed in, **When** the user adds a second box with valid credentials,
   **Then** both boxes are listed and individually authenticated.
2. **Given** multiple boxes exist, **When** the user selects a different box, **Then** the app
   switches the active box in ≤2 taps without re-authenticating from scratch.
3. **Given** a box is selected for removal, **When** the user confirms, **Then** that box's stored
   secrets are deleted from secure storage and it no longer appears.

---

### User Story 5 - Recover gracefully from expired sessions and forced password changes (Priority: P3)

When a stored session is no longer valid (expired, password changed on the portal, or ISDS forces a
password change), the app detects this on the next operation and presents a focused re-authentication
prompt — without crashing, logging the user fully out of all boxes, or forcing a full reconfiguration.

**Why this priority**: Forced re-login "after every update" and unexplained logouts are recurring
complaints; handling expiry gracefully protects trust. It is a refinement on top of the core flows.

**Independent Test**: Invalidate a box's session (e.g., change its password on czebox), trigger an
operation, and confirm a targeted re-auth prompt appears for only that box, succeeds after entering
the new password, and leaves other boxes untouched.

**Acceptance Scenarios**:

1. **Given** a box's stored session is no longer valid, **When** the user performs an action needing
   auth, **Then** the app shows a re-auth prompt scoped to that box and does not crash.
2. **Given** ISDS requires a password change, **When** this is detected, **Then** the user is
   informed clearly and guided, rather than being silently logged out everywhere.
3. **Given** the app is updated to a new version, **When** the user reopens it, **Then** all
   accounts and their secure credentials remain intact (no reconfiguration required).

---

### Edge Cases

- Wrong login name / password → clear localized error, retry, no lockout surprises, no crash.
- OTP not received, mistyped, or expired → recoverable error; option to restart the code step.
- Network lost mid-login (after password, before/after OTP) → graceful failure with retry; no
  partial/zombie session; no crash.
- App killed or backgrounded during any login step → safe resume or clean restart of the step.
- Duplicate add (a box already present) → detected and surfaced instead of creating a second entry.
- Biometric hardware absent / not enrolled / locked out → app-PIN fallback enforced.
- Device storage/secure-enclave unavailable → fail safe with a clear message; never store secrets in plaintext.
- User attempts a federated method (NIA / BankID / mojeID / Mobile-Key) → app clearly explains it is
  not available and points to the supported methods (honest-scope requirement).
- OS or app update → accounts and secrets survive intact.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to add a data box account by entering its login name and password.
- **FR-002**: System MUST authenticate a box using login name + password.
- **FR-003**: System MUST authenticate a box that requires a one-time code (SMS / security/OTP code)
  by prompting for and verifying that code after the password step.
- **FR-004**: System MUST store all credentials and session secrets only in the device secure
  storage (secure enclave); secrets MUST never be written to the app database, logs, or backups in
  plaintext, and MUST never be sent to any server other than ISDS.

  *As built, 2026-09-15 (T028):* each box's password and session cookie is a Keychain item holding a
  seal under one vault key; the database holds neither (018's `sessionCookie` column is emptied by a
  launch migration and never written again). With the app lock off the vault key is readable
  whenever the phone is unlocked - the exposure a plain password item always had. With it on the key
  sits behind the biometric gate and in memory only while the app is unlocked, so neither secret can
  be read while the app is locked. The database key and the backup passphrase are separate items and
  unchanged. Backups and phone transfer carry no secret.
- **FR-005**: System MUST persist accounts and keep the user authenticated across app restarts,
  OS updates, and app updates without requiring re-entry of all credentials.
- **FR-006**: System MUST gate all access to box content behind a biometric lock, with a device-
  passcode / app-PIN fallback, and MUST NOT reveal any content before a successful unlock.

  *As built, 2026-09-15 (T028):* the lock is opt-in (off by default, an owner decision) and falls back
  to the device passcode, not an app PIN (T027). With it on, the gate protects the secrets and not
  only the screen: unlocking is the read of the vault key, and every ISDS call waits for it, the launch
  refresh included. Enabling costs one prompt, each unlock one, ordinary use none.
- **FR-007**: Users MUST be able to add, list, switch between (in ≤2 taps), and remove multiple
  boxes; removing a box MUST purge that box's secrets from secure storage.

  *As built, 2026-09-15:* removing a box takes its row, both Keychain items, its archive with the
  downloaded attachment files and signed originals, its reminders and its scan dismissals - and, with
  the last box, the app lock (T037). A removal that does not finish ends on a dialog saying which of
  three things is true - the box is still here, it is gone but some of its data stayed, or the app
  cannot tell - and offers to try again; the list and the active box show what the store holds, not
  what was asked for (`removeBox.ts`, `settleRemoval`). Removals run one at a time and decide on what
  is left after their purges; ~~the dialog closes when the app goes to the background~~ *amended
  2026-09-15:* the dialog is held while the app is in the background or behind the lock screen and
  shown once the app is back and unlocked, a removal stops the box's sync and downloads in flight and
  nothing of the box is written after its purge, and a restore and a removal never run at once. ~~A removal that did
  not finish is not retried on its own once that dialog is closed (docs/accounts.md says what stays,
  and why no stored marker).~~ *Amended 2026-09-15:* a removal that did not finish is finished later, from
  a device-local mark written before its row goes: at the next launch and when its dialog closes, never
  for a box that is listed again (`resumeRemoval`). Failure dialogs queue, a box leaves the screen as
  soon as its row is gone (with the last box, Welcome at once), and adding a box waits for a removal
  still running. Details and tests: tasks.md T037. Not walked on a device.
- **FR-008**: Every login and OTP step MUST present clear, localized (Czech-first) progress and
  error states with a retry path, and MUST NOT hard-crash — especially at the final step.
- **FR-009**: System MUST detect invalid/expired sessions and forced password changes and present a
  re-auth prompt scoped to the affected box, without logging the user out of other boxes or forcing
  full reconfiguration.

  *As built, 2026-09-14:* expired sessions as in 018. A forced password change is **inferred**, not
  read from ISDS: no response to an expired password has been captured - no status code, so
  `interpretOwnerInfo` maps none (its TODO says why), and no confirmation that it is refused with the
  same auth fault as a wrong password (research.md records only the wrong one as `401`). The inference
  assumes that auth fault. When a PASSWORD box is refused, at the moment of the refusal, after the
  expiry date `GetPasswordInfo` stored at its last sign-in (`mustChangePassword`, `passwordExpiry.ts`),
  the app says the password
  expired and must be changed on the ISDS portal, and offers that portal for the box's environment
  (`portalUrl`): on re-auth or re-add `LoginController` turns the refusal into
  `passwordChangeRequired`; on refresh `classifyFailure` records `passwordExpired`, which refresh-all
  skips; the re-auth screen, inbox strip, message detail and compose use the expired sentence via
  `reauthCopy.ts`. OTP and Mobile Key boxes are unaffected. Limits, stated rather than hidden: a
  password changed on the portal and then mistyped still reads as expired until a sign-in succeeds;
  one changed before the stored date reads as invalid credentials; and if ISDS answers an expired
  password with a status code instead of an auth fault, that still surfaces as a server error. Not
  walked on a device.

  *Review 2026-09-15:* the re-auth screen links to the portal before any attempt, and takes its
  verdict from the flag stored with the refusal - the one the switcher row shows - rather than from
  the clock (`refusedForExpiredPassword`); only a box with nothing stored is judged by the date, once,
  when the screen opens. The inbox strip takes a stored verdict over its own refusal too, so the row,
  the strip and the screen agree whenever one is stored; ~~with none stored, the strip judges at its
  refusal and the screen when it opens, and a refusal just before the date with a screen opened just
  after it can still read differently on the two.~~ *Amended 2026-09-15:* with none stored, the strip
  hands the moment of its refusal to the re-auth screen it opens, and both judge at that moment; only a
  screen opened without one (the merged view's strip, whose boxes all have a verdict stored) judges when
  it opens.
  Refresh-all no longer marks a `passwordExpired` box as loading. Details and tests: tasks.md T041.
  Not walked on a device.
- **FR-010**: All authentication networking and cryptography MUST run off the UI thread; the UI MUST
  remain responsive and cancellable throughout.
- **FR-011**: System MUST clearly communicate that federated login (NIA / BankID / mojeID /
  Mobile-Key) is not available and direct users to the supported methods.
- **FR-012**: System MUST be exercised against the ISDS test environment (czebox) during development
  and acceptance, never against production mailboxes.

### Key Entities *(include if feature involves data)*

- **Data box account**: a configured box the user can access. Attributes: box/login identifier, a
  user-visible label, the authentication method in use, and a reference (not the value) to its secret.
- **Credential secret**: the sensitive login material (password and any session token), held only in
  the device secure enclave and referenced by the account. *As built:* two Keychain items per box
  (password, session), each sealed under the vault key (T028).
- **Auth session**: transient authenticated state for a box, with validity/expiry, used to detect
  when re-authentication is required.
- **App lock setting**: whether biometric/PIN lock is enabled and the configured fallback.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can add a box and reach the signed-in state in under 60 seconds on the
  first attempt with valid credentials.
- **SC-002**: Across the defined login-outcome matrix (success, wrong password, invalid OTP, expired
  OTP, network drop at each step, backgrounding mid-flow), there are **zero crashes**; every failure
  shows a recoverable, localized message.
- **SC-003**: After force-quitting and reopening — and after a simulated app update — the user lands
  on the lock screen and into their existing boxes without re-entering credentials, 100% of the time.
- **SC-004**: The UI remains responsive throughout login on a slow network (no unresponsive period
  longer than 100 ms attributable to auth work on the UI thread).
- **SC-005**: A user with multiple boxes can switch the active box in ≤2 taps.
- **SC-006**: 100% of stored secrets reside in the device secure enclave; an audit of the app
  database, logs, and file storage finds no plaintext credentials.

## Assumptions

- Target users are individuals and professionals in the Czech Republic who own one or more ISDS data
  boxes, on iOS and Android.
- v1 supports only login name + password and login name + password + OTP, because ISDS does not
  expose NIA / BankID / mojeID / Mobile-Key federated login to third-party apps. Federated login is
  explicitly out of scope for this feature.
- Reading messages while offline (the local archive) is handled by a separate feature; this feature
  assumes network connectivity is available for authentication.
- The app reuses the platform's secure storage (Keychain / Keystore) and biometric APIs.
- Development and acceptance use the ISDS test environment (czebox) with test data boxes.
- This feature establishes the account model and lock that later features (message list, sync,
  archive, sending, backup) build upon.

## Implementation: biometric app-lock (US2, 2026-06-13)

Built. An optional **App lock** (Settings → Zabezpečení) gates the whole app behind the device
biometric, with the **device passcode as fallback**:

- `AppLock` / `KeychainAppLock` — reuses **react-native-keychain** (no new native module): a Keychain
  item under `BIOMETRY_ANY_OR_DEVICE_PASSCODE`; "unlock" = retrieving it, which makes the OS show its
  biometric prompt (passcode fallback when biometrics fail / none enrolled). NEVER throws.
  *Replaced 2026-09-15 (T028):* the placeholder item is gone (deleted at the first unlock); the
  `AppLock` is the `Vault`, and the item behind the gate is the vault key every box secret is sealed
  under.
- `LockGate` (App.tsx) gates the signed-in tree: **locked from the first frame on cold launch** (no
  content flash) and **re-locked on `AppState 'background'`**, so returning re-prompts. The app-switcher
  snapshot is NOT hidden by this (the OS captures it before `background` arrives); it is covered
  natively — a privacy cover in `AppDelegate.swift`; `setRecentsScreenshotEnabled(false)`, or a cover on
  API 32 and older, in `MainActivity.kt` — pinned by `__tests__/security/appSwitcherPrivacy.test.ts`. The
  unlock prompt **auto-fires only while foregrounded** — prompting during the background→active
  transition instantly "fails", so it waits for `'active'`. Manual "Odemknout" retry as a fallback.
- Enabling requires one successful auth up front (so a user is never stranded), then persists the
  `appLock` setting. DI'd (`LockGate` takes `enabled` + the `AppLock`) → unit-tested.

**Caveat (UX, noted live):** with NO biometric enrolled the OS falls back to its full-screen
device-passcode screen, whose generic title ("Authenticate to retrieve secret") comes from the
keychain library and is not brandable. The **biometric** path uses our title ("Odemknout Obálku"). A
fully-branded fallback would require an in-app PIN (US2 scenario 3) — deferred (trades off security +
maintenance vs the OS credential). Validated live on the emulator: enable → background-lock → resume
auto-prompt → unlock via the device passcode.

## Deferred: password-manager autofill (1Password / Keychain / Google)

**Idea (user).** On the add-box / re-auth screen, the user's password manager should suggest the
saved ISDS website login — ideally the right one per environment (production →
`datovka.gov.cz`, test → `datovka-test.gov.cz`; formerly `mojedatovaschranka.cz` / `czebox.cz`). The credential is genuinely the same: the ISDS web
portal uses the *same* login name + password our SOAP login does, so a hit would autofill exactly
what we need.

**Two layers — and the catch.**

1. **Field hints (in our control, low effort — do this first, likely part of login polish).** Tag the
   inputs so *any* manager recognizes them and can save/fill: iOS `textContentType` (`.username` /
   `.password`), Android `autofillHints` (`username` / `password`), plus `autoComplete` on the RN
   `TextInput`. This alone gets save-on-submit + suggest-on-return for a login the manager has tied to
   *our app*. The add-box form sets these hints today (`AddBoxForm.tsx`).

2. **Web-credential association (the "magic" the user saw — NOT in our control).** Apps that surface a
   *website's* saved login do it via **domain association**: iOS **Associated Domains** entitlement
   (`webcredentials:datovka.gov.cz`) matched by an **AASA** file the *domain* hosts at
   `/.well-known/apple-app-site-association`; Android **Digital Asset Links**
   (`/.well-known/assetlinks.json`). Both files must live on the **ISDS operator's domains**
   (`datovka.gov.cz`, `datovka-test.gov.cz`), which **we do not control** — so we can't self-declare the
   link the way a bank (which owns both its app and domain) can. That's the blocker.

**Workarounds / paths to explore later.**
- **User-side manual link:** 1Password (and others) let a user attach an app/package to an existing
  website login. With our field hints in place, the user links our app once → suggestions thereafter.
- **Manager known-app registries:** submit the app↔site mapping to 1Password's / Apple's / Google's
  shared-credentials lists so it works without manual linking. Feasibility TBD.
- **Operator cooperation:** ask the ISDS operator (DIA/Datovka) to add our app to their AASA /
  assetlinks. Unlikely / slow, but the only route to true OS-level web-credential autofill.
- **Per-environment** suggestion (czebox vs production) only becomes meaningful once association
  exists; until then it's whatever the user's manager has tied to the app.

**Status:** layer 1 shipped (username/password hints on AddBoxForm and ReauthForm). Layer 2, OS
web-credential association, is still blocked on the operator's domains (`datovka.gov.cz` /
`datovka-test.gov.cz`) and remains deferred.
