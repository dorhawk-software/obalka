// Crash and performance reporting - the app's only outbound channel that is not ISDS.
//
// WHY THIS EXISTS AT ALL. An audit on 2026-09-10 found 84 `catch` blocks in `src/` and exactly zero
// of them reporting anything. That is Principle II working as written - "MUST NOT hard-crash …
// failures degrade to a clear, recoverable, localized UI state" - and it is also the reason the app
// is undebuggable in the field. A user says "it didn't work"; there is nowhere to look. Graceful
// degradation and observability are not in tension, but they had been conflated: swallowing an error
// so the UI survives is right, and swallowing it so NOBODY EVER LEARNS is a separate decision that
// was never actually made.
//
// WHAT IT MAY SEND. Nothing that identifies a person or quotes their mail - see `scrub.ts`, which is
// the guarantee and which was written and proved before this file existed. Sentry was chosen over
// Crashlytics specifically because `beforeSend` is a single interception point every event must pass
// through; the alternative offered no equivalent hook, so its safety would have rested on discipline
// at 87 call sites instead of on one function with tests.
//
// CONSENT. Gated in the send hooks, so flipping the switch takes effect on the next event instead of
// the next launch - AND at `init`, which is only called after a yes (2026-09-24). The hooks alone were
// believed to be enough, and are not: they are JavaScript, and the SDK hands the native SDKs an
// options object with every callback stripped (`wrapper.js`, `initNativeSdk`). So a started SDK let
// the native crash handler and release-health session pings out for someone who had said no, or had
// not been asked yet, and none of it passed the scrubber. Not started means not sending anything.
//
// "BEFORESEND IS A SINGLE INTERCEPTION POINT EVERY EVENT MUST PASS THROUGH" WAS FALSE, and the two
// sentences above were written believing it. `beforeSend` runs for ERROR events only: the SDK checks
// `isErrorEvent(event)` first and routes type 'transaction' to `beforeSendTransaction`, a hook this
// file did not implement. With `tracesSampleRate: 1.0` set, that meant every performance transaction
// left the device having passed neither the consent check nor the scrubber - including, because
// React Native's `fetch` is XMLHttpRequest underneath and the tracing integration instruments XHR by
// default, an `http.client` span for every ISDS SOAP call. `enableCaptureFailedRequests: false` does
// not prevent that; it disables a different integration whose name merely sounds like it would.
//
// Nothing ever escaped, because `SENTRY_DSN` has been empty for the whole life of this module and an
// empty DSN means no init at all. The fix is below: both hooks, one gate, and automatic HTTP spans
// switched off at the source. The lesson worth keeping is that "one interception point" was a claim
// about someone else's code, and it was never checked against it.
//
// PRINCIPLE III. "There is NO backend of ours … We never transmit government mail or credentials to
// any server we operate." Sentry is not a server we operate, and the scrubber is what keeps the
// first half true. Note that the same clause would forbid SELF-hosting a reporter, which is the
// opposite of what privacy intuition suggests and is worth remembering if this is ever revisited.

import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';
import { record as recordDebug } from '../debug/debugLog';
import { SENTRY_DSN } from './dsn';
import type { Host } from '../isds/types';
import {
  NO_REDACTIONS,
  scrubContext,
  scrubEvent,
  type RedactionSet,
} from './scrub';

/** Whatever was thrown, as something readable. `catch` blocks receive anything at all. */
function errorText(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error) ?? String(error);
  } catch {
    return String(error);
  }
}

/** Operation names, so a report says WHICH integration failed rather than only where in the file. */
export type Op =
  // ISDS
  | 'isds.login'
  | 'isds.listReceived'
  | 'isds.listSent'
  | 'isds.download'
  | 'isds.downloadAttachment'
  | 'isds.send'
  | 'isds.markRead'
  | 'isds.credit'
  | 'isds.deliveryRecord'
  | 'isds.mobileKey'
  | 'isds.http'
  | 'isds.parse'
  // storage
  | 'db.open'
  | 'db.migrate'
  | 'db.read'
  | 'db.write'
  | 'keychain.read'
  | 'keychain.write'
  | 'appLock.arm'
  | 'appLock.authenticate'
  // files
  | 'file.write'
  | 'file.read'
  | 'file.open'
  | 'file.pick'
  // iOS would not mark an app data location excluded from the phone's backup (2026-09-24). Nothing
  // on screen changes, which is why it is reported: the only symptom is files in iCloud.
  | 'file.excludeFromBackup'
  | 'file.toPdf'
  | 'scan.pdfText'
  | 'scan.attachment'
  // backup
  | 'backup.snapshot'
  | 'backup.restore'
  | 'backup.encrypt'
  | 'backup.decrypt'
  | 'backup.argon2'
  // Tier 2 fell back to the JS cipher: correct, silent to the user, and the difference between
  // megabytes of AEAD in native code and the same work on the JS thread.
  | 'backup.bulkCipher'
  // One attachment failed to store or to come back. Per-file, because Tier 2 must never let a
  // single bad document take the other four hundred with it.
  | 'backup.document'
  // The phone-to-phone transfer's native module would not load. Reported because falling back here
  // means the feature is absent, not slower - there is no JS transport to fall back to (025).
  | 'transfer.native'
  // platform
  | 'notify.schedule'
  | 'notify.cancel'
  | 'notify.permission'
  | 'sms.consent'
  | 'haptics'
  | 'deepLink'
  | 'systemBars'
  | 'settings.read'
  | 'settings.write';

/**
 * The ISDS environment a report is about: an account's own `Host`, or `'other'` when a URL matched
 * neither environment (`hostLabel` in `httpClient.ts`). One label set for every call site, so a
 * report can be filtered by environment without knowing which layer raised it.
 */
export type HostLabel = Host | 'other';

/** Only what `scrub.ts` will let through anyway - typed so a call site cannot even try. */
export interface FailureContext {
  stage?: 'transport' | 'parse' | 'persist' | 'crypto' | 'native';
  faultCode?: string;
  dmStatusCode?: string;
  httpStatus?: number;
  host?: HostLabel;
  authMethod?: string;
  attempt?: number;
  retryCount?: number;
  byteSize?: number;
  itemCount?: number;
  durationMs?: number;
  attachmentCount?: number;
  folder?: string;
  /** An ISDS service path from a fixed list - see `endpointLabel` in `httpClient.ts`. */
  endpoint?: string;
  /**
   * What the person decided, for a trail that is not a failure: a declined screen-lock prompt is
   * traced with this rather than reported (2026-09-15).
   */
  outcome?: 'declined';
}

/** What every report carries as its user, in place of the SDK's per-install ID. */
export const ANONYMOUS_USER = 'anonymous';

let enabled = false;
let started = false;
/**
 * A close still running, or null. `Sentry.close()` is asynchronous (it flushes, then closes the
 * native SDK), and a yes that arrives while a no is still closing must start a fresh SDK after it,
 * not race it.
 */
let closing: Promise<void> | null = null;
/** Bumped by every start and stop, so a start that waited on a close only runs if nothing came after. */
let generation = 0;
let redactions: RedactionSet = NO_REDACTIONS;

/**
 * Seed the scrubber with this device's own identifiers.
 *
 * Called whenever accounts change. These are the strings a foreign error message might quote - a box
 * ID in a SOAP fault, an owner name in a parser error - and knowing them literally is far stronger
 * than guessing at their shape.
 */
export function setRedactionIdentifiers(literals: readonly string[]): void {
  redactions = { literals: [...new Set(literals.filter(Boolean))] };
}

/** Turn transmission on or off. Takes effect on the next event, not the next launch. */
export function setTelemetryEnabled(on: boolean): void {
  enabled = on;
}

export function isTelemetryEnabled(): boolean {
  return enabled;
}

/**
 * Start the SDK when the user has said yes, and stop it when they take that back. Called with every
 * answer, so it is the one place the SDK's life is decided. Safe to call when there is no DSN - it
 * simply does nothing, which is the state of a checkout that has not been pointed at a Sentry project.
 */
export function startTelemetry(opts: {
  enabled: boolean;
  release?: string;
  environment?: string;
}): void {
  enabled = opts.enabled;
  if (!SENTRY_DSN) {
    return;
  }
  if (!opts.enabled) {
    if (started) {
      started = false;
      generation++;
      // The gate below already drops every JS event; closing is what stops the native side.
      const done: Promise<void> = (closing ?? Promise.resolve())
        .then(() => Sentry.close())
        .catch(() => {})
        .then(() => {
          if (closing === done) {
            closing = null;
          }
        });
      closing = done;
    }
    return;
  }
  if (started) {
    return;
  }
  started = true;
  const mine = ++generation;
  if (closing) {
    void closing.then(() => {
      if (generation === mine) {
        init(opts);
      }
    });
  } else {
    init(opts);
  }
}

function init(opts: { release?: string; environment?: string }): void {
  Sentry.init({
    dsn: SENTRY_DSN,
    release: opts.release,
    environment: opts.environment ?? 'development',
    // Performance. Principle I says the UI thread is never blocked; nothing has ever measured that.
    tracesSampleRate: 1.0,
    // Everything below is about not collecting things we have no business collecting.
    //
    // `@sentry/core` deprecates `sendDefaultPii` for `dataCollection`, but that advice cannot be
    // followed here yet: @sentry/react-native 8.26 redeclares `sendDefaultPii` without the deprecation
    // and leaves `dataCollection` out of `ReactNativeOptions` altogether (`Omit<Options, ... |
    // 'dataCollection'>`, dist/js/options.d.ts). Revisit when the React Native SDK exposes it.
    sendDefaultPii: false,
    attachStacktrace: true,
    // Release-health sessions are sent by the native SDKs with a random ID made once per install and
    // kept (`did`), and they pass through none of the hooks below. Nobody reads crash-free-session
    // rates for this app, so they are not worth a persistent identifier (2026-09-24).
    enableAutoSessionTracking: false,
    // Turns off `httpClientIntegration`, which captures failed requests AS ERRORS with their URL,
    // headers and body. It does NOT turn off automatic HTTP SPANS - that is a separate mechanism,
    // handled by the integration override below, and mistaking one for the other is how ISDS request
    // lines would have gone out under a flag that reads like it prevents exactly that.
    enableCaptureFailedRequests: false,
    // The default `reactNativeTracingIntegration` instruments XMLHttpRequest, and React Native's
    // `fetch` IS XMLHttpRequest (`Libraries/Network/fetch.js` → `whatwg-fetch`). Every ISDS SOAP call
    // would therefore become an `http.client` span whose description is the request line. Dedup in
    // `getIntegrationsToSetup` keeps the LAST instance of a given integration name, so listing it
    // here replaces the default rather than adding a second one.
    //
    // Nothing is lost: the spans worth having are the ones `measure()` creates deliberately, named
    // from the `Op` union above. Navigation and app-start tracing are untouched.
    integrations: defaults => [
      ...defaults,
      Sentry.reactNativeTracingIntegration({
        traceXHR: false,
        traceFetch: false,
      }),
    ],
    beforeBreadcrumb: crumb => {
      if (!enabled) {
        return null;
      }
      // A console breadcrumb replays whatever was logged, which in this app includes envelopes.
      if (crumb.category === 'console') {
        return null;
      }
      return crumb;
    },
    beforeSend: event => gate(event),
    // NOT the same hook, and this is the whole point of it existing. `beforeSend` runs for ERROR
    // events only: the SDK checks `isErrorEvent(event)` before calling it and routes anything of type
    // 'transaction' here instead. With `tracesSampleRate` set and no callback on this side, every
    // performance transaction went out having passed neither the consent check nor the scrubber -
    // the switch in Settings said "off" and the SDK kept transmitting. Same gate, same scrubber.
    beforeSendTransaction: event => gate(event),
  });
  // With no user set, the native SDKs put that same per-install ID into `user.id` of a native crash,
  // which never reaches `beforeSend`. A fixed value in its place: every report says the same thing.
  // (Android also keeps it in `contexts.device.id`, which no option removes - the privacy policy says
  // so.)
  try {
    Sentry.setUser({ id: ANONYMOUS_USER });
  } catch {
    // a failure here costs nothing but the stand-in
  }
  setStaticContext(opts.release);
}

/**
 * The consent check and the scrubber, as one function, so the two event paths cannot drift.
 *
 * Returning `null` drops the event.
 */
function gate<T>(event: T): T | null {
  if (!enabled) {
    return null; // consent, decided in exactly one place
  }
  try {
    return scrubEvent(event as never, redactions) as never;
  } catch {
    // The scrubber failing is not a reason to send an unscrubbed event. It is a reason to send
    // nothing: this runs on the crash path, and "fail open" here means leaking someone's mail.
    return null;
  }
}

/**
 * The facts that are true of every report from this device, set once.
 *
 * A stack trace with no platform or OS version behind it is a guess: half the failures this app can
 * have are one vendor's Keystore, one OS version's file provider, or the emulator. All of these keys
 * are already on `ALLOWED_KEYS`, and nothing here is derived from a person or their mail.
 */
function setStaticContext(release?: string): void {
  try {
    Sentry.setTags(
      scrubContext(
        {
          platform: Platform.OS,
          osVersion: String(Platform.Version),
          appVersion: release ?? 'unknown',
        },
        NO_REDACTIONS,
      ) as Record<string, string>,
    );
  } catch {
    // context is a convenience; never worth an exception at startup
  }
}

/**
 * Report a failure that the app has already handled.
 *
 * Handled is the point. Every call site keeps whatever graceful degradation it had - this reports
 * and returns, it never throws and never changes control flow. Principle II is unaffected; the only
 * thing that changes is that somebody can now find out.
 */
export function reportFailure(
  op: Op,
  error: unknown,
  context: FailureContext = {},
): void {
  // The debug recorder first, and deliberately BEFORE the consent and DSN gates below. It is a
  // different channel with a different trust model: nothing it records leaves the phone unless the
  // user hands the file over themselves, so telemetry consent has no bearing on it. It is a no-op
  // unless the user has switched Debug mode on, which is a decision they make per session.
  recordDebug('failure', `${op}: ${errorText(error)}`, {
    ...context,
    stack: error instanceof Error ? error.stack : undefined,
  });
  if (!enabled || !started) {
    return;
  }
  try {
    const err =
      error instanceof Error
        ? error
        : new Error(typeof error === 'string' ? error : 'non-error thrown');
    Sentry.captureException(err, {
      tags: scrubContext(
        { op, errorClass: err.name, ...context },
        redactions,
      ) as Record<string, string>,
      level: 'error',
    });
  } catch {
    // Telemetry must never become the thing that breaks the app it is watching.
  }
}

/**
 * Leave a trail, so a report says what led up to the failure rather than only where it landed.
 *
 * Same allow-list as everything else: a message from a fixed set, plus scrubbed context.
 */
export function trace(op: Op, context: FailureContext = {}): void {
  recordDebug('trace', op, { ...context }); // see the note in `reportFailure`
  if (!enabled || !started) {
    return;
  }
  try {
    Sentry.addBreadcrumb({
      category: 'app',
      level: 'info',
      message: op,
      data: scrubContext({ op, ...context }, redactions),
    });
  } catch {
    // as above
  }
}

/**
 * Time an operation and report how long it took.
 *
 * The Principle I instrument. `startTelemetry` is what makes it real; without a DSN this is a
 * transparent pass-through that costs one promise.
 */
export async function measure<T>(
  op: Op,
  fn: () => Promise<T>,
  context: FailureContext = {},
): Promise<T> {
  if (!enabled || !started) {
    return fn();
  }
  return Sentry.startSpan({ name: op, op }, async span => {
    const startedAt = Date.now();
    try {
      return await fn();
    } finally {
      const durationMs = Date.now() - startedAt;
      try {
        span?.setAttributes(
          scrubContext({ ...context, durationMs }, redactions) as Record<
            string,
            string | number | boolean
          >,
        );
      } catch {
        // a measurement is never worth an exception
      }
    }
  });
}
