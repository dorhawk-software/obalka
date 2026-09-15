// What a backup is doing right now (006).
//
// "Pracuji…" is not a progress report. It hides two things a person actually wants to know while
// their archive is being written: whether anything is happening at all, and how much is left. So
// every long step reports where it is, and the numbers are REAL - message counts come from the rows
// being read, and the encryption fraction comes from Argon2id itself rather than from a timer
// pretending to be one.
//
// The overall fraction is a weighted composition of the stages, and the weights are honest about
// being approximate: they come from the observed shape of a run (the KDF dominates everything else),
// not from a claim that reading is exactly a fifth of the work. What must never be approximate is the
// COUNT - "12 z 40" has to mean twelve of forty.

/** The steps of a backup, in the order they happen. Restores use `fetching`/`opening`/`restoring`. */
export type BackupStage =
  /** Downloading missing attachments before a backup in the `all` mode (026). Reported by the controller. */
  | 'downloading'
  | 'reading'
  | 'documents'
  | 'sealing'
  | 'writing'
  | 'fetching'
  | 'opening'
  | 'restoring';

export interface BackupProgress {
  stage: BackupStage;
  /** Units finished in this stage, and how many there are. `total: 0` means "not countable". */
  done: number;
  total: number;
  /** 0..1 across the WHOLE operation - what the bar draws. Never decreases. */
  fraction: number;
  /** What is being worked on: a box label, a folder name. Shown next to the stage. */
  detail?: string;
}

export type ProgressFn = (progress: BackupProgress) => void;

/**
 * Stage weights, per operation. They sum to 1 within each operation.
 *
 * Argon2id at 64 MiB / 3 passes is by far the longest step on a phone - reading a few thousand rows
 * out of SQLite is not close - so it gets most of the bar. A bar that raced to 90% and then sat there
 * for eight seconds would be a worse lie than no bar at all.
 */
const BACKUP_WEIGHTS: Record<string, number> = {
  reading: 0.25,
  sealing: 0.6,
  writing: 0.15,
};

const RESTORE_WEIGHTS: Record<string, number> = {
  fetching: 0.1,
  opening: 0.6,
  restoring: 0.3,
};

/**
 * The same runs with Tier 2 in them, which changes the shape completely.
 *
 * Documents are megabytes of AEAD over the filesystem; the KDF that dominates a metadata-only run is
 * a rounding error beside them. A SEPARATE set rather than one set with a `documents: 0` entry,
 * because reusing the metadata weights would make an ordinary backup - by far the common case - jump
 * a third of the bar the instant it started, to skip a stage that was never going to run.
 */
const BACKUP_WEIGHTS_WITH_DOCUMENTS: Record<string, number> = {
  reading: 0.1,
  documents: 0.65,
  sealing: 0.18,
  writing: 0.07,
};

const RESTORE_WEIGHTS_WITH_DOCUMENTS: Record<string, number> = {
  fetching: 0.05,
  opening: 0.2,
  restoring: 0.1,
  documents: 0.65,
};

/** Which set a run uses. The caller knows whether Tier 2 will run before the first report. */
export type ProgressKind =
  | 'backup'
  | 'backupWithDocuments'
  | 'restore'
  | 'restoreWithDocuments';

const WEIGHTS: Record<ProgressKind, Record<string, number>> = {
  backup: BACKUP_WEIGHTS,
  backupWithDocuments: BACKUP_WEIGHTS_WITH_DOCUMENTS,
  restore: RESTORE_WEIGHTS,
  restoreWithDocuments: RESTORE_WEIGHTS_WITH_DOCUMENTS,
};

/**
 * Build a reporter that turns per-stage counts into an overall fraction.
 *
 * Monotonic by construction: the fraction it emits never goes backwards, because a bar that jumps
 * back reads as a failure even when the work is fine.
 */
export function progressReporter(
  onProgress: ProgressFn | undefined,
  kind: ProgressKind,
): (stage: BackupStage, done: number, total: number, detail?: string) => void {
  const weights = WEIGHTS[kind];
  const order = Object.keys(weights);
  let highest = 0;
  return (stage, done, total, detail) => {
    if (!onProgress) {
      return;
    }
    const index = order.indexOf(stage);
    const before = order
      .slice(0, index < 0 ? 0 : index)
      .reduce((sum, name) => sum + weights[name], 0);
    const within = total > 0 ? Math.min(done / total, 1) : 0;
    const fraction = Math.min(before + (weights[stage] ?? 0) * within, 1);
    highest = Math.max(highest, fraction);
    onProgress({ stage, done, total, fraction: highest, detail });
  };
}

/**
 * A cooperative cancel flag.
 *
 * Cooperative rather than pre-emptive because there is nothing to pre-empt: the work is a chain of
 * awaits, and the only safe places to stop are BETWEEN them. Each step checks before starting, so a
 * cancelled backup never leaves a half-written archive and a cancelled restore never leaves half a
 * transaction - the rollback does the rest.
 */
export interface CancelSignal {
  readonly cancelled: boolean;
}

/** Thrown when the user asked to stop. Not a failure: nothing is reported and nothing is broken. */
export class BackupAbortedError extends Error {
  constructor() {
    super('The backup was cancelled.');
  }
}

/** Throw if the user has asked to stop. Call it between steps, never inside one. */
export function throwIfCancelled(signal?: CancelSignal): void {
  if (signal?.cancelled) {
    throw new BackupAbortedError();
  }
}
