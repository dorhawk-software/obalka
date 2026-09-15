// The recorder. Off by default, off after a restart, and holding nothing at all when it is off.
//
// WHAT FEEDS IT. Not `logging/logger.ts` - that module has no callers and never had any, so "record
// the logs" would have recorded an empty file. The trail comes from the places that already know
// something happened: `telemetry.trace()` and `telemetry.reportFailure()` (already called at many
// sites), the ISDS HTTP boundary, and the console. Those are routed here IN ADDITION to whatever
// they already did; nothing changes about telemetry, which is a separate channel with a separate
// trust model.
//
// WHAT IT IS FOR. A Sentry report is an allow-list and cannot answer "what was the envelope that
// failed to parse". This can, at the Full level, because the file never leaves the phone unless the
// person whose mail it is decides to send it.
//
// BOUNDED, because a debug mode people forget to turn off is a debug mode that fills a phone. Two
// caps, entries and bytes, oldest dropped first.

import { stripCredentials, stripCredentialsDeep } from './debugRedact';
import { NO_REDACTIONS, scrubText, type RedactionSet } from '../telemetry/scrub';

/**
 * How much of the truth the bundle carries.
 *
 * `standard` runs the telemetry scrubber over every string, so the bundle says WHAT failed and WHERE
 * without quoting anyone's mail. `full` skips that step and keeps the SOAP bodies, which is the
 * whole reason this feature exists - and is why the screen makes the user choose it deliberately.
 *
 * Credentials are removed at both. See `debugRedact.ts`.
 */
export type DebugLevel = 'standard' | 'full';

export type DebugKind =
  | 'lifecycle'
  | 'trace'
  | 'failure'
  | 'http'
  | 'http.body'
  | 'console'
  | 'nav';

export interface DebugEntry {
  /** Epoch ms. Absolute rather than relative: bundles get read next to a user's own description. */
  t: number;
  kind: DebugKind;
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Caps. A long debug session keeps the most recent window, which is where the bug is. Exported because
 * they are also the largest numbers the Debug screen's counter can show, and it reserves room for them.
 */
export const MAX_ENTRIES = 4000;
export const MAX_BYTES = 4 * 1024 * 1024;
/** One entry's own cap, so a single 30 MB SOAP response cannot evict the whole trail. */
const MAX_ENTRY_CHARS = 64 * 1024;

let recording = false;
let level: DebugLevel = 'standard';
let startedAt = 0;
let buffer: DebugEntry[] = [];
let bytes = 0;
let dropped = 0;
let redactions: RedactionSet = NO_REDACTIONS;

/** The device's own identifiers, so `standard` can remove them by literal. Same set telemetry uses. */
export function setDebugRedactionIdentifiers(literals: readonly string[]): void {
  redactions = { literals: [...new Set(literals.filter(Boolean))] };
}

export function isDebugRecording(): boolean {
  return recording;
}

/**
 * Who needs to know the moment recording starts or stops: the indicator the navigator draws over
 * every screen (FR-007).
 *
 * A listener set rather than a poll. The indicator has to be right on whatever screen the person goes
 * to next, and a timer re-reading one boolean for the whole life of the app, to catch a state that
 * changes twice per recording, is the wrong trade.
 */
const listeners = new Set<() => void>();

/** Subscribe to recording starting or stopping. Returns the unsubscribe. */
export function subscribeDebugRecording(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function announceRecording(): void {
  // A copy: a listener that unsubscribes while being told must not skip the one after it.
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch {
      // Same rule as `record`: whatever is watching the recorder cannot break it.
    }
  }
}

export function debugLevel(): DebugLevel {
  return level;
}

export interface DebugStatus {
  recording: boolean;
  level: DebugLevel;
  startedAt: number;
  entries: number;
  bytes: number;
  dropped: number;
}

export function debugStatus(): DebugStatus {
  return {
    recording,
    level,
    startedAt,
    entries: buffer.length,
    bytes,
    dropped,
  };
}

export function startDebugRecording(at: DebugLevel): void {
  buffer = [];
  bytes = 0;
  dropped = 0;
  level = at;
  startedAt = Date.now();
  recording = true;
  record('lifecycle', 'recording started', { level: at });
  announceRecording();
}

/** Stop and hand back what was recorded. The buffer is NOT cleared: the bundle is written from it. */
export function stopDebugRecording(): DebugEntry[] {
  const wasRecording = recording;
  if (recording) {
    record('lifecycle', 'recording stopped');
  }
  recording = false;
  // Only on a real change: `cancelDebug` stops a recorder that may already be off, and telling every
  // screen about a state that did not move would re-render them for nothing.
  if (wasRecording) {
    announceRecording();
  }
  return buffer;
}

/** Drop everything held in memory. Called once a bundle is written, and when the screen discards. */
export function clearDebugBuffer(): void {
  buffer = [];
  bytes = 0;
  dropped = 0;
}

export function debugSnapshot(): readonly DebugEntry[] {
  return buffer;
}

function clamp(text: string): string {
  return text.length > MAX_ENTRY_CHARS
    ? `${text.slice(0, MAX_ENTRY_CHARS)}… [${text.length - MAX_ENTRY_CHARS} more characters]`
    : text;
}

/**
 * Record one event.
 *
 * Never throws, for the same reason telemetry never throws: a diagnostic tool that can break the app
 * it is watching is worse than no diagnostic tool. Redaction happens HERE, on the way in, not at
 * export - a credential cleaned at export time is a credential that sat in memory until then.
 */
export function record(
  kind: DebugKind,
  message: string,
  data?: Record<string, unknown>,
): void {
  if (!recording) {
    return;
  }
  try {
    // Always: credentials. Then, at `standard` only: the telemetry scrubber, which is what makes a
    // standard bundle carry no mail.
    let text = stripCredentials(String(message));
    let payload = data ? (stripCredentialsDeep(data) as Record<string, unknown>) : undefined;
    if (level === 'standard') {
      text = scrubText(text, redactions);
      payload = payload
        ? (JSON.parse(scrubText(JSON.stringify(payload), redactions)) as Record<string, unknown>)
        : undefined;
    }
    const entry: DebugEntry = { t: Date.now(), kind, message: clamp(text), data: payload };
    const size = entry.message.length + (payload ? JSON.stringify(payload).length : 0);
    buffer.push(entry);
    bytes += size;
    while (buffer.length > MAX_ENTRIES || bytes > MAX_BYTES) {
      const gone = buffer.shift();
      if (!gone) {
        break;
      }
      bytes -= gone.message.length + (gone.data ? JSON.stringify(gone.data).length : 0);
      dropped += 1;
    }
  } catch {
    // A recorder that throws is a recorder that breaks the app it is watching.
  }
}

/**
 * A SOAP body, recorded only at the Full level.
 *
 * Separated from `record` so the decision is at the CALL SITE and legible there: this is the one
 * function in the app that deliberately writes message content to a file, and it should be greppable.
 */
export function recordBody(label: string, body: string | undefined): void {
  if (!recording || level !== 'full' || !body) {
    return;
  }
  record('http.body', label, { body: clamp(stripCredentials(body)) });
}
