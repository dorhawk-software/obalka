// A cookie box's call that the portal sent to its sign-in page (018 FR-006, amended 2026-09-15).
//
// A cookie box (OTP, Mobile Key) calls the portal's `/apps/DS/*`, which sits behind the portal's
// session gate. Asked without a session, that gate does not answer 401: it redirects to
// `as/login?...&status=NCOO` (probed without credentials on the test environment, 2026-09-14, 018 T006).
// The only lost-session answer the app recognised was the other one ISDS gives, a 200 carrying
// whitespace (captured from a production box, 2026-08-19).
//
// Neither native HTTP stack stops at a redirect. RN's fetch and react-native-blob-util both follow it,
// so what reaches JS is the sign-in page itself, as a 200 with markup in it - not "no XML", so not a
// lost session - and it surfaced as a server fault: "try again" for the download, where only signing in
// again helps. What is left of the redirect is where the request ended up, and, when a client does not
// follow it, the 3xx with its `Location`. Both are read here.
//
// Not a guess from the page: no sign-in page body has been captured, so nothing here reads one.

/** What a response says about the way it was reached. */
export interface AnswerTrail {
  status: number;
  /**
   * The URLs the request went through, in order, the one that answered last - blob-util's `redirects`,
   * or the final URL fetch reports. Empty or absent when the client does not say.
   */
  urls?: readonly string[];
  /** Response headers; `Location` is looked up whatever its case. */
  headers?: Readonly<Record<string, string>>;
}

/**
 * The portal's sign-in page, which is where the gate sends a request without a session.
 *
 * The path, anchored: an absolute URL, or a `Location` given as a path (resolved against the request,
 * which is always the portal here). A processLogin or Mobile Key URL is a login being performed, not a
 * request turned away, so it does not count. Matched by pattern because React Native's `URL` does not
 * implement `hostname`.
 */
const SIGN_IN_URL = /^(?:https?:\/\/([^/?#:@\s]+)(?::\d+)?)?\/as\/login(?![\w-])/i;

/**
 * The operator's domains, old and new (`endpoints.ts` records the 2026 move; the old ones still answer).
 *
 * An absolute sign-in URL counts only on one of these. Anything else between the phone and ISDS that
 * sends a request to a login page - a hotel or airport Wi-Fi gate is the common one - is not the box's
 * session ending, and telling that user to sign in to ISDS again would send them round a re-auth that
 * cannot work until they are past the Wi-Fi's own page.
 */
const ISDS_DOMAINS: readonly string[] = [
  'datovka.gov.cz',
  'datovka-test.gov.cz',
  'mojedatovaschranka.cz',
  'czebox.cz',
];

function isIsdsHost(host: string): boolean {
  const name = host.toLowerCase();
  return ISDS_DOMAINS.some(domain => name === domain || name.endsWith(`.${domain}`));
}

export function isSignInUrl(url: string | null | undefined): boolean {
  const found = url == null ? null : SIGN_IN_URL.exec(url.trim());
  return found != null && (found[1] == null || isIsdsHost(found[1]));
}

function locationOf(headers: AnswerTrail['headers']): string | undefined {
  if (headers == null) {
    return undefined;
  }
  const key = Object.keys(headers).find(name => name.toLowerCase() === 'location');
  return key == null ? undefined : headers[key];
}

/**
 * Whether the portal turned this request away to its sign-in page: the request was redirected there
 * and followed, or the 3xx that would have sent it there came back unfollowed.
 *
 * Callers apply it to cookie boxes only. A password box goes to `ws1`/`ws2`, which answer HTTP Basic
 * with a real 401; the same page there would be a misrouted request, not a session to renew.
 */
export function redirectedToSignIn(answer: AnswerTrail): boolean {
  if ((answer.urls ?? []).some(isSignInUrl)) {
    return true;
  }
  return answer.status >= 300 && answer.status < 400 && isSignInUrl(locationOf(answer.headers));
}
