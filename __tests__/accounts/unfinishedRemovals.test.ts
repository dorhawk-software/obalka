// The mark an unfinished box removal is finished from (001 T037).

import {
  parseUnfinished,
  unfinishedRemovals,
} from '../../src/features/accounts/state/unfinishedRemovals';
import { UNFINISHED_REMOVALS_KEY } from '../../src/app/settings/settingsKeys';

function settings() {
  const values = new Map<string, string>();
  return {
    values,
    getSetting: async (key: string) => values.get(key) ?? null,
    setSetting: async (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe('reading the stored marks', () => {
  it('reads nothing stored, and anything damaged, as no marks', () => {
    // A mark is only a reason to look again: the resume asks the accounts table before it touches
    // anything, so a damaged value costs a retry and never deletes a thing.
    expect(parseUnfinished(null)).toEqual([]);
    expect(parseUnfinished('')).toEqual([]);
    expect(parseUnfinished('{"a":1}')).toEqual([]);
    expect(parseUnfinished('not json')).toEqual([]);
  });

  it('keeps the box ids, once each, and drops whatever is not one', () => {
    expect(parseUnfinished('["a", 3, "", "b", "a", null]')).toEqual(['a', 'b']);
  });
});

describe('the marks in the settings table', () => {
  it('adds a box once, in order, under the device-local key', async () => {
    const store = settings();
    const marks = unfinishedRemovals(store);
    await marks.add('a');
    await marks.add('b');
    await marks.add('a');
    expect(await marks.list()).toEqual(['a', 'b']);
    expect(store.values.get(UNFINISHED_REMOVALS_KEY)).toBe('["a","b"]');
  });

  it('removes one box and keeps the others', async () => {
    const marks = unfinishedRemovals(settings());
    await marks.add('a');
    await marks.add('b');
    await marks.remove('a');
    await marks.remove('never-marked');
    expect(await marks.list()).toEqual(['b']);
  });

  it('lets a table that will not read say so', async () => {
    const marks = unfinishedRemovals({
      getSetting: async () => {
        throw new Error('db gone');
      },
      setSetting: async () => {},
    });
    await expect(marks.list()).rejects.toThrow('db gone');
  });
});
