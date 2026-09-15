// One run of an action at a time, decided at the tap rather than at the next render.
//
// A screen that guards an action with React state - `busy`, `loading`, `disabled`, or PressScale's
// `busy` prop - is only guarded once that state has been rendered. A fast double tap delivers both
// presses before the re-render: the second handler still reads the old `busy === false` from its
// closure, and the button is still enabled on screen. For most actions that costs a flicker. For some
// it costs far more: ISDS has no idempotency key, so a second send is a second official message (and
// for a paid PDZ, a second charge), and a second SMS request is a second text the box's owner pays
// attention to (audit 2026-09-23).
//
// So the guard is a plain variable, checked and set in the same synchronous step as the tap, before
// anything awaits. The state stays where it was - it is still what draws the spinner and what a screen
// reader hears - but it no longer decides whether the action runs.
//
// The screen's half only. A controller that must never run twice has a guard of its own, because a
// controller cannot assume every caller is a guarded button.

import { useState } from 'react';

/** Runs `fn` unless something this guard started is still running. */
export interface SingleFlight {
  /**
   * Run `fn` if nothing guarded here is running, and hold the guard until it settles.
   *
   * A refused call does nothing and resolves `undefined` - it never throws, so a second tap is simply
   * swallowed. An accepted call resolves or rejects exactly as `fn` does.
   */
  <T>(fn: () => T | Promise<T>): Promise<T | undefined>;
  /**
   * Let the guard go before the run settles. For a run whose promise can outlive the thing it was
   * waiting for: an external viewer the user has already come back from may never resolve the call
   * that opened it, and a guard held by it would refuse every later tap. The abandoned run's own
   * settling then leaves any newer run's hold alone.
   */
  release(): void;
}

/** The guard itself, outside React - for the hook below, and for tests. */
export function createSingleFlight(): SingleFlight {
  /** The run holding the guard, by identity, so a released run cannot release its successor. */
  let holder: object | null = null;
  const guard = async <T>(fn: () => T | Promise<T>): Promise<T | undefined> => {
    // Everything up to the first `await` runs synchronously in the caller's tick, so this check and
    // the claim below happen inside the tap itself: a second tap in the same frame sees the claim.
    if (holder !== null) {
      return undefined;
    }
    const mine = {};
    holder = mine;
    try {
      return await fn();
    } finally {
      if (holder === mine) {
        holder = null;
      }
    }
  };
  return Object.assign(guard, {
    release: () => {
      holder = null;
    },
  });
}

/**
 * A single-flight guard that lives as long as the component: the same guard on every render, so a
 * tap handled by a stale closure and one handled by a fresh one still share it.
 *
 * Every action passed to the same guard excludes the others - one guard per group of actions that
 * must not overlap (all of a screen's runs, say), not one per button.
 */
export function useSingleFlight(): SingleFlight {
  const [guard] = useState(createSingleFlight);
  return guard;
}
