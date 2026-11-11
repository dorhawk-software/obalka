// Reminder scheduling on the device notifier (feature 010 US2).
//
// The most important assertion in this file is a NEGATIVE: `createTriggerNotification` is never
// called with an `alarmManager` option. That option is one autocomplete away and it is the line
// between a reminder and `SCHEDULE_EXACT_ALARM`, a permission Google restricts to alarm-clock and
// calendar apps. Nothing else here would catch it - the feature would work perfectly and the app
// would simply be asking for something it has no business asking for.

import notifee from '@notifee/react-native';
import { Linking, Platform } from 'react-native';
import {
  NotifeeNotifier,
  isNotificationsNotAllowed,
} from '../../src/services/notifications/notifeeNotifier';
import { reportFailure } from '../../src/services/telemetry/telemetry';
import { reminderNotificationIds } from '../../src/features/messages/state/reminders';
import type {
  PasswordNudge,
  ScheduleReminderInput,
} from '../../src/services/notifications/notifications';
import { passwordNudgeIds } from '../../src/features/accounts/state/passwordNudge';

jest.mock('../../src/services/telemetry/telemetry', () => ({
  reportFailure: jest.fn(),
}));

const create = notifee.createTriggerNotification as jest.Mock;
const cancel = notifee.cancelTriggerNotification as jest.Mock;
const createChannel = notifee.createChannel as jest.Mock;
const deleteChannel = notifee.deleteChannel as jest.Mock;

const NOW = Date.UTC(2026, 7, 17, 9, 0);
const DAY = 24 * 60 * 60 * 1000;

const input = (over: Partial<ScheduleReminderInput> = {}): ScheduleReminderInput => ({
  boxId: 'b1',
  messageId: 'm1',
  subject: 'Výzva k doložení příjmů',
  timers: { dayBefore: NOW + 6 * DAY, onDay: NOW + 7 * DAY },
  ...over,
});

describe('NotifeeNotifier - reminders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'android';
  });

  it('NEVER passes alarmManager - that would demand SCHEDULE_EXACT_ALARM', async () => {
    await new NotifeeNotifier().scheduleReminder(input());
    expect(create).toHaveBeenCalledTimes(2);
    for (const [, trigger] of create.mock.calls) {
      expect(trigger).not.toHaveProperty('alarmManager');
      expect(trigger.type).toBe(0); // TriggerType.TIMESTAMP
    }
  });

  it('can LAUNCH the app, not merely notify a running one', async () => {
    // A reminder fires hours after the user last touched the app, so the process is usually gone.
    // With `pressAction.id` alone, notifee delivers a press event to a live JS runtime and does
    // nothing when there is none: on the emulator the notification was dismissed and no app opened.
    // `launchActivity` is the half that starts it. Both are needed - the id routes the payload, the
    // activity provides something to route it into.
    await new NotifeeNotifier().scheduleReminder(input());
    for (const [notification] of create.mock.calls) {
      expect(notification.android.pressAction).toEqual({
        id: 'default',
        launchActivity: 'default',
      });
      // And the payload the launched app reads to find the message.
      expect(notification.data).toEqual({ boxId: 'b1', messageId: 'm1' });
    }
  });

  it('schedules both timers under the deterministic ids', async () => {
    await new NotifeeNotifier().scheduleReminder(input());
    const ids = reminderNotificationIds('b1', 'm1');
    expect(create.mock.calls.map(([n]) => n.id)).toEqual([
      ids.dayBefore,
      ids.onDay,
    ]);
    expect(create.mock.calls.map(([, tr]) => tr.timestamp)).toEqual([
      NOW + 6 * DAY,
      NOW + 7 * DAY,
    ]);
  });

  it('skips a timer whose moment has passed', async () => {
    // A reminder set for today after 09:00: nothing to schedule, but the chip still stands.
    await new NotifeeNotifier().scheduleReminder(
      input({ timers: { dayBefore: null, onDay: null } }),
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('cancels before creating, so rescheduling replaces rather than duplicates', async () => {
    await new NotifeeNotifier().scheduleReminder(input());
    expect(cancel).toHaveBeenCalledTimes(2);
    expect(cancel.mock.invocationCallOrder[0]).toBeLessThan(
      create.mock.invocationCallOrder[0],
    );
  });

  it('cancelReminder cancels both ids and is safe when nothing was scheduled', async () => {
    const ids = reminderNotificationIds('b1', 'm1');
    await expect(
      new NotifeeNotifier().cancelReminder('b1', 'm1'),
    ).resolves.toBeUndefined();
    expect(cancel.mock.calls.map(([id]) => id)).toEqual([
      ids.dayBefore,
      ids.onDay,
    ]);
  });

  it('keeps the subject OUT of the title and in the body', async () => {
    // The title is what survives on a lock screen set to hide previews; it must stay generic.
    await new NotifeeNotifier().scheduleReminder(input());
    for (const [n] of create.mock.calls) {
      expect(n.title).not.toContain('Výzva');
      expect(n.body).toBe('Výzva k doložení příjmů');
      expect(n.android.visibility).toBe(0); // PRIVATE
      expect(n.ios.categoryId).toBe('redacted');
      expect(n.data).toEqual({ boxId: 'b1', messageId: 'm1' });
    }
  });

  it('does not throw when scheduling fails - the chip is the reminder', async () => {
    create.mockRejectedValueOnce(new Error('no native module'));
    await expect(
      new NotifeeNotifier().scheduleReminder(input()),
    ).resolves.toBeUndefined();
  });

  it('creates its two channels and deletes the retired ones', async () => {
    await new NotifeeNotifier().scheduleReminder(input());
    // Reminders the person set, and the password-expiry nudge (030) - switchable apart in the OS.
    expect(createChannel.mock.calls.map(([c]) => c.id)).toEqual(['reminders', 'password']);
    // An orphan channel keeps offering a switch in OS settings that nothing can send to.
    expect(deleteChannel.mock.calls.map(([id]) => id)).toEqual([
      'sync',
      'messages',
      'receipts',
      'alerts',
    ]);
  });

  it('registers the hidden-preview category on iOS and creates no channel', async () => {
    Platform.OS = 'ios';
    await new NotifeeNotifier().scheduleReminder(input());
    expect(createChannel).not.toHaveBeenCalled();
    expect(notifee.setNotificationCategories).toHaveBeenCalled();
  });
});

// Reading the permission and offering the way back (2026-09-24, 010 FR-006 amendment). The read runs
// every time a reminder is on screen, so the one thing it must never do is ask.
describe('NotifeeNotifier - notification state', () => {
  const settings = notifee.getNotificationSettings as jest.Mock;
  const blocked = notifee.isChannelBlocked as jest.Mock;
  const openNotificationSettings = notifee.openNotificationSettings as jest.Mock;
  const request = notifee.requestPermission as jest.Mock;
  const status = (authorizationStatus: number) =>
    settings.mockResolvedValue({ authorizationStatus });

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'android';
    status(1);
    blocked.mockResolvedValue(false);
  });

  it.each([
    ['never answered (iOS)', 'unasked', -1],
    ['refused', 'off', 0],
    ['allowed', 'on', 1],
    ['allowed provisionally (iOS)', 'on', 2],
  ])('reads %s as %s', async (_label, expected, authorizationStatus) => {
    status(authorizationStatus as number);
    expect(await new NotifeeNotifier().notificationAccess()).toBe(expected);
  });

  it('reads a blocked reminders channel as off, even with the app allowed (Android)', async () => {
    blocked.mockResolvedValue(true);
    expect(await new NotifeeNotifier().notificationAccess()).toBe('off');
    expect(blocked).toHaveBeenCalledWith('reminders');
  });

  it('never asks while reading', async () => {
    status(-1);
    await new NotifeeNotifier().notificationAccess();
    expect(request).not.toHaveBeenCalled();
  });

  it('reads as on when the state cannot be read', async () => {
    settings.mockRejectedValueOnce(new Error('no native module'));
    await expect(new NotifeeNotifier().notificationAccess()).resolves.toBe('on');
  });

  it("opens the app's notification settings on Android when the app is switched off", async () => {
    status(0);
    await new NotifeeNotifier().openSettings();
    expect(openNotificationSettings).toHaveBeenCalledWith(undefined);
  });

  it("opens the reminders channel's own page when that channel is the only thing off", async () => {
    blocked.mockResolvedValue(true);
    await new NotifeeNotifier().openSettings();
    expect(openNotificationSettings).toHaveBeenCalledWith('reminders');
  });

  it("opens the app's page in Settings on iOS, where Notifee's call does nothing", async () => {
    Platform.OS = 'ios';
    const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    try {
      await new NotifeeNotifier().openSettings();
      expect(open).toHaveBeenCalledTimes(1);
      expect(openNotificationSettings).not.toHaveBeenCalled();
    } finally {
      open.mockRestore();
    }
  });

  it('does not throw when the settings cannot be opened', async () => {
    openNotificationSettings.mockRejectedValueOnce(new Error('no activity'));
    await expect(new NotifeeNotifier().openSettings()).resolves.toBeUndefined();
  });
});

// 030 US3: the password-expiry nudge.
describe('NotifeeNotifier - password nudges', () => {
  const getIds = notifee.getTriggerNotificationIds as jest.Mock;
  const nudge = (over: Partial<PasswordNudge> = {}): PasswordNudge => ({
    boxId: 'b1',
    boxName: 'Živnost',
    expiresAt: new Date(2027, 1, 9, 9, 49).getTime(),
    timers: { weekBefore: NOW + DAY, dayBefore: NOW + 7 * DAY },
    ...over,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'android';
    getIds.mockResolvedValue([]);
    (notifee.getNotificationSettings as jest.Mock).mockResolvedValue({ authorizationStatus: 1 });
  });

  it('schedules both moments on the password channel, with the box and the date in the body', async () => {
    await new NotifeeNotifier().syncPasswordNudges([nudge()]);
    expect(create).toHaveBeenCalledTimes(2);
    const ids = passwordNudgeIds('b1');
    expect(create.mock.calls.map(([n]) => n.id)).toEqual([ids.weekBefore, ids.dayBefore]);
    for (const [n, trigger] of create.mock.calls) {
      expect(n.android.channelId).toBe('password');
      expect(n.android.pressAction).toEqual({ id: 'default', launchActivity: 'default' });
      expect(n.data).toEqual({ boxId: 'b1', action: 'password' });
      expect(n.title).not.toContain('Živnost'); // the lock screen may show the title
      expect(n.body).toContain('Živnost');
      expect(n.body).toContain('9.\u00A02.\u00A02027');
      expect(trigger).not.toHaveProperty('alarmManager');
    }
  });

  it('skips a moment that has passed', async () => {
    await new NotifeeNotifier().syncPasswordNudges([
      nudge({ timers: { weekBefore: null, dayBefore: NOW + DAY } }),
    ]);
    expect(create.mock.calls.map(([n]) => n.id)).toEqual([passwordNudgeIds('b1').dayBefore]);
  });

  it('cancels the nudges of a box that is gone or no longer due, and leaves reminders alone', async () => {
    const gone = passwordNudgeIds('b2');
    const kept = passwordNudgeIds('b1');
    const reminder = reminderNotificationIds('b2', 'm1').onDay;
    getIds.mockResolvedValue([gone.weekBefore, gone.dayBefore, kept.weekBefore, reminder]);
    await new NotifeeNotifier().syncPasswordNudges([
      nudge({ timers: { weekBefore: null, dayBefore: NOW + DAY } }),
    ]);
    expect(cancel.mock.calls.map(([id]) => id).sort()).toEqual(
      [gone.weekBefore, gone.dayBefore, kept.weekBefore].sort(),
    );
  });

  it('never rejects', async () => {
    getIds.mockRejectedValueOnce(new Error('native'));
    await expect(new NotifeeNotifier().syncPasswordNudges([nudge()])).resolves.toBeUndefined();
  });

  it.each([
    ['declined', 0],
    ['never asked', -1],
  ])('creates nothing while notifications are %s - and still cancels what is no longer wanted', async (_, status) => {
    Platform.OS = 'ios';
    (notifee.getNotificationSettings as jest.Mock).mockResolvedValue({ authorizationStatus: status });
    const gone = passwordNudgeIds('b2');
    getIds.mockResolvedValue([gone.weekBefore]);
    await new NotifeeNotifier().syncPasswordNudges([nudge()]);
    expect(create).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledWith(gone.weekBefore);
    expect(reportFailure).not.toHaveBeenCalled();
  });

  it('does not report iOS refusing a notification the app may not show (Sentry, build 5)', async () => {
    create.mockRejectedValueOnce(
      new Error('Repository could not save notification. Source is not authorized.'),
    );
    await new NotifeeNotifier().syncPasswordNudges([nudge()]);
    expect(reportFailure).not.toHaveBeenCalled();
  });

  it('still reports any other failure to schedule', async () => {
    create.mockRejectedValueOnce(new Error('native'));
    await new NotifeeNotifier().syncPasswordNudges([nudge()]);
    expect(reportFailure).toHaveBeenCalledWith('notify.schedule', expect.any(Error), {
      stage: 'native',
    });
  });
});

describe('what counts as notifications being switched off', () => {
  it.each([
    ['Repository could not save notification. Source is not authorized.', true],
    ['Notifications are not allowed for this application', true],
    ['UNErrorCodeNotificationsNotAllowed', true],
    ['native', false],
    ['Invalid trigger timestamp', false],
  ])('%p → %p', (message, off) => {
    expect(isNotificationsNotAllowed(new Error(message))).toBe(off);
  });
});
