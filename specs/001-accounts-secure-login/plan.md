# Implementation Plan: Accounts & Secure Login

> **As built.** Some structure below changed while building: the SOAP builders and parsers live in
> `src/services/isds/soap.ts` and the transport in `isdsTransport.ts` (there is no `auth.ts` / `operations.ts`),
> the environment is chosen per box rather than per build, the lock falls back to the device passcode, and the
> box list became 011's switcher sheet. ~~Box passwords are stored `WHEN_UNLOCKED_THIS_DEVICE_ONLY` without
> biometric access control (the app lock gates the UI, not the secret)~~ *Since 2026-09-15 (T028):* box
> passwords and session cookies are sealed under one vault key, and with the app lock on that key sits
> behind the biometric gate and is held in memory only while unlocked - see "The vault key" below and
> research R6b. Mobile Key IS offered and
> implemented; only NIA / BankID / mojeID are shown as unavailable.
> [`docs/accounts.md`](../../docs/accounts.md) describes the feature as built.

**Branch**: `001-accounts-secure-login` | **Date**: 2026-06-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-accounts-secure-login/spec.md`

## Summary

Build the foundational login for the app: let a user add one or more ISDS data boxes and
authenticate with **username+password** or **username+password+SMS code**, store secrets only in the device secure enclave behind a **biometric lock**, keep them across
app/OS updates, and never crash — especially at the final OTP step. Technical approach: a typed,
on-device **ISDS SOAP client** (no backend) that speaks directly to ISDS access points
(`…/DS/dz` for basic auth; `…/as/processLogin?type=totp…` for the SMS code), verifying credentials with
a lightweight authenticated call. Networking runs on the platform's native thread; secrets live in
Keychain/Keystore via `react-native-keychain` with biometric access control; non-secret account
metadata lives in encrypted SQLite. All development/testing targets the **czebox** test environment.

## Technical Context

**Language/Version**: TypeScript 5.x (strict) on React Native 0.8x (CLI, New Architecture: Fabric/TurboModules)
**Primary Dependencies**: `react-native` (CLI), `@react-navigation/*`, `react-native-keychain`
(secure enclave + biometric gate), `fast-xml-parser` (SOAP envelope parse), `op-sqlite` (SQLite,
SQLCipher-capable) for account metadata, `@react-native-cookies/cookies` (ISDS session cookie across
`as/processLogin`→`DS/dz`). Networking via native `fetch`.
**Storage**: Secrets → iOS Keychain / Android Keystore (never plaintext, never in DB/logs). Account
metadata (box id, label, auth method, session validity) → encrypted SQLite. No message data in this feature.
**Testing**: Jest + React Native Testing Library (unit/component); a mockable ISDS transport for the
login state machine; manual acceptance against **czebox** test data boxes on device/emulator.
**Target Platform**: iOS 15+ and Android 8+ (API 26+). Build note: Android Gradle requires JDK 17
(`~/.sdkman/candidates/java/17.0.15-tem`); iOS requires macOS (not buildable on the Linux dev host).
**Project Type**: Mobile app (single React Native codebase, bare CLI).
**Performance Goals**: UI stays responsive (no >100 ms UI-thread stall) during any auth call;
add-box-to-signed-in < 60 s on first try; biometric unlock < 2 s.
**Constraints**: No backend (direct device→ISDS over TLS). No UI-thread blocking. No hard crash on
any login outcome. On-device secrets only. czebox-only during development.
**Scale/Scope**: Per-user, a handful of boxes (1–10 typical). This feature ≈ 6–8 screens/flows
(add box, password, OTP, biometric setup/unlock, box list/switch, remove, re-auth prompt).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How this feature complies |
|-----------|---------------------------|
| I. Never block the UI thread | All ISDS I/O via native `fetch` (off JS thread); auth responses are small → cheap parse; the ISDS client is isolated so heavy work can move to a worklet/native module later. UI shows cancellable non-blocking progress. |
| II. Crash-resilient by contract | Login modeled as an explicit state machine with typed error states, timeouts, and retry at every step incl. the final OTP submit; ISDS partial-success/redirect handled, never an unhandled throw. |
| III. Privacy first, on-device only | No backend. Secrets in Keychain/Keystore with biometric access control; metadata DB encrypted; nothing sent anywhere but ISDS. |
| IV. Local archive sacred | N/A for login, but removing a box only purges *that* box's secrets/metadata (archive handled in 004) and requires explicit confirmation. |
| V. Modern, accessible, Czech-first | All login/error strings localized (cs primary), Dynamic Type, screen-reader labels, working light/dark. |
| VI. Honest scope | Only password + OTP advertised; federated (NIA/BankID/mojeID/Mobile-Key) shown as "not available" with guidance. |
| VII. Verify against test env | All flows exercised against czebox; production hosts gated behind a build/config switch, never used in dev. |

**Result**: PASS (no violations; Complexity Tracking not required).

## Project Structure

### Documentation (this feature)

```text
specs/001-accounts-secure-login/
├── plan.md              # This file
├── research.md          # Phase 0 output (ISDS auth + RN decisions)
├── data-model.md        # Phase 1 output (entities)
├── quickstart.md        # Phase 1 output (czebox setup + manual acceptance)
├── contracts/           # Phase 1 output (ISDS auth contract + internal AuthService contract)
│   ├── isds-auth.md
│   └── auth-service.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── app/                      # navigation + app shell, lock gate
│   ├── App.tsx
│   ├── navigation/
│   └── lock/                 # biometric/PIN lock gate (US2)
├── features/
│   └── accounts/             # this feature
│       ├── screens/          # AddBox, PasswordStep, OtpStep, BoxList, RemoveBox, ReAuth
│       ├── state/            # login state machine, accounts store
│       └── components/
├── services/
│   ├── isds/                 # on-device ISDS SOAP client (transport, envelopes, auth)
│   │   ├── endpoints.ts      # czebox/prod hosts + access-point paths
│   │   ├── soap.ts           # envelope build/parse (fast-xml-parser)
│   │   ├── auth.ts           # password + SMS-code flows, session cookie
│   │   └── operations.ts     # GetOwnerInfoFromLogin / GetPasswordInfo (verify login)
│   ├── secureStore/          # react-native-keychain wrapper (biometric access control)
│   └── db/                   # op-sqlite (encrypted) — accounts table
├── i18n/                     # cs (primary), en
└── theme/                    # tokens, light/dark

__tests__/                    # Jest unit/component tests (mock ISDS transport)
android/  ios/                # native projects (scaffolded)
```

**Structure Decision**: Single React Native codebase organized feature-first under `src/`, with a
shared `services/isds` client reused by every later feature (002 messages, 003 sync, 005 sending).
The login UI lives in `src/features/accounts`; the app-wide lock gate in `src/app/lock`. Native
`android/`/`ios/` are the scaffolded projects; any future native modules (off-thread XML/crypto,
background sync) attach here.

## The vault key (T028, 2026-09-14)

Decided by the owner: the app lock stays opt-in. With it on, a box's password and session cookie are
unreadable while the app is locked, with no prompt added to normal use; with it off, behaviour is what
it was. The reasoning, the alternatives and the limits are research R6b; this is where it sits.

```
unlock (LockGate)  →  Vault.unlock   →  read K from the gated Keychain item (the one prompt)
WS call            →  controller     →  SecureStore.readPassword / readSession
                                      →  Vault.useKey (waits while locked; never prompts)
                                      →  Keychain item cz.obalka.box.<id> / cz.obalka.session.<id>
                                      →  open (XChaCha20-Poly1305, AAD = kind + boxId)
background         →  Vault.lock     →  K dropped from memory
toggle             →  Vault.enable / disable  →  K moved between the plain and gated items
last box removed   →  Vault.forget   →  K deleted, lock off
```

| Piece | File |
|---|---|
| Sealing format (versioned, key id, AAD) | `src/services/secureStore/seal.ts` |
| K: generation, placement, lock/unlock, waiting reads, loss | `src/services/secureStore/vault.ts` |
| K in the Keychain (plain and gated items) | `src/services/secureStore/keychainVaultKeyStorage.ts` |
| Sealed items per box, reads, saves, migration | `src/services/secureStore/vaultSecureStore.ts` |
| The `SecureStore` contract and its in-memory fake | `src/services/secureStore/secureStore.ts` |
| The lock screen reading K | `src/app/lock/LockGate.tsx` |
| The notice when K was lost | `src/app/lock/VaultLostNotice.tsx` |

Deviations from the task as first written, and why:
- **The last box takes K with it** rather than moving it back to the plain item: nothing is left for it
  to open (R6b, Removal).
- **With the lock off and K found only in the gated item**, the lock screen appears once to move it back
  instead of generating a new key: a backup restore carries the `appLock` setting, so that state is
  reachable, and a new key there would orphan every stored secret.
- **Cookies are no longer a field of `DataBoxAccount`.** Controllers read the cookie from the vault next
  to the password, at call time. Keeping an always-null field would have let a call site keep passing
  `account.sessionCookie` and compile, while every SMS box reported an expired sign-in - the exact
  failure 018 made a compile error for the cookie jar.

**As built (2026-09-15).** The design above shipped. These are the parts it did not spell out, and the
places the build had to go further:

- **Where the calls read.** `credentialsFor` (`secureStore.ts`) is the one door: `MessagesController`
  and `SendController` call it for every ISDS call, the VoDZ send (`sendBigMessage`) and the signed
  downloads included. A secret that is `absent` or `lost` becomes null, which the transport already
  answers as an auth fault; one that is `unavailable` throws `CredentialsUnavailableError`, mapped to
  `messages.error.credentials` / `send.error.credentials`. `classifyFailure` counts that key as
  transient, and the mapping runs before the abort check: a read abandoned behind the lock screen has
  an aborted signal too, and the abort's key would read as a lost session for a cookie box.
- **The stores.** `AccountsStore.setSessionCookie` is gone; `SqliteAccountsStore` gained
  `legacySessionCookies` and `clearLegacySessionCookie` (writes NULL only) for the move.
  `AccountsController` saves the session with `saveSession` beside `savePassword`, rolls both back
  when either fails, and `removeAccount` ends in `deleteBox`. `getPassword` had no caller and went.
- **Launch.** `App.tsx` starts `VaultSecureStore.prepare()` once and mounts `VaultLostNotice` inside
  the lock gate. Every read waits for the migration too, and gives up on it as `unavailable` when its
  signal aborts, so a read abandoned while the migration waits for the unlock is not left hanging.
- **Found while wiring:** an unlock whose prompt was still out when the app went to the background
  kept the key it then read, behind a lock screen that was up again. `Vault.lock` now counts, and an
  unlock that sees a newer count keeps nothing (`failed`; the lock screen asks again on return).
  *Review 2026-09-15:* the lock screen must not feed that count from its own prompt. On Android 10 and
  older the passcode screen behind "Use PIN" is a separate activity, React Native reports the app as
  backgrounded while it is up, and every passcode unlock came back `failed`. `LockGate` now holds its
  `lock()` while an unlock is out; an unlock that finished in the background stands only if the app is
  back in the foreground within `UNLOCK_RETURN_MS` (1.5 s), and otherwise the key is dropped. A
  background during the reveal after an unlock cancels the reveal, and a lock that will not switch off
  says so in Settings.
- **Found in the migration:** a plain copy left by a failed run, followed by a password save killed
  before it removed that copy, restored the OLD password on the next launch. The copy now wins only
  over a seal that does not open at all. And a launch whose migration could not even get the key read
  every cookie box as having no session; until the table's cookies have been listed, a session read
  still consults the column.
- **Outside the vault, as before:** the database key; ~~the native cookie jar, which 018 uses only
  around a login but which is not emptied after the session is captured; and the VoDZ attachment
  download, which for a cookie box still rides that jar (018 T015) and takes only a password from the
  vault.~~ *Amended 2026-09-15:* the VoDZ downloads carry the box's session from the vault with the jar
  kept out (018 T015), and every login empties the jar again when it ends, so it holds no session
  between logins (T028 edge cases, 018 T007).

## Complexity Tracking

> No constitution violations — section intentionally empty.
