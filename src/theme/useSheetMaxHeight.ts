// How tall a bottom sheet may grow (2026-10-04): the window, less the status bar or notch, less one
// `section` step of the dim showing above it.
//
// Every sheet padded its BOTTOM for the home indicator and nothing capped its top. A sheet whose
// content - more boxes, the largest text size, a raised keyboard - outgrew the window rose past the
// status bar, where its title and handle could not be read or grabbed. A sheet takes this as its
// `maxHeight` and scrolls what it holds once it reaches it. `__tests__/theme/overlaySafeArea.test.ts`
// holds every modal to it.

import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space } from './spacing';

export function useSheetMaxHeight(): number {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return height - insets.top - space.section;
}
