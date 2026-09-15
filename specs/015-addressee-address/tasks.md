# Tasks: Addressee address

**Feature**: `015-addressee-address` | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

## Format: `[ID] [P?] [Story] Description`

- **[P]** — parallelizable (different file, no dependency on an incomplete task)
- **[US1]/[US2]/[US3]** — the user story the task serves

Tests are included: the split is a pure function and the rows are render-assertable, so both are
cheap and both guard requirements that are easy to regress into.

---

## Phase 1: Foundational (blocking every story)

- [x] T001 [P] Write `__tests__/messages/addressParts.test.ts` covering: a 3-part address → `parts`
  with the town in `line2`; a 2-part address → `parts`; a single-part string → `whole`; empty,
  whitespace and null → `none`; a part order that is preserved verbatim; and a string with a trailing
  comma. `now`-free and I/O-free.
- [x] T002 Implement `addressParts(raw: string | null | undefined): AddressParts` in
  `src/features/messages/state/addressParts.ts` per the plan's contract — total, never throws
  (Principle II), never re-orders or relabels (FR-003).
- [x] T003 Implement `markSameName(results)` in the same module: flag every result whose owner name is
  shared by another result in the set (trimmed, case-insensitive). Pure, O(n).
- [x] T004 Split the `Recipient` type in `src/services/isds/types.ts`: `label` → `name` + `address`
  (`string | null`). Update `toRecipientFromSearch` in `src/services/isds/soap.ts` to stop
  concatenating, and fix every call site the compiler flags.
- [x] T005 [P] Add the strings (cs + en, Czech first) to `src/i18n/strings.ts`: `recipient.noAddress`
  ("Adresa neuvedena" / "No address given"), `recipient.sameName` ("Shodné jméno" / "Same name"),
  `recipient.found` ("Nalezeno" / "Found"), `recipient.sameNameHint` ("Stejné jméno má víc schránek —
  rozliší je adresa." / "Several boxes share this name — the address tells them apart.").

---

## Phase 2: User Story 1 — pick the right person (P1) 🎯 MVP

- [x] T006 [US1] Write `__tests__/messages/recipientRow.test.tsx`: three same-name results render
  three distinct addresses, **no ellipsis character anywhere in a rendered address**, the same-name
  tag appears on all three, and a result with no address shows the placeholder rather than an empty
  gap. Must fail against the current row.
- [x] T007 [US1] Rebuild the result row in `src/features/messages/screens/ComposeScreen.tsx` per the
  design: name on its own line (wrapping, never truncated), `line1` muted / `line2` weighted, the
  wrapping meta row (type · box ID, cost badge, same-name tag). The avatar takes `name`, not the old
  combined label (FR-006).
- [x] T008 [US1] Add the results header — `Nalezeno · N`, plus the same-name hint line only when the
  set actually contains duplicates (FR-004a).
- [x] T009 [US1] Apply the same three address states to the **picked recipient** block on compose
  (FR-005), reusing the row's presentation rather than a second copy of it (Principle V).

**Checkpoint**: US1 is shippable here — the reported failure is fixed.

---

## Phase 3: User Story 2 — where a received message came from (P2)

- [x] T010 [US2] Render the sender's address in `src/features/messages/screens/MessageDetail.tsx`
  under the sender, using the same three states. Reads the stored `senderAddress` — **no ISDS call**
  (FR-009).
- [x] T011 [US2] Verify a message stored before the address columns existed renders normally with the
  no-address state and no error (FR-010). **Verified on device** with the czebox system-box message, whose `dmSenderAddress` is genuinely absent: the detail renders "Adresa neuvedena", subordinate and unmistakable for a real address.

---

## Phase 4: User Story 3 — where a sent message went (P3)

- [x] T012 [US3] Render the recipient's address on a sent message's detail, same treatment
  (`recipientAddress`).

---

## Phase 5: Polish & verification

- [x] T013 [P] Full gate: `npx tsc --noEmit`, `npx eslint .`, `npx jest`, `npm run attributions:check`.
- [x] T014 Device pass against the acceptance scenarios in [`spec.md`](./spec.md) (no separate quickstart was written) on the czebox box `3ntmizt`: the `Novak`
  search shows every address in full, at 1.0× and 1.5×, light and dark.
- [x] T015 Measure that no rendered address contains an ellipsis, via `uiautomator dump` rather than
  by eye — SC-002 is a counting criterion, so count it. **Done: zero, at both 1.0× and 1.5×**, on the live `Novak` search (50 results). This is the ONLY real check for SC-002 — the jest assertion cannot fail, because `numberOfLines` clips at layout time and the test renderer never lays out. Recorded in the test file rather than left to be discovered.
- [x] T016 Update `specs/README.md`: 015's row, and the stale "Going forward" prose that still says
  010 is the next feature to build.

---

## Dependencies

- **Phase 1 blocks everything.** T004 (the type split) is the widest change and everything renders
  from it.
- US1 (T006–T009) is the MVP and depends only on Phase 1.
- US2/US3 (T010–T012) depend on Phase 1 only — they are independent of US1 and of each other, and
  could ship first if US1 stalled.
- T005 is [P] against all render work; it only touches `strings.ts`.
