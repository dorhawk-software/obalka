// SwipeableRow (008, US4): a trailing (right→left) destructive-swipe wrapper built on
// react-native-gesture-handler's ReanimatedSwipeable - the gesture + animation run on the native UI
// thread (constitution I: never block the JS thread). It ALWAYS pairs with a discoverable, a11y-
// reachable fallback (an overflow `⋯` menu) supplied by the caller, so the action is never swipe-only.
// Reduce Motion: reanimated honours the system setting by default (animations snap to their end state);
// when it's on we ALSO disable the gesture so the row isn't draggable at all and the menu is the path.

import { useRef, type ReactNode } from 'react';
import { Text, View } from 'react-native';
// gesture-handler's OWN Pressable - it shares the gesture system with the swipe pan, so a horizontal
// drag cancels the press (no accidental row tap, no stuck highlight). RN's Pressable/Tamagui onPress
// live in a separate responder system that iOS does NOT cancel when the pan activates → the reported
// "drag opens the detail + fades the card" bug. Using it makes iOS behave like Android.
import { Pressable } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';
import { haptics } from '../services/haptics';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

export interface SwipeAction {
  label: string;
  icon?: ReactNode;
  /** Foreground (icon + label) colour. */
  color: string;
  /** Revealed action background. */
  background: string;
  onPress: () => void;
  testID?: string;
}

export function SwipeableRow({
  children,
  rightAction,
  onPress,
  accessibilityLabel,
  pressTestID,
  enabled = true,
  testID,
  bodyBackground,
}: {
  readonly children: ReactNode;
  readonly rightAction: SwipeAction;
  /**
   * An opaque colour to paint behind the row while it slides.
   *
   * A swiped row has to OCCLUDE the action it uncovers. That is easy to get wrong, because it
   * depends on the child rather than on this component: the compose drafts pass a self-contained
   * card that already paints `surface`, so they occlude correctly and look right - while the backup
   * list passes a `CardRow`, which paints nothing and inherits its colour from the `Card` behind it.
   * Sliding that row let the red delete button show straight THROUGH it, so the two appeared to
   * overlap and smear into each other (reported 2026-09-10).
   *
   * Pass the colour the row sits on whenever the child is not itself opaque. Omit it when the child
   * is its own card - painting a rectangle behind a rounded card would show at the corners.
   */
  readonly bodyBackground?: string;
  /** Row tap (e.g. open). Handled here via gesture-handler's Pressable so the swipe and the tap share
   *  one gesture system - a drag never fires it. Pass this instead of putting onPress on the child. */
  readonly onPress?: () => void;
  readonly accessibilityLabel?: string;
  readonly pressTestID?: string;
  readonly enabled?: boolean;
  readonly testID?: string;
}) {
  const ref = useRef<SwipeableMethods>(null);
  const reduceMotion = useReducedMotion();

  // The revealed area is full-height + transparent; the action itself is a compact, vertically-centred
  // ROUNDED button (radius matches cards/buttons) with a little breathing room from the row - not a
  // full-height square slab. A swipe simply "uncovers the Odebrat button".
  const renderRightActions = () => (
    <View
      style={{
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        paddingLeft: 10,
        paddingRight: 4,
      }}
    >
      <Pressable
        onPress={() => {
          haptics.medium(); // a weighted, committed action - feel it land
          ref.current?.close();
          rightAction.onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={rightAction.label}
        testID={rightAction.testID}
        style={{
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 14,
          backgroundColor: rightAction.background,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        {rightAction.icon}
        <Text
          style={{ color: rightAction.color, fontWeight: '700', fontSize: 12 }}
          numberOfLines={1}
        >
          {rightAction.label}
        </Text>
      </Pressable>
    </View>
  );

  // The row body, made tappable via gesture-handler's Pressable when an onPress is given (so the swipe
  // pan and the tap coordinate). a11y preserved - it's a Pressable: role=button + label + activation.
  const content = bodyBackground ? (
    // Opaque, so the row covers the action it is uncovering - see `bodyBackground`.
    <View style={{ backgroundColor: bodyBackground }}>{children}</View>
  ) : (
    children
  );
  const body = onPress ? (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={pressTestID}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      {content}
    </Pressable>
  ) : (
    content
  );

  // Reduce Motion (or explicitly disabled) → no draggable gesture; the overflow-menu fallback is used.
  if (reduceMotion || !enabled) {
    return <View testID={testID}>{body}</View>;
  }

  return (
    <ReanimatedSwipeable
      ref={ref}
      testID={testID}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      // overflow visible so the row's own box-shadow isn't clipped to a hard edge by the swipeable's
      // default overflow:hidden container (the "weird shadow" on the card's rounded corners).
      containerStyle={{ overflow: 'visible' }}
      renderRightActions={renderRightActions}
    >
      {body}
    </ReanimatedSwipeable>
  );
}
