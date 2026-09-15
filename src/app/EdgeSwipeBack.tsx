// Back affordance for screens that live OUTSIDE the native-stack navigator (the add-box / reauth flows
// are AppShell-level routes, so they get neither iOS's native back-swipe nor a hooked-up Android back).
//
// - iOS: swipe-from-the-left-edge to go back - a horizontal right-drag slides the screen and, past a
//   threshold / flick, calls onBack; otherwise it snaps back. Runs on the native UI thread.
// - Android: the SYSTEM back (button / edge gesture) is intercepted to call onBack (go home) instead of
//   exiting the app. We do NOT add an app-level edge pan there - it would fight the system edge gesture.
//
// When there's nowhere to go back to (no onBack), it's a transparent passthrough.

import { useEffect, type ReactNode } from 'react';
import { BackHandler, Platform, View, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useTheme } from '../theme/ThemeProvider';

export function EdgeSwipeBack({
  onBack,
  children,
  systemBack = true,
}: {
  readonly onBack?: () => void;
  readonly children: ReactNode;
  /**
   * False for a screen that answers Android's system back itself - the backup screen, whose back asks
   * before leaving a run. Registered after the screen's own handler, this one would be asked first and
   * leave without the question.
   */
  readonly systemBack?: boolean;
}) {
  // Android: route the system back (button / gesture) to onBack so it goes home, not out of the app.
  useEffect(() => {
    if (Platform.OS !== 'android' || !onBack || !systemBack) {
      return;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true; // consumed - don't bubble to "exit app"
    });
    return () => sub.remove();
  }, [onBack, systemBack]);

  // No back target, or Android (the system back above handles it): plain passthrough.
  if (!onBack || Platform.OS !== 'ios') {
    return <>{children}</>;
  }
  return <IosEdgeSwipe onBack={onBack}>{children}</IosEdgeSwipe>;
}

/**
 * The iOS swipe itself. Its own component because the pan is a hook now (`usePanGesture`), and a hook
 * cannot sit behind the passthrough's early return - this way a native pan handler exists only where
 * the builder-API version created one: on iOS, with somewhere to go back to.
 */
function IosEdgeSwipe({
  onBack,
  children,
}: {
  readonly onBack: () => void;
  readonly children: ReactNode;
}) {
  const theme = useTheme();
  // Read per render, not once at import. `Dimensions.get('window').width` at module scope is
  // captured when the bundle loads and is stale for the rest of the process after any rotation or
  // resize - and the commit threshold below is a fraction of it. Harmless while this ran only on a
  // portrait-locked iPhone; not something to leave behind now that a foldable or a tablet can change
  // this number under it (see `theme/ContentColumn.tsx`).
  const { width: screenWidth } = useWindowDimensions();
  const tx = useSharedValue(0);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }));

  // A committed swipe leaves this screen slid off by its full width, which is only right while it
  // is on its way out. Two ways it stays (found on an iPhone, 2026-09-24): the next screen is drawn
  // in this same wrapper, so it appeared slid off too - a blank screen (AppShell now keys each
  // route's wrapper, so a new screen gets a fresh one) - and a back that does not leave, such as
  // leaving a running restore, which asks first. So a moment after asking to go back, the screen is
  // brought back; by then a screen that did leave has been unmounted and nothing moves.
  const back = () => {
    onBack();
    setTimeout(() => {
      tx.value = withTiming(0, { duration: 160 });
    }, 250);
  };

  // The callbacks are workletized by `react-native-worklets/plugin` (the inline object passed to
  // `usePanGesture`), so they run on the UI thread; `onBack` hops back to JS via `scheduleOnRN`.
  const pan = usePanGesture({
    activeOffsetX: 20, // only a rightward horizontal drag activates…
    failOffsetY: [-15, 15], // …a vertical drag yields to scrolling
    onUpdate: e => {
      tx.value = Math.max(0, e.translationX);
    },
    // Same transitions as the builder's `onEnd`: out of ACTIVE, whether it ended or was cancelled.
    onDeactivate: e => {
      const committed =
        e.translationX > screenWidth * 0.33 ||
        (e.translationX > 60 && e.velocityX > 600);
      if (committed) {
        tx.value = withTiming(screenWidth, { duration: 160 }, finished => {
          if (finished) {
            scheduleOnRN(back);
          }
        });
      } else {
        tx.value = withTiming(0, { duration: 160 });
      }
    },
  });

  // The app bg sits BEHIND the sliding screen so the reveal during the swipe is the theme background,
  // not the empty (black) window.
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <GestureDetector gesture={pan}>
        <Animated.View style={[{ flex: 1 }, style]}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}
