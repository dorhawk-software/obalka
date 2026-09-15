# Contract: ISDS Authentication (external)

The external boundary this feature integrates with. **The test environment only during development**
(Principle VII): `ws1.datovka-test.gov.cz` and the portal host `www.datovka-test.gov.cz`. Production
(`ws1.datovka.gov.cz`, `www.datovka.gov.cz`) is chosen per box on the add-box form. The hosts live in
`src/services/isds/endpoints.ts`; the operator moved from `czebox.cz` / `mojedatovaschranka.cz` to these
`gov.cz` names in 2026.

> Exact SOAP namespaces/operation envelopes and fault shapes were validated against the test environment
> during implementation (see research.md). This contract fixes the access points, auth flows,
> and the typed outcomes the app must handle.

## Access points

| Purpose | Method | URL (test) |
|---------|--------|------------|
| db_access SOAP (`GetOwnerInfoFromLogin`, `GetPasswordInfo`) — password boxes | POST (SOAP 1.1) + HTTP Basic | `https://ws1.datovka-test.gov.cz/DS/DsManage` |
| dmOperations SOAP (message download and send) — password boxes | POST (SOAP 1.1) + HTTP Basic | `https://ws1.datovka-test.gov.cz/DS/dz` |
| OTP hosted login — TOTP (SMS), request code | POST | `https://www.datovka-test.gov.cz/as/processLogin?type=totp&sendSms=true&uri=https://www.datovka-test.gov.cz/apps/DS/dz` |
| OTP hosted login — TOTP (SMS), submit code | POST | `https://www.datovka-test.gov.cz/as/processLogin?type=totp&uri=https://www.datovka-test.gov.cz/apps/DS/dz` |
| Mobile Key login | POST | `https://www.datovka-test.gov.cz/as/processLogin?type=mep-ws&applicationName=Ob%C3%A1lka&uri=https://www.datovka-test.gov.cz/apps/DS/dz` ("Obálka", URL-encoded) |
| Mobile Key status poll | GET (portal session cookie) | `https://www.datovka-test.gov.cz/as/mepWsStateUpdate2` |
| SOAP after an OTP or Mobile Key login | POST (SOAP 1.1) + session cookie | `https://www.datovka-test.gov.cz/apps/DS/DsManage` (likewise `/apps/DS/dz`, `/apps/DS/dx`, `/apps/DS/df`) |

## Flow A — username + password

1. Issue an authenticated SOAP op (e.g. `GetOwnerInfoFromLogin`) to `/DS/DsManage` with HTTP Basic (login,password).
2. `200` + SOAP success → signed in; capture box info and the password-expiry date. Password boxes hold no
   session; HTTP Basic rides every call.
3. Outcomes: `invalidCredentials` (401/403), `network/timeout`, `serverFault`. The transport does not
   distinguish a forced password change: no response to one has been captured, so a non-OK `dbStatusCode`
   stays `serverFault`. *Since 2026-09-14 (FR-009):* `LoginController` reports a `401` on a password box
   whose stored password-expiry date has passed as `passwordChangeRequired` - an inference from the date,
   not an ISDS answer.

## Flow B — OTP (TOTP, SMS) — two phase

1. POST login+password to the `type=totp&sendSms=true` access point → **partial success** (ISDS sends SMS).
   Map to `needsOtpSms` (NOT an error).
2. User enters the SMS code. POST to the `type=totp` access point with the code appended to the password → session cookie.
3. Confirm via `/apps/DS/DsManage` with the session cookie to get box info. Outcomes: `invalidCredentials`,
   `invalidOrExpiredOtp`, `smsNotDelivered` (allow re-request), `network/timeout`, `serverFault`.

## Flow C — Mobile Key

A two-phase `type=mep-ws` login: init → push to the user's Mobile Key app → poll → confirm. It establishes the
same session cookie as OTP. The operator's specification is vendored in `docs/isds-mobile-key/`.

## Session

- Cookie boxes (OTP, Mobile Key) hold a session cookie set by `as/processLogin`; password boxes have none.
- Stored per box on the account row (018), so one box's login never rides another's session; on expiry (`401`/auth fault later) → app enters `reauthRequired` scoped to the box.

## Typed outcomes the app MUST handle (no others may crash)

`signedIn` · `needsOtpSms` · `invalidCredentials` · `invalidOrExpiredOtp` ·
`smsNotDelivered` · `passwordChangeRequired` · `network/timeout` · `serverFault` · `cancelled`.
