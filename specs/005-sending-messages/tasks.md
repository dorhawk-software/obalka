# Tasks: Sending Messages

**Input**: Design documents from `/specs/005-sending-messages/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: INCLUDED. The constitution's Definition of Done (Principle II crash-resilience; localized
error+retry) and plan.md both require the **cost model** and the **send state machine** to be unit-
tested over the mock ISDS transport (`__tests__/helpers/fakeTransport.ts`). UI screens are smoke-tested.

**Organization**: By user story (derived from the feature scope, since spec.md is a cost-model stub):

- **US1 (P1)** — Send a **free** message to a public authority (OVM). The complete round-trip, MVP.
- **US2 (P2)** — Send a **paid (PDZ)** message to a private box, **safely** (cost shown, confirmed, no double-charge).
- **US3 (P3)** — **Large** messages (`CreateBigMessage`) + **drafts**.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US2 / US3 (story phases only)

---

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Add a document picker dependency (`@react-native-documents/picker`) to `package.json`; run pod install (iOS) / verify Android autolinking; smoke-build (per research §8)
- [x] T002 [P] Scaffold the compose structure: empty `src/features/messages/screens/{ComposeScreen,RecipientSearch,DraftList}.tsx` and `src/features/messages/state/{sendController,costModel}.ts` stubs per plan.md
- [x] T003 [P] Add i18n keys (cs primary + en) for compose / cost / send-errors in `src/i18n/strings.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

- [x] T004 Add `drafts`, `draft_attachments` tables (per data-model.md) as a new versioned migration in `src/services/db/migrations.ts` — **as built:** one `drafts` table; attachments are not persisted
- [x] T005 [P] Implement `src/services/db/draftsStore.ts` — CRUD for Draft + OutgoingAttachment over the new tables (encrypted SQLite, no secrets) — **as built:** Draft CRUD only (recipient, subject, body, later `recipientAddress`) over the single `drafts` table; there is no OutgoingAttachment store.
- [x] T006 [P] Implement off-main-thread attachment read + base64 encode in `src/services/files/` with size caps + cancellable progress (Principle I, research §7) — **as built (completed 2026-09-14):** `src/services/files/attachmentPicker.ts`, no custom TurboModule.
  - **Cap before reading.** `pickDocuments` refuses a pick that would take the MESSAGE over `VODZ_MAX_BYTES` (already-attached bytes + the picker's reported sizes, checked again on the cache copies' real sizes) before a byte is read, as a `tooLarge` outcome the compose screen puts into words (`send.attachments.tooLarge`).
  - **Chunked native read.** Each file streams in through `react-native-blob-util` `readStream(path, 'base64', READ_CHUNK_BYTES)` on the library's background queue. The native reader encodes every buffer on its own, so `READ_CHUNK_BYTES` (1.5 MiB) is a multiple of 3 and the chunks join into the file's own base64 (`src/services/files/base64Stream.ts`). A padded chunk mid-stream, or fewer bytes than the copy holds, fails the pick instead of attaching a corrupt document.
  - **Progress and cancel.** Real per-chunk progress and an `AbortSignal`. `ComposeScreen.tsx` shows the read in the add button's place at the same 46-tall footprint (theme `ProgressBar`, real sizes, a cancel control drawn like the attachment rows' remove control), holds Send until the read finishes, and aborts when compose is left. Cancel drops the partial read and the cache copies at once. `readStream` cannot stop its native loop, so the reader finishes the current file in the background and its chunks are ignored.
  - **Also changed.** A pick is all or nothing (a file whose copy failed used to be skipped silently), and compose writes sizes with the Czech decimal comma like the other screens. The send-time `tooLarge` block stays as the backstop: a typed body's PDF cannot be sized at pick time.
  - **Review fixes (2026-09-14).** (1) `keepLocalCopy` answers with a percent-encoded `file://` URI on both platforms, and the picker only stripped the scheme, so any file with a space or a diacritic in its name (most Czech names) was stat'ed under a path that names no file and the pick failed; it now decodes the URI (`localCopyPath`). (2) Matching the add button's dp metrics kept the slot still only at the default text size: from ~1.2x text the progress row's caption and bar made it a few dp taller. The progress row is now always laid out and sizes the slot, hidden while idle, with the add button drawn over it. (3) On iOS the library runs every stream on one serial queue, so after a cancel the next pick's read starts only once the abandoned file has been read to its end.
  - **Tests:** `__tests__/files/attachmentPicker.test.ts` (the cap, per-chunk progress, base64 joins across chunk boundaries, "reads a copy whose name has spaces and diacritics - the picker’s URI is percent-encoded", short reads, read errors, cancel mid-read and mid-copy), `__tests__/files/base64Stream.test.ts` ("streaming base64 encode (the attachment picker)"), `__tests__/messages/composeAttachments.test.tsx` (progress row, Send held, cancel, tooLarge copy, "keeps one footprint at every text size: the progress row sizes the slot while idle too (constitution V)", one pick at a time, abort on leave). Not yet walked on a device.
- [x] T007 [P] Add send types (`Recipient`/`dbType`, `CreditInfo`, `CostEstimate`, `SendResult`, `SendError`) to `src/services/isds/types.ts` (per contracts/send-service.md) — **as built:** `SendOutcome` / `SearchOutcome` in `sendController.ts`
- [X] T008 `SendController` (`src/features/messages/state/sendController.ts`) — realized as a typed-**outcome** controller (never-throws; `sent`/`needsConfirmation`/`blocked`/`reauth`/`error`) rather than an explicit state-machine skeleton; the no-silent-spend + no-double-charge gates live here.
- [X] T009 [P] `__tests__/helpers/fakeTransport.ts` extended with the real method set (`findRecipients`, `sendMessage`, `sendBigMessage`, `getCreditInfo`, `getSentMessages`) — supersedes the originally-named stubs (`FindDataBox2` → `ISDSSearch3`, etc.).

**Checkpoint**: Foundation ready — user stories can begin.

---

## Phase 3: User Story 1 - Free send to a public authority (OVM) (Priority: P1) 🎯 MVP

**Goal**: Compose, look up an OVM recipient, attach files, and send a **free** data message (DZ) — the full round-trip without the paid path.

**Independent Test**: On czebox, compose to an OVM recipient, attach a small file, send → no cost gate, `CreateMessage` returns a `dmID`, message appears in the archive; UI stays responsive while encoding.

### Tests for User Story 1 ⚠️ (write first, ensure they fail)

- [x] T010 [P] [US1] `costModel` test: OVM → free, tier `none`/`normal` in `__tests__/messages/costModel.test.ts`
- [x] T011 [P] [US1] `sendController` free-send happy path + crash-resilience (timeout/error → typed `failed`, retry) over `fakeTransport` in `__tests__/messages/sendController.free.test.ts` — **as built:** `__tests__/messages/sendController.test.ts`

### Implementation for User Story 1

- [x] T012 [P] [US1] `buildFindDataBox2` + `parseFindDataBox2` (returns `dbID`, label, `dbType`, `acceptsPdz`) in `src/services/isds/operations.ts` — **as built:** `buildISDSSearch3` / `parseISDSSearch3` in `src/services/isds/soap.ts`; the fulltext search replaced `FindDataBox2` (`docs/ux/sending-navigation-ux-plan.md`)
- [x] T013 [P] [US1] `buildCreateMessage` + `parseCreateMessage` (reads `dmID` via existing `readDmStatusCode`) in `src/services/isds/operations.ts` — **as built:** `src/services/isds/soap.ts`
- [x] T014 [US1] Implement pure `costModel.ts` classify: OVM → free, size → tier (`src/features/messages/state/costModel.ts`)
- [x] T015 [US1] Implement the `sendController` free path: resolve → classify(free) → encode off-thread → `CreateMessage` → `SendResult` (`src/features/messages/state/sendController.ts`)
- [x] T016 [P] [US1] `RecipientSearch.tsx` — debounced/cancellable `FindDataBox2`, results with name/address/`dbType` + free/paid badge (`src/features/messages/screens/RecipientSearch.tsx`) — **as built:** inline in `ComposeScreen.tsx` (`RecipientRow`)
- [x] T017 [US1] `ComposeScreen.tsx` — recipient, subject, attachment list (picker), send button; uses `KeyboardAwareScrollView` (`src/features/messages/screens/ComposeScreen.tsx`)
- [x] T018 [US1] **Done 2026-09-13.** The fold shipped with T015 (`recordSentMessage` writes both the
  envelope and an offline detail carrying the files we already hold). The half that was missing was any
  way to GET there: the success screen said "Zpráva odeslána" and offered only "Hotovo", so reaching the
  message meant leaving, switching to Odeslané and finding it. It now offers "Zobrazit zprávu v archivu"
  — chromeless blue, because the ui-guide keeps the dark fill for the one primary action and after a
  send that action is "done".
  The route **replaces** compose rather than pushing on top of it: a send is over, and leaving a spent
  compose screen underneath makes the back gesture land on "Zpráva odeslána" instead of the list the
  reader started from. `persistOnExit` already returns null once a message has gone out, so the
  `beforeRemove` draft save this fires has nothing to save.
  The behaviour worth the test is the WAIT. `recordSentMessage` is started, not awaited, when the send
  returns — awaiting it would hold the success screen behind a write nobody is waiting for — so the
  button joins that promise before navigating. Without it, a fast finger on a slow phone opens a detail
  screen for a message the archive does not have yet: empty, arrived at by doing everything right, and
  impossible to reproduce on a developer's machine. `sentOpensArchive.test.tsx` holds the write open and
  proves the navigation waits; both that and the double-tap guard were mutation-tested.
  **Not walked on a device.** It needs a real send, so it rides along with T031: a person at a
  signed-in czebox box must run it.
- [x] T019 [US1] Localized error + retry states for the free flow (Principle II) in ComposeScreen + strings

**Checkpoint**: Free send works end-to-end on czebox; US1 is a demoable MVP.

---

## Phase 4: User Story 2 - Paid (PDZ) send to a private box, safely (Priority: P2)

**Goal**: Send to a private recipient as a **paid PDZ** with cost shown, **explicit confirmation**, credit display, clear blocks, and **no double-charge**.

**Independent Test**: On czebox, compose to a private recipient → CZK cost + credit shown, send requires confirmation; insufficient credit / PDZ-disabled / recipient-rejects-PDZ each block with a clear reason + portal link-out; a simulated mid-send failure + retry never double-charges.

### Tests for User Story 2 ⚠️

- [x] T020 [P] [US2] `costModel` test: private box → paid, size tiers (normal/large) in `__tests__/messages/costModel.test.ts` (`acceptsPdz` eligibility gating lives in the controller, T021)
- [x] T021 [P] [US2] `sendController` **no-silent-spend** (paid requires `confirmedPaid`) and **no-double-charge** (retry reconciles against the sent list) over `fakeTransport` — implemented inline in `__tests__/messages/sendController.test.ts`

### Implementation for User Story 2

- [x] T022 [P] [US2] `buildDataBoxCreditInfo` / `buildPDZInfo` + parsers (balance, `pdzEnabled`) in `src/services/isds/operations.ts` — **as built:** `buildDataBoxCreditInfo` / `parseDataBoxCreditInfo` in `soap.ts`; no `PDZInfo` call
- [x] T023 [US2] Extend `costModel.ts`: private → paid + size-tier price table as a single config constant (research §5) in `src/features/messages/state/costModel.ts`
- [x] T024 [US2] Extend `sendController`: estimate + eligibility, `needsConfirmation` gate, retry reconcile (`src/features/messages/state/sendController.ts`). NOTE: ISDS exposes **no client idempotency key**, so "no double charge" is done by **reconciling against `GetListOfSentMessages`** (match recipient box + subject within a 15-min window) before re-sending after an _ambiguous_ timeout — not by a `sendToken`.
- [x] T025 [US2] Cost + credit confirmation UI in `ComposeScreen.tsx` — CZK, **"přibližně"** label, live balance, confirm action
- [x] T026 [US2] Block states + portal link-out (insufficient credit / PDZ disabled / recipient rejects PDZ) in ComposeScreen + strings

**Checkpoint**: Both free (US1) and safe-paid (US2) sends work independently.

---

## Phase 5: User Story 3 - Large messages + drafts (Priority: P3)

**Goal**: Route oversize messages to `CreateBigMessage`, and let users save/resume drafts.

**Independent Test**: Attach a file over the ordinary limit → routes to `CreateBigMessage` (no opaque size error); start a message, leave, reopen from the draft list, finish sending.

### Tests for User Story 3 ⚠️

- [x] T027 [P] [US3] `sendController` size-threshold routing tests (≤20 MB → `CreateMessage`; 20–100 MB → VoDZ; >100 MB → `blocked: tooLarge`) over `fakeTransport`, in `__tests__/messages/sendController.test.ts` + `costModel.test.ts` + transport upload→create tests in `isdsTransport.test.ts`

### Implementation for User Story 3

> **RE-SCOPED after the spike (2026-06-15), then IMPLEMENTED.** `CreateBigMessage` is **not** a sibling
> op on `/DS/dz` — VoDZ is a **separate `ws2` service** (`/DS/vodz`, WSDL 3.04). The spike's "client
> double-hashes the file" assumption was wrong: the vendored `UploadAttachment` XSD shows the **server
> returns the two hashes**, so the send is just `UploadAttachment` (per file) → `CreateBigMessage`.
> Full protocol: **[contracts/isds-bigmessage.md](contracts/isds-bigmessage.md)**. B0 closed 2026-06-16
> (see the contract): `/DS/vodz` confirmed and a 25 MB free VoDZ send succeeded. Not yet exercised: a
> paid VoDZ send, and streaming the upload from `localPath` instead of holding base64 in memory (the
> `localPath` comment in `pickDocuments`, `src/services/files/attachmentPicker.ts`: since T006 the read
> is chunked, but it still ends as one base64 string).

- [x] T028 [P] [US3] VoDZ SOAP builders/parsers in `src/services/isds/soap.ts` — `buildUploadAttachment`/`parseUploadAttachment` (server id+hashes) + `buildCreateBigMessage`/`parseCreateBigMessage`; `vdzWsUrl` endpoint; `IsdsHttpTransport.sendBigMessage` orchestration. (No `AuthenticateBigMessage` — verify op, not send.)
- [x] T029 [US3] Size routing in `sendController` (≤20 MB `CreateMessage`; 20–100 MB `sendBigMessage`; >100 MB `blocked: tooLarge`), preserving the paid/no-silent-spend/no-double-charge gates
- [x] T030 [US3] Draft save/resume + `DraftList.tsx` over `draftsStore` (`src/features/messages/screens/DraftList.tsx`) — **as built:** the drafts list is part of `ComposeScreen.tsx`

**Checkpoint**: All stories independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T031 [P] Run `quickstart.md` acceptance on czebox (two boxes: free + paid + large), confirm UI
  never freezes while encoding a large attachment (Principle I). **Needs a person at a signed-in
  czebox box to run it.** The free and large sends need nothing more; the paid send needs PDZ credit,
  which the test box `3ntmizt` does not have (010 T029). Now also covers T018's
  "Zobrazit zprávu v archivu": tap it on the success screen, confirm the detail opens with the
  attachments already there, and that back lands on the message list rather than on "Zpráva odeslána".
- [x] T032 [P] Localization pass (cs primary / en — all 45 `send.*` keys at parity), dark-mode tokens verified in both themes, a11y: cost preview grouped into one announcement; compose/confirm controls labelled (Principle V)
- [x] T033 Green gate: `eslint` (0 errors), `tsc --noEmit`, `jest` (185) all clean; keyboard-avoidance check added to `composeScreen.test.tsx` (asserts the form's `KeyboardAwareScrollView`)
- [X] T034 [P] Sending flow + cost model documented in `docs/sending.md` (maintainer map: cost model, flow, safety invariants, drafts, key files)
- [X] T035 [P] Single post-send **delivery/acceptance confirmation** in the send-result UI via `fetchSentStatus` (reads the sent list; "Dodáno"/"Doručeno") — richer timeline stays deferred

---

## Phase 7: Refinements (post-validation, from device testing 2026-06-16)

- [X] T036 [P] [FR-008] Shorten the recipient-search **placeholder** so it fits the input; keep the full description as the `accessibilityLabel` (`ComposeScreen.tsx` + `strings.ts`)
- [X] T037 [FR-007] App-level **Snackbar** (provider + host overlay above the navigator): `show({ message, action? })`, auto-dismiss, one action button (`src/app/Snackbar.tsx`, wired in `AppNavigator.tsx`)
- [X] T038 [FR-007] **Auto-save on exit**: `ComposeScreen` exposes `persistOnExit(): DraftRecord | null` (saves recipient/subject/body unless empty or already sent, returns the record); `ComposeRoute` fires it on navigation `beforeRemove` (covers back/swipe/hardware back). Remove the manual **"Uložit koncept"** button; delete the draft on successful send.
- [X] T039 [FR-007] **Snackbar flow**: on auto-save show "Koncept uložen" + **"Zahodit"** → on discard remove the draft + show "Koncept zahozen" + **"Vrátit zpět"** → on undo re-save the captured `DraftRecord`. Strings cs/en.
- [X] T040 [P] [FR-007] Tests: `draftsStore` body round-trip + Snackbar discard→undo test + `persistOnExit` empty test + `draftsBus` test. Green gate (209 tests).
- [X] T041 [FR-007] Live draft-count update on discard/undo via `draftsBus` (the list count was focus-only; mutators emit after the DB write, the list subscribes).
- [X] T042 [P] [FR-008] Recipient search **auto-runs while typing** — drop the Find button; debounce 400 ms after ≥2 chars; clearing the field resets results; Enter still searches immediately. Stable `runSearch(q)` + cancellable in-flight (`ComposeScreen.tsx`).

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → no deps.
- **Foundational (Phase 2)** → after Setup; **blocks all stories**. (T004 before T005; T008 before all story `sendController` work.)
- **US1 (Phase 3)** → after Foundational. MVP. No dependency on US2/US3.
- **US2 (Phase 4)** → after Foundational; reuses US1's `sendController`/`ComposeScreen`/`costModel` but is independently testable (paid path).
- **US3 (Phase 5)** → after Foundational; extends `sendController` routing + adds drafts UI; independently testable.
- **Polish (Phase 6)** → after the desired stories.

### Within a story

Tests (fail first) → ISDS operation builders/parsers → pure `costModel` → `sendController` wiring → screens → error/retry polish.

---

## Parallel Opportunities

- Setup: T002, T003 in parallel.
- Foundational: T005, T006, T007, T009 in parallel (T004 first; T008 after T007).
- US1: T010/T011 (tests) parallel; T012/T013 (operations) parallel; T016 parallel with controller work.
- US2: T020/T021 parallel; T022 parallel with T023.

```text
# US1 operations in parallel:
Task: "buildFindDataBox2 + parse in src/services/isds/operations.ts"   # T012
Task: "buildCreateMessage + parse in src/services/isds/operations.ts"  # T013   (coordinate: same file → sequence if needed)
```

---

## Implementation Strategy

### MVP first (US1 only)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1 → **STOP & validate free send on czebox** → demo.

### Incremental delivery

US1 (free, MVP) → US2 (safe paid) → US3 (large + drafts). Each is an independent, testable increment that doesn't break the previous.

---

## Notes

- `[P]` = different files, no incomplete-task dependency. T012/T013/T022/T028 all touch
  `soap.ts` (planned as `operations.ts`) — parallelize their _design_ but **serialize edits to that file** to avoid conflicts.
- The **no-silent-spend** (T021/T024) and **off-main-thread encode** (T006) tasks are the two that
  most directly carry the constitution (II and I) — do not cut them.
- Commit after each task or logical group; keep `lint`/`tsc`/`test` green per the DoD.
- Develop against **czebox** only; never trigger a real paid send from dev (Principle VII).

---

## Amendment 2026-09-23 — a double tap sent twice (audit), in code and tests, not walked on a device

A read-only audit found actions a fast double tap fired twice. The screens guarded them with React
state (`busy`, `loading`, `opening`, PressScale's `busy`), which takes effect only after a re-render,
and a double tap delivers both presses before it. The shared fix is `src/app/useSingleFlight.ts`: a
guard checked and claimed synchronously in the tap, released when the run settles (with `release()`
for a run that can outlive what it waited for), never throwing on a refused call - tested in
`__tests__/app/useSingleFlight.test.tsx`. Every double-tap test below takes the handler out of ONE
render and calls it twice in the same tick (`__tests__/helpers/doubleTap.ts`), or calls the controller
twice without awaiting. Each double-tap test was run against the pre-fix source and failed there; the
tests beside them that check the guard lets go again - after a success, a failure or a stop - or holds
back nothing it should not, pass on either source by design.

ISDS has no idempotency key, so for sending a second press was a second official message, and for a
paid PDZ a second charge.

- **The send.** `ComposeScreen.doSend`, reached from "Odeslat" and from the paid-confirm button, runs
  under a single-flight guard claimed before `textToPdf` is awaited. `SendController.send` is
  single-flight per box and message - environment, box ID, recipient and subject, the identity the
  timeout reconcile (T024) already uses; not the documents, because a typed body renders to a fresh PDF
  on every press. A call made while that send runs joins it - the same promise and outcome - and never
  reaches the transport. A different message from the same box is not held: answering it with another
  message's outcome would report as sent something that never left (`vaultCallSites.test.ts` sends two
  at once). Free, paid and large-volume (VoDZ) alike. Tests:
  `__tests__/messages/sendController.test.ts` › "one send of a message per box at a time (double tap)"
  (one `sendMessage` for a free send and for a confirmed PDZ, one `sendBigMessage` for VoDZ, one for a
  body re-rendered to a different PDF; free again once it settles; another message or another box is
  not held), and `__tests__/messages/composeDoubleTap.test.tsx` ("sends ONE message…", "sends ONE paid
  message…").
- **Removing an attachment** removes the file the row drew, by identity, not the index: two taps on
  index 0 used to remove the first file and then the one that moved into its slot. Test:
  `composeDoubleTap.test.tsx` › "removes exactly the tapped attachment…".
- **"Zobrazit zprávu"** after a send navigates once (the `opening` state only dims it now). Test:
  `composeDoubleTap.test.tsx` › "opens the sent message once…"; `sentOpensArchive.test.tsx` still passes.
  It waits for the archive copy of the sent message, and a copy that failed to save used to leave the
  button dead for good (an unhandled rejection, awaited again on every tap); the failure is now reported
  to telemetry and the message opens anyway (review, same day). Test: "still opens the sent message when
  keeping its copy in the archive failed".
- **Device walk owed:** double-tap "Odeslat" and the paid-confirm button on a czebox box (free send; the
  paid one needs credit the test box lacks, 010 T029) and check the sent folder holds one message.
