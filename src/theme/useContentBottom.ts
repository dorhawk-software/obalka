import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Bottom padding for a screen's scrollable content - the mirror of `useHeaderTop`.
 *
 * It clears the home indicator / gesture bar **safe-area inset** and then adds the screen's own
 * trailing gap, so the last row of every list ends the same distance above the same hardware edge
 * (constitution V). The number a screen passes is the gap it wants ABOVE the system edge, never the
 * total.
 *
 * Four screens had hardcoded the gap alone (28, 28, 24, and the inbox's FAB clearance). That is
 * correct on a device with a hardware navigation bar, where the inset is 0 - and short by the whole
 * height of the gesture bar on every device that has one, which is why nothing looked wrong on the
 * emulator this app is developed against.
 */
export function useContentBottom(gap: number): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + gap;
}
