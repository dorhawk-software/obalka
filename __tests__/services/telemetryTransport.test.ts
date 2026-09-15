// The hooks the SDK actually calls, and what they do with an event.
//
// `telemetry.test.ts` proves the facade is inert without a DSN. This file is the other half: it
// gives the module a DSN, lets it configure the SDK for real, and then asserts on the callbacks it
// handed over - because the safety of this feature is not a property of our code alone, it is a
// property of which of our callbacks Sentry decides to call.
//
// It exists because that assumption was wrong once already. `beforeSend` was believed to be "a single
// interception point every event must pass through"; it is the ERROR path only, and transactions went
// to `beforeSendTransaction`, which was not implemented. Consent was not checked and the scrubber did
// not run for any of them. Every test below is that bug, written down so it cannot come back.

jest.mock('../../src/services/telemetry/dsn', () => ({
  SENTRY_DSN: 'https://examplePublicKey@o0.ingest.de.sentry.io/0',
  SENTRY_ENVIRONMENT: 'test',
}));

/**
 * The options object the module handed to the SDK, from a fresh module registry each time.
 *
 * `startTelemetry` is deliberately once-per-process, so every case here needs its own registry - and
 * the SDK mock has to be re-required AFTER the reset, or the assertions watch a different instance
 * from the one the module under test just called.
 */
function configure(enabled: boolean): Record<string, never> & {
  beforeSend?: (e: unknown) => unknown;
  beforeSendTransaction?: (e: unknown) => unknown;
  beforeBreadcrumb?: (c: unknown) => unknown;
  integrations?: (defaults: { name: string }[]) => { name: string }[];
  tracesSampleRate?: number;
  enableCaptureFailedRequests?: boolean;
  sendDefaultPii?: boolean;
} {
  jest.resetModules();
  const Sentry = require('@sentry/react-native');
  const telemetry = require('../../src/services/telemetry/telemetry');
  const init = Sentry.init as jest.Mock;
  init.mockClear();
  telemetry.setRedactionIdentifiers(['c57mi5x']);
  // The SDK only starts on a yes (see "the SDK's life" below), so "off" is a yes taken back: the hooks
  // it was started with must drop everything from that moment, before the close has finished.
  telemetry.startTelemetry({ enabled: true, release: '0.0.1', environment: 'test' });
  expect(init).toHaveBeenCalledTimes(1);
  if (!enabled) {
    telemetry.startTelemetry({ enabled: false });
  }
  return init.mock.calls[0][0];
}

/** A fresh telemetry module and the SDK mock it talks to. */
function fresh() {
  jest.resetModules();
  const Sentry = require('@sentry/react-native');
  (Sentry.init as jest.Mock).mockClear();
  (Sentry.close as jest.Mock).mockClear();
  return {
    init: Sentry.init as jest.Mock,
    close: Sentry.close as jest.Mock,
    telemetry: require('../../src/services/telemetry/telemetry'),
  };
}

/** Lets the queued close (and whatever waited on it) run. */
const settle = () => new Promise(resolve => setImmediate(resolve));

describe("the SDK's life", () => {
  // The send hooks are JavaScript, and the SDK strips them from the options it hands the native SDKs.
  // A started SDK therefore reports native crashes and release-health sessions whatever the hooks say,
  // so the only way to send nothing without consent is not to start it (2026-09-24).
  it('is not started by a no, nor by a question not yet answered', () => {
    const { init, telemetry } = fresh();
    telemetry.startTelemetry({ enabled: false });
    expect(init).not.toHaveBeenCalled();
  });

  it('starts at once on a yes', () => {
    const { init, telemetry } = fresh();
    telemetry.startTelemetry({ enabled: true });
    expect(init).toHaveBeenCalledTimes(1);
  });

  it('is closed when the yes is taken back, native side included', async () => {
    const { close, telemetry } = fresh();
    telemetry.startTelemetry({ enabled: true });
    telemetry.startTelemetry({ enabled: false });
    await settle();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('starts again on a later yes, after the close has finished', async () => {
    const { init, close, telemetry } = fresh();
    let finishClose = () => {};
    close.mockImplementationOnce(() => new Promise<void>(r => (finishClose = r)));
    telemetry.startTelemetry({ enabled: true });
    telemetry.startTelemetry({ enabled: false });
    telemetry.startTelemetry({ enabled: true });
    await settle();
    expect(init).toHaveBeenCalledTimes(1); // still closing
    finishClose();
    await settle();
    expect(init).toHaveBeenCalledTimes(2);
  });

  it('does not start for a yes that a later no overtook', async () => {
    const { init, telemetry } = fresh();
    telemetry.startTelemetry({ enabled: true });
    telemetry.startTelemetry({ enabled: false });
    telemetry.startTelemetry({ enabled: true });
    telemetry.startTelemetry({ enabled: false });
    await settle();
    expect(init).toHaveBeenCalledTimes(1);
  });

  it('does not start twice for two yeses', () => {
    const { init, telemetry } = fresh();
    telemetry.startTelemetry({ enabled: true });
    telemetry.startTelemetry({ enabled: true });
    expect(init).toHaveBeenCalledTimes(1);
  });
});

/** A transaction event shaped the way the SDK builds one, with an HTTP span under it. */
const transactionEvent = () => ({
  type: 'transaction',
  transaction: 'GET /DS/dz for c57mi5x',
  spans: [
    {
      op: 'http.client',
      description: 'POST https://ws1.datovka.gov.cz/DS/dz',
      data: {
        'http.url': 'https://ws1.datovka.gov.cz/DS/dz',
        'http.request.body': '<dmDm>secret</dmDm>',
        httpStatus: 500,
      },
    },
  ],
  contexts: {
    trace: { op: 'http.client', status: 'internal_error' },
    device: { model: 'Pixel 7', name: "Ondřej's Pixel" },
  },
});

describe('the hook every transaction goes through', () => {
  it('is registered at all', () => {
    // The regression guard for the whole finding. Without this callback the SDK sends transactions
    // straight out, and no test of `beforeSend` can tell.
    expect(typeof configure(true).beforeSendTransaction).toBe('function');
  });

  it('drops the transaction when consent is off', () => {
    const options = configure(false);
    expect(options.beforeSendTransaction?.(transactionEvent())).toBeNull();
  });

  it('drops the error when consent is off, by the same gate', () => {
    const options = configure(false);
    expect(options.beforeSend?.({ message: 'boom' })).toBeNull();
  });

  it('scrubs the transaction when consent is on', () => {
    const options = configure(true);
    const out = options.beforeSendTransaction?.(transactionEvent()) as {
      transaction: string;
      spans: { description: string; data: Record<string, unknown> }[];
      contexts: Record<string, Record<string, unknown>>;
    };
    // The box id in the transaction NAME.
    expect(out.transaction).not.toContain('c57mi5x');
    // The URL in the span description, and the SOAP body in its data.
    expect(out.spans[0].description).not.toContain('ws1.datovka.gov.cz');
    expect(out.spans[0].data).toEqual({ httpStatus: 500 });
    // The device NAME, which on a real phone is frequently a person's own name.
    expect(out.contexts.device).toEqual({ model: 'Pixel 7' });
    expect(out.contexts.trace).toEqual({
      op: 'http.client',
      status: 'internal_error',
    });
  });
});

describe('automatic HTTP spans', () => {
  it('replaces the default tracing integration with one that traces neither XHR nor fetch', () => {
    // React Native's `fetch` IS XMLHttpRequest (`Libraries/Network/fetch.js` → whatwg-fetch), so
    // `traceXHR` - which defaults to true - turns every ISDS SOAP call into a span carrying its
    // request line. Nothing is lost by switching it off: the spans worth having are the ones
    // `measure()` creates by name.
    const options = configure(true);
    const resolved = options.integrations?.([{ name: 'SomeDefault' }]) ?? [];
    const tracing = resolved.find(i => i.name === 'ReactNativeTracing') as
      | { name: string; options: { traceXHR: boolean; traceFetch: boolean } }
      | undefined;
    expect(tracing).toBeDefined();
    expect(tracing?.options).toEqual({ traceXHR: false, traceFetch: false });
    // and the defaults are still there, not thrown away
    expect(resolved.some(i => i.name === 'SomeDefault')).toBe(true);
  });

  it('leaves failed-request CAPTURE off as well', () => {
    // A separate mechanism from the spans above, and the one whose name misleads: this flag governs
    // `httpClientIntegration`, which reports failed requests as ERRORS with URL, headers and body.
    expect(configure(true).enableCaptureFailedRequests).toBe(false);
  });
});

describe('the console breadcrumb', () => {
  it('is dropped, because this app logs envelopes', () => {
    const options = configure(true);
    expect(options.beforeBreadcrumb?.({ category: 'console' })).toBeNull();
    expect(options.beforeBreadcrumb?.({ category: 'navigation' })).not.toBeNull();
  });

  it('is dropped along with every other breadcrumb when consent is off', () => {
    const options = configure(false);
    expect(options.beforeBreadcrumb?.({ category: 'navigation' })).toBeNull();
  });
});

it('never asks the SDK for personally identifying data', () => {
  expect(configure(true).sendDefaultPii).toBe(false);
});

describe('the per-install ID the native SDKs make (2026-09-24)', () => {
  it('sends no release-health sessions, which carry it', () => {
    expect(
      (configure(true) as { enableAutoSessionTracking?: boolean }).enableAutoSessionTracking,
    ).toBe(false);
  });

  it('puts a fixed user in its place, so a native crash does not carry it as user.id', () => {
    const { telemetry } = fresh();
    const Sentry = require('@sentry/react-native');
    (Sentry.setUser as jest.Mock).mockClear();
    telemetry.startTelemetry({ enabled: true });
    expect(Sentry.setUser).toHaveBeenCalledWith({ id: telemetry.ANONYMOUS_USER });
  });
});
