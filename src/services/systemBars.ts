// The navigation bar's icon appearance, and the appearance the app launched in last time.
//
// React Native's `StatusBar` covers the top edge and re-applies on every render. The bottom edge has
// no such component: RN sets `isAppearanceLightNavigationBars` once, at Activity create, from the
// OS theme - see `SystemBarsModule.kt` for the whole story. This is the JS side of that module.
//
// Android-only by nature. On iOS the home indicator has no light/dark variant to set, and the launch
// screen is a storyboard rather than a themed window, so both calls are no-ops there.

import { NativeModules, Platform } from 'react-native';
import { reportFailure } from './telemetry/telemetry';

interface SystemBarsNative {
  /** `true`/`false` if the app has run before and stored an appearance, `null` on a first launch. */
  lastAppearanceIsDark?: boolean | null;
  setAppearance?: (isDark: boolean) => void;
}

const native: SystemBarsNative | undefined =
  Platform.OS === 'android'
    ? (NativeModules.SystemBars as SystemBarsNative | undefined)
    : undefined;

/**
 * The appearance the app was in when it was last used, or `null` when there is nothing to go on -
 * a first launch, a different platform, or a build where the module is missing.
 *
 * Read synchronously at import so the very first frame can use it. Settings live in the encrypted
 * database behind an async read, so without this the app paints its pre-settings frame in the OS's
 * appearance and a user whose choice differs sees it flash.
 */
export const lastAppearanceIsDark: boolean | null =
  native?.lastAppearanceIsDark ?? null;

/**
 * Point the system navigation bar at the app's own appearance, and remember it for the next launch.
 *
 * Safe to call on every appearance change and safe to call when the module is absent - a missing
 * navigation-bar tint is a cosmetic loss, never something to surface to a user.
 */
export function setSystemBarsAppearance(isDark: boolean): void {
  try {
    native?.setAppearance?.(isDark);
  } catch (e) {
    // An OEM controller that refuses, or a window torn down mid-transition. Nothing to recover -
    // but a navigation bar that is the wrong colour on one vendor's phone is a bug report nobody
    // can write, because it looks like the app was simply built that way.
    reportFailure('systemBars', e, { stage: 'native' });
  }
}
