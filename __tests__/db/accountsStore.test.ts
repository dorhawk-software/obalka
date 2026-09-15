import {
  DuplicateBoxError,
  InMemoryAccountsStore,
} from '../../src/services/db/accountsStore';
import type { DataBoxAccount } from '../../src/services/isds/types';

function account(boxId: string, createdAt: number): DataBoxAccount {
  return {
    id: `id-${boxId}`,
    boxId,
    loginName: `login-${boxId}`,
    label: `Box ${boxId}`,
    dbType: null,
    alias: null,
    authMethod: 'password',
    host: 'czebox',
    secretRef: `kc:${boxId}`,
    sessionValidUntil: null,
    passwordExpiresAt: null,
    lastSyncedAt: null,
    messageCount: null,
    unreadCount: null,
    pdzCreditCzk: null,
    syncError: null,
    createdAt,
    updatedAt: createdAt,
  };
}

describe('InMemoryAccountsStore', () => {
  it('adds and lists accounts ordered by createdAt', async () => {
    const store = new InMemoryAccountsStore();
    await store.add(account('b2', 200));
    await store.add(account('b1', 100));
    expect((await store.list()).map(a => a.boxId)).toEqual(['b1', 'b2']);
  });

  it('rejects a duplicate boxId', async () => {
    const store = new InMemoryAccountsStore();
    await store.add(account('b1', 100));
    await expect(store.add(account('b1', 150))).rejects.toBeInstanceOf(
      DuplicateBoxError,
    );
    expect(await store.list()).toHaveLength(1);
  });

  it('makes the first added box active', async () => {
    const store = new InMemoryAccountsStore();
    expect(await store.getActiveBoxId()).toBeNull();
    await store.add(account('b1', 100));
    await store.add(account('b2', 200));
    expect(await store.getActiveBoxId()).toBe('b1');
  });

  it('switches the active box', async () => {
    const store = new InMemoryAccountsStore();
    await store.add(account('b1', 100));
    await store.add(account('b2', 200));
    await store.setActive('b2');
    expect(await store.getActiveBoxId()).toBe('b2');
  });

  it('rejects activating an unknown box', async () => {
    const store = new InMemoryAccountsStore();
    await expect(store.setActive('nope')).rejects.toThrow();
  });

  it('removing the active box reassigns active to a remaining box', async () => {
    const store = new InMemoryAccountsStore();
    await store.add(account('b1', 100));
    await store.add(account('b2', 200));
    await store.setActive('b1');
    await store.remove('b1');
    expect((await store.list()).map(a => a.boxId)).toEqual(['b2']);
    expect(await store.getActiveBoxId()).toBe('b2');
  });

  it('removing the last box clears the active box', async () => {
    const store = new InMemoryAccountsStore();
    await store.add(account('b1', 100));
    await store.remove('b1');
    expect(await store.list()).toHaveLength(0);
    expect(await store.getActiveBoxId()).toBeNull();
  });

  it('decrementUnread lowers the count by one and floors at 0', async () => {
    const store = new InMemoryAccountsStore();
    await store.add(account('b1', 100));
    await store.setSyncResult('b1', 1, 5, 2); // unreadCount = 2
    await store.decrementUnread('b1');
    expect((await store.list())[0].unreadCount).toBe(1);
    await store.decrementUnread('b1');
    await store.decrementUnread('b1'); // already 0 → stays 0, never negative
    expect((await store.list())[0].unreadCount).toBe(0);
  });

  it('decrementUnread is a no-op when the count is null or the box is unknown', async () => {
    const store = new InMemoryAccountsStore();
    await store.add(account('b1', 100)); // unreadCount = null
    await store.decrementUnread('b1');
    await store.decrementUnread('nope');
    expect((await store.list())[0].unreadCount).toBeNull();
  });

  it('setCredit persists the PDZ balance (and can clear it with null)', async () => {
    const store = new InMemoryAccountsStore();
    await store.add(account('b1', 100));
    expect((await store.list())[0].pdzCreditCzk).toBeNull(); // never fetched
    await store.setCredit('b1', 250.5);
    expect((await store.list())[0].pdzCreditCzk).toBe(250.5);
    await store.setCredit('b1', null); // a later refresh couldn't fetch it
    expect((await store.list())[0].pdzCreditCzk).toBeNull();
  });
});
