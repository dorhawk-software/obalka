# Contract: AuthService (internal)

> **As built.** `AuthMethod` adds `mobile_key`, with `IsdsAuthService.mobileKeyLogin()`. `signedIn` returns
> `ownerInfo` + `sessionCookie`. ~~`SecureStore.getSecret` returns `BoxSecret | null` and never prompts.
> `AppLock` is `isAvailable/arm/disarm/authenticate` over a `BIOMETRY_ANY_OR_DEVICE_PASSCODE` item.~~
> *Since 2026-09-15 (T028):* `SecureStore` is `savePassword/readPassword/saveSession/readSession/deleteBox`,
> each read answering `found`, `absent`, `lost` or `unavailable` and waiting while the app is locked; it
> never prompts. `AppLock` is the `Vault` - `isAvailable/enable/disable/unlock/lock/forget` - whose gated
> `BIOMETRY_ANY_OR_DEVICE_PASSCODE` item holds the vault key (see the note under the interface below).
> `AccountsStore.remove` drops only the row; `AccountsController.removeAccount` purges the secret. `host`
> is chosen per box on the add-box form (default production).

The app-internal interface the login UI depends on. Keeps ISDS/SOAP details out of screens and makes
the login state machine unit-testable with a mock transport (Principle II testability).

```ts
type AuthMethod = 'password' | 'otp_totp' | 'mobile_key';

type LoginOutcome =
  | { kind: 'signedIn'; account: DataBoxAccount }
  | { kind: 'needsOtpSms' }                 // TOTP: SMS sent, awaiting code
  | { kind: 'error'; code: LoginErrorCode; recoverable: true; messageKey: string };

type LoginErrorCode =
  | 'invalidCredentials' | 'invalidOrExpiredOtp' | 'smsNotDelivered'
  | 'passwordChangeRequired' | 'network' | 'timeout' | 'serverFault' | 'cancelled';

interface AuthService {
  // Begin login. For the SMS code returns needsOtpSms; for password may
  // return signedIn directly. NEVER throws — all failures are LoginOutcome.error.
  beginLogin(input: { loginName: string; password: string; method: AuthMethod;
                      signal: AbortSignal; host: 'czebox' | 'production' }): Promise<LoginOutcome>;

  // Submit an OTP code after needsOtp*. NEVER throws.
  submitOtp(code: string, signal: AbortSignal): Promise<LoginOutcome>;

  // Re-request a TOTP SMS. NEVER throws.
  resendSms(signal: AbortSignal): Promise<LoginOutcome>;

  // Re-authenticate an existing box whose session expired (US5), scoped to one box.
  reauthenticate(boxId: string, password: string, otp: string | null,
                 signal: AbortSignal): Promise<LoginOutcome>;
}

interface AccountsStore {           // encrypted SQLite metadata
  list(): Promise<DataBoxAccount[]>;
  add(account: DataBoxAccount): Promise<void>;       // rejects duplicate boxId
  remove(boxId: string): Promise<void>;              // also purges Keychain secret
  setActive(boxId: string): Promise<void>;           // switch in ≤2 taps (SC-005)
}

interface SecureStore {             // react-native-keychain wrapper, biometric-gated
  saveSecret(boxId: string, secret: { password: string }): Promise<void>;
  getSecret(boxId: string): Promise<{ password: string }>;   // triggers biometric/PIN unlock
  deleteSecret(boxId: string): Promise<void>;
  isBiometricAvailable(): Promise<boolean>;
}

interface AppLock {                 // app-open gate (US2)
  ensureUnlocked(): Promise<void>;  // biometric → PIN fallback; rejects until unlocked
  isLockConfigured(): Promise<boolean>;
}
```

**Contract guarantees**
- `beginLogin`/`submitOtp`/`resendSms`/`reauthenticate` **never reject** — every outcome is a typed
  `LoginOutcome` (enforces SC-002 "zero crashes"; the final OTP submit cannot throw).
- All four accept an `AbortSignal` so the UI can cancel without blocking (Principle I, SC-004).
- `SecureStore.getSecret` is the only path to a password and always requires unlock (Principle III).
  *As built:* it is the only path, but it does not require unlock — the entry is
  `WHEN_UNLOCKED_THIS_DEVICE_ONLY`; the app lock gates the UI, not this read.
  *Since 2026-09-15 (T028):* `SecureStore` is `savePassword` / `readPassword` / `saveSession` /
  `readSession` / `deleteBox`; a read answers `found`, `absent`, `lost` or `unavailable`, and with the
  app lock on it waits for the unlock, because the key it needs is behind the gate. `AppLock` is
  `enable` / `disable` / `unlock` / `lock` / `forget` (`src/services/appLock/appLock.ts`).
- `AccountsStore.remove` MUST purge the Keychain secret (US4) — no orphaned secrets. *As built:* the
  purge happens in `AccountsController.removeAccount`, which drops the row and then the secret.
- `host` is chosen per box on the add-box form (`account.host`, default `production`; a test box is added
  under Pokročilé → Testovací). There is no build- or release-level host switch.
