# Phase 0 Research: Sending Messages

> **As built.** This was built as `SendController` (`src/features/messages/state/sendController.ts`), which
> returns a typed `SendOutcome` rather than being a `SendService` with `SendResult` / `SendError`. The SOAP
> builders and parsers live in `src/services/isds/soap.ts` — there is no `operations.ts`. Recipient lookup
> uses the fulltext `ISDSSearch3` rather than `FindDataBox2`, credit comes from `DataBoxCreditInfo`, and
> there is no `PDZInfo` call. There is no `sendToken` either: ISDS has no idempotency key, so a retry
> reconciles against `GetListOfSentMessages` (tasks T024). Drafts are one `drafts` table without
> attachments, which are re-added on resume. The recipient search and the drafts list are part of
> `ComposeScreen.tsx` rather than separate `RecipientSearch` / `DraftList` screens. Attachments are capped
> against the 100 MB message limit when they are picked, before any bytes are read, then read and
> base64-encoded natively in chunks through `react-native-blob-util` `readStream` in
> `src/services/files/attachmentPicker.ts` (off the JS thread; no custom TurboModule), with real progress
> and a cancel on the compose screen; the send-time `tooLarge` block remains as the backstop (tasks
> T006, completed 2026-09-14; §7).
> [`docs/sending.md`](../../docs/sending.md) maps the flow as built.

Resolves the `NEEDS CLARIFICATION` items from the plan and the open questions in `spec.md`. Format:
**Decision / Rationale / Alternatives**. Everything here is grounded in the vendored WSDLs under
`src/services/isds/schema/v20/` (`db_search.wsdl`, `dm_operations.wsdl`, `dm_info.wsdl`) and the
observed production cost behaviour recorded in `spec.md`.

## 1. Free vs. paid classification (the core rule)

**Decision**: Classify from the **recipient box type** returned by `FindDataBox2`:
- recipient `dbType` = **OVM** (public authority) → **free** ordinary data message (DZ).
- recipient `dbType` = **FO / PFO / PO** (private) → **paid** commercial message (PDZ).
The sender confirms the classification *before* sending; the UI shows "Zdarma" (free) or the CZK cost.

**Rationale**: The free/paid split is a property of the *recipient*, and `FindDataBox2` already
returns `dbType` (plus the OVM flags noted in `db_manipulations.wsdl`). This keeps classification a
pure function of the lookup result — unit-testable with no network (`costModel.ts`).

**Alternatives considered**: Inferring cost only from the server's post-send response — rejected: it
would mean spending (or attempting to spend) before the user is informed, violating "inform before
paying" (FR-001) and Principle II.

## 2. PDZ eligibility — sender *and* recipient

**Decision**: A paid send requires **both** sides to allow PDZ:
- **Sender** box must have PDZ sending enabled and credit — read via `DataBoxCreditInfo` /
  `PDZInfo` (`dm_info.wsdl` lists "Informace o způsobu posílání PDZ — PDZInfo").
- **Recipient** box must **accept** commercial messages (the PDZ-acceptance / open-addressing flag on
  the `FindDataBox2` record).
If either is false, we **block the send with a clear localized reason** (sender: "PDZ není povoleno /
nedostatek kreditu" + link out to buy credit; recipient: "Tato schránka nepřijímá poštovní datové
zprávy") rather than letting ISDS reject it opaquely.

**Rationale**: Matches Principle II (degrade to a clear, recoverable state) and avoids a confusing
server-side failure at the last step. Both signals are available pre-send.

**Alternatives considered**: Optimistically sending and surfacing the ISDS error — rejected (poor UX,
risks a partial/charged state).

## 3. Credit info and top-up

**Decision**: **Show** the box's PDZ credit balance via `DataBoxCreditInfo` in the compose/cost
confirmation. **Do not** attempt in-app top-up — **link out** to the ISDS web portal
(`datovka.gov.cz`) to buy credit.

**Rationale**: The ISDS API exposes credit *info* but no top-up operation (confirmed:
`DataBoxCreditInfo` is in `db_search.wsdl`; no charge/top-up WS exists). Even if one existed, selling
message credit in-app would be treated as digital goods by Apple/Google (30% + IAP rules) — another
reason to link out. This honors Principle VI (honest scope) and keeps us clear of store-review trouble.

**Alternatives considered**: A WebView purchase flow — rejected (digital-goods policy risk, and no
API to confirm the purchase landed).

## 4. `CreateMessage` vs. `CreateBigMessage`

**Decision**: Use **`CreateMessage`** for normal messages and route to **`CreateBigMessage`** (the
large-volume / VoDZ track) when total attachment size exceeds the ordinary-message limit. Pick the
operation in `sendController` from the measured total attachment size; never let the user hit an
opaque size rejection.

**Rationale**: The two operations exist precisely to split normal vs. large payloads; choosing
client-side from known sizes is deterministic and testable.

**Alternatives considered**: Always `CreateBigMessage` — rejected (heavier path, different
semantics/limits for small messages). Hard-fail over the limit — rejected (Principle II).

**RESOLVED (spike, 2026-06-15)** — `CreateBigMessage` is **not** a sibling op on `/DS/dz`; VoDZ is a
**separate service** on the **`ws2`** host (`https://ws2.datovka-test.gov.cz/` test, `https://ws2.datovka.gov.cz/`
prod — `czebox.cz` / `mojedatovaschranka.cz` at the time), path `/DS/vodz` (the first guess, `/vdz_ws/`, 404s), **WSDL 3.04**, with a multi-step out-of-band flow:
`UploadAttachment` (→ `dmAttID`) → `CreateBigMessage` (references files by ID + **two different-algorithm
hashes**, `dmExtFile`). Sizes: normal ≤ ~20 MB, VoDZ ≤ 100 MB (ZIP/ASiC ≤ 3 GB
expanded). Implies a new endpoint + **off-thread streaming hash+upload** of up to 100 MB (Principle I).
Full protocol, re-scoped task breakdown, and open confirmations: **[contracts/isds-bigmessage.md](contracts/isds-bigmessage.md)**.

**Resolved (2026-06-15/16, see contracts/isds-bigmessage.md):** the server computes and returns both
hashes; each file is one `UploadAttachment` call (no SOAP-level chunking); `AuthenticateBigMessage`
verifies a message and is not part of sending.

## 5. Cost estimation by size

**Decision**: Show a **best-effort estimate** with explicit "approximate" wording, derived from a
small **size-tier table** (observed: ~10 CZK normal, ~30 CZK large). The **authoritative** number is
whatever ISDS reports; we never present the estimate as final and we confirm against the live credit
balance before sending.

**Rationale**: The user reported tiered pricing (10/30 CZK by size). We can't compute the exact
tariff offline and it can change, so we estimate + label it approximate and confirm — satisfying
FR-001/FR-004 without lying about precision.

**Alternatives considered**: Hard-coding exact prices — rejected (tariff drifts; misleading).
Showing no estimate — rejected (the whole point is "no surprise spend").

**Open for the build**: pull the current tariff tiers from the operator price list; keep them in one
config constant so a tariff change is a one-line edit.

## 6. Recipient lookup (`FindDataBox2`)

**Decision**: Debounced, cancellable search by name / box ID / IČO, returning a result list the user
picks from; show each hit's name, address, `dbType`, and a **free/paid badge**. Handle zero results,
many results (paginate / "refine your search"), and exact box-ID entry (skip search).

**Rationale**: `FindDataBox2` is the supported lookup (`db_search.wsdl`, already tagged "feature 005
recipient lookup"). Showing the free/paid badge in the result list makes the cost obvious before the
user even composes (Principle V).

**Alternatives considered**: Free-text recipient entry without resolution — rejected (can't classify
cost or validate the box exists).

## 7. Off-main-thread attachment encoding (Principle I — top risk)

**Decision**: Read and **base64-encode attachments off the JS thread**. Preferred: a small **native
module / TurboModule** that reads the file and returns base64 (or streams it), so a multi-MB
attachment never blocks the bridge. Interim fallback if a module slips: **chunked encoding** yielding
to the event loop between chunks, with a hard size cap and cancellable progress.

**Rationale**: Encoding a large file to base64 on the JS thread is the classic RN UI-freeze and is
*exactly* the incumbent's most-hated behaviour. Principle I is NON-NEGOTIABLE, so the encode path
must be off-main-thread by design, not as an afterthought.

**Alternatives considered**: Synchronous `readAsStringAsync(base64)` on the JS thread — rejected
(violates Principle I for large files). Uploading raw multipart instead of base64-in-SOAP — rejected
(ISDS `dmEncodedContent` expects base64 in the SOAP body).

**As built (2026-09-14, tasks T006):** neither a custom module nor JS-side chunking. The native
`readStream` of `react-native-blob-util` reads and base64-encodes on its own background queue, one
1.5 MiB buffer per event (a multiple of 3 bytes, because each buffer is encoded separately and only
then do the chunks join into valid base64). The hard cap is `VODZ_MAX_BYTES` on the whole message,
applied before a byte is read. Progress is real (bytes per chunk), and cancel releases the partial read
at once. The one thing cancel cannot do is stop the native loop: it finishes the current file in the
background and its chunks are ignored - and on iOS, where the library runs every stream on one serial
queue, a pick started right after a cancel begins reading only once that file is done. What the read
produces is still one base64 string in memory, bounded by the cap.

## 8. Document picker

**Decision**: Use **`@react-native-documents/picker`** (the maintained successor) to select
attachments; if integration friction appears, fall back to `react-native-document-picker`. Validate
file count, per-file and total size up front.

**Rationale**: Need native file selection; the maintained package targets RN New Architecture.

**Alternatives considered**: Building a custom picker — rejected (reinventing platform UI).

## 9. Idempotency / no double-charge (Principle II)

**Decision**: Generate a client-side **send token** per draft; the `sending` state records it before
the `CreateMessage` call and clears it only on a confirmed result. A retry after an ambiguous
network failure first **checks sent state** (and, if needed, reconciles via the message list) so a
paid PDZ can never be charged twice.

**Rationale**: A paid send that silently double-charges on retry would be the worst possible
Principle II failure. The guard makes retry safe.

**Alternatives considered**: Blind retry — rejected (double-charge risk).

## 10. Delivery / acceptance info after send

**Decision**: After a successful send, surface the returned message ID and a **single post-send
delivery/acceptance confirmation** (via the existing message-events path), then fold the sent message
into the archive (004). A richer delivery-event **timeline** stays deferred (see spec "Still deferred").
Scheduled as task T035.

**Rationale**: Closes the round-trip and reuses 002/004 infrastructure.

**Alternatives considered**: Fire-and-forget — rejected (users want confirmation; archive needs the
record).
