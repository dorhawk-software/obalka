// Reminder timers and ids (feature 010 US2). Pure - no storage, no OS.
//
// Times here are DEVICE-local by design, which is the opposite of `fikce.ts`. A fikce date is a fact
// about the Czech calendar; a reminder is the user's own note, so "the 22nd" means their 22nd. The
// tests therefore build expectations with `new Date(y, m, d, …)` (local) rather than `Date.UTC`.

import {
  reminderNotificationIds,
  reminderPromise,
  reminderTimers,
} from '../../src/features/messages/state/reminders';
import { RemindersController } from '../../src/features/messages/state/remindersController';
import { InMemoryRemindersStore } from '../../src/services/db/remindersStore';
import { InMemoryNotifier } from '../../src/services/notifications/notifications';

/** 09:00 local on a given local date. */
const at9 = (y: number, m: number, d: number) => new Date(y, m, d, 9).getTime();
/** Midnight local - the shape a stored reminder date takes. */
const day = (y: number, m: number, d: number) => new Date(y, m, d).getTime();

describe('reminderNotificationIds', () => {
  it('is deterministic and stable across calls', () => {
    expect(reminderNotificationIds('b1', 'm1')).toEqual(
      reminderNotificationIds('b1', 'm1'),
    );
  });

  it('separates the two timers, and one message from another', () => {
    const a = reminderNotificationIds('b1', 'm1');
    expect(a.dayBefore).not.toBe(a.onDay);
    expect(a.dayBefore).not.toBe(reminderNotificationIds('b1', 'm2').dayBefore);
    expect(a.dayBefore).not.toBe(reminderNotificationIds('b2', 'm1').dayBefore);
  });
});

describe('reminderTimers', () => {
  it('yields 09:00 local the day before and 09:00 local on the day', () => {
    const t = reminderTimers(day(2026, 7, 22), at9(2026, 7, 17), 'b1', 'm1');
    expect(t.dayBefore).toBe(at9(2026, 7, 21));
    expect(t.onDay).toBe(at9(2026, 7, 22));
  });

  it('drops the day-before timer for a reminder set for tomorrow after 09:00', () => {
    // Set at 14:00 on the 21st for the 22nd: "the day before at 09:00" is already behind us.
    const t = reminderTimers(
      day(2026, 7, 22),
      new Date(2026, 7, 21, 14).getTime(),
      'b1',
      'm1',
    );
    expect(t.dayBefore).toBeNull();
    expect(t.onDay).toBe(at9(2026, 7, 22));
  });

  it('yields no timers at all for today after 09:00 - a chip, and nothing pending', () => {
    const t = reminderTimers(
      day(2026, 7, 17),
      new Date(2026, 7, 17, 11).getTime(),
      'b1',
      'm1',
    );
    expect(t.dayBefore).toBeNull();
    expect(t.onDay).toBeNull();
  });

  it('still fires today when set before 09:00', () => {
    const t = reminderTimers(
      day(2026, 7, 17),
      new Date(2026, 7, 17, 7).getTime(),
      'b1',
      'm1',
    );
    expect(t.onDay).toBe(at9(2026, 7, 17));
  });

  it('crosses a month boundary without arithmetic drift', () => {
    const t = reminderTimers(day(2026, 8, 1), at9(2026, 7, 20), 'b1', 'm1');
    expect(t.dayBefore).toBe(at9(2026, 7, 31));
    expect(t.onDay).toBe(at9(2026, 8, 1));
  });

  it('is crash-safe on a garbled date', () => {
    const t = reminderTimers(Number.NaN, at9(2026, 7, 17), 'b1', 'm1');
    expect(t.dayBefore).toBeNull();
    expect(t.onDay).toBeNull();
    expect(t.ids).toEqual(reminderNotificationIds('b1', 'm1'));
  });
});

describe('RemindersController', () => {
  const NOW = at9(2026, 7, 17);
  const make = () => {
    const store = new InMemoryRemindersStore();
    const notifier = new InMemoryNotifier();
    return {
      store,
      notifier,
      c: new RemindersController({ store, notifier, now: () => NOW }),
    };
  };

  it('writes the reminder and schedules both timers', async () => {
    const { c, store, notifier } = make();
    await c.setReminder('b1', 'm1', day(2026, 7, 22), 'Výzva');
    expect((await store.get('b1', 'm1'))?.date).toBe(day(2026, 7, 22));
    expect(notifier.scheduled).toHaveLength(1);
    expect(notifier.scheduled[0].timers.onDay).toBe(at9(2026, 7, 22));
  });

  it('KEEPS the reminder when scheduling throws - the chip is the reminder', async () => {
    // FR-006: a denied permission or a dead native module must not lose the user's own note.
    const { c, store, notifier } = make();
    notifier.scheduleReminder = () => Promise.reject(new Error('denied'));
    await expect(
      c.setReminder('b1', 'm1', day(2026, 7, 22), 'Výzva'),
    ).resolves.toBeUndefined();
    expect(await store.get('b1', 'm1')).not.toBeNull();
  });

  it('asks for permission on the FIRST reminder only', async () => {
    const { c, notifier } = make();
    const ask = jest.spyOn(notifier, 'requestPermission');
    await c.setReminder('b1', 'm1', day(2026, 7, 22), null);
    await c.setReminder('b1', 'm2', day(2026, 7, 23), null);
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('does NOT ask again when the only reminder is EDITED', async () => {
    // The rule is "the first reminder", not "the box has one reminder". Asked after the write, those
    // read the same - `set` upserts - and the user got the OS dialog on every nudge of a date. Found
    // on the emulator; this is the test that would have found it.
    const { c, notifier } = make();
    const ask = jest.spyOn(notifier, 'requestPermission');
    await c.setReminder('b1', 'm1', day(2026, 7, 22), null);
    await c.setReminder('b1', 'm1', day(2026, 7, 23), null);
    await c.setReminder('b1', 'm1', day(2026, 7, 24), null);
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('asks again for a box that has none yet - permission is per app, the prompt is per box', async () => {
    const { c, notifier } = make();
    const ask = jest.spyOn(notifier, 'requestPermission');
    await c.setReminder('b1', 'm1', day(2026, 7, 22), null);
    await c.setReminder('b2', 'm2', day(2026, 7, 23), null);
    // Harmless in practice: once the user has answered, the OS dialog no longer appears. Asking per
    // box beats threading a global "have we asked yet" flag through the store for a second dialog
    // Android will not show.
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it('cancels before deleting on removal', async () => {
    const { c, store, notifier } = make();
    await c.setReminder('b1', 'm1', day(2026, 7, 22), null);
    await c.removeReminder('b1', 'm1');
    expect(notifier.cancelled).toContainEqual({ boxId: 'b1', messageId: 'm1' });
    expect(await store.get('b1', 'm1')).toBeNull();
  });

  it('clearBox cancels every timer in that box and drops the rows', async () => {
    const { c, store, notifier } = make();
    await c.setReminder('b1', 'm1', day(2026, 7, 22), null);
    await c.setReminder('b1', 'm2', day(2026, 7, 23), null);
    await c.setReminder('b2', 'm3', day(2026, 7, 24), null);
    notifier.cancelled = [];
    await c.clearBox('b1');
    expect(notifier.cancelled.map(x => x.messageId).sort()).toEqual(['m1', 'm2']);
    expect(await store.listForBox('b1')).toEqual([]);
    expect(await store.listForBox('b2')).toHaveLength(1);
  });
});

// The picker promised "den předem a v den termínu" for every date - including the ones the scheduler
// gives one notification or none. `reminderPromise` reads the same rule the scheduler uses, so the
// sentence and the schedule cannot drift apart.
describe('what the picker may promise', () => {
  it('promises both when both will be scheduled', () => {
    expect(reminderPromise(day(2026, 7, 22), at9(2026, 7, 17))).toBe('both');
  });

  it('promises only the day itself when the day-before moment has passed', () => {
    // 14:00 on the 21st, for the 22nd.
    expect(
      reminderPromise(day(2026, 7, 22), new Date(2026, 7, 21, 14).getTime()),
    ).toBe('onDay');
  });

  it('promises nothing for today after 09:00 - the reminder is a chip and no more', () => {
    expect(
      reminderPromise(day(2026, 7, 17), new Date(2026, 7, 17, 11).getTime()),
    ).toBe('none');
  });

  it('describes the feature when no date is chosen yet', () => {
    // The sheet opens before anything is picked; there is no date to be wrong about.
    expect(reminderPromise(null, at9(2026, 7, 17))).toBe('both');
  });

  it('matches the scheduler exactly, across a month of dates and hours', () => {
    // The point of the helper: one rule, two readers. If `reminderTimers` ever changes, this fails
    // rather than the copy quietly becoming a lie again.
    for (let d = 1; d <= 28; d++) {
      for (const hour of [8, 10, 14, 23]) {
        const now = new Date(2026, 7, 17, hour).getTime();
        const date = day(2026, 7, d);
        const timers = reminderTimers(date, now, 'b1', 'm1');
        const expected =
          timers.dayBefore && timers.onDay
            ? 'both'
            : timers.onDay
              ? 'onDay'
              : 'none';
        expect({ d, hour, promise: reminderPromise(date, now) }).toEqual({
          d,
          hour,
          promise: expected,
        });
      }
    }
  });
});
