# Contract: SendService (internal)

> **As built.** This was built as `SendController` (`src/features/messages/state/sendController.ts`), which
> returns a typed `SendOutcome` rather than being a `SendService` with `SendResult` / `SendError`. The SOAP
> builders and parsers live in `src/services/isds/soap.ts` — there is no `operations.ts`. Recipient lookup
> uses the fulltext `ISDSSearch3` rather than `FindDataBox2`, credit comes from `DataBoxCreditInfo`, and
> there is no `PDZInfo` call. There is no `sendToken` either: ISDS has no idempotency key, so a retry
> reconciles against `GetListOfSentMessages` (tasks T024). Drafts are one `drafts` table without
> attachments, which are re-added on resume. [`docs/sending.md`](../../../docs/sending.md) maps the flow as built.

The typed boundary the compose UI talks to. Lives in `src/features/messages/state/sendController.ts`
(+ pure `costModel.ts`). Dependency-injected over the ISDS transport so it is unit-testable against
`__tests__/helpers/fakeTransport.ts` with no network. Honors Principle I (no UI-thread blocking) and
Principle II (crash-resilient, no silent spend, no double-charge).

## Types (sketch)

```ts
type RecipientHit = { boxId: string; label: string; dbType: 'OVM' | 'FO' | 'PFO' | 'PO'; acceptsPdz: boolean };
type CostEstimate = { paid: boolean; tier: 'none' | 'normal' | 'large'; approxCzk: number | null; bigMessage: boolean };
type CreditInfo = { boxId: string; balanceCzk: number; pdzEnabled: boolean };

type SendBlocked =
  | { kind: 'recipientRejectsPdz' }
  | { kind: 'pdzDisabled' }
  | { kind: 'insufficientCredit'; balanceCzk: number; approxCzk: number | null }
  | { kind: 'oversize' };               // handled by routing to CreateBigMessage, surfaced if still over

type SendResult =
  | { kind: 'sent'; messageId: string }
  | { kind: 'needsConfirmation'; estimate: CostEstimate; credit: CreditInfo }   // paid → MUST confirm
  | { kind: 'blocked'; reason: SendBlocked }
  | { kind: 'failed'; error: SendError };  // typed, localized, retryable
```

## Operations

| Method | Purpose | Notes |
|--------|---------|-------|
| `searchRecipients(query)` | `FindDataBox2` lookup | debounced + cancellable; returns `RecipientHit[]`. |
| `classifyCost(recipient, attachments)` | pure free/paid + tier + big-message | no network; the unit-test core (`costModel.ts`). |
| `getCredit(boxId)` | `DataBoxCreditInfo`/`PDZInfo` | returns `CreditInfo`. |
| `prepareSend(draft)` | estimate + eligibility | returns `needsConfirmation` (paid) \| `blocked` \| ready. |
| `send(draft, { confirmedPaid })` | encode off-thread + `Create(Big)Message` | **throws/returns `needsConfirmation` if paid and `confirmedPaid !== true`** — the no-silent-spend gate. |
| `retry(draft)` | safe resend | reconciles sent state via `sendToken` first (no double-charge). |

## Invariants (enforced + tested)

1. **No silent spend**: `send()` cannot issue a paid `CreateMessage` unless the caller passed
   `confirmedPaid: true` for the *same* estimate the user saw. A free (OVM) send needs no confirmation.
2. **No double-charge**: a `sending`→`failed` (timeout/ambiguous) `retry` checks the `sendToken` /
   sent state before re-issuing; a paid PDZ is charged at most once.
3. **No UI-thread block**: attachment base64 encoding happens off the JS thread; `send()` reports
   cancellable progress.
4. **No hard crash**: every outcome is a typed `SendResult`/`SendError` with a localized message and a
   retry path; nothing throws unhandled (Principle II).
5. **Honest cost**: `approxCzk` is always presented as approximate; the live `CreditInfo` and any
   ISDS-reported actual charge are authoritative.
