# Feature Specification: Local Archive & Search

**Feature Branch**: `004-local-archive-search` (built on `master` alongside 001/002/007)
**Created**: 2026-06-13
**Status**: Implemented (durable archive via 002's offline cache + cross-box search); live-validated on
the emulator. *Amended 2026-09-14:* the archive now keeps each message's signed original (.zfo) — built
and unit-tested, **not yet walked against czebox**; see *Amendment 2026-09-14* below, `plan.md` and
`research.md`. *Amended 2026-09-15:* a large-volume download that stops part-way keeps what arrived,
records what did not, and resumes with only that — unit-tested, not walked on a device; see
*Amendment 2026-09-15* below
**Input**: Roadmap feature 004 — "durable SQLite store of messages + signed ZFO, full-text search,
retention beyond 90 days." The durable archive is the incumbent app's *most-loved* feature (it keeps
history after ISDS deletes messages at 90 days); search is what makes a growing archive usable.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Durable local archive (Priority: P1) — done in 002

Every synced message envelope is stored in the encrypted SQLite DB. Every downloaded attachment is a
file in the app's private storage (`DocumentDir/attachments`, OS at-rest protection only), with its
path in `detailJson`. Both remain viewable **offline** and **after ISDS deletes the message at 90
days**. Built as the "004 seed" inside 002 (the `messages` table + `MessagesStore`); see [002
FR-011..FR-016]. *Amended 2026-09-14:* so does the message's signed original, a `.zfo` file beside the
attachments (FR-007..FR-016 below).

### User Story 2 - Search the archive (Priority: P2)

From the home, the user taps **search** and types a term; matching messages from **any** box appear
as they type, each showing its box. Tapping a hit opens that message. Search works **offline** (it
reads only the local cache) and is **accent- and case-insensitive** (Czech: typing "danovy" finds
"daňový").

**Independent Test**: With cached messages in several boxes, open search, type a partial term with no
diacritics/lower-case, confirm the diacritic/case variant is found with its box shown, and that
tapping it opens the right message.

**Acceptance Scenarios**:

1. **Given** cached messages, **When** the user types a term, **Then** matching messages across all
   boxes appear (debounced), newest first, each labelled with its box.
2. **Given** a term typed without diacritics or in a different case, **When** it matches a message's
   text, **Then** the message is still found ("danovy" → "Daňový", "cssz" → "ČSSZ").
3. **Given** the device is offline, **When** the user searches, **Then** results still come from the
   local archive.
4. **Given** a result, **When** the user taps it, **Then** its message detail opens (correct box).

## Requirements *(mandatory)*

- **FR-001** (archive) The durable message archive is the `messages` table + `MessagesStore` from 002
  (offline-first cache); this feature adds search over it. No new archive storage. *Amended
  2026-09-14:* the signed original adds one file per downloaded message (FR-011).
- **FR-002** Search is over the **envelope text** — subject, sender, recipient, and both addresses —
  concatenated into a normalized `searchText` column (migration v5), populated on each sync
  (`cacheList`). Existing rows gain it on their next sync (auto-sync-on-launch re-caches).
- **FR-003** Normalization = lower-case + **strip diacritics** (NFD + drop U+0300–U+036F), so search
  is accent- and case-insensitive. Applied identically to the stored text and the query.
- **FR-004** Matching is a **substring** match on `searchText` (`MessagesStore.search`): SQLite
  `LIKE` (LIKE wildcards in the query are escaped) on device, an in-memory `includes` filter in tests.
  Adequate + diacritic-insensitive for short envelope metadata — **FTS5 is intentionally not used**
  (no large text bodies to tokenize/rank; a substring scan over short fields is fast).
- **FR-005** Search spans **all boxes**; each hit carries its `boxId`. Results are newest-first and
  capped at 100 shown: the store fetches `SEARCH_LIMIT + 1` rows so the screen can say the list was
  truncated instead of presenting 100 as the total. Offline — no network.
- **FR-006** UI: a search icon in the home top bar → a `SearchScreen` with a focused input and
  **debounced** (220 ms) search-as-you-type. Each result row shows sender, subject, date, and box
  label; tapping it navigates to the message detail. Empty-query and no-results states are shown.

## Success Criteria

- **SC-001** A term typed without diacritics/lower-case finds the diacritic/upper variant (validated
  live: "danovy" → "Zjednodušený daňový doklad", with its box shown, opens the right message).
- **SC-002** Search returns hits across multiple boxes, newest first (unit-tested).
- **SC-003** Search works with no network (reads only the cache).

## Notes / Deferred

- **FTS5 / body search:** if we later index attachment *text* (extracted from PDFs/ZFO) or the archive
  grows very large, revisit FTS5 (tokenized, ranked). Today there is no plain-text body — a data
  message's content is its attachments — so envelope substring search is the right tool.
- ~~**Signed ZFO archive** (`SignedMessageDownload`, the authentic sealed envelope) — still deferred
  and not specified by any feature yet (the operation is listed in
  `docs/isds-provozni-rad-2026-06-26.md`).~~ *No longer deferred (2026-09-14):* built — see the
  amendment below.
- **Per-box / filtered search** (within one box, by date/sender) — possible future refinement; today
  search is global.
- **Retention/storage management** (size, prune) — future, ties to attachment storage.

## Amendment 2026-09-14 — the signed original (.zfo) is kept

**State of this amendment**: built and unit-tested; **not walked on a device or against czebox**
(constitution VII) — no czebox credentials were available when it was written. Design: `plan.md`. The
ISDS facts it rests on, with sources: `research.md`.

Constitution IV has always said the archive keeps messages "and their original signed ZFO envelopes".
Until this amendment it kept neither kind of original: `SignedMessageDownload` was never called, and the
blob `SignedSentMessageDownload` returned for a sent message was unwrapped for its attachments and
thrown away. This file listed it under *Notes / Deferred*.

- **FR-007 (received download)** A received message downloads with `SignedMessageDownload` (`/DS/dz`;
  cookie boxes `/apps/DS/dz`) and its detail is read from the signed content. Anything short of a
  detail read from it — no `dmSignature`, a CMS it cannot read, XML that does not parse or names
  another `dmID`, a refusal other than `1281`, a non-200 — falls back to `MessageDownload` for the
  detail and is reported (`isds.parse` / `isds.download`): the most-used path in the app must never
  become unopenable because of an unverified call. An original that arrived but could not be read is
  still kept with the fallback detail; one that names another message is not. `1281` sends a received
  VoDZ to the large-volume path, as it already did a sent one (bulletin 2175 §3.8).
- **FR-008 (sent download)** `SignedSentMessageDownload` as before; its blob is now kept. There is no
  unsigned download of a sent message, so a parse failure stays an error, now reported.
- **FR-009 (constitution I)** The reader decodes base64 a megabyte at a time, joins ISDS's chunked
  eContent on bytes, and cuts every `dmEncodedContent` body out of the XML before the skeleton is
  decoded and parsed, yielding between slices. A CMS it recognises but cannot decode is refused, not
  read around — reading around a broken segment splices DER framing into an attachment. The SOAP
  answer around the signature is split the same way before anything is parsed: `cutSignature` takes
  the `dmSignature` body out, and the XML parser sees only the envelope and its status (added in the
  review below).
- **FR-010 (large-volume)** After a VoDZ message's enclosures are cached, its original is streamed from
  `SignedBigMessageDownload` / `SignedSentBigMessageDownload` (ws2 `/DS/vodz`; *since 2026-09-15, 018
  T015,* a cookie box's goes to the portal's `/apps/DS/vodz` with its own session and the shared cookie
  jar kept out, like its enclosures): blob-util writes the
  response to a temp file and the `<dmSignature>` body is decoded into the `.zfo` in slices, never
  through the JS heap, and moved into place only when complete. Best-effort: a failure keeps the
  enclosures, reports `isds.download`, and leaves the fetch of FR-012 offered. The detail is never
  parsed from a VoDZ original. A `1281` from this service is a fault, never a refusal (review below).
- **FR-011 (storage)** The original is `DZ_<dmID>.zfo` in the message's attachment directory, recorded
  on the cached detail as `signedZfo: { fileName, localPath, size }`. It is never overwritten while its
  file exists, never put into `detailJson` as base64, and a failed write leaves the download standing
  without it (`file.write`).
- **FR-012 (on demand)** A detail with no original on the device — downloaded before this amendment,
  just sent, or whose file vanished — offers **Stáhnout podepsaný originál (ZFO)**:
  `MessagesController.fetchSignedOriginal` fetches only the original (`downloadSignedMessage`, or the
  VoDZ stream after `1281`) and records it without touching the attachments. Only a tap triggers it.
- **FR-013 (retention, said honestly)** ISDS holds a message 90 days from delivery by sign-in
  (`dmAcceptanceTime`), and one served by fiction at least three years (Provozní řád, "Doba uchovávání
  datové zprávy"). Past 90 days the row says ISDS has *probably* deleted it and still offers the fetch,
  because a message later read after fiction cannot be told apart; ~~a refusal from ISDS past the window
  (an answer with a `dmStatusCode`, never an outage or a broken transfer)~~ *since 2026-09-15* ISDS
  answering `1219` past the window - the one code its manual gives for a deleted message (research
  R8), never another code, an outage or a broken transfer - records `attachmentsUnavailable`, after
  which the row says the original can no longer be obtained and offers nothing. Any other code is a
  refusal the user can retry (`detail.original.refused`). State 9 counts as gone.
- **FR-014 (handing it over)** A stored original opens through `attachmentOpener` (iOS: the options
  sheet, since QuickLook cannot render a .zfo); where no app claims the type (`NoViewerError`, Android)
  it goes to the system save sheet (`saveDocuments`).
- **FR-015 (box, backup, transfer)** Removing a box deletes its attachment directory, originals
  included (002 FR-015 amended). Backup Tier 2 carries the original as a document and a restore
  repoints it (006 FR-004 amended); the phone transfer now writes documents back at all (025 T014
  amended). No backup schema change: `detailJson` is opaque in `SNAPSHOT_SHAPE`, and the schema-v1
  golden restore passes unchanged.
- **FR-016 (the scan)** The deadline scan reads `detail.attachments` only, and refuses a `.zfo` or the
  ZFO media type however an attachment is labelled.

### Evidence

| Point | Code | Tests |
| --- | --- | --- |
| Reader | `src/services/isds/signedMessage.ts`; `decodeUtf8Async` in `src/services/text/textCodec.ts` | `__tests__/isds/signedMessage.test.ts` (fixtures from `dmBaseTypes.xsd` in real CMS DER: primitive, chunked, nested and indefinite eContent; a character and a base64 quartet cut by segments; `dmXMLContent`; the three roots; a broken CMS refused; a 3 MB document read with yields); `__tests__/services/textCodec.test.ts` › decoding something the size of a signed message |
| Download and fallback | `src/services/isds/isdsTransport.ts`, `soap.ts` builders, `transport.ts` | `__tests__/isds/isdsTransport.test.ts` › downloadMessage (every fallback row, `1281`, sent), downloadSignedMessage; `__tests__/isds/soap.test.ts` |
| Storage, controller | `src/services/files/attachmentFileStore.ts`, `src/features/messages/state/messagesController.ts` | `__tests__/services/attachmentFileStore.test.ts` › the signed original; `__tests__/messages/messages.test.ts` › keeping the signed original |
| VoDZ stream | `src/services/files/signedZfoStream.ts`, `vodzAttachmentDownloader.ts` | `__tests__/files/signedZfoStream.test.ts` |
| Retention, detail row | `src/features/messages/state/signedOriginal.ts`, `screens/SignedOriginalSection.tsx`, `MessageDetail.tsx`, `src/i18n/strings.ts` (`detail.original.*`) | `__tests__/messages/signedOriginal.test.ts`, `__tests__/messages/signedOriginalSection.test.tsx` |
| Open or save | `openSignedOriginal` in `src/services/files/attachmentOpener.ts` | `__tests__/files/attachmentOpener.test.ts` |
| Backup, transfer | `src/services/backup/documents.ts`, `src/features/transfer/state/transferController.ts`, `src/services/files/sliceSource.ts`, `src/features/accounts/deps.ts` | `__tests__/backup/documents.test.ts` (carries / puts back a signed original), `__tests__/transfer/transferController.test.ts` › writes the documents that came with it back, `__tests__/files/sliceSource.test.ts`; `__tests__/backup/goldenRestore.test.ts` unchanged |
| Scan | `src/services/scan/attachmentScan.ts` | `__tests__/services/attachmentScan.test.ts` › never reads a signed message |
| SOAP answer cut before parsing (review) | `cutSignature` in `src/services/isds/signedMessage.ts`, used by `isdsTransport.ts` | `__tests__/isds/isdsTransport.test.ts` › never hands the signature to the XML parser; `__tests__/isds/signedMessage.test.ts` › cutting the signature out of the SOAP answer |

### Review 2026-09-14

An adversarial review of the amendment, the same day, found and fixed these. Each fix has a test that
fails on the code as first built.

- **The SOAP answer was still parsed whole (constitution I).** The reader above never shows an
  attachment body to the XML parser, but the transport handed it the entire `SignedMessageDownload`
  answer first, and `dmSignature` is the whole message as one text node. fast-xml-parser walks its
  input a character at a time in JS: on a 27 MB answer (a 20 MB message) that measured 2.5 s under V8
  with its JIT and 4 s without one, in Node, before a byte of the message was read. Hermes
  interprets. `cutSignature` now takes the body out by native string search, and the parser sees only
  the envelope and its status. The cut also unwraps CDATA, drops line breaks written as character
  references, and gives an MTOM reference or a response cut short no signature.
- **A `1281` from the large-volume signed download counted as a refusal.** That service is only asked
  after the ordinary one answered `1281`, so a second `1281` is the two services disagreeing about
  routing, not ISDS saying the message is gone. Past 90 days a refusal records the message as gone
  (FR-013). It is now a fault (`__tests__/files/signedZfoStream.test.ts` › calls 1281 from the
  large-volume service a fault).
- **The detail row kept a failed fetch's error after its record changed.** When a later full download
  brought the original, the row named the file with "could not be downloaded" still under it in red.
  It also reserved its two caption lines as a fixed 32 dp. React Native scales a caption's line height
  with the system text size but not a dp `minHeight`, so the reserve held only at 100 % text size. The
  reserve now scales with `fontScale` (`__tests__/messages/signedOriginalSection.test.tsx` › drops a
  failed fetch s error once the record changes under it, › reserves two caption lines at the reader s
  text size).
- **Tests that passed on the code before the amendment** now check the behaviour that changed: the
  OTP and 401 cases assert the signed request, "both downloads failing" asserts that the unsigned one
  was attempted, the sent parse failure asserts its `isds.parse` report, the failed original write
  asserts the write was attempted, and the VoDZ case without an original asserts the original was
  requested.
- The FAQ's archive answer said the archive keeps "the message's signed original", which suggested
  every message had one. It now says the original is kept for the messages you downloaded.

### Not done

- **Nothing here has met ISDS.** The received signed download, both VoDZ signed downloads and the
  on-demand fetch have never been called against a real box; the fallback of FR-007 exists because of
  it. The walks below are owed before this counts as done (constitution VII).
- ~~**Whole-object reads remain in the transfer and the file target.** `TransferController.copyDocuments`
  and `getObject` in the staged and the file target read one sealed object into memory at a time.
  Tier 2's reading of the documents themselves is sliced now; those two are not, so a VoDZ-sized
  original, like a VoDZ enclosure before it, can exceed what a phone holds there.~~ *Closed
  2026-09-15 (025 review follow-ups, T014):* both read a slice at a time through `BackupFs.open`, in
  code and tests, not walked on a device.
- **The seal is kept, not checked.** `AuthenticateMessage` / `AuthenticateBigMessage` and the archive
  re-stamping service are not used.
- ~~**VoDZ calls from cookie boxes** ride the shared native cookie jar exactly as the enclosure download
  always has; 018's per-box session is not applied to ws2. Unchanged, and unverified.~~ *Closed
  2026-09-15 (018 T015):* both VoDZ signed downloads and the enclosure download carry the box's own
  session - to the portal's `/apps/DS/vodz` for a cookie box, Basic on ws2 for a password box - and keep
  the shared jar out of `react-native-blob-util` with the patched `omitCookies`. Still unverified on a
  device and with a real session.
- ~~**The receiving phone of a transfer does not adopt the sender's document key**, unlike a restore from
  the backup screen; its next Tier 2 backup names every document afresh.~~ *Stale, corrected 2026-09-24:*
  closed by 025 T014 (2026-09-15) - a transfer's save keeps the recovery key and the document key that
  arrived through `keepRestoredKeys`, shared with the backup screen's restore
  (`__tests__/transfer/transferController.test.ts`, "keeps the recovery key and the document key that
  arrived, as the backup screen s restore does (006)").
- **The unsigned fallback still parses its whole answer.** When the signed download yields no detail,
  `MessageDownload`'s answer, attachment base64 included, goes through the XML parser in one call, as
  every received download did before this amendment. That is seconds of the JS thread for a 20 MB
  message (review above). It is not a regression, and it runs only on the fallback, but it is not
  constitution I either.
- **Peak memory of a received download is unmeasured.** Reading a 20 MB message holds its
  signature, the decoded bytes, the joined content and the attachments' base64 at the same time, a
  few times the message's size on the JS heap. Nothing has measured this on a phone.
- ~~**A refusal past the window is not told apart by code.** Any `dmStatusCode` other than `0000` and
  `1281` from the on-demand fetch of a message past its retention window records the message as gone.
  No list of the codes ISDS uses for a deleted message is vendored. This is the same heuristic the
  attachment re-download has always used (research R3), made narrower here by excluding outages.~~
  *Closed 2026-09-15:* told apart by code. The operator's web-service manual gives `1219` for a deleted
  message (research R8, quoted there; the manual itself is not vendored), and only `1219` past the
  window records the message as gone - on the on-demand fetch, the signed downloads, the VoDZ ones and
  the attachment re-download alike, which no longer decides this in the screen. Every other code is a
  retryable refusal with its own message (`detail.original.refused`, `detail.attachments.refused`).
  Tests: `__tests__/messages/messages.test.ts` › "never records a message as gone for any other
  refusal, past the window or not", "treats 1219 within the window as a refusal to retry", "reads the
  large-volume service the same way", and › getDetail: telling a deleted message from a download that
  failed; `__tests__/isds/isdsTransport.test.ts` › "tells a deletion from any other ISDS refusal",
  "reads the answer ISDS gave the unsigned download", "passes a sent message's answer from ISDS on";
  `__tests__/files/signedZfoStream.test.ts` › "reads 1219, and only 1219, as ISDS having deleted the
  message, writing no file"; `__tests__/files/vodzAttachmentDownloader.test.ts` › "reads 1219 on the
  first enclosure as a deletion, and any other refusal as a failure to retry"; and, for the screen,
  `__tests__/messages/messageDetailDownload.test.tsx`. Not observed from a real box: which codes ISDS actually
  sends is the device walk 7 below.

### Device walks owed (czebox)

1. Password box, a received message under 20 MB: *Stáhnout celou zprávu* → the row shows
   `DZ_<id>.zfo` and a size; the debug log shows one `SignedMessageDownload` and no `MessageDownload`.
   Open it (Android: the save sheet) and check the saved file verifies in the ISDS portal or Datovka.
2. The same from an OTP box and a Mobile Key box (`/apps/DS/dz`).
3. A received message with diacritics in its attachment names and a multi-megabyte scan: names and
   bytes identical to the portal's copy; the screen stays responsive while it is read.
4. A sent message: its original appears after download.
5. A message downloaded by a build before this one: the row offers the fetch; after it the original is
   stored and the attachments are untouched.
6. A received and a sent VoDZ (over 20 MB): the enclosures as before, then the original; memory stays
   flat; cancelling leaves no `.part` or `.resp-zfo.tmp` behind.
7. A message delivered more than 90 days ago: the row says "nejspíš"; if ISDS answers `1219`, the row
   turns to "už nelze získat"; any other refusal leaves the fetch offered with "ISDS podepsaný originál
   teď nevydal". Record the `dmStatusCode` ISDS actually sent (debug log): research R8 is read from the
   manual, not from a box.
8. Remove a box: `DocumentDir/attachments/<box>` is gone.
9. Tier 2 backup with an original, restored on a clean install; and a phone-to-phone transfer with
   documents: the original opens on the receiving phone.

## Amendment 2026-09-15 — a large-volume download that stops part-way

Constitution IV. A VoDZ message's enclosures come one request at a time (`DownloadAttachment`, `attNum`
0, 1, … until ISDS answers `1299` past the last). When a request failed after at least one enclosure
had arrived - a fault or an outage, the service paused under load (`3013`), ISDS reporting the message
deleted half-way (`1219`) - `vodzAttachmentDownloader.download` returned what had arrived as the whole
message, and `downloadVodzDetail` cached it as the full detail. The missing enclosures were recorded
nowhere, the detail said *Celá zpráva uložena v archivu*, and nothing offered them again. A walk that
reached its 64-enclosure safety cap was called complete the same way. A lost session half-way went the
other way and dropped the enclosures that had arrived: their files stayed on disk, recorded nowhere.
And a decode that failed half-way (a full disk) took the copy already under that name with it, because
the file was unlinked before it was rewritten.

- **FR-017 (the partial walk)** The downloader reports a walk that stopped after at least one enclosure
  as `partial`: the enclosures that arrived, `missingFrom` (the first that did not) and why it stopped
  (`VodzWalkStop`). A walk that stops before any enclosure arrives answers as before (`authFault`,
  `gone`, `serverFault`), and so does one that reaches its cap with nothing.
- **FR-018 (the record)** The controller caches what arrived and records `enclosuresMissingFrom` on the
  detail (`types.ts`; in `detailJson`, so a backup and a transfer carry it). The outcome is `partial`,
  with the reason in the screen's words (`walkFailure`): re-authentication for a lost session;
  `detail.attachments.refused` for `1219` half-way, which is no verdict on a message that has just
  served enclosures, so nothing is recorded as gone; `detail.attachments.missingFailed` for the rest.
  The signed original is not fetched while enclosures are missing - the walk has just failed on the
  same service, and an original can run to gigabytes - and follows once the message is whole (FR-010).
- **FR-019 (resume, never overwrite)** The next download of the message resumes at
  `enclosuresMissingFrom`: an enclosure the archive holds is never requested and its file never written.
  A walk that reaches the end drops the record; one that brings nothing leaves it as it stood and says
  the missing attachments failed; `1219` to its first request is read like any download that brought
  nothing (`attachmentsGone`, FR-013). A record that does not add up (it names n enclosures and the
  detail holds another number) is ignored and the walk starts from the first. Every enclosure is decoded
  to `<name>.part` and moved into place only when whole, as the original is (FR-011).
  *Review, 2026-09-15:* a message the archive already held whole is the exception. Its download is
  offered again only for files gone from the device (**Stáhnout znovu**) and starts from the first
  enclosure. As first built, that walk stopping part-way recorded the message as incomplete from the
  stop, so the enclosures past it fell out of the archive: no longer listed, fetched and written over by
  the resume, and lost for good once ISDS stopped serving the message. They now stay listed and the
  message stays whole (`enclosuresAfterWalk`); the stop's reason shows in the notice for missing files,
  and no original is fetched.
- **FR-020 (the screen)** The detail lists what arrived under *Zpráva v archivu · některé přílohy chybí*
  with the soft-gold missing-attachments notice - the card and metrics the notice for files gone from
  the device already uses - saying *Stáhla se jen 1 příloha. Další se nepodařilo stáhnout.* (the number
  is what arrived, never a total, which ISDS gives only by answering past the last), the last attempt's
  reason, and **Stáhnout chybějící přílohy**. ISDS having deleted the message shows the "no longer
  available" notice instead. No percentage while enclosures are missing: the one file held is not the
  one being fetched. No layout jump (constitution V): the last failure's line is no longer cleared when a
  retry starts; it stays mounted, transparent and hidden from screen readers, until the retry answers.
  That also stops the notice for missing files moving under its own retry.

Related, the same day (018 FR-006 amended): a cookie box's VoDZ download that the portal redirects to its
sign-in page is a lost session, not a failure to retry.

### Evidence

| Point | Code | Tests |
| --- | --- | --- |
| Partial walk, resume, `.part` writes | `src/services/files/vodzAttachmentDownloader.ts` | `__tests__/files/vodzAttachmentDownloader.test.ts` › an enclosure walk that stops part-way (a fault, `3013`, `1219` half-way and a lost session each keep both files; the resume never asks for or writes enclosures 0 and 1; a failed decode leaves the file in place and no scratch; the cap is partial) |
| Record, outcome, original | `downloadVodzDetail`, `resumableEnclosures`, `enclosuresAfterWalk`, `walkFailure` in `src/features/messages/state/messagesController.ts`; `enclosuresMissingFrom` in `src/services/isds/types.ts` | `__tests__/messages/messages.test.ts` › getDetail: a large-volume message whose enclosures stopped arriving part-way (including "keeps every enclosure of a message it held whole when the download of its missing files stops part-way"); › enclosuresAfterWalk: what the archive records for a large-volume walk |
| Screen | `attachmentsNotice` and the notice in `src/features/messages/screens/MessageDetail.tsx`; `detail.attachments.incomplete.*`, `.downloadMissing`, `.missingFailed` in `src/i18n/strings.ts` | `__tests__/messages/messageDetailDownload.test.tsx` › the detail screen for a large-volume message with enclosures missing (what arrived and why, the retry, a lost session, the failure line kept hidden during a retry, a whole message kept whole when the download of its missing files stops part-way, a cached partial opened without a call); `__tests__/messages/attachmentCopy.test.ts` › the notice over the attachment rows; `__tests__/i18n/czechAgreement.test.ts` |

Each of those 30 tests fails on the code before this change, run over a `git archive` of `5e03e03` with
the new test files. The six added in review (the controller's and the screen's whole-message tests and
the four `enclosuresAfterWalk` tests) also fail on the change as first built, `5863e37`.

### Review 2026-09-15 — replacing a file, and two downloads of one message

Constitution IV. Two gaps in the downloader, closed in code and tests; neither walked on a device.

- **A move that failed lost both copies.** Neither platform's move writes over a file: iOS refuses a
  destination that exists, and Android deletes it before it renames (`mv` in `react-native-blob-util`
  on both). So the copy already under an enclosure's name was unlinked before the `.part` was moved in,
  and a move that then failed took the `.part` with it too, in the download's cleanup: the enclosure was
  on neither path. The copy under the name is now moved aside to `<name>.old` first, put back if the new
  one does not go in, and removed only once it has. If putting it back fails as well, it stays under
  `.old` - nothing removes the only copy - and the next download of that enclosure that goes through
  clears it (`moveIntoPlace` in `src/services/files/vodzAttachmentDownloader.ts`).
- **Two downloads of one message ran side by side**, decoding the same enclosure into the same `.part`
  and `.resp-N.tmp` and removing each other's. Navigation cannot hold two detail screens for one
  message, checked in `AppNavigator.tsx` and `AppShell.tsx`: nothing on `MessageDetail` navigates (its
  route hands it only `onBack`); the inbox and search push the detail onto screens that are not details,
  and a sent message's compose replaces itself with it; a reminder tap pops to the inbox
  (`resetToInbox`) before it opens one. One screen can still start two. A second press before the busy
  state has rendered aborts the first download and starts another (`downloadAttachments`), and leaving
  the screen and opening the message again starts one while the walk the leaving cancelled is still
  decoding: a cancel reached only a request still out, and a walk cancelled between two requests went on
  asking for every enclosure left. The downloader now runs the downloads of one message's directory one
  after another, the enclosure walk and the signed original in the same queue: a second waits until the
  first has settled, one cancelled while it waits rejects at once and holds up nobody behind it, and a
  walk cancelled between enclosures asks for no further one and rejects as cancelled (`inTurn`, `walk`).
  That last change also makes a late cancel record nothing, as *Not done* below says a cancelled walk
  does: a walk cancelled while it decoded its last enclosure used to run on to the end and be cached.

Evidence: `__tests__/files/vodzAttachmentDownloader.test.ts` › an enclosure walk that stops part-way ›
"keeps the copy already in place when the finished file cannot be moved over it", "leaves that copy
aside, never removed, when it cannot be put back either"; › two downloads of one message at once › "lets
the second wait for the first, and both end with the file whole", "lets the signed original of the
message wait for its enclosures too", "lets a download cancelled while it waits go at once, holding up
nobody behind it", "asks for no further enclosure once cancelled, even when the cancel came after an
answer". The test disk's move now refuses a source that is missing and a destination that exists, as
iOS does. Checked by hand 2026-09-15: all six fail against the downloader before this review (`7d41e20`).

### Not done

- **Nothing here has met ISDS.** A walk stopped by `3013` or by `1219` half-way has never been observed;
  the codes are read from the manual (research R8).
- **A walk the user cancels records nothing.** Leaving the screen aborts the walk and the controller
  writes nothing, as before: enclosures that arrived before the cancel stay on disk unrecorded and are
  fetched again by the next download. Recording them would mean writing to a box's archive after the
  user has left it, possibly while the box is being removed.
- **A held file gone from the device is not fetched by the resume.** It shows as missing, like any
  other, and comes back with the full download offered once the message is whole - which, like every
  full download, replaces the files still there with fresh copies (each moved into place whole), and,
  stopped part-way, leaves the enclosures past the stop listed as they were (review, 2026-09-15).
- ~~**The signed original is still replaced by removing, then moving.** `streamSignedZfo` removes the file
  under the original's name before it moves the new one in, the pattern the review above closed for
  enclosures. It is asked for only when the archive holds no original whose file is there
  (`heldOriginal`), so what a failed move takes is mostly a copy no record points at, left by a download
  whose record was never written. Not always, since the queue above: an original fetched from its own
  row while the enclosures download waits behind them, and the original that follows the enclosures
  checks `heldOriginal` before it waits behind that one - so it can replace, and with a failed move
  lose, the file the first has just recorded (and fetches the whole original a second time when the move
  goes through). Noticed in that review (2026-09-15), corrected by its second reading the same day, and
  left, as it was not one of its findings.~~ *Closed 2026-09-24:* the copy under the name is moved aside
  to `.old` first, put back if the new one does not go in, and removed only once it has - the enclosures'
  order (`moveIntoPlace` in `src/services/files/signedZfoStream.ts`, with `exists` on `ZfoStreamIo`). So a
  second download that replaces the original the first has just recorded can no longer lose it. It still
  fetches the whole original a second time when both are asked for at once: that costs data, not the
  file. Tests: `__tests__/files/signedZfoStream.test.ts` › "keeps the original already in place when the
  new one cannot be moved over it" and "leaves that copy aside, never removed, when it cannot be put back
  either", both failing against the stream before the change; the test disk's move now refuses a
  destination that exists, as iOS does. Not walked on a device. *Review, 2026-09-24:* the three copies of the move are one now (`src/services/files/moveIntoPlace.ts`,
  also used by the VoDZ enclosures), with two gaps closed: a name with nothing under it and a copy aside
  (a process killed between the moves, or a failed put-back) gets that copy back first, and a stale
  `.old` that will not delete - which made the move aside refuse forever on iOS - is left alone while the
  copy under the name goes aside under a name of its own for that one replacement. A kill in that last
  case leaves the copy under the unique name, on disk but not put back by itself. Tests: the same file ›
  "puts back a copy a stopped replacement left aside, even when the new one cannot go in", "replaces the
  original even when a stale copy aside will not delete", both failing before that change.
- The heading's count is the number of attachments held; the notice under it says more are missing.

### Device walks owed (czebox)

10. A received or sent VoDZ with at least two enclosures: switch on airplane mode once the first
    enclosure's file has landed. The detail shows that one, *Stáhla se jen 1 příloha*, the reason and
    **Stáhnout chybějící přílohy**, and no percentage. Back online, press it: `DownloadAttachment` is
    asked from `attNum` 1 on, never 0 - seen through an HTTP proxy, because the app's debug log records
    nothing of a VoDZ download (review, 2026-09-15); the notice goes, the badge turns green and the
    original follows. Reopen the app in between: the notice is still there, with no ISDS call.
11. Force a decode to fail on a re-download of a message already held (a nearly full device): the file
    already there still opens, and no `.part` or `.resp-*.tmp` is left in its directory.
12. An OTP or Mobile Key box whose session has gone stale: a VoDZ download shows the re-auth copy, not
    *Tuto velkoobjemovou zprávu … se teď nepodařilo stáhnout*; record whether the portal redirected
    (018 FR-006 amended). The VoDZ download itself leaves no trace in the debug log; refresh the box's
    list in Full debug mode, where the body recorded for `/apps/DS/dx` is the sign-in page or whitespace.
13. (Review, 2026-09-15.) A VoDZ message already whole in the archive, with at least two enclosures:
    delete its first file from the device, press **Stáhnout znovu**, and switch on airplane mode once
    that file has landed. Every enclosure stays listed, the notice stays the one for missing files with
    the failure in it, never *Stáhla se jen 1 příloha*, and the signed original is still there. Reopen
    the message: the same, with no ISDS call.
14. (Review, 2026-09-15.) A VoDZ message with an enclosure of tens of megabytes: start its download, go
    back once the byte count stops climbing (the enclosure is decoding), open the message again at once
    and start the download. It waits, then completes; every file opens, and the message's directory holds
    no `.part`, `.old` or `.resp-*.tmp`. Through an HTTP proxy, the download that was left sends no
    `DownloadAttachment` after the one it was decoding.
