// Console capture, installed only while Debug mode is recording and removed the moment it stops.
//
// This is where React Native's own diagnostics live: the yellow-box warnings, `console.error` from a
// failed render, a native module warning nobody reads on a phone. None of it reaches telemetry
// (`beforeBreadcrumb` drops console breadcrumbs, because this app logs envelopes), and none of it
// reaches a crash report. On a device it scrolls past in a Metro window the user does not have.
//
// The original methods are kept and always called, so nothing changes about what the console does.

import { record } from './debugLog';

type ConsoleMethod = 'log' | 'info' | 'warn' | 'error';
const METHODS: readonly ConsoleMethod[] = ['log', 'info', 'warn', 'error'];

type ConsoleFn = (...args: unknown[]) => void;
let original: Partial<Record<ConsoleMethod, ConsoleFn>> = {};
let installed = false;

/** Arguments as one line. Objects are stringified shallowly; a cycle must not throw here. */
function line(args: unknown[]): string {
  return args
    .map(a => {
      if (typeof a === 'string') {
        return a;
      }
      if (a instanceof Error) {
        return `${a.name}: ${a.message}`;
      }
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(' ');
}

export function installConsoleCapture(): void {
  if (installed) {
    return;
  }
  installed = true;
  original = {};
  for (const method of METHODS) {
    const previous = console[method] as ConsoleFn;
    original[method] = previous;
    (console as unknown as Record<ConsoleMethod, ConsoleFn>)[method] = (...args: unknown[]) => {
      // Record first, so a throw inside the original still leaves the trail. `record` cannot throw.
      record('console', line(args), { level: method });
      previous.apply(console, args);
    };
  }
}

export function removeConsoleCapture(): void {
  if (!installed) {
    return;
  }
  for (const method of METHODS) {
    const previous = original[method];
    if (previous) {
      (console as unknown as Record<ConsoleMethod, ConsoleFn>)[method] = previous;
    }
  }
  original = {};
  installed = false;
}

export function isConsoleCaptureInstalled(): boolean {
  return installed;
}
