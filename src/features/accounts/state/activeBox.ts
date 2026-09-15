// Active-box persistence (feature 011): the LAST-USED box, remembered across launches so the app
// reopens straight into it (inbox-first). Stored as a single key/value in the same encrypted settings
// store as theme/language. CRASH-SAFE by contract (Principle II): a read error or a garbled/empty
// value resolves to `null` (→ the shell falls back to the first box, or Welcome when there are none);
// a write failure is swallowed - losing the last-used hint must never break a switch.

import { settingsStore } from '../deps';
import { reportFailure } from '../../../services/telemetry/telemetry';
import {
  ACTIVE_BOX_KEY,
  UNIFIED_INBOX_KEY,
} from '../../../app/settings/settingsKeys';

/** Read the persisted last-used box id, or `null` when unset/garbled/unreadable. Never throws. */
export async function readActiveBoxId(): Promise<string | null> {
  try {
    const value = await settingsStore.getSetting(ACTIVE_BOX_KEY);
    return typeof value === 'string' && value.length > 0 ? value : null;
  } catch (e) {
    reportFailure('settings.read', e, { stage: 'persist' });
    return null;
  }
}

/** Persist the active box id (or clear it with `null`/zero boxes). Best-effort; never throws. */
export async function writeActiveBoxId(id: string | null): Promise<void> {
  try {
    await settingsStore.setSetting(ACTIVE_BOX_KEY, id ?? '');
  } catch (e) {
    // best-effort persistence - a failure here must not break the switch (Principle II). It does
    // mean the app opens on the wrong box every launch, which reads as the switch not working.
    reportFailure('settings.write', e, { stage: 'persist' });
  }
}

/**
 * The fallback chain for "which box is active", given the persisted id and the boxes that exist:
 *   • no boxes            → `null`  (the shell shows Welcome)
 *   • persisted id exists → that id (last-used restore)
 *   • else                → the first box (stale/missing/garbled id degrades gracefully)
 * Pure + total - the single source of truth for active-box resolution, unit-tested independently.
 */
export function resolveActiveBoxId(
  persisted: string | null,
  boxIds: string[],
): string | null {
  if (boxIds.length === 0) {
    return null;
  }
  if (persisted != null && boxIds.includes(persisted)) {
    return persisted;
  }
  return boxIds[0];
}

/**
 * Read the persisted "was in the merged view" flag (`UNIFIED_INBOX_KEY`): whether the merged view
 * (`Vše`) was the last thing the user was looking at. Never throws.
 *
 * Persisted for the same reason the active box is: reopening the app somewhere other than where you
 * left it is a small, constant annoyance. Stored separately rather than as a sentinel inside
 * `activeBoxId`, because the two are genuinely independent - leaving `Vše` has to land you back on a
 * real box, and that box is the one you were on before. Device-local, like the active box: neither
 * travels in a backup (`DEVICE_LOCAL_SETTINGS`).
 */
export async function readUnified(): Promise<boolean> {
  try {
    return (await settingsStore.getSetting(UNIFIED_INBOX_KEY)) === '1';
  } catch (e) {
    reportFailure('settings.read', e, { stage: 'persist' });
    return false;
  }
}

/** Persist it. Best-effort, like the active box: losing the hint must never break the switch. */
export async function writeUnified(on: boolean): Promise<void> {
  try {
    await settingsStore.setSetting(UNIFIED_INBOX_KEY, on ? '1' : '0');
  } catch (e) {
    reportFailure('settings.write', e, { stage: 'persist' });
  }
}

/**
 * Whether the merged view may be shown at all, given how many boxes exist.
 *
 * ONE BOX MEANS NO MERGED VIEW, and that is a UX decision rather than a technical one: with a single
 * box, `Vše` and that box are the same list, so offering both is a choice whose two branches render
 * identically. The user has to work out that it does not matter, and they learn a model that
 * silently changes meaning the day they add a second box.
 *
 * The threshold also has to be enforced on the way DOWN. A user with two boxes who is sitting in
 * `Vše` and removes one must not be left in a view that has stopped existing, so this is asked on
 * every account change, not only when the flag is read at launch.
 */
export function resolveUnified(persisted: boolean, boxCount: number): boolean {
  return persisted && boxCount >= 2;
}

/** The same threshold, for surfaces that decide whether to OFFER the merged view (the switcher). */
export function unifiedAvailable(boxCount: number): boolean {
  return boxCount >= 2;
}
