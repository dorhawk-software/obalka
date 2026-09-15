// The RN preset transforms .js/.ts/.tsx. `scripts/*.mjs` is dev tooling written as ESM, and one of
// those scripts — the dependency-audit gate — has logic worth testing, so .mjs is added to both the
// transform and the resolvable extensions. The preset's own entries are spread rather than retyped:
// a hand-copied transform map silently goes stale the next time React Native changes it.
const rnPreset = require('@react-native/jest-preset');

module.exports = {
  preset: '@react-native/jest-preset',
  transform: { ...rnPreset.transform, '^.+\\.mjs$': 'babel-jest' },
  // The suite renders as iOS - `Platform.OS` is 'ios' and `.ios.js` files resolve - unless a test flips
  // `Platform.OS` itself. The preset's default, stated here because the iOS clipping audit depends on
  // it: it judges what iOS draws, and the role components only lift a line for the ink on iOS.
  haste: { ...rnPreset.haste, defaultPlatform: 'ios' },
  moduleFileExtensions: ['js', 'mjs', 'json', 'jsx', 'ts', 'tsx', 'node'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  // Fails a test that rendered a Text iOS would clip (the check itself is wired in jest.setup.js).
  setupFilesAfterEnv: ['<rootDir>/jest.afterEnv.js'],
  // Jest's 5s default is tuned for unit tests. Several suites here are not: `encodeUtf8Async` and
  // `argon2idAsync` YIELD to the event loop between chunks - that is their whole purpose, so the UI
  // keeps moving (Principle I) - which means their runtime is bounded by event-loop turns rather
  // than by CPU, and `routeRegistry` mounts the entire navigator and visits every route.
  //
  // Those sit close enough to 5s that any contention tips them over. The suite was intermittently
  // red whenever a build, Metro and the tests competed for cores - three different files, same
  // cause - and a flaky suite is worse than a slow one: it trains people to re-run rather than read.
  //
  // A ceiling rather than per-test budgets, because the per-test list was already three long and
  // growing. It is still a real ceiling: the whole suite runs in about 15 seconds, so a single test
  // reaching 30 is a hang, and jest reports the slowest suites either way.
  testTimeout: 30_000,
  // Only treat *.test.* / *.spec.* as suites so shared test helpers can live under __tests__/helpers/.
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
  // `scripts/fixtures/` is a jest-shaped TOOL, not a suite: it is copied into a historical git
  // worktree by `make-backup-fixture.mjs` and run there, because jest is the only TypeScript runner
  // this repo has. Running it here would write a fixture from today's code, which is precisely the
  // thing the fixture exists to disprove.
  testPathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/helpers/',
    '/scripts/fixtures/',
    '/.fixture-worktree/',
    // Agent worktrees are full copies of the repo: without this, every suite ran once per copy. Only
    // under THIS root - a worktree's own root path contains `/.claude/` as well.
    '<rootDir>/.claude/',
  ],
  // The same copies, each with its own package.json, made jest-haste-map warn of a name collision.
  modulePathIgnorePatterns: ['<rootDir>/.claude/'],
  // SVGs are React components via react-native-svg-transformer in Metro; stub them in jest.
  moduleNameMapper: {
    '\\.svg$': '<rootDir>/__mocks__/svgMock.js',
    // lucide-react-native resolves to an ESM .mjs under the react-native condition, which jest's
    // transform doesn't cover — point it at the package's CJS build instead.
    '^lucide-react-native$':
      '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
  },
  // Tamagui ships ESM; let babel transform it (and other ESM RN deps) instead of ignoring it.
  // decode-uri-component is pure ESM since 0.4.0 and is forced to 0.5.0 for a security fix (see
  // patches/query-string+7.1.3.patch); anything that mounts the navigator loads it.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|tamagui|@tamagui|react-native-safe-area-context|@react-navigation|react-native-screens|lucide-react-native|@noble|decode-uri-component)/)',
  ],
};
