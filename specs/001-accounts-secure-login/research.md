# Phase 0 Research: Accounts & Secure Login

All NEEDS CLARIFICATION from Technical Context resolved below. Sources: ISDS operator info pages,
the ISDS Operational Rules / access-interface docs, and the open-source `libdatovka` (cz.nic, GPLv3 —
**reference only, not linked**) which encodes the exact login URL construction.

## R1. ISDS access points & hosts

- **Decision**: Talk to ISDS access points directly over HTTPS. Hosts:
  - **Test (czebox)**: `https://ws1.datovka-test.gov.cz` (formerly `ws1.czebox.cz`) — used for ALL development/acceptance (Principle VII).
  - **Production**: `https://ws1.datovka.gov.cz` (formerly `ws1.mojedatovaschranka.cz`) — chosen per box; never in dev.
  - The SOAP message service used to verify a login is the dmOperations endpoint at path **`/DS/dz`**
    (e.g. `https://ws1.datovka-test.gov.cz/DS/dz`).
- **Rationale**: Confirmed by ISDS docs (basic-auth example `https://ws1.mojedatovaschranka.cz/DS/dz`)
  and libdatovka. czebox mirrors prod with the same path scheme.
- **Alternatives**: A backend proxy — rejected by constitution (Principle III, on-device only).

> **The operator's domains changed in 2026** — test `czebox.cz` → `datovka-test.gov.cz`, production
> `mojedatovaschranka.cz` → `datovka.gov.cz`. The live validation below was recorded on the old test
> domain in June 2026. `src/services/isds/endpoints.ts` records what was re-verified on the new names
> (DNS, TLS, path-by-path HTTP parity) and what was not (an authenticated round-trip).

## R2. Username + password authentication

- **Decision**: Send **HTTP Basic** auth (`login` + `password`) directly on SOAP calls to `/DS/dz`.
  Verify the credential by issuing one lightweight authenticated operation (see R5) and treating a
  SOAP success as "signed in". Persist the resulting session **cookie** for subsequent calls.
- **Rationale**: libdatovka stores the base URL and uses `DS/dz` with Basic auth for standard logins;
  ISDS maintains the session via HTTP cookies.
- **Alternatives**: Pre-flight "login" RPC — not required for the basic method (Basic auth is per-call;
  a cookie is established on first authenticated call).

## R3. Username + password + SMS code authentication (TOTP)

- **Decision**: Use the hosted login endpoint `…/as/processLogin` to obtain a session, then call
  `/DS/dz` with the resulting cookie:
  - **TOTP** (SMS premium code), on the portal host rather than `ws1` (see below):
    1. First call `…/as/processLogin?type=totp&sendSms=true&uri=…/apps/` with login+password →
       ISDS sends the SMS and returns a **partial-success** (libdatovka: `IE_PARTIAL_SUCCESS`).
    2. User enters the received SMS code; second call `…/as/processLogin?type=totp&uri=…/apps/`
       with login+password+code completes login and yields the session cookie.
- **Rationale**: Exact pattern from libdatovka's OTP login URL construction and two-phase TOTP flow.
- **Alternatives considered**: Treating OTP like Basic auth — wrong; OTP requires the `as/processLogin`
  token exchange. Implementing our own TOTP — wrong; the code is delivered/managed by ISDS, the app
  only forwards what the user receives/generates.
- **Critical reliability note (Principle II)**: the incumbent crashes exactly here. The partial-success
  return, an expired/invalid code, a missing SMS, and backgrounding mid-flow MUST all be explicit,
  recoverable states in the login state machine — never an unhandled path.

## R4. Session & cookie handling

- **Decision**: Maintain the ISDS session cookie with the native cookie store
  (`@react-native-cookies/cookies` if `fetch`'s implicit cookie handling proves insufficient across
  the `as/processLogin`→`DS/dz` hop). Treat the session as transient; on `401`/SOAP auth fault,
  drop to the re-auth flow (US5) scoped to that box.
- **Rationale**: libdatovka relies on CURL's cookie jar; RN's native networking has an equivalent
  cookie store. Sessions expire, so detection + scoped re-auth is required, not optional.
- **Alternatives**: Manual `Set-Cookie` parsing — fallback only if native cookie persistence misbehaves.

> **Superseded by 018.** The jar only captures a login's cookie. Each box's session is stored on its accounts
> row and replayed with `useJar: false` (`credentials: 'omit'`); password boxes hold no session and send
> HTTP Basic on every call. ~~The one exception is the VoDZ attachment download
> (`vodzAttachmentDownloader.ts`), which still rides the jar (018 T015, open).~~ *Amended 2026-09-15:*
> no exception is left - the VoDZ downloads keep the jar out too (`omitCookies`, 018 T015) - and the
> sessions moved from the accounts row into the vault (T028). The jar is also emptied again once the
> password login, the code or the Mobile Key confirmation is over (T028, 018 T007).

## R5. Verifying a login (which operation to call)

- **Decision**: After auth, issue a small authenticated operation to confirm success and fetch box
  identity/label: **`GetOwnerInfoFromLogin`** (owner/box info) and/or **`GetPasswordInfo`** (password
  expiry). Use the box id/name returned to label the account; use password-expiry to power US5.
- **Rationale**: These are lightweight, read-only, and exist on the authenticated services; password
  expiry info directly supports the forced-password-change scenario. Password-only accounts expire
  (~90 days); OTP/cert accounts do not — useful UX signal.
- **Alternatives**: `GetListOfReceivedMessages` — heavier; reserve for feature 002/003.

## R6. Secure secret storage + biometric lock (US2)

- **Decision**: Store each box's password (and any long-lived token) with **`react-native-keychain`**
  using biometric access control (iOS `kSecAccessControlBiometryCurrentSet` / Android
  `setUserAuthenticationRequired`), one keychain entry per box. App-open requires a successful
  biometric (or device-passcode/app-PIN fallback) to retrieve secrets — the lock and the secret
  gate are the same mechanism, so content is structurally unreachable before unlock.
- **Rationale**: Satisfies Principles II/III with platform-native security; avoids a separate
  app-PIN store for the happy path. Fallback PIN covers no-biometric-hardware devices.
- **Alternatives**: Encrypted-DB-stored secrets — rejected (secrets must be in the secure enclave).
  `expo-local-authentication` — N/A (bare CLI).

> ~~**Not built.** Box passwords are stored `WHEN_UNLOCKED_THIS_DEVICE_ONLY` without biometric access
> control; the app lock (KeychainAppLock) gates the UI, not the secret.~~ *2026-09-14:* replaced by the
> vault key below (R6b, T028). The decision above - one biometric-gated entry per box - was not what got
> built, and R6b explains why it should not be: it prompts on every read.

## R6b. The vault key (T028, 2026-09-14)

**Problem.** The app lock is opt-in (off by default, an owner decision). While it is on, a box password
and a box session cookie must be unreadable while the app is locked - the lock has to gate the secret,
not only the screen - and normal use must not gain a single prompt. Gating each Keychain item behind
biometrics (R6 as first written) cannot meet the second half: every password-box WS call reads the
password, every cookie-box call reads the cookie, and each read would be a prompt. That is why R6 was
never built and why 018 put cookies in the database.

**Decision: one key gates everything, and unlocking the app is reading that key.**

- One random 256-bit **vault key K** (`crypto.getRandomValues`). Box passwords and session cookies are
  sealed under K with **XChaCha20-Poly1305** from `@noble/ciphers` (already shipped for the backup
  envelope; pure JS, microseconds for a secret this small, so Principle I is untouched). Random 24-byte
  nonce per seal. The sealed text is versioned (`obalka-vault-1:` + hex of key id ‖ nonce ‖ ciphertext);
  the key id is the first 8 bytes of HMAC-SHA-256(K, fixed label), so "sealed under a key this phone no
  longer has" is told apart from "damaged". The AEAD's associated data names the kind and the box
  (`password`/`session` + boxId), so a sealed value cannot be moved into another box's or another
  kind's slot and still open.
- Each sealed secret is **its own Keychain item per box**: passwords keep `cz.obalka.box.<boxId>`,
  cookies get `cz.obalka.session.<boxId>`. Both are `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, no access control:
  what protects them is K.
- **Where K lives follows the lock setting.** Lock off: `cz.obalka.vault.key`,
  `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, no access control - the same exposure passwords have today. Lock on:
  `cz.obalka.vault.key.gated`, behind `BIOMETRY_ANY_OR_DEVICE_PASSCODE`. Toggling moves **K only**; no
  sealed secret is ever re-encrypted.
- **K is in memory only while unlocked.** Unlocking the app reads the gated K (the one prompt users
  already get) and replaces the old placeholder token (`cz.obalka.applock`, deleted on the way). Going
  to the background drops K from memory (the buffer is zeroed; each operation works on its own copy, so
  an operation already holding a key or a decrypted secret finishes).
- **A read while locked waits for the unlock.** It never answers "no password", so it can never send a
  box to re-authentication or mark it signed out. Every ISDS call path reads a password or a cookie
  first, so the launch refresh, the inbox's own refresh, credit, mark-as-read and sending all wait behind
  the lock overlay instead of starting under it. A read that is aborted while waiting, or a Keychain
  that errors, is `unavailable` - a transient error, never re-auth.

**Prompts.** Unlock: one (the gated read). Enabling the lock: one - on Android the gated WRITE asks
(the Keystore key requires authentication), and the read-back that verifies it falls inside the key's
5-second authentication window; on iOS the write is silent and the read-back asks. Disabling: none (K is
already in memory). Refreshes, sends, re-auth saves: none.

**Never a second key.** A new K is generated only when no K item exists at all, or when the existing
one is proven permanently unreadable: Android's `KeyPermanentlyInvalidatedException` / a failed
authentication tag (the library reports both as `E_CRYPTO_FAILED` with those words), or a malformed
stored value. A cancelled or failed prompt, a Keychain error, or a device that cannot show a prompt right
now never generates a key. Generation is serialised, so two first reads cannot race to two keys, and a
fresh K is written and read back before anything is sealed under it.

**When K is genuinely gone** (the OS invalidates or deletes a gated item when the screen lock is removed):
the lock screen says to set a screen lock if the phone has none (it cannot gate without one - no bypass),
and once it has one the unlock creates a new K behind the gate. The archive is untouched (the database
key is a separate item). Each sealed secret then fails its key-id check, reads as `lost`, and its box
goes to re-authentication as any refused box does; the first `lost` read of the session also shows a
dialog saying, in plain Czech or English, that the phone invalidated the key and each box needs signing
in again.

**State reconciled from the setting.** The `appLock` setting is the truth and K's placement is brought
to it: lock on but K in the plain item (the upgrade from a pre-vault lock, or a restored setting) - the
unlock moves it behind the gate; lock off but K only in the gated item (a backup restore carries the
`appLock` setting, or an interrupted toggle) - the vault asks for one unlock through the lock screen and
moves it back. Toggles write the new placement and read it back, persist the setting, and only then
delete the old placement, so a crash at any point leaves a K the next launch can read.

**Migration** (first launch after the update; idempotent, resumable). Runs before any secret is read or
written, and needs K, so with the lock on it runs after the unlock. Per box: a plain password (`{"password"}`
JSON in `cz.obalka.box.<boxId>`) is first copied to `cz.obalka.box.<boxId>.plain`, the sealed value is
written over the main item and read back and opened, and only then is the plain copy deleted; a crash in
between is finished on the next launch from whichever copy is intact. A database cookie is sealed into its
item, read back and opened, and only then is its column cleared. The `sessionCookie` column stays in the
schema (a shipped migration is never edited) but ends up NULL and nothing writes it again. A read that
meets a not-yet-migrated plain password or column value still uses it, so a migration that failed for one
box degrades to today's exposure rather than to a signed-out box.

**Removal.** Removing a box deletes both of its items (and any plain copy a migration left). Removing the
LAST box deletes K itself - both placements - and switches the lock off: no sealed secret remains for it
to open, a phone with no boxes is how it is handed to someone else, and the next box starts a fresh K in
the plain item. With no box at all at launch (an iOS reinstall keeps Keychain items but not the
database) and the lock off, stale K items are discarded the same way.

**Backups and transfer** carry no secret, as before: the snapshot copies named account fields only.
Neither K nor any sealed item is in a backup.

**Alternatives considered.**
- *A biometric-gated item per secret* (R6 as written) - a prompt per WS call. Rejected.
- *AES-GCM instead of XChaCha20-Poly1305* - equivalent here; XChaCha is what the backup envelope already
  uses and its 24-byte random nonce needs no counter.
- *Cookies stay in SQLCipher* (018's choice) - the database key is ungated, so a cookie there stays
  readable while locked. Rejected by the requirement.
- *Keep K on the last-box removal* - it would protect nothing and outlive the owner's boxes. Rejected.

**Limits, stated.** JavaScript cannot guarantee a string is wiped: a decrypted password lives in a JS
string for the duration of one call, and the zeroed buffer is K's, not the secret's. With the lock off,
K is exactly as readable as passwords were before (whenever the phone is unlocked) - the owner's opt-in
decision, not a gap this closes. The gated item's behaviour when the screen lock is removed or biometrics
re-enrolled is the platforms' and has to be walked on devices.

**As built (2026-09-15).** Built as decided above, with four refinements the build found: a read that
cannot happen right now reaches the screen as `messages.error.credentials` / `send.error.credentials`
and is never classified as re-auth, even when its signal was aborted; an unlock whose prompt was still
out when the app locked keeps no key; a plain password copy is restored only over a seal that does not
open, never over a newer one; and until a launch has listed the table's cookies, a session read still
consults the column. The dialog for a lost key is `VaultLostNotice`, shown once per launch until
acknowledged. Its copy names the screen lock "for example", because whether a biometric change
invalidates a `BIOMETRY_ANY_OR_DEVICE_PASSCODE` item differs by platform and has not been observed
here. Evidence and test names: tasks.md T028.

*Review 2026-09-15.* "Going to the background drops K" needed one exception. The OS's own passcode
screen is a separate activity on Android 10 and older, so reaching it backgrounds the app, and a lock
taken then voided the very unlock the user was completing - a passcode could never open the app there.
The lock screen now holds the lock while its unlock is out and decides by the return: an unlock that
finished in the background keeps K only if the app is in the foreground again within 1.5 s, which the
passcode screen's own return always is and a user who really left is not. A background during the short
reveal after an unlock cancels the reveal, so the app is never shown without K behind it.

## R7. SOAP/XML on device, off the UI thread (Principle I)

- **Decision**: Hand-build SOAP 1.1 envelopes (small, fixed shape) and parse responses with
  **`fast-xml-parser`** (pure JS). Network I/O uses native `fetch` (already off the JS thread). Auth
  responses are tiny, so JS parsing is cheap and safe on the JS thread for this feature. Encapsulate
  everything in `services/isds` so that large-payload parsing (messages, in 002/003) can be relocated
  to a JSI/native module or a worklet without touching callers.
- **Rationale**: No maintained RN SOAP stack exists; envelopes here are simple. Isolation keeps the
  UI-thread guarantee enforceable as payloads grow.
- **Alternatives**: A SOAP library (`soap`, `strong-soap`) — Node-oriented, heavy, poor RN fit.

## R7b. Schema-driven wire models (XSD → TypeScript codegen)

- **Decision**: The ISDS **wire models are generated from the official v20 XSD**, not hand-written.
  The schemas are vendored at `src/services/isds/schema/v20/` (2 XSD + 5 WSDL) and a bespoke,
  dependency-free generator (`scripts/codegen-isds.mjs`, `npm run codegen:isds`) emits plain
  TypeScript into `src/services/isds/generated/isdsTypes.ts` (313 types: `tDbOwnerInfo`, `tFile`,
  `tHash`, `dmStatus`, message envelopes, …). The lean APP models in `types.ts` (e.g. `OwnerInfo`)
  are deliberate projections; the transport maps wire → app.
- **Rationale**: Faithful, complete, and drift-proof against the operator contract — essential for the
  rich message structures in features 002/003/005. A bespoke generator keeps the constitution's
  "lightweight, no heavy runtime" promise (no `node-soap`/cxml runtime); we only ship plain types.
- **Alternatives considered**: hand-modeling per feature (drifts, error-prone — rejected); a full
  `node-soap`/`wsdl-tsclient` SOAP client (Node-oriented runtime, poor RN fit — rejected, see plan).

## R8. Local metadata store

- **Decision**: **`op-sqlite`** (JSI, fast, SQLCipher-capable) for an `accounts` table of non-secret
  metadata (box id, label, auth method, last session validity, lock settings). Encrypt at rest.
- **Rationale**: Aligns with the constitution's encrypted-SQLite direction and is reused by later
  features (messages/archive). Secrets stay in Keychain, referenced by box id.
- **Alternatives**: WatermelonDB — reserve evaluation for the reactive message list (002/004); overkill here.

## R9. Federated login (NIA / BankID / mojeID / Mobile-Key)

- **Decision**: **Not implemented.** Detect when a user wants it and show a clear "not available in
  this app" explanation pointing to supported methods (Principle VI).
- **Rationale**: ISDS does not expose federated login to third-party apps via the public web services;
  it is portal-SSO only and would require DIA identity-provider registration. Confirmed by operator
  docs and the incumbent's identical limitation.
- **Alternatives**: DIA provider registration — deferred research spike, out of scope for v1.

> **Superseded for Mobile Key.** Mobilní klíč IS available to third-party apps
> (`as/processLogin?type=mep-ws`) and is implemented — see `docs/isds-mobile-key/` and
> `IsdsAuthService.mobileKeyLogin`. NIA / BankID / mojeID remain portal-only.

## Validated against a real czebox test box (2026-06-12)

Live calls against `https://ws1.czebox.cz` with a password-only test box confirmed:

- **Access points matter** (from the WSDL `soap:address`): db_access ops `GetOwnerInfoFromLogin` /
  `GetPasswordInfo` live at **`/DS/DsManage`**, NOT `/DS/dz`. `/DS/dz` is dmOperations (messages,
  features 002/003); calling GetOwnerInfoFromLogin there returns `dmStatusCode 2006 "Unknown
  operation"`. Other access points: dm_info `/DS/dx`, db_search (FindDataBox) `/DS/df`. **The code was
  corrected** (`dsManageUrl`).
- **Success shape**: HTTP 200, `GetOwnerInfoFromLoginResponse → dbOwnerInfo + dbStatus`, with
  `dbStatusCode = "0000"` ("Provedeno úspěšně."). Empty fields come as `xsi:nil` empty elements
  (e.g. `firmName`), which our parser reads as `""` → `toOwnerInfo` falls back to the person name.
  Our exact parser config (`removeNSPrefix`, `parseTagValue:false`) parses the real response correctly.
- **Wrong password → HTTP 401** (`WWW-Authenticate: Basic realm="ISDS - DS"`) → `authFault`. ✓
- **`GetPasswordInfo`** returns `pswExpDate` as ISO-8601 with offset (`2026-09-10T08:30:50.000+02:00`);
  `Date.parse` handles it → `readPasswordExpiry` correct. ✓ db status element here is `dbStatus`.
- The **password** path is therefore production-faithful and validated.

## OTP (TOTP/SMS) — validated end-to-end against a real OTP-enabled czebox box (2026-06-12)

The OTP login does NOT use `ws1` — it goes through the **portal host** (`www.czebox.cz` test /
`www.mojedatovaschranka.cz` prod) via `as/processLogin`, then runs SOAP under `/apps/`:

1. **TOTP step 1 (send SMS)**: `POST {portal}/as/processLogin?type=totp&sendSms=true&uri={portal}/apps/DS/dz`
   with HTTP Basic (login, password) and a SOAP **`DummyOperation`** body → **HTTP 302** with header
   **`X-Response-message-code: authentication.info.totpSended`** (text "Jednorázový kód odeslán.").
2. **TOTP step 2 (submit code)**: `POST {portal}/as/processLogin?type=totp&uri={portal}/apps/DS/dz`
   where the **one-time code is APPENDED to the password** in HTTP Basic (`password+code`, no
   separator — per libdatovka `_isds_store_credentials`), DummyOperation body → **HTTP 302**,
   `Location: {portal}/apps/DS/dz`, and **`Set-Cookie: IPCZ-X-COOKIE=…; Domain=.czebox.cz`**.
3. **WS calls**: subsequent SOAP (e.g. `GetOwnerInfoFromLogin`) go to **`{portal}/apps/DS/DsManage`**
   carrying that session cookie (no Basic header) → HTTP 200, `dbStatusCode 0000`. Confirmed.

Implementation notes: with OTP enabled, plain Basic on `ws1/DS/DsManage` returns 401 — the OTP method
is required. RN `fetch` must use `credentials: 'include'` so the native cookie store carries the
session (`@react-native-cookies/cookies` may be needed on-device). We detect a wrong/expired code by
the follow-up owner-info call failing (→ `otpFault`) rather than parsing the 302 (RN can't reliably
read manual-redirect headers). `cert.czebox.cz` (system-certificate host) is unreachable from CI.

> **Superseded by 018.** The jar only captures a login's cookie. Each box's session is stored on its accounts
> row and replayed with `useJar: false` (`credentials: 'omit'`); password boxes hold no session and send
> HTTP Basic on every call. ~~The one exception is the VoDZ attachment download
> (`vodzAttachmentDownloader.ts`), which still rides the jar (018 T015, open).~~ *Amended 2026-09-15:*
> no exception is left - the VoDZ downloads keep the jar out too (`omitCookies`, 018 T015) - and the
> sessions moved from the accounts row into the vault (T028). The jar is also emptied again once the
> password login, the code or the Mobile Key confirmation is over (T028, 018 T007).

## Remaining open item

- The `dbStatusCode` for a forced password change is still unmapped; it falls to `serverFault`
  (`isdsTransport.ts` `interpretOwnerInfo`). Expired sessions are handled since 018 and its 2026-08-19
  amendment (`sessionLost`: 401/403, or for cookie boxes an HTTP 200 carrying no XML at all).
  *2026-09-14:* still unmapped at the transport. What ISDS returns for an EXPIRED password - a `401` like
  the wrong password above, or a status code - has not been captured. The app now assumes the `401` and
  infers the expiry from the stored `pswExpDate` (FR-009 note in `spec.md`).
