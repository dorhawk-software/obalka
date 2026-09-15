# Contract: Sending a large-volume message (VoDZ / `CreateBigMessage`)

**Status: IMPLEMENTED + LIVE-VALIDATED on czebox (2026-06-16).** A 25 MB file sent to an OVM
(Ministerstvo) over VoDZ succeeded end-to-end — `UploadAttachment` (server returned the hashes) →
`CreateBigMessage` → **dmID 12889438**. Protocol reverse-engineered from the vendored `dmBaseTypes.xsd`
types + libdatovka source + ISDS developer notes; the endpoint path was confirmed by probing czebox
(`/DS/vodz` → 401 = exists; `/vdz_ws/` → 404).

## Why this is not "just a bigger `CreateMessage`"

`tasks.md` originally assumed `CreateBigMessage` was a sibling SOAP op on `/DS/dz` taking larger
`dmFiles`. It is not. VoDZ is a **separate service, on a separate host, with a multi-step
out-of-band upload protocol**. Confirmed facts:

- The vendored `dm_operations.wsdl` binds only `dmOperationsBinding → https://ws1…/DS/dz` and exposes
  `CreateMessage` — there is **no `CreateBigMessage` binding and no upload endpoint in our schema**.
  `dmBaseTypes.xsd` defines the _types_ (`CreateBigMessage`, `AuthenticateBigMessage`,
  `BigMessageDownload`, …) but not the service.
- VoDZ lives on the **`ws2` host** under the **`/DS/vodz`** path, introduced with **WSDL 3.04**.
  Confirmed locator URLs (libdatovka `src/isds.c`), on the operator's domains since 2026 — `czebox.cz` and
  `mojedatovaschranka.cz` at the time. The app uses the `ws2` host for password boxes
  (`src/services/isds/endpoints.ts`; cookie boxes go through the portal, see *New endpoint* below):

  | Environment       | Host (no client cert)                | Host (client cert)                    |
  | ----------------- | ------------------------------------ | ------------------------------------- |
  | **test**          | `https://ws2.datovka-test.gov.cz/`   | `https://ws2c.datovka-test.gov.cz/`   |
  | **production**    | `https://ws2.datovka.gov.cz/`        | `https://ws2c.datovka.gov.cz/`        |

- New VoDZ operations: **`UploadAttachment`**, **`CreateBigMessage`**, **`AuthenticateBigMessage`**,
  `DownloadAttachment`, `SignedBigMessageDownload`, `SignedSentBigMessageDownload`.

## Size thresholds (operating rules, valid from 2024-01-01)

- A **normal `CreateMessage`** carries attachments up to the ordinary limit (**~20 MB** total;
  `BIG_MESSAGE_THRESHOLD_BYTES = 20 MB` is the routing boundary to VoDZ, and `VODZ_MAX_BYTES = 100 MB`
  is the block).
- A **VoDZ message** carries up to **100 MB**; a ZIP/ASiC container may expand to **up to 3 GB**
  after extraction.
- **Routing rule (T029):** total attachment bytes `≤ 20 MB` → `CreateMessage`; `> 20 MB and ≤ 100 MB`
  → VoDZ; `> 100 MB` → blocked (genuinely unsupported). Confirm the exact normal-vs-VoDZ boundary
  against the WSDL/operating rules — keep it in one config constant.

## The send flow (per external attachment)

**Corrected after reading the vendored `UploadAttachment` XSD (the request/response IS in
`dmBaseTypes.xsd`).** The big simplification: **the SERVER computes and returns both hashes** — the
client does NOT hash anything.

1. **`UploadAttachment`** one file → the request is just
   `<UploadAttachment><dmFile dmMimeType=… dmFileDescr=…><dmEncodedContent>base64</dmEncodedContent>
</dmFile></UploadAttachment>` (a single SOAP call per file; the content is base64 in the body —
   NOT chunked at the SOAP layer). The response (`UploadAttachmentResponse`) returns **`dmAttID`** +
   **`dmAttHash1`/`dmAttHash2`** (each an element value with an **`AttHashAlg`** attribute naming the
   algorithm, e.g. SHA-1 / SHA-256) + `dmStatus`. ⇒ no client-side hashing; we just **echo back** what
   the server returned.
2. **`CreateBigMessage`** with `tBigMessageInput`:
   - `dmEnvelope` = `tBigMessEnvelope` (same ordered prefix as the normal create envelope — only
     `dbIDRecipient` + `dmAnnotation` valued, rest `xsi:nil`).
   - `dmFiles`:
     - one **`dmExtFile`** per uploaded file (1..n, **required**), attributes: `dmFileMetaType`
       (`main` for the first), `dmAttID`, `dmAttHash1`, `dmAttHash1Alg`, `dmAttHash2`, `dmAttHash2Alg`
       (all from step 1's response), optional `dmFileGuid`/`dmUpFileGuid`. No content.
     - optionally **`dmFile`** (0..n) for _small inline_ files, base64 `dmEncodedContent`.
   - returns `tBigMessageOutput` = `dmID` + `dmStatus` (parse like `CreateMessageResponse`).

**That's the whole send.** `AuthenticateBigMessage` (input `dmMessage` base64 → `dmAuthResult` boolean)
is **NOT** part of sending — like the regular `AuthenticateMessage`, it _verifies_ a message blob's
authenticity (download/verify side, out of scope for US3 send).

## Constraints this imposes (the real cost of US3)

- **Principle I (memory, not hashing):** `UploadAttachment` carries the file as base64 in the SOAP
  body, so a 100 MB file becomes a ~133 MB base64 string. We already read base64 OFF the JS thread
  (the picker streams it in chunks through `RNBlobUtil.fs.readStream(path, 'base64', …)` since 005
  T006, 2026-09-14; before that, one `readFile(path, 'base64')`), so the encode doesn't block — but
  holding the whole base64 string in JS is heavy. **Streaming the upload from the file path is a
  follow-up optimization** (`localPath` is threaded through for it); correctness first.
- **No new hashing capability needed** — the server returns the hashes (revises the spike's earlier
  assumption).
- **New endpoint:** `ws2` `/DS/vodz` added to `endpoints.ts` (`vdzWsUrl`) — **confirmed live** for a
  password box; the `ws2c` client-cert variant is out of scope. *Corrected 2026-09-14:* `ws2` is the HTTP
  Basic host, so an OTP / Mobile Key box does not use it. Its session goes to the portal's
  `/apps/DS/vodz` (`appsVodzUrl`), the one address ISDS documents for a cookie session
  (`MobilniKlic_autentizace` §2). That route has not been exercised with a real session (018 T006).
  *Since 2026-09-15 (018 T015)* the VoDZ downloads - `DownloadAttachment` and
  `SignedBigMessageDownload` / `SignedSentBigMessageDownload` - take the same split: `ws2` with Basic for
  a password box, `/apps/DS/vodz` with the box's own cookie for a cookie box, and RN's shared cookie jar
  kept out of `react-native-blob-util` by the patched `omitCookies` option. Not exercised with a real
  session either.
- **No-double-charge interplay:** VoDZ is also a _paid_ path for private recipients — the
  reconcile-after-timeout guard ([sendController](../../../src/features/messages/state/sendController.ts))
  must cover the VoDZ create step too (the existing `GetListOfSentMessages` reconcile applies; a sent
  VoDZ message has `dmVODZ=true` in its envelope).

## Re-scoped task breakdown (supersedes the original T027–T029 sizing)

- **B1 — Endpoints (DONE):** `vdzWsUrl()` for `ws2` (test/prod), path `/DS/vodz` (confirmed, see B0).
- **B3 — SOAP builders/parsers (DONE):** `buildUploadAttachment`/`parseUploadAttachment` +
  `buildCreateBigMessage`/`parseCreateBigMessage`. (No `AuthenticateBigMessage` — verify op, not send.
  No client hashing — the server returns the hashes in `UploadAttachmentResponse`.)
- **B4 — Transport (DONE):** `sendBigMessage(args)` orchestrating per-file `UploadAttachment` →
  `CreateBigMessage`, mapping faults to the same typed outcomes as `sendMessage`.
- **B5 — Controller routing (DONE, T029):** `SendController.send` routes `> 20 MB && ≤ 100 MB` to
  `sendBigMessage` (keeping the paid/no-silent-spend/no-double-charge gates); `> 100 MB` →
  `blocked: tooLarge`.
- **B6 — Tests (DONE, T027):** routing-decision + builder/parser unit tests.
- **B0 — Confirm on czebox (DONE 2026-06-16):** endpoint `/DS/vodz` confirmed (404 vs 401 probe) and a
  25 MB free VoDZ send to an OVM succeeded end-to-end (dmID 12889438). The 25 MB in-memory base64 was
  fine on the emulator. Still open as an **optional follow-up:** stream the `UploadAttachment` upload
  from `localPath` instead of holding the whole base64 string in JS (matters near the 100 MB ceiling);
  and the _paid_ VoDZ path (private recipient) hasn't been money-spent-validated, though it reuses the
  same gated send as `CreateMessage`.

## Sources

- Vendored `src/services/isds/schema/v20/dmBaseTypes.xsd` (`tBigMessageInput`, `tBigMessEnvelope`,
  `dmExtFile`, `AuthenticateBigMessage`).
- libdatovka `src/isds.c` (`isds_vodz_locator` URL strings) + `isds.h` (`isds_hash_algorithm`,
  `dmVODZ` envelope flag) — <https://gitlab.nic.cz/datovka/libdatovka>.
- ISDS developer notes / operating rules (ws2 endpoint, WSDL 3.04, 100 MB / 3 GB limits,
  VoDZ operation list) — <https://datovka.gov.cz/info/cs/2037.html>.
