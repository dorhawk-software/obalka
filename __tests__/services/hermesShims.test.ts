// The globals pdf.js needs and Hermes lacks (010 US3).
//
// Under Node all of these already exist, which is the whole problem: the scan passed every test and
// did nothing on a phone. So these tests DELETE the globals first and then assert the shims behave
// like the real thing - the only way this file can fail here for the reason it would fail there.

import {
  installHermesShims,
  structuredCloneShim,
} from '../../src/services/scan/hermesShims';

type Globals = {
  structuredClone?: unknown;
  ReadableStream?: unknown;
  TextDecoder?: unknown;
};
const g = globalThis as unknown as Globals;
const P = Promise as unknown as { withResolvers?: unknown };

/** Run `fn` with the named globals removed, restoring them afterwards whatever happens. */
function without(names: (keyof Globals | 'withResolvers')[], fn: () => void) {
  const saved: Record<string, unknown> = {};
  for (const n of names) {
    if (n === 'withResolvers') {
      saved[n] = P.withResolvers;
      delete P.withResolvers;
    } else {
      saved[n] = g[n];
      delete g[n];
    }
  }
  try {
    fn();
  } finally {
    for (const n of names) {
      if (n === 'withResolvers') {
        P.withResolvers = saved[n];
      } else {
        (g as Record<string, unknown>)[n] = saved[n];
      }
    }
  }
}

describe('installHermesShims', () => {
  it('fills in every global pdf.js reached for on the device', () => {
    without(['withResolvers', 'structuredClone', 'ReadableStream'], () => {
      expect(P.withResolvers).toBeUndefined();
      installHermesShims();
      expect(typeof P.withResolvers).toBe('function');
      expect(typeof g.structuredClone).toBe('function');
      expect(typeof g.ReadableStream).toBe('function');
    });
  });

  // Sentinels rather than "whatever this engine happens to have" - which is how this test first got
  // written, and it passed locally on Node 24 and failed on CI's Node 20, where `Promise.withResolvers`
  // does not exist (it landed in Node 22). Reading the host's own globals made the assertion mean
  // different things on different machines; installing known values means the same thing everywhere.
  it('never replaces an implementation that is already there', () => {
    const sentinels = { wr: () => 'mine', sc: () => 'mine', rs: class Mine {} };
    const saved = {
      wr: P.withResolvers,
      sc: g.structuredClone,
      rs: g.ReadableStream,
    };
    try {
      P.withResolvers = sentinels.wr;
      g.structuredClone = sentinels.sc;
      g.ReadableStream = sentinels.rs;
      installHermesShims();
      expect(P.withResolvers).toBe(sentinels.wr);
      expect(g.structuredClone).toBe(sentinels.sc);
      expect(g.ReadableStream).toBe(sentinels.rs);
    } finally {
      P.withResolvers = saved.wr;
      g.structuredClone = saved.sc;
      g.ReadableStream = saved.rs;
    }
  });
});

describe('structuredCloneShim', () => {
  it('copies the shapes pdf.js sends across its worker boundary', () => {
    const source = {
      n: 1,
      s: 'lhůta',
      arr: [1, [2, 3]],
      map: new Map([['k', { deep: true }]]),
      set: new Set([1, 2]),
      date: new Date(1750000000000),
      bytes: new Uint8Array([1, 2, 3]),
      nested: { nul: null, undef: undefined },
    };
    const copy = structuredCloneShim(source);
    expect(copy).toEqual(source);
    // A copy, not the same objects - the point of cloning a message rather than passing it.
    expect(copy).not.toBe(source);
    expect(copy.map).not.toBe(source.map);
    expect(copy.bytes).not.toBe(source.bytes);
    expect(copy.bytes.buffer).not.toBe(source.bytes.buffer);
  });

  it('preserves a typed array’s bytes and type', () => {
    const src = new Uint16Array([65535, 1, 2]);
    const copy = structuredCloneShim(src);
    expect(copy).toBeInstanceOf(Uint16Array);
    expect(Array.from(copy)).toEqual([65535, 1, 2]);
  });

  it('does not hang on a cycle', () => {
    const a: Record<string, unknown> = { name: 'a' };
    a.self = a;
    const copy = structuredCloneShim(a) as Record<string, unknown>;
    expect(copy.name).toBe('a');
    expect(copy.self).toBe(copy); // the cycle is preserved, not followed forever
  });
});
