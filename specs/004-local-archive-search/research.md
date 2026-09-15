# 004 research — keeping the signed original (.zfo)

**Date**: 2026-09-14. **Question**: what does it take to keep each message's signed ZFO envelope, as
constitution IV requires, without a czebox session to check anything against?

Everything below is read from the vendored schemas, the operator's bulletins in `docs/isds-ws-news/`,
the Provozní řád and the code as it stood on `main`. Where a fact has not been observed on a real box
it says so.

## R1 — Which ISDS services return a signed message

| Service | Endpoint | Serves | Response | Source |
| --- | --- | --- | --- | --- |
| `SignedMessageDownload` | dmOperations `/DS/dz` (cookie boxes: `/apps/DS/dz`) | a received message | `tSignedMessDownOutput`: `dmSignature` (base64) + `dmStatus` | `dm_operations.wsdl` operation 3; `dmBaseTypes.xsd` `tSignedMessDownOutput` |
| `SignedSentMessageDownload` | same | a sent message | same type | same; called by the app since 005 and confirmed on czebox |
| `SignedBigMessageDownload` | ws2 `/DS/vodz` | a received VoDZ | `dmSignature` + `dmStatus` | `dmBaseTypes.xsd` element; bulletin 2175 §3.3.1 |
| `SignedSentBigMessageDownload` | ws2 `/DS/vodz` | a sent VoDZ | same | same |

`SignedMessageDownload` takes the same `tIDMessInput` as `MessageDownload`, lives in the same WSDL
and binding, and so uses the same endpoint and the same authentication split.

From bulletin 2175 (`docs/isds-ws-news/2175_Info_pro_vyvojare_2022_1_VoDZ_ZIP_ASiC.md`):

- **§3.8**: asking an old service for a VoDZ, or a new service for an ordinary message, fails with
  `dmStatusCode 1281` "Zvolená služba není určena pro tento typ zprávy". So 1281 from the ordinary
  signed download is the routing signal for a received message exactly as it already is for a sent
  one (005 confirmed the sent case on czebox).
- **§3.8**: the ZFO returned by the big services "je shodný s formátem ZFO pro normální zprávy".
- **§3.4**: the big services return the data as base64 inside the XML unless a SOAP 1.2 request
  carries `Accept: multipart/related`. The app sends SOAP 1.1 (`text/xml`) with no `Accept`, the same
  way it already calls `DownloadAttachment` on `/DS/vodz`, which is confirmed on czebox.
- **§3.1(3)**: a VoDZ ZFO "může mít velikost přes 1 GB a aplikace s tím musí počítat". It cannot be
  held in the JS heap, or read back through a single native string.
- **§3.5**: the recommended received-VoDZ route is either the whole ZFO (`SignedBigMessageDownload`)
  or the envelope plus `DownloadAttachment` per enclosure. The app already uses the second for sent
  VoDZ messages.

`dm_VoDZ.wsdl` is not vendored; the element types are in `dmBaseTypes.xsd` and in the generated
`src/services/isds/generated/isdsTypes.ts` (`SignedBigMessageDownloadResponse`, …).

## R2 — What `dmSignature` contains

A CMS `SignedData` (the operator's CAdES seal). Its encapsulated content (`eContent`, content type
id-data) is the message as XML. Confirmed on czebox for **sent** messages in 005: no XML prolog, the
root is `q:MessageDownloadResponse` in the namespace `…/v20/SentMessage`, and larger content arrives
as a constructed OCTET STRING split into ~1 KB primitive segments (`soap.test.ts` pins both).

For **received** messages the same shape is expected — the operator describes one ZFO format — but it
has not been observed: the app has never made a received signed download, and no czebox credentials
are available on 2026-09-14. That uncertainty is the reason for the fallback in plan D2.

The decoded `dmSignature` is itself the `.zfo` file that external readers open (Datovka, the portal's
message verification). Nothing needs to be added to it.

## R3 — How long ISDS holds a message

Provozní řád (`docs/isds-provozni-rad-2026-06-26.md`, "Doba uchovávání datové zprávy"): *"ISDS
uchová datovou zprávu po dobu 90 dnů od okamžiku, kdy se do datové schránky přihlásila osoba … (tj.
od okamžiku doručení přihlášením). Datovou zprávu, která nebyla doručena přihlášením, uchovává ISDS
po dobu nejméně 3 let."*

- The window runs from delivery (`dmAcceptanceTime`), not from `dmDeliveryTime`.
- State 5 (served by fiction) is a message NOT delivered by sign-in, so it is held for at least three
  years. A fiction-served message that was read later shows state 7 and cannot be told apart from one
  read on sign-in, so past 90 days the app can only say "probably deleted", never "deleted".
- State 9 means ISDS has erased the content.
- The existing attachment heuristic (`MessageDetail.tsx` `RETENTION_MS`) measures from
  `deliveryTime` and treats a server fault past the window as the confirmation. *Replaced 2026-09-15
  (R8):* `RETENTION_MS` is gone; the controller records the loss only on ISDS's `1219`, past the window
  as `signedOriginalAvailability` reads it (from `dmAcceptanceTime`, three years for fiction).

## R4 — The existing unwrap cannot carry the received folder

`soap.ts` `parseSignedSentMessageDownload` decoded the whole signature with `atob` into a latin1
string, rebuilt UTF-8 one character at a time with `out +=`, and then gave fast-xml-parser the entire
XML including every attachment's base64. For a 20 MB message that is roughly 27 MB of base64 walked
character by character in one synchronous call, a second full copy of the document as a JS string,
and a parse over it. The sent folder tolerated that because it is opened rarely and its messages are
usually small. The received folder is the most-used path and is where 20 MB scanned decisions
arrive, so the same code there would hold the JS thread for as long as the message is large
(constitution I). Hermes has no `TextDecoder` (`textCodec.ts`).

The decoder also did not check continuation bytes, so a stray byte could swallow the character after
it; `textCodec.decodeUtf8` follows the WHATWG error handling and does not.

*Found in review, 2026-09-14:* the same cost sat one layer up. Before any unwrap, the transport gave
fast-xml-parser the whole SOAP answer, and `dmSignature` is the message as one base64 text node.
Measured in Node on a synthetic 27 MB answer with the parser options `soap.ts` uses: 2.5 s under V8
with its JIT, 4 s with `--jitless`, while `indexOf` over the same string took under 5 ms. Hermes has
no JIT. The signed path now cuts the body out first (`cutSignature`). The unsigned `MessageDownload`
answer, still used as the fallback, is parsed whole as it always was.

## R5 — Where files live, and what carries them

- `attachmentFileStore` writes `DocumentDir/attachments/<box>/<message>/`; inline attachments are
  named `<i>-<name>` and VoDZ enclosures `<attNum>_<name>`, so a name that starts with a letter cannot
  collide with either.
- Backup Tier 2 (`documents.ts`) takes its candidates from `detail.attachments[].localPath` and, on
  restore, matches a stored document to an attachment by file name. `detailJson` is opaque text in
  `SNAPSHOT_SHAPE`, so a new optional field inside it is not a payload-shape change.
- **Found while tracing this feature:** 025's `TransferController.apply` called `restoreBackup`
  without the document tier. The Tier 2 objects travel to the receiving phone and are counted, but
  they were never written back and no detail was repointed at them — for attachments as much as for
  anything new.
- `documentSource.open` (`features/accounts/deps.ts`) reads a whole file with
  `readFile(path, 'base64')`, which on Android is a Java string of 4/3 the file. Its comment justifies
  that by "ISDS caps a single message at 20 MB", which a VoDZ enclosure (up to 100 MB) already
  contradicts, and a ZFO is larger than the attachments it seals.
- `fileTarget.getObject` and the transfer's `copyDocuments` / staged `getObject` also read whole
  objects. Not changed here; see plan D10 and the amendment in `spec.md`. *Since 2026-09-15 they
  read a slice at a time (025 T014).*

## R6 — Removing a box

`box.removeMessage` tells the user the box's local archive — *"stažené zprávy, přílohy a termíny"* —
is removed. `AppShell.handleRemove` → `MessagesController.clearBoxCache` deleted the database rows
only, and a comment kept the files deliberately ("future 004"). Once the rows are gone nothing in the
app references those files, so they were unreachable data the dialog said had been deleted.
`attachmentFileStore.removeForBox` existed and was tested, but nothing called it.

## R7 — Handing a .zfo to the user

- `attachmentOpener.open`: iOS tries QuickLook and falls back to the options menu (share, save to
  Files); its comment already names a `.zfo` as the case QuickLook cannot render. Android fires
  `ACTION_VIEW` and throws `NoViewerError` when no installed app claims the type.
- `portableIo.save` (`deps.ts`) uses `saveDocuments` from `@react-native-documents/picker`, the
  system "save to" sheet, and is how a backup file already leaves the phone.
- The registered media type for `.zfo` is `application/vnd.software602.filler.form-xml-zip`.

## R8 — The status code ISDS gives for a deleted message

**Added 2026-09-15.** Until then any `dmStatusCode` other than `0000`/`1281` past the retention window
recorded a message as gone (spec, *Not done*: "not told apart by code"), and the attachment
re-download took any server fault past 90 days the same way (R3).

Nothing vendored lists the codes of the download services. `tStatus.dmStatusCode` has no enumeration in
`dmBaseTypes.xsd`, and the bulletins in `docs/isds-ws-news/` name only codes of other services: `1299`
"Příloha N neexistuje" (`DownloadAttachment`, 2175 §3.6.2), `1187` "Oznámená zpráva je již smazaná"
(the spam report, 2187) and `1600` "Zpráva se zadaným ID neexistuje mezi živými zprávami"
(`SuspMessageReport`, 2194). None of those may be borrowed for a download.

The operator's web-service manual documents it: *Webové služby rozhraní ISDS pro manipulaci s datovými
zprávami* (`WS_manipulace_s_datovymi_zpravami.pdf`), verze 3.0, aktualizováno 14. 12. 2023, "Veřejný
dokument". Read from the copy published in the test contract register,
`https://testrs.gov.cz/smlouva/soubor/382326/WS_manipulace_s_datovymi_zpravami.pdf`; not vendored.

- §2.6.1 `MessageDownload`: *"Je-li zpráva již smazaná (po 90 dnech po doručení nebo 3 letech po
  dodání), skončí pokus chybou 1219. Opravdu nemá smysl opakovat v tomto případě pokusy o stažení –
  naopak to může být za nepřiměřenou aktivitu aplikace."*
- §2.6.3 `SignedMessageDownload`: the same sentence, without "Opravdu".
- §2.6.4 `SignedBigMessageDownload`: *"Služba je shodná se službou SignedMessageDownload, ale volá se
  výhradně pro VoDZ."* §2.6.6 says the same of `SignedSentBigMessageDownload` and
  `SignedSentMessageDownload`.
- `EraseMessage`: *"Není-li zadaná zpráva ve stavu 10 nebo není nalezena mezi došlými či odeslanými
  zprávami, vrátí se chyba 1219. Je-li to zpráva patřící jiné schránce, vrátí se chyba 1211."*
- Codes the same manual gives that are NOT a deletion: `1222`, a received message in state 4 or 5
  (§2.6.1, §2.6.3); `1211`, another box's message; `1229`, a sent message not delivered yet (§2.6.5);
  `3013`, *"Práce s Velkoobjemovou datovou zprávou je dočasně pozastavena, zkuste operaci opakovat
  později"* (§1.9.3).
- `DownloadAttachment` (§2.4.2): *"Zpráva nesmí být smazaná"*, with no code.

What that justifies, as built (`STATUS_MESSAGE_DELETED` in `soap.ts`):

- `1219` is the only code read as a deletion (`gone`), on every download service. For
  `SignedSentMessageDownload`, `SignedSentBigMessageDownload` and `DownloadAttachment` that is an
  inference, not a quotation: the manual gives no code for a deleted message there, uses 1219 for a
  message not found among the received or the sent ones, and gives no other code for a deleted one.
- Still only past the retention window (R3, `signedOriginalAvailability`): the manual describes 1219 as
  a message deleted 90 days after delivery or three years after it was dropped into the box, so a 1219
  inside that window contradicts it, and a permanent record is not made on a contradiction.
- Every other code is `refused`: a localized error with a retry (`detail.original.refused`,
  `detail.attachments.refused`), recorded nowhere. A missing status stays a fault, as before.
- None of these codes has been observed from a real box.
