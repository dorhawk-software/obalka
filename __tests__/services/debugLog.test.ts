// The recorder: off means off, the two levels really differ, and it cannot eat the phone.

import {
  clearDebugBuffer,
  debugSnapshot,
  debugStatus,
  isDebugRecording,
  record,
  recordBody,
  setDebugRedactionIdentifiers,
  startDebugRecording,
  stopDebugRecording,
  subscribeDebugRecording,
} from '../../src/services/debug/debugLog';

beforeEach(() => {
  stopDebugRecording();
  clearDebugBuffer();
  setDebugRedactionIdentifiers([]);
});

describe('when it is off', () => {
  it('records nothing at all', () => {
    // Not "records and discards": the buffer never receives it. Debug mode off must cost nothing and
    // must leave nothing in memory to be found.
    record('console', 'something happened');
    recordBody('→ POST /DS/dz', '<dmDm>secret</dmDm>');
    expect(debugSnapshot()).toEqual([]);
    expect(isDebugRecording()).toBe(false);
  });

  it('does not survive a stop', () => {
    startDebugRecording('full');
    record('console', 'during');
    stopDebugRecording();
    record('console', 'after');
    expect(debugSnapshot().some(e => e.message === 'after')).toBe(false);
  });
});

describe('the two levels', () => {
  const ENVELOPE = '<dmAnnotation>Rozhodnutí o dani</dmAnnotation>';

  it('standard keeps the diagnosis and drops the mail', () => {
    setDebugRedactionIdentifiers(['c57mi5x', 'Ondřej Šimon']);
    startDebugRecording('standard');
    record('failure', 'isds.download failed for c57mi5x', { httpStatus: 500 });
    recordBody('← 500 /DS/dz', ENVELOPE);
    const entries = debugSnapshot();
    expect(entries.some(e => e.message.includes('c57mi5x'))).toBe(false);
    expect(entries.some(e => e.message.includes('isds.download'))).toBe(true);
    // A body is a Full-only thing. At standard it is not recorded at all.
    expect(entries.some(e => e.kind === 'http.body')).toBe(false);
  });

  it('full keeps the envelope, which is the entire reason it exists', () => {
    setDebugRedactionIdentifiers(['c57mi5x']);
    startDebugRecording('full');
    recordBody('← 500 /DS/dz', ENVELOPE);
    const body = debugSnapshot().find(e => e.kind === 'http.body');
    expect(String(body?.data?.body)).toContain('Rozhodnutí o dani');
  });

  it('full keeps the box id, because a Full bundle is the user\'s own data', () => {
    setDebugRedactionIdentifiers(['c57mi5x']);
    startDebugRecording('full');
    record('trace', 'sync c57mi5x');
    expect(debugSnapshot()[1].message).toContain('c57mi5x');
  });

  it('removes credentials at BOTH levels', () => {
    for (const level of ['standard', 'full'] as const) {
      startDebugRecording(level);
      recordBody('→ POST /DS/dz', '<dbPassword>hunter2</dbPassword>');
      record('http', 'Authorization: Basic c2VjcmV0', { sessionCookie: 'IPCZ-X-COOKIE=abc' });
      const dumped = JSON.stringify(debugSnapshot());
      expect(dumped).not.toContain('hunter2');
      expect(dumped).not.toContain('c2VjcmV0');
      expect(dumped).not.toContain('abc');
      stopDebugRecording();
      clearDebugBuffer();
    }
  });
});

describe('bounded', () => {
  it('drops the oldest rather than growing without limit', () => {
    startDebugRecording('full');
    for (let i = 0; i < 4200; i++) {
      record('console', `line ${i}`);
    }
    const status = debugStatus();
    expect(status.entries).toBeLessThanOrEqual(4000);
    expect(status.dropped).toBeGreaterThan(0);
    // The window that survives is the RECENT one, which is where the bug is.
    expect(debugSnapshot()[debugSnapshot().length - 1].message).toBe('line 4199');
  });

  it('caps a single huge entry so it cannot evict the whole trail', () => {
    startDebugRecording('full');
    recordBody('← 200 /DS/vodz', 'x'.repeat(500_000));
    const body = debugSnapshot().find(e => e.kind === 'http.body');
    expect(String(body?.data?.body).length).toBeLessThan(70_000);
    expect(String(body?.data?.body)).toContain('more characters');
  });
});

it('never throws, whatever it is handed', () => {
  startDebugRecording('full');
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  expect(() => record('console', 'x', cyclic)).not.toThrow();
  expect(() => record('console', undefined as unknown as string)).not.toThrow();
});

describe('telling the screens', () => {
  // The recording strip on every screen (FR-007) is kept current by these announcements, not by a
  // timer re-reading a boolean for the whole life of the app.
  it('announces recording starting and stopping, and nothing that did not change', () => {
    const seen: boolean[] = [];
    const unsubscribe = subscribeDebugRecording(() => seen.push(isDebugRecording()));
    startDebugRecording('standard');
    stopDebugRecording();
    // Already stopped - `cancelDebug` does this - so no screen should re-render for it.
    stopDebugRecording();
    unsubscribe();
    startDebugRecording('full');
    expect(seen).toEqual([true, false]);
  });

  it('keeps recording when whatever is listening throws', () => {
    const unsubscribe = subscribeDebugRecording(() => {
      throw new Error('a broken screen');
    });
    expect(() => startDebugRecording('standard')).not.toThrow();
    expect(isDebugRecording()).toBe(true);
    unsubscribe();
  });
});
