// Swipe-DOWN-to-dismiss for the bottom sheets (the box switcher, the per-box ⋯ menu, the Termín
// picker). All three had a byte-identical copy of this pan; one copy now, so a threshold cannot drift
// between sheets that are meant to feel the same (Principle V).
//
// Used as the `<SheetDismissGesture>` wrapper rather than the bare hook, so the native pan handler
// lives exactly as long as the sheet's content: a hook-API gesture registers its handler with the
// native side on mount, where a builder-API `Gesture.Pan()` did not until a detector received it -
// and the ⋯ menu's host renders on every row of the switcher while its sheet is closed.
//
// Gesture Handler's hook API: an inline object literal passed to `usePanGesture` is workletized by
// `react-native-worklets/plugin` (it lists `usePanGesture` among its object hooks), so `onUpdate` and
// `onDeactivate` run on the UI thread, exactly as the builder chain's callbacks did. `onDeactivate`
// fires on the same transitions the builder's `onEnd` did - out of ACTIVE into END, FAILED or
// CANCELLED - and neither version looks at whether it succeeded.

import type { ReactNode } from 'react';
import { GestureDetector, usePanGesture, type PanGesture } from 'react-native-gesture-handler';
import { withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

/** How far down (pt) the sheet must be dragged to activate - taps on the rows still work below it. */
export const SHEET_PAN_ACTIVE_OFFSET_Y = 12;
/** Released past this drag (pt), the sheet dismisses. */
export const SHEET_DISMISS_DISTANCE = 90;
/** …or flicked faster than this (pt/s). */
export const SHEET_DISMISS_VELOCITY = 800;

/**
 * The pan for a sheet whose `translateY` is `dragY` (0 at rest). Dragging follows the finger
 * downward only; releasing past the distance or velocity slides the sheet off-screen and THEN calls
 * `onDismiss` on the JS thread, otherwise it springs back.
 */
export function useSheetDismissPan(
  dragY: SharedValue<number>,
  onDismiss: () => void,
): PanGesture {
  return usePanGesture({
    activeOffsetY: SHEET_PAN_ACTIVE_OFFSET_Y,
    onUpdate: e => {
      dragY.value = Math.max(0, e.translationY);
    },
    onDeactivate: e => {
      if (e.translationY > SHEET_DISMISS_DISTANCE || e.velocityY > SHEET_DISMISS_VELOCITY) {
        // Slide fully off-screen, THEN dismiss (which unmounts the sheet - already off-screen, so no
        // abrupt jump). Don't snap dragY back here: it would flash the sheet up mid-close.
        dragY.value = withTiming(600, { duration: 180 }, finished => {
          if (finished) {
            scheduleOnRN(onDismiss);
          }
        });
      } else {
        dragY.value = withTiming(0, { duration: 160 });
      }
    },
  });
}

/** Wraps a sheet's animated body (the view whose `translateY` is `dragY`) in its dismiss pan. */
export function SheetDismissGesture({
  dragY,
  onDismiss,
  children,
}: {
  readonly dragY: SharedValue<number>;
  readonly onDismiss: () => void;
  readonly children: ReactNode;
}) {
  const pan = useSheetDismissPan(dragY, onDismiss);
  return <GestureDetector gesture={pan}>{children}</GestureDetector>;
}
