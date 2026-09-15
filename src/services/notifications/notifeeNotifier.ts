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
import type {
  NotificationAccess,
  Notifier,
  ScheduleReminderInput,
} from './notifications';

/** One channel. There is nothing else the app can legitimately notify about. */
const CHANNEL_REMINDERS = 'reminders';
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
  for (const id of RETIRED_CHANNELS) {
    await notifee.deleteChannel(id).catch(() => {});
  }
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
      // completely - and it fails by ABSENCE, so nobody notices and nobody reports it.
      reportFailure('notify.schedule', e, { stage: 'native' });
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
