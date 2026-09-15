// ISDS access points (feature 001). Pure URL construction - unit-testable, no I/O.
// Hosts confirmed from libdatovka + operator docs. Dev/test builds MUST use `czebox` (Principle VII).
//
// MIGRATED TO gov.cz (2026-08-16). ISDS moved domains - test `czebox.cz` → `datovka-test.gov.cz` on
// 29. 1. 2026, production `mojedatovaschranka.cz` → `datovka.gov.cz` on 25. 6. 2026 - announced in the
// June 2026 developer bulletin (`docs/isds-ws-news/2244_Info_pro_vyvojare_2026_6_2.md` §3.1). The old
// domains "zůstávají prozatím v platnosti" with no announced end date, so this is a migration on the
// operator's recommendation rather than a forced move, and reverting is a one-map edit.
//
// The `Host` union is deliberately an ENUM, not a URL: every stored account carries `czebox` or
// `production`, so this map is the single place the actual domain is decided. Changing it repoints
// existing accounts with no migration.
//
// Verified before switching (2026-08-16):
//   * DNS - `ws1.datovka.gov.cz` and `ws1.mojedatovaschranka.cz` resolve to the SAME address
//     (2a00:1028:d:216::102); the test pair likewise share 2a00:1028:d:220::102.
//   * TLS - the DIA certificate for each environment carries all of `www` / `ws1` / `ws2` on the new
//     name in its SAN list, so the handshake succeeds for every host below.
//   * HTTP - the new test host answers identically to the old one path by path, including the 404 on
//     `/vdz_ws/` that established `/DS/vodz` as the real VoDZ path back in 005.
//
// NOT verified: an authenticated round-trip. That needs live credentials, which live only in the
// device enclave (Principle III). Password boxes use HTTP Basic per request and should be unaffected;
// OTP and Mobile Key boxes hold an `IPCZ-X-COOKIE` session scoped to the PORTAL host, so switching
// `OTP_HOST_BASE` will invalidate an existing session and require one re-authentication.

import type { Host } from './types';

// Username+password WS host (HTTP Basic). Password-only boxes use this directly.
const HOST_BASE: Record<Host, string> = {
  czebox: 'https://ws1.datovka-test.gov.cz',
  production: 'https://ws1.datovka.gov.cz',
};

// OTP login goes through the PORTAL host (validated against czebox), not ws1: the as/processLogin
// flow establishes a session cookie, after which SOAP calls run under /apps/DS/*.
const OTP_HOST_BASE: Record<Host, string> = {
  czebox: 'https://www.datovka-test.gov.cz',
  production: 'https://www.datovka.gov.cz',
};

// VoDZ (velkoobjemové datové zprávy / large-volume messages, feature 005 US3) live on a SEPARATE
// host `ws2` (NOT ws1/DS), introduced with WSDL 3.04. Hosts confirmed from libdatovka's
// `isds_vodz_locator` (the `ws2c` client-cert variant is out of scope). `ws2` belongs to the HTTP
// Basic family, so only PASSWORD boxes use it; a cookie box reaches VoDZ through the portal
// (`appsVodzUrl`).
const VODZ_HOST_BASE: Record<Host, string> = {
  czebox: 'https://ws2.datovka-test.gov.cz',
  production: 'https://ws2.datovka.gov.cz',
};

export function hostBase(host: Host): string {
  return HOST_BASE[host];
}

export function otpHostBase(host: Host): string {
  return OTP_HOST_BASE[host];
}

/**
 * The Data Boxes web portal for a box's environment - where a user buys PDZ credit or changes an
 * expired password, neither of which this app can do itself.
 *
 * The same host the OTP login already speaks to, because it IS the portal. It used to be a second,
 * private copy in ComposeScreen ("kept in step with endpoints.ts"), and the inbox's password strip
 * had a third that always opened PRODUCTION - so a test box's "change it in the portal" landed on
 * the real portal, where that test login does not exist.
 */
export function portalUrl(host: Host): string {
  return OTP_HOST_BASE[host];
}

/**
 * db_access / db_manipulations SOAP service (`GetOwnerInfoFromLogin`, `GetPasswordInfo`, box mgmt).
 * Validated against the czebox test box: this is where the login-verification ops live.
 */
export function dsManageUrl(host: Host): string {
  return `${hostBase(host)}/DS/DsManage`;
}

/**
 * dmOperations SOAP service - data-message send/download (features 002/003). NOTE: this endpoint
 * does NOT host GetOwnerInfoFromLogin (it returns dmStatusCode 2006 "Unknown operation"), and its
 * status element is `dmStatus`/`dmStatusCode` (vs `dbStatus` on DsManage).
 */
export function dzUrl(host: Host): string {
  return `${hostBase(host)}/DS/dz`;
}

/**
 * dmInfo SOAP service (`/DS/dx`) - message lists + envelope info (GetListOfReceivedMessages, etc.,
 * feature 002). Password boxes authenticate with HTTP Basic here; OTP boxes use the cookie session
 * at the `/apps`-prefixed variant below. Status element is `dmStatus`/`dmStatusCode`.
 */
export function dxUrl(host: Host): string {
  return `${hostBase(host)}/DS/dx`;
}

/** Post-OTP dmInfo service - reached with the processLogin session cookie. */
export function appsDxUrl(host: Host): string {
  return `${otpHostBase(host)}/apps/DS/dx`;
}

/**
 * db_search SOAP service (`/DS/df`) - recipient lookup (`FindDataBox2`, feature 005). Password boxes
 * authenticate with HTTP Basic here; OTP boxes use the cookie session at the `/apps` variant below.
 * Status element is `dbStatus`/`dbStatusCode` (db_access family, like DsManage).
 */
export function dfUrl(host: Host): string {
  return `${hostBase(host)}/DS/df`;
}

/** Post-OTP db_search service - reached with the processLogin session cookie. */
export function appsDfUrl(host: Host): string {
  return `${otpHostBase(host)}/apps/DS/df`;
}

/** Post-OTP dmOperations service (MessageDownload, etc.) - reached with the session cookie. */
export function appsDzUrl(host: Host): string {
  return `${otpHostBase(host)}/apps/DS/dz`;
}

/**
 * Hosted OTP login endpoint (on the portal host). Validated against czebox: TOTP first call passes
 * `sendSms: true` to dispatch the SMS, the second passes the code (appended to the password); the
 * `uri` target is `{otpBase}/apps/DS/dz`. Mirrors libdatovka's `_isds_soap(..., "DS/dz", ...)`
 * appending `DS/dz` to the `uri=…/apps/` parameter.
 */
export function processLoginUrl(host: Host, opts: { sendSms?: boolean } = {}): string {
  const base = otpHostBase(host);
  const sms = opts.sendSms ? '&sendSms=true' : '';
  return `${base}/as/processLogin?type=totp${sms}&uri=${base}/apps/DS/dz`;
}

/** Post-OTP SOAP service (db_access) - reached with the processLogin session cookie. */
export function appsDsManageUrl(host: Host): string {
  return `${otpHostBase(host)}/apps/DS/DsManage`;
}

/**
 * Mobile Key (Mobilní klíč) login on the portal host. A two-phase `as/processLogin?type=mep-ws` flow
 * (init → push → poll → confirm) that establishes the same `IPCZ-X-COOKIE` session as OTP.
 * `applicationName` is shown in the user's Mobile Key push so they know which app is asking for access.
 * Spec: `MobilniKlic_autentizace.pdf` v1.3 (`docs/isds-mobile-key/`).
 */
export function mepLoginUrl(host: Host, applicationName: string): string {
  const base = otpHostBase(host);
  return `${base}/as/processLogin?type=mep-ws&applicationName=${encodeURIComponent(
    applicationName,
  )}&uri=${base}/apps/DS/dz`;
}

/** Mobile Key login-status poll - the richer JSON `{status, description}` variant (Dec 2025+). */
export function mepStateUrl(host: Host): string {
  return `${otpHostBase(host)}/as/mepWsStateUpdate2`;
}

/**
 * VoDZ large-message SOAP service (`ws2` `/DS/vodz`, feature 005 US3) - `UploadAttachment` +
 * `CreateBigMessage`, and the downloads `DownloadAttachment` and `Signed[Sent]BigMessageDownload`.
 * Separate host from the ordinary `/DS/dz` path. PASSWORD boxes (HTTP Basic) only; a cookie box's
 * sends and downloads go to `appsVodzUrl` (018 T006, T015). CONFIRMED on czebox (2026-06-16) by a live
 * 25 MB send. The probe that preceded it (401 at
 * `/DS/vodz`, 404 at `/vdz_ws/`) proved less than it seemed: `ws2` answers 401 for every `/DS/*` path,
 * real or not (re-probed 2026-09-14). The path matches the ISDS convention (`/DS/dz`, `/DS/dx`, ...).
 */
export function vdzWsUrl(host: Host): string {
  return `${VODZ_HOST_BASE[host]}/DS/vodz`;
}

/**
 * Post-login VoDZ service for a COOKIE box (OTP / Mobile Key) - the portal `/apps` variant of
 * `vdzWsUrl`, exactly as `/DS/dz`, `/DS/dx` and `/DS/df` each have one.
 *
 * Not `ws2` with the cookie, because ISDS documents a cookie session at one address only: third-party
 * web services "jsou dostupné na adrese https://<adresa_prostředí>/apps/DS/<endpoint_webové_služby>",
 * the environment address being the `www` portal (MobilniKlic_autentizace v1.3 §1.2, §2 and step 8 of
 * §2.1, in `docs/isds-mobile-key/`). The `ws1` family is HTTP Basic, where "není používána cookie"
 * (Provozní řád §5, `docs/isds-provozni-rad-2026-06-26.md`), and `ws2` `/DS/vodz` was introduced as
 * that family's VoDZ twin, `ws1 -> ws2`, `/DS -> /DS/vodz` (bulletin 2022/1 §3.2). Nothing in the
 * operator's documents describes a cookie on `ws2`.
 *
 * The hosts behave accordingly when probed without credentials (test environment, 2026-09-14): `ws2`
 * challenges every `/DS/*` path with a Basic 401, while `{portal}/apps/DS/vodz` redirects to
 * `as/login?...&status=NCOO` - the portal's missing-session answer. That shows the path sits behind the
 * session gate (so does any `/apps` path); it does NOT show the service answers there. Not yet exercised
 * with a real session.
 */
export function appsVodzUrl(host: Host): string {
  return `${otpHostBase(host)}/apps/DS/vodz`;
}
