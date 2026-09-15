# Feature Specification: Attachments in backups, transferring a backup that exists, automatic download

**Feature Branch**: `026-attachment-downloads`
**Created**: 2026-09-26
**Status**: Implemented 2026-09-26 (see `tasks.md`). Not yet exercised against czebox: the download
itself is the one 002 already uses, but that a signed download leaves a message unread in ISDS is
taken from the ISDS documentation (below), not measured.
**Input**: Owner, 2026-09-26, three requests reviewed against mockups the same day:

1. *"when i enable to zalohovat prilohy, it currently informs me that prilohy se zacnou zalohovat
   jakmile nejakou stahnete. this is not right, instead the modal should: allow to only backup already
   downloaded attachments; download all the attachments during the backup; not to enable it - cancel"*
   Approved as the radio-row dialog (mockup variant B) plus the "after confirming" section.
2. *"the transfer to the new phone, you got completely wrong … you create some backup (and it is
   stored); you chose to transfer to a new phone and you select a backup which has already been
   created … only the transfer is triggered, not backing up again. the backup needs to inform the user
   what it contains in terms of attachments … the backup needs to backup both sent and received
   messages"*
3. *"if law permits it, i would like to add a mechanism to automatically download attachments on box
   refresh/sync … it should locally not mark the message as read … an option … to only allow automatic
   attachment download when on wifi"*, and after the mockups: *"enabling the automatic attachment
   download should also give option to: only enable this for new messages; or to also retrospectively
   try to download missing attachments for all already present messages … this includes both received
   and sent messages"*

## What the law and the operating rules allow

This decides the wording of every dialog below, so it comes first.

- **A download never delivers a message.** Provozní řád ISDS (26. 6. 2026, `docs/`), ch. 8:
  *"Přihlášení do datové schránky majitele a doručování zpráv ve smyslu § 17 odst. 3 Zákona způsobuje
  výhradně stažení seznamu došlých zpráv – GetListOfReceivedMessages."* The app downloads only
  messages it has already listed, so every one of them is delivered by then; and ISDS serves a
  received message only in states 6, 7 or 10, which are all delivered states.
- **A download through the web services does not mark a message read.** *Webové služby rozhraní ISDS
  pro manipulaci s datovými zprávami* (v3.0), MessageDownload: *"Stažením netrezorové zprávy se obvykle
  mění její stav na 7 (v ESS ne automaticky, ale explicitním voláním WS MarkMessageAsDownloaded)."* The
  app calls `MarkMessageAsDownloaded` only when the user opens the message (002 FR-018). State 7 is,
  in the same document, *"procesně nevýznamná událost bez opory v zákoně"*. This corrects 002's
  deferred-section caveat, which said the opposite without having measured it.
- **What does constrain it:** an application installed on a device *"se musí do datové schránky
  přihlašovat pomocí manuálního příkazu uživatele"* (ch. 17), so nothing here may run on a timer or in
  the background (014); and ISDS counts single-message downloads per week against the size of the box
  (WS doc §1.9.2), so each message is downloaded once, never again once it is in the archive, and not
  at all once ISDS has deleted it (90 days after delivery by sign-in, three years otherwise).

The owner's proposed warning, that downloading "will make undelivered messages delivered", is
therefore false, and the dialogs say the opposite: *"Zprávu to nedoručí ani neoznačí jako přečtenou."*

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Choose which attachments a backup carries (Priority: P1)

Turning on "Zálohovat i přílohy" asks which attachments: only those already on the phone, or all of
them, downloading what is missing. Cancel leaves the switch off.

**Acceptance Scenarios**:

1. **Given** backups are on and attachments are off, **When** the switch is turned on, **Then** a dialog
   offers two radio rows, "Jen stažené přílohy" (with the number of files and their size) and
   "Stáhnout a zálohovat všechny" (with the number of messages whose attachments are not on the phone),
   and Zrušit / Zapnout. The explanation under the rows follows the selected row.
2. **Given** "Stáhnout a zálohovat všechny" is selected, **Then** the dialog says downloads happen only
   during a backup or a box refresh the user starts, that this neither delivers a message nor marks it
   read, and how many messages ISDS no longer holds attachments for.
3. **Given** Zrušit (or the back button, or a tap outside), **Then** the switch stays off.
4. **Given** attachments are on, **Then** a "Které přílohy" row shows the chosen mode with "Změnit",
   which opens the same dialog with the current mode selected.
5. **Given** mode "všechny", **When** the user presses "Zálohovat nyní", **Then** the backup first
   downloads the missing attachments of every box that does not need a sign-in, received and sent,
   showing progress it can stop, and then backs up.
6. **Given** mode "všechny", **When** a box refresh the user started lists messages, **Then** missing
   attachments are downloaded after it (the same downloader as US3), so the automatic backup that
   follows holds them without itself signing in.

### User Story 2 - Every backup says what it holds (Priority: P1)

**Acceptance Scenarios**:

1. **Given** the backup list (Záloha → Obnovit ze zálohy, and the transfer), **Then** each backup shows
   "Bez příloh", "Jen stažené" (attachments downloaded up to its date) or "Všechny přílohy" (the backup
   downloaded what it could), from its manifest, without the password.
2. **Given** a "Všechny přílohy" backup that could not get some attachments, **Then** its row says how
   many messages are without them.
3. **Given** a backup made before this feature, **Then** it reads as "Bez příloh" or "Jen stažené",
   which is what it holds.
4. Backups hold received **and** sent messages and the attachments of both (already true since 008;
   stated in the transfer's picker).

### User Story 3 - Send a backup that already exists to another phone (Priority: P1)

**Acceptance Scenarios**:

1. **Given** the phone holds backups, **When** the transfer screen opens, **Then** "Co odeslat" lists
   them as radio rows with date, size and attachment mode, the newest selected.
2. **Given** a backup is selected, **When** "Odeslat vybranou zálohu" is pressed, **Then** exactly that
   backup goes, with only the attachment objects its manifest lists; no backup is made, and the code
   phrase says which backup it is.
3. **Given** the selected backup was deleted meanwhile (retention), **Then** the send fails with a
   sentence saying so and the list is read again; it does not silently send a different backup.
4. **Given** no backup exists, **Then** the screen says a transfer always sends a finished backup and
   offers "Vytvořit zálohu", which returns to the backup screen.

### User Story 4 - Download attachments automatically during a refresh (Priority: P2)

**Acceptance Scenarios**:

1. **Given** Nastavení → Přílohy, **Then** "Stahovat přílohy automaticky" (off by default) and "Jen na
   Wi-Fi" (on by default, disabled while the first is off, always drawn so nothing moves).
2. **When** the first switch is turned on, **Then** a dialog offers "Jen nové zprávy" and "I zprávy, které
   už v telefonu jsou", says it covers received and sent messages, neither delivers nor marks read, and
   uses storage. Zrušit leaves it off.
3. **Given** it is on, **When** a box refresh the user started succeeds, **Then** the attachments of that
   box's eligible messages that are not on the phone are downloaded one message at a time: messages
   first seen after the switch was turned on ("Jen nové"), or every message in the archive ("I zprávy…").
4. **Given** "Jen na Wi-Fi" and a metered connection, **Then** nothing is downloaded automatically.
5. A downloaded message keeps its unread state, in the app and in ISDS, until the user opens it.
6. Never downloaded: a message already in the archive, one ISDS has deleted (past retention), one whose
   content was erased (state 9), a received message that is undeliverable (state 8), one that failed
   already during this run of the app, and anything of a box being removed or needing a sign-in.

## Requirements *(mandatory)*

- **FR-001** Backup preferences gain `documentMode: 'downloaded' | 'all'` (setting
  `backup.documentMode`, default `downloaded`), beside the existing on/off `documents`.
- **FR-002** The manifest records `documentMode`, `documentsMissing` (messages without attachments on
  the phone when the backup was made, `all` mode only) and `documentObjects` (the stored object names
  the backup's index uses: keyed hashes, readable without the password and saying nothing about the
  mail). All optional, absent on older manifests; `tiers.documents` stays the source of "has
  attachments". No payload change, so no schema version change.
- **FR-003** One downloader (`AttachmentPrefetcher`) serves US1 and US4. It runs only from a listing
  the user started (a box refresh) or from "Zálohovat nyní"; it downloads one message at a time with
  the existing `getDetail` (signed download, VoDZ path included), so files, signed originals and the
  "gone" rule stay as 002/004 define them; it never calls `markRead`.
- **FR-004** "Jen nové zprávy" is decided by a new `messages.firstSeenAt` column (migration 15), set
  when a listing first inserts a row and never updated. Rows that existed before, restored rows and
  rows of a phone transfer have none and count as not new.
- **FR-005** Auto-download settings are device-local (`DEVICE_LOCAL_SETTINGS`): storage and mobile data
  are this phone's, and a restore must not switch on downloads on another one.
- **FR-006** An automatic backup never signs in. While the downloader runs, automatic backups wait, so
  one backup follows a download run instead of one per downloaded message.
- **FR-007** The transfer sends the manifest the user selected, never a newer one in its place, and
  copies only `documentObjects` when the manifest has them (every object, as before, when it does not).
- **FR-008** Every string exists in Czech and English; the dialogs use the app's `Dialog` and the
  shared `OptionGroup` row, extended with a description line and a trailing element.

## Out of scope

- Downloading on a timer, at launch without a refresh, or in the background (014).
- Automatic download on opening a message (002's third mode): opening already offers the download.
- A per-box setting.
