# Accounts & secure login (feature 001)

How a data box gets added, stays signed in, and eventually asks to sign in again - and where each
secret lives while that happens. Spec lives in `specs/001-accounts-secure-login/`; this is the
maintainer's map, written from the code in September 2026, by which point several of 001's original
decisions had been replaced by better ones.

## Where the secrets are

Four different things get stored, and confusing them is how this goes wrong (as of 2026-09-15, 001
T028):

| Secret | Lives in | Survives | Notes |
|---|---|---|---|
| Box **password** | Keychain item `cz.obalka.box.<boxId>`, holding a **seal** under the vault key | app restart, not uninstall | The DB holds only `secretRef`, a pointer. |
| **Session cookie** (`IPCZ-X-COOKIE`) | Keychain item `cz.obalka.session.<boxId>`, sealed the same way | app restart | A **bearer credential** - holding it *is* being signed in (018). Dies with its box. Until 2026-09-15 it was a column of the `accounts` row; a launch migration moves it out and empties the column. |
| **Vault key** | Keychain: `cz.obalka.vault.key` while the app lock is off, `cz.obalka.vault.key.gated` (`BIOMETRY_ANY_OR_DEVICE_PASSCODE`) while it is on | app restart | 256 bits from `crypto.getRandomValues`; opens both items above. With the lock on it is in memory only while the app is unlocked. |
| **DB encryption key** | Keychain, `cz.obalka.dbkey` | app restart | 256 bits from `crypto.getRandomValues`, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. There is no fallback key. Not behind the lock. |

The backup passphrase (006) is a fifth, with two items of its own (`backupSecret.ts`). No secret goes
into a backup or a phone transfer.

`__tests__/security/noPlaintextSecrets.test.ts` pins the database half of that, including the rule
that nothing in `src/` writes to the console - a stray debug log is the likeliest way a credential
reaches a device log. `vaultSeal`, `vaultKey`, `vaultSecureStore` and `vaultCallSites`, in the same
folder, pin the vault half.

## Sign-in methods

Three, and which ones a box supports is ISDS's decision, not ours:

- **Password** - login name + password, sent as HTTP Basic on *every* WS call. These boxes hold no
  session.
- **SMS code** (`otp_totp`) - password first, then a one-time code from an SMS. The code screen opens
  the moment you submit, not when ISDS answers, so the field is focused and listening before the SMS
  lands (021).
- **Mobile Key** (`mobile_key`) - a communication code from the portal, approved in the Mobilní klíč
  app. This is the one federated route ISDS *does* expose to third-party apps; NIA, BankID and mojeID
  are portal-only, which the FAQ says plainly rather than showing a button that cannot work.

## The two kinds of expiry, which are not the same thing

1. **The session expires.** Only cookie boxes have one. ISDS answers a WS call carrying a dead cookie
   with **HTTP 200 and a body of pure whitespace** - no envelope, no fault - which the app reads as a
   lost session (`sessionLost` in `isdsTransport.ts`) and surfaces as the red (danger-soft) "Platnost
   přihlášení vypršela" strip. Reading it as a server error is what once made the app claim to be
   *offline* on a working connection.
2. **The password expires.** ISDS terms run about 90 days. `GetPasswordInfo` returns the date at
   sign-in; it is stored on the account row and refreshed by every re-auth, because a re-auth is
   usually what follows a password change. A fortnight out, the inbox says so and hands off to the
   portal - the app has no `ChangeISDSPassword` call and does not pretend otherwise.

   **When ISDS refuses a password box after that date** (001 FR-009, since 2026-09-14), the app says
   the password expired and must be changed on the portal, not that it is wrong. ISDS has never been
   seen telling the two apart: no response to an expired password has been captured, so
   `interpretOwnerInfo` maps no forced-change status code, and the app assumes the refusal is the same
   auth fault a wrong password gets. The verdict comes from the stored date instead, read at the
   moment of the refusal: `mustChangePassword` in `passwordExpiry.ts`. From there:
   - a refresh records `passwordExpired` (`classifyFailure`), which refresh-all skips like `reauth`
     (and does not mark as loading - `boxesToFetch`) and the switcher row labels "Heslo vypršelo";
   - the inbox strip says so and offers **Změnit v portálu** beside **Přihlásit znovu**;
   - the re-auth screen says so before any attempt and links to the portal under its intro;
   - message detail and compose use the expired sentence (`reauthCopy.ts`);
   - a refused re-auth, or re-adding the still-stored box, ends on `passwordChangeRequired`
     (`LoginController`), whose error screen links to the portal.

   The switcher row, the inbox strip and the re-auth screen give one verdict: the one stored with a
   refresh's refusal (`refusedForExpiredPassword`), over the date (since 2026-09-15). Only a box with
   nothing stored is judged by the date, and at one moment: the strip's own refusal, which the strip
   does not store but hands to the re-auth screen it opens (`onReauth(refusedAt)` through
   `AppNavigator` and `AppShell` to `ReauthForm`, since 2026-09-15). The screen judged when it opened
   before that, so a refusal just before the date and a tap just after it read differently on the two.
   A screen opened with no refusal moment - from the merged view's strip, whose boxes all have a
   verdict stored - judges when it opens.

   The portal is always the box's own environment (`portalUrl` in `endpoints.ts`). OTP and Mobile
   Key boxes are unaffected. It is an inference, and the copy is worded for its misses: a password
   changed on the portal and then mistyped still reads as expired until a sign-in succeeds, and if
   ISDS ever answers an expired password with a status code instead of an auth fault, it surfaces as
   a server error.

Re-authentication is scoped to **one box**. The others keep working, and the method can differ from
last time (a box that gains SMS OTP does not need removing and re-adding).

## Per box, not per build

Two things that 001 originally specified globally are per box:

- **Environment.** `account.host` is `production` or `czebox`, chosen on the add-box form under
  *Pokročilé*. There is no build-wide switch. A test box added without switching that control fails as
  `invalidCredentials`, which is the single most common way to lose an afternoon here.
- **Session.** RN's native cookie jar is per DOMAIN and ISDS sessions are per BOX, so WS calls carry
  the box's own cookie explicitly and keep the jar out. Sharing the jar meant one box's login
  overwrote another's - and a call could then return someone else's mail (018). A cookie box's calls
  go to the portal's `/apps/DS/*`, its large-volume (VoDZ) send and downloads included
  (`/apps/DS/vodz`); `ws1`/`ws2` are the HTTP Basic hosts for password boxes. The transport keeps the
  jar out with `useJar: false`. The VoDZ downloads (`vodzAttachmentDownloader.ts`) stream through
  `react-native-blob-util`, which has no such switch, so the project's patch of it adds `omitCookies`
  (018 T015, since 2026-09-15). A native build needs `patch-package` to have run, as `npm install`
  does. Every sign-in empties the jar when it starts and again when it ends, however it ends, so
  between sign-ins it holds nothing (the app lock, below; since 2026-09-15).

## Multi-box

Any number of boxes, each with its own secret, session, archive and sync state. The switcher sheet
(011) is the only place to add or switch one - not Settings, whatever the design mock suggested.
Removing a box takes the row, both of its Keychain items (the sealed password and session), the message
cache together with the files downloaded for it - attachments and signed originals
(`clearBoxCache` → `attachmentFileStore.removeForBox`, since 2026-09-14, 002 FR-015) - the reminders
and their notifications, and the scan dismissals. It leaves RN's native cookie jar alone (since
2026-09-15, 018 T010): nothing of any box's stays there between sign-ins, since every sign-in empties it
when it ends, however it ends (the app lock, below), and the jar only empties whole, so the removals
that emptied it, from 2026-09-14, broke any sign-in still under way - a queued or resumed removal
whenever its turn came. The sequence is `removeBox.ts`; removing the **last** box also resets the app
lock (below). A downloaded file that will not delete is reported
and does not stop the removal: once the row is gone, nothing in the app can reach those files.

**When a removal does not finish** (since 2026-09-15). `removeBox` never rejects; it resolves with what
it did and what the store holds after its purges. While the row is still listed - or the store cannot
say - nothing else is touched, so a box the app still shows keeps its archive. Once the row is gone,
the Keychain items go at once, and every later step runs even when one before it fails; the downloaded
files go even when the archive rows will not clear (`clearBoxCache`). Before each purge the store is
asked again whether the box is listed, and one that cannot answer stops the removal there (the mark
below finishes it). The shell (`settleRemoval`) updates the list, the active box and the route from
what is actually left - or, when the store cannot be listed after the row went, from the list on screen
without that box - then shows a dialog with **Zkusit znovu**: the box is still here, it is gone but
some of its data stayed on the device, or the app cannot tell. Trying again runs the whole sequence
once more. The row delete and the purges find nothing to do for what already went, and a retry that
fails again says so again.

- Removals run one at a time, in the order asked (`RemovalQueue`, `AppShell.handleRemove`). The switcher
  closes before a removal settles, so a second box can be removed meanwhile, and two at once put a box
  the other had removed back on screen and cleared the other's failure dialog.
- A removal stops the box's work already in flight (since 2026-09-15, `BoxWork` in
  `src/features/messages/state/boxWork.ts`, one for the app in `deps.ts`). When it starts, every ISDS
  call of the box is aborted - the launch and refresh-all sync (`refreshAll`'s `forBox`), the inbox's
  own, a download, a signed original, a large-volume walk, the credit and marking read - and every
  write of the box's archive or files is refused from then on: while the removal runs, and afterwards
  for a box the store no longer lists. A store that cannot say refuses too, and is reported as
  `db.read`. Clearing the archive waits for a write that got in before the removal, so it lands before
  the purge, never after it. A listing that ISDS answered after the purge used to write the box's
  envelopes back, with its mark already gone. A call stopped this way is not a failure: the box is not
  flagged, no credit is recorded for it, and it is not reported - marking read and the credit reported
  the removal's abort as their service failing until the review of 2026-09-15.
- A restore and a removal never run at once (since 2026-09-15, `RemovalQueue.runApart`, wired around the
  backup controller in `deps.ts`). The backup screen's restore and a phone transfer's save wait for the
  removals queued before them, and a removal asked for meanwhile waits for them. A removal asks before
  each purge whether its box is listed, and a restore that brought the box back just after that
  question lost what it had written to the purge.
- A box leaves the screen as soon as its row is gone (`onRowGone`), before its purges. With the last box
  that is Welcome at once (since 2026-09-15); the screen used to stay empty for as long as the archive
  and its files took to delete. A render that finds no box while the inbox is up draws Welcome too,
  never an empty navigator.
- Failure dialogs queue (`shellNotices.ts`, since 2026-09-15): a second removal that does not finish
  waits behind the first dialog. It used to replace it, and with it the only prompt about a box
  already gone.
- The dialog is never drawn while the app is in the background or behind the lock screen: RN Modals
  draw above the lock overlay, and it names the box. Since 2026-09-15 it is held there rather than
  closed - a removal that settles there queues its dialog as well - and shown once the app is back in
  the foreground and unlocked (`useAppCovered`, which takes the cover state from `LockGate`, as
  `VaultLostNotice` does). It used to close on the way to the background, and a removal that settled
  there opened none, so nothing said on return that the removal had not finished. The dialog about a
  name that would not save is held the same way. The failure is reported either way.
- Each failed step is reported as what it is (`removalFailureReport`): the row, the archive and the
  reminders as `db.write`, the list as `db.read`, the Keychain as `keychain.write`, the scan dismissals
  and the mark as `settings.write`, the lock reset as `appLock.arm`. Every one of them went out as
  `db.write` before 2026-09-15.

**Finishing a removal later** (since 2026-09-15). `removeBox` marks its box in the device-local setting
`unfinishedRemovals` (`unfinishedRemovals.ts`) before the row goes, and clears the mark once every step
went or the box turns out to be listed after all. `resumeRemoval` finishes a marked removal at the next
launch - after the route is set, so the launch screen never waits for a box's files - and whenever the
dialog about that box is closed. Written before anything is deleted, the mark also covers a process
killed halfway through.

- A box that is listed is never touched: one added again or restored since keeps everything, and only
  its mark goes. The resume never deletes a row, and it asks the store again before every purge.
- It opens no dialog of its own; the user was told when the removal did not finish. A resume that fails
  again is reported, and the mark waits for the next launch.
- Adding a box waits until no removal or resume is running (`RemovalQueue.idle`, wired into the sign-in
  flow's `addAccount` in `AppShell`). A removal of the same box still clearing its archive could
  otherwise delete the new box's Keychain items and first sync, and a last box's lock reset could land
  after the new box's key.
- The mark never travels. Backups leave device-local settings out and restores skip them, older
  backups included (`DEVICE_LOCAL_SETTINGS` in `settingsKeys.ts`): restored onto another install, a
  mark could have cleared a box the same backup brought back. That was the reason no mark was built
  before this list existed.

What it does not cover (reviewed 2026-09-15):

- A restore asked for while a removal is running shows no progress until the removal has ended: its
  button says it is working (`backup.working`), but the run is published when it starts
  (`BackupController.track`), after the wait. *Left, 2026-09-24* (006 T008): the button says so the whole
  time, and a waiting state would have to be published before `RemovalQueue.runApart` lets the restore
  in without hiding a backup that is running.
- A removal whose row then stays (the row delete refused) has stopped the box's calls meanwhile, so an
  inbox open on that box can say its messages could not be loaded, until it is refreshed again. *Left,
  2026-09-24:* it needs the row delete itself to fail, the dialog about the unfinished removal is up over
  that inbox, and refreshing on the person's behalf would be an ISDS call nobody asked for (014); telling
  a stopped call from a failed one on the inbox is a new outcome through its state, not a small fix.
- A mark that will not write. The removal goes on and the failure is reported; closing its dialog still
  finishes it, but the next launch has nothing to finish it from.

**When the list of boxes will not read** (since 2026-09-15). The launch read of the accounts table, and
the read right after a box is added, rejected with nothing to catch them: the launch screen spun for
good, and the sign-in form's finished state stayed up with no way on. Both now show "Uložené schránky
se nepodařilo načíst." on the launch screen with **Zkusit znovu**, which runs that step again - after
adding a box, so the new box still opens. The message and the retry's label are announced to a screen
reader every time the load fails, a retry that fails again included: the spinner is hidden from it once
the message is up, and the launch otherwise just went quiet. A rename that will not save opens a dialog
with **Zkusit znovu**; one that saved but will not read back shows the new name in place. The re-read
after a re-auth and the inbox's re-reads on focus report a failure and keep the screen as it was.

## The app lock, and the vault key behind it

Opt-in, off by default. Biometric, gated by the OS: the gated item uses
`BIOMETRY_ANY_OR_DEVICE_PASSCODE`, so the fallback is the **device** passcode. There is no
app-specific PIN to store, verify or get wrong - 001 planned one (T027) and it was the right thing not
to build.

Since 2026-09-15 (001 T028) the lock gates the secrets, not only the screen. What sits behind the gate
is the **vault key** every box password and session is sealed under (XChaCha20-Poly1305, `seal.ts`):

- **Unlocking is reading the key** - the one prompt. Going to the background drops it from memory
  (`LockGate` → `Vault.lock`). Not while an unlock is out, though: on Android 10 and older the phone's
  own passcode screen backgrounds the app, so an unlock that finished in the background keeps the key
  only if the app is back in the foreground within 1.5 s (`UNLOCK_RETURN_MS`). A background during the
  reveal after an unlock puts the cover back.
- **Everything that talks to ISDS reads its password or session at call time** (`credentialsFor`),
  and that read waits while the app is locked. The launch refresh, credit, marking read, search,
  sending (the VoDZ track too) and downloads all wait behind the lock screen, and none adds a prompt.
- **A read that cannot happen right now is not a sign-out.** The screen says the saved sign-in could
  not be read and offers a retry; it never counts as re-auth.
- **Toggling moves the key, nothing else.** On: one prompt (Android asks on the gated write, iOS on
  the read-back). Off: none. No seal is re-encrypted. A lock the Keychain will not switch off stays on,
  and Settings says so.
- **A new key is made only** when none exists, when the stored one is proven permanently unreadable,
  or when the owner has confirmed setting the lock up again (below) - never after a cancelled prompt
  or a Keychain error on its own.
- **When the phone loses the key** (the screen lock removed, and on some phones a biometric change),
  every old seal reads as `lost`: each box asks to sign in again, the archive is untouched, and
  `VaultLostNotice` says why, once. A phone with no screen lock is told to set one. The same with the
  lock off when Android loses the Keystore key under the ungated item while the item survives
  (since 2026-09-15): react-native-keychain makes a new Keystore key under the same alias, so every
  read fails its authentication tag - a proven loss, where it used to read as `unavailable` for ever.
- **When Android loses one box's own item key** (since 2026-09-15). Every Keychain item has a Keystore
  key of its own, and a box's password or session item can part from it while the vault key is fine:
  every read of that item then fails its authentication tag, in the words the vault key's loss is
  recognised by. It reads as `lost` for that box only (`VaultSecureStore`): the box asks to sign in
  again, and signing in writes the item over. Nothing is deleted, and no `VaultLostNotice` shows - the
  phone did not lose the key the other boxes depend on. It used to read as `unavailable` for ever, a
  "try again" that never worked. Any other Keychain error still reads as `unavailable`.
- **A key that keeps failing to read** (since 2026-09-15). A gated read that fails on a Keychain
  error - neither a proven loss nor the prompt's own answer (a cancel, a failed or locked-out biometric:
  `isPromptOutcome`) - says "try again" twice. With the lock on, no other error of Android's biometric
  prompt counts either - the sensor unavailable, a vendor error (`isBiometricPromptError`): a new key
  is read through that same prompt, so a reset could only delete the old one. From the third in a row
  the lock screen says the lock's key cannot be read, and the hint's slot shows **Nastavit zámek
  znovu** instead, drawn over the invisible hint so nothing moves. It opens a dialog saying what
  follows; only its yes calls `Vault.resetKey`, which deletes the gated item and takes the lost-key
  path above: a new key behind the gate, read back in one prompt, the lock still on (with the lock off
  and the key found only behind the gate, a new ungated key, no prompt). The vault refuses a reset it
  did not offer, so a cancelled prompt never leads to one - and nobody holding the phone can reach the
  offer by cancelling. The dialog closes when the app goes to the background, and while it is open the
  lock screen starts no unlock of its own (iOS reports 'active' again after Control Center, and an
  attempt still out when the person answered dropped their yes).
- **`VaultLostNotice` never shows over the lock screen or in the background** (since 2026-09-15). It
  is an RN Modal, which draws above the in-tree lock cover, and the loss is found by the first read
  after an unlock - while the cover still holds for the OS success animation. `LockGate` provides
  whether its cover is up, `useAppCovered` adds the background, and the notice waits - hidden, not
  dismissed - until the app is in the foreground and open.
- **Upgrading** runs a migration at launch (`VaultSecureStore.prepare`, started from `App.tsx`):
  plain password items and the old `sessionCookie` column are sealed, each seal read back before the
  plain copy goes, resumable after a crash at any step.

With the lock **off** the key sits in an ungated item, so a password is exactly as readable as it was
before the vault - whenever the phone is unlocked. That is the owner's opt-in choice, not a gap.

Removing the **last** box resets the lock (001 T037, since 2026-09-14): `removeBox` calls
`Vault.forget`, which deletes the vault key in both places and switches the setting off, so an app
with no boxes left does not keep the previous owner's gate in front of its Welcome screen. The key is
deleted rather than moved back to the ungated item because every seal it opened went with its box; the
next box starts a fresh key. It is decided on what the store holds afterwards, also when a later step
of the removal fails (a Keychain that will not delete a secret, an archive that will not clear): the
row is gone by then, so the lock resets and the error still surfaces. A reset that did not happen is
finished with the rest of the removal (see "Finishing a removal later").

The lock setting stays on its phone (since 2026-09-15). It follows the vault key, a Keychain item no
backup or phone transfer carries, so it is on the device-local list (`DEVICE_LOCAL_SETTINGS`): a
snapshot leaves it out and a restore skips it, older backups included. Restored as "on", it put a lock
screen in front of a phone whose key had not travelled, and that screen's unlock moved the phone's own
key behind a biometric prompt nobody had switched on there.

Not behind the lock: the database key, and the backup passphrase's app-usable copy. RN's native cookie
jar holds no session between logins (since 2026-09-15): every login empties it when it starts, and again
once the request that signs in is over - the password login, the code, or the Mobile Key confirmation -
however that ended: after a success has taken the session out to be sealed, and after a failure, which
no flow continues (`IsdsHttpTransport.endHandshake`, from `passwordLogin`, `otpSubmit` and
`mepConfirm`). Nothing needs
what it held. Every request path was read through on 2026-09-15: each WS call in `isdsTransport.ts`
carries the box's own session with `useJar: false`, the two VoDZ downloads pass the patched
`omitCookies` (018 T006, T015), and only the login requests ride the jar. A sign-in that ends before
that request empties it too (since 2026-09-15): its first step refused, failed or timed out (a wrong
password on the SMS request, a refused Mobile Key start), a resend refused or failed, a Mobile Key push
declined or not delivered, a status poll that failed or timed out, the approval window run out
(`IsdsAuthService`, through
`IsdsHttpTransport.abandonLogin`). Only a sign-in waiting for its code keeps the cookie, which the code
has to ride. One the person leaves - its Cancel, or its screen gone by a system Back or an edge swipe
while it waits for a code or an approval - ends then (`LoginController.cancel`, `dispose`), not when
the request or wait it aborted next wakes: by then another sign-in may have started, and emptying the
jar would take that one's handshake. A step that ends short also empties the jar only while no later
step has taken it over - a resend, a code, a new sign-in, or the person leaving (`IsdsAuthService`,
review 2026-09-15): the code screen offers to send the code again while the first SMS request is still
out, and a cancel aborts only the latest request, so that first request can fail after a resend or a new
sign-in has opened a handshake of its own. *(Corrected 2026-09-24: since the double-tap audit of
2026-09-23 the code screen offers no resend while a request is out - `LoginController` runs one at a
time - so of the two only a new sign-in started after a cancel remains; the guard covers both.)* So
removing a box finds nothing of it there to empty.

What that does not cover (reviewed 2026-09-15): ~~a sign-in whose app process is killed before it ends
keeps its handshake's cookie until the next sign-in starts, since the native store can outlive the
process, and so does a response that lands after its request was cancelled, setting a cookie once the
cancel has emptied the jar.~~ *Since 2026-09-24* a sign-in whose process was killed leaves nothing past
the next launch: the transport notes in a device-local setting (`isds.handshakeOpen`, `HandshakeMark`)
when a sign-in starts to ride the jar, takes the note back only by emptying it, and the app root empties
the jar at launch only when the note is there (`endSignInsLeftOver` in `deps.ts`, from `App.tsx`) -
not on every launch, which loaded Android's WebView cookie store on every cold start. A jar that will not
empty keeps the note, so the next launch tries again. A response that lands after its request was
cancelled, setting a cookie once the cancel has emptied the jar, keeps it until the next sign-in.
Neither signs anyone in: finishing that handshake takes the password and a
new code, or the communication code. A jar that will not empty keeps what it held, a captured session
included, until a later sign-in or launch empties it; the failure is reported (`isds.login`).

*For the owner (2026-09-24):* the constitution's "Known gaps" note under Principle III still says a
handshake cookie a process killed mid-sign-in leaves stays in the jar "until the next sign-in starts".
Since this change it is until the next sign-in or the next launch, whichever comes first. The
constitution was not edited here; its wording is the owner's to amend.

## Testing against czebox

Test boxes are separate credentials on `datovka-test.gov.cz` and produce no legal effects. Add one
with **Pokročilé → Testovací**; the box then carries a "Testovací" tag everywhere it appears, and
message detail adds a full-width band so it cannot be mistaken for real mail.

## Where the code is

| Concern | File |
|---|---|
| Add / remove / re-auth | `src/features/accounts/state/accountsController.ts` |
| Removing a box end to end, incl. the last-box lock reset, and finishing one later (`resumeRemoval`) | `src/features/accounts/state/removeBox.ts` |
| The mark of a removal that did not finish; removals one at a time | `src/features/accounts/state/unfinishedRemovals.ts`, `removalQueue.ts` |
| Settings that never leave the phone | `src/app/settings/settingsKeys.ts` (`DEVICE_LOCAL_SETTINGS`) |
| The shell's queued dialogs | `src/app/shellNotices.ts` |
| A box's work in flight, stopped by its removal; restores kept apart from removals | `src/features/messages/state/boxWork.ts`, `removalQueue.ts` (`runApart`), `src/features/accounts/deps.ts` |
| Login state machine (pure) | `src/features/accounts/state/loginMachine.ts` |
| Orchestration + persistence on success | `src/features/accounts/state/loginController.ts` |
| Password expiry, and "was that refusal an expired password?" (pure) | `src/features/accounts/state/passwordExpiry.ts` |
| Which "sign in again" sentence a box gets | `src/features/accounts/state/reauthCopy.ts` |
| Screens | `src/features/accounts/screens/` |
| Secrets: sealing, per-box items, the migration | `src/services/secureStore/seal.ts`, `vaultSecureStore.ts`, `keychainSecureStore.ts` |
| The vault key and the app lock | `src/services/secureStore/vault.ts`, `keychainVaultKeyStorage.ts`, `src/app/lock/LockGate.tsx`, `VaultLostNotice.tsx` |
| Encrypted DB + key | `src/services/db/database.ts` |
| Sessions on the wire | `src/services/isds/isdsTransport.ts` |
