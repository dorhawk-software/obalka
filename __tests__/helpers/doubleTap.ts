// A double tap, as a finger delivers one: two presses that land before the screen re-renders.
// NOT a test suite (lives under __tests__/helpers/, excluded via jest.config testPathIgnorePatterns).
//
// `fireEvent.press` wraps each press in `act`, which renders in between - so two of them in a row test
// a SLOW double tap, the one React state already guards. The one that got through (audit 2026-09-23)
// is the fast one, where the second press is handled by the handler of the render the first press
// happened in. So the handler is taken out of the tree ONCE and called twice in the same tick.

import { act } from '@testing-library/react-native';

/** What RNTL's own query results carry: a host element with a way up the component tree. */
interface WithFiber {
  readonly props: Record<string, unknown>;
  readonly unstable_fiber?: FiberLike | null;
}
interface FiberLike {
  readonly memoizedProps?: Record<string, unknown> | null;
  readonly return: FiberLike | null;
}

/**
 * The press handler the element was rendered with - found the way `fireEvent.press` finds it: the
 * element's own `onPress`, else the nearest one up the component tree (a `Pressable`, a PressScale, a
 * Tamagui stack).
 */
export function pressHandlerOf(element: { readonly props: object }): (...args: unknown[]) => unknown {
  const host = element as WithFiber;
  if (typeof host.props.onPress === 'function') {
    return host.props.onPress as (...args: unknown[]) => unknown;
  }
  let fiber = host.unstable_fiber ?? null;
  while (fiber) {
    const onPress = fiber.memoizedProps?.onPress;
    if (typeof onPress === 'function') {
      return onPress as (...args: unknown[]) => unknown;
    }
    fiber = fiber.return;
  }
  throw new Error('No press handler above this element.');
}

/** Press `element` twice within one tick, then let whatever the presses started settle. */
export async function doubleTap(element: { readonly props: object }): Promise<void> {
  const press = pressHandlerOf(element);
  await act(async () => {
    press();
    press();
  });
}
