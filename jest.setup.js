/* eslint-env jest, node */
// Use the library's official mock for react-native-safe-area-context so any screen that reads
// useSafeAreaInsets / renders SafeAreaProvider works under jest without each suite wrapping a real
// provider (returns zero insets + passthrough components). Needed since the shell-level TestEnvBanner
// (and others) read the safe-area inset.
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

// Reanimated + gesture-handler are native (their real gesture/animation is verified on-device, not in
// jest). Mock just what SwipeableRow uses so screens that embed it render in tests: `useReducedMotion`
// (toggle it in a test to exercise the reduce-motion fallback) and a ReanimatedSwipeable that simply
// renders the row plus its trailing actions inline (so the action's label/testID is assertable).
jest.mock('react-native-reanimated', () => {
  const RN = require('react-native');
  return {
    __esModule: true,
    default: {
      View: RN.View,
      ScrollView: RN.ScrollView,
      createAnimatedComponent: c => c,
    },
    useReducedMotion: jest.fn(() => false),
    useSharedValue: v => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withTiming: v => v,
    withSpring: v => v,
    withRepeat: v => v,
    cancelAnimation: () => {},
    Easing: { inOut: fn => fn, ease: v => v },
    SlideInDown: { duration: () => ({}) },
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
  };
});

jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ children, renderRightActions, testID }) =>
      React.createElement(
        View,
        { testID },
        children,
        renderRightActions ? renderRightActions() : null,
      ),
  };
});

// App.tsx wraps the tree in GestureHandlerRootView (from the main module); stub it to a plain View so
// the app renders in jest without the native gesture-handler module.
jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View, Pressable } = require('react-native');
  return {
    __esModule: true,
    GestureHandlerRootView: ({ children, style }) =>
      React.createElement(View, { style }, children),
    // gesture-handler's Pressable behaves like RN's in tests (onPress / a11y / pressed-style callback).
    Pressable,
    GestureDetector: ({ children }) => children,
    // The hook API's pan: hands back its config, so a suite can read the thresholds a screen set and
    // drive its callbacks by hand (`usePanGesture.mock.results`). Nothing is recognised in jest.
    usePanGesture: jest.fn(config => ({ config })),
  };
});

// react-native-worklets: `scheduleOnRN` hops from the UI thread back to JS. Under jest there is one
// thread, so it is a plain, synchronous call.
jest.mock('react-native-worklets', () => ({
  __esModule: true,
  scheduleOnRN: (fn, ...args) => {
    fn(...args);
  },
}));

// `requestIdleCallback` is a global on the device (React Native installs it from its runtime
// scheduler) but not in jest's node environment. Stood in for by the next timer turn: "after the work
// already queued", which is what the app asks of it (`app/useAfterPressSettles.ts`).
if (typeof global.requestIdleCallback !== 'function') {
  global.requestIdleCallback = callback =>
    setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 50 }), 0);
  global.cancelIdleCallback = id => clearTimeout(id);
}

// react-native-haptic-feedback: no native module in jest — mock its trigger so the haptics wrapper is
// recordable (the semantic wiring is unit-tested; the physical feel is validated on-device).
jest.mock('react-native-haptic-feedback', () => ({
  __esModule: true,
  default: { trigger: jest.fn() },
}));
// The wrapper guards on native-module availability (so an un-rebuilt bundle never crashes); make that
// check pass under jest so the wrapper actually invokes the mocked trigger.
try {
  require('react-native').NativeModules.RNHapticFeedback = {};
} catch (e) {
  /* RN preset not ready — the wrapper just stays a no-op, which is also safe */
}


// @sentry/react-native has no native module under jest, and its ESM entry is outside the transform
// allow-list. Mocked here rather than added to `transformIgnorePatterns` because nothing in a unit
// test should reach a real SDK that opens sockets and installs crash handlers.
//
// The mock is deliberately a set of `jest.fn()`s rather than no-ops: `telemetry.test.ts` asserts on
// what would have been sent — including the property that matters most, that nothing is sent when
// consent is off.
jest.mock('@sentry/react-native', () => ({
  __esModule: true,
  init: jest.fn(),
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
  startSpan: jest.fn((_opts, fn) => fn({ setAttributes: jest.fn() })),
  setUser: jest.fn(),
  setTags: jest.fn(),
  close: jest.fn(),
  // `App.tsx` exports `Sentry.wrap(App)` - kept from the wizard because it measures app start and
  // time-to-initial-display. A passthrough here: the real one is inert until `Sentry.init` has run,
  // which under jest it never does (no DSN), so the identity function IS its behaviour in tests.
  wrap: jest.fn(component => component),
  // Named so `telemetryTransport.test.ts` can assert that the DEFAULT tracing integration is being
  // replaced — the override is what stops every ISDS request becoming an http.client span.
  reactNativeTracingIntegration: jest.fn(options => ({
    name: 'ReactNativeTracing',
    options,
  })),
}));

// Every Text a test renders is held to the iOS clipping model (`__tests__/helpers/textAudit.tsx`):
// iOS cuts a glyph at the edge of its line box where Android paints past it, so an iPhone showed the
// attention count without the top of its "2" while every Android screen and every test looked right
// (2026-09-24). React Native's `Text` becomes the preset's own mock with that check around it, and
// jest.afterEnv.js fails the test that rendered a Text iOS would clip.
jest.mock('react-native/Libraries/Text/Text', () => {
  const { auditedText } = require('./__tests__/helpers/textAudit');
  const PresetText = jest.requireActual(
    '@react-native/jest-preset/jest/mocks/Text',
  ).default;
  return { __esModule: true, default: auditedText(PresetText) };
});
