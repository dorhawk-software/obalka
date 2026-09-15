// Per-box ISDS session isolation.
//
// The native cookie jar (RN's OkHttp ↔ WebView CookieManager) is per-DOMAIN, but ISDS cookie-based
// sessions (OTP + Mobile Key) are per-BOX: every such box authenticates its WS calls by riding the
// `IPCZ-X-COOKIE` set at login. With one shared jar, a second box's login OVERWRITES the first's
// cookie (same name+domain) - so Box A would 401 or, worse, read Box B's mail. It also leaves a stale
// cookie behind after a box is removed, which poisons the next handshake (the remove+re-add 400).
//
// Fix: never let the jar be the source of truth for WS calls. We CAPTURE each box's cookies at login,
// store them per box, REPLAY them explicitly on that box's calls, and CLEAR the jar around logins.

import CookieManager from '@react-native-cookies/cookies';

export interface CookieJar {
  /** Wipe every cookie from the native jar (around a login, however it ends). */
  clearAll(): Promise<void>;
  /**
   * Snapshot the cookies the jar currently holds for `hostUrl`, serialized as a `Cookie:` header
   * value (e.g. `IPCZ-X-COOKIE=…; JSESSIONID=…`), or null if there are none. Captured right after a
   * login POST so we own that box's whole session, then replayed on its WS calls.
   */
  readSession(hostUrl: string): Promise<string | null>;
}

/** Real jar backed by @react-native-cookies (reads/writes the same WebView store RN's fetch uses). */
export class NativeCookieJar implements CookieJar {
  async clearAll(): Promise<void> {
    await CookieManager.clearAll();
  }

  async readSession(hostUrl: string): Promise<string | null> {
    const cookies = await CookieManager.get(hostUrl);
    const pairs = Object.values(cookies).map(c => `${c.name}=${c.value}`);
    return pairs.length > 0 ? pairs.join('; ') : null;
  }
}

/** No-op jar for environments without the native module (e.g. unit tests that don't exercise sessions). */
export class NoopCookieJar implements CookieJar {
  async clearAll(): Promise<void> {}
  async readSession(): Promise<string | null> {
    return null;
  }
}
