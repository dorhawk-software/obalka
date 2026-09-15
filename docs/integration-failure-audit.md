# Integration failure handling - audit

2026-09-10. Every point where this app talks to something outside its own JS heap, what can fail
there, what the user sees when it does, and whether anybody finds out.

The trigger was a count: **88 `catch` blocks in `src/`, and before this audit, zero of them reported
anything.** That is Principle II working exactly as written - *"MUST NOT hard-crash … failures
degrade to a clear, recoverable, localized UI state"* - and it is simultaneously the reason the app
was undebuggable in the field. A user says "it didn't work" and there is nowhere to look.

The two things had been conflated. **Swallowing an error so the UI survives is right. Swallowing it
so nobody ever learns is a separate decision**, and it had never actually been made.

## What reports, and what deliberately does not

*As classified on 2026-09-10, when `src/` had 88 `catch` blocks.* Reporting has since been extended:
the Reported columns below are corrected to 2026-09-14, when `reportFailure` had 56 call sites, so the
counts in this table are the audit's, not today's.

| | count | |
|---|---:|---|
| UI / control flow | 43 | Not an integration boundary. A `catch` around a date parse or a navigation guard. |
| Rethrows | 10 | Already surfaces to a caller; Sentry's global handler takes it from there. |
| **Now reporting** | **16** | Below. |
| Correctly silent | 19 | Below - and this group matters as much as the first. |

**Reporting everything would be the failure mode.** A crash reporter nobody reads is worse than
none, because it looks like coverage. `pdfText` returning null for an encrypted, corrupt or
image-only PDF is an *expected outcome*, not a failure. `fileTarget` treating "already gone" as
success is the desired state. Those stay silent on purpose, and each now carries a comment saying
so, so the next audit does not re-flag them.

## The integration surface

### ISDS - SOAP over HTTPS, the only network this app has

| Operation | Can fail with | User sees | Reported |
|---|---|---|---|
| `login` | timeout, network, 401/403, SOAP fault, session capture failure | Re-auth screen, or an error with retry | ✅ `isds.http` (timeout/network), `isds.login` (jar clear/capture); ❌ 401/403 and SOAP faults - an answer, not a failure |
| `listReceived` / `listSent` | timeout, network, server fault, abort | Cached list + a stale strip naming *which* | ✅ via `mapError` - **abort excluded** |
| `download` (message detail) | as above, plus VoDZ service mismatch (`dmStatusCode 1281`) | Error with retry | ✅ `isds.download` |
| `download`, signed original (2026-09-14, 004) | signed download refused or not 200; `dmSignature` missing or unreadable; a VoDZ original that does not arrive | A received message falls back to `MessageDownload` and opens without its original; a sent one shows the error; a VoDZ keeps its enclosures | ✅ `isds.download` (refused, no signature, VoDZ original), `isds.parse` (unreadable or for another message) |
| fetch the original on demand (2026-09-14, 004) | as `download`, plus a refusal past the retention window | The row's caption says why; past 90 days a refusal records the message as gone | ✅ via `mapError` and the transport's own reports; ❌ a refusal is an answer, not a failure |
| `send` | insufficient credit, recipient rejects PDZ, transport | A named reason, e.g. *Nedostatek kreditu* | ✅ `isds.send` |
| `markRead` | anything - it is fire-and-forget | Nothing, by design | ✅ `isds.markRead` |
| `mobileKey` poll | parse failure, server fault | Login appears to hang | ✅ `isds.mobileKey` (unparseable JSON), `isds.http` (network/timeout); ❌ non-200 or status-less answers |
| `getCredit`, `passwordInfo` | transport, parse | Falls back to no value | ✅ `isds.credit` / `isds.parse` - neither blocks a login or refresh |

**An abort is not reported.** The user switching folders or navigating away cancels the in-flight
call; that is the app working. It is also by far the most common thing to reach `mapError`, so
reporting it would bury every genuine fault.

### Storage

| Operation | Can fail with | User sees | Reported |
|---|---|---|---|
| SQLCipher open | corrupt DB, missing key, disk full | Launch fails | ↑ rethrows → global handler |
| Migrations | any failing statement | Launch fails, DB stays at last good version | ↑ rethrows, **and timed** |
| Transaction | any | Rolls back, rethrows | ↑ rethrows |
| `remindersStore.listForBox` | DB read | Empty list - *identical to a box with no reminders* | ❌ the inbox's catch falls back to no reminders without a report; `db.read` covers building the attention group (`attention.ts`) |
| `messagesStore` cached detail | unparseable `detailJson` | null → re-download if ISDS still has it | ✅ `db.read` |
| Keychain read (box secret; a seal since 001 T028) | item gone, damaged seal, sealed under a lost vault key, Keychain error, app locked | Gone or damaged: re-auth. Lost key: re-auth, and one dialog saying why. Keychain error, or a read abandoned while locked: "the saved sign-in could not be read", a retry - never re-auth | ✅ `keychain.read` for a damaged seal or a Keychain error; a missing item, a lost key (it has its own dialog) and waiting for the unlock are silent |
| Vault migration (plain password, DB cookie → seal) | Keychain or DB failure at any step | Nothing: the old copy stays in use and the move is retried at the next launch | ✅ `keychain.write` / `db.read` |
| Keychain read (backup key) | biometric decline (when revealing it), item gone, keychain error | Passphrase prompt for a key that is present | ✅ `keychain.read` for a keychain error; a declined prompt or a missing item is silent (null) |
| `appLock.arm` (switching on or off, last-box reset) | keystore refusal, no screen lock | The switch stays where it was; no screen lock → a dialog saying to set one; a lock that would not switch off → a dialog saying it is still on | ✅ `appLock.arm` |
| `appLock.authenticate` (unlock = reading the vault key) | cancel, no screen lock, key permanently invalidated | Stays locked: "try again", or "set a screen lock"; an invalidated key is replaced behind the gate | ✅ for an invalidated key or a Keychain error; ❌ *a cancel is the user's answer, not a fault* |

### Files

| Operation | Can fail with | User sees | Reported |
|---|---|---|---|
| Write attachment | disk full, bad base64, permission | Attachment missing after "Download" | ✅ `file.write` |
| Write signed original (2026-09-14, 004) | disk full, bad base64 | The download stands without its original; the detail offers to fetch it | ✅ `file.write` |
| Open or save signed original (2026-09-14, 004) | no app for a .zfo (→ the save sheet), native failure | The save sheet; otherwise a dialog | ✅ `file.open` for a failure; ❌ a dismissed sheet is the user's answer |
| Remove a box's files (2026-09-14, 004) | permission, file busy | The box is removed; its files may remain | ✅ `file.write` |
| Read attachment | file gone, corrupt | Cannot open | ✅ `file.read` - **Principle IV** |
| `stat` for size | file gone | Size omitted | ✅ `file.read` - **Principle IV** |
| Open in system viewer | no handler app | Nothing happens | ❌ **gap - see below** |
| Document picker | user cancels | Nothing | ❌ *cancel is not a failure* |
| Text → PDF | native module | Send blocked | ❌ **gap - see below** |
| PDF text extraction | encrypted, corrupt, image-only | Scan finds nothing | ❌ *expected outcome* |
| `attachmentScan` per-file | one unreadable attachment | Skips it | ✅ `scan.attachment` per file; ❌ **no aggregate - a scan where ALL fail looks like "no deadline found"** |

### Crypto / backup

| Operation | Can fail with | User sees | Reported |
|---|---|---|---|
| Argon2 native probe | module not linked | Silent fall back to the JS path | ✅ `backup.argon2` - **Principle I** |
| Argon2 derive | OOM on a large param set | Backup/restore fails | ↑ rethrows, **and timed** |
| `canProtect` | keychain refusal | Backup refuses to arm, "set a passcode" for one that exists | ✅ `keychain.read` |
| Snapshot / restore | any | Named error in the UI | ✅ `backup.snapshot` (automatic backups), `backup.document` (per file); ❌ **user-started backup/restore - see below** |
| Manifest read | one unreadable file | Skipped so the others still list | ✅ `backup.restore` (still skipped) |

### Platform

| Operation | User sees on failure | Reported |
|---|---|---|
| Notifee schedule | A reminder that never fires - **fails by absence** | ✅ `notify.schedule` |
| Notifee cancel | A deleted reminder still fires | ✅ `notify.cancel` (nothing-scheduled stays a silent success) |
| Notification tap → deep link | A tap that did nothing | ✅ `deepLink` |
| SMS User Consent | No autofill; typing still works | ❌ *a convenience, and de-Googled phones are normal* |
| Haptics | No buzz | ❌ *not worth a report* |
| System bars | Wrong nav-bar tint | ✅ `systemBars` |
| iOS: app data marked excluded from the phone's backup (2026-09-24) | Nothing - **fails by absence**: attachments, originals, debug ZIPs and backup files could land in iCloud or a computer backup | ✅ `file.excludeFromBackup` per location; launch carries on |

## Known gaps

Not oversights - decisions I did not make unilaterally, listed so they are decisions rather than
omissions:

1. **`attachmentScan` per-attachment failures.** One unreadable attachment is correctly skipped.
   *Amended 2026-09-14:* per-file failures report as `scan.attachment`. What is still missing is an
   aggregate: a scan where *every* attachment fails is indistinguishable from "no deadline in this
   document", and the feature would appear to work while doing nothing. It wants a "scanned 4, read
   0" report on top of the per-file ones.
2. **User-started backup and restore.** *Amended 2026-09-14:* automatic backups now report
   `backup.snapshot`, per-file failures `backup.document`, and an unreadable manifest
   `backup.restore`, so this gap is narrower than it was. A backup or restore the user starts still
   only surfaces a named error, so a failure is visible to *them*, but the cause is not visible to
   you. This is the most consequential flow in the app after sending.
3. **`attachmentOpener` and `textToPdf`.** Both fail into "nothing happens", which is the worst kind
   of failure to diagnose from a bug report.
4. **The pre-consent window.** Telemetry starts only once the persisted setting is read, so a crash
   in the first few hundred milliseconds is not reported. Starting earlier would mean transmitting
   under a default rather than the user's answer. *Amended 2026-09-24:* "starts" used to mean
   `Sentry.init` with consent checked only in the JavaScript send hooks. The native SDKs never see
   those hooks, so native crash reports and release-health sessions could go out without a yes. The
   SDK is now started only on a yes and closed on a no (`startTelemetry`, tested in
   `telemetryTransport.test.ts`, "the SDK's life").
6. **Native crash reports skip the scrubber (with consent).** Same cause as above: a Java/Kotlin or
   Objective-C/Swift crash is built and sent by the native SDK, which never calls `beforeSend`. It
   carries a native stack trace and device facts, not app data, but "every report passes
   `scrub.ts`" is only true of JavaScript events. Turning native crash handling off
   (`enableNativeCrashHandling: false`) would close it at the cost of those reports - an owner
   decision, not made here (2026-09-24).
5. **JS source maps upload only when a token is present.** *Amended 2026-09-14* (this read "are not
   uploaded"): iOS CI sets the upload up in the "Configure Sentry upload" step of `ios-sideload.yml`,
   which skips it with a warning when the `SENTRY_AUTH_TOKEN` secret is missing. Android release builds apply
   `sentry.gradle` and upload when `android/sentry.properties` holds a token
   (`scripts/sentry-token.sh` installs it) - locally, or in `release.yml` from the same secret.
   Without a token, a JS stack trace from a release bundle is still minified.

## What a report is allowed to contain

`src/services/telemetry/scrub.ts`, and its tests (`__tests__/services/telemetryScrub.test.ts`), are the
guarantee. Summarised:

**Sent:** the operation name (from the closed `Op` union in `telemetry.ts`), the error class, ISDS's
own fault and `dmStatusCode`, HTTP status, host (an environment label - `production`, `czebox` or
`other`; never a hostname), auth method, attempt count, byte sizes, item counts, durations, app/OS
version.

*Fixed 2026-09-14:* production used to reach telemetry under two spellings - `hostLabel()` in
`httpClient.ts` sent `mojedatovaschranka` while the call sites that pass an account's `Host` sent
`production`. Every call site now uses the one set: `FailureContext.host` is typed `HostLabel`
(`Host | 'other'`, `telemetry.ts`) and `hostLabel()` returns it. Pinned by "labels every ISDS URL of
an account with that account's own Host value" in `__tests__/services/telemetryScrub.test.ts`.
The service-path label (`endpointLabel()`, breadcrumbs and `isds.http` reports) was wrong the same
way: it matched `/DS/dx` before `/apps/DS/dx`, so every cookie-box call was reported as its password-box
twin, and a `processLogin` URL - whose query carries `uri={portal}/apps/DS/dz` - as `/DS/dz`. The list
is now ordered most specific first and includes `/apps/DS/vodz`. Pinned by "names every ISDS URL the
app builds by its own service, never its password-box twin" in the same file.

**Never sent:** message contents, subjects, sender or recipient names, box IDs, login names,
passwords, session cookies, attachments or their filenames, document text, backup contents, the
user's identity, or any network URL or body.

The mechanism is an **allow-list**, not a deny-list - a deny-list is a list of the leaks somebody
already thought of. Free text that the app does not control (a `fast-xml-parser` error quoting the
envelope it choked on) is additionally scrubbed against **this device's own identifiers**, seeded at
runtime from the accounts on it, because no pattern catches a Czech name but the app already holds
the exact string.
