// Press-scale wrapper - the tactile "press dip" on a primary action (a 2026 micro-interaction). Wraps
// a visual button (kept with pointerEvents="none" so it's purely presentation) and owns the touch +
// the quick scale-down/back. Same RN-Animated mechanism as the FAB (timing, useNativeDriver, no spring
// "bop"). Scale ONLY - haptics are wired separately at the action level, so this never double-fires.
//
// It also owns the difference between a button that is BUSY, one that is DISABLED and one that is
// BLOCKED (019).
//
//   busy     `busy` - the action is already running and a spinner is saying so. The press is
//             swallowed, exactly as before, and a screen reader hears the button busy. Shaking at
//             someone for pressing again would be nonsense.
//   disabled `disabled` - the action cannot be taken now, for a reason the screen already shows
//             (nothing to send yet, another run holding the screen). The press is swallowed and a
//             screen reader hears the button unavailable.
//   blocked  `blockedReason` - a requirement is unmet. The press is NOT swallowed: it answers with a
//             short refusal (movement + warning haptic) and hands control back to the caller, which
//             moves focus to whatever is missing.
//
// The reason this distinction lives down here rather than in each form: a disabled `Pressable`
// discards the touch before any handler runs, so a screen cannot even learn that someone tried. That
// is what made the re-auth button look broken to a user who had skimmed past the password field.
//
// Until 2026-09-15 `disabled` was the only way to say busy, so a screen reader heard every running
// action as unavailable - a button that is not coming back, where one was about to.

import { useRef, type ReactNode } from 'react';
import { Animated, Pressable, type ViewStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { haptics } from '../services/haptics';

/** A busy button's press: taken, so nothing under the button gets it, and answered with nothing. */
const swallow = () => {};

export function PressScale({
  onPress,
  busy,
  disabled,
  blockedReason,
  onBlockedPress,
  fullWidth,
  to = 0.97,
  accessibilityLabel,
  testID,
  children,
  style,
}: {
  readonly onPress: () => void;
  /**
   * The action is IN FLIGHT. The press is swallowed silently - the spinner is the answer - and the
   * button is announced busy, not unavailable. Wins over `disabled` and `blockedReason`.
   */
  readonly busy?: boolean;
  /**
   * The action cannot be taken now, and the screen already shows why. The press is swallowed silently
   * and the button is announced unavailable. Not for a running action: that is `busy`.
   */
  readonly disabled?: boolean;
  /**
   * A requirement is unmet, and this says which. The button looks disabled and announces itself as
   * unavailable, but still ANSWERS a press instead of eating it (019).
   */
  readonly blockedReason?: string;
  /**
   * Called when a blocked button is pressed. Use it to focus the control that is missing input -
   * that is the half that tells the user WHERE to look, which a shake alone cannot.
   */
  readonly onBlockedPress?: () => void;
  /** Stretch to the parent's width (for full-width buttons). */
  readonly fullWidth?: boolean;
  /** Scale to dip to on press (default 0.97). */
  readonly to?: number;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
  readonly children: ReactNode;
  readonly style?: ViewStyle;
}) {
  const reduceMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const shake = useRef(new Animated.Value(0)).current;
  // Busy wins over blocked: never scold someone for pressing during a race they cannot see. A disabled
  // button is silent as well - what is missing is not something a focus move could point at.
  const blocked = !busy && !disabled && blockedReason != null;

  /** The refusal: a short lateral nudge, small enough to read as "no" and not as a bounce. */
  const refuse = () => {
    haptics.warning();
    onBlockedPress?.();
    if (reduceMotion) {
      return; // the haptic and the focus move still land - the refusal survives without motion
    }
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };
  const animate = (v: number) => {
    if (reduceMotion) {
      return; // Reduce Motion → no press-dip (the press still fires)
    }
    Animated.timing(scale, {
      toValue: v,
      duration: 90,
      useNativeDriver: true,
    }).start();
  };

  let handlePress = onPress;
  if (busy) {
    handlePress = swallow;
  } else if (blocked) {
    handlePress = refuse;
  }

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={() => {
        if (!busy && !disabled && !blocked) {
          animate(to);
        }
      }}
      onPressOut={() => animate(1)}
      // Only a DISABLED button refuses the touch outright. A blocked one must receive it to answer, and
      // a busy one takes it and does nothing: `Pressable` announces `disabled` as unavailable whatever
      // `accessibilityState` says, so a busy button handed it would still be heard as one.
      disabled={!busy && disabled}
      accessibilityRole="button"
      // A blocked button is still announced as unavailable - it is. The reason rides along so a screen
      // reader user gets the same answer a sighted user gets from the shake.
      accessibilityState={{ busy: !!busy, disabled: !busy && (!!disabled || blocked) }}
      accessibilityLabel={
        blocked && accessibilityLabel
          ? `${accessibilityLabel}, ${blockedReason}`
          : accessibilityLabel
      }
      accessibilityHint={blocked ? blockedReason : undefined}
      testID={testID}
      style={[fullWidth ? { width: '100%' } : null, style]}
    >
      <Animated.View
        // The visual button is non-interactive; this wrapper owns the press. Hidden from the a11y
        // tree (iOS + Android) so the screen reader announces only THIS button, not a nested one.
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          transform: [
            { scale },
            {
              // ±4px: enough to notice, not enough to feel like a rejection buzzer. Occupies no
              // layout space, so nothing around it moves (Principle V).
              translateX: shake.interpolate({
                inputRange: [-1, 0, 1],
                outputRange: [-4, 0, 4],
              }),
            },
          ],
          ...(fullWidth ? { width: '100%', alignItems: 'stretch' } : null),
        }}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}
