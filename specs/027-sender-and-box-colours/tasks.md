# Tasks: The sender in compose, and a colour of its own for every box

**Feature**: `027-sender-and-box-colours` | **Spec**: [spec.md](./spec.md)

No plan.md: the design doc (2026-10-03, variants 1A/2B/3C chosen by the owner) carried the decisions, and
everything below reuses an existing piece - `BottomSheet` for both sheets, the settings-card metrics for
the rows, `Avatar` for every box mark.

## Phase 1: Data (FR-001 - FR-003)

- [x] T001 `DataBoxAccount.color`; migration 16 `accounts.color`; `AccountsStore.setColor` in both stores.
- [x] T002 `theme/boxColor.ts`: the ten-colour palette, `boxColor` (falls back to the old ID hash),
  `nextBoxColor` (first free, else least used), colour names for screen readers.
- [x] T003 `addAccount` takes the first free colour; `listAccounts` colours older boxes once, distinct, in
  the order they were added, and stores it; `setColor` refuses anything outside the palette.
- [x] T004 Backup schema 3: `color` per account, migration 2→3, written on restore. Golden fixture
  `schema-v2.obalka` made from the last version 2 commit, with its own describe block; version 3 pinned.
- [x] T005 Tests: `boxColor.test.ts`, the colour block in `accountsController.test.ts`, `goldenRestore`,
  `compatibility`; every box colour - and the pill's monogram step over it - in `contrast.test.ts`.

## Phase 2: US3 - a colour for every box (decision 2B)

- [x] T006 "Upravit schránku": one sheet with a live preview, the name and ten swatches (radio group, a
  dot on a colour another box has). Only a colour the person picked is written back.
- [x] T007 The colour everywhere the box appears: switcher row, inbox header, "Jinde" line, re-auth,
  compose.
- [x] T008 Tests: the editing block in `BoxSwitcherSheet.test.tsx`.

## Phase 3: US4 - which box a message arrived in (decision 3C)

- [x] T009 `BoxPill` filled with the box's colour, monogram on a darker step (white at 22 % - the design's
  lighter step - measured 3.7:1 on the 10 px monogram), the box's own name.
- [x] T010 Tests: `mergedInbox.test.tsx`.

## Phase 4: US1/US2 - the sender (decision 1A)

- [x] T011 `SenderCard` above the recipient, "Změnit" with more than one box; `SenderSheet` lists every
  box, one needing a sign-in listed but not pickable. The draft stays when the sender changes.
- [x] T012 `Compose { boxId: string | null }`; the merged view's "Napsat"; `SenderGate` for a null sender
  (the prompt, the rest of the form shown inactive); once chosen, the sender never goes back to none.
- [x] T013 Tests: the sender blocks in `composeScreen.test.tsx`.

## Phase 4b: Owner walk-through, 2026-10-04

- [x] T013a The whole sender card is the button, with a chevron like the inbox's box selector; "Změnit" is
  gone (a lone text target on a card that looked pressable was reported as unintuitive).
- [x] T013b The credit is on the sender card - "Kredit" over the amount, red when it may not cover this
  message, from the freshly fetched balance - and the paid-message notice no longer repeats "Zbývá"; it
  keeps only the warning that it may not be enough.
- [x] T013c "Upravit schránku" opens without the keyboard and stays inside the safe area with it up (it
  scrolls when the room runs out). The same audit capped every sheet below the status bar
  (`useSheetMaxHeight`), put the lock screen and the QR scanner's Cancel past the system bars, and added
  `__tests__/theme/overlaySafeArea.test.ts` so no overlay can forget either edge.
- [x] T013d "Připomínka: Nenastavena" - the reminder is feminine since the rename from "Termín".

## Phase 5: The double load (owner, the same day)

Reported with this feature: lists and screens loading twice. Audited across the app, fixed at the source
and guarded so a new screen cannot bring it back.

- [x] T014 The shell keeps an unchanged account the same object (`app/reconcile.ts`); the "Jinde" summary
  keeps an unchanged answer.
- [x] T015 Screens key their loads on the box's ID: the inbox (merged view included, whose props are now
  memoised), the detail (no more blank, cancelled download or second mark-read), compose's credit and
  recipient search. The inbox re-reads its cache on a return to it, not on mount or a folder switch too.
- [x] T016 A second listing of a box's folder while one is under way joins it
  (`MessagesController.joinListing`); a pull-to-refresh still gets its own.
- [x] T017 Guards: `app/noDoubleLoad.test.tsx` (the real shell re-reading an unchanged table loads
  nothing, per-box and merged), `messages/freshProps.test.tsx` (screens handed a fresh copy load nothing),
  `messages/listingCoalescing.test.ts`, `app/reconcile.test.ts`.

## Phase 6: On a device

- [x] T018 Walked on the Android emulator (`Obalka_Demo`) 2026-10-03, installed over a build from before
  this feature: the three existing boxes came up blue, teal and purple (the one-time backfill); the merged
  list's filled pills; "Napsat" in "Vše" opening the sender gate; "Upravit schránku" with its live preview,
  saving a name and the rust colour together, the switcher, pills and sender sheet following. The walk found
  the sender card's button reading "Change recipient" (it borrowed the recipient's string) - now "Změnit" /
  "Change", with a test. Not walked: actually switching the sender, because every box on that device needs a
  new sign-in and so, correctly, none could be picked; the switch is covered by `composeScreen.test.tsx`.
