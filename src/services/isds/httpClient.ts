// HTTP boundary for the ISDS transport (feature 001).
//
// The transport logic depends on this small interface so it can be unit-tested with a fake. The real
// `FetchHttpClient` is the only device/network part: a thin wrapper over the platform's native
// `fetch` (which runs off the JS thread and uses the native cookie store for the ISDS session).

import { TransportNetworkError, TransportTimeoutError } from './transport';
import { reportFailure, trace, type HostLabel } from '../telemetry/telemetry';
import { recordBody } from '../debug/debugLog';

export interface HttpRequest {
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  signal: AbortSignal;
  timeoutMs?: number;
  /**
   * Explicit `Cookie:` header value for a per-box session (OTP / Mobile Key). When set we also bypass
   * the shared native jar (`credentials: 'omit'`) so ONLY this box's captured session is sent - never
   * whichever box logged in last. See `cookieJar.ts`.
   */
  cookie?: string;
  /**
   * Whether to use the shared native cookie jar. Default true (the login POSTs need it to capture the
   * Set-Cookie). WS calls pass `false` so they never read/write the shared jar - they carry `cookie`
   * (OTP/Mobile Key) or HTTP Basic (password) explicitly instead.
   */
  useJar?: boolean;
}

export interface HttpResponse {
  status: number;
  text: string;
  /** Response headers, keys lowercased for case-insensitive lookup. Optional so fakes can omit it. */
  headers?: Record<string, string>;
  /**
   * The URL that finally answered, after any redirects the native stack followed on its own. The only
   * trace of a redirect to the portal's sign-in page, which is how the portal turns away a request
   * without a session (`signInRedirect.ts`). Optional so fakes can omit it.
   */
  url?: string;
}

export interface HttpClient {
  send(req: HttpRequest): Promise<HttpResponse>;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Dependency-free UTF-8 Base64 (no Buffer/btoa) - portable across Node tests and React Native. */
export function base64(input: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    if (c < 0x80) {
      bytes.push(c);
    } else if (c < 0x800) {
      bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c >= 0xd800 && c <= 0xdbff) {
      const c2 = input.charCodeAt(++i);
      const cp = 0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff);
      bytes.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      );
    } else {
      bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? B64[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < bytes.length ? B64[b2 & 63] : '=';
  }
  return out;
}

export function basicAuthHeader(loginName: string, password: string): string {
  return `Basic ${base64(`${loginName}:${password}`)}`;
}

// --- What a report is allowed to say about a request ------------------------------------------
//
// Every ISDS call in the app passes through `FetchHttpClient.send` below, which makes this the one
// place where HTTP failures can be observed at all - and the one place where getting it wrong would
// put an ISDS request line into a crash report. So neither the URL nor the body is ever passed to
// telemetry. What goes instead is two labels, each MATCHED against a fixed list rather than derived
// from the string: an environment, and a service path. A URL that matches nothing reports 'other',
// which is the honest answer and cannot carry anything.

/**
 * Which ISDS environment, as the `Host` enum the rest of the app already uses. Never a hostname.
 *
 * Production is `'production'`, not the brand name of its domain. This used to answer
 * `'mojedatovaschranka'` while the callers that pass an account's `host` sent `'production'`, so one
 * environment reached reports under two spellings and a filter on either silently missed the other.
 * The return type is the telemetry `host` type, so a third spelling is a compile error.
 */
export function hostLabel(url: string): HostLabel {
  if (url.includes('datovka-test.gov.cz') || url.includes('czebox.cz')) {
    return 'czebox';
  }
  if (url.includes('datovka.gov.cz') || url.includes('mojedatovaschranka.cz')) {
    return 'production';
  }
  return 'other';
}

/**
 * The ISDS service paths, which are constants of the protocol.
 *
 * Matched against this list rather than parsed out of the URL: a parse would return whatever was in
 * the string, and the point is that only these values can ever be reported.
 *
 * Most specific first, because the match is `includes` and the first hit wins. With `/DS/dx` ahead of
 * `/apps/DS/dx`, every cookie-box call was reported as its password-box twin, and a `processLogin`
 * URL - whose query carries `uri={portal}/apps/DS/dz` - was reported as `/DS/dz`.
 */
const SERVICE_PATHS: readonly string[] = [
  '/as/processLogin',
  '/as/login',
  '/mep/login',
  '/mep/state',
  '/apps/DS/dz',
  '/apps/DS/dx',
  '/apps/DS/df',
  '/apps/DS/DsManage',
  '/apps/DS/vodz',
  '/DS/dz',
  '/DS/dx',
  '/DS/df',
  '/DS/DsManage',
  '/DS/vodz',
];

export function endpointLabel(url: string): string {
  const match = SERVICE_PATHS.find(path => url.includes(path));
  return match ?? 'other';
}

/** Real HTTP client over native fetch. Throws typed errors the AuthService maps to outcomes. */
export class FetchHttpClient implements HttpClient {
  async send(req: HttpRequest): Promise<HttpResponse> {
    const controller = new AbortController();
    const startedAt = Date.now();
    const host = hostLabel(req.url);
    const endpoint = endpointLabel(req.url);
    let timedOut = false;
    const onAbort = () => controller.abort();
    req.signal.addEventListener('abort', onAbort);
    const timer =
      req.timeoutMs != null
        ? setTimeout(() => {
            timedOut = true;
            controller.abort();
          }, req.timeoutMs)
        : undefined;
    try {
      const reqHeaders: Record<string, string> = { ...req.headers };
      if (req.cookie) {
        reqHeaders.Cookie = req.cookie; // explicit per-box session, replacing the shared jar
      }
      // The envelope itself, and ONLY when the user has put the app in Full debug mode. This is the
      // single thing a Sentry report can never carry and the single reason that mode exists: an ISDS
      // fault is often unreadable without the request that produced it. `recordBody` is a no-op at
      // every other level, and the credential strip runs inside it regardless.
      recordBody(`→ ${req.method} ${endpoint}`, req.body);
      const res = await fetch(req.url, {
        method: req.method,
        headers: reqHeaders,
        body: req.body,
        signal: controller.signal,
        // Login POSTs use the native jar to CAPTURE the Set-Cookie (`include`); WS calls pass
        // `useJar: false` so they never read/write the shared jar (`omit`) and instead carry their
        // box's session via `cookie` (OTP/Mobile Key) or HTTP Basic (password). See cookieJar.ts.
        credentials: req.useJar === false ? 'omit' : 'include',
      });
      const headers: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });
      const text = await res.text();
      recordBody(`← ${res.status} ${endpoint}`, text);
      // The trail every ISDS failure is read against. A 500 carrying a SOAP fault is the normal way
      // ISDS says no, so this is a breadcrumb and not a report - but a report that lands three calls
      // later is close to unreadable without the three that came before it.
      trace('isds.http', {
        host,
        endpoint,
        httpStatus: res.status,
        durationMs: Date.now() - startedAt,
        byteSize: text.length,
      });
      // `res.url` is empty when the platform does not report one; absent then, never the request's URL,
      // which would claim no redirect happened.
      return { status: res.status, text, headers, url: res.url || undefined };
    } catch (e: unknown) {
      const durationMs = Date.now() - startedAt;
      if (timedOut) {
        reportFailure('isds.http', new TransportTimeoutError(), {
          stage: 'transport',
          host,
          endpoint,
          durationMs,
        });
        throw new TransportTimeoutError();
      }
      if (req.signal.aborted) {
        // NOT reported, on purpose. The user navigating away cancels whatever was in flight; that is
        // the app working. Reporting it would bury the real failures under the commonest event in the
        // application.
        throw e;
      } // user cancellation - AuthService maps to 'cancelled'
      reportFailure('isds.http', e, {
        stage: 'transport',
        host,
        endpoint,
        durationMs,
      });
      throw new TransportNetworkError((e as Error)?.message);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
      req.signal.removeEventListener('abort', onAbort);
    }
  }
}
