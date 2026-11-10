// Active-box persistence + fallback chain (feature 011, T020). The persisted `activeBoxId` is the
// last-used box restored on launch; this verifies the read/write roundtrip, the crash-safe degradation
// (garbled/empty/unreadable → null, never throws - Principle II), and the pure resolution chain
// (existing id / stale id → first / zero boxes → null).

// A fake settings store backing readActiveBoxId/writeActiveBoxId, swapped in for the real (native) deps.
const mockStore = new Map<string, string>();
const mockState = { throwOnGet: false };
jest.mock('../../src/features/accounts/deps', () => ({
  settingsStore: {
    getSetting: jest.fn(async (key: string) => {
      if (mockState.throwOnGet) {
        throw new Error('store unavailable');
      }
      return mockStore.has(key) ? mockStore.get(key)! : null;
    }),
    setSetting: jest.fn(async (key: string, value: string) => {
      mockStore.set(key, value);
    }),
  },
}));

import {
  readActiveBoxId,
  resolveActiveBoxId,
  writeActiveBoxId,
  resolveUnified,
  unifiedAvailable,
} from '../../src/features/accounts/state/activeBox';

beforeEach(() => {
  mockStore.clear();
  mockState.throwOnGet = false;
});

describe('resolveActiveBoxId (fallback chain)', () => {
  it('keeps an existing persisted id (last-used restore)', () => {
    expect(resolveActiveBoxId('b2', ['b1', 'b2', 'b3'])).toBe('b2');
  });

  it('falls back to the first box when the persisted id is stale/missing', () => {
    expect(resolveActiveBoxId('gone', ['b1', 'b2'])).toBe('b1');
    expect(resolveActiveBoxId(null, ['b1', 'b2'])).toBe('b1');
  });

  it('resolves to null when there are zero boxes (→ Welcome)', () => {
    expect(resolveActiveBoxId('b1', [])).toBeNull();
    expect(resolveActiveBoxId(null, [])).toBeNull();
  });

  // 025 T027: a phone filled by a transfer opened the first box in the list, not the one the person
  // had open on the phone the boxes came from.
  it('opens the box the backup came from with when this phone has chosen none', () => {
    expect(resolveActiveBoxId(null, ['b1', 'b2', 'b3'], 'b2')).toBe('b2');
    expect(resolveActiveBoxId('gone', ['b1', 'b2', 'b3'], 'b3')).toBe('b3');
  });

  it('never moves a phone off its own choice for that hint', () => {
    expect(resolveActiveBoxId('b1', ['b1', 'b2'], 'b2')).toBe('b1');
  });

  it('ignores a hint naming a box that is not here', () => {
    expect(resolveActiveBoxId(null, ['b1', 'b2'], 'gone')).toBe('b1');
  });
});

describe('readActiveBoxId / writeActiveBoxId', () => {
  it('roundtrips a written id', async () => {
    await writeActiveBoxId('box-42');
    await expect(readActiveBoxId()).resolves.toBe('box-42');
  });

  it('clears with null (zero boxes) → reads back null', async () => {
    await writeActiveBoxId('box-42');
    await writeActiveBoxId(null);
    await expect(readActiveBoxId()).resolves.toBeNull();
  });

  it('treats an unset/empty (garbled) value as null', async () => {
    await expect(readActiveBoxId()).resolves.toBeNull(); // never written
    mockStore.set('activeBoxId', ''); // empty string
    await expect(readActiveBoxId()).resolves.toBeNull();
  });

  it('returns null (never throws) on a read error', async () => {
    mockState.throwOnGet = true;
    await expect(readActiveBoxId()).resolves.toBeNull();
  });

  it('never throws on a write error', async () => {
    const { settingsStore } = jest.requireMock(
      '../../src/features/accounts/deps',
    ) as { settingsStore: { setSetting: jest.Mock } };
    settingsStore.setSetting.mockRejectedValueOnce(new Error('disk full'));
    await expect(writeActiveBoxId('x')).resolves.toBeUndefined();
  });
});

// 024 cycle 2. "With one box, do we show Vše at all?" - no, and the rule has to hold in both
// directions: it must not appear for a single-box user, and it must not survive a user dropping
// from two boxes to one while sitting in it.
describe('when the merged view exists at all', () => {
  it('is offered only once there are at least two boxes', () => {
    expect(unifiedAvailable(0)).toBe(false);
    expect(unifiedAvailable(1)).toBe(false);
    expect(unifiedAvailable(2)).toBe(true);
    expect(unifiedAvailable(9)).toBe(true);
  });

  it('is never entered by a single-box user, whatever was persisted', () => {
    // With one box, `Vše` and that box are the same list: two entries that render identically.
    expect(resolveUnified(true, 1)).toBe(false);
    expect(resolveUnified(true, 0)).toBe(false);
  });

  it('drops the user out of it when a box is removed', () => {
    // Two boxes, sitting in Vše, one gets removed. The view has stopped existing; staying in it
    // would leave them on a screen that is now just their only box, under a title saying "all".
    expect(resolveUnified(true, 2)).toBe(true);
    expect(resolveUnified(true, 1)).toBe(false);
  });

  it('respects a user who never chose it', () => {
    expect(resolveUnified(false, 4)).toBe(false);
  });
});
