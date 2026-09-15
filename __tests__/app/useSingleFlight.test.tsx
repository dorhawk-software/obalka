// The screens' double-tap guard (audit 2026-09-23).
//
// What it promises: a second call made while the first is still running does nothing - decided in the
// same tick as the call, not a render later - never throws, and the guard is free again the moment
// the run settles, however it settles.

import { act, renderHook } from '@testing-library/react-native';
import { createSingleFlight, useSingleFlight } from '../../src/app/useSingleFlight';

/** A run held open until the test lets it go. */
function held<T>(value: T) {
  let finish: () => void = () => {};
  let fail: (e: unknown) => void = () => {};
  const done = new Promise<T>((resolve, reject) => {
    finish = () => resolve(value);
    fail = reject;
  });
  return { run: jest.fn(() => done), finish: () => finish(), fail: (e: unknown) => fail(e) };
}

describe('createSingleFlight', () => {
  it('refuses a second call while the first runs, in the same tick', async () => {
    const guard = createSingleFlight();
    const first = held('first');
    const second = jest.fn(() => 'second');

    const a = guard(first.run);
    const b = guard(second);
    // Decided synchronously: the refused action was never called, not called and then ignored.
    expect(first.run).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();

    first.finish();
    await expect(a).resolves.toBe('first');
    await expect(b).resolves.toBeUndefined();
  });

  it('is free again once the run has finished', async () => {
    const guard = createSingleFlight();
    await guard(async () => 'one');
    const again = jest.fn(async () => 'two');
    await expect(guard(again)).resolves.toBe('two');
    expect(again).toHaveBeenCalledTimes(1);
  });

  it('is free again once the run has failed, and the failure reaches the caller that ran it', async () => {
    const guard = createSingleFlight();
    const first = held('never');
    const failing = guard(first.run);
    // The refused call during the run never throws, whatever the run does.
    const refused = guard(() => 'refused');
    first.fail(new Error('boom'));
    await expect(failing).rejects.toThrow('boom');
    await expect(refused).resolves.toBeUndefined();

    await expect(guard(() => 'after')).resolves.toBe('after');
  });

  it('holds for a synchronous action only while it runs', async () => {
    const guard = createSingleFlight();
    const sync = jest.fn(() => 1);
    await guard(sync);
    await guard(sync);
    expect(sync).toHaveBeenCalledTimes(2);
  });

  it('can be let go early, and the abandoned run then leaves its successor alone', async () => {
    const guard = createSingleFlight();
    const abandoned = held('old');
    void guard(abandoned.run);

    guard.release();
    const next = held('new');
    const running = guard(next.run);
    expect(next.run).toHaveBeenCalledTimes(1);

    // The abandoned run settles while the new one is still going: the guard stays with the new one.
    abandoned.finish();
    await act(async () => {});
    const third = jest.fn(() => 'third');
    await expect(guard(third)).resolves.toBeUndefined();
    expect(third).not.toHaveBeenCalled();

    next.finish();
    await expect(running).resolves.toBe('new');
  });

  it('excludes every action it guards, not just a repeat of the same one', async () => {
    const guard = createSingleFlight();
    const backup = held('backup');
    void guard(backup.run);
    const restore = jest.fn();
    await guard(restore);
    expect(restore).not.toHaveBeenCalled();
    backup.finish();
  });
});

describe('useSingleFlight', () => {
  it('keeps one guard for the life of the component, so a stale closure and a fresh one share it', async () => {
    const { result, rerender } = await renderHook(() => useSingleFlight());
    const first = result.current;
    const running = held('x');
    void first(running.run);

    await rerender({});
    expect(result.current).toBe(first);
    const late = jest.fn();
    await result.current(late);
    expect(late).not.toHaveBeenCalled();
    running.finish();
  });

  it('gives each component its own guard', async () => {
    const a = await renderHook(() => useSingleFlight());
    const b = await renderHook(() => useSingleFlight());
    const running = held('a');
    void a.result.current(running.run);
    const other = jest.fn(() => 'b');
    await expect(b.result.current(other)).resolves.toBe('b');
    running.finish();
  });
});
