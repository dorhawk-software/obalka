// Local notifications boundary (feature 010 US2). Reminder scheduling ONLY.
//
// This file existed before, with three methods, and 014 deleted it. Read that spec before adding
// anything here, because the deletion was not a cleanup - it was the conclusion of a compliance
// argument. Every ISDS call is a sign-in, and Provozní řád ISDS §17 requires an application installed
// on a local station to sign in "pomocí manuálního příkazu uživatele". The app therefore runs NO code
// while it is closed and cannot learn that anything has happened.
//
// A reminder is different in kind: the user picked a date, the OS holds the timer, and nothing talks
// to ISDS. That is why this boundary may exist again, and it is also the exact shape of what it may
// contain.
//
// WHAT THIS INTERFACE MUST NOT GROW (010 FR-010):
//
//   * no `notifyNewMessages`, or anything triggered by mail arriving - the app cannot know that;
//   * no method taking a `DataBoxAccount`, a transport, a sync result, or a message list;
//   * no scheduling primitive that is not tied to a date the user chose.
//
// If a change seems to need one of those, it is not a notification change - it is a background-sync
// change, and `specs/014-no-background-sync/spec.md` is the document to argue with first.

/** What a scheduled reminder needs in order to be shown and cancelled. */
export interface ScheduleReminderInput {
  boxId: string;
  messageId: string;
  /** Shown in the notification body. Null when the message has no subject. */
  subject: string | null;
  /** Epoch ms for each timer, or null when that moment has already passed. */
  timers: { dayBefore: number | null; onDay: number | null };
}

/**
 * Whether a reminder will actually alert, read WITHOUT prompting (2026-09-24).
 *
 *   on       it will alert
 *   unasked  it will not yet, but the OS can still show its own permission dialog (iOS, before the
 *            user has answered it once)
 *   off      it will not: permission denied, notifications turned off in the system settings, or on
 *            Android the reminders channel blocked. Only the system settings can change this.
 *
 * Android reports permission as granted or denied and nothing else, so it never says `unasked`: a
 * never-asked Android 13 phone and one that has refused twice look the same from here. That is why
 * the offer to turn notifications on sends Android to the settings screen, where the switch is on
 * every version, rather than to a dialog that may not appear.
 *
 * This is permission STATE, read at a moment the user is looking at a reminder. It is not a way to
 * learn about anything happening in ISDS, and it does not widen what the header above allows.
 */
export type NotificationAccess = 'on' | 'unasked' | 'off';

export interface Notifier {
  /**
   * Ask for OS notification permission. Call it when the user sets their FIRST reminder - not on
   * launch, and not before they have asked for anything. Never throws; resolves whether allowed.
   */
  requestPermission(): Promise<boolean>;
  /**
   * Read the current state without asking for anything. Never throws; when the state cannot be read
   * it resolves `on`, because saying "your reminder will be silent" without knowing it would be a
   * claim the app cannot back (the reminder itself works either way - 010 FR-006).
   */
  notificationAccess(): Promise<NotificationAccess>;
  /**
   * Open the system notification settings for this app - the only place `off` can be undone. On
   * Android, the reminders channel's own page when that channel is the only thing switched off.
   * Never throws.
   */
  openSettings(): Promise<void>;
  /**
   * Schedule (or reschedule) both timers for one reminder. Timers already in the past are skipped.
   *
   * BEST-EFFORT by contract: a scheduling failure MUST NOT propagate. The chip and the attention
   * group are the primary signal and the notification is the bonus (010 FR-006) - a user who denied
   * permission still gets a working reminder, just a silent one.
   */
  scheduleReminder(input: ScheduleReminderInput): Promise<void>;
  /** Cancel both timers. Idempotent - safe for a reminder that was never scheduled. */
  cancelReminder(boxId: string, messageId: string): Promise<void>;
}

/** Records calls instead of scheduling anything - for tests and previews. */
export class InMemoryNotifier implements Notifier {
  scheduled: ScheduleReminderInput[] = [];
  cancelled: { boxId: string; messageId: string }[] = [];
  permission = true;
  /** What `notificationAccess` reports. Answering the dialog moves `unasked` on, as the OS does. */
  access: NotificationAccess = 'on';
  settingsOpened = 0;

  async requestPermission(): Promise<boolean> {
    if (this.access === 'unasked') {
      this.access = this.permission ? 'on' : 'off';
    }
    return this.permission;
  }

  async notificationAccess(): Promise<NotificationAccess> {
    return this.access;
  }

  async openSettings(): Promise<void> {
    this.settingsOpened += 1;
  }

  async scheduleReminder(input: ScheduleReminderInput): Promise<void> {
    this.scheduled.push(input);
  }

  async cancelReminder(boxId: string, messageId: string): Promise<void> {
    this.cancelled.push({ boxId, messageId });
  }
}
