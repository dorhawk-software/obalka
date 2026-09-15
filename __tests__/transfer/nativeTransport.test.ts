// Stopping the native transfer while the app is in the background (025 FR-014, T021).
//
// The screen stops a run the moment Android reports the app in the background. The run's `signal`
// reaches the module through a JS interval, and React Native on Android does not fire JS timers while
// the host activity is paused (`JavaTimerManager.onHostPause`). Fake timers that are never advanced
// are that state exactly: nothing polls, so only a call that goes straight to the module can stop
// croc before the user comes back.
//
// The fakes are built inside the `jest.mock` factory for the reason `smsUserConsent.test.ts` gives:
// the factory runs while the module under test is imported, before any `const` here exists.

jest.mock('react-native', () => {
  const listeners = new Set<(mockEvent: unknown) => void>();
  const native = {
    available: jest.fn(async () => true),
    cancel: jest.fn(),
    send: jest.fn(() => new Promise<void>(() => {})),
    receive: jest.fn(() => new Promise<void>(() => {})),
    keepScreenOn: jest.fn(),
  };
  return {
    Platform: { OS: 'android' },
    NativeModules: { ObalkaTransfer: native },
    NativeEventEmitter: class {
      addListener(_event: string, listener: (mockEvent: unknown) => void) {
        listeners.add(listener);
        return { remove: () => listeners.delete(listener) };
      }
    },
    __fake: { native, emit: (mockEvent: unknown) => [...listeners].forEach(l => l(mockEvent)) },
  };
});

jest.mock('../../src/services/telemetry/telemetry', () => ({
  reportFailure: jest.fn(),
}));

import { nativeTransport } from '../../src/services/transfer/nativeTransport';
import {
  TransferCancelledError,
  type TransferProgress,
} from '../../src/services/transfer/transport';

const rn = require('react-native') as {
  __fake: {
    native: {
      cancel: jest.Mock;
      send: jest.Mock;
      receive: jest.Mock;
      keepScreenOn: jest.Mock;
    };
    emit: (e: unknown) => void;
  };
  NativeModules: { ObalkaTransfer?: unknown };
};

const OPTIONS = { secret: '7K2M-ryba-kotva-duha-lampa', onlyLocal: false };

/** The name the module was handed for the n-th run it was asked to start. */
const runIdOf = (n: number): string => rn.__fake.native.send.mock.calls[n][0];

describe('stopping the native transfer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    rn.__fake.native.cancel.mockClear();
    rn.__fake.native.send.mockClear();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('reaches the module at once, with no timer left to run', () => {
    const signal = { cancelled: false };
    void nativeTransport.send('/work/out', { ...OPTIONS, signal });

    // The flag alone, the way a background stop used to end: nothing is polling it.
    signal.cancelled = true;
    expect(rn.__fake.native.cancel).not.toHaveBeenCalled();

    nativeTransport.cancel();
    expect(rn.__fake.native.cancel).toHaveBeenCalledTimes(1);
  });

  it('is a quiet no-op in a build without the module', () => {
    const modules = rn.NativeModules;
    const native = modules.ObalkaTransfer;
    modules.ObalkaTransfer = undefined;
    try {
      expect(() => nativeTransport.cancel()).not.toThrow();
    } finally {
      modules.ObalkaTransfer = native;
    }
  });
});

describe('a stop reaches only the run it was meant for (025 review, 2026-09-15)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    rn.__fake.native.cancel.mockClear();
    rn.__fake.native.send.mockClear();
    rn.__fake.native.receive.mockClear();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('gives every run its own name, and hands it to the module', () => {
    void nativeTransport.send('/work/out', OPTIONS);
    void nativeTransport.send('/work/out', OPTIONS);
    expect(rn.__fake.native.send.mock.calls[0].slice(1)).toEqual([
      '/work/out',
      OPTIONS.secret,
      false,
    ]);
    expect(runIdOf(0)).toEqual(expect.any(String));
    expect(runIdOf(1)).not.toBe(runIdOf(0));
  });

  it('never lets a stopped run s interval stop the run that followed it', () => {
    // The defect: one flag in the module for every run. A stopped run's interval goes on setting it
    // until that run settles, and a run started in that window was stopped by it.
    const stopped = { cancelled: false };
    void nativeTransport.send('/work/out', { ...OPTIONS, signal: stopped });
    stopped.cancelled = true;
    jest.advanceTimersByTime(200);

    // The next transfer starts while the first is still winding down on the native side.
    void nativeTransport.send('/work/out', { ...OPTIONS, signal: { cancelled: false } });
    jest.advanceTimersByTime(1000);

    const named = rn.__fake.native.cancel.mock.calls.map(call => call[0]);
    expect(named.length).toBeGreaterThan(1);
    expect(new Set(named)).toEqual(new Set([runIdOf(0)]));
  });

  it('stops the run in flight by name when told to at once', () => {
    void nativeTransport.receive('/work/in', OPTIONS);
    nativeTransport.cancel();
    expect(rn.__fake.native.cancel).toHaveBeenCalledWith(rn.__fake.native.receive.mock.calls[0][0]);
  });

  it('reaches nobody when nothing is running', async () => {
    rn.__fake.native.send.mockImplementationOnce(() => Promise.resolve());
    await nativeTransport.send('/work/out', OPTIONS);
    nativeTransport.cancel();
    expect(rn.__fake.native.cancel).not.toHaveBeenCalled();
  });

  it('reports a stop the native side noticed as a stop, not a broken transfer', async () => {
    rn.__fake.native.send.mockImplementationOnce(() =>
      Promise.reject(Object.assign(new Error('context canceled'), { code: 'cancelled' })),
    );
    await expect(nativeTransport.send('/work/out', OPTIONS)).rejects.toBeInstanceOf(
      TransferCancelledError,
    );
  });

  it('ignores progress from any run but its own', () => {
    const seen: TransferProgress[] = [];
    void nativeTransport.send('/work/out', { ...OPTIONS, onProgress: p => seen.push(p) });
    const mine = runIdOf(0);

    rn.__fake.emit({ runId: 'an-older-run', stage: 'transferring', sent: 9, total: 9, relayed: true });
    expect(seen).toEqual([]);

    rn.__fake.emit({ runId: mine, stage: 'transferring', sent: 1, total: 4 });
    expect(seen).toEqual([{ stage: 'transferring', sent: 1, total: 4, relayed: null }]);
  });
});

describe('keeping the display on (FR-014, 2026-09-15)', () => {
  beforeEach(() => {
    rn.__fake.native.keepScreenOn.mockClear();
  });

  it('asks the module, both ways', () => {
    nativeTransport.keepScreenOn(true);
    nativeTransport.keepScreenOn(false);
    expect(rn.__fake.native.keepScreenOn.mock.calls).toEqual([[true], [false]]);
  });

  it('never throws at the screen, with or without the module', () => {
    rn.__fake.native.keepScreenOn.mockImplementationOnce(() => {
      throw new Error('no window');
    });
    expect(() => nativeTransport.keepScreenOn(true)).not.toThrow();

    const modules = rn.NativeModules;
    const native = modules.ObalkaTransfer;
    modules.ObalkaTransfer = undefined;
    try {
      expect(() => nativeTransport.keepScreenOn(false)).not.toThrow();
    } finally {
      modules.ObalkaTransfer = native;
    }
  });
});
