// Focus a field when its screen opens - the thing `autoFocus` looks like it does and does not.
//
// TWO separate reasons it does not, and a fix needs to answer both:
//
//   1. **Tamagui's `Input` never forwards `autoFocus` to the native `TextInput`.** A render test on
//      `OtpForm` showed the real input receiving `textContentType`, `keyboardType` and
//      `autoComplete` - and no `autoFocus` at all. So the prop has been decorative wherever it was
//      written. Reported from an iPhone on 2026-08-19, where it cost more than a keyboard: iOS
//      offers a Security Code AutoFill suggestion above a FOCUSED field, and there was none.
//
//   2. **A focus request made while a screen is still animating in is dropped.** Even focusing
//      imperatively on mount fights the push transition on both platforms; the keyboard can come up
//      and immediately go away again.
//
// Both screens that need this had solved it separately - `OtpForm` with a 120 ms timeout,
// `SearchScreen` (2026-09-09) with the native stack's `transitionEnd` event. Two answers to one
// question is how the next screen gets a third, so this is the one answer. It prefers
// `transitionEnd`, which is the precise signal rather than a guess at how long an animation takes,
// and falls back to the timeout for a screen mounted OUTSIDE a navigator - which the sign-in flow
// is, since it lives at the shell level rather than in the stack.
//
// `InteractionManager.runAfterInteractions`, the recipe usually suggested for this, is deprecated in
// React Native 0.86 and warns at runtime.

import { useContext, useEffect, type RefObject } from 'react';
import { NavigationContext } from '@react-navigation/native';
import type { TextInput } from 'react-native';

/** How long to wait when there is no transition to listen to. Long enough for a modal to settle. */
const SETTLE_MS = 120;

/**
 * Focus `ref` once the screen it lives on has finished arriving.
 *
 * Pass `enabled: false` for a field that should only be focused under some condition; the hook still
 * runs (rules of hooks) and simply does nothing.
 */
export function useAutoFocus(
  ref: RefObject<TextInput | null>,
  enabled = true,
): void {
  // `useNavigation()` throws outside a navigator, and one caller genuinely is outside one. Reading
  // the context directly gives `undefined` there instead, which is the branch we want.
  const navigation = useContext(NavigationContext);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const focus = () => ref.current?.focus();

    if (navigation) {
      // The native stack emits this when the push animation completes - exactly when a focus
      // request stops being dropped.
      const stop = navigation.addListener(
        'transitionEnd' as never,
        focus as never,
      );
      // A screen that is already settled when this mounts (a replace, a deep link straight to it)
      // may never emit `transitionEnd`, so ask once anyway. Focusing twice is harmless.
      const id = setTimeout(focus, SETTLE_MS);
      return () => {
        stop();
        clearTimeout(id);
      };
    }

    const id = setTimeout(focus, SETTLE_MS);
    return () => clearTimeout(id);
  }, [ref, enabled, navigation]);
}
