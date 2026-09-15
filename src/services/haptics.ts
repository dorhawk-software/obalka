// Tactile haptics - the defining 2026 mobile trend (Material 3 Expressive's "feel different" + iOS's
// compound-gesture feedback): a UI shouldn't only LOOK responsive, it should be felt. Used sparingly on
// the few interactions where a physical tick adds real confidence, never as decoration.
//
// Thin semantic wrapper over react-native-haptic-feedback (iOS UIFeedbackGenerator / Android
// VibrationEffect). Fully GUARDED: if the native module isn't linked (e.g. a JS bundle running on an
// app build that predates the dependency) or under tests, every call is a silent no-op - feedback must
// never throw inside a tap/swipe handler. Respects the OS "system haptics" setting on Android.

import { NativeModules, TurboModuleRegistry } from 'react-native';

type Kind = 'selection' | 'light' | 'medium' | 'success' | 'warning' | 'error';

/** Our semantic kinds → the library's feedback types. */
const TYPE: Record<Kind, string> = {
  selection: 'selection', // a tab/segment switch - the lightest tick
  light: 'impactLight', // a light confirmation (pull-to-refresh, sheet open)
  medium: 'impactMedium', // a committed action with weight (swipe-to-delete)
  success: 'notificationSuccess', // an action succeeded (message sent)
  warning: 'notificationWarning', // a caution/gate (a paid-send confirm appears)
  error: 'notificationError', // an action failed
};

const OPTIONS = {
  enableVibrateFallback: false, // don't fake a haptic with a crude buzz on devices without a Taptic Engine
  ignoreAndroidSystemSettings: false, // honour the user's system haptics toggle
};

// Is the native module actually registered? Checked NON-throwingly (`TurboModuleRegistry.get` /
// `NativeModules` both return null when absent - only `getEnforcing` throws). This MUST run before we
// import react-native-haptic-feedback, because that library calls `getEnforcing` at import time, which
// would red-box/crash on a JS bundle whose app build predates the dependency (e.g. an un-rebuilt APK).
function nativeAvailable(): boolean {
  try {
    return (
      (typeof TurboModuleRegistry?.get === 'function' &&
        TurboModuleRegistry.get('RNHapticFeedback') != null) ||
      NativeModules?.RNHapticFeedback != null
    );
  } catch {
    return false;
  }
}

// Resolve the native trigger once, tolerating its total absence (unlinked build / jest).
let triggerFn: ((type: string, opts: object) => void) | null | undefined;
function resolveTrigger(): ((type: string, opts: object) => void) | null {
  if (triggerFn === undefined) {
    triggerFn = null;
    if (nativeAvailable()) {
      try {
        // Only NOW is it safe to import - the enforcing check inside won't throw.
        triggerFn = require('react-native-haptic-feedback').default.trigger;
      } catch {
        triggerFn = null;
      }
    }
  }
  return triggerFn ?? null;
}

function fire(kind: Kind): void {
  try {
    resolveTrigger()?.(TYPE[kind], OPTIONS);
  } catch {
    // A missing/failed haptic must never break the interaction it accompanies.
  }
}

/** Semantic haptic feedback. Each method is a guarded no-op when haptics are unavailable. */
export const haptics = {
  /** A tab / segment switch or option pick. */
  selection: () => fire('selection'),
  /** A light confirmation - pull-to-refresh fired, a sheet opened. */
  light: () => fire('light'),
  /** A committed action that carries weight - a swipe-to-delete commit. */
  medium: () => fire('medium'),
  /** An action succeeded - a message was sent. */
  success: () => fire('success'),
  /** A caution / decision gate - a paid-send confirmation appeared. */
  warning: () => fire('warning'),
  /** An action failed. */
  error: () => fire('error'),
};
