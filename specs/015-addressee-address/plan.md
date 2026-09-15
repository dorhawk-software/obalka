# Implementation Plan: Addressee address — who exactly am I writing to?

**Branch**: `015-addressee-address` | **Date**: 2026-08-17 | **Spec**: [spec.md](./spec.md)
**Design**: returned 2026-08-17 — recorded in [design-prompts.md](./design-prompts.md) § *What came back*

## Summary

Show the addressee's address wherever a person or organisation is identified: the recipient search
results, the picked recipient on compose, and the message detail's counterparty. The data is already
fetched and already stored — **no new ISDS call, no new permission, no new table**. The work is a model
split, a presentation split, and three screens.

## Technical Context

**Language/Version**: TypeScript (strict), React Native 0.86, New Architecture, Hermes
**Primary Dependencies**: none new
**Storage**: one additive column, `drafts.recipientAddress` (v12); `messages.senderAddress` /
`messages.recipientAddress` already exist
**Testing**: Jest + `@testing-library/react-native`
**Target Platform**: Android + iOS
**Project Type**: mobile (single app)
**Performance Goals**: no measurable change; the address split is O(1) per row, done at render
**Constraints**: no layout jump; holds at 1.5× font scale; light + dark; WCAG AA; cs + en
**Scale/Scope**: 3 screens, 1 domain type, 2 pure functions, 1 shared component

### What the data actually is (settled during specify — do not re-derive)

- `ISDSSearch3` returns the address as **one pre-composed string** (`dbAddress`), e.g.
  `Nová 1/777, 60200 Brno, CZ`. Observed shapes: 2 or 3 comma-separated parts.
- The **structured** fields (`adStreet`, `adNumberInStreet`, `adZipCode`, `adCity`, `adState`) exist in
  ISDS but on `FindDataBox2` / `tDbOwnerInfo`, which this app deliberately does not use — it requires a
  `dbType` and misbehaves on czebox (`dbStatusCode 1101`; see the comment in `soap.ts`).
- Messages carry `dmSenderAddress` / `dmRecipientAddress`, parsed for both list envelopes and
  downloaded messages, stored, and rendered nowhere.

**Therefore**: "structured" means splitting on the commas ISDS itself supplied. That is presentation.
Re-ordering, relabelling, expanding or inferring is forbidden (FR-003).

## Constitution Check

| Principle | Status |
|---|---|
| I — Never block the UI thread | ✅ pure string work at render; nothing async added |
| II — Crash-resilient by contract | ✅ the split is total: any string that does not match the shape falls back to showing the whole of it; null/empty → the no-address state |
| III — Privacy first, on-device | ✅ no new network call; the register address is already fetched, and displaying it does not transmit it. FR-012 keeps it out of notifications |
| IV — The local archive is sacred | ✅ the archive is read-only here; one additive drafts migration (v12) |
| V — Modern, accessible, Czech-first UX | ✅ metrics from the design; cs + en; 1.5× and dark verified on device |
| VI — Honest scope | ⚠️ the live one. The app must not restate an official register entry in its own words — hence the comma-split-only rule, and FR-004's amendment (a statement about the *record*, never about the *person*) |
| VII — Verify against the test environment | ✅ czebox `3ntmizt` is added and the `Novak` search there is the exact reproduction case |

No violations. No complexity tracking needed.

## Project Structure

### Documentation (this feature)

```
specs/015-addressee-address/
├── spec.md
├── plan.md              # this file
├── tasks.md
├── (quickstart.md)      # planned, not written: the device pass is recorded in tasks.md T014–T015
├── design-prompts.md    # the commission + what came back
└── checklists/requirements.md
```

### Source code (touched)

```
src/
├── services/isds/
│   ├── types.ts                       # Recipient: label → name + address
│   └── soap.ts                        # toRecipientFromSearch stops concatenating
├── features/messages/
│   ├── state/addressParts.ts          # NEW — the pure split + same-name detection
│   └── screens/
│       ├── AddressLines.tsx           # NEW — the three address states, shared by all three
│       │                              #   places (result row, picked recipient, detail)
│       ├── ComposeScreen.tsx          # result row, picked recipient
│       └── MessageDetail.tsx          # counterparty block
└── i18n/strings.ts                    # recipient.noAddress, recipient.sameName,
                                       #   recipient.found, recipient.sameNameHint
__tests__/messages/addressParts.test.ts    # NEW
__tests__/messages/recipientRow.test.tsx   # NEW — render assertions
```

## Phase 1 — design decisions carried into code

### The split (contract)

```ts
type AddressParts =
  | { kind: 'parts'; line1: string; line2: string }   // street ; post code + town [+ country]
  | { kind: 'whole'; text: string }                   // shape not recognised — show all of it
  | { kind: 'none' };                                 // ISDS gave nothing
```

Rules, in order:
1. Trim. Empty or whitespace → `none`.
2. Split on `,`. Fewer than 2 non-empty parts → `whole`.
3. `line1` = the first part. `line2` = everything after it, re-joined with `, ` **in its original
   order** — so a country code stays where ISDS put it and nothing is dropped.
4. Never re-order, never relabel, never expand.

`line2` carries the visual weight (FR-002a) because it holds the town.

### Same-name detection

Computed over the current result set only: a result is `sameName` when another result in the same
list has an identical owner name (trimmed, case-insensitive). Nothing is fetched and nothing is
asserted about the person — it is a fact about the search results (FR-004a).

## Complexity Tracking

Nothing to justify.
