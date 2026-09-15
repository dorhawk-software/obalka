# Spike: Mobile Key (Mobilní klíč) login for Obálka

> **Historical — pre-implementation spike.** Mobile Key sign-in has since been built (`AuthMethod
> 'mobile_key'`, `IsdsAuthService.mobileKeyLogin`, `IsdsHttpTransport.mepBegin/mepPoll/mepConfirm`,
> state `awaitingMobileKey`). Since 018, sessions are captured per box and replayed with `useJar: false`
> rather than living in the native jar. The constitution has been corrected. 'Implementation sketch',
> 'Open items' and 'Recommendation' record the state before building.

**Question:** the project assumed ISDS exposes *no* federated/passwordless login to third-party apps,
so we deferred it. The 2025-12 developer bulletin + the Provozní řád say otherwise. Is **Mobile Key**
sign-in feasible for us, and what does it take?

**Verdict: YES - highly feasible.** The flow is a near-superset of the OTP login we already ship, on
the same portal endpoints and the same `IPCZ-X-COOKIE` session. The blocker is not technical, it's
**test access** (a Mobile-Key-activated account; uncertain whether czebox supports MK at all).

Sources: [`MobilniKlic_autentizace.md`](MobilniKlic_autentizace.md) (spec v1.3),
[`../isds-ws-news/2228_Info_pro_vyvojare_2025_12.md`](../isds-ws-news/2228_Info_pro_vyvojare_2025_12.md),
Provozní řád ISDS §5 (3rd-party login). The Provozní řád is explicit: *"Přihlášení pomocí Mobilního
klíče je možné … pomocí aplikačního rozhraní ISDS, pokud tuto možnost bude aplikace třetí strany
podporovat."* And: **HOTP will be dropped in future** - recommended MFA is now username/password/cert
**or Mobile Key**.

## The flow (ATS = third-party app)

Prereq (one-time, user does it on the portal): activate Mobile Key for the account
(*Nastavení → Možnosti přihlášení → Přihlášení mobilním klíčem*), then **generate a "komunikační
kód"** (communication code). That code is the app's stored secret (used in place of a password).

| # | Step | Call |
|---|---|---|
| 1 | **Init POST** - Basic auth `username:communicationCode` (b64). `applicationName` shows in the push. | `POST {host}/as/processLogin?type=mep-ws&applicationName=Obálka&uri={host}/apps/DS/{endpoint}` |
| 2 | **Response** 302 → `Set-Cookie: S-COOKIE=…` (working cookie). 401 = bad code. | → redirect to `/as/mepWsStateUpdate` |
| 3 | ISDS **pushes** the user's Mobile Key app (app name + box + user shown). | (out-of-band) |
| 4 | **Poll** with the S-COOKIE, ~1×/s, until confirmed. ≤ **240 s** to approve. | `GET {host}/as/mepWsStateUpdate2` (S-COOKIE) |
| 5 | **Confirm POST** - same Basic auth + the S-COOKIE. | `POST {host}/as/processLogin?type=mep-ws&…` |
| 6 | **Response** 302 → `Set-Cookie: IPCZ-X-COOKIE=…` (WS session, **30 min**). | - |
| 7 | Call WS with the IPCZ-X-COOKIE (exactly as today). | `{host}/apps/DS/{endpoint}` |
| 8 | Logout. | `GET {host}/as/processLogout?uri=…` |

`mepWsStateUpdate2` (Dec 2025+) returns JSON `{status, description}`:
`1` queued · `11` push sent · `12` shown (Android) · `13` Mobile Key launched (iOS) · `19` push failed
· **`2` confirmed** · `3` rejected/timed-out · `-1` unknown request. (The older `mepWsStateUpdate`
returns a bare `-1|1|2|3`.) Only `2` = signed in.

## Why it's low-risk for us - it reuses the OTP path

Our OTP login already does: `POST {portalHost}/as/processLogin?type=totp` (Basic `username:password+code`)
→ 302 + `IPCZ-X-COOKIE` → WS at `{portalHost}/apps/DS/{endpoint}` riding that cookie (in the native
OkHttp jar). Mobile Key is the **same machinery** with three deltas:

1. `type=mep-ws` (+ `applicationName`, `uri`) instead of `type=totp`.
2. Secret = the **communication code** (stable, stored like a password) instead of password+OTP.
3. A **poll loop** (S-COOKIE → `mepWsStateUpdate2` → confirm POST) instead of OTP's single round-trip.

Everything downstream (the `IPCZ-X-COOKIE`, `/apps/DS/*`, cookie-jar persistence, reauth on expiry)
is **unchanged**. The known RN-fetch caveat (Android OkHttp auto-follows 302 and hides intermediate
headers) needs care: we must read `Set-Cookie` for **S-COOKIE** and **IPCZ-X-COOKIE` off the redirect.
The OTP path already manages cookies via the native jar, so the same approach applies, but the
**two-cookie, two-POST** shape needs verifying on-device (we may need to *not* auto-follow, or read the
jar after each POST).

## Implementation sketch (a follow-up feature, not this spike)

- **Types:** add `AuthMethod` `'mobile_key'`; store the communication code in `KeychainSecureStore`
  like a password; `DataBoxAccount.authMethod = 'mobile_key'`.
- **Transport:** new `IsdsAuthService` path - `mepInit(username, code, host)` → S-COOKIE;
  `mepPoll(host)` → `{status, description}`; `mepConfirm(...)` → IPCZ-X-COOKIE. Reuse `appsDz/DsManage`
  URL helpers + the cookie jar. Pure-ish + unit-testable with a fake HTTP client (like the OTP tests).
- **Controller/state:** a `LoginOutcome` variant `needsMobileKeyApproval` driving a **waiting screen**
  that polls `mepWsStateUpdate2` and surfaces the live status text ("Push odeslán…", "Spuštěn Mobilní
  klíč…") - a delightful, honest progress UI; cancel/timeout at 240 s.
- **UI:** add-box method picker gains "Mobilní klíč"; a short helper explaining the one-time portal
  setup (activate MK + generate the communication code), with a deep link to the portal page.
- **Reauth:** the existing reauth flow extends naturally (re-run the mep handshake; the cookie expires
  in 30 min just like OTP).

Estimated effort: comparable to the OTP feature (which is done) - most of the cost is the waiting/poll
UX and the on-device cookie-shape verification, not new infrastructure.

## Open items / risks before building

1. **Test access (the real blocker):** we need an account with Mobile Key activated + a communication
   code, and the Mobile Key app pointed at the right environment. **Unclear whether czebox supports
   Mobile Key at all** (MK + its push infra are NIA/production). May force testing against a real
   production box - which collides with the "czebox-only in dev" rule. *Confirm czebox MK support
   first.*
2. **Cookie handling on RN/Android** - verify S-COOKIE then IPCZ-X-COOKIE are both captured across the
   two 302s (OkHttp jar vs. manual).
3. **Scope vs. v1** - this is a *new auth method*, sensibly a post-v1 feature (006-area) unless we
   promote it; it doesn't block the current 008 work.
4. HOTP deprecation (from the Provozní řád) is a separate, related cleanup: steer new boxes toward
   TOTP/Mobile Key, keep HOTP working while it lasts.

## Recommendation

Promote federated login from "impossible/deferred" to a **planned, feasible feature** (correct the
constitution/roadmap note). Before writing code, **confirm czebox Mobile Key support** (or accept a
one-off production test box for validation). Then implement the transport + waiting-UX as above - it's
a well-bounded extension of the OTP path, and a flagship UX win (approve a push instead of typing an
SMS code every login).
