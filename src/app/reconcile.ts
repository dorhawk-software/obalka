// Keeping the same objects when a re-read finds nothing new (audit 2026-10-03).
//
// The shell re-reads the accounts table on every screen focus, every switcher open and after every
// refresh, and the read hands back freshly built objects with the same contents. React compares by
// identity, so every effect, memo and memoised row downstream of `accounts` treated each re-read as a
// change: the merged inbox re-read its list and flickered, a message detail reset itself mid-download,
// compose asked ISDS for the credit again. Reconciling at the source - reuse each previous object whose
// fields are all equal, and the previous array itself when nothing changed - stops all of that at once,
// and keeps working for code written later that does not know about it.

/** Shallow equality of two plain records: same keys, and `===` on every value. */
export function shallowEqual(a: object, b: object): boolean {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) {
    return false;
  }
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  return ka.every(k => Object.prototype.hasOwnProperty.call(b, k) && Object.is(ra[k], rb[k]));
}

/**
 * `next`, but with every item equal to its previous version replaced by that previous object, and
 * `prev` itself returned when the two lists are equal item for item. Items are matched by `key`.
 */
export function reconcileList<T extends object>(
  prev: readonly T[],
  next: readonly T[],
  key: (item: T) => string,
): T[] {
  const before = new Map(prev.map(item => [key(item), item]));
  let changed = prev.length !== next.length;
  const out = next.map((item, i) => {
    const old = before.get(key(item));
    if (old && shallowEqual(old, item)) {
      if (prev[i] !== old) {
        changed = true; // same objects, different order
      }
      return old;
    }
    changed = true;
    return item;
  });
  return changed ? out : (prev as T[]);
}
