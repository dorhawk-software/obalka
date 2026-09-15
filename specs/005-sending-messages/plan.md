# Implementation Plan: Sending Messages

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
> T006, completed 2026-09-14).
> [`docs/sending.md`](../../docs/sending.md) maps the flow as built.

**Branch**: `005-sending-messages` | **Date**: 2026-06-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-sending-messages/spec.md`

## Summary

Let a signed-in box **compose and send** a data message: resolve a recipient by name/ID, attach
files, and submit — while being honest about money. Sending to a **public authority (OVM)** is a
**free** data message (DZ); sending to a **private box (FO/PFO/PO)** is a **paid Poštovní datová
zpráva (PDZ)** charged to the sender's box credit (~10–30 CZK, tiered by size). The flow therefore
**classifies free-vs-paid from the resolved recipient, shows the box's PDZ credit, and requires
explicit confirmation before any paid send — never silently spending credit**. Technical approach:
extend the existing on-device ISDS SOAP client (`src/services/isds`) with the vendored operations
`FindDataBox2` (lookup), `DataBoxCreditInfo`/`PDZInfo` (credit + PDZ eligibility), and
`CreateMessage`/`CreateBigMessage` (send), following the established `buildXxx`/`parseXxx` envelope
pattern; a new `compose` UI under `src/features/messages`; a typed `SendService` (state machine,
crash-resilient, no-silent-spend invariant); and **off-main-thread** attachment encoding so large
uploads never freeze the UI. Credit top-up is **not** in the ISDS API → the app **links out** to the
portal. All development targets **czebox**.

## Technical Context

**Language/Version**: TypeScript 5.x (strict) on React Native 0.86 (CLI, New Architecture).
**Primary Dependencies**: existing `src/services/isds` (soap.ts envelope build/parse via
`fast-xml-parser`, `isdsTransport`, `endpoints`), `op-sqlite` (drafts + outgoing store, encrypted),
`react-native-keychain` (box session/secret reuse from 001), and a **document picker** for choosing
attachments — **`@react-native-documents/picker`** (research §8). Base64 attachment encoding runs
**off the JS thread** via a small **native module/TurboModule** (chunked fallback) — research §7.
**Storage**: New `drafts` + `draft_attachments` tables (op-sqlite, encrypted) for in-progress +
sent-pending messages and their attachment references (files in the app sandbox, per Principle IV/storage rules);
no secrets. Sent messages fold into the existing archive (004) once accepted.
**Testing**: Jest + RN Testing Library (compose screen, cost classifier, SendService state machine
over a mockable ISDS transport — extend `__tests__/helpers/fakeTransport.ts`); manual acceptance
against **czebox** test boxes.
**Target Platform**: iOS 15.1+ and Android 7.0+ (API 24+). Android Gradle requires JDK 17; iOS builds on
the macOS CI runner (not the Linux dev host).
**Project Type**: Mobile app (single React Native codebase, bare CLI).
**Performance Goals**: UI never stalls >100 ms while encoding/uploading attachments (Principle I);
recipient lookup feels instant (debounced, cancellable); cost shown before the user can tap "send".
**Constraints**: No backend (direct device→ISDS over TLS). **Never spend credit without explicit
confirmation.** No hard crash on any send outcome (Principle II). czebox-only during development.
**Scale/Scope**: ≈ 4–6 screens/flows (compose, recipient search/picker, attachment list, cost +
credit confirmation, send progress/result, draft list). Typical message: 1–5 attachments, ≤ the
ISDS size limit; large messages route to `CreateBigMessage`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How this feature complies |
|-----------|---------------------------|
| I. Never block the UI thread | Recipient lookup, credit fetch, and send run off the JS thread (native `fetch`); **attachment base64 encoding is moved off-main-thread** (native module or chunked/streamed) — the single biggest risk here, called out in research. Upload shows cancellable, non-blocking progress. |
| II. Crash-resilient by contract | Send modeled as an explicit state machine (`draft → estimating → confirming → sending → sent \| failed`) with timeouts, typed errors, and retry at every step — especially the final `CreateMessage` submit. Partial/duplicate-send protection via an idempotency guard so a retry can't double-charge. |
| III. Privacy first, on-device only | No backend; message + attachments go only to ISDS. Box secret reused from Keychain (001). Credit/PDZ info fetched live, not cached server-side. |
| IV. Local archive sacred | Drafts and sent messages persist locally; a sent+accepted message enters the durable archive (004) and is never silently lost. Deleting a draft requires explicit intent. |
| V. Modern, accessible, Czech-first | All compose/cost/error strings localized (cs primary); cost shown in CZK; free vs paid made visually obvious; Dynamic Type + screen-reader labels; works in dark mode. |
| VI. Honest scope | We only expose what ISDS supports: send DZ/PDZ via `CreateMessage`/`CreateBigMessage`. **No in-app credit purchase** (not in the API; would also hit app-store digital-goods rules) — we link out to the portal and say so. |
| VII. Verify against test env | All flows exercised against czebox; production send gated behind the existing host switch. Real paid sends are never triggered from dev (czebox does not charge real money). |

**Result**: PASS. The off-main-thread attachment-encoding requirement (Principle I) is a design
constraint, not a violation — tracked as the top research item. Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/005-sending-messages/
├── plan.md              # This file
├── research.md          # Phase 0 output (cost model, PDZ eligibility, attachment encoding, picker)
├── data-model.md        # Phase 1 output (Draft, Recipient, OutgoingAttachment, CostEstimate, …)
├── quickstart.md        # Phase 1 output (czebox two-box send, manual acceptance)
├── contracts/           # Phase 1 output
│   ├── isds-send.md     #   ISDS operations: FindDataBox2, DataBoxCreditInfo/PDZInfo, Create(Big)Message
│   └── send-service.md  #   internal SendService contract + no-silent-spend invariant
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── features/
│   └── messages/
│       ├── screens/
│       │   ├── ComposeScreen.tsx        # recipient + subject + attachments + cost/credit + send
│       │   ├── RecipientSearch.tsx      # FindDataBox2 lookup (debounced, cancellable)
│       │   └── DraftList.tsx            # saved drafts
│       └── state/
│           ├── sendController.ts        # send state machine (Principle II), no-silent-spend
│           └── costModel.ts             # free(OVM) vs paid(PDZ) classification + size tiering
├── services/
│   ├── isds/
│   │   ├── operations.ts                # + buildFindDataBox2 / buildCreateMessage /
│   │   │                                #   buildCreateBigMessage / buildDataBoxCreditInfo /
│   │   │                                #   buildPDZInfo  (+ matching parseXxx)
│   │   └── types.ts                     # + Recipient/dbType, CreditInfo, SendResult types
│   ├── files/                           # attachment read + OFF-THREAD base64 encode (Principle I)
│   └── db/
│       ├── migrations.ts                # + drafts + draft_attachments table migration
│       └── draftsStore.ts               # drafts + outgoing message persistence
└── i18n/                                # cs (primary), en — compose/cost/error strings

__tests__/
├── messages/sendController.test.ts      # state machine over fakeTransport (incl. no double-charge)
├── messages/costModel.test.ts           # OVM→free / private→paid + size tiers
└── helpers/fakeTransport.ts             # extended with send operations
```

**Structure Decision**: Sending lives inside the existing **`src/features/messages`** feature (it
shares the message domain, archive, and the ISDS client) rather than a new top-level feature dir,
matching how 002/003/004 were organized. The ISDS operations extend the shared
`src/services/isds/operations.ts` (`buildXxx`/`parseXxx` pattern); the cost classifier and send
state machine are isolated in `state/` for unit-testing over the mock transport.

## Complexity Tracking

> No constitution violations — section intentionally empty. (The off-main-thread attachment
> encoding is a required design approach under Principle I, documented in research.md, not added
> complexity to justify.)
