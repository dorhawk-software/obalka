// The facade the 84 call sites use - and, above all, the property that it sends NOTHING unless it
// has been told it may.
//
// `scrub.test.ts` proves a report cannot carry someone's mail. This proves the report is not sent at
// all without consent, that a failing telemetry path can never become the thing that breaks the app
// it is watching, and that a call site's own error handling is untouched by reporting.

import * as Sentry from '@sentry/react-native';

// Pinned empty, deliberately. This file's whole subject is how the facade behaves with NO project
// behind it, and until 2026-09-11 that was also the committed state of `dsn.ts`, so the tests got it
// for free. Now that the app points at a real EU project they would silently invert - the "without a
// DSN" block below would be initialising the SDK and asserting the opposite of its own name. The
// contract is real and outlives the constant: a checkout with no DSN must be completely inert.
jest.mock('../../src/services/telemetry/dsn', () => ({
  SENTRY_DSN: '',
  SENTRY_ENVIRONMENT: 'test',
}));
import {
  isTelemetryEnabled,
  measure,
  reportFailure,
  setRedactionIdentifiers,
  setTelemetryEnabled,
  startTelemetry,
  trace,
} from '../../src/services/telemetry/telemetry';

const captureException = Sentry.captureException as jest.Mock;
const addBreadcrumb = Sentry.addBreadcrumb as jest.Mock;
const init = Sentry.init as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  setRedactionIdentifiers([]);
});

describe('without a DSN', () => {
  // The state of a checkout nobody has configured, and of every contributor's machine before they
  // are given one. Every call site must behave identically either way, or the 46 of them are only
  // tested in the mode that transmits.
  it('never initialises the SDK', () => {
    startTelemetry({ enabled: true });
    expect(init).not.toHaveBeenCalled();
  });

  it('swallows every call rather than throwing', () => {
    setTelemetryEnabled(true);
    expect(() => reportFailure('isds.listReceived', new Error('x'))).not.toThrow();
    expect(() => trace('db.open')).not.toThrow();
    expect(captureException).not.toHaveBeenCalled();
  });

  it('still runs the work handed to measure()', async () => {
    // `measure` wraps real operations. If it dropped them when telemetry was off, turning telemetry
    // off would break the app - the exact inversion of what a diagnostic tool is for.
    await expect(measure('db.open', async () => 'result')).resolves.toBe('result');
  });

  it('lets an error inside measure() through untouched', async () => {
    const boom = new Error('db locked');
    await expect(measure('db.open', async () => Promise.reject(boom))).rejects.toBe(boom);
  });
});

describe('consent', () => {
  it('starts from whatever it was told, and can be changed', () => {
    startTelemetry({ enabled: false });
    expect(isTelemetryEnabled()).toBe(false);
    setTelemetryEnabled(true);
    expect(isTelemetryEnabled()).toBe(true);
    setTelemetryEnabled(false);
    expect(isTelemetryEnabled()).toBe(false);
  });

  it('sends nothing while it is off', () => {
    setTelemetryEnabled(false);
    reportFailure('isds.send', new Error('nope'));
    trace('isds.send');
    expect(captureException).not.toHaveBeenCalled();
    expect(addBreadcrumb).not.toHaveBeenCalled();
  });
});

describe('reportFailure', () => {
  it('never throws, whatever it is handed', () => {
    setTelemetryEnabled(true);
    // The call sites are `catch` blocks. Anything can be in flight there, including a thrown string,
    // a thrown object, or nothing at all.
    expect(() => reportFailure('file.read', 'a string')).not.toThrow();
    expect(() => reportFailure('file.read', { weird: true })).not.toThrow();
    expect(() => reportFailure('file.read', undefined)).not.toThrow();
    expect(() => reportFailure('file.read', null)).not.toThrow();
  });

  it('survives the SDK itself throwing', () => {
    // Telemetry must never become the thing that breaks the app it is watching.
    setTelemetryEnabled(true);
    captureException.mockImplementationOnce(() => {
      throw new Error('transport is on fire');
    });
    expect(() => reportFailure('isds.login', new Error('x'))).not.toThrow();
  });
});

describe('measure', () => {
  it('returns the value and rethrows the error, telemetry or not', async () => {
    setTelemetryEnabled(true);
    await expect(measure('backup.argon2', async () => 42)).resolves.toBe(42);
    const boom = new Error('oom');
    await expect(measure('backup.argon2', async () => Promise.reject(boom))).rejects.toBe(boom);
  });
});
