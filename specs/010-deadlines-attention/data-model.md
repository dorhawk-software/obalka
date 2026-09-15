# Phase 1 Data Model: Deadlines & Attention (cycle 1)

## Stored

### `reminders` (new table, encrypted DB)

The only new persistence in this cycle. Added by the existing migration runner.

| Column | Type | Notes |
|---|---|---|
| `boxId` | TEXT NOT NULL | part of the key; a message id is only unique within a box |
| `messageId` | TEXT NOT NULL | |
| `date` | INTEGER NOT NULL | epoch ms at **00:00 device-local** on the chosen day — the day is the datum, the time is derived |
| `createdBy` | TEXT NOT NULL | `'user'` \| `'scan'` — `'scan'` unused until cycle 2, present so the estimate flow needs no migration |
| `createdAt` | INTEGER NOT NULL | for ordering equal dates and for debugging |

`PRIMARY KEY (boxId, messageId)` — **one reminder per message**. Setting a new date replaces the old
one, which is also what makes rescheduling a cancel-and-recreate rather than a diff.

**Not stored, deliberately:**

- **The notification IDs.** Derived from `(boxId, messageId)` — see `contracts/reminders.md`. Storing
  them adds a column that can drift out of sync with the OS's own state.
- **A lead time.** The clarification round fixed the schedule at day-before + on-day. Deriving both
  from the date means changing the schedule later needs no migration.
- **A time of day.** 09:00 device-local, a constant.

**Lifecycle**: rows are dropped when the box is removed (`clearBox`), and when the user removes the
reminder. They are **not** dropped when ISDS erases the message content (state 9) or when a list sync
rewrites `messages` — a reminder is the user's own data and outlives both (Principle IV, research D6).

## Derived (never stored)

### `AttentionEntry`

What `attention.ts` returns, one per qualifying message, already ordered.

| Field | Type | Meaning |
|---|---|---|
| `messageId` | string | |
| `reason` | `'reminder'` \| `'estimate'` \| `'fiction'` \| `'unread'` | why it qualifies; a message with a date uses that reason even if also unread. `'fiction'` = served by fiction (state 5) |
| `date` | number \| null | the reminder/estimate date; `null` for `'fiction'` and `'unread'` |
| `daysRemaining` | number \| null | whole device-local days to `date`; negative when overdue |

**Ordering**: dated entries first, by `date` ascending (soonest first); then `'fiction'` by acceptance
time descending; then `'unread'` by delivery time descending (newest first).

*Amended 2026-09-14 (as built):* `'fiction'` was added while wiring T007 (see the note after T009 in
`tasks.md`). How many rows the block then SHOWS is a separate presentation rule applied afterwards:
`summarizeAttention` keeps every dated and fiction entry but at most `MAX_UNREAD_SHOWN` (3) plain
`'unread'` ones, and the rest stay in the date sections. The membership above is unchanged by it.

### `ReminderTimers`

What `reminders.ts` derives from a stored `date`, for the scheduler.

| Field | Type | Meaning |
|---|---|---|
| `dayBefore` | number \| null | epoch ms, `date − 1 day` at 09:00 local; `null` if already past |
| `onDay` | number \| null | epoch ms, `date` at 09:00 local; `null` if already past |
| `ids` | `{dayBefore: string; onDay: string}` | deterministic, see the contract |

A reminder set for **today** yields `dayBefore: null` and, after 09:00, `onDay: null` too — it is a
chip with no pending timer, which is the correct degradation rather than an immediate notification for
a moment that has passed.

## Unchanged

**No change to `MessageEnvelope`, to the ISDS projection, or to `messages`.** This is the single
biggest consequence of the spec revision: the removed fiction-countdown requirement would have needed
`dmType` / `dmPersonalDelivery` / `dmAllowSubstDelivery` surfaced through `soap.ts` plus a `messages`
migration. Cycle 1 needs neither. Unread is already computable — `isUnread(state)` in
`messagesController.ts`, i.e. `state > 0 && state < 7`.

## Settings

None added in cycle 1. The scan toggle belongs to cycle 2 (US3).
