# Tasks: Deadlines & Attention — cycles 1 and 2

**Feature**: `010-deadlines-attention` | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)
**Scope**: US1 (attention group) + US2 (user reminders) — cycle 1, Phases 1–5. US3 (the on-device
scan) — cycle 2, Phase 6.

## Format: `[ID] [P?] [Story] Description`

- **[P]** — parallelizable (different file, no dependency on an incomplete task)
- **[US1]/[US2]** — the user story the task serves

## Path Conventions

Feature-first `src/`; tests mirror under `__tests__/`. Paths below are repo-relative and exact.

**Tests are included.** Every module in this repo ships with tests and the plan's whole argument for
US1 is that it is a pure function testable with no device. Where a task is test-first, the test task
precedes the implementation task and is expected to fail until it lands.

---

## Phase 1: Setup

- [x] T001 Record the CURRENT permission set as the "before" baseline — resolve ONE aapt2 path (`AAPT=$(ls -d ~/Android/Sdk/build-tools/*/ | tail -1)aapt2`; the bare glob matches three versions, exits 255 and prints nothing) and paste the list into `specs/010-deadlines-attention/research.md` under D3. Without a captured baseline the later delta is an assertion, not a measurement. **Done 2026-08-17 — and it caught 014's permission check having silently failed.**

---

## Phase 2: Foundational (blocking prerequisites)

Deliberately tiny. US1 needs no storage and no notification library — that is what makes it shippable
on its own.

- [x] T002 [P] Define the reminder domain types in `src/features/messages/state/reminders.ts`: `Reminder` (`boxId`, `messageId`, `date`, `createdBy`, `createdAt`) per data-model.md. No I/O in this file.
- [x] T003 [P] Define the attention types in `src/features/messages/state/attention.ts`: `AttentionReason = 'reminder' | 'estimate' | 'unread'` and `AttentionEntry` (`messageId`, `reason`, `date`, `daysRemaining`).
- [x] T004 Implement `reminderNotificationIds(boxId, messageId)` in `src/features/messages/state/reminders.ts` returning `{dayBefore, onDay}` per contract C2. Pure, deterministic, no dependency on Notifee.

---

## Phase 3: User Story 1 — See what needs my attention (Priority: P1) 🎯 MVP

**Goal**: the inbox groups what needs looking at — unread messages, plus anything carrying a date.

**Independent test**: with a czebox box holding read and unread messages, the group contains exactly
the unread ones; reading one removes it; with nothing qualifying, no header renders. Needs no
reminders, no storage and no notification permission — a fake reminder map covers the dated inputs.

### Tests for US1

- [x] T005 [P] [US1] Write `__tests__/messages/attention.test.ts` covering: unread-only membership; a read message with a reminder qualifies; a message both unread and dated uses the `reminder` reason; ordering (dated by date ascending, then unread by delivery time descending); empty input → empty array; a garbled date yields no entry rather than throwing. `now` is an argument, never `Date.now()`.

### Implementation for US1

- [x] T006 [US1] Implement `attentionEntries(envelopes, reminders, now)` in `src/features/messages/state/attention.ts` — pure, O(n), crash-safe per Principle II. Uses `isUnread` from `src/features/messages/state/messagesController.ts` rather than re-deriving the state threshold.
- [x] T007 [US1] Render the "Vyžaduje pozornost" section in `src/features/messages/screens/MessageList.tsx` above the date-grouped list, reusing the existing section-header pattern from `groupByDate`. **No header when the list is empty** (FR-002).
- [x] T008 [P] [US1] Add the section heading strings (cs + en) to `src/i18n/strings.ts`.
- [x] T009 [US2] Guarantee no layout jump from the chip in `src/features/messages/screens/MessageList.tsx` (Principle V — 013 shipped this defect twice). **Moved from US1 to US2**: US1 renders no chip, so there was nothing to protect until T023 added one. **Solved by waiting, not by reserving — 2026-08-17.** The task originally said "reserve the chip's vertical space". Reserving was built and then removed: it bought the guarantee with a permanently empty 27px on every row, including the great majority that will never carry a chip, which drifts the row metrics away from the design for a feature the row is not using. The jump it was defending against had one cause — the reminders read resolving a frame after the messages — so the list now holds its skeleton until that local table read returns (`reminders === null` means "not read yet"). Rows are painted once, at their final height. Pinned by "paints no rows until the reminders are known" in `__tests__/messages/attentionCard.test.tsx`, verified to fail without the gate.

> **Found while wiring T007**: the attention section was not empty scaffolding — 013 had already
> repurposed it to hold messages ALREADY served by fiction (state 5). Dropping that would have removed
> a shipped feature, so `attentionEntries` gained a fourth reason, `fiction`, ranked below dated items
> (those still have a deadline to meet) and above plain unread (it is the one entry the user could not
> have seen coming). Four extra tests cover it.

**Checkpoint**: US1 is shippable here. The group works from unread alone; reminders light up the rest
when US2 lands.

---

## Phase 4: User Story 2 — Set my own deadline reminder (Priority: P2)

**Goal**: attach a date to a message; see it as a blue chip; get told the day before and on the day.

**Independent test**: set each preset and a custom date; confirm chip, group membership, both
notifications, replacement-not-duplication, removal, and survival across an app restart.

### Storage

- [x] T010 [US2] Add the `reminders` table migration in `src/services/db/migrations.ts` — `PRIMARY KEY (boxId, messageId)`, columns per data-model.md. Follow the existing numbered-migration pattern; do not edit an already-shipped migration.
- [x] T011 [P] [US2] Write `__tests__/db/remindersStore.test.ts` against the in-memory implementation: set/replace (one per message), get, listForBox, remove is idempotent, clearBox drops only that box's rows, and a read failure resolves to `null`/`[]` rather than rejecting.
- [x] T012 [US2] Implement `RemindersStore` (interface + `InMemoryRemindersStore` + `SqliteRemindersStore`) in `src/services/db/remindersStore.ts` per contract C1, mirroring the structure of `messagesStore.ts`.
- [x] T013 [US2] Wire `clearBox` so removing a box drops its reminders, in the same place the box's messages and attachments are dropped (`src/features/accounts/state/accountsController.ts` — follow the existing teardown call site). **As built:** `AppShell.handleRemove` (`src/app/AppShell.tsx`) calls `remindersController.clearBox`, which cancels each reminder's timers and then drops the rows; `accountsController.ts` is not involved.

### Notification library (the 014 boundary)

- [x] T014 [US2] Re-add `@notifee/react-native@^9.1.8` to `package.json`, restore `__mocks__/@notifee/react-native.js` with `createTriggerNotification` / `cancelTriggerNotification` / `TriggerType`, and run `npm run attributions:scan && npm run attributions` — the shipped-component list changes and the CI gate will fail otherwise.
- [x] T015 [US2] Implement the `Notifier` boundary in `src/services/notifications/notifications.ts` per contract C3 — `requestPermission`, `scheduleReminder`, `cancelReminder`, and **nothing else**. Include the comment stating what it must not grow.
- [x] T016 [US2] Implement `NotifeeNotifier` in `src/services/notifications/notifeeNotifier.ts`: one reminder channel; `createTriggerNotification` with a `TimestampTrigger` and **no `alarmManager`** (research D2 — passing it would demand `SCHEDULE_EXACT_ALARM`); keep `deleteChannel` calls for the retired `sync`/`messages`/`receipts`/`alerts` channels; `AndroidVisibility.PRIVATE` + the iOS `redacted` category, with the generic wording in the title and the subject in the body (013's lock-screen finding).
- [x] T017 [P] [US2] Write `__tests__/services/notifeeNotifier.test.ts`: both timers scheduled with the deterministic IDs; a past timer is skipped; `cancelReminder` cancels both and is safe when nothing was scheduled; **`createTriggerNotification` is never called with an `alarmManager` option**; a scheduling rejection does not propagate.

### Domain

- [x] T018 [P] [US2] Write `__tests__/messages/reminders.test.ts`: `reminderTimers(date, now)` yields day-before and on-day at 09:00 **device-local**; a reminder for today yields `dayBefore: null`; after 09:00 today, `onDay: null` too; IDs are deterministic and stable across calls.
- [x] T019 [US2] Implement `reminderTimers` in `src/features/messages/state/reminders.ts` per data-model.md. Device-local, **not** Europe/Prague — the contrast with `fikce.ts` is deliberate (research D4) and belongs in a comment.
- [x] T020 [US2] Implement `remindersController` in `src/features/messages/state/remindersController.ts`: `setReminder` (write, then schedule best-effort), `removeReminder` (cancel, then delete). A scheduling failure MUST NOT fail the write (FR-006).

### UI

- [x] T021 [US2] Build `src/features/messages/screens/TermPicker.tsx` — presets (Za týden / Za 2 týdny / Konec měsíce) + a custom date, opening with the current reminder preselected. Reuse the existing sheet pattern; `label` is required on every control (013's a11y finding).
- [x] T022 [US2] Add the "Termín" action and the current reminder's state to `src/features/messages/screens/MessageDetail.tsx`, including removal.
- [x] T023 [US2] Render the blue reminder chip on the list row in `src/features/messages/screens/MessageList.tsx` using `chipTone('userBlue', theme)` — the tone has been waiting in `src/theme/chipTone.ts` since the 009 port.
- [x] T024 [P] [US2] Add all picker, chip and notification strings (cs + en, Czech-first, plural forms for day counts) to `src/i18n/strings.ts`.
- [x] T025 [US2] Load the box's reminders in `src/features/messages/screens/MessageList.tsx` and feed them to `attentionEntries` so dated messages join the group for real.
- [x] T026 [US2] Request notification permission in `src/features/messages/state/remindersController.ts` at the moment the **first** reminder is set — not on launch, and not before the user has asked for anything. Denial degrades to chip + group only (FR-006).

---

## Phase 5: Polish & Cross-Cutting

- [x] T027 Verify the permission delta: rebuild, run `"$AAPT" dump permissions android/app/build/outputs/apk/debug/app-debug.apk` with a single resolved path, diff against T001. `POST_NOTIFICATIONS` returning is expected. `RECEIVE_BOOT_COMPLETED` may return via androidx.work — confirm the source and record it in research.md D3. **Done 2026-08-17: +2, −0** after stripping four permissions notifee's AAR declares but the app never uses. *(The original stop-condition read "stop if SCHEDULE_EXACT_ALARM shows up" — it did show up, from the library rather than from our code. The right response was to remove it, not to abandon the feature. See research.md.)*
- [x] T028 Amend **FR-010** in `spec.md` to match what D3 established — the rule is "no background ISDS capability", not a blanket ban on a permission a library declares for its own queue.
- [~] T029 Run the `quickstart.md` device pass on the emulator with a czebox box: US1 §1.1–1.5 and US2 §2.1–2.5. **US2 fully passed 2026-08-17**, against the production box (local table only — setting a deadline makes no ISDS call): §2.1 preset saves and the row joins the group; §2.2 the picker reopens with the current date selected, not blank; §2.3 stepping to a custom date replaces rather than duplicates; §2.4 removing clears the chip AND the row leaves the group — which also proved US1 §1.3, since the group header disappeared entirely rather than lingering empty; §2.5 the reminder survived a force-stop, an `am kill`, a reinstall and a reboot. US1 §1.4 passed too (a reminder on an already-read message puts it in the group with its chip).
  **US1 on a czebox box (`3ntmizt`), added by the user 2026-08-17**: §1.3 passed (with nothing qualifying, no header renders at all — confirmed on both boxes); §1.4 passed (a reminder on an already-read message puts it in the group with its blue chip); §1.5 passed on the production box's local reminders (two dated messages, `Termín 18. 8.` sorting above `Termín 24. 8.`, count badge 2). Both test reminders were removed afterwards.
  **Still blocked — §1.1 and §1.2**, and no longer for the reason recorded earlier. The credentials were fine; the earlier failure was mine, typing the box ID as the password (the note reads `login → dbID`, and says passwords are not stored). The real obstacle is that **both need an UNREAD received message and there is no way to manufacture one**: the box's only message is already read, and sending it one from itself fails with *"Nedostatek kreditu pro odeslání"* — a message between two natural persons is a paid PDZ and the test box has no credit. Unblocking needs either PDZ credit on `3ntmizt` or someone sending it a message from elsewhere (the czebox portal is the quickest). These steps will still NOT be run against the production mailbox: opening real mail to tick a checklist is a legal delivery, not a test.
- [x] T030 Device-test the notification itself per `specs/010-deadlines-attention/quickstart.md` §3.2. **Partly done 2026-08-17.** Verified on the emulator by force-running the scheduled WorkManager jobs (`adb shell cmd jobscheduler run -f`, which is what the OS does at the trigger time) rather than moving the clock — JobScheduler's TIME constraints run on elapsed realtime, so a wall-clock jump would not have fired them:
  - both timers are scheduled as `androidx.work` jobs at 09:00 today and 09:00 tomorrow, and `dumpsys alarm` is EMPTY — confirming D2's no-exact-alarm choice on the device, not just in the code;
  - the day-before notification reads **"Zítra máte termín"**, the on-day one **"Dnes máte termín"**, both on the `reminders` channel with `vis=PRIVATE` and the blue accent;
  - the TAP is covered by T035 (it was not merely untested — nothing consumed the payload);
  - **the permission-denied path passes**: with `POST_NOTIFICATIONS` revoked and the OS dialog dismissed with "Don't allow" (leaving the permission `USER_FIXED`, i.e. permanently denied), setting a deadline still saved it, still drew the chip, still put the row in the attention group, and did not throw. FR-006 holds on the device, not just against a mocked notifier.
- [x] T035 Verify the reminder tap-through on the device (blocked T030). **Done 2026-08-17 — and it took two more fixes.** The notification carried `data: {boxId, messageId}` and **nothing read it**: 011's deep-link router was removed by 014 along with the notifications it served, so a tapped reminder only raised the app. `deepLink.ts` / `deepLinkRouter.ts` and the AppShell + `index.js` wiring are restored and unit-tested; restoring them was necessary but not sufficient:
  1. **`pressAction: { id: 'default' }` does not launch a dead app.** It routes a press to a live JS runtime; with the process gone the notification was simply dismissed and nothing opened. `launchActivity: 'default'` is the half that starts the activity. Since a reminder fires hours after the app was last touched, the dead-process case is the NORMAL one — the option that was missing is the one that mattered. Pinned by a test.
  2. **The app then crashed on launch** with `Fragment$InstantiationException: Unable to instantiate ScreenStackFragment`. `MainActivity` was missing the `super.onCreate(null)` that `react-native-screens` requires, so Android's restored fragment state killed the app before any JS ran. **This was never about reminders**: the same crash was reachable any time the system re-created the Activity after killing the process — i.e. a user returning to the app hours later. A debug build launched from the launcher or Metro never has a saved state to restore, which is why nothing had ever hit it.
  Both fixed; the walk then passed for **both** paths: tapping while backgrounded, and tapping with the process killed (`am kill`), each landing on that message's detail with no crash.
- [x] T031 Device-test reboot survival per `specs/010-deadlines-attention/quickstart.md` §3.3: `adb reboot`, do not open the app, see whether the notification fires. Record the answer in `specs/010-deadlines-attention/research.md` D3. If it does not survive, implement re-arming from the store on launch in `src/app/AppShell.tsx` — idempotent thanks to the deterministic IDs (C2). **Done 2026-08-17: it SURVIVES.** Both jobs were back after `adb reboot` with the app never opened; the system started the app's process at boot for WorkManager's queue restore, which is what `RECEIVE_BOOT_COMPLETED` is for and makes no network call. Re-arming was therefore not built. Recorded in research.md, along with a case the test surfaced: reinstalling the app DOES clear the timers while the rows survive.
- [x] T032 Measure no-layout-jump for `src/features/messages/screens/MessageList.tsx` at 1.0× and 1.5× font scale with `adb shell uiautomator dump`. **Measure the right thing** (see T009): a chipped row is legitimately taller than an unchipped one, so comparing the two proves nothing. Dump the SAME row twice — first paint after a cold open, then again a second later — and confirm its bounds are identical; repeat for the rows below it. **Done 2026-08-17.** Cold-launched and polled `uiautomator dump` in a loop: at **1.0×** the first dump containing rows already read `[0,584][1080,895] / [0,1041][1080,1212] / [0,1328][1080,1499]` and was byte-identical through eleven further dumps; at **1.5×** the same, `[0,712][1080,1072] / [0,1233][1080,1433] / [0,1564][1080,1764]` from the first frame onward. No row ever appeared without its chip and then grew. At 1.5× the group header wraps to two lines and the chip stays intact, with no horizontal scrolling.
- [x] T033 [P] Full gate: `npx tsc --noEmit`, `npx eslint . --ext .ts,.tsx`, `npx jest`, and `npm run attributions:check`.
- [x] T034 Update `specs/README.md` — 010's row moves to Implemented (cycle 1), and the "Going forward" note records that 010 was the first feature to run the loop before the code. **Done 2026-08-17** — and it also had to correct 014's own paragraph, which claimed the app "runs no code while it is closed". A WorkManager timer means the system starts the app's process at boot and at each trigger; 014's actual finding (no ISDS call, no sign-in, no sync) is untouched, but the stronger sentence was not.

---

## Phase 6: US3 — the on-device scan (cycle 2)

**Goal**: after a download the user asked for, read the document on the phone and OFFER a deadline.
Nothing here may run without the toggle, and nothing it finds may be saved without a tap.

- [x] T036 Answer Q4–Q6 in `spec.md` (which library, which dates count, OCR or not) and record the
  on-device text-extraction research in `research.md`. **Done 2026-08-18.** Q6: no OCR — an image-only
  scan has no text layer and that is a normal "no suggestion", not a gap to fill with a 30 MB model.
- [x] T037 Build the cue-anchored scanner `src/features/messages/state/deadlineScan.ts` + tests.
  Cue-anchored, not date-greedy: a bare date anywhere in a document is not a deadline, so `do` /
  `nejpozději do` / `ve lhůtě do` must be the last word before it. Two candidate dates in one document
  yield **nothing** (Q5) — an app that guesses between two legal deadlines is worse than one that
  stays quiet.
- [x] T038 Build `src/services/scan/pdfText.ts` — lazy `pdfjs-dist`, `isEvalSupported: false`, a
  `Promise.withResolvers` polyfill for Hermes, a page cap, and a yield between pages. **The dependency
  decision was corrected in flight**: pdf.js 3.x was chosen first and is inside the range of
  GHSA-wgrm-67xf-hhpq, which is arbitrary JS execution from a crafted PDF — in an app that parses
  documents sent by anyone who knows a published box ID.
- [x] T039 Settings toggle (`scanAttachments`, default **off**) in `SettingsProvider` + `SettingsScreen`,
  with the key shared through `src/app/settings/settingsKeys.ts` so the writer and the reader cannot
  drift. Tests pin that only an explicit `"1"` enables it: an unrecognised stored value must resolve to
  "do not read the user's mail".
- [x] T040 `src/features/messages/state/scanController.ts` — the toggle is checked HERE, not only in the
  UI, so no caller can start a scan by forgetting to ask. Dismissals are stored per message
  (`scanDismiss:<boxId>:<messageId>`), which needed `removeSettingsWithPrefix` on the accounts store so
  a removed box takes them with it (`AppShell.handleRemove`, beside its reminders and its cache).
- [x] T041 `src/services/scan/attachmentScan.ts` — which files are opened and in what order: signatures,
  images and undownloaded attachments skipped, main document first, four files max. The first document
  stating an unambiguous deadline wins; merging dates across files would quietly undo T037's refusal to
  choose between two of them.
- [x] T042 `src/features/messages/screens/DeadlineSuggestion.tsx` + cs/en strings — the `estSoft` card,
  which shows the phrase it read the date from and the file it came from, and says the estimate was made
  on this phone. Both states share a `minHeight`, so the card that says "hledám" and the card that says
  "termín 8. 7." are the same size (Principle V).
- [x] T043 Wire it into `MessageDetail`: the scan runs only after a user-initiated download, only for a
  received message, and only when no deadline is already set — the user's own date is the answer, and an
  estimate arguing with it would be the app second-guessing a person about their own mail. Accepting
  writes an ordinary US2 reminder stamped `createdBy: 'scan'`.
- [~] T044 Device walk of `quickstart.md` US3. **Done 2026-08-19 for §4.1–§4.4 — and it is the only
  reason this feature works.** *Partial, marked 2026-09-14: §4.5 (responsiveness on a 10+ page PDF) is
  still owed.* The scan passed 575 tests and did nothing at all on a phone; six separate failures
  came out of one afternoon on the emulator, every one of them invisible to a Node-based suite:
  Metro could not bundle pdf.js (`static {}` blocks) and failed the WHOLE bundle, so the app ran an
  older cached one; `await import()` compiles to an async bundle fetched from the dev server, which
  failed as "Could not load bundle" and surfaced to the user as *"this document has no text layer"* —
  a legitimate outcome for a scanned decision, so the feature looked like it worked; and Hermes has
  none of `import.meta`, `TextDecoder`, `structuredClone` or `ReadableStream`. `pdfjs-dist` turned out
  not to load under Hermes in either of its builds; the parser is now unpdf's DOM-less build of pdf.js.
  See commit `a034374`.
  **What the walk then confirmed**, on czebox `3ntmizt`: §4.1 toggle off → download → no card and no
  indicator; §4.2 toggle on → the card names the date, the sentence it was read from and the file;
  §4.3 accept → the Termín row fills in and the inbox row joins Vyžaduje pozornost with the blue chip;
  §4.4 dismiss → gone, and still gone after a re-download AND after a force-stop and relaunch.
  **How §4.2/§4.3 were reached honestly**: the test box's only message is the ISDS welcome letter,
  whose PDF states no date at all (the real extraction returns 7712 characters of correctly-decoded
  Czech). One sentence was appended to the EXTRACTED TEXT for those two steps — real file, real
  parser, real scanner, doctored document — and removed afterwards. §4.5 (responsiveness on a large
  document) is **not** measured: a 3-page, 207 kB document is not the case that would show a stall.
- [x] T045 Update `specs/README.md` and `spec.md`'s Status line for cycle 2.
- [x] T046 Cut the Settings row down to two lines and move the detail into the FAQ, linked from the
  row and opening expanded and scrolled to (user request, 2026-08-19). The row could not be both
  short and complete, and the missing half was the part that decides consent: which library reads the
  document, which words it keys on, and what it refuses to do.

**A note on the chip.** `attentionEntries` maps `createdBy: 'scan'` to the `estimate` reason, but the
row still draws the blue `userBlue` chip, because US3 scenario 2 says an accepted estimate *becomes a
user reminder*. `estSoft` is therefore the SUGGESTION's tone, not an accepted estimate's — once the user
has said yes, the date is theirs and dressing it as a guess would be the app hedging about a decision the
user already made.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (T001)** — do first; the baseline is worthless captured afterwards.
- **Foundational (T002–T004)** — blocks both stories. Small on purpose.
- **US1 (T005–T008)** — depends only on Foundational. **This is the MVP.** (T009 moved to US2.)
- **US2 (T010–T026)** — depends on Foundational; T025 additionally depends on US1's `attentionEntries`.
- **Polish (T027–T034)** — after both stories.
- **US3 (T036–T046)** — cycle 2, after US2 shipped. Adds a feed to `attentionEntries` rather than
  changing one, which is why it could wait.

### User story dependencies

US1 and US2 are independent apart from **T025**, which is the seam where reminders start feeding the
group. US1 ships and is testable with no reminders in existence; US2 is testable through the store and
the chip without the group.

### Parallel opportunities

- T002 and T003 — different files, no shared symbols.
- T005 (US1 tests) alongside T011/T017/T018 (US2 tests) — all different files.
- T008 and T024 both touch `src/i18n/strings.ts`; T024 marked [P] only against non-strings work — **do
  not run them concurrently with each other**.
- T017 and T018 in parallel; both are pure-unit and touch different files.

### Parallel example: US1

```text
T005  write attention.test.ts        (fails)
  ↓
T006  implement attentionEntries     (test passes)
  ↓
T007  render the section  ──┐
T008  strings            ──┘  T008 is [P] with T007

T009  moved to US2: hold rows until reminders are read (not "reserve chip space")
```

## Implementation strategy

**MVP = US1 alone.** The group ships from unread membership, with no new dependency, no migration and
no notification permission. That is a complete increment: the inbox gains a "what have I not looked at"
section, which is the whole of what the app can honestly promise about incoming deadlines after 014.

**US2 second**, and it is where the risk sits — it re-introduces the notification library and is the
point at which an app with deliberately no background capability could quietly regain one. T027 and
T028 exist to make that check a task rather than a hope.

**US3 is cycle 2.** `attentionEntries` already accepts an `estimate` reason, so scanning adds a source
rather than a rewrite.
