// Reminder use-cases (feature 010 US2): the thin layer that composes storage with scheduling, so
// neither knows about the other. `remindersStore` needs no OS mock to test; `NotifeeNotifier` needs
// no database.
//
// The ordering in each method is deliberate and is the whole reason this file exists:
//
//   setReminder     WRITE first, then schedule. The chip and the attention group come from storage,
//                   so a scheduling failure must still leave a working (silent) reminder - 010
//                   FR-006. Scheduling first and writing second would give the opposite failure: a
//                   notification for a reminder that does not exist.
//   removeReminder  CANCEL first, then delete. A stale timer for a deleted reminder would open a
//                   message the user has already dealt with; a deleted row whose timer survives is
//                   the worse of the two, so cancellation goes first even though it is best-effort.

import type { Notifier } from '../../../services/notifications/notifications';
import type { RemindersStore } from '../../../services/db/remindersStore';
import { reminderTimers, type Reminder } from './reminders';
import { reportFailure } from '../../../services/telemetry/telemetry';

/**
 * What a reminder on this box will do, for the screens that show one (2026-09-24, 010 FR-006).
 *
 *   on   it will alert
 *   ask  it will not yet, but saving a reminder asks the OS (the box's first reminder, see
 *        `setReminder`) - so the sheet may still describe the notification, and the answer is shown
 *        right after the save
 *   off  it will not, and saving will not change that - the reminder is the chip alone until the user
 *        turns notifications on
 */
export type ReminderAlerts = 'on' | 'ask' | 'off';

export interface RemindersControllerDeps {
  store: RemindersStore;
  notifier: Notifier;
  now?: () => number;
}

export class RemindersController {
  constructor(private readonly deps: RemindersControllerDeps) {}

  private now(): number {
    return this.deps.now ? this.deps.now() : Date.now();
  }

  /**
   * Set (or replace) the reminder on a message and schedule its two notifications.
   *
   * Asks for notification permission the FIRST time a reminder is set - the point at which the user
   * has actually asked for something. Never on launch: a permission dialog before the user has
   * expressed any interest is the pattern that gets denied and then never revisited.
   */
  async setReminder(
    boxId: string,
    messageId: string,
    date: number,
    subject: string | null,
    createdBy: Reminder['createdBy'] = 'user',
  ): Promise<void> {
    const reminder: Reminder = {
      boxId,
      messageId,
      date,
      createdBy,
      createdAt: this.now(),
    };
    // Read BEFORE writing. Asking "is this the box's only reminder?" afterwards cannot tell a first
    // reminder from an edit of the only one there is - `set` upserts, so the count is 1 either way,
    // and the user got the OS permission dialog every single time they nudged a date. Caught on the
    // emulator, not by a test: the controller's own test asks twice for two DIFFERENT messages, which
    // is the one case the broken rule got right.
    const isFirstInBox = (await this.deps.store.listForBox(boxId)).length === 0;
    await this.deps.store.set(reminder); // the reminder now exists, whatever happens next

    try {
      if (isFirstInBox) {
        await this.deps.notifier.requestPermission();
      }
      const timers = reminderTimers(date, this.now(), boxId, messageId);
      await this.deps.notifier.scheduleReminder({
        boxId,
        messageId,
        subject,
        timers: { dayBefore: timers.dayBefore, onDay: timers.onDay },
      });
    } catch (e) {
      // Best-effort by contract. The chip is the reminder; this was the announcement.
      reportFailure('notify.schedule', e, { stage: 'native' });
    }
  }

  /**
   * Whether a reminder on this box will alert. Reads permission state and never asks for it.
   *
   * Never rejects: a failure reads as `on`, because telling the user their reminder is silent is a
   * claim, and the app does not make claims it cannot check.
   */
  async alertsFor(boxId: string): Promise<ReminderAlerts> {
    try {
      const access = await this.deps.notifier.notificationAccess();
      if (access === 'on') {
        return 'on';
      }
      // The same rule `setReminder` asks by, read the same way.
      const isFirstInBox = (await this.deps.store.listForBox(boxId)).length === 0;
      return isFirstInBox ? 'ask' : 'off';
    } catch (e) {
      reportFailure('notify.permission', e, { stage: 'native' });
      return 'on';
    }
  }

  /**
   * The "turn on" action beside a silent reminder: the OS dialog while it can still be shown,
   * otherwise the system settings, which is the only place a refusal can be undone. An app cannot
   * re-show a dialog the user has already answered.
   */
  async turnOnAlerts(): Promise<void> {
    try {
      const access = await this.deps.notifier.notificationAccess();
      if (access === 'unasked') {
        await this.deps.notifier.requestPermission();
      } else if (access === 'off') {
        await this.deps.notifier.openSettings();
      }
    } catch (e) {
      reportFailure('notify.permission', e, { stage: 'native' });
    }
  }

  /** Remove the reminder and cancel both of its timers. Idempotent. */
  async removeReminder(boxId: string, messageId: string): Promise<void> {
    try {
      await this.deps.notifier.cancelReminder(boxId, messageId);
    } catch (e) {
      // A timer we failed to cancel is bad, but not a reason to keep the row. It does mean a
      // notification will fire for a reminder the user has deleted.
      reportFailure('notify.cancel', e, { stage: 'native' });
    }
    await this.deps.store.remove(boxId, messageId);
  }

  /** Every reminder for a box, for the attention group. */
  listForBox(boxId: string): Promise<Reminder[]> {
    return this.deps.store.listForBox(boxId);
  }

  /** One reminder, for the detail screen. */
  get(boxId: string, messageId: string): Promise<Reminder | null> {
    return this.deps.store.get(boxId, messageId);
  }

  /**
   * Drop a box's reminders and cancel their timers - called when the box is removed.
   *
   * Reminders deliberately outlive message CONTENT (ISDS erases at 90 days) but not the box: a
   * reminder on a box that is gone can never be shown or opened, and its notification would fire
   * pointing at nothing.
   */
  async clearBox(boxId: string): Promise<void> {
    const existing = await this.deps.store.listForBox(boxId);
    for (const r of existing) {
      try {
        await this.deps.notifier.cancelReminder(boxId, r.messageId);
      } catch (e) {
        // keep going - one stubborn timer must not strand the rest
        reportFailure('notify.cancel', e, { stage: 'native' });
      }
    }
    await this.deps.store.clearBox(boxId);
  }
}
