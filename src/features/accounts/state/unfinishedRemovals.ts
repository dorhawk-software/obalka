// The boxes whose removal did not finish on this phone (001 T037, FR-007).
//
// Once a box's row is gone, nothing in the app can reach what is left of it - its Keychain items, its
// archive rows, reminders and their notifications, scan dismissals, or an app lock left armed with no
// box behind it. A dialog offered to try again, but closing it, or the app being killed halfway through
// the removal, left all of that on the device until the same box was added and removed again. This is
// the note that lets the removal finish later: written before a removal starts, cleared once every
// step went, and read at the next launch (`resumeRemoval` in `removeBox.ts`).
//
// Kept in the settings table under a DEVICE-LOCAL key (`DEVICE_LOCAL_SETTINGS`): a backup leaves it
// out and a restore skips it, because a marker restored onto another install could clear a box the
// same backup had just brought back.

import { UNFINISHED_REMOVALS_KEY } from '../../../app/settings/settingsKeys';

/** The slice of the settings table the marker is kept in. */
export interface MarkerSettings {
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
}

/** Every method may throw: a settings table that will not read or write says so. */
export interface UnfinishedRemovals {
  /** The boxes marked, oldest first. */
  list(): Promise<string[]>;
  /** Mark a box whose removal is about to start. Marking one already marked changes nothing. */
  add(boxId: string): Promise<void>;
  /** The box's removal finished, or the box is listed again: nothing is left to finish. */
  remove(boxId: string): Promise<void>;
}

/**
 * The stored value as box ids. Anything that is not a JSON array of strings reads as no marks.
 *
 * A mark is only ever a reason to look again, never a reason to delete on its own - the resume asks
 * the accounts table before it touches anything - so reading a damaged value as empty loses a retry,
 * never data.
 */
export function parseUnfinished(raw: string | null): string[] {
  if (raw == null || raw.length === 0) {
    return [];
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) {
      return [];
    }
    return [
      ...new Set(value.filter((v): v is string => typeof v === 'string' && v.length > 0)),
    ];
  } catch {
    return [];
  }
}

/**
 * The marker over the settings table.
 *
 * Read-modify-write of one value, which is safe only because every caller runs inside the shell's
 * removal queue (`RemovalQueue`), one removal at a time.
 */
export function unfinishedRemovals(settings: MarkerSettings): UnfinishedRemovals {
  const read = async () =>
    parseUnfinished(await settings.getSetting(UNFINISHED_REMOVALS_KEY));
  const write = (boxIds: readonly string[]) =>
    settings.setSetting(UNFINISHED_REMOVALS_KEY, JSON.stringify(boxIds));
  return {
    list: read,
    add: async boxId => {
      const marked = await read();
      if (!marked.includes(boxId)) {
        await write([...marked, boxId]);
      }
    },
    remove: async boxId => {
      const marked = await read();
      if (marked.includes(boxId)) {
        await write(marked.filter(id => id !== boxId));
      }
    },
  };
}
