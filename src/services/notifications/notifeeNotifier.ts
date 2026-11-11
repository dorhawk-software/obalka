// Device Notifier (feature 010 US2): reminder scheduling via Notifee. NEVER throws - a notification
// failure must not fail the reminder it belongs to.
//
// TWO DECISIONS HERE ARE LOAD-BEARING AND EASY TO UNDO BY ACCIDENT.
//
// 1. NO `alarmManager`. Notifee schedules a timestamp trigger through WorkManager by default and
//    through AlarmManager if you pass that option. AlarmManager is exact - and needs
//    `SCHEDULE_EXACT_ALARM` on Android 12+, which Google restricts to alarm-clock and calendar apps.
//    A 09:00 reminder does not need second precision, so the option would buy nothing and cost a
//    restricted permission. `__tests__/services/notifeeNotifier.test.ts` asserts it is never passed.
//
// 2. The lock screen is NOT ours to control, on either platform. 013 shipped a promise that it was,
//    and it was false. What an app CAN do is shape the redacted form: generic wording in the TITLE,
//    the identifying detail in the BODY, `PRIVATE` visibility on Android, and an iOS category that
//    keeps the title and replaces the body. Whether any of it is honoured is the user's own OS
//    setting. Do not write copy claiming the subject is hidden.

import notifee, {
  AndroidImportance,
  AndroidVisibility,
  AuthorizationStatus,
  TriggerType,
} from '@notifee/react-native';
import { Linking, Platform } from 'react-native';
import { reportFailure } from '../telemetry/telemetry';
import { t } from '../../i18n/strings';
import { reminderNotificationIds } from '../../features/messages/state/reminders';
import {
  PASSWORD_NUDGE_PREFIX,
  passwordNudgeIds,
} from '../../features/accounts/state/passwordNudge';
import { formatExpiryDate } from '../../features/accounts/state/passwordExpiry';
import type {
  NotificationAccess,
  Notifier,
  PasswordNudge,
  ScheduleReminderInput,
} from './notifications';

/** The reminders the person set. */
const CHANNEL_REMINDERS = 'reminders';
/**
 * A box's password running out (030 US3). A channel of its own, so the person can switch these off in
 * the system settings without losing the reminders they set themselves, or the other way round.
 */
const CHANNEL_PASSWORD = 'password';
/** iOS: shapes the hidden-preview form (title kept, body replaced). */
const CATEGORY_REDACTED = 'redacted';
/** Brand blue - a date the user set. */
const ACCENT = '#2A5C9A';

/** Channels retired along the way. An orphan channel keeps offering a switch nothing can send to. */
const RETIRED_CHANNELS = ['sync', 'messages', 'receipts', 'alerts'];

async function ensurePlatform(): Promise<void> {
  if (Platform.OS === 'ios') {
    await notifee.setNotificationCategories([
      {
        id: CATEGORY_REDACTED,
        hiddenPreviewsShowTitle: true,
        hiddenPreviewsShowSubtitle: false,
        hiddenPreviewsBodyPlaceholder: t('notif.hiddenBody'),
      },
    ]);
    return;
  }
  await notifee.createChannel({
    id: CHANNEL_REMINDERS,
    name: t('notif.channel.reminders'),
    // DEFAULT, not HIGH: a reminder is something the user asked for on a day they chose. It should
    // appear, not interrupt.
    importance: AndroidImportance.DEFAULT,
  });
  await notifee.createChannel({
    id: CHANNEL_PASSWORD,
    name: t('notif.channel.password'),
    importance: AndroidImportance.DEFAULT,
  });
  for (const id of RETIRED_CHANNELS) {
    await notifee.deleteChannel(id).catch(() => {});
  }
}

/**
 * iOS refusing to schedule because notifications are not allowed for the app ("Repository could not
 * save notification. Source is not authorized.", UNErrorCodeNotificationsNotAllowed). That is the
 * person's answer, not a failure, so it is not reported (Sentry, 2026-11-11, build 5).
 */
export function isNotificationsNotAllowed(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return /not authorized|notifications? (are )?not allowed|NotificationsNotAllowed/i.test(message);
}

export class NotifeeNotifier implements Notifier {
  async requestPermission(): Promise<boolean> {
    try {
      const settings = await notifee.requestPermission();
      await ensurePlatform();
      return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
    } catch (e) {
      // `false` is also what a DECLINED permission returns, and the two are not the same thing: one
      // is the user's answer, the other is the reminder feature being unavailable for a reason
      // nobody can see.
      reportFailure('notify.permission', e, { stage: 'native' });
      return false;
    }
  }

  async notificationAccess(): Promise<NotificationAccess> {
    try {
      // `getNotificationSettings`, never `requestPermission`: this runs whenever a reminder is on
      // screen, and a read that could raise the OS dialog would ask on every visit.
      const { authorizationStatus } = await notifee.getNotificationSettings();
      if (authorizationStatus === AuthorizationStatus.NOT_DETERMINED) {
        return 'unasked';
      }
      if (authorizationStatus < AuthorizationStatus.AUTHORIZED) {
        return 'off';
      }
      // Android lets the user switch off one channel while the app stays allowed. Every reminder
      // goes to this one, so that is the same as switching reminders off.
      if (
        Platform.OS === 'android' &&
        (await notifee.isChannelBlocked(CHANNEL_REMINDERS))
      ) {
        return 'off';
      }
      return 'on';
    } catch (e) {
      reportFailure('notify.permission', e, { stage: 'native' });
      return 'on'; // unknown is not "off" - see the interface
    }
  }

  async openSettings(): Promise<void> {
    try {
      if (Platform.OS !== 'android') {
        // Notifee's `openNotificationSettings` does nothing on iOS. The app's page in Settings is
        // where its Notifications switch lives.
        await Linking.openSettings();
        return;
      }
      const { authorizationStatus } = await notifee.getNotificationSettings();
      const appAllowed = authorizationStatus >= AuthorizationStatus.AUTHORIZED;
      // The channel's page only when the app itself is allowed. With the app switched off, its own
      // page is the one holding the switch that matters; the channel follows once it is on.
      const channelOnly =
        appAllowed && (await notifee.isChannelBlocked(CHANNEL_REMINDERS));
      await notifee.openNotificationSettings(
        channelOnly ? CHANNEL_REMINDERS : undefined,
      );
    } catch (e) {
      reportFailure('notify.permission', e, { stage: 'native' });
    }
  }

  async scheduleReminder(input: ScheduleReminderInput): Promise<void> {
    try {
      await ensurePlatform();
      const ids = reminderNotificationIds(input.boxId, input.messageId);
      // Replace rather than add: creating a trigger with an existing id overwrites it, which is what
      // makes rescheduling "cancel both, create both" and re-arming on launch safe to repeat.
      await this.cancelReminder(input.boxId, input.messageId);
      await this.create(ids.dayBefore, input, input.timers.dayBefore, true);
      await this.create(ids.onDay, input, input.timers.onDay, false);
    } catch (e) {
      // A reminder the user deliberately set, which then never fires, is this feature failing
      // completely - and it fails by ABSENCE, so nobody notices and nobody reports it. Notifications
      // switched off is the exception: the reminder chip already says alerts are off.
      if (!isNotificationsNotAllowed(e)) {
        reportFailure('notify.schedule', e, { stage: 'native' });
      }
      // Best-effort: the chip is the reminder, this is the announcement (FR-006).
    }
  }

  async cancelReminder(boxId: string, messageId: string): Promise<void> {
    try {
      const ids = reminderNotificationIds(boxId, messageId);
      await notifee.cancelTriggerNotification(ids.dayBefore).catch(() => {});
      await notifee.cancelTriggerNotification(ids.onDay).catch(() => {});
    } catch (e) {
      // idempotent by contract - nothing scheduled is a success. A cancel that genuinely FAILS is
      // different: the user turned a reminder off and it will still go off.
      reportFailure('notify.cancel', e, { stage: 'native' });
    }
  }

  async syncPasswordNudges(nudges: PasswordNudge[]): Promise<void> {
    try {
      await ensurePlatform();
      const wanted = new Set<string>();
      for (const nudge of nudges) {
        const ids = passwordNudgeIds(nudge.boxId);
        if (nudge.timers.weekBefore != null) {
          wanted.add(ids.weekBefore);
        }
        if (nudge.timers.dayBefore != null) {
          wanted.add(ids.dayBefore);
        }
      }
      // A removed box, a box whose date moved past a moment, or a password changed: whatever was
      // scheduled and is no longer wanted goes first.
      const scheduled = await notifee.getTriggerNotificationIds();
      for (const id of scheduled) {
        if (id.startsWith(PASSWORD_NUDGE_PREFIX) && !wanted.has(id)) {
          await notifee.cancelTriggerNotification(id).catch(() => {});
        }
      }
      // Nothing to create until notifications are allowed: iOS refuses every one, and "not answered
      // yet" counts - a sync that ran while the permission dialog was still open is what Sentry caught
      // on build 5. The shell syncs again when the person allows them.
      const { authorizationStatus } = await notifee.getNotificationSettings();
      if (authorizationStatus < AuthorizationStatus.AUTHORIZED) {
        return;
      }
      for (const nudge of nudges) {
        const ids = passwordNudgeIds(nudge.boxId);
        await this.createNudge(ids.weekBefore, nudge, nudge.timers.weekBefore);
        await this.createNudge(ids.dayBefore, nudge, nudge.timers.dayBefore);
      }
    } catch (e) {
      // The only warning that reaches someone who does not open the app in the fortnight the strip
      // shows; a failure is silent, which is why it is reported - unless it is notifications being off.
      if (!isNotificationsNotAllowed(e)) {
        reportFailure('notify.schedule', e, { stage: 'native' });
      }
    }
  }

  private async createNudge(
    id: string,
    nudge: PasswordNudge,
    timestamp: number | null,
  ): Promise<void> {
    if (timestamp == null) {
      return;
    }
    // Creating with an existing id replaces it, so a moved date moves the notification.
    await notifee.createTriggerNotification(
      {
        id,
        // Generic - this is what a lock screen may show.
        title: t('notif.password.title'),
        // Identifying - the part an OS set to hide previews leaves out.
        body: t('notif.password.body', {
          box: nudge.boxName,
          date: formatExpiryDate(nudge.expiresAt),
        }),
        // `action` tells the tap where to go: the change screen, not a message (030 US3.2).
        data: { boxId: nudge.boxId, action: 'password' },
        android: {
          channelId: CHANNEL_PASSWORD,
          smallIcon: 'ic_notification',
          color: ACCENT,
          visibility: AndroidVisibility.PRIVATE,
          pressAction: { id: 'default', launchActivity: 'default' },
        },
        ios: { categoryId: CATEGORY_REDACTED },
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp,
        // NO `alarmManager` - see the header.
      },
    );
  }

  private async create(
    id: string,
    input: ScheduleReminderInput,
    timestamp: number | null,
    isDayBefore: boolean,
  ): Promise<void> {
    if (timestamp == null) {
      return; // the moment has passed; a chip with no pending timer is the correct degradation
    }
    await notifee.createTriggerNotification(
      {
        id,
        // Generic - this is what a lock screen may show.
        title: t(isDayBefore ? 'notif.reminder.tomorrow' : 'notif.reminder.today'),
        // Identifying - this is the part an OS set to hide previews leaves out.
        body: input.subject ?? t('messages.noSubject'),
        data: { boxId: input.boxId, messageId: input.messageId },
        android: {
          channelId: CHANNEL_REMINDERS,
          smallIcon: 'ic_notification',
          color: ACCENT,
          visibility: AndroidVisibility.PRIVATE,
          // `launchActivity` is what makes this work when the app is NOT running. With `id` alone,
          // the press is delivered as an event to a live JS runtime - fine while the app sits in the
          // background, and nothing at all once the process is gone: the notification is dismissed
          // and no app opens. Measured on the emulator (`am kill`, then tap), which is the state a
          // reminder normally fires in: hours after the user last touched the app.
          pressAction: { id: 'default', launchActivity: 'default' },
        },
        ios: { categoryId: CATEGORY_REDACTED },
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp,
        // NO `alarmManager` - see the header. WorkManager is approximate and permission-free.
      },
    );
  }
}
