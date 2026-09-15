// Run a task once the press that asked for it has settled - for handing the app over to an external
// viewer from a tap.
//
// Launching an external activity mid-press can leave React Native's JS touch responder held by the
// pressed row across the app backgrounding; on return it is never released, and touches freeze across
// the WHOLE screen, Back included. So the launch waits until the work already queued behind the press
// - the touch events of its release among them - has run.
//
// This was `InteractionManager.runAfterInteractions`, which React Native 0.86 marks deprecated and has
// already hollowed out: Libraries/Interaction/InteractionManager.js is now a stub that ignores
// interactions and calls `setImmediate`, which the bridgeless runtime shims onto `queueMicrotask`
// (Libraries/Core/Timers/immediateShim.js). A microtask runs before the runtime takes its next task,
// so the deferral had quietly stopped letting anything through.
//
// `requestIdleCallback` is the runtime scheduler's own "after the pending work": an Idle-priority task
// (ReactCommon/.../RuntimeScheduler_Modern.cpp `scheduleIdleTask`) runs after every task already
// queued. Its `timeout` option cannot bound the wait in 0.86 - NativeIdleCallbacks.cpp reads it into
// `didTimeout` and never passes it to the scheduler - so a plain timer races it: on a JS thread that
// never goes idle, the viewer still opens.
//
// A task that has not started by the time its screen unmounts is cancelled - the user has left, and a
// viewer launched over the screen they went back to would be a surprise.

import { useCallback, useEffect, useRef } from 'react';

/** Longest the launch waits for the JS thread to go idle before running anyway. */
export const PRESS_SETTLE_TIMEOUT_MS = 500;

/** Returns `schedule(task)`: run `task` after the current press settles, unless the caller unmounts. */
export function useAfterPressSettles(): (task: () => unknown) => void {
  /** Cancels for the tasks scheduled and not yet started. */
  const pending = useRef(new Set<() => void>());

  useEffect(() => {
    const cancels = pending.current;
    return () => {
      cancels.forEach(cancel => cancel());
      cancels.clear();
    };
  }, []);

  return useCallback((task: () => unknown) => {
    const cancel = () => {
      cancelIdleCallback(idle);
      clearTimeout(timer);
      pending.current.delete(cancel);
    };
    const run = () => {
      cancel(); // whichever fires first, the other one must not run it again
      task();
    };
    const idle = requestIdleCallback(run);
    const timer = setTimeout(run, PRESS_SETTLE_TIMEOUT_MS);
    pending.current.add(cancel);
  }, []);
}
