# Implementation Plan: Deadlines & Attention — cycle 1

**Branch**: `010-deadlines-attention` | **Date**: 2026-08-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-deadlines-attention/spec.md`

**Scope**: cycle 1 only — **US1** (attention group) and **US2** (user reminders). **US3** (on-device
attachment scanning) is deferred; its Q4–Q6 remain open and are not blockers here.

**As built (see [tasks.md](./tasks.md)):** US3 / cycle 2 was implemented 2026-08-19 from tasks.md
Phase 6, with no separate plan. Q4–Q6 were answered 2026-08-17 (spec, Open Questions). Reboot survival
was measured YES (research T031), so the re-arm fallback was not built.

## Summary

Give the inbox a **"Vyžaduje pozornost"** group and let a user attach a **date** to a message.

The group is fed by three inputs, all computable from data the app already holds: a message is unread
(`state` 6 — served but not opened), or carries a user reminder, or carries an accepted scan estimate
(cycle 2). A reminder is stored locally per message, renders as a blue chip, and schedules **two** OS
notifications — the day before and on the day.

The technically interesting part is not the feature, it is the boundary: this is the first work since
014 to re-introduce a notification library, and 014's whole point was that the app runs no code while
closed. Reminders are permissible because the timer is the OS's and involves no ISDS call — but the
plan has to make that distinction structural rather than a promise, which is what the constitution
check below and tasks T027/T028 (permission delta + FR-010 amendment) are for.

## Technical Context

**Language/Version**: TypeScript (strict), React Native 0.86, New Architecture (Fabric + TurboModules)
**Primary Dependencies**: `@notifee/react-native` ^9.1.8 (**re-added** — removed in 014), existing
`@op-engineering/op-sqlite` (SQLCipher) and the app's own migration runner
**Storage**: new `reminders` table in the encrypted DB; no ISDS projection change, no `messages` change
**Testing**: jest + @testing-library/react-native; device pass on the Android emulator + a czebox box
**Target Platform**: Android (emulator-verified) and iOS 15.1+ (deployment target; sideloaded)
**Project Type**: mobile app, feature-first `src/`
**Performance Goals**: group computation is O(n) over the cached list and must not add a frame to inbox
render; no layout jump when a chip appears (Principle V)
**Constraints**: offline-capable, entirely on-device, **no background ISDS capability may return**
**Scale/Scope**: 2 user stories, ~1 new table, ~1 new screen surface (term picker), 2 chip flavours

## Constitution Check

*GATE: must pass before Phase 0. Re-checked after Phase 1 — see the bottom of this file.*

| Principle | Assessment |
|---|---|
| **I — Never Block the UI Thread** | Group membership is derived from the already-loaded list; reminder writes are async against SQLite. No scanning in this cycle, which is where the thread risk actually lives. **Pass.** |
| **II — Crash-Resilient by Contract** | A missing or garbled date yields no chip, never an exception — the rule `fikce.ts` already follows. Scheduling is best-effort: a failed `createTriggerNotification` must not fail the write. **Pass.** |
| **III — Privacy First, On-Device Only** | Reminders never leave the device and are never round-tripped to ISDS. The library re-added talks to the OS, not the network. **Pass, with the check in T027/T028 (permission delta + FR-010 amendment).** |
| **IV — The Local Archive** | Reminders must outlive message content: ISDS erases at 90 days (state 9), the archive keeps its copy, and the reminder is the user's own data. Separate table, dropped only with the box. **Pass — and it drove D6.** |
| **V — Modern, Accessible, Consistent** | Chips use existing tones (`userBlue`, `estSoft`) already in `chipTone.ts`; the group header reuses the section-header pattern. No layout jump when a chip appears: rows are not painted until the box's reminders have been read, so every row appears at its final height (*as built*, T009; reserving space was tried and removed). Toggle/`label` a11y rules from 013 apply to any new control. **Pass.** |
| **VI — Honest Scope** | The feature must not imply legal advice: a user date is the user's own note, and the group is "what you have not looked at or have flagged", not "what is legally urgent". Copy must not resurrect the fiction-countdown promise this spec just removed. **Pass.** |
| **VII — Verify Against the Test Environment** | Emulator + a czebox box; no production mailbox is required to exercise any of this. **Pass.** |

**No violations.** One requirement is amended rather than met as written — **FR-010**, see D3 in
[research.md](./research.md): forbidding `RECEIVE_BOOT_COMPLETED` outright is likely unachievable
because androidx.work declares it, and the rule that matters is "no background ISDS capability". The
amendment is recorded in the spec rather than silently reinterpreted here.

## Project Structure

### Documentation (this feature)

```text
specs/010-deadlines-attention/
├── spec.md              # revised 2026-08-16 for 013/014
├── plan.md              # this file
├── research.md          # Phase 0 — D1–D6
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1 — device acceptance
├── contracts/
│   └── reminders.md     # Phase 1 — store + scheduler contracts
└── tasks.md             # Phase 2 (/speckit.tasks — NOT created here)
```

### Source code

```text
src/
├── features/messages/
│   ├── state/
│   │   ├── attention.ts          # NEW — pure: which messages are in the group, and why
│   │   └── reminders.ts          # NEW — reminder domain + the two derived timer instants
│   ├── screens/
│   │   ├── MessageList.tsx       # attention section + blue chip on a row
│   │   ├── MessageDetail.tsx     # "Termín" action + current reminder
│   │   └── TermPicker.tsx        # NEW — presets + custom date, per the design
├── services/
│   ├── db/
│   │   ├── migrations.ts         # NEW migration: reminders table
│   │   └── remindersStore.ts     # NEW — CRUD, crash-safe, mirrors messagesStore
│   └── notifications/
│       ├── notifications.ts      # NEW (returns) — Notifier boundary, reminder-only
│       └── notifeeNotifier.ts    # NEW (returns) — trigger notifications, no alarmManager
└── i18n/strings.ts               # cs + en

__tests__/
├── messages/attention.test.ts
├── messages/reminders.test.ts
└── db/remindersStore.test.ts
```

## Phase 1 — design decisions that shape the tasks

**The group is a pure function.** `attention.ts` takes the cached envelopes plus the reminder map and
returns the ordered membership. No I/O, no dates from `Date.now()` passed implicitly — `now` is an
argument, as in `fikce.ts`, so the tests are deterministic. This is what makes US1 testable without a
device.

**Two timers, derived, never stored.** `reminders.ts` turns a date into the two instants
(day-before 09:00 and on-day 09:00, device-local) and the two deterministic notification IDs (D5).
Storage stays `{boxId, messageId, date}`.

**The Notifier boundary comes back smaller.** 014 deleted an interface with three methods for
notifications the app could not send. It returns with three reminder-only methods —
`requestPermission`, `scheduleReminder`, `cancelReminder` (contract C3) — and must not regain
`notifyNewMessages` or anything sync-shaped — that is the concrete form of FR-010.

**Ordering inside the group**: dated items first by date ascending (soonest deadline at the top), then
undated unread by delivery time descending (newest first). A message that is both unread *and* dated
sorts by its date — the date is the stronger signal. *As built:* a fourth reason, `fiction` (state 5),
sorts between the dated items and plain unread — see the note after T009 in tasks.md.

**Empty means absent.** No group header renders when nothing qualifies (FR-002). An attention section
that is usually empty teaches people to skip it.

## Post-design constitution re-check

Re-evaluated after the Phase 1 artifacts: **still passing**. The design added no network path, no
background execution, and no new ISDS field. The one risk that grew during design is Principle VI —
a group called "Vyžaduje pozornost" containing merely-unread mail could over-promise urgency, so the
copy tasks (T008/T024, strings) are explicitly about not implying a legal deadline where there is none.

## What this plan does NOT cover

- **US3 / cycle 2**: attachment scanning, the settings toggle, `estSoft` suggestions. `attention.ts`
  accepts an estimate feed from the start so cycle 2 adds a source, not a rewrite.
- **Reboot survival**, which research could not settle from Notifee's documentation. Treated as a
  device test with a documented fallback, not as a promise. *Settled 2026-08-17: it survives
  (research T031), and the fallback was not built.*
- **The sent-side fiction countdown**, which already ships (013) and is untouched here.
