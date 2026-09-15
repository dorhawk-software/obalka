# Tasks: Attachments in backups, transferring a backup that exists, automatic download

**Feature**: `026-attachment-downloads` | **Spec**: [spec.md](./spec.md)

No plan.md: the mockups (approved 2026-09-26: the radio-row dialog, the "after confirming" section, the
transfer picker, the settings rows) and the spec's requirements carried the decisions; everything below
reuses a mechanism that already existed - `getDetail` for the download, `createBackup` for the backup,
`TransferController.offer` for the send.

## Phase 1: Research

- [x] T001 The law and the operating rules, before any wording (spec §"What the law … allow"). Provozní
  řád ch. 8 (delivery is the listing only), ch. 17 (manual command; the download categories ISDS counts);
  the WS manual's MessageDownload section (a web-service download does not set state 7). Corrects 002's
  deferred-section caveat.

## Phase 2: Data

- [x] T002 Migration 15: `messages.firstSeenAt`, written on insert only (FR-004); both stores.
- [x] T003 `MessagesStore.listUndownloaded(boxId)`: both folders, newest first.
- [x] T004 Manifest: `documentMode`, `documentsMissing`, `documentObjects` (FR-002), set by `createBackup`.

## Phase 3: The downloader (FR-003)

- [x] T005 `AttachmentPrefetcher`: `canAsk` (retention, erased, undeliverable, failed antivirus), `inScope`
  ("new only" by `firstSeenAt`), one message at a time, once per run of the app, stops a box at a sign-in
  refusal, holds automatic backups while it runs, never calls `markRead`.
- [x] T006 `onListed` on `MessagesController`, fired after a listing that worked; wired in `deps.ts`.
- [x] T007 Auto-download settings (`autoDownloadSettings.ts`), device-local (FR-005).
- [x] T008 Tests: `attachmentPrefetch.test.ts`, `listingStartsDownloads.test.ts`, `deviceLocalSettings`.

## Phase 4: US1/US2 - which attachments a backup carries

- [x] T009 `BackupPreferences.documentMode`, `missingEstimate`, `holdAutomatic`; "Zálohovat nyní" in the
  `all` mode downloads first (stage `downloading`, first half of the bar, stoppable); automatic backups
  never download (FR-006).
- [x] T010 The dialog as radio rows with counts (`OptionGroup` gained `description` and `trailing`), the
  "Které přílohy · Změnit" row, the chip and missing count on each listed backup (`BackupDocumentsChip`).
- [x] T011 Tests: `documentModes.test.ts`, `attachmentChoices.test.tsx`, the updated backup-screen suites.

## Phase 5: US3 - transfer sends a backup that exists

- [x] T012 `offer` sends the chosen manifest (`TransferBackupGoneError` when it was deleted), copies only
  its `documentObjects`, counts boxes and messages only for the newest backup.
- [x] T013 The screen: "Co odeslat" radio list with chips, "Odeslat vybranou zálohu", the no-backup state
  with "Vytvořit zálohu", which backup is going under the phrase; `TransferRoute` reads the list and reads
  it again when the chosen one is gone.
- [x] T014 Tests: `transferController.test.ts` (chosen not newest, gone, only listed objects), the
  transfer-screen suites.

## Phase 6: US4 - settings

- [x] T015 Nastavení → Přílohy: the switch, the Wi-Fi row (always drawn, disabled while off), the dialog
  "Jen nové zprávy / I zprávy, které už v telefonu jsou".

## Phase 7: Verification

- [x] T016 `npm run verify` green (256 suites, 2743 tests).
- [x] T017 Walked on the Android emulator (`Obalka_Demo`, demo archive), 2026-09-26: the settings rows and
  dialog, the backup dialog in both modes, the mode row, a backup made in the `all` mode listed with its
  chip and missing count, the transfer picker. The demo boxes all need a sign-in, so the download itself
  was skipped there, as designed.
- [ ] T018 On czebox, by a person with the test credentials: automatic download after a refresh, received
  and sent; the message stays unread in the app AND in ISDS after a signed download (the WS manual says it
  does; not measured); "Zálohovat nyní" in the `all` mode; a two-phone transfer of an older backup.
