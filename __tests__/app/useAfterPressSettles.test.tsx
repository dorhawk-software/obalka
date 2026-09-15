// The deferral an attachment tap waits on before handing the app to an external viewer.
//
// It replaced `InteractionManager.runAfterInteractions`, whose 0.86 stub had shrunk to a microtask.
// What must hold: the task never runs in the tap's own turn, runs once however it is woken (idle or
// the fallback timer), still runs on a JS thread that never goes idle, and does not run at all once
// its screen has gone.

import { renderHook } from '@testing-library/react-native';
import {
  PRESS_SETTLE_TIMEOUT_MS,
  useAfterPressSettles,
} from '../../src/app/useAfterPressSettles';

describe('useAfterPressSettles', () => {
  let idleCallbacks: Map<number, () => void>;
  let nextIdle: number;

  beforeEach(() => {
    jest.useFakeTimers();
    idleCallbacks = new Map();
    nextIdle = 1;
    jest.spyOn(global, 'requestIdleCallback').mockImplementation(cb => {
      const id = nextIdle++;
      idleCallbacks.set(id, () => cb({ didTimeout: false, timeRemaining: () => 50 }));
      return id;
    });
    jest.spyOn(global, 'cancelIdleCallback').mockImplementation(id => {
      idleCallbacks.delete(id);
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const goIdle = () => {
    const due = [...idleCallbacks.values()];
    idleCallbacks.clear();
    due.forEach(run => run());
  };

  it('runs the task when the runtime goes idle, not in the tap itself - and only once', async () => {
    const { result } = await renderHook(() => useAfterPressSettles());
    const task = jest.fn();
    result.current(task);
    expect(task).not.toHaveBeenCalled();

    goIdle();
    expect(task).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(PRESS_SETTLE_TIMEOUT_MS); // the fallback was cleared
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('still runs, once, on a JS thread that never goes idle', async () => {
    const { result } = await renderHook(() => useAfterPressSettles());
    const task = jest.fn();
    result.current(task);

    jest.advanceTimersByTime(PRESS_SETTLE_TIMEOUT_MS - 1);
    expect(task).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(task).toHaveBeenCalledTimes(1);
    expect(idleCallbacks.size).toBe(0); // the idle request was withdrawn
  });

  it('drops a task that has not started when its screen unmounts', async () => {
    const { result, unmount } = await renderHook(() => useAfterPressSettles());
    const task = jest.fn();
    result.current(task);
    await unmount();

    goIdle();
    jest.advanceTimersByTime(PRESS_SETTLE_TIMEOUT_MS);
    expect(task).not.toHaveBeenCalled();
  });

  it('leaves a task that already ran alone on unmount', async () => {
    const { result, unmount } = await renderHook(() => useAfterPressSettles());
    const first = jest.fn();
    const second = jest.fn();
    result.current(first);
    goIdle();
    result.current(second);
    await unmount();
    goIdle();
    jest.advanceTimersByTime(PRESS_SETTLE_TIMEOUT_MS);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });
});
