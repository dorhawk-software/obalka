// Reminder persistence (feature 010 US2). Exercised against the in-memory implementation, which is
// the reference the SQLite one must match - the same arrangement `messagesStore` uses.
//
// The contract that matters most here is the crash-safe one (Principle II): a read failure resolves
// to null/[] rather than rejecting, because a reminder that cannot be read must degrade to "no chip"
// and never take the inbox down with it.

import {
  InMemoryRemindersStore,
  type RemindersStore,
} from '../../src/services/db/remindersStore';
import type { Reminder } from '../../src/features/messages/state/reminders';

const NOW = Date.UTC(2026, 7, 17, 9, 0);
const DAY = 24 * 60 * 60 * 1000;

const rem = (over: Partial<Reminder> = {}): Reminder => ({
  boxId: 'b1',
  messageId: 'm1',
  date: NOW + 3 * DAY,
  createdBy: 'user',
  createdAt: NOW,
  ...over,
});

describe('RemindersStore', () => {
  let store: RemindersStore;
  beforeEach(() => {
    store = new InMemoryRemindersStore();
  });

  it('stores and reads back a reminder', async () => {
    await store.set(rem());
    expect(await store.get('b1', 'm1')).toEqual(rem());
  });

  it('REPLACES rather than accumulating - one reminder per message', async () => {
    await store.set(rem({ date: NOW + DAY }));
    await store.set(rem({ date: NOW + 9 * DAY }));
    expect((await store.get('b1', 'm1'))?.date).toBe(NOW + 9 * DAY);
    expect(await store.listForBox('b1')).toHaveLength(1);
  });

  it('keys on box AND message, so the same id in two boxes stays separate', async () => {
    await store.set(rem({ boxId: 'b1', date: NOW + DAY }));
    await store.set(rem({ boxId: 'b2', date: NOW + 2 * DAY }));
    expect((await store.get('b1', 'm1'))?.date).toBe(NOW + DAY);
    expect((await store.get('b2', 'm1'))?.date).toBe(NOW + 2 * DAY);
  });

  it('lists only the requested box', async () => {
    await store.set(rem({ boxId: 'b1', messageId: 'a' }));
    await store.set(rem({ boxId: 'b1', messageId: 'b' }));
    await store.set(rem({ boxId: 'b2', messageId: 'c' }));
    expect((await store.listForBox('b1')).map(r => r.messageId).sort()).toEqual([
      'a',
      'b',
    ]);
  });

  it('removal is idempotent - the UI may retry, and a double tap must not fail', async () => {
    await store.set(rem());
    await store.remove('b1', 'm1');
    await expect(store.remove('b1', 'm1')).resolves.toBeUndefined();
    expect(await store.get('b1', 'm1')).toBeNull();
  });

  it('removing an absent reminder is a no-op, not an error', async () => {
    await expect(store.remove('b1', 'never-existed')).resolves.toBeUndefined();
  });

  it('clearBox drops that box only', async () => {
    await store.set(rem({ boxId: 'b1' }));
    await store.set(rem({ boxId: 'b2' }));
    await store.clearBox('b1');
    expect(await store.listForBox('b1')).toEqual([]);
    expect(await store.listForBox('b2')).toHaveLength(1);
  });

  it('returns null / [] for an unknown box rather than throwing', async () => {
    expect(await store.get('nope', 'nope')).toBeNull();
    expect(await store.listForBox('nope')).toEqual([]);
  });

  it('carries createdBy through, so cycle 2 can tell a scan estimate from a user date', async () => {
    await store.set(rem({ createdBy: 'scan' }));
    expect((await store.get('b1', 'm1'))?.createdBy).toBe('scan');
  });
});
