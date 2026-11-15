// App-level snackbar (feature 005, FR-007). A brief bottom bar with an optional single action, shown
// ABOVE the navigator so it survives a screen transition - e.g. "Koncept uložen" appears after the
// user leaves Compose (the compose screen has already popped). The action can re-`show()` a follow-up
// snackbar, which is how discard → "Vrátit zpět" (undo) works. Pure UI; no I/O of its own.
//
// Board R9 (031 I60, agreed 2026-11-12): "ink with the gold action, above the stamp". 16 in from the
// sides, 52 tall at the least, the 14 corner, its own soft shadow; the words in the bold small role,
// the action in the flap's gold in a 44 row. It stands 6 over the compose stamp while the stamp is on
// screen (`useSnackbarLift`), and 14 over the safe area's edge elsewhere. It rises 220 ms and fades out;
// under Reduce Motion it only fades. Until 2026-11-15 it was 12 in from the sides, lay over the stamp,
// left without a fade and, under Reduce Motion, appeared at once.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AccessibilityInfo, Animated } from 'react-native';
import { touchSlop } from '../theme/touchTarget';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { XStack, YStack } from '../theme/ui';
import { SmallStrong } from '../theme/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { depth } from '../theme/depth';
import { space } from '../theme/spacing';
import { SnackbarLiftContext } from '../theme/snackbarLift';

export interface SnackbarAction {
  label: string;
  /** Runs on tap. May call `show()` again to chain a follow-up snackbar (e.g. an undo). */
  onPress: () => void;
}

export interface SnackbarState {
  message: string;
  action?: SnackbarAction;
}

interface SnackbarApi {
  show: (state: SnackbarState) => void;
  dismiss: () => void;
}

const SnackbarContext = createContext<SnackbarApi | null>(null);

/** Visible long enough to read + tap the action, but transient. */
const SNACKBAR_MS = 4500;

/**
 * How long an ACTIONABLE snackbar stays when a screen reader is running.
 *
 * 4.5s is measured against reading the bar and reaching for it. With VoiceOver or TalkBack the same
 * bar has to be announced first, then found by swipe, then activated - so the window that is generous
 * by eye is one the user loses every time. Bounded, not indefinite: it is still a transient bar, and
 * one that never leaves would sit over the screen it covers.
 */
const SNACKBAR_A11Y_MS = 10_000;

/** Rising in and fading out (R9). */
const MOTION_MS = 220;
/** How far it rises from. */
const RISE = 16;
/** R9's bar: 52 tall at the least, the 14 corner; the action a 44 row. */
const BAR = { minHeight: 52, radius: 14, action: 44 } as const;

export function useSnackbar(): SnackbarApi {
  const ctx = useContext(SnackbarContext);
  if (!ctx) {
    throw new Error('useSnackbar must be used within a SnackbarProvider');
  }
  return ctx;
}

export function SnackbarProvider({ children }: { readonly children: ReactNode }) {
  const [snack, setSnack] = useState<SnackbarState | null>(null);
  // Fading out: the bar stays mounted until the fade has run, then `gone` drops it.
  const [leaving, setLeaving] = useState(false);
  // How high the compose stamp reaches while it is on screen; 0 with no stamp.
  const [lift, setLift] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A ref, not state: only the timeout below reads it, and nothing on screen changes when it flips.
  const screenReader = useRef(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isScreenReaderEnabled().then(on => {
      if (alive) {
        screenReader.current = on;
      }
    });
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', on => {
      screenReader.current = on;
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clear();
    setLeaving(true);
  }, [clear]);

  const gone = useCallback(() => {
    setSnack(null);
    setLeaving(false);
  }, []);

  const show = useCallback(
    (state: SnackbarState) => {
      clear();
      setSnack(state);
      setLeaving(false);
      // Only an ACTIONABLE bar gets the longer window - a snackbar with nothing to tap has been fully
      // delivered by its announcement, so holding it open would only keep it in the way.
      const ms =
        screenReader.current && state.action ? SNACKBAR_A11Y_MS : SNACKBAR_MS;
      timer.current = setTimeout(() => setLeaving(true), ms);
    },
    [clear],
  );

  useEffect(() => clear, [clear]);

  return (
    <SnackbarContext.Provider value={{ show, dismiss }}>
      <SnackbarLiftContext.Provider value={setLift}>
        <YStack flex={1}>
          {children}
          {snack ? (
            <SnackbarHost snack={snack} leaving={leaving} lift={lift} onAction={dismiss} onGone={gone} />
          ) : null}
        </YStack>
      </SnackbarLiftContext.Provider>
    </SnackbarContext.Provider>
  );
}

// A conventional dark bar (theme-independent, like Material) so it stands out over any screen; the
// action uses the design's brighter gold (goldBright) for high contrast on the dark bar.
//
// "Theme-independent" is now true. It painted itself with `theme.text`, which is the near-BLACK ink of
// the light theme and the near-WHITE ink of the dark one - so at night the bar inverted to white while
// the gold action label stayed put, at 1.52:1. `snackbarBg` / `snackbarInk` name the ink this bar
// actually wants, identically in both themes.
function SnackbarHost({
  snack,
  leaving,
  lift,
  onAction,
  onGone,
}: {
  readonly snack: SnackbarState;
  /** Fading out; `onGone` once the fade has run. */
  readonly leaving: boolean;
  /** How high the compose stamp reaches over the safe area's edge, while it is on screen; else 0. */
  readonly lift: number;
  readonly onAction: () => void;
  readonly onGone: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  // Two values: it fades in AND out, but only rises in (R9), and under Reduce Motion only fades.
  const opacity = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(reduceMotion ? 0 : RISE)).current;
  useEffect(() => {
    if (leaving) {
      Animated.timing(opacity, { toValue: 0, duration: MOTION_MS, useNativeDriver: true }).start(
        ({ finished }) => {
          if (finished) {
            onGone();
          }
        },
      );
      return;
    }
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: MOTION_MS, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: reduceMotion ? 0 : MOTION_MS, useNativeDriver: true }),
    ]).start();
  }, [leaving, opacity, rise, reduceMotion, onGone]);

  // A snackbar is the app talking, unprompted, somewhere the user is not looking - with a screen
  // reader on it is invisible unless it says so. Announced explicitly rather than through
  // `accessibilityLiveRegion`, which fires on a CHANGE within an attached view and is unreliable for a
  // subtree that mounts already-populated, as this one does. The announcement carries the action's
  // label too: the bar leaves on a timer, and knowing there is an "Vrátit zpět" to find is the whole
  // reason to go looking. Re-runs when the message swaps (discard → undo keeps the host mounted).
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(
      snack.action ? `${snack.message}. ${snack.action.label}` : snack.message,
    );
  }, [snack]);

  return (
    <YStack
      position="absolute"
      left={0}
      right={0}
      bottom={0}
      paddingHorizontal={space.inset}
      // Over the stamp while it is on screen, 6 above its top; at the bottom otherwise.
      paddingBottom={insets.bottom + (lift > 0 ? lift + space.sm : space.xl)}
      pointerEvents="box-none"
      testID="snackbarHost"
    >
      <Animated.View style={{ opacity, transform: [{ translateY: rise }] }}>
        <XStack
          backgroundColor={theme.snackbarBg}
          borderRadius={BAR.radius}
          minHeight={BAR.minHeight}
          paddingLeft={space.inset}
          // R9's 6: the action brings its own 12. Words alone keep 16 on both sides.
          paddingRight={snack.action ? space.sm : space.inset}
          alignItems="center"
          gap={space.lg}
          style={{ boxShadow: theme.name === 'dark' ? depth.snackbarDark : depth.snackbar }}
          testID="snackbarBar"
        >
          {/* 16 over and under the words: one line makes R9's 52, and a backup message that runs to
              three keeps the same room at its edges. */}
          <SmallStrong flex={1} paddingVertical={space.inset} color={theme.snackbarInk}>
            {snack.message}
          </SmallStrong>
          {snack.action ? (
            // R9's link: a 44 row, 12 at its sides, the words in the flap's gold. A target derived
            // from that row, not typed: this control LEAVES ON A TIMER, which is a harder miss than
            // one that waits (it was a 41 target once).
            <XStack
              minHeight={BAR.action}
              paddingHorizontal={space.lg}
              alignItems="center"
              hitSlop={touchSlop({ height: BAR.action })}
              pressStyle={{ opacity: 0.6 }}
              onPress={() => {
                const act = snack.action;
                onAction();
                act?.onPress();
              }}
              accessibilityRole="button"
              accessibilityLabel={snack.action.label}
              testID="snackbarAction"
            >
              <SmallStrong color={theme.goldBright}>{snack.action.label}</SmallStrong>
            </XStack>
          ) : null}
        </XStack>
      </Animated.View>
    </YStack>
  );
}
