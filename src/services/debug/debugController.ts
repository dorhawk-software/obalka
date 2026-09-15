// Start, stop, write, share. The whole feature's control flow in one place.
//
// Deliberately NOT persisted. Debug mode does not survive a restart and cannot be left on by
// accident across days (FR-007): the one state in this app that records the user's mail to a file is
// a state they have to re-enter on purpose. Bundles already written do persist - they are files the
// user owns, and Principle IV's instinct applies: never silently lose what somebody may still need.

import { APP_VERSION } from '../../app/appInfo';
import { buildManifest, writeBundle } from './debugBundle';
import { installConsoleCapture, removeConsoleCapture } from './debugConsole';
import {
  clearDebugBuffer,
  debugSnapshot,
  debugStatus,
  isDebugRecording,
  record,
  startDebugRecording,
  stopDebugRecording,
  type DebugLevel,
} from './debugLog';

let startedAt = 0;

export function startDebug(level: DebugLevel): void {
  startedAt = Date.now();
  startDebugRecording(level);
  installConsoleCapture();
  // Recorded rather than assumed: a bundle read weeks later should say what the app was.
  record('lifecycle', 'app', { appVersion: APP_VERSION });
}

export interface StoppedBundle {
  path: string;
  entries: number;
  dropped: number;
}

/** The save being written, while there is one; the latest, when one was stopped during another. */
let saving: Promise<StoppedBundle> | null = null;

/**
 * Stop recording and write the bundle.
 *
 * The buffer is cleared once the file is on disk, so the mail this feature deliberately collected
 * lives in exactly one place afterwards: a file the user can see and delete.
 *
 * Building the archive yields to the UI (Principle I), so the app keeps answering while it runs, and
 * two different things can arrive before it has finished. A second "Ukončit a uložit" for the SAME
 * recording is handed the write already under way rather than a second copy of the same file. A
 * recording STARTED in the meantime - the Debug screen can be left and opened again during a save -
 * is a recording of its own: stopping it stops it, and its bundle follows the one before it. Handing
 * that stop the older save instead would leave it recording behind a screen saying it had stopped.
 */
export function stopDebugAndWrite(): Promise<StoppedBundle> {
  if (saving && !isDebugRecording()) {
    return saving;
  }
  const save = stopAndWrite(saving);
  saving = save;
  const done = () => {
    if (saving === save) {
      saving = null;
    }
  };
  // Both paths, so the bookkeeping never turns a failed save into an unhandled rejection of its own.
  save.then(done, done);
  return save;
}

/**
 * The save still being written, if any. A Debug screen opened during it follows it to its outcome
 * instead of offering to start a recording while the last one is not on disk yet.
 */
export function debugSaveInFlight(): Promise<StoppedBundle> | null {
  return saving;
}

async function stopAndWrite(after: Promise<StoppedBundle> | null): Promise<StoppedBundle> {
  removeConsoleCapture();
  const status = debugStatus();
  const entries = stopDebugRecording();
  const endedAt = Date.now();
  const manifest = buildManifest({
    appVersion: APP_VERSION,
    level: status.level,
    startedAt: startedAt || status.startedAt,
    endedAt,
    entries: entries.length,
    dropped: status.dropped,
  });
  try {
    // One bundle at a time: the save before this one finishes first, whatever its outcome - that is
    // its own caller's to report. Two archives are then never built side by side, and the free file
    // name `writeBundle` picks cannot be taken by a write it is racing.
    if (after) {
      await after.catch(() => undefined);
    }
    const path = await writeBundle(manifest, entries, endedAt);
    return { path, entries: entries.length, dropped: status.dropped };
  } finally {
    // Only the trail this bundle was written from. Writing no longer holds the thread, so a new
    // recording can start before it finishes, and that recording has a buffer of its own: clearing
    // it here would quietly empty the next bundle.
    if (debugSnapshot() === entries) {
      clearDebugBuffer();
    }
  }
}

/** Stop without writing anything. The user changed their mind; nothing should be left behind. */
export function cancelDebug(): void {
  removeConsoleCapture();
  stopDebugRecording();
  clearDebugBuffer();
}
