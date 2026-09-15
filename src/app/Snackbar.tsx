// App-level snackbar (feature 005, FR-007). A brief bottom bar with an optional single action, shown
// ABOVE the navigator so it survives a screen transition - e.g. "Koncept uložen" appears after the
// user leaves Compose (the compose screen has already popped). The action can re-`show()` a follow-up
// snackbar, which is how discard → "Vrátit zpět" (undo) works. Pure UI; no I/O of its own.

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
import { textSlop } from '../theme/touchTarget';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { XStack, YStack } from '../theme/ui';
import { BodyStrong, Value } from '../theme/Typography';
import { useTheme } from '../theme/ThemeProvider';

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

export function useSnackbar(): SnackbarApi {
  const ctx = useContext(SnackbarContext);
  if (!ctx) {
    throw new Error('useSnackbar must be used within a SnackbarProvider');
  }
  return ctx;
}

export function SnackbarProvider({ children }: { readonly children: ReactNode }) {
  const [snack, setSnack] = useState<SnackbarState | null>(null);
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
    setSnack(null);
  }, [clear]);

  const show = useCallback(
    (state: SnackbarState) => {
      clear();
      setSnack(state);
      // Only an ACTIONABLE bar gets the longer window - a snackbar with nothing to tap has been fully
      // delivered by its announcement, so holding it open would only keep it in the way.
      const ms =
        screenReader.current && state.action ? SNACKBAR_A11Y_MS : SNACKBAR_MS;
      timer.current = setTimeout(() => setSnack(null), ms);
    },
    [clear],
  );

  useEffect(() => clear, [clear]);

  return (
    <SnackbarContext.Provider value={{ show, dismiss }}>
      <YStack flex={1}>
        {children}
        {snack ? <SnackbarHost snack={snack} onAction={dismiss} /> : null}
      </YStack>
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
  onAction,
}: {
  readonly snack: SnackbarState;
  readonly onAction: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  // Fade + slide up on appear (snappy, no bop). Reduce Motion → appears at rest.
  const enter = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    Animated.timing(enter, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [enter, reduceMotion]);

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
      paddingHorizontal={12}
      paddingBottom={insets.bottom + 14}
      pointerEvents="box-none"
    >
      <Animated.View
        style={{
          opacity: enter,
          transform: [
            {
              translateY: enter.interpolate({
                inputRange: [0, 1],
                outputRange: [16, 0],
              }),
            },
          ],
        }}
      >
        <XStack
          backgroundColor={theme.snackbarBg}
          borderRadius={14}
          paddingVertical={13}
          paddingLeft={16}
          paddingRight={14}
          alignItems="center"
          gap={12}
          style={{ boxShadow: '0px 8px 24px rgba(33,27,18,0.32)' }}
          testID="snackbarBar"
        >
          <Value flex={1} color={theme.snackbarInk}>
            {snack.message}
          </Value>
          {snack.action ? (
            <BodyStrong
              // The design sets this label on the font's own line, which on iOS cuts the ring off a
              // capital Ů. A dense role keeps that line and gives the ink its room (Typography.tsx).
              // On Android it draws the dense 16 itself, the design's line as every design row gets
              // it; the raw Text this was had no line and got Android's font-padded one, about 19dp,
              // which made the bar 3dp taller than the design and its target short of `textSlop`'s.
              dense
              color={theme.goldBright}
              fontSize={14}
              paddingVertical={2}
              paddingHorizontal={4}
              // Derived from the label's own line box, not typed: this was a 41dp target on a
              // control that LEAVES ON A TIMER, which is a harder miss than one that waits.
              hitSlop={textSlop('bodyStrong', { fontSize: 14, dense: true, paddingVertical: 2 })}
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
              {snack.action.label}
            </BodyStrong>
          ) : null}
        </XStack>
      </Animated.View>
    </YStack>
  );
}
