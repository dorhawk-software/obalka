# Phase 1 Data Model: Sending Messages

> **As built.** This was built as `SendController` (`src/features/messages/state/sendController.ts`), which
> returns a typed `SendOutcome` rather than being a `SendService` with `SendResult` / `SendError`. The SOAP
> builders and parsers live in `src/services/isds/soap.ts` — there is no `operations.ts`. Recipient lookup
> uses the fulltext `ISDSSearch3` rather than `FindDataBox2`, credit comes from `DataBoxCreditInfo`, and
> there is no `PDZInfo` call. There is no `sendToken` either: ISDS has no idempotency key, so a retry
> reconciles against `GetListOfSentMessages` (tasks T024). Drafts are one `drafts` table without
> attachments, which are re-added on resume. [`docs/sending.md`](../../docs/sending.md) maps the flow as built.

New persisted state for composing/sending. Sensitivity (Principle III): **no secrets here** — the box
secret stays in Keychain (001). Drafts + outgoing metadata go in **encrypted SQLite** (op-sqlite);
attachment bytes live as files in the app sandbox, referenced by the DB (storage rules, Principle IV).
Once a message is **sent and accepted**, it folds into the existing archive (004).

## Entity: Draft  *(SQLite `drafts`)*

| Field | Type | Notes |
|-------|------|-------|
| `id` | text (PK) | Local UUID. |
| `boxId` | text (FK→accounts) | Sender box. |
| `recipientBoxId` | text (nullable) | Resolved recipient box ID (from `FindDataBox2`); null until picked. |
| `recipientLabel` | text (nullable) | Resolved recipient display name/address (for the draft list). |
| `recipientDbType` | enum (nullable) | `OVM` \| `FO` \| `PFO` \| `PO` — drives free/paid. |
| `subject` | text | `dmAnnotation` (message subject). |
| `sendToken` | text (nullable) | Idempotency token set during `sending` (no double-charge). |
| `status` | enum | `draft` \| `estimating` \| `confirming` \| `sending` \| `sent` \| `failed`. |
| `lastError` | text (nullable) | Localized failure reason for the `failed` state (Principle II). |
| `createdAt` / `updatedAt` | int (epoch) | Audit. |

**Validation**: a send requires `recipientBoxId` resolved, `subject` non-empty, ≥0 attachments within
size limits, and (if paid) passing the PDZ-eligibility + credit check. `status` transitions are
one-way per the state machine below (except `failed → draft` on edit/retry).

**Relationships**: 1 Draft ↔ 0..N OutgoingAttachment; 1 Draft → 1 sender DataBoxAccount; 0..1 resolved Recipient.

## Entity: OutgoingAttachment  *(SQLite `draft_attachments` + sandbox file)*

| Field | Type | Notes |
|-------|------|-------|
| `id` | text (PK) | Local UUID. |
| `draftId` | text (FK→drafts) | Owning draft. |
| `fileName` | text | `dmFileDescr`. |
| `mimeType` | text | `dmMimeType`. |
| `sizeBytes` | int | Drives the `CreateMessage` vs `CreateBigMessage` choice + cost tier. |
| `localPath` | text | Sandbox path to the raw bytes (NOT base64; encoded off-thread at send time). |
| `isMainDoc` | bool | First/primary document flag (`dmFileMetaType = main`), rest are enclosures. |

**Validation**: total size ≤ ISDS limit (else route to `CreateBigMessage`); at least one attachment
OR allow a body-only message per ISDS rules; per-file size cap enforced at pick time. **As built
(2026-09-14, tasks T006):** the pick-time cap is on the whole message, not per file - a pick that would
take the attachments over `VODZ_MAX_BYTES` (100 MB) is refused before any bytes are read.

## Entity: Recipient  *(in-memory; from `FindDataBox2`, not persisted beyond the draft fields)*

| Field | Type | Notes |
|-------|------|-------|
| `boxId` | text | Recipient data-box ID. |
| `label` | text | Name + address for display. |
| `dbType` | enum | `OVM` \| `FO` \| `PFO` \| `PO`. |
| `acceptsPdz` | bool | Recipient accepts commercial (PDZ) messages — gates paid send (research §2). |

## Entity: CostEstimate  *(in-memory; computed, never trusted as final)*

| Field | Type | Notes |
|-------|------|-------|
| `paid` | bool | false for OVM (free DZ), true for private box (PDZ). |
| `tier` | enum | `none` \| `normal` \| `large` — from total attachment size (research §5). |
| `approxCzk` | int (nullable) | Approximate price from the tier table; **labelled approximate** in UI. |
| `bigMessage` | bool | true → route to `CreateBigMessage`. |

## Entity: CreditInfo  *(in-memory; from `DataBoxCreditInfo`)*

| Field | Type | Notes |
|-------|------|-------|
| `boxId` | text | Sender box. |
| `balanceCzk` | number | Current PDZ credit. |
| `pdzEnabled` | bool | Whether the box may send PDZ at all (research §2). |

**Use**: shown in the confirmation; a paid send is blocked (with link-out to top up) when
`!pdzEnabled` or `balanceCzk < approxCzk`.

## Entity: SentMessage  *(result; folds into the archive 004)*

| Field | Type | Notes |
|-------|------|-------|
| `messageId` | text | ISDS `dmID` from the `CreateMessage` response. |
| `acceptedAt` | int (epoch, nullable) | From delivery/acceptance info (research §10). |
| `chargedCzk` | int (nullable) | Actual charge if reported by ISDS (authoritative over the estimate). |

## State transitions (Draft.status) — Principle II

```text
draft ──estimate──▶ estimating ──ok──▶ confirming ──confirm──▶ sending ──accepted──▶ sent
  ▲                     │ error             │ cancel              │ error/timeout        │
  └──────edit───────────┴───────────────────┴─────────────────────┴──▶ failed ──retry──┘
```

- **No `confirming → sending` without explicit user confirmation** when `CostEstimate.paid` (the
  no-silent-spend invariant; enforced + unit-tested in `sendController`).
- `sending → failed` on timeout/network error preserves the `sendToken`; **retry reconciles sent
  state first** so a paid PDZ is never charged twice (research §9).
- `sent` makes the message eligible for the durable archive (004); it is never silently dropped (IV).
