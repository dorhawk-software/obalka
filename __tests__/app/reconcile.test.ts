// Keeping the same objects when a re-read of the accounts finds nothing new (2026-10-03).

import { reconcileList, shallowEqual } from '../../src/app/reconcile';

type Row = { id: string; n: number };
const key = (r: Row) => r.id;

describe('shallowEqual', () => {
  it('compares keys and values one level deep', () => {
    expect(shallowEqual({ a: 1, b: null }, { a: 1, b: null })).toBe(true);
    expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(shallowEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(shallowEqual({ a: {} }, { a: {} })).toBe(false);
  });
});

describe('reconcileList', () => {
  const prev: Row[] = [
    { id: 'a', n: 1 },
    { id: 'b', n: 2 },
  ];

  it('returns the previous list itself when nothing changed', () => {
    const next = prev.map(r => ({ ...r }));
    expect(reconcileList(prev, next, key)).toBe(prev);
  });

  it('keeps every unchanged row and takes the changed one', () => {
    const next = [{ id: 'a', n: 1 }, { id: 'b', n: 3 }];
    const out = reconcileList(prev, next, key);
    expect(out).not.toBe(prev);
    expect(out[0]).toBe(prev[0]);
    expect(out[1]).toBe(next[1]);
  });

  it('sees a new order, a new row and a removed one', () => {
    const reordered = reconcileList(prev, [{ ...prev[1] }, { ...prev[0] }], key);
    expect(reordered).not.toBe(prev);
    expect(reordered).toEqual([prev[1], prev[0]]);
    expect(reordered[0]).toBe(prev[1]);

    const added = reconcileList(prev, [...prev.map(r => ({ ...r })), { id: 'c', n: 0 }], key);
    expect(added).toHaveLength(3);
    expect(added[0]).toBe(prev[0]);

    const removed = reconcileList(prev, [{ ...prev[0] }], key);
    expect(removed).toEqual([prev[0]]);
    expect(removed[0]).toBe(prev[0]);
  });
});
