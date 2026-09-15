// Imperative navigation ref (feature 011): a container ref so code OUTSIDE the React tree - the
// notification deep-link handler - can drive navigation (open a message, return to the inbox) without
// a `navigation` prop. Wired into AppNavigator's <NavigationContainer ref={navigationRef}>. Calls are
// guarded by `isReady()` so a navigate before the container mounts is a safe no-op (Principle II - the
// cold-start tap is queued in the deep-link router until the navigator + accounts are ready).

import {
  CommonActions,
  createNavigationContainerRef,
  StackActions,
} from '@react-navigation/native';
import type { RootStackParamList } from './AppNavigator';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/** Navigate by route name + params, but only once the container is mounted. Never throws. */
export function navigate(
  name: keyof RootStackParamList,
  params?: RootStackParamList[keyof RootStackParamList],
): void {
  try {
    if (navigationRef.isReady()) {
      // The action the ref's own `navigate(name, params)` dispatches (the container maps each
      // `CommonActions` creator to `dispatch(CommonActions[name](...args))`), built directly: the
      // ref's `navigate` is typed per route, which a name/params pair taken as unions cannot satisfy,
      // and reaching it through a cast lands on its deprecated object overload. No merge, no pop.
      navigationRef.dispatch(CommonActions.navigate(name, params));
    }
  } catch {
    // best-effort imperative nav - never crash the caller (a notification tap)
  }
}

/** Pop everything back to the root inbox. Safe no-op before the container mounts. */
export function resetToInbox(): void {
  try {
    if (navigationRef.isReady() && navigationRef.canGoBack()) {
      navigationRef.dispatch(StackActions.popToTop());
    }
  } catch {
    // best-effort - never crash
  }
}
