// Mock for @react-native-cookies/cookies (feature 018).
//
// The real package is ESM and untransformed by jest, and it is a native module besides. It became a
// test-time problem the moment anything actually IMPORTED `cookieJar.ts` — which is to say, the
// moment the isolation stopped being dead code.
//
// Backed by a real in-memory store rather than bare `jest.fn()`s, so a test can assert the thing that
// matters: a session captured for one box is not the session another box's login left behind.

const store = new Map();

const CookieManager = {
  async get(url) {
    return store.get(url) ?? {};
  },
  async set(url, cookie) {
    const forUrl = store.get(url) ?? {};
    forUrl[cookie.name] = cookie;
    store.set(url, forUrl);
    return true;
  },
  async clearAll() {
    store.clear();
    return true;
  },
  /** Test-only helper: seed what the native jar would hold after a login. */
  __seed(url, pairs) {
    store.set(
      url,
      Object.fromEntries(
        Object.entries(pairs).map(([name, value]) => [name, { name, value }]),
      ),
    );
  },
  __reset() {
    store.clear();
  },
};

module.exports = CookieManager;
module.exports.default = CookieManager;
