# Quickstart: Accounts & Secure Login

How to build, run, and manually accept feature 001 against the ISDS **test** environment.

## Prerequisites

- Node + the repo deps: `npm ci`.
- **Android**: JDK 17 (e.g. via SDKMAN: `~/.sdkman/candidates/java/17.0.15-tem`). Export it before Gradle:
  `export JAVA_HOME="$HOME/.sdkman/candidates/java/17.0.15-tem"`. Android SDK at `~/Android/Sdk`.
- **iOS**: requires macOS + CocoaPods (`cd ios && pod install`) — not buildable on the Linux dev host.
- A **test-environment** account (`datovka-test.gov.cz`, formerly czebox). Add it under **Pokročilé →
  Testovací** on the add-box form, which defaults to production. Create at least one **password-only** box,
  one **SMS-code (TOTP)** box and, if available, one **Mobile Key** box to exercise all flows. NEVER use a production data box during development (Principle VII).

## Run

```bash
npm ci
npm start                 # Metro
# Android (new terminal):
JAVA_HOME="$HOME/.sdkman/candidates/java/17.0.15-tem" npm run android
# iOS (macOS only):
# cd ios && pod install && cd .. && npm run ios
```

The environment is chosen per box, not per build: a box added under **Testovací** talks to
`datovka-test.gov.cz` (see `src/services/isds/endpoints.ts`).

## Manual acceptance (maps to spec Success Criteria)

1. **US1 / SC-001, SC-003**: Add a password box with valid test-environment credentials → reach signed-in home
   in < 60 s. Force-quit, reopen → the app lock, if enabled → lands in the box without re-entering credentials.
2. **US1 / SC-002**: Enter a wrong password → clear localized error + retry, **no crash**.
3. **US3 / SC-002**: With an OTP box, complete the password step → the code screen opens immediately
   ('Žádáme o jednorázový kód…'), then reports the SMS once ISDS confirms it. Enter a valid code →
   signed in. Enter an invalid/expired code → recoverable error at the final step, **no crash**.
   Background the app during OTP, return → no crash.
   Mobile Key: enter the communication code → approve the push in Mobilní klíč → signed in; decline or
   wait out 240 s → recoverable error.
4. **US2**: Background and resume → biometric prompt gates content; force a biometric failure → the
   device passcode is offered (there is no app-specific PIN); nothing is shown before unlock.
   *Since T028 (2026-09-15), also walk:* switch the lock on in Settings (one prompt) and off (none);
   with it on, background the app and return - no box refreshes before the unlock, and the unlock is
   the only prompt; with boxes signed in, remove the phone's screen lock (or change its fingerprints
   or face) and set it again, reopen - one explanation dialog, the archive intact, each box asks to
   sign in again, and signing in works.
   *Review 2026-09-15, also walk:* on an Android 10 or older phone, unlock with "Use PIN" instead of a
   fingerprint - the app opens after the PIN, with no second prompt; start an unlock, press Home while
   the prompt is up, return after a few seconds - it asks again; unlock and press Home within half a
   second - returning shows the lock screen, not the app.
5. **US4 / SC-005**: Add a second box → both appear in the box switcher → switch in one tap. Remove one →
   confirm its Keychain secret is gone (re-add prompts for password) and the other box remains.
6. **US5**: Change the box's password in the test environment to invalidate the session → trigger an action → a
   re-auth prompt scoped to that box appears; other boxes stay signed in.
7. **SC-004**: Throttle the network → the UI stays responsive and the in-progress login is cancellable.
8. **SC-006 / Principle VI**: Audit DB + logs → no plaintext secrets. The FAQ's sign-in answer names
   the supported methods and says Identita občana / BankID / mojeID are not available to third-party apps.

## Automated tests

- `npm test` — unit-tests the login **state machine** and `AuthService` against a **mock ISDS transport**
  covering every typed outcome (`signedIn`, `needsOtpSms`, and errors
  `invalidCredentials`, `invalidOrExpiredOtp`, `smsNotDelivered`, `passwordChangeRequired`, `duplicateBox`,
  `network`, `timeout`, `serverFault`, `cancelled`, `mobileKeyRejected`, `mobileKeyTimeout`) — proving no
  path throws (SC-002).
