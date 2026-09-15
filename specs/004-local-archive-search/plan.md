# 004 plan — the signed original (.zfo) in the archive

**Input**: constitution IV ("Messages and their original signed ZFO envelopes are persisted locally …
and are NEVER silently lost"), `spec.md` › Notes / Deferred, and `research.md` (2026-09-14).
**Status**: design written 2026-09-14, before the code; the record of what was built is the amendment
in `spec.md`.

## Constraints that shaped every decision

- **No czebox.** The received signed download has never been observed (research R2). Every new path
  must degrade to what the app did before, never to an unopenable message.
- **Constitution I.** The received folder carries 20 MB messages; nothing may walk them on the JS
  thread in one piece. A VoDZ ZFO can exceed a gigabyte (R1) and must never enter the JS heap.
- **ISDS only on a user action.** No ZFO is fetched on opening a message, on sync, or in the
  background. Downloading a message fetches its ZFO; a separate tap fetches it for an older message.
- **Other branches** change `sendBigMessage`, `classifyFailure`, `ComposeScreen` and the transfer
  screen. Hunks stay local to what this needs.

## D1 — One signed-message parser, bytes-based and chunked

New `src/services/isds/signedMessage.ts`, used by both folders; the synchronous unwrap in `soap.ts`
(`extractZfoXml`, `parseSignedSentMessageDownload` and helpers) is removed.

1. Decode the base64 in 1 MB slices, yielding between slices.
2. Find the CMS `eContent` on the bytes: the id-data OID followed by `[0]`, then a primitive OCTET
   STRING, or a constructed one (including nested and indefinite-length forms) whose segments are
   copied into one buffer. No structure → the raw bytes, as before.
3. Locate the message root (`MessageDownloadResponse`, else `dmReturnedMessage`, else `dmDm`).
4. Split every `dmEncodedContent` body out of the XML. The remaining skeleton is kilobytes; it is
   UTF-8 decoded (chunked) and parsed with the existing attribute parser and `parseMessageDownload`.
   Each attachment's base64 is taken from its byte range (ASCII, native `String.fromCharCode` over
   8 KB pieces) and put back by placeholder, so a `dmXMLContent` file or an odd order cannot shift it.

The XML parser therefore never sees attachment bodies, and no whole-document JS string is built.

## D2 — Received messages: `SignedMessageDownload`, with the old download behind it

| Signed response | Outcome |
| --- | --- |
| 401/403, or a cookie box's whitespace-only 200 | `authFault`, no second call |
| `0000`, detail parses | detail **and** the signature (the ZFO) |
| `0000`, no `dmSignature` or it will not parse | report `isds.parse`; `MessageDownload` for the detail; the ZFO is still returned with it |
| `1281` | `unsupported` → the VoDZ path (bulletin §3.8), which a received VoDZ previously never reached |
| any other status, or a non-200 | report `isds.download`; `MessageDownload`; detail without a ZFO |
| thrown network/timeout | thrown, as today |

If the fallback also fails, its own outcome is returned and nothing is stored; the user's retry makes
both calls again.

*As built, after review:* the status in the first column is read from the SOAP answer with the
`dmSignature` body already cut out (`cutSignature`). Parsing the answer whole would put the entire
message through the XML parser as one text node, which takes seconds on the JS thread (research R4).
In D4, a `1281` from the large-volume service is a fault, not a refusal.

## D3 — Sent messages

`SignedSentMessageDownload` already returns the blob; it is now kept. There is no unsigned download
for a sent message, so a parse failure stays `serverFault` — now reported as `isds.parse`.

## D4 — Large (VoDZ) messages: stream the ZFO to disk

Attachments keep coming from `DownloadAttachment` (confirmed on czebox) and the detail is cached
before anything else happens. Then, best-effort, `SignedBigMessageDownload` /
`SignedSentBigMessageDownload` on ws2 `/DS/vodz`: blob-util writes the response to a temp file, the
`<dmSignature>` region is found in the head and tail and decoded into `DZ_<id>.zfo.part` in 1.5 MB
chunks through the same helpers the enclosures use, then renamed into place. *As built:* the
decisions (status, where the body is, part file and move) live in `services/files/signedZfoStream.ts`
behind an injected `ZfoStreamIo`, so they are tested; the enclosure code is untouched and lends its
slice helpers to the device implementation. A failure leaves the attachments where they are, reports `isds.download`, and the detail offers
the on-demand fetch (D6). Parsing the detail out of a VoDZ ZFO is not attempted: it would replace a
confirmed path with an unverified one.

## D5 — Storage and the detail record

- `MessageDetail.signedZfo?: { fileName: string; localPath: string; size: number }`.
- File `DZ_<dmID>.zfo` in the message's attachment directory
  (`AttachmentFileStore.persistSignedZfo`, a native base64 write, as attachments are written).
- **Never overwritten:** when the detail already names a ZFO whose file exists, a later download
  keeps it.
- Stored only through a file store; the base64 is never put into `detailJson`.
- A write failure reports `file.write` and leaves the detail without `signedZfo`.

## D6 — Fetching the original for a message downloaded earlier

`MessagesController.fetchSignedOriginal(account, messageId, folder, signal)`, reached only from a tap.
It calls a new transport `downloadSignedMessage` (the signed request without parsing), or the VoDZ
stream after a `1281`, writes the file and records `signedZfo` on the cached detail without touching
its attachments. ~~A refusal from ISDS (a `dmStatusCode` other than `0000`/`1281`, kept apart from an
outage or a broken transfer as `refused`) on a message past the retention window sets the existing
`attachmentsUnavailable` flag, which already means "ISDS no longer has this message".~~ *Amended
2026-09-15:* only `1219`, the code ISDS documents for a deleted message (research R8), kept apart as
`gone`, sets the `attachmentsUnavailable` flag, and only on a message past the retention window. Any
other code is `refused`: a retryable error with its own message (`detail.original.refused`) that
records nothing. An outage never does either.

## D7 — Removing a box removes its files

`clearBoxCache` also calls `attachmentFiles.removeForBox`, which makes `box.removeMessage` true for
attachments and ZFOs alike (R6). A failure to delete is reported and never blocks the removal.

## D8 — Backup Tier 2

`documentCandidates` adds `detail.signedZfo.localPath`; `restoreDocuments` matches a stored document
to `signedZfo` by file name as it does attachments, and repoints `localPath` and `size`. No schema
bump: `detailJson` is opaque in `SNAPSHOT_SHAPE`, the document index already carries file names, and
an older app restoring a newer backup counts the ZFO as orphaned rather than losing it — the object
stays in the store and a later restore on an updated app places it. `goldenRestore.test.ts` (schema
v1) must keep passing unchanged.

## D9 — Phone transfer restores documents

`TransferController` takes the same `DocumentRestore` the backup screen uses and passes it to
`restoreBackup`, so attachments and ZFOs that travel are written back (R5). Wired in `deps.ts`.

## D10 — Reading a large document for Tier 2

`documentSource.open` reads a file in 1 MB slices (`fs.slice` to a scratch file, then base64) instead
of whole. The pure part — which range each slice is, and refusing a file that changed size — lives in
`services/files/sliceSource.ts` so it is tested. Whole-object reads in `fileTarget.getObject` and in the
transfer's copy remain, bounded by the largest object; recorded as open. *Closed 2026-09-15 by 025's
review follow-ups:* the slice reader is `BackupFs.open` now, and `documentSource.open` delegates to it.
`fileTarget.getObject`, the transfer's staged `getObject` and `copyDocuments` read through it, one
slice at a time (`chunksOnRequest` in the same file). See 025 `tasks.md` T014.

## D11 — The deadline scan

`attachmentScan.isScannable` rejects a `.zfo` (or its media type) even when mislabelled as a PDF, and
the detail screen scans `detail.attachments` only, never `signedZfo`.

## D12 — The detail screen

When the message's contents are downloaded, a **Podepsaný originál** section under the attachments,
using the attachment row's metrics (40 dp sunken tile, 11/13 padding, 14 radius):

| State | Row | Action |
| --- | --- | --- |
| stored, file present | `DZ_<id>.zfo · size` | open via `attachmentOpener`; Android without a ZFO app → the system save sheet |
| not stored, within 90 days of delivery (or served by fiction) | "Stáhnout podepsaný originál" | `fetchSignedOriginal` |
| not stored, past 90 days | same, caption says ISDS has probably deleted it | still offered: a fiction-served message is held ≥ 3 years (R3) |
| confirmed gone (`attachmentsUnavailable`) or state 9 | "Podepsaný originál nelze získat" | none |
| stored, file missing | caption "Soubor chybí na zařízení" | fetch again when not confirmed gone |

The caption line and a fixed 24 dp trailing slot carry every transient state (fetching, error), so
nothing moves (constitution V). All strings in both locales.

## Tests (each fails on the code before this change)

- `__tests__/isds/signedMessage.test.ts` — fixtures built from `dmBaseTypes.xsd`
  (`tSignedMessDownOutput`, `tReturnedMessage`/`dmDm`, `tFilesArray` with `dmEncodedContent` and
  `dmXMLContent`), wrapped in real CMS DER (primitive, constructed, nested, indefinite length).
- `__tests__/isds/isdsTransport.test.ts` — each row of D2; sent keeps the blob; `downloadSignedMessage`.
- `__tests__/files/signedZfoStream.test.ts` (the streamed original) and
  `__tests__/files/sliceSource.test.ts`; `__tests__/files/attachmentOpener.test.ts` (open, else save).
- `__tests__/services/attachmentFileStore.test.ts` — `persistSignedZfo`.
- `__tests__/messages/messages.test.ts` — stored on download, never overwritten, VoDZ best-effort,
  on-demand fetch, box removal deletes files.
- `__tests__/backup/documents.test.ts` — candidate, restore and repoint.
- `__tests__/transfer/transferController.test.ts` — a travelling ZFO is written back.
- `__tests__/services/attachmentScan.test.ts` — the ZFO is skipped.
- `__tests__/messages/signedOriginal.test.ts` — the retention and row rules;
  `__tests__/messages/signedOriginalSection.test.tsx` — the row rendering them
  (`screens/SignedOriginalSection.tsx`, kept out of `MessageDetail.tsx` so that file's hunk stays small).

## Device walks owed (czebox, constitution VII)

Listed in `spec.md` › Amendment; none has been done.
