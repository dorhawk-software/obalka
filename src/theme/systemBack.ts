// Android's system back inside a flow that changes step in place (the add-box flow: method, password,
// SMS code). The shell's wrapper (`EdgeSwipeBack`) listens for it and asks the innermost screen that
// offered a back first; with none, it leaves the flow. Before 2026-11-16 the wrapper always left, so
// from the password form back skipped the method step the header's chevron goes to (walked on
// Obalka_Demo, T050.10). A stack, not BackHandler order: effects run child first, so the wrapper,
// registered after the screen, was always asked before it.

import { createContext, useContext, useEffect, useRef, type RefObject } from 'react';

export type BackEntry = RefObject<(() => void) | undefined>;
/** The screens that offered a back, innermost last. Null outside a wrapper: nothing listens there. */
export const SystemBackContext = createContext<RefObject<BackEntry[]> | null>(null);

/** The wrapper's answer to the system back: the innermost screen's back, if one offered it. */
export function innermostBack(stack: RefObject<BackEntry[]>): (() => void) | undefined {
  return stack.current[stack.current.length - 1]?.current;
}

/**
 * Offer `onBack` to the wrapper around this screen. Offered once per mount and reading the newest
 * `onBack`, so the screen's own step changes need no re-registering.
 */
export function useSystemBack(onBack: (() => void) | undefined): void {
  const stack = useContext(SystemBackContext);
  const latest = useRef(onBack);
  latest.current = onBack;
  const offers = onBack !== undefined;
  useEffect(() => {
    if (!stack || !offers) {
      return;
    }
    const entry = latest;
    stack.current.push(entry);
    return () => {
      stack.current = stack.current.filter(e => e !== entry);
    };
  }, [stack, offers]);
}
