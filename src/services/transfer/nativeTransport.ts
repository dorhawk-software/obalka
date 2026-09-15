// The native half of the transfer seam (025 T008).
//
// Everything above this file talks to `Transport`; this is the one place that knows a native module
// exists at all. It follows `bulkCipher.ts`'s rule exactly: resolve the module PER CALL and answer
// "not available" rather than throwing at import, because a throwing import takes the whole screen
// with it while a missing module should only ever mean "this phone cannot do this one thing".
//
// On Android the Go archive is loaded reflectively and is not committed, so `available()` is a real
// question with a real answer rather than a formality - see `TransferModule.kt`. On iOS the module is
// compiled only when the Go framework is linked (`ObalkaTransferModule.m`, 025 T022), so a build
// without it has no `ObalkaTransfer` module at all and the answer below is no.

import { NativeEventEmitter, NativeModules } from 'react-native';
import { reportFailure } from '../telemetry/telemetry';
import {
  PhraseRefusedError,
  TransferCancelledError,
  TransferFailedError,
  TransferUnavailableError,
  type Transport,
  type TransferOptions,
  type TransferProgress,
} from './transport';

/** What the Kotlin/Swift module exposes. Paths, a phrase and a run's name; nothing richer can cross. */
interface NativeTransferModule {
  available(): Promise<boolean>;
  cancel(runId: string): void;
  send(runId: string, dir: string, secret: string, onlyLocal: boolean): Promise<void>;
  receive(runId: string, dir: string, secret: string, onlyLocal: boolean): Promise<void>;
  /** Optional: a module built before it existed simply leaves the display alone. */
  keepScreenOn?(on: boolean): void;
}

const EVENT = 'ObalkaTransfer:progress';

function nativeModule(): NativeTransferModule | null {
  try {
    const mod = NativeModules.ObalkaTransfer as NativeTransferModule | undefined;
    return typeof mod?.send === 'function' && typeof mod?.receive === 'function'
      ? mod
      : null;
  } catch (e) {
    reportFailure('transfer.native', e, { stage: 'native' });
    return null;
  }
}

/**
 * Whether the native side answered yes.
 *
 * Cached after the first successful answer only. A `false` is never cached, because the honest
 * reason for it - the archive was not built into this variant - does not change at runtime but a
 * module that has not finished registering yet does.
 */
let known: boolean | null = null;

function probe(): boolean {
  if (known === true) {
    return true;
  }
  const mod = nativeModule();
  if (!mod) {
    return false;
  }
  // The module is registered. Whether the GO archive behind it is present is a separate question
  // the module answers asynchronously; `available()` below is the synchronous best answer, and a
  // send that reaches a module with no archive rejects with `unavailable`, which is handled.
  known = true;
  return true;
}

/**
 * Every run gets its own name, and every stop names the run it is for (025 review, 2026-09-15).
 *
 * The module used to keep ONE stop flag for whatever was running. A stopped run's interval below
 * goes on setting it until that run settles, so a transfer started in that window was stopped by
 * the previous one; and the flag was cleared when a run was requested rather than when it started,
 * which un-stopped a run still winding down. Named runs make both impossible. The time is part of
 * the name so a reloaded bundle, whose counter starts again, cannot reuse a name that is still live.
 */
let runCount = 0;
function nextRunId(): string {
  runCount += 1;
  return `${Date.now().toString(36)}-${runCount}`;
}

/** The run `Transport.cancel` stops. Null when nothing is running, so a stop then reaches nobody. */
let current: string | null = null;

/** Turn the module's rejection codes into the outcomes the app tells apart. */
function toError(e: unknown): Error {
  const code = (e as { code?: string })?.code;
  const message = e instanceof Error ? e.message : String(e);
  if (code === 'unavailable') {
    return new TransferUnavailableError(message);
  }
  if (code === 'cancelled') {
    // The stop arriving, not a broken transfer - see `TransferCancelledError`.
    return new TransferCancelledError();
  }
  if (code === 'phrase' || /phrase refused/i.test(message)) {
    // The remedy is "read it again", never "check your network" (FR-006).
    return new PhraseRefusedError();
  }
  return new TransferFailedError(message);
}

/**
 * Subscribe to ONE run's progress events for the duration of that call.
 *
 * The module has one event name for every run, so each event carries the run it belongs to and the
 * rest are ignored: a stopped run still winding down must not move the next run's bar or claim a
 * route for it.
 *
 * `relayed` starts as null and only becomes a boolean once the native side has observed a route, so
 * the screen can say "not known yet" rather than guessing (FR-007).
 */
function listen(
  onProgress: TransferOptions['onProgress'],
  runId: string,
): { stop: () => void } {
  if (!onProgress) {
    return { stop: () => undefined };
  }
  const emitter = new NativeEventEmitter(
    NativeModules.ObalkaTransfer as never,
  );
  const state: TransferProgress = {
    stage: 'connecting',
    sent: 0,
    total: 0,
    relayed: null,
  };
  const sub = emitter.addListener(
    EVENT,
    (e: Partial<TransferProgress> & { runId?: string }) => {
      if (e.runId !== runId) {
        return;
      }
      if (e.stage) {
        state.stage = e.stage;
      }
      if (typeof e.sent === 'number') {
        state.sent = e.sent;
      }
      if (typeof e.total === 'number') {
        state.total = e.total;
      }
      if (typeof e.relayed === 'boolean') {
        state.relayed = e.relayed;
      }
      onProgress({ ...state });
    },
  );
  return { stop: () => sub.remove() };
}

/**
 * Poll the caller's cancel flag into this run's own flag in the module.
 *
 * Cooperative on both sides, checked between steps, for the same reason `progress.ts` gives: the
 * work is a chain of awaits and the only safe places to stop are between them.
 */
function forwardCancel(
  mod: NativeTransferModule,
  runId: string,
  signal: TransferOptions['signal'],
): () => void {
  if (!signal) {
    return () => undefined;
  }
  const timer = setInterval(() => {
    if (signal.cancelled) {
      mod.cancel(runId);
    }
  }, 200);
  return () => clearInterval(timer);
}

async function run(
  which: 'send' | 'receive',
  dir: string,
  options: TransferOptions,
): Promise<void> {
  const mod = nativeModule();
  if (!mod) {
    throw new TransferUnavailableError();
  }
  const runId = nextRunId();
  const progress = listen(options.onProgress, runId);
  const stopCancel = forwardCancel(mod, runId, options.signal);
  current = runId;
  try {
    await mod[which](runId, dir, options.secret, options.onlyLocal);
  } catch (e) {
    throw toError(e);
  } finally {
    stopCancel();
    progress.stop();
    // Only its own: a run that settles after a newer one started must not leave that one unstoppable.
    if (current === runId) {
      current = null;
    }
  }
}

/**
 * The real transport, the same on both platforms since 025 T022: the iOS module mirrors the Android
 * one method for method, so nothing here asks which platform it is on.
 */
export const nativeTransport: Transport = {
  available() {
    return probe();
  },
  send: (dir, options) => run('send', dir, options),
  async receive(dir, options) {
    await run('receive', dir, options);
    // The module writes into `dir` and the caller lists it; returning names the native side would
    // have to enumerate separately buys nothing and would be a second source of truth.
    return [];
  },
  cancel() {
    // Straight to the module, not through `forwardCancel`'s interval. `JavaTimerManager` stops
    // firing JS timers on `onHostPause`, so a stop issued as the app goes to the background would
    // otherwise wait for the user to come back. A module call is not a timer and goes out at once.
    // It names the run in flight, so with nothing running it reaches nobody, and it can never carry
    // over into the next transfer.
    const runId = current;
    if (runId === null) {
      return;
    }
    try {
      const mod = nativeModule();
      if (typeof mod?.cancel === 'function') {
        mod.cancel(runId);
      }
    } catch (e) {
      // Nothing to stop is the only way this can fail, and a stop must never throw at the screen.
      reportFailure('transfer.native', e, { stage: 'native' });
    }
  },
  keepScreenOn(on) {
    // FLAG_KEEP_SCREEN_ON on Android, the idle timer on iOS. A build without the module has nothing
    // to keep on.
    try {
      const mod = nativeModule();
      if (typeof mod?.keepScreenOn === 'function') {
        mod.keepScreenOn(on);
      }
    } catch (e) {
      // The display timing out is a stopped transfer the screen explains, never a crash.
      reportFailure('transfer.native', e, { stage: 'native' });
    }
  },
};
