// Deciding whether a backup can be restored, and carrying older ones forward (006 FR-009…FR-011).
//
// The decision comes in two halves that must not be merged:
//
//   1. From the MANIFEST alone - a few hundred bytes, fetched before anything else. A gigabyte
//      archive that turns out to be unreadable after it has been pulled over a phone connection is a
//      design failure, so the verdict has to be available before the download starts (FR-011).
//   2. From the PAYLOAD, after decryption, where the migration chain runs.
//
// The asymmetry between old and new is deliberate. An older backup is carried forward by migrations
// we can write, because we know what it contained. A NEWER backup is refused outright: an app cannot
// migrate from a shape that did not exist when it was compiled, and the alternative - reading the
// fields it recognises and dropping the rest - silently discards someone's data and calls it a
// successful restore. Refusing is the safe failure; half-restoring is not (Principle IV, FR-010).

import {
  BACKUP_SCHEMA_VERSION,
  type BackupManifest,
  type BackupPayload,
} from './schema';
import { FORMAT_VERSION } from './envelope';

export type Compatibility =
  /** Same shape as this build writes - restore directly. */
  | { kind: 'current' }
  /** Older, and every step from there to here exists - restore through the chain. */
  | { kind: 'migratable'; from: number; steps: number }
  /**
   * Written by a newer app. Not an error in the backup and not the user's fault - the remedy is an
   * app update, and the message must say that rather than "corrupt".
   */
  | { kind: 'tooNew'; theirs: number; ours: number; what: 'schema' | 'format' }
  /** Older than anything this build knows how to carry forward. */
  | { kind: 'unsupported'; reason: string };

/** One step in the chain. Each takes the payload as the PREVIOUS version wrote it. */
export interface Migration {
  /** The version this step upgrades FROM; it produces `from + 1`. */
  from: number;
  describe: string;
  apply: (payload: Record<string, unknown>) => Record<string, unknown>;
}

/**
 * The chain, oldest first.
 *
 * Every step takes the payload as the PREVIOUS version wrote it and hands back the next shape, so a
 * backup written by any version this app has ever shipped opens here.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    from: 1,
    describe: 'adds the Tier 2 document index (006 T020-T022)',
    // Version 1 predates documents entirely, so the honest upgrade is an EMPTY index and no key -
    // not an absent field the rest of the code would then have to guard everywhere. A version 1
    // backup holds the metadata tier and nothing else, which is exactly what this says.
    apply: payload => ({ ...payload, documents: [], documentKey: null }),
  },
];

/**
 * Can this backup be restored, judged from the manifest alone?
 *
 * Both versions are checked because they fail differently: an unreadable ENVELOPE means the bytes
 * cannot even be decrypted, an unreadable SCHEMA means they can be decrypted and not understood.
 */
export function compatibilityOf(manifest: BackupManifest): Compatibility {
  if (manifest.formatVersion > FORMAT_VERSION) {
    return {
      kind: 'tooNew',
      theirs: manifest.formatVersion,
      ours: FORMAT_VERSION,
      what: 'format',
    };
  }
  if (manifest.schemaVersion > BACKUP_SCHEMA_VERSION) {
    return {
      kind: 'tooNew',
      theirs: manifest.schemaVersion,
      ours: BACKUP_SCHEMA_VERSION,
      what: 'schema',
    };
  }
  if (manifest.schemaVersion === BACKUP_SCHEMA_VERSION) {
    return { kind: 'current' };
  }
  if (manifest.schemaVersion < 1) {
    return { kind: 'unsupported', reason: 'The backup does not say which version it is.' };
  }
  const missing = missingSteps(manifest.schemaVersion);
  if (missing.length > 0) {
    return {
      kind: 'unsupported',
      reason: `No migration from schema ${missing[0]} to ${missing[0] + 1}.`,
    };
  }
  return {
    kind: 'migratable',
    from: manifest.schemaVersion,
    steps: BACKUP_SCHEMA_VERSION - manifest.schemaVersion,
  };
}

/** Versions between `from` and current that no migration covers. */
function missingSteps(from: number): number[] {
  const gaps: number[] = [];
  for (let v = from; v < BACKUP_SCHEMA_VERSION; v++) {
    if (!MIGRATIONS.some(m => m.from === v)) {
      gaps.push(v);
    }
  }
  return gaps;
}

export class BackupIncompatibleError extends Error {
  constructor(readonly compatibility: Compatibility, message: string) {
    super(message);
  }
}

/**
 * Carry a decrypted payload up to the current shape.
 *
 * Throws rather than best-effort parsing: by the time this runs the bytes are already decrypted, so
 * the temptation to "just use what we recognise" is at its strongest and its consequences are at
 * their worst - a restore that reports success having dropped the fields it did not know.
 */
export function migratePayload(raw: Record<string, unknown>): BackupPayload {
  const version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 0;
  if (version > BACKUP_SCHEMA_VERSION) {
    throw new BackupIncompatibleError(
      { kind: 'tooNew', theirs: version, ours: BACKUP_SCHEMA_VERSION, what: 'schema' },
      `This backup was made by a newer version of the app (backup format ${version}; this app reads ${BACKUP_SCHEMA_VERSION}). Update the app and try again.`,
    );
  }
  if (version < 1) {
    throw new BackupIncompatibleError(
      { kind: 'unsupported', reason: 'no schemaVersion' },
      'This file does not look like a backup made by this app.',
    );
  }
  let payload = raw;
  for (let v = version; v < BACKUP_SCHEMA_VERSION; v++) {
    const step = MIGRATIONS.find(m => m.from === v);
    if (!step) {
      throw new BackupIncompatibleError(
        { kind: 'unsupported', reason: `no migration from ${v}` },
        `This backup is too old for this version of the app (no upgrade path from format ${v}).`,
      );
    }
    payload = step.apply(payload);
    payload.schemaVersion = v + 1;
  }
  return payload as unknown as BackupPayload;
}

/**
 * Every version from 1 to current has a way forward.
 *
 * Called by the tests rather than at runtime: a missing migration is a mistake made while writing
 * code, and the moment to hear about it is then - not when somebody restores a lost phone.
 */
export function assertChainCovers(): void {
  const gaps: number[] = [];
  for (let v = 1; v < BACKUP_SCHEMA_VERSION; v++) {
    if (!MIGRATIONS.some(m => m.from === v)) {
      gaps.push(v);
    }
  }
  if (gaps.length > 0) {
    throw new Error(
      `BACKUP_SCHEMA_VERSION is ${BACKUP_SCHEMA_VERSION} but no migration exists from version(s) ${gaps.join(', ')}. ` +
        'Every backup ever written must have a path to the current shape. Add the missing step to MIGRATIONS.',
    );
  }
}
