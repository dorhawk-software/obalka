// The aggregate behind "in your other boxes".
//
// Written against the case that prompted it: a production box holding an unread message whose
// session had expired, invisible from the box the user was actually looking at.

import {
  compareBoxAttention,
  countInFlight,
  crossBoxAttention,
  NOTHING_IN_FLIGHT,
  type BoxAttention,
  type CrossBoxDeps,
} from '../../src/features/messages/state/crossBox';
import type { DataBoxAccount, MessageEnvelope } from '../../src/services/isds/types';
import type { Reminder } from '../../src/features/messages/state/reminders';

const NOW = Date.UTC(2026, 8, 10, 9, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

const account = (boxId: string, over: Partial<DataBoxAccount> = {}): DataBoxAccount =>
  ({
    id: boxId,
    boxId,
    loginName: 'user',
    label: `Box ${boxId}`,
    dbType: null,
    alias: null,
    authMethod: 'password',
    host: 'czebox',
    secretRef: 'ref',
    sessionValidUntil: null,
    passwordExpiresAt: null,
    lastSyncedAt: null,
    messageCount: null,
    unreadCount: null,
    pdzCreditCzk: null,
    syncError: null,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  }) as DataBoxAccount;

/** A received envelope in state 4 (dodána, not yet served) - the only state with a fiction clock. */
const envelope = (id: string, over: Partial<MessageEnvelope> = {}): MessageEnvelope =>
  ({
    id,
    boxId: 'b',
    sender: 'Finanční úřad',
    recipient: null,
    subject: 'Výzva',
    deliveryTime: NOW - 6 * DAY,
    acceptanceTime: null,
    state: 4,
    ...over,
  }) as MessageEnvelope;

const reminder = (messageId: string, date: number): Reminder =>
  ({
    boxId: 'b',
    messageId,
    date,
    subject: 'x',
    createdBy: 'user',
    createdAt: 0,
  }) as Reminder;

const deps = (
  envelopes: Record<string, readonly MessageEnvelope[]> = {},
  reminders: Record<string, readonly Reminder[]> = {},
): CrossBoxDeps => ({
  cachedEnvelopes: async boxId => envelopes[boxId] ?? [],
  reminders: async boxId => reminders[boxId] ?? [],
});

describe('which boxes get a row', () => {
  it('leaves out the box already on screen', async () => {
    const rows = await crossBoxAttention(
      [account('open', { unreadCount: 5 }), account('other', { unreadCount: 1 })],
      'open',
      deps(),
      NOW,
    );
    expect(rows.map(r => r.boxId)).toEqual(['other']);
  });

  it('leaves out boxes with nothing to say', async () => {
    // The card must be able to disappear entirely. A permanent "nothing to report" panel is chrome.
    const rows = await crossBoxAttention(
      [account('quiet'), account('quiet2', { unreadCount: 0 })],
      null,
      deps(),
      NOW,
    );
    expect(rows).toEqual([]);
  });

  it('includes a box whose ONLY news is that it stopped syncing', async () => {
    const rows = await crossBoxAttention([account('broken', { syncError: 'reauth' })], null, deps(), NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0].syncError).toBe('reauth');
    expect(rows[0].stale).toBe(true);
  });

  it('summarises every box when nothing is excluded', async () => {
    const rows = await crossBoxAttention(
      [account('a', { unreadCount: 1 }), account('b', { unreadCount: 2 })],
      null,
      deps(),
      NOW,
    );
    expect(rows).toHaveLength(2);
  });
});

describe('the case this was built for', () => {
  it('reports the last known unread count for a box we can no longer reach', async () => {
    // Exactly the reported situation: unread mail sitting in a box whose session expired. Hiding
    // the count would hide the thing the card exists to surface.
    const rows = await crossBoxAttention(
      [account('podnikajici', { unreadCount: 1, syncError: 'reauth', label: 'Podnikající FO' })],
      null,
      deps(),
      NOW,
    );
    expect(rows[0]).toMatchObject({ name: 'Podnikající FO', unread: 1, stale: true });
  });

  it('prefers the box alias, the way every other surface does', async () => {
    const rows = await crossBoxAttention(
      [account('a', { unreadCount: 1, label: 'Owner', alias: 'Firma' })],
      null,
      deps(),
      NOW,
    );
    expect(rows[0].name).toBe('Firma');
  });
});

describe('the soonest deadline', () => {
  it('finds a user reminder and dates it', async () => {
    const rows = await crossBoxAttention(
      [account('a')],
      null,
      deps({ a: [envelope('m1')] }, { a: [reminder('m1', NOW + 3 * DAY)] }),
      NOW,
    );
    expect(rows[0].soonest).toMatchObject({ reason: 'reminder', daysRemaining: 3 });
  });

  it('keeps the NEAREST of several', async () => {
    const rows = await crossBoxAttention(
      [account('a')],
      null,
      deps(
        { a: [envelope('m1'), envelope('m2')] },
        { a: [reminder('m1', NOW + 9 * DAY), reminder('m2', NOW + 2 * DAY)] },
      ),
      NOW,
    );
    expect(rows[0].soonest?.daysRemaining).toBe(2);
  });

  it('reports an overdue one as negative rather than dropping it', async () => {
    const rows = await crossBoxAttention(
      [account('a')],
      null,
      deps({ a: [envelope('m1')] }, { a: [reminder('m1', NOW - 2 * DAY)] }),
      NOW,
    );
    expect(rows[0].soonest?.daysRemaining).toBeLessThan(0);
  });

  it('keeps every deadline, soonest first, so a missed one cannot hide the next', async () => {
    // `soonest` is the missed one, which is right for ordering. Read alone it would have the line
    // report some other box's deadline as the next one, days later than this box's tomorrow. Dates
    // rather than day counts, because the line counts them with the clock it is drawn with.
    const rows = await crossBoxAttention(
      [account('a')],
      null,
      deps(
        { a: [envelope('m1'), envelope('m2'), envelope('m3')] },
        {
          a: [
            reminder('m1', NOW - 2 * DAY),
            reminder('m2', NOW + 4 * DAY),
            reminder('m3', NOW + DAY),
          ],
        },
      ),
      NOW,
    );
    expect(rows[0].soonest?.daysRemaining).toBe(-2);
    expect(rows[0].deadlines).toEqual([NOW - 2 * DAY, NOW + DAY, NOW + 4 * DAY]);
  });

  it('keeps missed deadlines one by one, not one per box', async () => {
    const rows = await crossBoxAttention(
      [account('a')],
      null,
      deps(
        { a: [envelope('m1'), envelope('m2')] },
        { a: [reminder('m1', NOW - DAY), reminder('m2', NOW - 5 * DAY)] },
      ),
      NOW,
    );
    expect(rows[0].deadlines).toEqual([NOW - 5 * DAY, NOW - DAY]);
  });

  it('counts an accepted scan estimate as a deadline too', async () => {
    const rows = await crossBoxAttention(
      [account('a')],
      null,
      deps(
        { a: [envelope('m1')] },
        { a: [{ ...reminder('m1', NOW + 3 * DAY), createdBy: 'scan' } as Reminder] },
      ),
      NOW,
    );
    expect(rows[0].soonest).toMatchObject({ reason: 'estimate', daysRemaining: 3 });
    expect(rows[0].deadlines).toEqual([NOW + 3 * DAY]);
  });

  it('is null when the box has only unread mail', async () => {
    const rows = await crossBoxAttention(
      [account('a', { unreadCount: 2 })],
      null,
      deps({ a: [envelope('m1', { state: 6 })] }),
      NOW,
    );
    expect(rows[0].soonest).toBeNull();
    expect(rows[0].unread).toBe(2);
  });
});

describe('resilience', () => {
  it('keeps a box whose cache will not read, with less to say', async () => {
    // Principle II. One unreadable box must not blank the card for the others.
    const broken: CrossBoxDeps = {
      cachedEnvelopes: async boxId => {
        if (boxId === 'bad') {
          throw new Error('db locked');
        }
        return [];
      },
      reminders: async () => [],
    };
    const rows = await crossBoxAttention(
      [account('bad', { unreadCount: 3 }), account('good', { unreadCount: 1 })],
      null,
      broken,
      NOW,
    );
    expect(rows.map(r => r.boxId)).toEqual(['bad', 'good']);
    expect(rows[0].unread).toBe(3); // from the account record, which never needed the cache
    expect(rows[0].soonest).toBeNull();
  });
});

describe('mail served by fiction', () => {
  /** State 5: nobody signed in for ten days, so the law did. It has no date left to count down. */
  const served = (id: string, over: Partial<MessageEnvelope> = {}) =>
    envelope(id, { state: 5, acceptanceTime: NOW - 2 * DAY, ...over });

  it('is counted, and is never dressed up as a deadline', async () => {
    const rows = await crossBoxAttention(
      [account('a', { unreadCount: 1 })],
      null,
      deps({ a: [served('m1')] }),
      NOW,
    );
    expect(rows[0]).toMatchObject({ fiction: 1, soonest: null, deadlines: [] });
  });

  it('gives a box a row even when that is its only news', async () => {
    const rows = await crossBoxAttention([account('a')], null, deps({ a: [served('m1')] }), NOW);
    expect(rows.map(r => r.boxId)).toEqual(['a']);
  });

  it('still counts one opened here that ISDS has not confirmed as read', async () => {
    // The badge drops a message only once ISDS confirms the read, and that confirmation is also what
    // moves it out of state 5 - so one still in state 5 is still on the badge. Left out here, the
    // sentence would call it plain unread mail, while the box's own attention group, which does not
    // filter fiction by `openedAt`, still says it was served by fiction.
    const rows = await crossBoxAttention(
      [account('a', { unreadCount: 1 })],
      null,
      deps({ a: [served('m1', { openedAt: NOW - DAY })] }),
      NOW,
    );
    expect(rows[0]).toMatchObject({ fiction: 1, unread: 1 });
  });
});

describe('a refresh in flight', () => {
  it('marks a reported box being fetched, and never adds a quiet one', async () => {
    // Constitution V: a row that existed only while a fetch was out would push the date sections
    // down when it started and pull them back up when it ended.
    const rows = await crossBoxAttention(
      [account('a', { unreadCount: 2 }), account('b', { unreadCount: 1 }), account('quiet')],
      null,
      deps(),
      NOW,
      countInFlight(NOTHING_IN_FLIGHT, ['a', 'quiet'], 1),
    );
    expect(rows.map(r => [r.boxId, r.refreshing])).toEqual([
      ['a', true],
      ['b', false],
    ]);
  });

  it('keeps the order the boxes had before the refresh started', async () => {
    const rows = await crossBoxAttention(
      [
        account('beta', { unreadCount: 1, label: 'Beta' }),
        account('alfa', { unreadCount: 1, label: 'Alfa' }),
      ],
      null,
      deps(),
      NOW,
      countInFlight(NOTHING_IN_FLIGHT, ['beta'], 1),
    );
    expect(rows.map(r => [r.name, r.refreshing])).toEqual([
      ['Alfa', false],
      ['Beta', true],
    ]);
  });

  it('keeps a failed box stale while it is retried - its numbers are still a memory', async () => {
    const rows = await crossBoxAttention(
      [account('broken', { unreadCount: 1, syncError: 'error' })],
      null,
      deps(),
      NOW,
      countInFlight(NOTHING_IN_FLIGHT, ['broken'], 1),
    );
    expect(rows[0]).toMatchObject({ refreshing: true, stale: true });
  });
});

describe('countInFlight', () => {
  it('adds the boxes a refresh starts and removes them when it finishes', () => {
    const started = countInFlight(NOTHING_IN_FLIGHT, ['a', 'b'], 1);
    expect([...started.keys()]).toEqual(['a', 'b']);
    // The shared empty value, so a settled refresh does not hand the shell a new identity to react to.
    expect(countInFlight(started, ['a', 'b'], -1)).toBe(NOTHING_IN_FLIGHT);
  });

  it('keeps a box in flight until EVERY overlapping refresh of it has finished', () => {
    // Launch fans out to every box; a pull in `Vše` can start another before the first returns.
    const launch = countInFlight(NOTHING_IN_FLIGHT, ['a', 'b'], 1);
    const pull = countInFlight(launch, ['a'], 1);
    const launchDone = countInFlight(pull, ['a', 'b'], -1);
    expect(launchDone.has('a')).toBe(true);
    expect(launchDone.has('b')).toBe(false);
    expect(countInFlight(launchDone, ['a'], -1).has('a')).toBe(false);
  });

  it('ignores a finish with no matching start instead of going negative', () => {
    const drifted = countInFlight(NOTHING_IN_FLIGHT, ['a'], -1);
    expect(drifted).toBe(NOTHING_IN_FLIGHT);
    // A count left at -1 would have swallowed this start.
    expect(countInFlight(drifted, ['a'], 1).has('a')).toBe(true);
  });

  it('does not change the map it was given', () => {
    const started = countInFlight(NOTHING_IN_FLIGHT, ['a'], 1);
    countInFlight(started, ['a'], -1);
    expect(started.has('a')).toBe(true);
  });
});

describe('order', () => {
  const row = (over: Partial<BoxAttention>): BoxAttention => ({
    boxId: 'x',
    name: 'X',
    unread: 0,
    soonest: null,
    deadlines: [],
    fiction: 0,
    syncError: null,
    stale: false,
    refreshing: false,
    ...over,
  });

  it('puts the nearest deadline first, overdue before that', () => {
    const sorted = [
      row({ name: 'C', soonest: { reason: 'reminder', date: 0, daysRemaining: 5 } }),
      row({ name: 'A', soonest: { reason: 'estimate', date: 0, daysRemaining: -1 } }),
      row({ name: 'B', soonest: { reason: 'reminder', date: 0, daysRemaining: 2 } }),
    ].sort(compareBoxAttention);
    expect(sorted.map(r => r.name)).toEqual(['A', 'B', 'C']);
  });

  it('puts any deadline above any amount of unread', () => {
    const sorted = [
      row({ name: 'lots', unread: 99 }),
      row({ name: 'dated', soonest: { reason: 'reminder', date: 0, daysRemaining: 30 } }),
    ].sort(compareBoxAttention);
    expect(sorted.map(r => r.name)).toEqual(['dated', 'lots']);
  });

  it('puts mail served by fiction below any deadline and above any amount of unread', () => {
    // The attention group's own order: nothing left to hurry for, but the one thing the user could
    // not have seen coming.
    const sorted = [
      row({ name: 'lots', unread: 99 }),
      row({ name: 'served', unread: 1, fiction: 1 }),
      row({ name: 'dated', soonest: { reason: 'reminder', date: 0, daysRemaining: 30 } }),
    ].sort(compareBoxAttention);
    expect(sorted.map(r => r.name)).toEqual(['dated', 'served', 'lots']);
  });

  it('puts a box that merely stopped syncing last', () => {
    const sorted = [
      row({ name: 'broken', syncError: 'reauth' }),
      row({ name: 'unread', unread: 1 }),
    ].sort(compareBoxAttention);
    expect(sorted.map(r => r.name)).toEqual(['unread', 'broken']);
  });

  it('is stable when everything ties', () => {
    const sorted = [row({ name: 'Beta' }), row({ name: 'Alfa' })].sort(compareBoxAttention);
    expect(sorted.map(r => r.name)).toEqual(['Alfa', 'Beta']);
  });
});
