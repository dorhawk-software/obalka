# Contract: ISDS send operations (on-device SOAP)

> **As built.** This was built as `SendController` (`src/features/messages/state/sendController.ts`), which
> returns a typed `SendOutcome` rather than being a `SendService` with `SendResult` / `SendError`. The SOAP
> builders and parsers live in `src/services/isds/soap.ts` — there is no `operations.ts`. Recipient lookup
> uses the fulltext `ISDSSearch3` rather than `FindDataBox2`, credit comes from `DataBoxCreditInfo`, and
> there is no `PDZInfo` call. There is no `sendToken` either: ISDS has no idempotency key, so a retry
> reconciles against `GetListOfSentMessages` (tasks T024). Drafts are one `drafts` table without
> attachments, which are re-added on resume. [`docs/sending.md`](../../../docs/sending.md) maps the flow as built.

The vendored operations this feature adds to `src/services/isds/operations.ts`, following the existing
`buildXxx` (envelope) / `parseXxx` (response) pattern. All run over the existing `isdsTransport`
(native `fetch`, off the JS thread) against the host from `endpoints.ts` (czebox in dev, gated prod).
Auth reuses the box session/secret from 001. Source WSDLs: `schema/v20/db_search.wsdl`,
`dm_operations.wsdl`, `dm_info.wsdl`.

## `FindDataBox2` — recipient lookup

- **Input**: search criteria — name / box ID / IČO / address fragments (debounced query).
- **Output (per hit)**: `dbID`, owner name + address (→ `label`), **`dbType`** (`OVM`|`FO`|`PFO`|`PO`),
  and the **PDZ-acceptance / open-addressing** flag (→ `acceptsPdz`).
- **Use**: drives `Recipient` + the free/paid badge. Zero/many results handled in UI (research §6).
- **Errors**: empty result (show "nothing found"); too many (ask to refine); transport error → retry.

## `DataBoxCreditInfo` / `PDZInfo` — sender credit & PDZ eligibility

- **Input**: sender `boxId` (+ optional date range for history).
- **Output**: PDZ **credit balance (CZK)**, whether the box **may send PDZ** (`pdzEnabled`).
- **Use**: populates `CreditInfo`; shown in the confirmation; gates paid send (block + link out when
  `!pdzEnabled` or insufficient balance).
- **Errors**: treat unknown/absent as "cannot send PDZ" and explain, never as "free".

## `CreateMessage` — send (normal)

- **Input**: `dbIDRecipient` (resolved box), `dmAnnotation` (subject), message type/PDZ fields
  selecting **DZ (free, to OVM)** vs **PDZ (paid, to private)**, and documents as
  `dmFiles` with **base64 `dmEncodedContent`** (`dmFileDescr`, `dmMimeType`, `dmFileMetaType`
  main/enclosure). Base64 is produced **off the JS thread** (research §7).
- **Output**: **`dmID`** (sent message ID) + `dmStatus` (parsed via the existing `readDmStatusCode`).
- **Errors**: typed mapping of ISDS status codes (recipient won't accept PDZ, insufficient credit,
  size over limit → reroute to `CreateBigMessage`, auth/session expired → reauth). Never an unhandled throw.

## `CreateBigMessage` — send (large / VoDZ)

- **When**: total attachment size over the ordinary-message limit (chosen client-side, research §4).
- **Input/Output**: as `CreateMessage` but on the large-volume track; same `dmID` result shape.

## Invariants

- **Free vs paid is decided pre-send** from the recipient `dbType` (never inferred only from the
  response).
- **No send call is issued for a paid message** until the user has confirmed the cost and credit
  passed (enforced by `SendService`, below).
- Every call has a timeout + typed error; the bundle is identical on retry (idempotency token).
