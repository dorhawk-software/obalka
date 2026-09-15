# Feature Specification: Per-box ISDS session isolation

**Feature Branch**: `018-per-box-session`
**Created**: 2026-08-17
**Status**: Implemented; acceptance passed on two production SMS boxes 2026-08-17. Tasks: 15/15 done. T015 closed 2026-09-15: the VoDZ downloads (enclosures and the signed original) carry the box's own session, to the portal's `/apps/DS/vodz` for a cookie box, and keep RN's shared cookie jar out of `react-native-blob-util` through a patched `omitCookies` option (FR-001, as built); not yet exercised with a real session or on a device. T006 closed 2026-09-14: the VoDZ large-message send carries the box's own session with `useJar: false`, to the portal's `/apps/DS/vodz` for a cookie box; not yet exercised with a real session. T010 closed 2026-09-14: removal now empties the native jar too (FR-004, as built). *Amended 2026-09-15 (T010, T007):* removal no longer empties it, because every sign-in empties the jar when it ends, one that ends before its last request included, and a removal could only break a sign-in under way (FR-003, FR-004); unit-tested, not walked on a device. *Amended 2026-09-15 (001 T028):* the stored session is no longer in the encrypted database - it is sealed per box in the Keychain under the vault key (FR-004, FR-005, Assumptions). *Amended 2026-09-15 (FR-006):* a cookie-box call the portal redirects to its sign-in page is a rejected session, in the transport and both VoDZ downloads; unit-tested, not yet observed with a stale cookie or on a device.
**Input**: Finishing work begun in `f48288c` ("cookie-isolation foundation"), whose module has never
been called. Prompted by a review of half-done work rather than by a user report.

## Why — and why this is not a normal bug

ISDS sessions for **OTP (SMS) and Mobile Key** boxes are carried by a cookie (`IPCZ-X-COOKIE`) set at
login. React Native's native cookie jar is **per domain**, not per box. Every such box authenticates
against the same host.

So with two cookie-authenticated boxes:

* the second box's login **overwrites** the first's cookie — same name, same domain;
* the first box's subsequent calls then either fail with 401 **or ride the second box's session**;
* a cookie left behind after a box is removed **poisons the next handshake** (the observed
  remove-then-re-add `400`).

The middle bullet is the reason this is not an ordinary bug. Riding another box's session means
**showing one person's legally-privileged mail under another person's identity**, inside an app whose
entire subject is confidential government correspondence. It is a data-exposure shape, not a
usability defect.

**It is currently live.** `cookieJar.ts` exists, documents this exact analysis, and provides
`clearAll` / `readSession`. `httpClient` already accepts a per-call `cookie` and a `useCookieJar`
switch. **Nothing calls any of it** — `isdsTransport` passes neither, so every call uses the shared
jar. The foundation looks finished from the outside, which is worse than if it did not exist: a
reader can reasonably conclude the isolation is in place.

**Who it affects.** Only boxes authenticated by OTP or Mobile Key. Password boxes use HTTP Basic per
call and are unaffected — which is why this has gone unnoticed: the developer's own boxes are
password boxes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Two SMS boxes, each showing its own mail (Priority: P1)

Someone with two OTP boxes signs into both and switches between them. Each shows its own messages,
and neither is signed out by the other.

**Why this priority**: it is the data-exposure case. Everything else here is hygiene.

**Independent Test**: add two production boxes with SMS authentication, sign into both, switch
back and forth, and list messages in each.

**Acceptance Scenarios**:

1. **Given** two cookie-authenticated boxes both signed in, **When** messages are listed in the
   first, **Then** they are that box's messages and the call carries that box's session.
2. **Given** box B signed in after box A, **When** box A is used, **Then** box A does not need to
   re-authenticate and does not receive box B's data.
3. **Given** a call for one box, **When** it is made, **Then** it does not consult or mutate the
   shared native jar.

---

### User Story 2 - Removing a box leaves nothing behind (Priority: P2)

Someone removes a box and adds it again, and the second sign-in works.

**Why this priority**: the observed `400`, and a stale bearer credential outliving the account that
owned it is its own small privacy failure.

**Acceptance Scenarios**:

1. **Given** a box is removed, **When** it is added again, **Then** the sign-in succeeds.
2. **Given** a box is removed, **Then** its stored session is gone and the shared jar holds nothing
   from it. *As built:* ~~the row delete removes the stored session.~~ *Since 2026-09-15 (001 T028):*
   the stored session is a sealed Keychain item, deleted with the box's password. ~~The native jar is not wiped on
   removal but is cleared at the start of every login, so a leftover cookie cannot poison the next
   handshake.~~ ~~*Since 2026-09-14 (T010):* removal empties the native jar too, and every login still
   clears it first.~~ *Since 2026-09-15 (T010, amended):* removal leaves the jar alone, which holds
   nothing from any box between sign-ins: every sign-in empties it when it starts and when it ends,
   however it ends (FR-003). WS calls pass `useJar: false` and never read it~~, except the VoDZ attachment download (T015,
   open), which after a removal goes out with no session - see FR-004, as built~~. *Since 2026-09-15
   (T015)* that includes the VoDZ downloads, which keep the jar out of `react-native-blob-util` with the
   patched `omitCookies` option.

---

### User Story 3 - A session that survives a restart, or fails honestly (Priority: P3)

Someone who signed in yesterday opens the app and is not asked for a new SMS code unless the session
has genuinely expired.

**Why this priority**: preserving today's behaviour. The native jar persists across restarts, so
moving sessions out of it must not quietly turn every launch into a new SMS.

**Acceptance Scenarios**:

1. **Given** a valid stored session, **When** the app restarts, **Then** the box works without
   re-authentication.
2. **Given** an expired or rejected session, **When** a call is made, **Then** the box asks for
   re-authentication rather than failing silently or looping.

---

### Edge Cases

- **The native module is unavailable** (tests, or a platform where it is absent) — the app degrades
  rather than crashing: a jar that cannot be cleared or read is reported (`isds.login`) and the login
  proceeds with no captured session, so the box is asked to re-authenticate. `NoopCookieJar` is for
  tests only.
- **Two boxes on different hosts** (production + czebox) — isolation is per box, not per host.
- **A password box and an OTP box together** — the password box must not be handed a cookie, and must
  keep using HTTP Basic.
- **A login that fails partway**, leaving cookies in the jar. *As built since 2026-09-15:* emptied when
  the code, the Mobile Key confirmation or the password login fails, since no flow continues it; ~~a first
  step that is refused or fails, or a flow left between its steps, keeps its cookie until the next login~~
  and, since later that day, when a first step or a resend is refused or fails, a Mobile Key push is
  declined, undelivered or times out, a status poll fails, or the person cancels or leaves the sign-in
  (FR-003).
- **Concurrent calls for two boxes** (the app refreshes boxes in parallel on launch).

## Requirements *(mandatory)*

- **FR-001**: A WS call for a cookie-authenticated box MUST carry **that box's** session explicitly
  and MUST NOT read or write the shared native jar.

  *As built:* met for every WS call in `isdsTransport.ts`. The VoDZ large-message send
  (`sendBigMessage`: `UploadAttachment` and `CreateBigMessage`) was the last one converted, on
  2026-09-14 (T006); until then it carried neither the box's session nor `useJar: false`. For a cookie
  box it now also goes where ISDS documents a cookie session, the portal's `/apps/DS/vodz`, instead of
  `ws2`, the HTTP Basic host. That route has not been exercised with a real session - the one live VoDZ
  send was a password box. ~~NOT MET on one path outside the transport: the VoDZ attachment download
  (`vodzAttachmentDownloader.ts`) sends no box session and rides the shared jar through
  `react-native-blob-util` (T015, open).~~ *Met since 2026-09-15 (T015)* on the paths outside the
  transport too: the VoDZ downloads in `vodzAttachmentDownloader.ts` - the enclosures
  (`DownloadAttachment`) and the signed original (`Signed[Sent]BigMessageDownload`) - carry the box's
  session as an explicit `Cookie:` header at the portal's `/apps/DS/vodz` (Basic on `ws2` for a password
  box), refuse without a session, and ask `react-native-blob-util` to keep the shared jar out with
  `omitCookies`, which the project's patch of the library implements on Android (`CookieJar.NO_COOKIES`)
  and iOS (no cookie storage, no cookies set or stored). Until then they sent no session to `ws2` and
  rode the jar, where on Android the jar's cookies would have replaced even an explicit header. Neither
  the route nor the native half has met a real session or a device; see T015 for the walks owed.
- **FR-002**: Each box's session MUST be captured at its own login and stored **against that box**.
- **FR-003**: The shared jar MUST be cleared around a login, so no login can inherit or leak a
  session belonging to another box.

  *As built, amended 2026-09-15 (001 T028):* cleared when a login starts - `passwordLogin`, `otpBegin`,
  `mepBegin` - and again once the login's last request
  is over, however it ended (`passwordLogin`, `otpSubmit`, `mepConfirm`). Until then a captured
  session stayed in the native store, outside the vault and readable while the app was locked. ~~A
  sign-in that ends before that last request - a first step refused or failed, or one abandoned
  between its steps - still leaves its half-finished handshake cookie until the next login or a
  removal (T007).~~ *Since 2026-09-15 (T007):* a sign-in that ends before that last request empties
  it too (`IsdsAuthService` → `IsdsHttpTransport.abandonLogin`), and one the person cancels or leaves
  does so at that moment (`LoginController.cancel`, `dispose`). Only a sign-in waiting for its code
  keeps the handshake's cookie. ~~Not covered: a process killed mid-sign-in, and a response that lands
  after its cancel, leave a handshake cookie until the next login starts.~~ *Since 2026-09-24 (T007):*
  a process killed mid-sign-in leaves nothing past the next launch: the transport notes in a device-local setting (`isds.handshakeOpen`) when a sign-in starts to ride the jar and takes the note back only by emptying it, and the app root empties the jar at launch only when the note is there. A response that
  lands after its cancel stays until the next login. *Review 2026-09-15:* a step
  that ends short empties the jar only while no later step (a resend, a code, a new sign-in, a cancel)
  has taken it over, so a first SMS request that fails after a resend no longer empties the resend's
  handshake (T007).
- **FR-004**: Removing a box MUST delete its stored session and leave no trace of it in the jar.

  *As built:* ~~the row delete removes the stored session.~~ *Since 2026-09-15 (001 T028):* the session
  is a sealed Keychain item, deleted with the box's password (`SecureStore.deleteBox`). ~~The native jar is not wiped on removal but
  is cleared at the start of every login.~~ ~~*Since 2026-09-14 (T010):* removal also empties the native
  jar, through the transport's own `resetJar` (the call every login already makes, with its failure
  reporting, and it never throws), straight after the row and before the Keychain secret, so a failed
  secret delete cannot leave the session behind. The whole jar, because it cannot be emptied per box.
  The remaining boxes lose nothing: their WS calls carry their own session with `useJar: false`.~~
  ~~The one path that still rides the jar - the VoDZ attachment download (`vodzAttachmentDownloader.ts`,
  T015, open) - only ever carried whichever session the last login left, and after a removal it goes out
  with none.~~ The VoDZ large-message send carries its own session since T006 closed, and the VoDZ
  downloads since T015 closed (2026-09-15), keeping the jar out of `react-native-blob-util` with the
  patched `omitCookies`, so no path reads the jar. ~~Tests:
  `accountsController.test.ts` ('removing a box empties the shared native cookie jar too (018 T010)',
  '…without touching the box that remains, whose session is its own', 'empties the jar even
  when the secret then fails to delete'), `sessionIsolation.test.ts` ('emptying the jar when a box is
  removed').~~ *Since 2026-09-15 (T010, amended):* removal no longer touches the jar, and "no trace of
  it in the jar" is kept by the sign-ins instead: each empties the jar once its session is taken out,
  and each that ends before that empties it too (FR-003), so between sign-ins the jar holds nothing
  from any box. All a removal could find there was a sign-in still under way, and emptying the whole
  jar broke it - a removal queued behind a long one, or finished later, did that whenever its turn
  came. What removal no longer catches: a handshake cookie a killed process or a late response left,
  and whatever a jar that would not empty kept - each until the next sign-in starts (FR-003), or, since
  2026-09-24, the next launch for the first and the last (T007). Tests:
  `sessionIsolation.test.ts` ('lets a sign-in waiting for its SMS code finish when a box is removed
  meanwhile', 'leaves the remaining box calling ISDS with its own session'),
  `accountsController.test.ts` ('removing a box leaves the box that remains its own session'). Not
  walked on a device.
- **FR-005**: A stored session MUST NOT be readable at rest by anything that could not already read
  the message archive. It is a bearer credential: holding it is equivalent to being signed in.

  *Amended 2026-09-15 (001 T028):* tightened. The session is sealed under the vault key, so with the
  app lock on it cannot be read while the app is locked - stricter than the archive, whose database
  key stays readable whenever the phone is unlocked.
- **FR-006**: A rejected session MUST surface as re-authentication, never as a silent failure or a
  retry loop.

  *Amended 2026-08-19, after a user report.* This was implemented for a MISSING session and missed
  the expired one, which is the case that actually happens. **ISDS answers a WS call carrying a dead
  session cookie with HTTP 200 and a body of pure whitespace** — 26 bytes, no SOAP envelope, no
  fault, no `dmStatus` — captured from a production box. Read as a server error, it reached the user
  as *"Offline – zobrazeny uložené zprávy."* on a working connection, with the re-auth strip (which
  renders only for an auth fault) never shown. So the requirement now reads: for a cookie box, a 200
  carrying no XML at all IS a rejected session. The rule is scoped to "no XML" rather than
  "unparseable" so a genuine SOAP fault stays a server fault, and to cookie boxes only — a password
  box gets a proper 401 and has nothing to re-enter.

  The report also exposed a second, independent claim the app had no business making: the stale-cache
  banner said **"Offline"** after ANY failed sync. The app cannot see the user's connection, only
  that its own call failed; it now says "offline" for a network error and "could not refresh" for
  everything else.

  *Amended 2026-09-15 (the sign-in redirect).* A third shape. Asked without a session, the portal's
  `/apps/DS/*` does not answer 401: it redirects to `as/login?…&status=NCOO` (probed without credentials
  on the test environment, T006). Neither native stack stops at a redirect - RN's `fetch` follows it on
  both platforms (OkHttp on Android, `NSURLSession` on iOS), and so does `react-native-blob-util` by
  default - so JS received the sign-in page itself, as a 200 with markup in it. That is not "no XML",
  so the rule above could not see it, and it reached the user as a server fault: for a large-volume
  download *"Tuto velkoobjemovou zprávu (nad 20 MB) se teď nepodařilo stáhnout. Zkuste to znovu"*,
  where only signing in again helps. For a cookie box, a call that ended there is now a rejected
  session too: the final URL `fetch` reports (`HttpResponse.url`, passed on by `FetchHttpClient` and
  left out when the platform reports none), any URL in blob-util's `redirects`, or an unfollowed 3xx
  whose `Location` is the sign-in page (`src/services/isds/signInRedirect.ts`). Only `/as/login` on the
  operator's domains counts: a processLogin or Mobile Key URL is a login in progress, and a Wi-Fi gate's
  login page is not the box's session ending. The page body is never read, because none has been
  captured. It applies in `isdsTransport.sessionLost` - every cookie-box WS call: both lists, the signed
  download and its unsigned fallback, marking read, recipient search, both sends and the credit balance
  - and in the two VoDZ downloads, the enclosures (`vodzAttachmentDownloader`) and the signed original
  (`signedZfoStream`). A password box keeps its 401, and the same page there stays a server fault.

  Evidence: `__tests__/isds/signInRedirect.test.ts` (the URL and the unfollowed redirect, the old domains,
  and a Wi-Fi gate or a look-alike host refused); `__tests__/isds/expiredSession.test.ts` › "a cookie
  session the portal turns away to its sign-in page" (all ten calls for an OTP and a Mobile Key box, an
  unfollowed redirect, a password box, a page that was not the sign-in);
  `__tests__/files/vodzAttachmentDownloader.test.ts` › "a cookie box the portal turns away to its sign-in
  page"; `__tests__/files/signedZfoStream.test.ts` › "a cookie request the portal turned away to its
  sign-in page"; `__tests__/isds/fetchHttpClient.test.ts` (the final URL passed on, and left out when
  empty). Run over a `git archive` of `5e03e03`, every new test fails: 18 in the transport, downloader
  and client suites, `signInRedirect.test.ts` cannot load, and the stream's three redirect cases fail.
  (Review, 2026-09-15: the guards for a password box, for a page that is not the sign-in and for a
  platform reporting no final URL passed there on their own; each is now part of a test that also
  asserts the redirect, which is what makes it fail on the old code.) The
  stream's older tests fail there too, only because its test double now answers with the trail rather
  than a bare status. **Not verified:** the redirect has been seen only for a request carrying no cookie.
  What the portal answers a stale cookie with - this redirect or the whitespace - and that `res.url` and
  blob-util's `redirects` carry it on a device, are open: 004 device walk 12.
- **FR-007**: Password boxes MUST be unaffected — HTTP Basic per call, no cookie.
- **FR-008**: Behaviour MUST degrade safely where the native cookie module is unavailable.

## Success Criteria *(mandatory)*

- **SC-001**: With two OTP boxes signed in, **zero** calls carry the wrong box's session — the
  decisive test, and it needs two real SMS boxes.
- **SC-002**: Neither box is signed out by the other's login.
- **SC-003**: Remove-then-re-add succeeds.
- **SC-004**: A password box's traffic is unchanged.
- **SC-005**: No stored session survives the removal of its box.

## Assumptions

- *Superseded 2026-09-15 (001 T028): sessions are sealed Keychain items, one per box, opened by a vault
  key that needs no prompt per call - which removes the objection below.* ~~**Sessions are stored in
  the app's encrypted database, not the keychain.**~~ A cookie is a bearer
  credential, so the keychain is the instinctive home — but a biometric-gated entry would prompt on
  every WS call. (The box-password entry here is not gated: `WHEN_UNLOCKED_THIS_DEVICE_ONLY`.) The
  encrypted DB is where the message archive already lives, so a session there is no more exposed than
  the mail it grants access to — and strictly better protected than today's **unencrypted** native
  cookie jar. Recorded because it is a security trade-off, not an implementation detail.
- **Verification needs two OTP boxes**, which only the user can provide. Everything below that can be
  unit-tested will be.

## Non-goals

- Changing how any box authenticates.
- Session *renewal* — expiry surfaces as re-auth, as it does today.
- Touching password-box auth.
