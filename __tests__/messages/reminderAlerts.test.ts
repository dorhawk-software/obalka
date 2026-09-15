// Whether a reminder will alert, and the offer to turn notifications on (2026-09-24, 010 FR-006).
//
// Until this date the controller asked for permission on a box's first reminder and ignored the
// answer, and nothing could read the state afterwards. A refused permission, a switch turned off in
// the system settings, or a blocked reminders channel all left a reminder that would never alert,
// beside a sheet that promised it would. The reminder itself staying useful without the notification
// is FR-006 and is asserted at the bottom: that part must not change.

import { RemindersController } from '../../src/features/messages/state/remindersController';
import { InMemoryRemindersStore } from '../../src/services/db/remindersStore';
import { InMemoryNotifier } from '../../src/services/notifications/notifications';

const NOW = new Date(2026, 8, 24, 9).getTime();
const DATE = new Date(2026, 9, 1).getTime();

const make = () => {
  const store = new InMemoryRemindersStore();
  const notifier = new InMemoryNotifier();
  return {
    store,
    notifier,
    c: new RemindersController({ store, notifier, now: () => NOW }),
  };
};

describe('what a reminder on a box will do', () => {
  it('alerts when notifications are on', async () => {
    const { c, store } = make();
    await store.set({ boxId: 'b1', messageId: 'm1', date: DATE, createdBy: 'user', createdAt: NOW });
    expect(await c.alertsFor('b1')).toBe('on');
  });

  it('is off when they are off and a save would not ask - the box already has a reminder', async () => {
    const { c, store, notifier } = make();
    notifier.access = 'off';
    await store.set({ boxId: 'b1', messageId: 'm1', date: DATE, createdBy: 'user', createdAt: NOW });
    expect(await c.alertsFor('b1')).toBe('off');
  });

  it('is still to be asked on a box with no reminder yet: saving its first one asks the OS', async () => {
    const { c, notifier } = make();
    notifier.access = 'off';
    expect(await c.alertsFor('b1')).toBe('ask');
    notifier.access = 'unasked';
    expect(await c.alertsFor('b1')).toBe('ask');
  });

  it('reads the state without ever raising the permission dialog', async () => {
    const { c, notifier } = make();
    notifier.access = 'unasked';
    const ask = jest.spyOn(notifier, 'requestPermission');
    await c.alertsFor('b1');
    expect(ask).not.toHaveBeenCalled();
  });

  it('reads as on when the state cannot be read - silence is a claim it cannot back', async () => {
    const { c, notifier } = make();
    notifier.notificationAccess = () => Promise.reject(new Error('native module gone'));
    await expect(c.alertsFor('b1')).resolves.toBe('on');
  });
});

describe('turning notifications on from a reminder', () => {
  it('asks the OS while it still can', async () => {
    const { c, notifier } = make();
    notifier.access = 'unasked';
    const ask = jest.spyOn(notifier, 'requestPermission');
    await c.turnOnAlerts();
    expect(ask).toHaveBeenCalledTimes(1);
    expect(notifier.settingsOpened).toBe(0);
  });

  it('opens the system settings once the OS has had its answer - it cannot ask twice', async () => {
    const { c, notifier } = make();
    notifier.access = 'off';
    const ask = jest.spyOn(notifier, 'requestPermission');
    await c.turnOnAlerts();
    expect(notifier.settingsOpened).toBe(1);
    expect(ask).not.toHaveBeenCalled();
  });

  it('does nothing when they are already on', async () => {
    const { c, notifier } = make();
    const ask = jest.spyOn(notifier, 'requestPermission');
    await c.turnOnAlerts();
    expect(ask).not.toHaveBeenCalled();
    expect(notifier.settingsOpened).toBe(0);
  });
});

describe('a reminder with notifications refused (FR-006, unchanged)', () => {
  it('is stored, listed for the chip and the attention group, and still scheduled', async () => {
    const { c, store, notifier } = make();
    notifier.access = 'unasked';
    notifier.permission = false; // the user says no to the dialog the first reminder raises
    await c.setReminder('b1', 'm1', DATE, 'Výzva');

    expect(await c.get('b1', 'm1')).toMatchObject({ date: DATE });
    expect((await c.listForBox('b1')).map(r => r.messageId)).toEqual(['m1']);
    // Still handed to the scheduler, as before: whether the OS shows it is the OS's call.
    expect(notifier.scheduled).toHaveLength(1);
    expect(await store.get('b1', 'm1')).not.toBeNull();
    // And from here on the screens say the alert will not come.
    expect(await c.alertsFor('b1')).toBe('off');
  });
});
