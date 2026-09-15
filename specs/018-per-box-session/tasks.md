# Tasks: Per-box ISDS session isolation

**Feature**: `018-per-box-session` | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

## Phase 1: Storage

- [x] T001 Migration 13: `ALTER TABLE accounts ADD COLUMN sessionCookie TEXT;` in
  `src/services/db/migrations.ts`.
- [x] T002 Thread `sessionCookie` through `DataBoxAccount`, `sqliteAccountsStore` (read + write) and
  the in-memory store. *Superseded 2026-09-15 (001 T028):* `DataBoxAccount.sessionCookie` and
  `setSessionCookie` are gone; the column is read once, by the migration that seals and empties it.
- [x] T003 [P] `accountsController`: `saveSession(boxId, cookie, validUntil)` and
  `clearSession(boxId)`; clearing runs wherever a box's cache is already dropped on removal.
  **As built:** `addAccount` writes the session with the new row, and `reauthAccount` replaces it via
  `AccountsStore.setSessionCookie`; there is no saveSession/clearSession. *Since 2026-09-15:*
  `SecureStore.saveSession`, sealed in the Keychain (001 T028).

## Phase 2: The transport (the actual isolation)

- [x] T004 [P] Write `__tests__/isds/sessionIsolation.test.ts` against a fake http client: a WS call
  for a cookie box carries THAT box's cookie and `useJar: false`; a password box carries Basic,
  no cookie, and `useJar: false`; two boxes in sequence never cross sessions.
- [x] T005 Add `sessionCookie: string | null` to `ListMessagesArgs` and the send/search/credit arg
  types in `src/services/isds/transport.ts`.
- [x] T006 Apply it at every WS `http.send` in `src/services/isds/isdsTransport.ts` — cookie for
  non-password boxes, Basic for password boxes, `useJar: false` for both. **Done 2026-09-14.** The two
  sends in `sendBigMessage` (VoDZ `UploadAttachment` and `CreateBigMessage`) were the last ones left:
  they sent Basic for a password box but neither the stored cookie nor `useJar: false`, so a cookie
  box's large message went out with whatever the native jar held (`credentials: 'include'`) - and to
  `ws2`, the HTTP Basic host. Both now pass `cookie: args.sessionCookie` (none for a password box) and
  `useJar: false` like the other WS sends, and a cookie box's pair goes to the portal's
  `/apps/DS/vodz` (`appsVodzUrl`, `src/services/isds/endpoints.ts`), the way its `/DS/dz`, `/DS/dx` and
  `/DS/df` calls already go to their `/apps` variants. The route follows the operator's documents: a
  cookie session is documented only at `https://<portal>/apps/DS/<service>`
  (`docs/isds-mobile-key/MobilniKlic_autentizace.md` §2), the `ws1`/`ws2` family is Basic with no
  cookie (`docs/isds-provozni-rad-2026-06-26.md` §5), and `ws2` `/DS/vodz` was introduced as that
  family's VoDZ twin (`docs/isds-ws-news/2175_Info_pro_vyvojare_2022_1_VoDZ_ZIP_ASiC.md` §3.2).
  Probed without credentials on the test environment the same day, `ws2` answered every `/DS/*` path
  with a Basic 401, while `{portal}/apps/DS/vodz` redirected to `as/login?…&status=NCOO`, the portal's
  missing-session answer. A cookie on `ws2` would most likely have come back 401, which reads as an
  expired session: a re-auth loop on every large send. Evidence: `__tests__/isds/sessionIsolation.test.ts`,
  describe "the large-message (VoDZ) send carries its own box session, and only that" — "a otp_totp box
  / a mobile_key box sends its own cookie to the portal on every upload AND the create - and nothing
  without one" (two files, so every pass of the upload loop is checked), "keeps two boxes apart across
  consecutive large sends, each on its own environment" and "gives a PASSWORD box Basic auth on ws2 and
  no cookie on both steps, still off the jar"; `__tests__/isds/endpoints.test.ts` "builds the cookie-box
  VoDZ URL on the portal host under /apps, not on ws2". Each fails on the code before this change.
  **Not verified with a real session:** the one live VoDZ send (005, 2026-06-16) was a password box,
  and the probe shows only that `/apps/DS/vodz` sits behind the portal's session gate (every `/apps`
  path does), not that the VoDZ service answers there. A large send from an OTP or Mobile Key box on
  czebox is the walk that settles it. The download half of VoDZ is not covered here: T015.
- [x] T007 Login paths: `clearAll()` before the login POST, `readSession()` after, and return the
  captured session in the result. *Amended 2026-09-15 (001 T028):* and `clearAll()` again once the
  login's last request is over, however it ended (`IsdsHttpTransport.endHandshake`, from
  `passwordLogin`, `otpSubmit` and `mepConfirm`). After capture the jar held a bearer session outside
  the vault, readable while the app was locked. Emptying it is safe because nothing reads it afterwards
  - every request path was read through: each WS `http.send` passes `useJar: false`, the VoDZ downloads
  `omitCookies` (T006, T015), and only login requests ride the jar - and because no flow continues a
  failed handshake: the error screen starts a new attempt, which empties the jar at its own start.
  ~~Still left: a sign-in that ends before that last request (a first step that
  is refused or fails - a wrong password on the SMS request, a refused Mobile Key start - an SMS
  requested and no code entered, a Mobile Key request declined, timed out or cancelled) keeps its
  half-finished handshake cookie until the next login or a removal; finishing that handshake takes the
  password and a new code, or the communication code.~~ (Closed below, 2026-09-15.) *Corrected
  2026-09-15 (review):* this used to leave out the first step that is refused or fails, which the
  transport does not empty either. Tests: `sessionIsolation.test.ts` ('lets step two ride step
  one’s session, and empties the jar only once its copy is taken', 'empties the jar after a code that
  did not sign in, too', 'empties the jar when the submission fails on the way', 'takes the Mobile Key session out, then
  empties the jar', 'empties the jar after a Mobile Key confirmation that did not sign in', 'empties the
  jar before a password login and again once its expiry lookup is done'); the two cases that asserted no
  clear at all now assert none before the step's requests ('does NOT empty it before the code is
  submitted (step two)', 'does NOT empty it before Mobile Key is confirmed (step three)', plus 'does NOT
  empty it while Mobile Key is polled (step two)'). The seven new cases fail on the transport before
  this change. **Not walked:** a sign-in of each kind on a device followed by a look at the jar.
  *Closed 2026-09-15:* a sign-in that ends before its last request empties the jar too.
  `IsdsAuthService` calls the new `IsdsHttpTransport.abandonLogin` when the SMS request or a resend is
  refused, fails or times out, and when a Mobile Key start is refused, fails or times out, a push is
  declined, not delivered or unknown to ISDS, a status poll fails or times out, or the approval window
  runs out. A sign-in waiting for its
  code keeps the cookie, which the code rides. One the person cancels or leaves - its Cancel, or the
  screen gone by a system Back or an edge swipe (`useLoginController` → `LoginController.dispose`) -
  ends at that moment through `IsdsAuthService.abandon`, which also drops the password kept for the
  code; not when the request or wait it aborted next wakes, since another sign-in may have opened a
  handshake of its own by then. ~~Not covered: a process killed mid-sign-in, and a response that lands
  after its cancel, leave a handshake cookie until the next sign-in starts.~~ *Closed 2026-09-24:* the app
  root empties the jar at launch (`endSignInsLeftOver` in `src/features/accounts/deps.ts`, called from
  `App.tsx` beside the transfer sweep), when no sign-in can be running, so a killed process leaves
  nothing past the next launch. *Review, the same day:* emptying it on every launch loaded Android's
  WebView cookie store on every cold start and reported a failure on each one on a phone without a
  working WebView, so now the transport notes in a device-local setting (`isds.handshakeOpen`) when a sign-in starts to ride the jar and takes the note back only by emptying it, and the app root empties the jar at launch only when the note is there (`HandshakeMark` in `isdsTransport.ts`). A jar that will not
  empty keeps the note, so the next launch tries again. A response that lands after its cancel is not
  noted - the cancel emptied the jar and took the note back - and waits for the next sign-in, as
  before. Tests: `__tests__/app/launchEmptiesCookieJar.test.tsx` (both), `__tests__/isds/unfinishedSignIn.test.ts`
  › the note that a handshake is open, for the next launch, each failing against the code before its
  change. Not walked on a device. Tests:
  `__tests__/isds/unfinishedSignIn.test.ts`, over the real sign-in and transport ('empties the jar when
  the SMS request is %s' - refused, failing on the way, timing out; 'keeps the handshake while the code
  is awaited, and empties it when the person cancels'; 'keeps the handshake a resend opened, and empties
  the jar when a resend is refused'; 'empties the jar when its start is %s' - refused, answered with an
  error, failing on the way, timing out; 'empties the jar after %s' - a push declined, a push that could
  not be delivered, a request ISDS no longer knows, a status poll answered with an error, a status poll
  failing on the way, a status poll timing out; 'empties the jar when the 240 s approval window runs
  out'; 'empties the jar at the
  cancel, and the wait waking later leaves the next sign-in alone'; 'still answers the sign-in, never
  rejects it'), `loginController.test.ts` ('ends the handshake when a sign-in waiting for its SMS code
  is cancelled', 'aborts a Mobile Key wait and ends its handshake when the screen goes'),
  `otpArrivesFirst.test.tsx` ('ends the sign-in when the code screen goes without its Cancel, as a
  system Back does'). All 21 fail on 7d41e20, and the cancel case also fails with the aborted-signal
  check taken out of `IsdsAuthService`. **Not walked:** a refused, declined, cancelled or left sign-in
  on a device followed by a look at the jar.
  *Review 2026-09-15:* one race closed. The code screen offers to send the code again while the first
  SMS request is still out, and `LoginController` holds only the latest request's signal, so a cancel
  after a resend aborts the resend and not that first request. When the first request then failed - a
  timeout on a slow network - its end emptied the jar under the handshake the resend had opened, so the
  resent code could not sign in, or under a sign-in the person had started since; on 7d41e20 that end
  emptied nothing. `IsdsAuthService` now counts the steps that take the jar over (a start, a resend, a
  code, a Mobile Key sign-in, `abandon`), and a step that ends short empties the jar only while it is
  still the latest. Tests: `unfinishedSignIn.test.ts` ('keeps the handshake a resend opened, which the
  code has to ride'; 'leaves the next sign-in alone when the person cancelled after a resend and started
  again', through `LoginController`), both failing on 38e1a0a. The earlier evidence was re-run and holds:
  the 21 sign-in tests fail against 7d41e20's `src`, the removal test (T010) fails there with the jar
  wired in as `deps.ts` wired it, and the four box item tests (001 T028) fail with the new read branch
  taken out. ~~Not done: that late failure still reaches the screen, as it did on 7d41e20 - the code
  screen the resend opened turns into the first request's error, because `LoginController` applies
  every outcome however old.~~ *Stale, corrected 2026-09-24:* closed by the double-tap audit of
  2026-09-23 - `LoginController` runs one request at a time (`exclusively`) and refuses a resend while
  the first SMS request is out, and the code screen's "send again" is dimmed and disabled while any
  request runs (`OtpForm`), so there is no resend for the first request's failure to land over. Pinned
  by `__tests__/accounts/loginController.test.ts`, "does not resend while the first SMS request is
  still out, so nothing answers over a resend". **Not walked:** a resend tapped while the first SMS
  request is still out.
- [x] T015 *(Added 2026-09-14, found while closing T006.)* Carry the box's own session on the VoDZ
  attachment DOWNLOAD. `DownloadAttachment` in `src/services/files/vodzAttachmentDownloader.ts` (the
  enclosures of a sent message over 20 MB) is a WS call outside `isdsTransport.ts`, and it still rides
  the shared jar: `VodzDownloadArgs` has no `sessionCookie`, no `Cookie:` header is sent, and the
  request goes through `react-native-blob-util`, which on Android installs RN's shared cookie jar on
  its OkHttp client (`ReactNativeBlobUtilImpl`) and on iOS stores into the shared
  `NSHTTPCookieStorage`. It also always targets `ws2` (`vdzWsUrl`), the Basic host, so a cookie box is
  on the wrong host as well. Needs the session passed down from `messagesController`, the portal route
  for cookie boxes (`appsVodzUrl`), a refusal when there is no session, and a way to keep the jar out
  of a blob-util request. Whether an explicit `Cookie:` header wins over the jar's own cookies there is
  unverified on either platform. ~~FR-001 is NOT met on this path.~~

  **Done 2026-09-15.** Both VoDZ downloads - `DownloadAttachment` and the signed original
  (`SignedBigMessageDownload` / `SignedSentBigMessageDownload`, added for 004's ZFO storage and riding
  the jar the same way) - take a required `sessionCookie` in `VodzDownloadArgs`, read from the vault
  by `messagesController` (`downloadVodzDetail`, `attachBigOriginal`, `fetchSignedOriginal`; until then
  they read the password alone). `vodzRequest` builds every request: HTTP Basic on `ws2` for a password
  box; the box's cookie as an explicit `Cookie:` header at `appsVodzUrl` for an OTP or Mobile Key box,
  for the reasons recorded there and in T006; and no request at all for a cookie box without a session
  (`authFault`, as `missingSession`). A cookie box's HTTP 200 with no XML in it is a lost session
  (FR-006), as in the transport.

  *Keeping the jar out.* blob-util 0.24.9 has no option for it and uses the jar on both platforms. On
  Android `ReactNativeBlobUtilImpl` installs RN's `ForwardingCookieHandler` jar on the shared OkHttp
  client that every request's builder inherits, and OkHttp's `BridgeInterceptor` sets the `Cookie`
  header from the jar whenever it holds cookies for the host - replacing an explicit one - and saves
  every `Set-Cookie` back into it; the `useDownloadManager` branch adds `CookieManager`'s cookie itself.
  So the explicit header alone would not have won there (read from the source, not observed). On iOS
  the default session configuration reads and writes `NSHTTPCookieStorage.sharedHTTPCookieStorage`, and
  the library's `#153` block stores response cookies there explicitly. Whether an explicit `Cookie:`
  header wins over the store's cookies on send is not something Apple's reference for
  `HTTPShouldHandleCookies` says, so the option does not rely on it: it takes the store out of the
  request altogether. `patches/react-native-blob-util+0.24.9.patch` now adds an `omitCookies` option: Android gives
  the request's client `CookieJar.NO_COOKIES` and adds no `CookieManager` cookie; iOS sets
  `HTTPCookieStorage = nil`, `HTTPShouldSetCookies = NO`, `HTTPCookieAcceptPolicy = Never` and skips the
  `#153` store. Every VoDZ request passes it (`noJarConfig`), a password box's too, so it cannot pick up
  a cookie box's session. A patch rather than a move off blob-util: the alternative is a native module
  of our own for a streamed POST of over a gigabyte, against some twenty lines in the library that
  already does it, which the project already patches. Checked by applying the combined patch with
  patch-package 8.0.1 to pristine 0.24.9 sources in a scratch copy: every hunk applies and the result is
  byte-identical to the intended files. The shared `node_modules` was not modified, so a native build
  needs `npx patch-package` (or `npm install`) to run first.

  Evidence: `__tests__/files/vodzAttachmentDownloader.test.ts` - "a VoDZ enclosure download carries its
  own box session, and only that" (an otp_totp and a mobile_key box fetch every enclosure from the
  portal with their own cookie and `omitCookies`; a password box keeps Basic on ws2 with no cookie and
  the jar still out; two boxes stay apart across environments; a cookie box with no session is refused
  before the network; a dead session and 1219 are read as such), "a VoDZ signed original follows the
  same rule" (both operations, and a password box), and "the jar exclusion JS asks for is the one the
  native patch implements" (JS sends exactly `omitCookies`, and both platforms read it where the jar
  comes in - a spelling check, not proof of what OkHttp or NSURLSession do); `__tests__/messages/messages.test.ts`
  "getDetail (VoDZ): the enclosures and the original ride the box's own session, not the shared jar"
  and "hands the large-volume service the box's own session, read from the vault";
  `__tests__/files/signedZfoStream.test.ts` "calls a cookie box's 200 with no XML at all a lost session,
  and a password box's a fault". Each fails on the code before this change.
  **Not verified:** no real session and no device. Owed: an OTP or Mobile Key box on czebox downloading
  a sent VoDZ's enclosures and original through `/apps/DS/vodz` (whether the VoDZ service answers there
  with a session is as open as it is for the send); and, with two cookie boxes signed in, the debug log
  showing each VoDZ download carrying only its own box's cookie, on Android and on iOS, after
  `patch-package` has run. The refusal codes of the same downloads changed with this task: 004
  research R8.

  *Review, 2026-09-15.* Re-checked rather than taken on trust:
  - The new tests fail on the code before this change: 29 of them, run over a `git archive` of
    `e714522` with the new test files.
  - The combined patch still applies: patch-package 8.0.1 reversed the previous patch on a scratch copy
    of the installed library, then applied this one; every file took it.
  - `CookieJar.NO_COOKIES` compiles from Java against OkHttp 4.12.0, the call the Android hunk makes.
  - blob-util's JS hands the config object to the native request unfiltered, so `omitCookies` reaches it.
  - The manual quoted in 004 research R8 was re-read from the same URL: 1219 in §2.6.1 and §2.6.3,
    "shodná" in §2.6.2, §2.6.4 and §2.6.6, 3013 in §1.9.3.

  Added in review: `__tests__/messages/messageDetailDownload.test.tsx` mounts the detail screen and
  shows it no longer records the files as lost after a failure past 90 days, and shows them unavailable
  only on the controller's `gone`. Both cases fail on the old screen; the controller tests could not
  show this, because the old rule lived in the screen. Corrected: this note had said Apple documents
  that an explicit `Cookie:` header overrides the store, and 004's spec cited two stream test names
  that do not exist.

## Phase 3: Wiring

- [x] T008 Controllers (`messagesController`, `sendController`) resolve the box's session next to
  `resolvePassword` and pass it down. *Since 2026-09-15:* both read it from the vault through
  `credentialsFor` (001 T028).
- [x] T009 `authService` persists the captured session with the account on successful login/re-auth.
- [x] T010 Box removal clears the stored session and calls `clearAll()`. **As built:** removing a box
  drops its row, and the stored `sessionCookie` with it (`noPlaintextSecrets.test.ts`). ~~The native jar
  is NOT cleared on removal; every login clears it first (`resetJar`, Correction 2), and WS calls do
  not read it (except the VoDZ send, T006).~~ *Closed 2026-09-14:* `AccountsController.removeAccount`
  now also empties the native jar through `IsdsHttpTransport.resetJar` (public for it; wired as the
  controller's required `sessionJar` dependency, for Correction 1's reason), after the row and before
  the secret. Other boxes are unaffected - see the FR-004 amendment in `spec.md`. Tests:
  `accountsController.test.ts`, `sessionIsolation.test.ts` ('emptying the jar when a box is removed').
  *Review 2026-09-14:* the `sessionIsolation.test.ts` cases called `resetJar` directly, so they passed
  whether or not removal called it. They now remove a box through the real `AccountsController` over
  the real transport, wired as `deps.ts` wires them ('clears the native jar', 'finishes the removal
  when the native module cannot clear it', 'leaves the remaining box calling ISDS with its own
  session'), and fail when `removeAccount` does not empty the jar. *Amended 2026-09-15 (001 T028):*
  the stored session is a Keychain item now, deleted by `SecureStore.deleteBox` with the password
  rather than with the row. *Amended 2026-09-15:* removal no longer empties the jar;
  `IsdsHttpTransport.resetJar` is private again and `AccountsController` takes no `sessionJar`. Every
  sign-in now empties the jar when it ends, one that ends before its last request included (T007), so
  all a removal could find there was a sign-in still under way - and a removal queued behind a long
  one, or finished later (`resumeRemoval`), emptied the whole jar whenever its turn came and broke that
  sign-in. The other rule, emptying only while no sign-in is under way, is the larger one and gains
  little: a sign-in can wait for its SMS code as long as its screen stays open, so a removal serialised
  behind it could wait as long, and what it would still catch - a cookie a killed process or a late
  response left, or what a jar that would not empty kept - is emptied when the next sign-in starts
  (FR-004). *(Corrected 2026-09-24: a killed process's handshake and a jar that would not empty are also
  emptied at the next launch, T007.)* Tests: `sessionIsolation.test.ts` ('lets a sign-in waiting for its SMS code finish when a
  box is removed meanwhile', which fails on 7d41e20 with the jar wired as `deps.ts` wired it there;
  'leaves the remaining box calling ISDS with its own session'). The removal tests that asserted a
  clear went with the dependency.

## Corrections made while building (each one found on the device, not by a test)

1. **The jar was never wired.** The transport defaulted to `NoopCookieJar`, and the app constructed
   it without one — so every login captured `null`, every stored session was empty, and every box
   reported "sign-in expired" no matter how often the user signed in. The **default** was the defect:
   it made "forgot to wire it" indistinguishable from "no native module here", which is the same
   looks-finished-but-isn't shape this feature exists to remove — reproduced while removing it. The
   jar is now a REQUIRED constructor argument, so it is a compile error.
2. **The jar was cleared mid-handshake.** OTP and Mobile Key are two-step flows: step one establishes
   the portal session, step two rides it. Clearing in `otpSubmit` threw that session away. The clear
   now happens only at the three points a flow BEGINS. *Amended 2026-09-15:* and again once a flow's
   last request is over, when no later step needs it (T007).
3. **A missing session made an anonymous call.** With no cookie the request still went out, and ISDS
   answers that with something that is not a 401 — so the user saw "Zprávy se nepodařilo načíst"
   instead of "sign in again". The transport now refuses to ask anonymously. This is also the upgrade
   path: every pre-existing OTP box has no stored session, and re-auth is the honest answer for all.
4. **The expired-session strip survived a successful re-auth** (fixed in 019's branch): the inbox
   clears it when a sync reports back, and nothing it depends on changes across a re-auth.

## Phase 4: Verification

- [x] T011 Full gate.
- [x] T012 Regression walk on the czebox PASSWORD box: list, open, download, send-search all still
  work. This is the risk the change actually carries here.
- [x] T013 **User-run**: two production SMS boxes — sign into both, switch, list each, confirm neither
  signs the other out; remove one and re-add it.
- [x] T014 Update `specs/README.md`.
