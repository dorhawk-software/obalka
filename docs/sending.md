# Sending messages (feature 005)

How the app sends a data message **directly device → ISDS** (no backend), and the **cost model**
that makes it non-trivial. Spec/design live in `specs/005-sending-messages/`; this is the
maintainer's quick map.

## The cost model (the easy-to-miss part)

Sending is **sometimes free, sometimes paid**, decided by the **recipient's box type**:

| Recipient | Message type | Cost |
|---|---|---|
| **OVM** (public authority) | DZ (ordinary data message) | **Free** |
| **FO / PFO / PO** (private) | **PDZ** (Poštovní datová zpráva) | **Paid** from the sender box's credit |

- Price is **tiered by size** (observed ≈ 10 CZK normal / 30 CZK large) - `costModel.ts`
  (`PRICE_CZK`, `LARGE_TIER_THRESHOLD_BYTES`). Figures are **approximate**; the UI labels them
  "přibližně" and the **live credit** (`DataBoxCreditInfo`) is authoritative.
- **No-silent-spend (Principle II):** a paid send returns `needsConfirmation` (with the live credit)
  and only spends once the user explicitly confirms. Blocks (`recipientRejectsPdz` / `pdzDisabled` /
  `insufficientCredit`) each show a clear reason; `pdzDisabled` and `insufficientCredit` also offer a
  **Koupit kredit** link-out to the portal (`PORTAL_URL`; no in-app top-up).
- **Balance (feature 020):** the paid cost card shows the box's known balance ("Zbývá …") and cautions
  when it may not cover the price; an unknown balance shows nothing (`credit.ts`).
- An **OVM is free at any size** - `paid` is decided purely by `dbType`; size only chooses the
  transport track (below), never the price.

## The flow

1. **Recipient search** - fulltext **`ISDSSearch3`** (all box types, like the web portal), debounced
   as you type. Each hit shows the owner's name, the address as ISDS composed it (feature 015,
   `AddressLines`), type · box ID, a `Zdarma` / `Placená` badge, and a `Shodné jméno` tag when several
   results share a name. (`FindDataBox2` is unused - it requires a `dbType` and returns czebox
   `dbStatusCode 1101`.)
2. **Cost preview** - `costModel.classifyCost(dbType, files)` → free vs paid + tier, shown live.
3. **Documents** - pick files **or** type a message body, which is rendered to a **`Textová
   zpráva.pdf`** (OS PDF engine; FR-005). ISDS needs ≥1 document; a typed body satisfies it. Picking
   (`attachmentPicker.ts`, tasks T006, 2026-09-14):
   - **Cap first.** A pick that would take the message over `VODZ_MAX_BYTES` (100 MB, counting what is
     already attached) is refused before a byte is read - on the picker's sizes, then again on the
     cache copies' real sizes - and the screen says both sizes (`send.attachments.tooLarge`).
   - **Chunked native read.** Each file streams in through `react-native-blob-util`
     `readStream(path, 'base64', READ_CHUNK_BYTES)` on the library's background queue. The native reader
     encodes every buffer on its own, so the buffer is a multiple of 3 bytes and the chunks join into
     the file's own base64 (`base64Stream.ts`). A padded chunk in the middle, or fewer bytes than the
     file holds, fails the pick rather than attaching a corrupt document.
   - **Progress and cancel.** The add button gives way to a progress row with real sizes
     ("Načítání 1,5 MB z 3,0 MB") and a cancel control; Send waits until the read is done; leaving
     compose aborts. The progress row is always laid out and sizes the slot (hidden while idle, with
     the button drawn over it), so nothing moves at any system text size. Cancel gives the button back
     at once and removes the cache copies. `readStream` cannot stop its native loop, so the reader
     finishes the current file in the background and its chunks are dropped; on iOS, where every
     stream shares one serial queue, the next pick's read waits for that.
   - **File names.** The picker's copy comes back as a percent-encoded `file://` URI, which is decoded
     to a path before it is read - a file named "Smlouva o dílo.pdf" is otherwise not found.
   - **All or nothing.** A file that cannot be copied or read fails the whole pick
     (`send.error.attach`) instead of being skipped silently.
4. **Send** - routed by total attachment size:
   - `≤ 20 MB` → **`CreateMessage`** (`/DS/dz`).
   - `20–100 MB` → **VoDZ**: `UploadAttachment` (per file; the server returns the hashes) →
     `CreateBigMessage` on the separate `ws2` service at `/DS/vodz` (`vdzWsUrl` in `endpoints.ts`).
     Validated on the test environment on 2026-06-16 with a 25 MB free send; a paid VoDZ send has not
     been exercised. See `contracts/isds-bigmessage.md`.
   - `> 100 MB` → blocked (`tooLarge`) - ISDS's hard ceiling. Normally refused already at pick time;
     this is the backstop, e.g. when the typed body's PDF (which cannot be sized at pick time) tips a
     full message over.
5. **Confirmation** - show the new `dmID` + a single **delivery/acceptance** line read back from the
   sent list (`fetchSentStatus`): "Dodáno do schránky příjemce" / "Doručeno". A richer timeline is
   deferred.

## Safety invariants

- **No silent spend** - see above.
- **No double charge** - ISDS has no client idempotency key, so a send that **times out** is flagged
  `ambiguous`; a retry **reconciles** against `GetListOfSentMessages` (match recipient box + subject
  within 15 min) before re-sending. `ComposeScreen` arms this until a confirmed send.
- **Never blocks the UI** - recipient lookup, encode, and send run off the JS thread with cancellable
  in-flight refs; an attachment read is capped before it starts, arrives in chunks and can be
  cancelled; the controller and the picker never throw (typed outcomes only).

## Drafts

Auto-saved on **every exit** (back / swipe / hardware back) - no manual button. An undoable snackbar
("Koncept uložen" → Zahodit → Vrátit zpět) handles discard. Recipient (with its address) + subject +
**body** persist (`drafts` table: created in migration v6, `body` added in v7, `recipientAddress` in
v12); attachments are re-added on resume. The message list shows a
"Rozepsané koncepty (N)" entry; the count updates live via `draftsBus`.

## Key files

| Concern | File |
|---|---|
| Orchestration (search / estimate / send / reconcile / sent-status) | `src/features/messages/state/sendController.ts` |
| Cost classification + thresholds | `src/features/messages/state/costModel.ts` |
| SOAP build/parse (`ISDSSearch3`, `CreateMessage`, `UploadAttachment`/`CreateBigMessage`, `DataBoxCreditInfo`, sent list) | `src/services/isds/soap.ts` |
| HTTP transport (endpoints, auth split, VoDZ orchestration) | `src/services/isds/isdsTransport.ts`, `endpoints.ts` |
| Compose UI (search, cost, attachments, text→PDF, send, drafts) | `src/features/messages/screens/ComposeScreen.tsx` |
| Recipient address split + same-name detection (015) | `src/features/messages/state/addressParts.ts` |
| Address rendering: result row, picked recipient, detail (015) | `src/features/messages/screens/AddressLines.tsx` |
| PDZ credit display rule - unknown ≠ zero (020) | `src/features/messages/state/credit.ts` |
| Attachment pick: cap, chunked base64 read, progress + cancel (T006) | `src/services/files/attachmentPicker.ts`, `src/services/files/base64Stream.ts` |
| Text → PDF | `src/services/files/textToPdf.ts` |
| Drafts store + change bus | `src/services/db/draftsStore.ts`, `src/features/messages/state/draftsBus.ts` |
| VoDZ protocol contract | `specs/005-sending-messages/contracts/isds-bigmessage.md` |
