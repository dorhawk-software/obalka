# Phase 1 Contracts: reminders (cycle 1)

Three boundaries. Reads (`get`, `listForBox`) and every `Notifier` call are crash-safe (Principle II):
a failure degrades and never throws. Store WRITES (`set`, `remove`, `clearBox`) reject on a database
error, and `remindersController` lets that rejection through to its caller. *(Corrected 2026-09-14:
this first said no boundary ever throws, which was never true of the store's writes.)*

---

## C1 — `RemindersStore`

Mirrors `MessagesStore`: an interface with an in-memory reference implementation for tests and a
SQLite implementation for the app.

```ts
export interface Reminder {
  boxId: string;
  messageId: string;
  /** Epoch ms at 00:00 device-local on the chosen day. */
  date: number;
  createdBy: 'user' | 'scan';
  createdAt: number;
}

export interface RemindersStore {
  /** Set or replace the reminder on a message. One per message (data-model). */
  set(reminder: Reminder): Promise<void>;
  /** Remove it. No-op if absent — removal must be idempotent, the UI may retry. */
  remove(boxId: string, messageId: string): Promise<void>;
  /** Every reminder for a box, for the attention group. Newest-first is NOT required — the caller orders. */
  listForBox(boxId: string): Promise<Reminder[]>;
  /** One reminder, for the detail screen. */
  get(boxId: string, messageId: string): Promise<Reminder | null>;
  /** Drop a box's reminders. Called with the box's other data. */
  clearBox(boxId: string): Promise<void>;
}
```

**Contract notes**

- `set` on an existing `(boxId, messageId)` **replaces**. The caller does not check first.
- A read failure resolves to `null` / `[]`, never rejects. A reminder that cannot be read must degrade
  to "no chip", exactly as a garbled date does.
- A write failure (`set`, `remove`, `clearBox`) rejects; the store does not swallow it.
- The store knows nothing about notifications. Scheduling is the controller's job, so a store test
  needs no OS mock.

---

## C2 — Deterministic notification IDs

```ts
export function reminderNotificationIds(boxId: string, messageId: string): {
  dayBefore: string;
  onDay: string;
};
// → { dayBefore: `rem:${boxId}:${messageId}:d1`, onDay: `rem:${boxId}:${messageId}:d0` }
```

**Why this is a contract and not an implementation detail**: it is what lets storage stay date-only
(research D5). Cancelling needs no stored handle, and rescheduling is *cancel both, create both*.

It also makes the scheduler **idempotent**: creating a trigger with an existing ID replaces it rather
than duplicating, so re-arming on launch — the fallback if reboot survival turns out not to hold — is
safe to run unconditionally.

---

## C3 — `Notifier` (returns, deliberately smaller)

014 deleted a three-method interface for notifications the app could not send. It comes back with the
minimum reminders need:

```ts
export interface Notifier {
  /** Ask for OS permission. Resolves whether notifications are allowed. Never throws. */
  requestPermission(): Promise<boolean>;
  /**
   * Schedule (or reschedule) both timers for a reminder. Timers already in the past are skipped.
   * Best-effort: a scheduling failure MUST NOT fail the reminder write — the chip is the primary
   * signal and the notification is the bonus (FR-006).
   */
  scheduleReminder(input: {
    boxId: string;
    messageId: string;
    /** Message subject, for the notification body. */
    subject: string | null;
    timers: { dayBefore: number | null; onDay: number | null };
  }): Promise<void>;
  /** Cancel both timers. Idempotent; safe for a reminder that was never scheduled. */
  cancelReminder(boxId: string, messageId: string): Promise<void>;
}
```

**What this interface MUST NOT grow** (the concrete form of FR-010):

- no `notifyNewMessages`, or anything triggered by mail arriving — the app cannot know that;
- no method taking a `DataBoxAccount`, a transport, or a sync result;
- no scheduling primitive not tied to a user-set date.

If a future change needs one of these, it is not a notification change — it is a background-sync
change, and 014's spec is the document to argue with.

### Android specifics

- Trigger notifications are created **without** the `alarmManager` option → WorkManager, no
  `SCHEDULE_EXACT_ALARM` (research D2). Approximate delivery is acceptable and intended.
- One channel, for reminders only. The retired `messages` / `receipts` / `alerts` channels must not
  come back; `deleteChannel` calls for them stay.

### Lock-screen wording

The 013 lesson applies unchanged: neither platform lets an app force lock-screen redaction. Put the
generic wording in the **title** and the message subject in the **body**, mark the notification
`PRIVATE`, and keep the iOS `redacted` category. Any copy claiming the subject is hidden is false —
see 013's port-notes.
