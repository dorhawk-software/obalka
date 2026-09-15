# Feature Specification: Encrypted Cloud Backup & Cross-Device Sync

**Feature Branch**: `006-encrypted-cloud-backup`
**Created**: 2026-06-14
**Status**: Largely implemented (31/34 tasks) — both backup tiers (metadata and documents), the file target, automatic backup and retention (T030, T031), showing and scanning the recovery-key QR, and 025's phone-to-phone transfer as a second transport. Deferred to future work by the owner (2026-09-14): the Drive and iCloud targets (T015–T016) and their permission/entitlement delta (T017), and with them User Story 2 (config sync across devices), which has no task and needs a cloud target first. The app is published with the encrypted file backup and 025's phone-to-phone transfer. User Story 3 stays deferred. Captured originally to close the spec gap (005 → 007) and because
the design has a **non-obvious key-management trap** that had to be decided before any code.
**Revised 2026-09-08** against `research.md`, which re-checked the archive as it is now: four features
have landed since this was drafted and two of them change the threat model. The amendments below are
marked in place.
**Input**: Roadmap feature 006 — "client-side-encrypted backup/restore to iCloud / Google Drive;
config sync across devices." Explicitly requested in App Store reviews: users fear losing the
on-device archive (feature 004) when a phone is lost, replaced, or reset.

*Amended 2026-09-26 by [026](../026-attachment-downloads/spec.md):* Tier 2 has two modes - the
attachments on the phone, or all of them, the backup downloading what is missing first when the person
starts it - and the manifest records the mode, the messages still without attachments and the document
objects it uses.

## Why this matters (and why it's hard)

The local archive (004) is the app's most-loved capability — it keeps message history after ISDS
deletes messages at 90 days. But that archive lives on **exactly one device**. Lose the phone and the
history is gone. Users want a safety net and to read their boxes on a second device.

Two hard constraints from the [constitution](../../.specify/memory/constitution.md) shape everything:

- **Privacy first, no backend (III):** we never operate a server that sees government mail or
  credentials. Any cloud backup MUST be **client-side encrypted** so the provider (iCloud / Google)
  stores only opaque ciphertext.
- **Durable archive is sacred (IV):** backup/restore must never silently lose or corrupt archived
  messages or their signed ZFO envelopes.

### ⚠️ The key-management trap (decide this first)

The obvious implementation — encrypt the backup with a key kept in the **device Keychain/Keystore** —
**cannot be restored on a new device**, because that key never leaves the original (and Keychain is
exactly what's gone when the phone is lost). True cross-device restore therefore requires a key the
**user can reproduce on a new device**: a **user passphrase / recovery key** (stretched with
Argon2id/scrypt), independent of the device secure enclave. This is the single most important design
decision and the easiest to get subtly wrong (locking users out of their own backup, or weakening it
to a device key that defeats the purpose).

### ⚠️ Cross-ecosystem sync is effectively out of scope

iCloud and Google Drive do not interoperate, and we run no neutral server. So **iPhone ↔ Android**
sync is not achievable without a backend we've committed not to build. v1.x targets **same-ecosystem**
backup/restore (iPhone→iCloud→iPhone, Android→Drive→Android); cross-ecosystem is explicitly deferred.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Encrypted backup & restore of the archive (Priority: P1)

A user turns on cloud backup, sets a recovery passphrase, and the app stores an encrypted snapshot of
their archive + configuration in their personal iCloud/Drive. After losing/replacing the phone, they
install the app, sign in to the same iCloud/Drive, enter the passphrase, and their boxes, aliases,
settings, and message history (incl. signed ZFO) are restored.

**Why this priority**: This is the requested safety net and the whole point of the feature — without
it the most-loved capability is one dropped phone away from gone.

**Independent Test**: Back up on device A, wipe/reinstall, restore on device B with the passphrase;
verify boxes, aliases, settings, messages and ZFO envelopes match, and that the stored blob is
unreadable without the passphrase.

### User Story 2 - Cross-device configuration sync (Priority: P2)

The user's box list, aliases, and settings stay in sync across their devices in the same ecosystem,
so adding a box or renaming it on one device shows up on the other (each device still authenticates
its own session locally).

**Why this priority**: High convenience, lower stakes than the archive; config is small and
conflict-tolerant, so it's a good first increment of "sync" beyond one-shot backup.

**Independent Test**: Rename a box on device A; confirm the alias appears on device B after a sync,
without copying any session secret between devices.

### User Story 3 - Continuous archive sync across devices (Priority: P3)

> *2026-09-08:* 014 removed every background capability from this app, and 010 had to argue its way to
> re-introducing a purely local timer. A backup upload is not an ISDS call and does not breach 014 —
> but "automatically" here means a background scheduler, which needs that argument made explicitly or
> the story stays deferred. Backup on demand, and immediately after a user-initiated sync, needs no
> such argument and is where US1 should stop.

New messages archived on one device appear on the other automatically (not just at restore time).

**Why this priority**: Most valuable but hardest (merge/conflict semantics on a growing archive);
deferred within the deferred feature until backup/restore (US1) and config sync (US2) are solid.

**Independent Test**: Receive + archive a message on device A; confirm it appears on device B after a
sync cycle with no duplication or loss.

## Requirements *(mandatory)*

- **FR-001 (client-side encryption):** Backups MUST be encrypted on-device with a modern AEAD
  (e.g. libsodium/age-style) before upload; the provider only ever receives ciphertext + non-sensitive
  metadata. Plaintext message content or credentials MUST never leave the device.
- **FR-002 (recoverable key):** The encryption key MUST be derivable from a user-held secret
  (passphrase / recovery key, stretched with Argon2id/scrypt) so restore works on a new device. The
  app MUST make the recovery-key responsibility explicit (lose it = backup unrecoverable, by design).
- **FR-003 (no our-server):** No backup or sync path may route message data or credentials through any
  server the project operates. ~~Only the user's own iCloud / Google Drive is used.~~

  *Amended 2026-09-14:* the bytes go only to storage the user chose (their iCloud / Google Drive, or a
  file they control, T014) or, for 025's user-started phone-to-phone transfer, across croc's
  third-party relay, which sees only ciphertext: the archive is sealed before it is offered and the
  channel is PAKE-encrypted (decided 2026-09-13, 025 `spec.md` › The relay, decided).
- **FR-004 (selective scope):** Define and honor what is backed up: **always** config (box list,
  aliases, settings) and the message metadata DB + signed ZFO envelopes; **attachments** are
  optional/large and may be re-downloaded rather than stored (decide tier; never silently bloat the
  user's cloud).

  *DECIDED 2026-09-08 (user): both tiers ship, and the user chooses whether documents are included.*
  Tier 1 (config + metadata DB) is always in. Tier 2 (the documents) is a switch the user sets, with
  its size shown before it is turned on, and the backup's status says which of the two it holds. The
  reasoning that forced the decision follows.

  *Amended 2026-09-08 — the tier question cannot stay open, because the two answers make different
  promises.* "Re-downloaded rather than stored" is **not available** for the messages that matter:
  ISDS deletes content 90 days after service, which is the entire reason the archive exists. A
  metadata-only backup restores an index to a library that is gone. So: **two tiers, both explicit.**
  Tier 1 (config + metadata DB) is the default. Tier 2 (attachment files) is opt-in, shows its size
  before it is enabled, and is the only tier that actually preserves documents. A backup that looks
  complete while silently omitting the documents is 013's lock-screen promise in a new costume.

  *Amended 2026-09-14 (004 amendment):* the "signed ZFO envelopes" this requirement lists were not
  stored by the app at all until 2026-09-14, so no backup carried one. They are now a file per message
  (`signedZfo` on the detail), and like attachments they travel in **Tier 2**, not in the metadata DB:
  `documentCandidates` takes the original beside the attachments and `restoreDocuments` repoints it.
  A Tier 1-only restore brings back the record of an original without its file; the detail then offers
  to fetch it again while ISDS still holds the message. No schema change (`detailJson` is opaque in
  `SNAPSHOT_SHAPE`). Tier 2 now also reads each document in 1 MB slices rather than whole. Tests:
  `__tests__/backup/documents.test.ts` › carries a message s signed original / puts a signed original
  back; `__tests__/files/sliceSource.test.ts`.
- **FR-005 (opt-in + transparent):** Backup is **off by default**, opt-in, with clear status (last
  backup time, size, target account) and a one-tap restore.
- **FR-006 (integrity on restore):** Restore MUST verify integrity and MUST NOT partially overwrite a
  good local archive on failure (atomic / staged restore; never corrupt IV's "sacred" archive).
- **FR-007 (secrets handling):** Box credentials MUST remain in Keychain/Keystore. If included in a
  backup at all, they are inside the FR-001 ciphertext only; the default may be to **re-authenticate**
  on the new device rather than transport secrets.

  *Amended 2026-09-08 — this is no longer the whole story.* 018 added `accounts.sessionCookie`
  (migration v13), and a session cookie **is** a credential: holding it is equivalent to being signed
  in to that box. A straight database snapshot therefore carries one per OTP box. The snapshot MUST
  **strip it**. A restored device re-authenticates, which it has to do regardless — a session that has
  sat in a backup is almost certainly dead, so carrying it buys nothing and widens what the ciphertext
  is protecting.

  *Amended 2026-09-15 (001 T028):* the session left the database for a sealed Keychain item, and the
  column is emptied at the first launch after that change. The snapshot still copies named account
  fields only (`snapshot.ts`), which is what kept the column out before and keeps anything else out now.

- **FR-009 (a versioned schema, and forward compatibility) — new 2026-09-08:** The decrypted snapshot
  MUST carry its own `schemaVersion`, independent of the envelope's crypto `formatVersion` — the two
  change for different reasons and must be checked separately. A backup written by an OLDER app MUST
  restore on a newer one, through an explicit migration chain (the same shape as the database
  migrations in `src/services/db/migrations.ts`). "It probably still parses" is not forward
  compatibility; a migration that ran is.

- **FR-010 (refuse a newer backup, and say so) — new 2026-09-08:** A backup whose `schemaVersion` or
  `formatVersion` is NEWER than the running app MUST be refused with a message that names the reason
  and the remedy — update the app. It MUST NOT be partially imported, best-effort parsed, or reported
  as corrupt. Importing half a newer backup over a good archive is the one outcome worse than not
  restoring at all (Principle IV).

- **FR-011 (check before downloading) — new 2026-09-08:** Compatibility MUST be decidable from a
  small, separately stored **manifest**, without downloading the archive. A backup can be gigabytes;
  discovering it is unreadable after pulling all of it over a phone connection is a design failure,
  not a minor one. The manifest carries versions, timestamp, tiers and size — never box identities,
  names, counts or anything about the mail (SC-002 still holds for it).

- **FR-012 (schema drift is caught in development, not in the field) — new 2026-09-08:** A test MUST
  fail when the snapshot's shape changes without `schemaVersion` being incremented, and MUST say so in
  those words. The failure mode this prevents is silent and delayed: a field quietly added in one
  release makes every backup written afterwards unreadable by the migration chain, and nobody finds
  out until somebody restores a lost phone.

- **FR-013 (the passphrase is recoverable by its owner) — new 2026-09-08 (user):** The passphrase
  protecting the backup MUST be viewable in the app afterwards, gated behind device authentication —
  biometrics or the device passcode — in the way a banking app reveals a card PIN. Written down once
  and never shown again is how a backup becomes unrestorable while the phone still works.

- **FR-014 (transfer without typing) — new 2026-09-08 (user):** The source device MUST be able to show
  the passphrase as a **QR code**, and the restoring device MUST be able to scan it, so a restore does
  not depend on copying a long secret by hand between two phones. Typing stays available: the phone
  showing the code may be the one that is lost.

- **FR-015 (say what it is doing, in real numbers) — new 2026-09-08 (user):** While a backup or
  restore runs, the UI MUST show the current step, a determinate progress bar, and **real counts**
  (`x z y`) for the steps that have something countable — messages read, rows written. A step with no
  natural unit (the key derivation) MUST show its own reported fraction rather than an invented count.
  Reported after seeing "Pracuji…" and nothing else: *"I want it to display actual and real progress
  bar with information about what is currently being done, what is being backed up, how many record
  (x out of y)"*. The counts being TRUE is the requirement — a total that is an estimate is a bar that
  stops at 94%.

- **FR-016 (the wait is never a hostage) — new 2026-09-08 (user):** Long work MUST NOT block the JS
  thread — *"it is absolutely vital the main thread is not blocked"* — and leaving the backup screen
  mid-run MUST ask whether to **continue in the background** or **cancel**, then honour the answer.
  A cancelled backup MUST leave no archive behind and a cancelled restore MUST leave the local archive
  exactly as it was; cancelling MUST NOT turn backups off.

  *Amended 2026-09-15 (T030):* a restore can be cancelled until its rows are written, and not after.
  The documents are files written once the rows have committed, so a cancel past that point could only
  leave messages without their documents; the restore finishes instead, and the screen stops offering
  to cancel it. A cancel reaches the run it was meant for, including one still waiting for another. A
  cancel chosen in a dialog opened before that point, and answered after it, is told that the restore
  goes on rather than left to believe it was cancelled.

  *Amended again 2026-09-15 (T030):* the question names what is running: a backup, a restore or a
  check of a backup, each with its own title and its own cancel button. A restore the backup screen
  started and then left to carry on is said when it ends, success or failure: the next time the backup
  screen is in view, in a dialog, the way a phone-to-phone transfer's save is (025). *Reviewed the same
  day:* every such restore is said, one after another, including one that ends while a restore started
  on a later visit is still going and one that ends as its screen goes back; a restore the screen that
  started it said is not said again. A verify stopped on the way out is not reported as a backup that
  could not be opened. *Reviewed again the same day:* the dialog waits while the lock screen is up
  rather than coming up over it, and a restore that ends while another screen covers the backup screen
  closes the backup it restored, as one that ends in view does.

- **FR-017 (the switch means what it says) — new 2026-09-08 (user):** With backups on, the archive
  MUST keep itself backed up: a refresh that actually changed the archive schedules a backup, without
  the user pressing anything. Asked as a question — *"when a new message appears, it is automatically
  backed up, or how should I interpret that?"* — about a switch that then set backups up and waited
  for a button. Automatic work MUST remain foreground-only (014 removed background sync and that
  stands): it happens because the user just refreshed, not on a timer. It follows that the app needs
  the passphrase without challenging the user, so the passphrase is stored TWICE — an app-usable copy
  at the protection level the database key already has, and the gated copy that guards showing it to a
  person (FR-013). Automatic backups MUST be silent, including on failure: the user did not ask for
  that particular backup, and the status line telling the truth is the whole report.

  *Amended 2026-09-15 (T030):* a restore counts as a change to the archive. Once one has finished, the
  backup screen's restore and a phone-to-phone transfer's save (025) schedule an automatic backup the
  way a sync does; a restore that failed or was cancelled schedules none. ~~The backup screen's restore
  also schedules none when a document did not come back, because the backup it came from still holds
  that document and the default retention of one would replace it.~~ *Amended again 2026-09-15:* that
  only moved the loss to the next sync. The backup screen's restore schedules one either way, and the
  backup a document did not come back from is kept by retention instead (FR-018).

  *Decided 2026-09-15 (T030):* an automatic backup the person stopped is not scheduled again by a rule
  of its own. Stopping it is their answer (FR-016); automatic backups follow the refreshes the person
  makes, never a timer; and nothing is lost meanwhile: a stopped backup leaves no backup behind and
  deletes nothing, the backup before it stays, and the next one is a whole snapshot that includes what
  the stopped one was for. *Reviewed the same day:* documents a stopped backup had already stored stay
  in the store under their content names, and the next backup finds them there rather than storing
  them again. In practice the next refresh brings it back, the app's own refresh at launch
  included, because every refresh that lists at least one message counts as a change to the archive.
  Where no box lists a message, it waits for the next change or "Zálohovat nyní", and the status line
  shows the older time.

- **FR-018 (backups are not free) — new 2026-09-08 (user):** Every backup is a whole copy of the
  archive, so the app MUST NOT accumulate them: *"keeping the backups indefinitely is a no go, if
  someone has a big archive, it will eat so much space"*. Default is ONE. Keeping more is opt-in, with
  a chosen count capped at five, and adding one past the limit deletes the oldest. Lowering the limit
  MUST take effect immediately, not at the next backup. Pruning MUST happen only AFTER a new backup is
  written, so no moment exists where the phone holds none. The user MUST be able to delete a single
  backup — by swiping it away or from the opened row — and be asked first. Every one of these controls
  MUST have a sensible default and stay out of the way of someone who wants none of them.

  *Amended 2026-09-15 (T030):* retention MUST NOT delete a backup that a restore from this phone's store
  could not bring every document back from (constitution IV). Such a backup is held from before the
  restore writes its first row, because an app closed during the documents leaves rows without them,
  until a restore from it brings every document back or the person deletes it. It does not count
  against the limit. The backup screen says so on its row, in the question before deleting it, and in
  the question before lowering the limit. Which backups are held is kept on this phone only and never
  travels in a backup. *Reviewed the same day:* a document left with no message to belong to counts as
  not brought back, as the transfer counts it, and holding, letting go and retention take turns, so none
  of them works from a list another has just changed.

- **FR-008 (state its own scope) — new 2026-09-08:** The backup UI MUST say what a backup contains
  **and what it does not**, at the moment it is enabled and wherever its status is shown. Following
  FR-004's tiering, "backed up" without documents is a materially different promise from "backed up",
  and the user is the only one who can decide whether that is enough (Principle VI).

## Key Entities

*Amended 2026-09-14 to what was built (`schema.ts`, `backupService.ts`).*

- **BackupBlob** — the opaque, client-side-encrypted archive, stored wherever the SyncTarget puts it.
- **BackupManifest** — non-sensitive metadata (format and schema versions, app version, created-at,
  archive size, tiers included, document count and size) needed to list/choose a backup without
  decrypting it. There is no device label.
- **RecoveryKey / Passphrase** — the user-held secret that derives the encryption key; the basis for
  cross-device restore (FR-002).
- **SyncTarget** — the destination seam (`backupService.ts`). Built: `fileSyncTarget` (a directory in
  the app's documents, plus export/import to a user-chosen file). Planned: iCloud on iOS, Drive
  `appDataFolder` on Android (T015/T016).

## Success Criteria *(mandatory)*

- **SC-001:** A backup made on one device can be fully restored on a second same-ecosystem device
  using only the recovery passphrase + the user's own cloud account.
- **SC-002:** The stored blob is provably unreadable without the passphrase (inspecting the cloud
  object reveals no message content, box IDs, names, or credentials).
- **SC-003:** A failed/interrupted restore leaves the existing local archive intact (no partial
  corruption).
- **SC-004:** No message data or credential ever transits a project-operated server (verifiable from
  network traces: ~~only Apple/Google endpoints~~ *amended 2026-09-14:* a cloud backup reaches only the
  chosen provider's endpoints; a 025 phone-to-phone transfer may also reach croc's third-party relay,
  which sees only ciphertext).

## Decisions that are the user's, not the implementer's *(2026-09-08)*

Everything above can be built without these; none of it can SHIP without them:

1. ~~**Which ecosystem first.**~~ **Decided 2026-09-08 (user): both.** Android is verified on the
   emulator (without audio); iOS is verified by the user on their iPhone. The entitlement constraint
   is unchanged and stays recorded: an unsigned sideload build cannot carry an iCloud container, so
   the iOS target's verification depends on the user's own signing path.
2. ~~**Whether Tier 2 (attachments) is in v1 at all**~~ — **decided 2026-09-08: both, as a user
   choice.** Tier 1 always; documents opt-in, with their size shown first. The engineering that
   follows (per-file sealing, chunked native encryption, keyed content addressing) is in `plan.md`
   Phase 2b.
3. ~~**Recovery-key UX**~~ **Decided 2026-09-08 (user): a passphrase the app generates and then keeps
   showable.** The generated key stays (it has no weak instances), but "written down once and never
   shown again" is dropped: it is viewable behind device authentication (FR-013) and transferable by
   QR (FR-014). That combination is strictly better than a chosen passphrase — the strength of a
   CSPRNG with none of the transcription.

## Open / Deferred

- **Cross-ecosystem** (iPhone ↔ Android) sync — needs a neutral store we won't operate; deferred.
- ~~**Attachment backup strategy** — store vs. re-download; size/cost tiering.~~ Decided 2026-09-08
  (FR-004): both tiers, documents opt-in; built 2026-09-12 (T018–T024).
- **Live conflict resolution** for US3 continuous sync (last-writer-wins vs. merge on an append-mostly
  archive).
- **Key rotation / passphrase change** without re-uploading the whole archive.
- **Platform plumbing/entitlements:** iCloud container entitlement; Google Drive OAuth scopes +
  Google's security review for `drive.appdata`.
