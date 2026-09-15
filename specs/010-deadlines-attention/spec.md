# Feature Specification: Deadlines & Attention (Termíny · fikce · Vyžaduje pozornost)

**Feature Branch**: `010-deadlines-attention`
**Created**: 2026-06-30
**Status**: **Implemented — cycle 1 (US1 + US2) on 2026-08-17, cycle 2 (US3, the on-device scan) on
2026-08-19**, each walked on a device. Tasks 44/46 done, 2 partial (T029, T044). **Open:** quickstart
§1.1–1.2 (T029, needs an unread message in a czebox box) and §4.5 (T044, scan responsiveness on a
10+ page PDF, not measured). Originally drafted
2026-06-30 as spec-only ("spec all of it; port visuals only"). Its P1 mechanic — a *fikce* countdown on
unopened RECEIVED messages — was **invalidated by 013** four weeks later and has been removed; the
attention group survives on different feeds. See Clarifications below.
**Input**: The `Obalka Redesign.dc.html` design introduces capabilities the app does not yet have: a
"Vyžaduje pozornost" inbox group, deadline **chips** in three flavors (delivery-by-fiction countdown,
user-set reminders, on-device scan estimates), a term-picker, and an on-device attachment date-scan
with a Settings toggle. Per the user's instruction we do **not** guess these behaviors — they are
specified here (derived from the design's own logic in `support.js`) with open questions flagged.

## Why

Government data-box mail is **deadline-driven**, and the single scariest mechanic for users is
**doručení fikcí** — a message a user never opens is *legally deemed delivered* after 10 days, starting
official clocks (appeals, penalties) the user may never have seen. Surfacing "what needs attention,
and by when" — clearly, on-device, privacy-preserving — is the redesign's headline value-add and
directly serves Principle IV (the archive's purpose is not losing track of legal mail).

## Clarifications

### Session 2026-08-16 (post-013/014 revision)

- Q: 013 proved the fiction countdown cannot run on received messages — listing the inbox is what
  serves them (§17/3), so a row can never still be counting. Does "Vyžaduje pozornost" die with it?
  → **A: No.** The group had three feeds and loses only one. User reminders (US2) and on-device scan
  estimates (US3) both produce dates the app can compute, and `chipTone.ts` already carries their tones
  (`userBlue`, `estSoft`), added during the 009 port and still unused. The escalating `fikceRed` /
  `fikceAmber` tones, built for the dead received-side countdown, are the only orphans.
  *Amended 2026-09-14:* since the 2026-09-09 critique `fikceRed` / `fikceAmber` are used, by the
  SENT-side countdown (`fictionCountdownTone` in `messageState.ts`: red at 3 days or fewer, amber at 7
  or fewer, gold beyond). Nothing on the received side uses them.
- Q: Should unopened messages join the group even without a date? → **A: Yes.** And after 013/014 this
  is stronger than it looks. Every received message the app holds has already been served — listing it
  is what served it — so `state === 6` (doručeno, not yet read) means precisely *"the legal clock is
  running and you have not seen this"*. That is the closest computable thing to the original safety
  intent, and it does not depend on catching a message mid-fiction, which is impossible.
- Q: When does a reminder fire? *(was Q3)* → **A: Two notifications — the day before and on the day.**
  Only the date is stored; the two timers are derived from it.
- Q: Cycle boundary? → **A: Reminders first, scanning second.** The group ships whole with one feed;
  US3 becomes a second feed once the storage, chips and notification plumbing are proven.
- Q: Calendar vs shifted deadline *(was Q2)* → **A: Answered outside this spec on 2026-08-16.** Pure
  calendar days, no working-day shift; §40(1) správního řádu is scoped to performing an act in
  proceedings and does not reach §17(4). Argued in `fikce.ts`, which is now the only implementation.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — See what needs my attention (Priority: P1)

Messages that need looking at surface in a **"Vyžaduje pozornost"** group at the top of the inbox,
ordered by urgency. A message qualifies when any of these holds:

- it is **unread** (`state` 6 — already legally served, not yet opened by me), or
- it carries a **user reminder** (US2) — blue chip, or
- it carries an accepted **on-device scan estimate** (US3) — soft chip, or
- *(added while building T007)* it was **served by fiction** (state 5) — 013 had already put those in
  this section, and dropping them would have removed a shipped feature (tasks.md, note after T009).

**Why this priority**: It is the redesign's headline grouping and the app's answer to "what do I owe
somebody". Every input is computable from what the app already stores.

**What this story used to say, and why it changed.** Until 2026-08-16 this was a *delivery-fiction
countdown* on unopened received messages ("Doručení fikcí za N dní", escalating red/amber/gold). That
is not implementable: fetching the received list is itself what serves a message under §17(3), so by
the time any inbox row exists its message is in state 6 and the clock has stopped — 013 §6 established
this and moved the countdown to SENT messages, where it genuinely runs. The escalation tones
`fikceRed` / `fikceAmber` were built for this and are now unused. *Amended 2026-09-14:* since the
2026-09-09 critique they are used by the SENT-side countdown (`fictionCountdownTone`); nothing on the
received side uses them.

The replacement is not a consolation prize. Because listing serves the message, **`state === 6` means
"the deadline is already running and you have not read this"** — which is the population the original
story was trying to protect, reached by the one route the law leaves open.

**Independent Test**: With a czebox box holding read and unread messages plus one with a reminder,
confirm the group shows the unread messages (up to 3), every reminder-bearing message and every
fiction-served message, that reading a message removes it, and that the group disappears when empty.
*(Amended 2026-09-14 to the built rule; see FR-001.)*

**Acceptance Scenarios**:

1. **Given** a received message in state 6 (served, unread), **When** I view the inbox, **Then** it
   appears under "Vyžaduje pozornost".
2. **Given** I open it, **When** I return to the inbox, **Then** it has left the group (state 7).
3. **Given** a message I have already read but on which I set a reminder, **When** I view the inbox,
   **Then** it appears in the group with its blue chip.
4. **Given** no message qualifies, **When** I view the inbox, **Then** no group header is rendered —
   an empty attention section is worse than none.
5. **Given** a SENT message the recipient has not signed for, **Then** its fiction countdown appears in
   the sent list as 013 built it — this story does not touch it.

### User Story 2 — Set my own deadline reminder on a message (Priority: P2)

From a message I can set a **reminder** ("Termín") — quick presets (Za týden / Za 2 týdny / Konec
měsíce) or a custom date — shown as a blue chip and surfaced in "Vyžaduje pozornost"; the app schedules
**two local notifications**, one the day before and one on the day. I can remove it.

Only the DATE is stored; both timers are derived from it, so there is no lead-time field to migrate if
the schedule is ever changed. This is also the feature that **re-introduces a notification library**,
removed wholesale by 014 — permissible here precisely because a reminder is a timer on the device and
makes no ISDS call. That reversal is deliberate and belongs in the plan's dependency section.

**Why this priority**: High user value (turns mail into actionable to-dos) but needs new storage +
notification scheduling; independent of US1.

**Independent Test**: Set each preset + a custom date on a message; confirm the chip, the attention-group
entry, the scheduled local notification, and removal.

**Acceptance Scenarios**:
1. **Given** an opened message with no reminder, **When** I tap "Termín" and pick "Za týden", **Then** a
   blue "Termín D. M." chip appears and the message joins the attention group.
2. **Given** a message with a reminder for 22. 8., **When** 21. 8. arrives, **Then** I receive a local
   notification worded as "tomorrow", and on 22. 8. one worded as "today"; both deep-link to the message.
3. **Given** a message with a reminder, **When** I remove it, **Then** the chip and any scheduled
   notification are cleared.
4. **Given** the box's data is re-synced or restored, **Then** my reminders persist (local, per message).

### User Story 3 — On-device deadline suggestion from an attachment (Priority: P3)

> **Cycle 2, implemented 2026-08-19** (tasks T036–T046). The attention group shipped whole on US1 +
> US2; scanning became its second feed once the storage, chips and notification plumbing were proven.
> Q4–Q6 were answered on 2026-08-17 — see Open Questions. §4.5 (responsiveness on a large document)
> was not measured.

**Opt-in** (Settings toggle `Termíny v přílohách`, default OFF per Q4). After I download an
attachment, the app scans the document **entirely on-device** for a likely deadline date and, if
found, offers to save it as a reminder — clearly labeled an estimate to verify. Nothing leaves the
phone.

**Why this priority**: The most novel/complex and the most privacy-sensitive; strictly additive to US1/US2.

**Independent Test**: With the toggle on and a downloaded PDF containing a due date, confirm the scan
indicator, the suggestion card (with the detected date), accept→creates a reminder, dismiss→suppressed,
and that with the toggle off no scan runs.

**Acceptance Scenarios**:
1. **Given** scanning is on and I download a PDF mentioning "do 8. 7. 2026", **When** the scan finishes,
   **Then** a suggestion offers "Uložit termín 8. 7." marked as an on-device estimate to verify.
2. **Given** I accept, **Then** it becomes a user reminder (US2) — blue chip, scheduled notification.
3. **Given** I dismiss, **Then** the suggestion does not reappear for that message.
4. **Given** scanning is off, **When** I download an attachment, **Then** no scan runs and no document
   text is processed.

### Edge Cases
- ~~The 10th day falls on a weekend/holiday.~~ Settled: pure calendar days, no shift (`fikce.ts`).
- ~~A message type to which fiction does not apply.~~ Only reaches the SENT-side chip now, not this
  feature.
- Device clock / timezone — reminder dates, their 09:00 timers and their day counts are DEVICE-LOCAL
  (research D4). Only the SENT-side fiction date in `fikce.ts` is computed in Europe/Prague.
  *(Corrected 2026-09-14: this first said reminder dates were computed in Europe/Prague.)*
- **A reminder whose message is later erased by ISDS (state 9) or moved to the vault (10).** The
  reminder is local and outlives the message content; the chip must still render.
- **A box removed while reminders exist on its messages.** Their notifications must be cancelled with
  the box's data (`clearBox`).
- Multiple plausible dates in a document — which becomes "the" deadline? *(Q5)*
- A reminder set in the past, or after the message is deleted/restored — degrade gracefully.
- Notification permission denied — reminders still show as chips; the OS notification is best-effort
  and must not be the only signal. *(Since 2026-09-24 the reminder also says it will not alert and
  offers to turn notifications on - see FR-006.)*
- Reduce-Motion — the scan spinner becomes a static indicator.

## Requirements *(mandatory)*

### Functional Requirements

**Cycle 1 — the attention group and reminders**

- **FR-001**: The system MUST place a received message in the **"Vyžaduje pozornost"** group when it is
  unread (`isUnread`, i.e. `state` < 7), or carries a user reminder, or carries an accepted scan
  estimate — ordered by urgency (dated items by date, then unread by delivery time).

  *Amended 2026-09-14 (as built):* a received message is in the group when it carries a reminder or
  an accepted estimate; or is served by fiction (`state` 5, its own `fiction` reason); or is otherwise
  unread (`state` 4–6 without a fiction entry) and has not been opened on this device (a local
  `openedAt` takes it out).
  Order: dated entries by date, then fiction, then unread newest first. The block shows every dated
  and fiction entry but at most 3 plain-unread ones (`MAX_UNREAD_SHOWN` in `attention.ts`); the rest
  stay in the date sections. Fiction was added while wiring T007 (tasks.md); the cap is a presentation
  rule applied on top of this membership.
- **FR-002**: The group MUST NOT render at all when empty. *(No empty-state header — an attention
  section with nothing in it trains the user to ignore it.)*
- **FR-003**: A message MUST leave the group when it is read, and when its reminder is removed.
- **FR-004**: The system MUST let a user set a **reminder** on any message (presets + custom date),
  persist it **locally** per message (survives re-sync and archive restore — Principle IV), render a
  blue chip (`userBlue`), and allow removal.
- **FR-005**: The system MUST schedule **two** local notifications per reminder — the day before and on
  the day — deep-linking to the message. Only the date is stored; the timers are derived.
- **FR-006**: Missing notification permission MUST degrade to the on-screen chip and group membership
  only; a reminder MUST never depend on the OS notification to be visible.

  *Amended 2026-09-24 (owner decision):* the degradation stands - a reminder without notifications is
  still the chip and the group - but it is no longer SILENT about being silent. As built, the
  controller asked for permission on a box's first reminder and ignored the answer, and the sheet
  promised "Upozorníme vás den předem a v den termínu" whatever the answer had been; a refusal, a switch
  turned off later in the system settings, or a blocked reminders channel on Android left a reminder
  that would never alert beside copy that said it would. Now:
  - the notifier reads the permission state WITHOUT prompting (`Notifier.notificationAccess`: `on`,
    `unasked`, or `off`, which includes a blocked Android channel). Permission state is not
    something ISDS does, so this stays inside FR-010's boundary;
  - when a message's reminder will not alert, its Termín row says so inside the row's own card -
    "Upozornění jsou vypnutá, připomínka nepřijde." - with **Zapnout**, which shows the OS dialog
    while the OS can still show it (iOS before the first answer) and otherwise opens the system
    notification settings (Android always: it reports only granted/denied, so a dialog it may not
    show is never the offer). The state is read again when the app returns to the foreground, so
    the line goes away once notifications are on. Nothing is reserved for it when it is not shown;
  - the sheet's sentence says where the date will show instead of promising an alert when
    notifications are off and saving will not ask ("…termín uvidíte jen v aplikaci."). On a box's
    first reminder the save still asks, so the sheet keeps its promise and the row reports the
    answer as the sheet closes.
  Tests: `__tests__/messages/reminderAlerts.test.ts`, `reminderAlertsLine.test.tsx`,
  `__tests__/services/notifeeNotifier.test.ts`.
- **FR-007**: Removing a reminder, or deleting/restoring its message, MUST cancel both scheduled
  notifications; a reminder in the past MUST degrade to a chip with no pending timer.
- **FR-008**: All new strings MUST be cs + en, Czech-first; day counts use the plural forms.
- **FR-009**: All deadline computation MUST be crash-resilient (Principle II): a missing or garbled
  date yields no chip, never an exception.
- **FR-010**: Re-introducing a notification library MUST restore only what reminders need. The app MUST
  NOT regain any background **ISDS** capability: no scheduler that can reach the network, no headless
  task, no sync. Every permission in the built APK MUST be traceable to a code path the app actually
  takes; any a dependency declares for paths the app does not take MUST be removed from the merged
  manifest, and the resulting delta recorded. *(Guards the 014 boundary at the point most likely to
  erode it.)*

  *Amended 2026-08-17 (T028).* This first read "MUST NOT declare `RECEIVE_BOOT_COMPLETED` or any
  background-fetch permission" — unachievable and aimed at the wrong target. `RECEIVE_BOOT_COMPLETED`
  arrives through `androidx.work`'s own manifest whether asked for or not, and it is what restores a
  device-local timer after a reboot; forbidding it by name would have blocked the feature while
  leaving the permissions that genuinely mattered untouched. Measuring the delta caught four of those
  (`SCHEDULE_EXACT_ALARM` among them) and they were stripped — see research.md D3/T027.

**Cycle 2 — on-device scanning** *(implemented 2026-08-19)*

- **FR-011**: The system MUST provide a Settings toggle gating the on-device scan; with it off, **no
  document content is processed**.
- **FR-012**: When enabled, scanning MUST run entirely on-device (Principle III), off the UI thread
  (Principle I), only **after** a user-initiated download, and surface results as a labeled, dismissible
  **suggestion** (`estSoft`) — never auto-committing a reminder.

**Removed 2026-08-16** — these described the received-side fiction countdown, which cannot exist:

- ~~FR: compute a delivery-fiction countdown for an unopened message from `deliveryTime + 10 days`.~~
  Lives in `fikce.ts` for SENT messages only (013).
- ~~FR: the fiction chip tone MUST escalate red ≤3 / amber ≤7 / gold >7.~~ Gone from the received side.
  *Amended 2026-09-14:* the sent-side chip escalates red/amber/gold via `fictionCountdownTone`
  (`messageState.ts`: red at 3 days or fewer, amber at 7 or fewer, gold beyond) since the 2026-09-09
  critique; until then it used the single gold `statusFiction` tone and `fikceRed` / `fikceAmber` went
  unused. Nothing on the received side uses them.
- ~~FR: stop showing the countdown once accepted/read.~~ Moot.
- ~~FR: suppress the countdown where fiction does not legally apply, which requires surfacing `dmType` /
  `dmPersonalDelivery` / `dmAllowSubstDelivery` and a `messagesStore` migration.~~ **This is the best
  consequence of the change**: it deletes an ISDS projection change and a database migration from the
  feature. The question survives only for the SENT-side countdown, where it is now tracked. *(was Q1)*

### Key Entities

*As built (amended 2026-09-14). The first draft listed a `DeadlineSignal` with a `fikce` kind, a stored
`notificationId`, a scan `confidence` and a `scanEnabled` setting; planning and the build replaced them
with the entities below.*

- **AttentionEntry** (derived, per message): `messageId`, `reason` ∈ {`reminder`, `estimate`,
  `fiction`, `unread`}, `date`, `daysRemaining` (`attention.ts`).
- **Reminder** (stored, per message): `boxId`, `messageId`, `date`, `createdBy` (`user`|`scan`),
  `createdAt`. Lives in a new local table; never round-tripped to ISDS. Notification IDs are derived,
  never stored (research D5).
- **ScanSuggestion** (transient, on-device): `date`, `snippet`, `fileName` (`attachmentScan.ts`). A
  dismissal is stored as the setting `scanDismiss:<boxId>:<messageId>`.
- **Settings**: `scanAttachments` (`'1'` = on; any other value is off).

## Success Criteria *(mandatory)*
- **SC-001**: For a czebox box with a known mix of read and unread messages, the attention group
  shows the unread messages (up to 3), every reminder-bearing message and every fiction-served
  message, and nothing else. *(Amended 2026-09-14 to the built rule; see FR-001.)*
- **SC-002**: Setting/removing a reminder updates chip + attention group + scheduled notification within
  one frame, with no layout jump.
- **SC-003**: With scanning off, zero bytes of document content are read for analysis (verifiable).
- **SC-004**: Scanning never blocks the UI thread; the inbox stays scrollable during a scan (Principle I).
- **SC-005**: Reminders survive a sync and an archive restore (Principle IV).
- **SC-006**: A malformed/missing timestamp never produces a crash or a wrong chip (Principle II).

## Open Questions

**Answered 2026-08-16** — see Clarifications:

- ~~Q1 — Fiction applicability.~~ No longer reaches cycle 1; the received-side countdown is gone. Still
  open for the sent-side chip, tracked there.
- ~~Q2 — Calendar vs shifted deadline.~~ Pure calendar days, no working-day shift. Argued in `fikce.ts`.
- ~~Q3 — Reminder notification timing.~~ Day before + on the day; date-only storage.

**Answered 2026-08-17 (session 3), and cycle 2 is now planned against these:**

- **Q4 — Scan default & method.** → **Rules over extracted text, and the toggle defaults OFF.** No
  on-device model. A rule that fires can be pointed at and explained in the FAQ; a model's mistakes
  cannot, and this feature's output is a *legal deadline*. Opt-in because Principle III says the
  privacy-preserving default is the one that processes nothing until asked.
- **Q5 — Choosing "the" date.** → **Only a date anchored to a cue** ("do", "nejpozději", "ve lhůtě",
  "termín", …). Explicitly a HIGH-PRECISION, low-recall rule: with several dates in a decision —
  a hearing date, a validity date, an issue date — picking "the latest future one" would confidently
  present the wrong deadline, and a wrong legal deadline is worse than no deadline at all. Where no
  cue anchors a date, the app suggests nothing and says nothing.
- **Q6 — File types.** → **A PDF's text layer, plus plain text.** No OCR, no office formats. Scanned
  image-only PDFs are skipped silently rather than half-read.

## Assumptions
- US1 (attention grouping) is fully derivable from already-stored data — `isUnread` plus locally
  stored reminders. No ISDS projection change and no message-table migration are required for cycle 1.
- Cycle 1 = US1 + US2 (2026-08-17); US3 followed as cycle 2 (2026-08-19). The group was useful with
  one dated feed.
- Reminders and scan results are strictly **on-device**; nothing is sent to ISDS or any server.
- 014 removed `notifeeNotifier`, the channels and the dependency; cycle 1 re-introduced them on
  2026-08-17 for reminders only, a deliberate reversal whose scope is fixed by FR-010.
- Q2 is settled and Q1 no longer applies to this feature. Reminder and estimate copy must still avoid
  implying legal advice (Principle VI): a user-set date is the user's own note, and a scanned date is
  explicitly an estimate to verify.
