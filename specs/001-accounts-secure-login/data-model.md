# Phase 1 Data Model: Accounts & Secure Login

> **As built.** The app-lock fields below (`lockEnabled`, `biometricEnabled`, `pinFallbackSet`,
> `lockGraceSeconds`) describe the plan. The lock shipped on the OS keychain — biometrics with the device
> passcode as the fallback, and no app-specific PIN (tasks T027). Sessions were stored per box on the account
> row (018) rather than in memory; since 2026-09-15 they are sealed Keychain items beside the password
> (T028), and the row holds none. `authMethod` also takes `mobile_key` (Mobilní klíč). Removing the last box resets the lock: disarmed and switched off (T037, since
> 2026-09-14).
> [`docs/accounts.md`](../../docs/accounts.md) describes the model as built.

> **Update (feature 002):** the `accounts` table has since gained `alias`, `host`, `lastSyncedAt`,
> `messageCount`, `unreadCount`, `syncError` columns, and the schema is now managed by a versioned
> **migration runner** (`src/services/db/migrations.ts`) rather than ad-hoc ALTERs. See
> `specs/002-messages-and-resilience/data-model.md` for the current schema + the migration framework.
> The design-system / typography / accessibility tokens live in `docs/ui-guide.md` (feature 007).

Two stores, by sensitivity (Principle III):
- **Secure enclave** (Keychain/Keystore): the actual secrets. *As built (T028, 2026-09-15):* two
  items per box - password and session cookie - each holding a seal under one vault key, device-only
  (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`) with no access control of their own; the vault key is what sits
  behind the biometric gate while the app lock is on.
- **Encrypted SQLite** (`op-sqlite`): non-secret account metadata + lock settings.

No message data in this feature.

## Entity: DataBoxAccount  *(SQLite `accounts`)*

| Field | Type | Notes |
|-------|------|-------|
| `id` | text (PK) | Stable local id (UUID). |
| `boxId` | text | ISDS data-box ID returned by `GetOwnerInfoFromLogin`. Unique. |
| `loginName` | text | ISDS login name (username). Non-secret; the password is NOT stored here. |
| `label` | text | User-visible name (defaults to box owner/name; editable). |
| `authMethod` | enum | `password` \| `otp_totp` \| `mobile_key`. |
| `secretRef` | text | Keychain service/key reference for this box's secret (no secret value here). |
| `sessionValidUntil` | int (epoch, nullable) | Last known session validity; null = must re-auth. |
| `passwordExpiresAt` | int (epoch, nullable) | From `GetPasswordInfo`; powers expiry warnings (US5). |
| `createdAt` / `updatedAt` | int (epoch) | Audit. |

**Validation**: `boxId` unique (duplicate-add detection, edge case); `authMethod` required;
`secretRef` must resolve to a Keychain entry or the account is considered broken → re-auth.

**Relationships**: 1 DataBoxAccount ↔ 1 CredentialSecret (by `secretRef`); 0..1 active AuthSession (in-memory).

## Entity: CredentialSecret  *(Keychain/Keystore — never SQLite/logs)*

| Field | Type | Notes |
|-------|------|-------|
| `password` | secret string | Box password. Keychain item `cz.obalka.box.<boxId>`, sealed under the vault key (T028). |
| `sessionCookie` | secret string (nullable) | The box's own ISDS session (018). Keychain item `cz.obalka.session.<boxId>`, sealed under the vault key (T028); not in SQLite since 2026-09-15. |

**Access rule**: ~~readable whenever the device is unlocked; the app lock gates the UI, not this read.~~
*Since 2026-09-15 (T028):* readable only with the vault key. With the lock off that key is readable
whenever the device is unlocked; with it on, only while the app is unlocked - a read while locked waits
for the unlock and never answers "no secret".
Deleted when the box is removed (US4) — purge is mandatory.

## Entity: AuthSession  *(in-memory, transient)*

| Field | Type | Notes |
|-------|------|-------|
| `boxId` | text | Owning account. |
| `cookie` | secret string | ISDS session cookie (from Basic call or `as/processLogin`). In-memory only. |
| `establishedAt` | int (epoch) | For TTL heuristics. |
| `state` | enum | See login state machine below. |

Never persisted to disk; rebuilt from the stored secret on demand.

## Entity: AppLockSetting  *(SQLite `app_settings`, single row)*

| Field | Type | Notes |
|-------|------|-------|
| `lockEnabled` | bool | Always true once any account exists. |
| `biometricEnabled` | bool | Whether biometric is available/chosen. |
| `pinFallbackSet` | bool | Whether an app-PIN fallback exists (required if no biometric). |
| `lockGraceSeconds` | int | Re-lock delay after backgrounding (default 0 = immediate). |

## Login state machine (drives US1/US3, enforces Principle II)

```
idle
 └─(add box: enter login+password)→ authenticating
      ├─ success(password) ───────────────→ verifying ──→ signedIn
      ├─ needsOtpSms (TOTP partial success)→ awaitingSmsCode ─(submit code)→ authenticating
      ├─ invalidCredentials ──────────────→ error(recoverable) ─(retry)→ authenticating
      ├─ invalidOrExpiredOtp ─────────────→ error(recoverable) ─(retry/re-send)→ awaiting…
      ├─ passwordChangeRequired ──────────→ error(guided)      ─(resolve)→ authenticating
      ├─ network/timeout ─────────────────→ error(recoverable) ─(retry)→ authenticating
      └─ cancelled ───────────────────────→ idle
 signedIn ─(session invalid later)→ reauthRequired(scoped to box) ─(re-auth)→ authenticating
```

Every transition out of `authenticating`/`awaiting*` is explicit; there is **no** unhandled path,
so the final OTP submit cannot crash (SC-002). All `error(*)` states are localized and recoverable.

## State transitions of interest

- `awaitingSmsCode` on app background → on resume, remain in `awaitingSmsCode` (code still valid) or
  fail to `error(recoverable)` with a "request a new code" action — never crash.
- `removeAccount`: signedIn|any → deletes Keychain secret + `accounts` row → if last account, lock
  settings reset; otherwise other accounts untouched. *As built:* both of the box's Keychain items go,
  and removing the last box also deletes the vault key (T028).
