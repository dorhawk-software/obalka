const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const path = require('path');
const { withSentryConfig } = require('@sentry/react-native/metro');

const defaultConfig = getDefaultConfig(__dirname);
const { assetExts, sourceExts } = defaultConfig.resolver;

// Directories that are never JavaScript this app imports: agent worktrees (`.claude/worktrees/`,
// whole copies of this repo) and native build output. Metro watched all of it, and after a native
// build or with a few worktrees open it ran out of inotify watches and died with ENOSPC mid-session.
// The block list is also what Metro's watcher ignores, so this keeps them out of both. Anchored to
// THIS checkout, because a worktree's own path contains `.claude/` too.
const escapeRegExp = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const unwatched = [
  '.claude',
  'android/.gradle',
  'android/build',
  'android/app/build',
  'android/app/.cxx',
  'ios/build',
  'ios/Pods',
]
  .map(dir => new RegExp(`^${escapeRegExp(path.join(__dirname, dir))}([/\\\\]|$)`))
  // Each native package's own Gradle output, which a native build writes into node_modules.
  .concat(
    new RegExp(
      `^${escapeRegExp(path.join(__dirname, 'node_modules'))}[/\\\\].+[/\\\\]android[/\\\\](build|\\.cxx)([/\\\\]|$)`,
    ),
  );

/**
 * Metro configuration. SVGs are imported as React components via react-native-svg-transformer.
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  transformer: {
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
  },
  resolver: {
    assetExts: assetExts.filter(ext => ext !== 'svg'),
    sourceExts: [...sourceExts, 'svg'],
    blockList: [].concat(defaultConfig.resolver.blockList ?? [], unwatched),
  },
};

// `withSentryConfig` adds the source-map upload hook to the bundler, which is what turns a release
// stack trace from `index.android.bundle:1:284729` into a file and a line. Applied ONCE, and keep
// it that way: `npx @sentry/wizard` is NOT idempotent. It has been run three times here (a US org,
// then the EU one, then the Dorhawk org) and every single time it appended another import of this
// binding and wrapped the export in another call. Two `const`s of the same name at module scope is
// a SyntaxError, so Metro does not start at all - the failure is loud, but only once you try to
// bundle. If you rerun the wizard, check this file before anything else.
module.exports = withSentryConfig(mergeConfig(defaultConfig, config));
