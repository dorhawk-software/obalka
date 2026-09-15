# Tasks: Encrypted backup & restore (006)

Ordered by `plan.md`: envelope → snapshot → file target → cloud. Everything through T014 is testable
without a device, a cloud account or an entitlement.

## Phase 1 — the envelope

- [x] T001 Add `@noble/hashes` + `@noble/ciphers` (pure JS, MIT — no native module, so no rebuild and
  they run in jest). Regenerate attributions. **Done 2026-09-08.** Note: the attribution list is
  UNCHANGED, correctly — nothing in the app imports the backup module yet, so neither library is in
  the bundle. They will appear the moment Phase 3 wires it to a screen, which is the scanner working
  as intended rather than a miss. Jest's `transformIgnorePatterns` needed `@noble` added; both ship
  ESM.
- [x] T002 **Done 2026-09-08.** `src/services/backup/envelope.ts` — versioned header (`magic | formatVersion | kdfParams |
  salt | nonce`), Argon2id → XChaCha20-Poly1305. KDF parameters are WRITTEN INTO the header, never
  assumed, so they can be raised later without orphaning old backups.
- [x] T003 **Done 2026-09-08.** `recoveryKey.ts` — generate (CSPRNG), format for display in groups, parse back tolerantly
  (case, spacing, the 0/O and 1/l confusions people actually make when copying by hand).
- [x] T004 **Done 2026-09-08** (19 tests across the envelope and the key). Tests: round-trip; wrong key fails as *authentication* not garbage; a flipped byte anywhere
  fails; a future `formatVersion` is refused with a reason; the header's KDF parameters are the ones
  used.
- [x] T005 **Done 2026-09-08.** Measured, and then fixed. Pure JS at the shipped cost (m=64 MiB, t=3)
  took **~10–12 s** for a whole backup on the x86_64 emulator — essentially all of it the KDF — against
  1.27 s for the same derivation in Node. Hermes has no JIT; @noble is not the problem, the interpreter
  is. The fix is the platform's native Argon2 (`react-native-argon2` → argon2kt / Argon2Swift): the
  encryption stage no longer appears between one-second UI samples at all, and the parameters are
  unchanged, so nothing about the format or its strength moved.
  The native library is gated on a **known-answer check against @noble** at first use (cheap params,
  ~1 ms, once per launch) — two implementations of the same format now exist, and an archive sealed by
  one must open through the other. A native build that disagreed would be refused in favour of the JS
  path rather than writing archives only one phone can read. Pure JS was the first choice because the
  KDF runs once per operation; the measurement above moved it to native, with `@noble` kept as the
  fallback and the reference.

## Phase 2a — the compatibility contract (FR-009…FR-012)

- [x] T025 **Done 2026-09-08.** `schema.ts` — `BACKUP_SCHEMA_VERSION` and the payload shape, kept
  SEPARATE from the envelope's `formatVersion`: a cipher change and a new column are different events,
  and one number for both would either force a re-encryption to add a field or let a field change slip
  in under a version that says nothing changed.
- [x] T026 **Done 2026-09-08.** `migrate.ts` — the verdict from the MANIFEST alone (so a gigabyte is
  never downloaded to discover it is unreadable), the migration chain, and `assertChainCovers()`.
  Older backups migrate forward; newer ones are refused with the remedy named, never half-read.
- [x] T027 **Done 2026-09-08.** The drift guard: a checked-in fingerprint of the snapshot shape, which
  fails with instructions — bump the version, add the migration, re-pin — rather than a diff. Verified
  by adding a field and watching it fire. Order-insensitive, so it never cries wolf over formatting.
- [x] T028 **Done 2026-09-13**, on the first occasion it could be: `BACKUP_SCHEMA_VERSION` moved to 2
  for Tier 2, so there is now an older version to be golden about.
  `__tests__/backup/fixtures/schema-v1.obalka` is a real version 1 backup — not one today's code
  wrote and labelled 1. `scripts/make-backup-fixture.mjs` checks `c747297` (pre-publication history; the last commit before the
  bump) out into a git worktree, runs the payload writer and envelope that were there, and brings the
  bytes back; it refuses if the ref's declared version is not the one asked for, which is the single
  mistake that would make the exercise pointless.
  Six cases in `goldenRestore.test.ts`: it opens under its OWN Argon2id parameters (8 MiB, against
  today's 64 — the costs travel in the header, and nothing else in the suite proves that); it really
  predates documents, asserted as `'documents' in raw === false` rather than "empty"; the manifest
  alone says migratable; it restores row for row with `activeBoxId` correctly absent and no
  `sessionCookie` anywhere; it goes through `restoreBackup` — the function the app calls — with the
  Tier 2 machinery wired to throw if touched; and an older backup restored over a message whose body
  has since been downloaded does not blank it.
  Mutation-tested rather than assumed: deleting the v1 migration fails it, and swapping the two
  clauses of `!payload.documentKey || payload.documents.length === 0` fails it too — that line reads a
  `.length` off a field version 1 never had, and is safe only because the migration puts an empty
  array there first.

## Phase 2 — the snapshot

- [x] T006 **Done 2026-09-08.** `snapshot.ts` — build a manifest + bytes from `accounts` (**minus `sessionCookie`**, FR-007
  as amended), `messages`, `drafts`, `reminders`, `app_settings`.
  *Amended 2026-09-15 (001 T037 review), in code and tests, not walked on a device:* **device-local
  settings are one list, and a restore skips them too.** The snapshot left out `activeBoxId` alone and
  a restore wrote back every setting a payload held. `DEVICE_LOCAL_SETTINGS`
  (`app/settings/settingsKeys.ts`) now lists `activeBoxId`, `unifiedInbox` (where this phone was last
  looking, as the active box is), `appLock` and `unfinishedRemovals`. The app lock follows the vault
  key, a Keychain item of the phone that no backup carries: restored as "on", it put a lock screen in
  front of a phone whose key had not travelled, and its unlock moved that phone's own key behind a
  prompt nobody had switched on there. The mark of a box removal that did not finish belongs to this
  phone as well: restored with an archive, it could clear a box the backup brought back (001 T037).
  `restorePayload` skips the same keys, so a backup made before a key joined the list does not bring it
  back, and `settingsRestored` counts only what was written. Tests:
  `__tests__/backup/deviceLocalSettings.test.ts` - "are left out of a snapshot, while every other
  setting goes in", "are skipped by a restore of a backup that still carries them", "keeps what this
  phone already had for them" and "do not arm the app lock on a phone whose vault key did not travel"
  (a real `Vault` over the restored settings hands out its key with no prompt) fail against the code
  before the change. *Review 2026-09-15, in code and tests, not walked on a device:* the diagnostics
  answer (`telemetry`) joins the list. A restore or a transfer is reached only from a box's screens,
  after this phone has answered the diagnostics question (`TelemetryConsent`), so restoring the setting
  could only replace this phone's answer with the other phone's: a "yes" there overwrote a "no" here,
  and reports went out from the next launch on. The consent covers what the SDK stores and sends from
  this device (ePrivacy, see `TelemetryConsent.tsx`). Test: `deviceLocalSettings.test.ts`, "keep the
  diagnostics answer given on this phone when the backup says yes", which fails against the list
  without it.
- [x] T007 **Done 2026-09-08.** Extend `__tests__/security/noPlaintextSecrets.test.ts` to the snapshot: a new place a secret
  can leak is a new place that suite has to look.
- [x] T008 **Done 2026-09-08** (atomicity via ONE TRANSACTION rather than the plan's write-a-new-file-and-swap: the stores share a single DB, so a transaction is the mechanism that already exists and the one SQLite guarantees). `restore.ts` — staged: decrypt → verify → write a NEW database → swap. Never a partial write
  over a live archive (FR-006, Principle IV).
  *Amended 2026-09-15 (001 T037), in code and tests, not walked on a device:* **a restore never runs
  beside a box removal.** The backup screen's restore and a phone transfer's save (`runRestore`, 025)
  wait for the removals queued before them, and a removal asked for meanwhile waits for the restore to
  end (`RemovalQueue.runApart`, wrapped around `BackupController.restore` and `runRestore` in
  `deps.ts`). A removal asks the store before each purge whether its box is listed, so a restore that
  brought the box back just after that question lost what it had written to the purge, and a removal
  started during a restore could clear a box the restore was still writing documents for. Tests:
  `__tests__/accounts/removalQueue.test.ts` ('work kept apart from removals') and
  `__tests__/backup/restoreApartFromRemovals.test.ts`, which fail against the code before the change.
  *Not done (2026-09-15):* a restore waiting for a removal shows no progress until it starts - its
  button says it is working (`backup.working`), but the run is published when it starts (`track`).
  *Left, 2026-09-24:* the button says it is working the whole time, so nothing claims the restore has
  not started or has ended. Showing a waiting state needs a run published
  before `RemovalQueue.runApart` lets the restore in, which must then not hide a backup that is running,
  and on a phone with backups off the progress row is not drawn at all, so it would appear from nothing
  (constitution V). More than this gap is worth; recorded rather than forced.
- [x] T009 **Done 2026-09-08**, plus a second rule the plan did not have: **never replace something with nothing**. The case that forced it — a local message whose attachments have been downloaded, restored over by an older backup — would blank `detailJson`, orphan the files on disk, and cost the user the documents the backup exists to protect. Restore is **additive** by default: local messages absent from the backup survive it. The
  archive is append-mostly, and a restore that deletes them is data loss wearing a feature's clothes.
- [x] T010 **Done 2026-09-08** (14 tests). Tests: restore into a populated archive; a mid-way failure leaves the original byte-identical;
  a snapshot round-trips through Phase 1 unchanged.

## Phase 2b — the documents (Tier 2) — decided in v1 as a user choice, 2026-09-08

- [x] T018 **Done 2026-09-12.** `react-native-quick-crypto` (JSI/OpenSSL, hardware AES) — the ONLY new
  native dependency this feature takes, and only because pure JS at gigabyte scale is what
  `research.md` §3 ruled out. The KDF did not need it (T005 took the native-Argon2 route).
  NOT the envelope's XChaCha20-Poly1305, and that was measured rather than chosen: quick-crypto lists
  the algorithm but its default build does not link libsodium, so on a device it answers
  `XChaCha20Poly1305Cipher: libsodium must be enabled (BLSALLOC_SODIUM)`. `aes-256-gcm` works and is
  hardware-accelerated, so Tier 2 uses a different primitive from Tier 1 — a real cost, paid instead
  of doing tens of megabytes of AEAD on the JS thread (Principle I).
  Cross-implementation compatibility was PROVEN, not assumed: 100 bytes sealed natively on the
  emulator, the hex pulled off the device, opened byte-identically by `@noble` in node, and committed
  as `__tests__/backup/nativeSealedFixture.test.ts`. Measured on device: 8 MB seal/open at
  `native=true`, open ≈440 MB/s.
  **Permission/entitlement delta (as 010 T027 did), 2026-09-12: +0, −0.** `aapt2 dump permissions` on
  the rebuilt debug APK lists the same 15 as before (the 010 T001 baseline of 12, plus
  POST_NOTIFICATIONS and RECEIVE_BOOT_COMPLETED from 010 T027, plus HIDE_OVERLAY_WINDOWS). Both new
  libraries ship an empty `AndroidManifest.xml` and neither podspec asks for an entitlement.
  Cost recorded honestly: the debug x86_64 APK grew 95 MB → 107 MB (OpenSSL), and the JS bundle gained
  43 npm packages (buffer, readable-stream and their tree), which is why `ATTRIBUTIONS`/
  `bundled-modules.json` moved from 186 to 229 distributed components.
- [x] T019 **Done 2026-09-12.** `fileSeal.ts` — per-file, chunked sealing, 1 MiB chunks, each with its
  own tag and its chunk index in the AAD, final chunk marked so truncation at a boundary is caught.
  The nonce is the counter and nothing else, which is only safe because the KEY is per-file: AES-GCM's
  nonce is 96 bits, too little to hold both per-file randomness and a counter, so the randomness moved
  into a 16-byte HKDF salt carried in the header.
  Two defects found and pinned: the sealer sealed each piece its SOURCE handed it as one chunk (a
  filesystem hands back whatever it happens to read, so the file's header promised 1 MiB chunks and
  its body was nothing of the sort, and every reader refused a document that was perfectly intact);
  and the reader treated a short answer as the end of the stream, which is what reading over a network
  does all the time. It now re-chunks to what the header says and reads until it has what it asked for.
- [x] T020 **Done 2026-09-12.** Keyed content addressing: an HMAC-SHA256 of the content under a key
  only the user has, NOT a plain hash. Government mail contains many identical documents — every box
  gets the same ISDS welcome letter — and a plain hash would let whoever holds the storage hash a
  document they already have and learn whether it is in there, without decrypting anything. Named
  while streaming, never by assembling the file. Objects are `doc-<32 hex>`: no extension, no size, no
  date, so the name is not a second channel. Confirmed on the emulator: the same nine files backed up
  under two different installs produced two entirely unrelated sets of names.
- [x] T021 **Done 2026-09-12.** Resumable upload: an object already present is not re-uploaded; an
  interrupted backup continues. TWO passes per file — the first names it, the second seals it, and the
  second runs only when the name turns out to be new. Sealing as it names would mean writing a full
  sealed copy of every attachment on every backup and throwing almost all of it away, which is exactly
  the cost this removes. Two reads and no writes is the right shape for the case that happens every
  time: nothing has changed.
  Walked on the emulator: first run wrote 9 objects (19:48), the second run wrote only a new archive
  (19:50) and left every object's mtime untouched.
- [x] T022 **Done 2026-09-12.** Restore of Tier 2: documents land back in
  `files/attachments/<boxId>/<messageId>/` and the restore REPOINTS `detailJson` at where they
  actually landed — `localPath` is an absolute path recorded on another device, and on iOS the app
  container's directory changes on every reinstall, so restoring the bytes without rewriting it would
  put documents on disk that nothing in the app could ever open. Written to `<name>.part` and moved
  into place only once the whole file verifies. A message this device does not have is counted as
  orphaned rather than littered to disk, and a per-file failure costs one document: the report tells
  restored / missing / orphaned / failed apart, because a restore that silently drops documents is the
  failure this whole feature exists to prevent.
  Walked on the emulator: 9 documents deleted from disk, restored from the store, every file back at
  its exact original size, no `.part` left behind, "Obnoveno: 19 zpráv, 3 schránky, 9 souborů.", and a
  3,8 MB attachment opening from the message detail afterwards.
- [x] T023 **Done 2026-09-12.** Tests: chunk-boundary sizes (0, 1 byte, exactly one chunk, one chunk
  + 1, several exactly), a truncated file, a reordered chunk, a chunk spliced in from another file
  under the same key, an edited chunk size in the header, ragged source pieces, a reader that answers
  short — and a re-backup of an unchanged archive uploading nothing. `__tests__/backup/documents.test.ts`
  and `fileSeal.test.ts`.
- [x] T024 **Done 2026-09-12.** The switch: off by default, size shown BEFORE it is enabled, and the
  backup status names which tier it holds (FR-008). Turning it on asks, with a MEASURED number in the
  question — ISDS's `attachmentSize` is what the message weighed on the server, not what is on this
  phone, and most messages have never had their documents downloaded at all. Turning it off is
  immediate: the objects already stored are left where they are. The switch is absent, not disabled,
  where the destination has no object store.
  Walked on the emulator: "Stažené přílohy zaberou navíc přibližně 6,9 MB (9 souborů)" against a store
  that then measured 7 187 132 B — the estimate is arithmetic on the file lengths, so it cannot drift,
  and a test holds the two against each other. Status line: "Naposledy 12.09.2026 20:17 · 14 kB +
  přílohy 6,9 MB".
  Found on that walk and fixed: `backupFs.ensureDir` was `exists` then `mkdir`, and the backup screen
  asks for the status and the restore list in the same breath — both listed the backup directory, both
  saw "not there", and blob-util's `mkdir` THROWS when it already exists, so the loser rejected and
  took the screen's whole refresh with it. On a phone's first visit the switch read "off" and the list
  read "no backups" when neither had been established. `ensureDir` is now idempotent and the screen's
  three reads are independent, with a test for each.

## Phase 3 — a target that is not the cloud

- [x] T011a **Done 2026-09-08.** The `SyncTarget` seam + `backupService.ts` (create / list / restore),
  and `stores.ts` binding the source and sink to the app's real stores. Built from methods that already
  exist rather than new import SQL: `cacheList` upserts, prunes nothing, and preserves
  `detailJson`/`downloadedAt` — the additive and never-replace-something-with-nothing rules already
  implemented at the storage layer, so a parallel import path would have meant re-deciding both in the
  place where getting them wrong destroys an archive.
- [x] T011b **Done 2026-09-08.** `fileTarget.ts` — the filesystem is an injected `BackupFs` (blob-util
  in `deps.ts`, chunked base64 because `String.fromCharCode(...bytes)` overflows the stack on a
  multi-megabyte array), so the LOGIC is testable in jest even though the wiring is native. The archive
  is written BEFORE the manifest: an interruption then leaves an invisible orphan rather than a listed
  backup pointing at bytes that were never finished, and one corrupt manifest does not hide the others.
- [x] T012a **Done 2026-09-08**, with one change of library. `react-native-qrcode-svg` takes its `logo`
  as a raster image source, which would have made the mark the only non-vector thing on the screen; so
  the matrix comes from `qrcode-generator` (MIT, 2 KB, no deps, no browser globals) and `theme/QrCode.tsx`
  draws it — one `Path` for every dark module rather than hundreds of `<Rect>` shadow nodes, with the
  centre modules OMITTED so nothing shows through at the plate's edge. Level H as required; the inlay is
  7 of 29 modules (~24%). The payload is `OBALKA:` + the key, in QR **alphanumeric** mode (the key's
  alphabet, the dashes and the colon are all inside that charset), which fits a 29×29 symbol — big
  modules, easy to scan across a table. The prefix is what lets a scanner reject every other code in the
  world instead of reporting "wrong password" for a bus timetable.
  **Verified by decoding, not by arithmetic**: the tests rasterize the matrix and read it back with jsQR
  (dev-only), including with a 9×9 hole — larger than the renderer's — punched in the middle. The mark is
  a second copy of the paths in `src/assets/logo.svg` (the transformer bakes its fills, so a black-and-white
  version cannot reuse the import); `__tests__/theme/obalkaMark.test.ts` fails if the two ever diverge.
- [x] T012b **Done 2026-09-13, and it cost nothing in the end.** Showing the recovery key as a QR
  has worked since T012a; READING one needed a camera, which is why this sat open — and the price
  measured here on 2026-09-13 was **+15.54 MB and the app's first camera permission**, twice what
  025's whole croc transport costs. The breakdown, still true: `libVisionCamera.so` 5.65 MB,
  MLKit's bundled `libbarhopper_v3.so` 4.72 MB, 0.88 MB of tflite models, CameraX in dex. (ML Kit
  was removed on 2026-09-24 - see the amendment of that date at the end.)

  What changed is that **025 bought the camera anyway**, for scanning a transfer phrase, so this
  feature is now a parser and a button rather than a dependency. The scanner takes its parser as a
  parameter, so the same viewfinder reads a transfer phrase and a recovery key without either knowing
  about the other — which matters beyond tidiness, because the two codes carry different prefixes
  precisely so one cannot be mistaken for the other, and a scanner hard-wired to one would have grown
  a mode flag to serve both.

  A scanned key goes into the FIELD, never straight into a restore: 021's rule for 021's reason, that
  a misread which acts on itself spends an attempt the user cannot get back. Typing stays available
  regardless — the phone showing the code may be the lost one — and the button is absent, not
  disabled, where no camera exists.

- [x] T012 **Done 2026-09-08.** `BackupScreen`, reached from a row in Settings, driven by
  `BackupController` (`features/backup/state/`) so the screen holds no crypto and no key handling.
  Deviates from the plan on one point: the recovery key is NOT "shown once". It is stored behind the OS
  gate and can be shown again — a key nobody can look up is one that gets photographed or lost while the
  phone still works, and the device copy costs nothing, since anyone who can pass the prompt on an
  unlocked phone can already read the archive.
  What the backup does not hold is on the same screen as the switch (FR-008); a backup this build cannot
  read is listed, greyed, with its reason (FR-011); enabling makes the first backup at once and stays OFF
  if that fails; turning it off forgets the key and leaves every archive alone (Principle IV). A phone
  with no screen lock gets an instruction ("set a PIN, pattern or fingerprint") rather than "the backup
  could not be created" — `canProtect()` asks `isPasscodeAuthAvailable`, so a phone with a PIN and no
  fingerprint is not refused.
  **Walked on the Android emulator 2026-09-08** (release APK, x86_64, device PIN set, no audio), against
  a signed-in czebox test box: switch on → OS gate → first archive written; "Naposledy … · 2 kB"; back up
  now → a second archive; reveal → OS gate → the key on screen; QR shown; restore from the list with the
  stored key → "Obnoveno: 4 zprávy, 1 schránka." The QR was verified by DECODING it out of the device
  screenshot (`OBALKA:E3N9-…`), not by looking at it.
  Three defects the walk found, all fixed and guarded: the screen was unreachable (registry/navigator
  drift — see `__tests__/app/routeRegistry.test.tsx`); the reveal could never succeed on a phone with a
  PIN and no fingerprint (`__tests__/security/keychainPrompts.test.ts`); and the restore threw
  `ReferenceError: Property 'TextDecoder' doesn't exist` on Hermes while telling the user to check a
  correct password (`__tests__/security/hermesGlobals.test.ts`).
- [x] T029 **Done 2026-09-08 (user, FR-015/FR-016).** Progress and cancellation. The KDF moved to
  `argon2idAsync` with a 16 ms tick — it had been holding the JS thread for the whole derivation, so no
  bar could have moved even if one had existed. `buildPayload` now enumerates envelopes first and reads
  bodies second, which is what makes "x z y" the real number of messages rather than a growing total.
  The run lives in `BackupController` (subscribe/currentRun/cancelRun), so leaving the screen asks
  "keep it running or cancel it?" and both answers work; cancellation is cooperative and checked
  between steps, including inside the KDF tick. Walked on the emulator: the bar advances frame by
  frame, "Nechat běžet" completed a backup with the screen closed, and "Zrušit zálohu" left the archive
  count unchanged. That walk also found `t('common.cancel')` rendering as `COMMON.CANCEL` on a real
  button — now guarded by `__tests__/i18n/keysExist.test.ts`.
- [x] T030 **Done (FR-017).** Automatic backup: a change to the archive (a sync that brought messages,
  a downloaded document) calls `backupController.archiveChanged()` via `onArchiveChanged` in
  `deps.ts`, which runs one silent foreground backup after an 8 s settle delay. The setting is on by
  default but acts only once backups are enabled (FR-005), and can be switched off on the backup
  screen. A failure is reported to telemetry, not to the user. The passphrase is stored twice
  (`cz.obalka.backupkey.use` for the app, `cz.obalka.backupkey` behind the OS gate).
  *Amended 2026-09-15 (025 edge-case pass), in code and tests, not walked on a device:* **one run at a
  time.** An automatic backup waited only for a run it could see, and a phone-to-phone transfer's save
  was not one, so a backup could start while the transfer was writing the archive (025 T021). Nor did a
  run wait for another: a restore or a manual backup started while an automatic backup was still
  reading ran beside it. `BackupController` now lets one run go at a time, a run asked for during
  another waiting for it; a transfer's save runs through it as a restore that cannot be cancelled
  (`runRestore`); and the backup screen offers no stop for such a run. Tests:
  `__tests__/backup/backupController.test.ts`, "one run at a time" (2);
  `__tests__/app/backupScreenTransfer.test.tsx`, "just leaves, instead of offering a stop that does
  nothing". Each fails against the code before the change.
  ~~**Found and not fixed in this pass:** the backup screen's own restore keeps the keys after the archive
  is written, and a declined screen-lock prompt there rejects the whole `restore`, so the screen shows
  `backup.restore.error` for a restore that succeeded. The transfer reports the same case as `keysFailed`
  (025 T014).~~ Fixed in the review below.
  *Reviewed the same day (2026-09-15), in code and tests, not walked on a device:* **a password that was
  not kept is not a failed restore.** `restore` keeps the keys through `keepRestoredKeys`, now shared with
  the transfer (025 T014), and resolves with `keysFailed` instead of rejecting. The screen says "Heslo k
  záloze se ale do tohoto telefonu nepodařilo uložit, takže telefon zatím nezálohuje."
  (`backup.restored.keyNotSaved`) beside the result. A declined prompt is traced as `backup.restore` with
  `outcome: 'declined'`, and any other failure is reported. Switching backups on and declining the
  screen lock no longer says "Zálohu se nepodařilo vytvořit.": the screen treats
  `BackupPromptDeclinedError` as it treats a dismissed prompt, and says nothing. Tests:
  `__tests__/backup/backupController.test.ts`, "a restore whose password cannot be kept" (2);
  `__tests__/app/backupScreenKeys.test.tsx` (2). Each fails against the code before the change.
  *Backup polish, the same day (2026-09-15), in code and tests, not walked on a device:*
  * **A stop reaches the run it was meant for, waiting or running.** Starting a run reset the one stop
    flag, so pressing "Zálohovat nyní" during an automatic backup and then leaving with "Zrušit zálohu"
    stopped the automatic backup, while the manual backup waiting behind it started with a fresh flag
    and ran to the end. Every run now has its own flag from the moment it is asked for (`stops`), and
    `cancelRun` raises the flag of the run in progress and of every run waiting for it. A run stopped
    while it waits never starts; a run asked for after the stop is not stopped by it. A stopped
    automatic backup is no longer reported to telemetry as a failure, as `BackupAbortedError` already
    promised.
  * **A restore is a change to the archive.** Decided from FR-017: the switch promises that the archive
    keeps itself backed up, a restore writes rows and documents into it as a sync does, and it is work
    the user started in the foreground, so 014's background argument does not arise. Nothing scheduled
    a backup after one, so a phone that kept the key arriving with a transfer showed backups on with no
    backup of what arrived until the archive next changed. A transfer's save (`runRestore`) and the
    backup screen's restore now call `archiveChanged` once the run has ended, with rows, documents and
    keys all in. A restore that failed or was stopped schedules nothing, and the backup waits the usual
    8 s of quiet and for any run still going, so it neither reads a half-restored archive nor overlaps
    another run. One exception, for the backup screen's restore only: when a document did not come back
    (`missing` or `failed`), nothing is scheduled. The backup it came from is in this phone's own store
    and still holds that document, and under the default retention of one the automatic backup would
    replace it, and with it the only way of getting the document back by restoring again. What a
    transfer brought is not in this phone's store, so a save schedules a backup either way.
  * **A restore can be stopped until its rows are in, and not after.** The rows commit in one
    transaction and the documents are written afterwards, so a stop that reached the documents threw
    between two of them and left the messages restored without their documents, against FR-016.
    `restoreBackup` now reports the documents stage before the first document and does not pass the stop
    on from there. The controller lets go of the restore's flag at that report and the run it publishes
    reads `cancellable` at every report, so from then on leaving the backup screen just leaves, as it
    does during a transfer's save (025 FR-012).
  * **"1 přílohu se nepodařilo obnovit."** `backup.restored.someMissing` had one Czech form, "{n} příloh
    se nepodařilo obnovit.", for every count. It is now `.one` / `.few` / `.many` ("1 přílohu", "{n}
    přílohy", "{n} příloh", in the accusative the sentence takes, as `transfer.done.missing` already
    was) and `.one` / `.other` in English. The sentence the screen builds moved into `restoredText`
    (`app/settings/BackupScreen.tsx`), so its agreement is tested without rendering the screen.
  * Tests: `__tests__/backup/backupController.test.ts`, "stops a backup asked for during an automatic
    backup, not only the automatic one", "backs up what a transfer s save wrote once the save has ended,
    and nothing after a save that failed", "backs up after a restore from this phone s store once every
    document came back, and not while that backup still holds one that did not" and "can be stopped
    until its rows are in, and then writes its documents to the end"; `__tests__/i18n/czechAgreement.test.ts`,
    `backup.restored.someMissing` in `COUNTED` (2) and "agrees in the sentence a restore ends with". Each
    fails against the code before the change: the waiting backup ran, no backup followed the save or the
    whole restore, the second restore rejected with "The backup was cancelled.", and the plural family
    and `restoredText` did not exist.
  *Reviewed the same day (2026-09-15), in code and tests, not walked on a device.* The four changes
  above hold: each new test fails against the sources at 5e03e03 (checked by putting back
  `backupController.ts`, `backupService.ts`, `BackupScreen.tsx` and `strings.ts`: 7 failed). "1 přílohu"
  rather than "1 příloha" is right for this sentence, which takes the accusative, as
  `transfer.done.missing` does. The review found two more, and fixed both:
  * **A stop that came too late for a restore was dropped without a word.** The leave dialog is opened
    while the restore can still be stopped, and it stays open while the restore gets past its rows. A
    "Zrušit zálohu" pressed after that stopped nothing and left the screen silently, so someone who chose
    to cancel believed the restore had been called off. `cancelRun` now returns whether the run in
    progress will stop. When it will not, the screen shows "Obnovu už nejde zastavit, dokončí se na
    pozadí." (`backup.leave.notStopped`) in a snackbar, which is drawn above the navigator and so stays
    visible after leaving. The screen's leave dialog now uses `leaveDialogActions`. Before this it used an
    inline copy, so the builder the tests covered was not the one on screen.
  * **An automatic backup could reject with nobody to catch it.** `autoBackup` runs from a timer that
    nothing awaits, and it read the preferences, a database read, before its `try`. A rejection there
    was unhandled (constitution II), and restores now schedule it as well as syncs. The whole body is
    inside the `try` now, and the failure is reported as `backup.snapshot`, like any other automatic
    backup failure.
  * Tests: `__tests__/app/backupDialogActions.test.ts`, "\"cancel\" says the run goes on when it came too
    late to stop it"; `__tests__/backup/backupController.test.ts`, "reports the failed read rather than
    letting it escape unhandled", and "can be stopped until its rows are in" now also checks what
    `cancelRun` returns on each side of that point, and that a stopped restore schedules no backup. Each
    fails against the code at 62e5e18.
  * **Checked and left:** the backup screen's restore still keeps its keys after its run has ended,
    where the transfer's save keeps them inside its run. An automatic backup could only start in that gap
    if its timer landed within the few database reads it takes, and it would have to mint a document key
    before those reads finished. That is shorter than the automatic backup's own reads of preferences
    and the Keychain, so the gap was not closed.
  *Backup follow-ups, the same day (2026-09-15), in code and tests, not walked on a device:*
  * **Retention no longer deletes the backup a restore could not bring every document back from**
    (constitution IV). After a backup-screen restore that left a document behind, the next change to
    the archive scheduled an automatic backup, and under the default retention of one it replaced the
    backup still holding that document, which was then gone for good. Not scheduling a backup straight
    after the restore had only moved that to the next sync. Such a backup is now *held*: its archive
    name goes into `backup.held`, a list in the settings table, and `pruneBackups` sets held backups
    aside before counting, so none is deleted and none takes one of the `keep` places. It is held from
    before the restore writes its first row, not once the documents are counted: the documents come
    after the rows and can take minutes, and an app closed part-way leaves rows without them. The hold
    goes when a restore from that backup brings every document back, or when the person deletes it. A
    restore that fails or is stopped before its rows are in wrote nothing, so a hold it added goes too,
    while one an earlier restore left stays. A hold that cannot be stored refuses the restore before the
    backup is read. When the holds cannot be read, retention deletes nothing and reports it as
    `backup.snapshot`, and the list marks nothing held. Only backups with documents are held, and a
    transfer's save holds none, because what arrived is not in this phone's store. `backup.held` joins
    `activeBoxId` as a setting that never travels in a backup: carried, a restore wrote the holds of the
    day that backup was made over today's. With the backup it came from held, the backup screen's
    restore now schedules an automatic backup even when a document did not come back (FR-017 amended).
    The screen says it where it shows. The result ends "Záloha, ze které jste obnovovali, se proto sama
    nesmaže, dokud z ní obnova neproběhne celá nebo dokud ji nesmažete." (`backup.restored.held`). The
    held row reads "Nesmaže se sama: drží přílohy, které se z ní nepodařilo obnovit."
    (`backup.restore.held`). Deleting it asks with `backup.delete.body.held`. Lowering the limit counts
    only the backups that are not held, and when one stays the question adds "Záloha s přílohami, které
    se nepodařilo obnovit, zůstane také." (`backup.prune.held.*`, three Czech forms).
  * **A restore left with "Nechat běžet" is said when it ends.** Leaving unmounted the screen, and
    nothing said how the restore ended, whether it worked or failed. `BackupController` now keeps the
    outcome of the backup screen's restore (`takeRestoreOutcome`, `subscribeRestoreOutcome`), the way
    `TransferController` keeps a save's (025), and a stopped restore keeps none. The screen that started
    the restore takes it and says it as before while it is mounted. Otherwise the backup screen says it
    the next time it is in view, in a dialog titled "Obnova ze zálohy" (`backup.restore.outcome.title`)
    with the result sentence or the error, after a transfer's outcome when both are waiting. It reads the
    list again as it takes the outcome: the backup is held or let go after the run ends, so the read the
    end of the run starts could still show it as it was.
  * **The leave question names what is running.** A restore and a verify both ran as kind `restore`, so
    both asked "Záloha ještě běží" and offered "Zrušit zálohu". A verify now runs as kind `verify`, and
    `leaveCopy` gives a restore "Obnova ještě běží" and "Zrušit obnovu", and a verify "Ověřování zálohy
    ještě běží", "Chcete ověřování nechat doběžet na pozadí, nebo ho zrušit?" and "Zrušit ověřování",
    with English at parity. The words are fixed when the question opens, so a run that ends under it
    does not change them.
  * **An automatic backup the person stopped: decided, not changed** (FR-017, *Decided 2026-09-15*).
    Evidence for "the next refresh brings it back": `listReceived` and `listSent` call
    `onArchiveChanged` whenever the list is not empty (`messagesController.ts`), the listing asks for
    the whole window ISDS keeps (`dmFromTime` nil in `soap.ts`), and `AppShell` refreshes every box at
    launch. Two limits, stated: where no box lists a message, the change waits for the next one or
    "Zálohovat nyní"; and the hook's own test says it should fire only when the archive gained
    something, so narrowing it to that would take the launch refresh away, and this should be decided
    again then.
  * Tests: `__tests__/backup/backupController.test.ts`, "the backup a restore could not bring every
    document back from" (4), "retention that cannot tell which backups are held", "how a restore ended,
    for a backup screen that did not see it end" and "a verify is not a restore";
    `__tests__/backup/snapshot.test.ts`, "leaves out which backups this phone s retention is holding";
    `__tests__/app/backupHeld.test.tsx` (3); `__tests__/app/backupRestoreOutcome.test.tsx` (4);
    `__tests__/app/backupRestoreOutcomeLive.test.tsx`;
    `__tests__/app/backupLeaveCopy.test.tsx`; `__tests__/app/backupDialogActions.test.ts`, "names what it
    would stop"; `__tests__/i18n/czechAgreement.test.ts`, `backup.prune.held` in `COUNTED` (2) and both
    sentence tests extended. Checked by putting back `backupController.ts`, `backupService.ts`,
    `snapshot.ts`, `BackupScreen.tsx` and `strings.ts` from 5fb6cc0: exactly those 22 tests fail, and the
    other 101 in the same files pass. The test "backs up after a restore from this phone s store once
    every document came back, and not while that backup still holds one that did not" is replaced by the
    first of the four, because a backup now does follow such a restore.
  *Reviewed the same day (2026-09-15), in code and tests, not walked on a device.* The four follow-ups
  hold. Every new test for them and for what the review fixed fails against 5fb6cc0: with
  `backupController.ts`, `backupService.ts`, `snapshot.ts`, `BackupScreen.tsx` and `strings.ts` put back
  in a copy of the tree, 29 fail (the 22 above and the 7 below) and the other 101 in the same files
  pass. The review found these, and fixed them:
  * **Holding, letting go and retention took no turns.** Each read `backup.held`, changed it and wrote
    it back. Beside a restore, a delete letting go of another backup wrote its older copy of the list
    over the hold the restore had just stored, and a limit lowered at that moment read the list before
    the hold and deleted the backup being restored, the one place its documents could come back from.
    They now run one at a time (`heldTurn`), retention from its read to its last delete.
  * **A document left with no message to belong to counted as back.** When its message goes while the
    documents are written (its box removed, say), the document is in the backup and not in the archive,
    and the backup was let go. `orphaned` now counts as not back, for the hold and in the sentence the
    restore ends with, as `doneText` counts it for a transfer.
  * **Some restore outcomes were still said nowhere.** The screen skipped every outcome while a restore
    of its own was going, and the controller kept one at a time, so a restore started on a later visit
    hid how the one an earlier visit left running had ended. A restore that ended as its screen went
    back (out of view at once, unmounted once the transition is over) was taken by that screen and said
    on nothing anyone could see. The screen now passes `seen`, whether it is mounted and in view, read as
    the restore ends like the transfer screen's `seenHere`. The controller keeps an outcome only when
    that answers no, keeps each one oldest first, and the screen says them one after another.
  * **A verify stopped with "Zrušit ověřování" was reported as "Zálohu se nepodařilo otevřít."** in the
    snackbar, which outlives the screen. A verify that was stopped now says nothing, as a dismissed
    prompt does. The English button reads "Cancel the check", in the question's own words.
  * Taken back out of the code: the same review's interrupted first pass had also relabelled a restore's
    documents stage and put the verify's counts into counted phrases. Neither is one of the four
    follow-ups, so both are listed below as not done. That pass's last commit carried the sources of
    a547800, and its fixes for the follow-ups were restored from 33f027b.
  * Tests: `__tests__/backup/backupController.test.ts`, "is not written over by a delete letting another
    backup go at the same moment", "is not deleted by a limit lowered at the same moment as the restore
    holds it", "is held when a document is left with no message to belong to" and "keeps nothing its
    screen was there to say, asks as the restore ends, and keeps each other one";
    `__tests__/app/backupRestoreOutcomeLive.test.tsx`, "is said even while a restore this visit started
    is still going" and "is kept for the next visit when it ends as the screen that started it goes
    back"; `__tests__/app/backupVerifyStopped.test.tsx`; and "agrees in the sentence a restore ends with"
    in `__tests__/i18n/czechAgreement.test.ts` now counts orphaned documents.
  * *Reviewed again the same day (2026-09-15), in code and tests, not walked on a device.* The fixes
    above hold, and three more were found and fixed:
    * **The outcome dialog came up over the lock screen.** It is a `Modal`, which draws in a window above
      the cover `LockGate` lays over the app, so a restore left running that ended while the app was
      locked was said over the lock screen, and a dialog still open when the app left stayed above the
      cover on return. `LockGate` now tells what is under it whether the cover is up (`useAppLocked`,
      `src/app/lock/appLocked.ts`), and the dialog waits for the unlock. The outcome is not dropped, as
      `useCloseOnBackground` drops what the person had open: nobody has pressed OK yet.
    * **A restore that ended under another screen left its backup open.** With the FAQ or the transfer
      opened over the backup screen, the outcome was kept for the dialog, and beneath the dialog the
      backup stayed open with its password still typed in. The form now closes whether or not the screen
      says the outcome itself.
    * **A screen reader never heard why a held backup stays.** The row's pressable carries its own label,
      the date, and that is all a screen reader says for the row. The label now ends with the held
      caption.
    * Tests: `__tests__/app/backupRestoreOutcomeLock.test.tsx` (2, a rendered `LockGate` over the real
      vault); `__tests__/app/backupRestoreOutcomeLive.test.tsx`, "closes the backup it restored when it
      ends under another screen, and says it once back"; and "says on its row why it stays" in
      `__tests__/app/backupHeld.test.tsx` now checks the label. Each fails with `BackupScreen.tsx` and
      `LockGate.tsx` put back from 7272ba0 in a copy of the tree, where the other three live outcome tests
      pass. With `backupController.ts`, `backupService.ts`, `snapshot.ts`, `BackupScreen.tsx`,
      `strings.ts` and `LockGate.tsx` put back from 5fb6cc0, 32 tests fail - every test these follow-ups
      and both reviews added or extended - and the other 101 in the same files pass.
  * **Checked and left:** the evidence for the FR-017 decision holds: `listReceived` and `listSent` call
    `onArchiveChanged` for a list that is not empty, `AppShell` runs `refreshAll` at launch, and
    `dmFromTime` is sent nil. One word of it did not: a stopped backup can leave documents it had already
    stored, which the next backup finds with `hasObject` and does not store again. The decision now says
    a stopped backup "leaves no backup behind" instead of "writes nothing".
  * **Not done (2026-09-15):**
    * ~~While a restore writes its documents back, the progress line and bar say "Zálohuji přílohy"
      ("Backing up documents"), the backup's words: both runs use `backup.stage.documents`.~~ *Closed
      2026-09-24:* a restore's documents stage reads "Obnovuji přílohy" (`stageText` in
      `app/settings/BackupScreen.tsx`, `backup.stage.documents.restore`). Test:
      `__tests__/i18n/czechAgreement.test.ts`, "says a restore is restoring its documents, and a backup
      that it is backing them up", which fails against the screen before the change.
    * ~~A verify's result puts bare numbers into one fixed Czech sentence, "Záloha je v pořádku: {boxes}
      schránky, {messages} zpráv.", so a backup of one box with one message reads "1 schránky, 1 zpráv".~~
      *Closed 2026-09-24:* the sentence takes the counted phrases a restore's result uses (`verifyText`),
      "1 schránka, 1 zpráva". Test: `__tests__/i18n/czechAgreement.test.ts`, "agrees in the sentence a
      verify ends with", which fails against the screen before the change.
    * A backup whose documents are not in the store at all, such as a file imported from another phone
      (it carries the archive and not the documents), is held after a restore from it. No restore from it
      can bring them back, so only deleting it lets it go, and its row says it holds documents that could
      not be restored from it, which for that copy is not quite true. It costs space and loses nothing.
      *Left, 2026-09-24:* telling it apart would mean not holding a backup whose documents are only
      `missing` from the store, and the tests above count on a missing object coming back to the store
      and a later restore from the same backup bringing it back. Which of the two a backup is for is the
      owner's call, not a fix.
    * ~~A restore can still be started on a later visit while one an earlier visit started is running:
      the button shows the run but is not disabled. The second waits its turn, and both outcomes are said.~~
      *Closed 2026-09-24:* "Obnovit" and "Použít heslo z tohoto telefonu" wait while any restore runs -
      this visit's, an earlier one's, or a transfer's save - and "Obnovit" is busy rather than disabled
      then (`restoring` in `app/settings/BackupScreen.tsx`; 023 FR-007's busy). "Zálohovat nyní" is busy
      whenever it says "Pracuji…", a backup this screen did not start included (review, the same day;
      `backupButtonsBusy.test.tsx`, "holds "Zálohovat nyní" as busy while it says "Pracuji…""). Test:
      `__tests__/app/backupButtonsBusy.test.tsx`, "holds "Obnovit" and "use the password from this
      phone" until it ends", which fails against the screen before the change.
    * ~~A restore that fails after its rows are in keeps its backup held, and the failure dialog does not
      say so; the row does.~~ *Closed 2026-09-24:* it rejects with `BackupRestoreHeldError`, which carries
      the failure as `reason`, and `restoreErrorText` adds "Záloha, ze které jste obnovovali, se sama
      nesmaže, …" (`backup.restore.error.held`) wherever the failure is said. Test:
      `__tests__/backup/backupController.test.ts`, "says the backup stays held when it fails once its rows
      are in", which fails against the code before the change.
    * The FR-017 decision rests on every listing that returns a message counting as a change to the
      archive. The message list's caching is being worked on at the same time; if a listing stops calling
      `onArchiveChanged`, the decision has to be made again. *Checked 2026-09-24:* it still does -
      `loadFolder` in `messagesController.ts` calls it for every listing that returns a message.
    * ~~Found by the second review, outside the four follow-ups: the other dialogs on the backup screen do
      not wait for the unlock. A transfer's outcome (025) that ends while the app is locked is said over
      the lock screen, and the leave, delete and limit questions stay above it when the app leaves with
      one open.~~ *Closed 2026-09-24:* the transfer's outcome waits for the unlock as a restore's does,
      and the questions a tap opens - leaving, deleting, lowering the limit, switching off, the documents
      question - close as the app goes to the background, each with its own "no"
      (`closeQuestions` with `useCloseOnBackground` in `app/settings/BackupScreen.tsx`). *Review, the
      same day:* closing reaches only a dialog already open, and two open after an await the app can
      leave during - the documents question once the measuring answers, "no screen lock" once switching
      on fails - so they could still open over the cover. Every dialog on the screen is now drawn only
      while the app is not covered (`locked`), and one that arrived meanwhile shows on return. Tests:
      `__tests__/app/backupDialogsCovered.test.tsx`, each of which fails against the screen before its
      change.
    * ~~A backup can be deleted on a later visit while a restore an earlier visit started from it is still
      writing its documents (the visit that started it ignores the delete while it is busy). The backup is
      gone, but a restore that then could not bring a document back still ends with "Záloha, ze které
      jste obnovovali, se proto sama nesmaže".~~ *Closed 2026-09-24:* the result reads the hold back
      rather than assuming it (`stillHeld`, from `restoreFromStore`) - on success, and on a failure past
      the rows, which only then rejects with `BackupRestoreHeldError` (review, the same day: the failure
      path first assumed the hold). Tests: `__tests__/backup/backupController.test.ts`, "does not call a
      backup deleted while it wrote the documents held" and "… held when it then fails", each failing
      against the code before its change.
    * ~~A lower limit whose deletes fail says nothing: the screen does not wait for `setPreferences`, and
      its rejection goes unhandled. This was so before the follow-ups.~~ *Closed 2026-09-24:* a
      preference that will not save is reported and said in the snackbar - "Starší zálohy se teď
      nepodařilo smazat. Aplikace to zkusí znovu po příští záloze." for a limit - and the screen reads the
      store again, so the switch shows what was saved. The same sweep found deleting one backup and
      switching backups off rejecting unhandled the same way; both now say so on the error line
      (`backup.delete.failed`, `backup.off.failed`). Test: `__tests__/app/backupSilentFailures.test.tsx`,
      each of which fails against the screen before the change.
    * *Found and closed 2026-09-24:* a restore's documents were put in place the way the signed original
      was until the same day (004): `restoreDocuments` removed the file already under a document's name
      before it moved the new one in, so a move that failed there lost both copies - and on the phone
      that made the backup every downloaded attachment is under that name. The copy there is now moved
      aside first, put back if the new one does not go in, and removed only once it has (`moveIntoPlace`
      in `src/services/backup/documents.ts`; `DocumentFs` gained `exists`, which `backupFs` already had).
      Tests: `__tests__/backup/documents.test.ts` › putting documents back › "keeps the copy already under
      the name when the new one cannot be moved over it" and "leaves that copy aside, never removed, when
      it cannot be put back either", both failing against the restore before the change; the test disk's
      move now refuses a destination that exists, as iOS does. A transfer's save writes documents back
      through the same function. Not walked on a device. *Review, 2026-09-24:* the three copies of the move are one now (`src/services/files/moveIntoPlace.ts`,
      also used by the VoDZ enclosures), with two gaps closed: a name with nothing under it and a copy aside
      (a process killed between the moves, or a failed put-back) gets that copy back first, and a stale
      `.old` that will not delete - which made the move aside refuse forever on iOS - is left alone while the
      copy under the name goes aside under a name of its own for that one replacement. A kill in that last
      case leaves the copy under the unique name, on disk but not put back by itself. Tests:
      `documents.test.ts` › "puts back a copy a stopped replacement left aside, even when the new one
      cannot go in", "replaces a document even when a stale copy aside will not delete", both failing
      before that change.
- [x] T031 **Done (FR-018).** Retention: default 1, at most `MAX_KEEP` = 5, pruned only after a new
  backup is written; lowering the limit asks and prunes at once; one backup can be deleted by swipe or
  from the opened row, after confirmation. Tests: `__tests__/app/backupRetention.test.tsx`.
  *Amended 2026-09-15:* a backup that a restore could not bring every document back from is held out of
  retention until a restore from it brings them back or it is deleted; see the T030 follow-ups. Tests:
  `__tests__/app/backupHeld.test.tsx`.

- [x] T013 A "verify this backup" action that performs a real decrypt rather than checking a file exists.
  The failure this feature has to survive is a backup that looked fine for two years. **Done
  2026-09-12.** `verifyBackup` takes the restore path as far as `migratePayload` and stops before
  writing, so a corrupt archive fails here rather than at the moment it is needed. Reports COUNTS,
  not a checkmark: "3 schránky, 19 zpráv" is something the user can hold against the phone in their
  hand, where "verified" is only the app vouching for itself. Walked on the emulator.
- [x] T014 Export/import to a user-chosen file — the whole point of Phase 3 being a real feature rather
  than scaffolding, and the only backup path walkable on the current unsigned iOS build. **Done
  2026-09-12.** A framed container (`portable.ts`) carrying the manifest beside the sealed archive,
  because compatibility is judged before anyone is asked for a passphrase. Export never prompts; the
  bytes leave as sealed. Walked end to end on the emulator: enable → verify → export to Downloads →
  `pm clear` → import on an app with backup switched OFF → listed and restorable. The written file
  was pulled off the device and parsed by hand to confirm the framing, the manifest, and that the
  payload is the envelope (`OBALKA\0`) rather than anything readable.

  Found on that walk and fixed: the confirmation rendered below the restore list while the button
  that produced it sits at the top of the screen, so the user tapped and saw nothing. These three
  actions now speak through the app's snackbar, which draws above the navigator.

  **Fixed 2026-09-15: import failed for a file with a space or a diacritic in its name.** The picker's
  cache copy comes back as a percent-encoded `file://` URI on both platforms, and `portableIo.open`
  (`src/features/accounts/deps.ts`) only stripped the scheme. A backup renamed to "Záloha Obálky 15.
  září.obalka" was therefore read from `…/Z%C3%A1loha%20Ob%C3%A1lky…`, a path that names no file: the
  screen showed `backup.file.importFailed`, and the copy of the archive stayed in the cache because
  the cleanup removed the same wrong path. The walk above could not catch it, because an unrenamed
  export (`portableFileName`: `obalka-YYYY-MM-DD-HHMM.obalka`) needs no encoding. The attachment
  picker had been fixed for the same URI on 2026-09-14 (005). The decoding now lives in one place,
  `src/services/files/localCopyPath.ts`, and both callers use it. Tests:
  `__tests__/backup/portableImportFileName.test.ts` runs the real `portableIo` from the app wiring.
  "reads a backup whose Czech file name has spaces and diacritics", "removes the cache copy under its
  real name once it is read" and "decodes a percent sign in the name once, not twice" all fail on the
  old code with ENOENT; the last also fails if the path is decoded twice.
  `__tests__/files/localCopyPath.test.ts` (4 tests) pins the shared contract. Not yet walked on a
  device.

  **Fixed 2026-09-15, second pass: a "#" or "%" in a saved file's name, and a copy left behind.**
  `portableIo.save` handed the system save sheet `file://` followed by the raw staged path, and so did
  `attachmentOpener.save`, which saves a message's signed original (004). The sheet parses that URI
  (Android `Uri.parse`, iOS `URL(string:)`), so a name such as "Rozhodnutí #3 100%.pdf" lost everything
  after the "#" and was malformed at the "%", and older iOS also refuses a bare space. Both now build it
  with `fileUri` in `src/services/files/localCopyPath.ts`, beside the decoding, which percent-encodes each
  path segment. An export's own name (`portableFileName`) needs no encoding, so export was exposed only
  through a name a caller chose; a signed original's name comes from ISDS. Opening an attachment was not
  affected: blob-util encodes the path itself on iOS and opens a `File` on Android. Separately,
  `portableIo.open` decoded the copy's URI before the `try` whose `finally` removes the copy, so a
  malformed escape threw past the cleanup and left the copy of the archive in the cache; the attachment
  picker (005) decoded before listing the copy for cleanup, with the same result. Both now clean up
  through `localCopyCleanupPath`, which falls back to the scheme-stripped string when the escape cannot
  be decoded. Tests: `__tests__/files/localCopyPath.test.ts`, "fileUri" (3) and "localCopyCleanupPath"
  (2); `__tests__/files/attachmentOpener.test.ts`, "hands the sheet a percent-encoded URI for a name with
  a hash, a percent sign and diacritics"; `__tests__/backup/portableImportFileName.test.ts`, "still
  removes the cache copy, and still fails the import" and "hands the sheet a percent-encoded URI, and
  removes what it staged"; `__tests__/files/attachmentPicker.test.ts`, "removes a copy whose URI will
  not decode, and fails the pick". Each fails against the code before the change. Not walked on a
  device.

## Phase 4 — the cloud (deferred to future work)

*Deferred 2026-09-14 (owner decision):* the app is published with the encrypted file backup and phone-to-phone
transfer, and the cloud targets are future work. The tasks stay unticked because nothing here is built.
T015 needs a Google Cloud OAuth client (and Google's review to publish); T016 needs a paid Apple Developer
membership and a signed build carrying the iCloud container entitlement.

- [ ] T015 Android: Drive `appDataFolder` target + account plumbing.
- [ ] T016 iOS: iCloud target. **Blocked**: needs the iCloud container entitlement, which an unsigned
  sideload build cannot carry.
- [ ] T017 Permission/entitlement delta on both platforms, the way 010 T027 checked notifee's.

## Deferred, with the reason

- ~~**Attachment tier**~~ — no longer deferred: built 2026-09-12 as Phase 2b (T018–T024), with a
  native cipher and per-file chunked sealing.
- **US3 continuous sync** — needs 014's background argument made explicitly, as 010 had to for a purely
  local timer.
- **Cross-ecosystem** — needs a neutral server the project has committed not to run.

---

## Amendment 2026-09-23 — a backup asked for twice at once (audit), in code and tests, not walked on a device

A read-only audit found actions a fast double tap fired twice. The screens guarded them with React
state (`busy`, `loading`, `opening`, PressScale's `busy`), which takes effect only after a re-render,
and a double tap delivers both presses before it. The shared fix is `src/app/useSingleFlight.ts`: a
guard checked and claimed synchronously in the tap, released when the run settles (with `release()`
for a run that can outlive what it waited for), never throwing on a refused call - tested in
`__tests__/app/useSingleFlight.test.tsx`. Every double-tap test below takes the handler out of ONE
render and calls it twice in the same tick (`__tests__/helpers/doubleTap.ts`), or calls the controller
twice without awaiting. Each double-tap test was run against the pre-fix source and failed there; the
tests beside them that check the guard lets go again - after a success, a failure or a stop - or holds
back nothing it should not, pass on either source by design.

- **`BackupController.enable` and `backupNow` join** a backup the user asked for that is still running:
  the same promise and manifest, its progress fanned out to every caller. Two `enable`s used to both
  find no key, both mint one and both save it, so a backup could be sealed under a key the second save
  had replaced - unrestorable with the key the screen shows. Two `backupNow`s queued a second full
  backup of an unchanged archive, which under the default retention of one evicted an older, distinct
  backup. Tests: `__tests__/backup/backupController.test.ts` › "a backup asked for twice at once
  (double tap)" (one key saved and the backup restored on a fresh phone with it; one `putBackup` for
  two `backupNow`s; a `backupNow` during switching on joins it; free again after success and failure).
- **`BackupScreen.run()`** now runs under one single-flight guard, which covers switching on/off, back
  up now, restore, verify, reveal the key, export and import. "Use the key this phone holds" revealed
  the key and then called `onRestore`, itself a run; the restore body is `restoreWith` now, so the one
  run does both and the guard does not refuse its own restore. Tests:
  `__tests__/app/backupDoubleTap.test.tsx`.
- **Device walk owed:** double-tap the backup switch on a phone with backups off, then check that the
  recovery key shown opens the backup (Ověřit); double-tap "Zálohovat nyní" and check the list.

## Amendment 2026-09-24 — loading a backup file on a phone with no boxes, in code and tests, not walked on a device

"Načíst zálohu ze souboru" (T014) was written for a new phone - IMPORT is not gated on `enabled` for
exactly that reason - but the backup screen was reachable only from Settings, and Settings only with a
box. Welcome now opens the backup screen in a first-run mode (`firstRun`): the transfer, the file
import with its own description ("Máte zálohu uloženou jako soubor? …"), then the restore list; the
managing controls and the export are left out. A restore that brings boxes in offers "Pokračovat" to
the inbox. Details, and the device walk owed, in 025's amendment of the same date. Tests:
`__tests__/app/backupScreenFirstRun.test.tsx`, `__tests__/app/firstRunRestore*.test.tsx`.

## Amendment 2026-09-24 — the recovery-key QR is read without ML Kit, in code and tests, not walked on a device

The recovery-key scanner (T012b) is 025's shared `CodeScanner`, and its decoder was Google ML Kit,
which sends device, app and usage data to Google with no opt-out. It now reads codes on the device
only: Apple's `AVCaptureMetadataOutput` on iOS, zxing-cpp on Android. Nothing changed for this
feature's side - the same `parseKeyQr`, the key still goes into the field and never straight into a
restore, and the button is still absent without a camera. Details, the dependency proof and the
device walk owed are in 025's amendment of the same date; the key parser's refusal of a transfer
phrase is now pinned for both platforms in `__tests__/transfer/codeScanner.test.tsx`.

## Amendment 2026-09-24 — the app stays out of the phone's own backups and migration, in code and tests, not walked on a device

Owner decision: nothing of the app goes into iCloud Backup, a computer backup, Google's backup or a
phone-to-phone migration, on either platform. The archive's SQLCipher key and the vault key are
Keychain / Keystore items stored this-device-only, so a copy restored onto a new phone could not be
opened there anyway. What such a copy DID carry readably was the plain files - attachments (.pdf),
signed originals (.zfo), debug ZIPs and this feature's own backup files in `Documents/backups` - and
those landed in iCloud, Google or on a computer. This feature's encrypted backup and 025's transfer
are the supported ways to move an archive; a backup file is taken off the phone by exporting it.

- **Android.** `allowBackup="false"` was already set, and does not stop device-to-device transfer for
  an app targeting Android 12+ (this one targets 36). The manifest now also names
  `res/xml/data_extraction_rules.xml` (Android 12+: every domain excluded from `<cloud-backup>` and
  `<device-transfer>`; `<cross-platform-transfer>` deliberately not declared) and
  `res/xml/backup_rules.xml` (Android 11 and older: every domain excluded). Test:
  `__tests__/security/androidBackupRules.test.ts` parses the manifest and both files.
- **iOS.** At every launch (`App.tsx` → `excludeAppDataFromDeviceBackup` in `deps.ts` →
  `src/services/files/deviceBackupExclusion.ts`) the app marks `NSURLIsExcludedFromBackupKey`, via
  react-native-blob-util's `ios.excludeFromBackupKey`, on `Documents` and on `attachments`, `backups`
  and `debug` inside it (created first when missing), and on op-sqlite's `Library/obalka.db` with its
  `-wal` / `-shm` where present, by the path the open connection reports (`getDbFilePath`). A
  directory's mark covers files written into it later - Apple's "Optimizing your app's data for
  iCloud backup" tells apps to group files in a directory and mark the directory. The same page says
  the key is guidance, "not a mechanism to guarantee", and that file operations can reset it; hence
  directories and every launch. Failures report as `file.excludeFromBackup` and never stop launch.
  Test: `__tests__/files/deviceBackupExclusion.test.tsx`.
- **Device walk owed.** iOS: download a message with attachments and make a backup, then open
  Settings → [name] → iCloud → Manage Account Storage → Backups → this iPhone - the app should list at
  a few kilobytes, not at the size of its files; a restore onto a second iPhone should bring the app
  back empty. Android 12+: `adb shell bmgr backupnow software.dorhawk.obalka` should back up nothing
  for the app, and a phone-to-phone migration should install it empty.

## Amendment 2026-09-24 — a restored inbox said "Aktualizováno 01.01.1970", in code and tests, not walked on a device

Seen on the Android emulator: after a backup file was restored from Welcome, and again after the same
data came over by 025's transfer, the inbox of a box never synced on this phone ended with
"Aktualizováno 01.01.1970". The backup carries `downloadedAt` only as a marker - 1 means "the body
is here" (`snapshot.ts`, and `existingMessage` in `stores.ts` on a second pass) - and `upsertMessage`
wrote that marker as the row's sync time. The store's newest-stamp reducers skip 0 but not 1, so one
millisecond past the epoch reached `ListEnd`.

A restored row now says it was never synced here (`NEVER_SYNCED`, 0 in a NOT NULL column), and the
inbox ends with "Zatím neaktualizováno". Not the backup's date: sync bookkeeping is this phone's own
and never travels (the snapshot already drops `lastSyncedAt` for that reason), and a backup's creation
is only a bound on when its rows were synced, not the time. A row's `syncedAt` now only moves forward
(`cacheList` keeps the later stamp), so restoring over a box this phone did sync keeps its sync time.
`freshnessLabel` refuses any stamp before 2020, which also covers archives already restored with 1.
The merged view no longer puts "now" in place of a missing stamp: it reads only the archive. Tests:
`__tests__/backup/restoredFreshness.test.tsx` (file restore and a second pass over the same data,
through `createBackup` / `restoreBackup` and the inbox screen), `__tests__/messages/groupByDate.test.ts`.
- **Device walk owed:** restore a backup onto a phone that never synced its box - the inbox should
  end with "Zatím neaktualizováno"; sign in and refresh, and it should say when.
