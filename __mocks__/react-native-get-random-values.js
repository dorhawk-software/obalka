// Jest mock: the real package polyfills crypto.getRandomValues on-device; Node already provides it,
// so this side-effect import is a no-op in tests.
module.exports = {};
