// The JS side of SMS User Consent (021).
//
// Two things are worth pinning, and neither is about SMS: that a missing native module is a silent
// no-op (an iOS build, or a JS bundle running on an app binary older than this feature), and that the
// MESSAGE never escapes this module - only digits reach the caller.
//
// The fakes are built inside the `jest.mock` factory rather than above it: the factory first runs
// while the module under test is being imported, which is BEFORE any `const` in this file has been
// initialised. Referencing them from outside gives a module whose native side is quietly undefined -
// a test that fails for a reason that has nothing to do with the code.

jest.mock('react-native', () => {
  const listeners: ((e: unknown) => void)[] = [];
  const native = {
    start: jest.fn(async () => true),
    stop: jest.fn(async () => true),
  };
  const remove = jest.fn();
  return {
    Platform: { OS: 'android' },
    NativeModules: { SmsUserConsent: native },
    NativeEventEmitter: class {
      addListener(_event: string, fn: (e: unknown) => void) {
        listeners.push(fn);
        return { remove };
      }
    },
    __fake: { listeners, native, remove },
  };
});

import {
  listenForSmsCode,
  smsAutofillAvailable,
} from '../../src/services/sms/smsUserConsent';

const fake = (
  require('react-native') as {
    __fake: {
      listeners: ((e: unknown) => void)[];
      native: { start: jest.Mock; stop: jest.Mock };
      remove: jest.Mock;
    };
  }
).__fake;

const REAL =
  'Dobry den. Autentizacni kod pro pristup k ISDS je 35124603. Ceska posta, s.p.';

/** What the native side does after the user taps "allow" on the system prompt. */
const deliver = (message: unknown) => {
  for (const fn of fake.listeners) {
    fn(message);
  }
};

beforeEach(() => {
  fake.listeners.length = 0;
  fake.native.start.mockClear();
  fake.native.stop.mockClear();
  fake.remove.mockClear();
});

describe('listenForSmsCode', () => {
  it('starts listening and hands back only the digits', () => {
    const seen: string[] = [];
    listenForSmsCode(c => seen.push(c));
    expect(fake.native.start).toHaveBeenCalledTimes(1);
    deliver({ message: REAL });
    expect(seen).toEqual(['35124603']);
  });

  it('says nothing for a message with no clear code', () => {
    const seen: string[] = [];
    listenForSmsCode(c => seen.push(c));
    deliver({ message: 'Vase zasilka byla dorucena.' });
    deliver({});
    deliver({ message: 'Kod je 11111111, nebo kod je 22222222.' }); // two equally cued codes
    expect(seen).toEqual([]);
  });

  it('stops listening on cleanup, and delivers nothing afterwards', () => {
    const seen: string[] = [];
    const stop = listenForSmsCode(c => seen.push(c));
    stop();
    expect(fake.remove).toHaveBeenCalled();
    expect(fake.native.stop).toHaveBeenCalledTimes(1);
    deliver({ message: REAL });
    expect(seen).toEqual([]);
  });

  it('survives a native module that refuses to start', async () => {
    fake.native.start.mockRejectedValueOnce(new Error('no play services'));
    const stop = listenForSmsCode(() => {});
    await Promise.resolve();
    expect(() => stop()).not.toThrow();
  });

  it('reports itself available when the module is registered', () => {
    expect(smsAutofillAvailable()).toBe(true);
  });
});
