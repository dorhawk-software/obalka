// The demo archive (031 I31.1): the screenshots' and the walks' data. It must never reach a real box,
// and its switches must never be pushed on - a pushed `DEMO_DATA` seeds invented mail on the next dev
// run, and a pushed probe makes every message in a dev build open slowly or not at all.

import {
  DEMO_ACCOUNTS,
  DEMO_DATA,
  DEMO_DETAIL_PROBE,
  DEMO_SENT,
  demoDetailProbe,
  missingDemo,
  seedMode,
} from '../../src/dev/demoData';
import { MESSAGE_STATE } from '../../src/features/messages/state/messageState';

describe('the demo switches', () => {
  it('are committed off', () => {
    expect(DEMO_DATA).toBe(false);
    expect(DEMO_DETAIL_PROBE).toBeNull();
  });
});

describe('the seed', () => {
  it('writes the whole archive on an empty phone', () => {
    expect(seedMode([])).toBe('fresh');
  });

  it('tops up a phone that holds only the demo boxes', () => {
    expect(seedMode(DEMO_ACCOUNTS)).toBe('topUp');
    expect(seedMode(DEMO_ACCOUNTS.slice(0, 1))).toBe('topUp');
  });

  it('refuses a phone with any other box, demo boxes beside it or not', () => {
    expect(seedMode([{ id: 'acc-real' }])).toBe('refuse');
    expect(seedMode([...DEMO_ACCOUNTS, { id: 'acc-real' }])).toBe('refuse');
  });

  it('adds only the messages a box does not hold, by ID', () => {
    const all = Object.values(DEMO_SENT).flat();
    const held = new Set(all.slice(0, 2).map(e => e.id));
    expect(missingDemo(held, all).map(e => e.id)).toEqual(all.slice(2).map(e => e.id));
  });

  it('holds a sent message at each end the slip draws', () => {
    const states = new Set(Object.values(DEMO_SENT).flat().map(e => e.state));
    for (const state of [MESSAGE_STATE.delivered, MESSAGE_STATE.servedByFiction, MESSAGE_STATE.undeliverable]) {
      expect(states).toContain(state);
    }
  });
});

describe('the detail probe', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('does nothing, at once, unless a dev build seeding demo has one set', async () => {
    await expect(demoDetailProbe('missing', false)).resolves.toBe(false);
    await expect(demoDetailProbe(null, true)).resolves.toBe(false);
  });

  it('holds the read, then finds the message missing or there', async () => {
    for (const [probe, missing] of [
      ['missing', true],
      ['slow', false],
    ] as const) {
      let settled: boolean | null = null;
      void demoDetailProbe(probe, true).then(found => {
        settled = found;
      });
      await jest.advanceTimersByTimeAsync(3_999);
      expect(settled).toBeNull();
      await jest.advanceTimersByTimeAsync(1);
      expect(settled).toBe(missing);
    }
  });
});
