// The backup use-cases, composed (006). Everything the Settings screen can ask for lives here, so the
// screen holds no crypto, no key handling and no ordering rules.
//
// Two decisions are worth stating, because both look like friction until you see what they buy:
//
//   1. There is NO `backupEnabled` setting row. "Enabled" means a passphrase exists in the Keychain,
//      and "last backup" is read from the target's manifests. Both facts have exactly one home, so
//      the screen cannot show "on" for a backup whose key was wiped by a restore-from-another-phone,
//      and cannot show a date for an archive that is not there.
//
//   2. Making a backup asks for the passphrase, which means the OS prompt (FR-013). It is the same
//      key that reveals it, and there is no second unprotected copy - a copy kept "for convenience"
//      would be the actual key, and the biometric one would be decoration. This costs a prompt per
//      backup and is affordable precisely because this app never syncs on its own (014): every
//      backup is something the user just asked for.

import {
  createBackup,
  listRestorable,
  pruneBackups,
  restoreBackup,
  verifyBackup,
  type FullRestoreReport,
  type RestorableBackup,
  type VerifyReport,
  type SyncTarget,
} from '../../../services/backup/backupService';
import {
  decodeDocumentKey,
  encodeDocumentKey,
  estimateDocuments,
  type DocumentDetails,
  type DocumentFs,
  type DocumentSource,
} from '../../../services/backup/documents';
import { buildPayload } from '../../../services/backup/snapshot';
import { generateRecoveryKey } from '../../../services/backup/recoveryKey';
import { packPortable, portableFileName, unpackPortable } from '../../../services/backup/portable';
import type { PortableIo } from '../../../services/backup/portableIo';
import {
  BackupPromptDeclinedError,
  type BackupSecretStore,
} from '../../../services/backup/backupSecret';
import type { BackupSource } from '../../../services/backup/snapshot';
import type { BackupSink } from '../../../services/backup/restore';
import type { BackupDocumentMode, BackupManifest } from '../../../services/backup/schema';
import type { KdfParams } from '../../../services/backup/envelope';
import {
  BackupAbortedError,
  throwIfCancelled,
  type BackupProgress,
  type CancelSignal,
  type ProgressFn,
} from '../../../services/backup/progress';
import { reportFailure, trace } from '../../../services/telemetry/telemetry';
import { BACKUP_HELD_KEY } from '../../../app/settings/settingsKeys';

/**
 * How long the archive must sit still before an automatic backup starts.
 *
 * A sync writes in bursts - the envelope list, then details, then read flags - and backing up after
 * each write would mean five backups for one refresh. Waiting for quiet coalesces them into one.
 */
const SETTLE_MS = 8_000;

/** The share of the bar a backup's own download of missing attachments takes (026). */
const DOWNLOAD_SHARE = 0.5;

/** How the user wants backups to behave. Defaults are the simple case; everything else is opt-in. */
export interface BackupPreferences {
  /** Back up on its own after the archive changes. On by default - it is what the switch promises. */
  automatic: boolean;
  /**
   * How many backups to keep, newest first. ONE by default.
   *
   * More than one is a real choice with a real cost: every copy is a whole archive. The cap of five
   * is not arbitrary either - it is the point past which "a few recent copies" becomes "a pile".
   */
  keep: number;
  /**
   * Back up the attachment files too, not only what the archive says about them (Tier 2, FR-008).
   *
   * OFF by default, and that is not timidity. Tier 1 is kilobytes; Tier 2 is the whole of every
   * document the user has ever downloaded, and enabling it without being asked would silently start
   * writing gigabytes to somebody's phone. The screen shows what it will cost BEFORE the switch
   * moves, which is the only honest way to ask the question.
   */
  documents: boolean;
  /**
   * Which attachments, when `documents` is on (026 US1): those already on the phone, or all of them,
   * downloading what is missing first. `downloaded` by default - the other one talks to ISDS, and is
   * chosen in the dialog, never assumed.
   */
  documentMode: BackupDocumentMode;
}

export const BACKUP_DEFAULTS: BackupPreferences = {
  automatic: true,
  keep: 1,
  documents: false,
  documentMode: 'downloaded',
};
export const MAX_KEEP = 5;

/** Where preferences live: the same encrypted settings table as everything else. */
export interface BackupSettings {
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
}

const AUTO_KEY = 'backup.automatic';
const KEEP_KEY = 'backup.keep';
const DOCUMENTS_KEY = 'backup.documents';
const DOCUMENT_MODE_KEY = 'backup.documentMode';
/**
 * The key every stored document is named and sealed under, hex.
 *
 * Minted once and then never changed, because changing it would rename every object in the store:
 * the old ones would become unreachable litter and the next backup would upload the entire archive
 * again beside them. It also travels inside each sealed payload, so a restored phone adopts the key
 * the backup was written with rather than inventing a second one.
 */
const DOCUMENT_KEY_KEY = 'backup.documentKey';

/** What a restore did, and whether the keys it used were kept on this phone. */
export interface RestoredBackup extends FullRestoreReport {
  /**
   * True when keeping the password or the document key failed - a declined screen-lock prompt, most
   * likely. The archive is restored either way; this decides only whether the screen says so.
   */
  keysFailed: boolean;
  /**
   * True when a document did not come back, so the backup it came from is kept out of retention until
   * a restore from it brings every document back or the person deletes it (2026-09-15).
   */
  held: boolean;
}

/**
 * How a restore from the backup screen ended, for a screen that did not see it end: the one that
 * started it was left with "Nechat běžet" (2026-09-15). A stopped restore has no outcome to say.
 */
export type RestoreOutcome =
  | { readonly ok: true; readonly restored: RestoredBackup }
  | { readonly ok: false; readonly error: unknown };

/** A backup in the restore list, and whether retention is keeping it back (see `restore`). */
export interface ListedBackup extends RestorableBackup {
  held: boolean;
}

/** Where a restored phone keeps the two keys a restore hands back. */
export interface RestoredKeyStores {
  secret: Pick<BackupSecretStore, 'has' | 'save'>;
  settings: BackupSettings;
}

/**
 * Keep the keys a restore has just used, where this phone has none of its own (006).
 *
 * The passphrase, so the restored phone is backing up under the same key rather than silently being
 * off; the document key, so its first backup names every document the way the store it came from
 * already does instead of uploading the whole archive again beside it. A phone that already has
 * either keeps its own - see `BackupController.restore` for why.
 *
 * Shared with the phone-to-phone transfer (025), which restores through the same path and arrives
 * holding the same two keys; until 2026-09-15 it kept neither.
 *
 * The document key goes FIRST. Keeping it asks nothing of the user and is right whether or not the
 * passphrase gets stored, while storing the passphrase can fail - Android asks for the screen lock on
 * the write, and that prompt can be declined. In the other order a declined prompt lost the document
 * key as well, and turning backups on afterwards minted a new one.
 */
export async function adoptRestoredKeys(
  stores: RestoredKeyStores,
  passphrase: string,
  documentKey: string | null | undefined,
  promptTitle: string,
): Promise<void> {
  if (documentKey && !(await stores.settings.getSetting(DOCUMENT_KEY_KEY))) {
    await stores.settings.setSetting(DOCUMENT_KEY_KEY, documentKey);
  }
  if (!(await stores.secret.has())) {
    await stores.secret.save(passphrase, promptTitle);
  }
}

/**
 * Keep the keys a restore used, once its archive is written, and say whether they were kept (006 and
 * 025, 2026-09-15).
 *
 * By then the rows are in, so a key that could not be kept is not a failed restore - and reporting it
 * as one is what made the backup screen say "Zálohu se nepodařilo obnovit" over a restore that had
 * worked. The caller says instead that the password was not kept. A declined screen-lock prompt is the
 * person's decision and leaves a trace; anything else is a fault and is reported.
 */
export async function keepRestoredKeys(
  stores: RestoredKeyStores,
  passphrase: string,
  documentKey: string | null | undefined,
  promptTitle: string,
): Promise<boolean> {
  try {
    await adoptRestoredKeys(stores, passphrase, documentKey, promptTitle);
    return true;
  } catch (e) {
    if (e instanceof BackupPromptDeclinedError) {
      trace('backup.restore', { stage: 'persist', outcome: 'declined' });
    } else {
      reportFailure('backup.restore', e, { stage: 'persist' });
    }
    return false;
  }
}

/** What Tier 2 needs from the device. Absent = this build cannot back up documents at all. */
export interface DocumentDeps {
  source: DocumentSource;
  fs: DocumentFs;
  details: DocumentDetails;
  /** Where this device keeps a message's attachment files. */
  messageDir(boxId: string, messageId: string): string;
  randomBytes(n: number): Uint8Array;
}

/**
 * Downloading the attachments the archive does not hold yet (026, `AttachmentPrefetcher`), for a
 * backup in the `all` mode that the person started. Absent in tests that do not exercise it.
 */
export interface MissingAttachments {
  download(options: {
    stop: CancelSignal;
    onProgress?: (progress: { done: number; total: number }) => void;
  }): Promise<{ downloaded: number; failed: number }>;
  /** For the dialog: messages whose attachments can still be downloaded, and those ISDS deleted. */
  estimate(): Promise<{ askable: number; gone: number }>;
}

export interface BackupControllerDeps {
  source: BackupSource;
  sink: BackupSink;
  secret: BackupSecretStore;
  target: SyncTarget;
  settings: BackupSettings;
  /** Tier 2 wiring. Absent in tests that do not exercise it, and then the switch cannot be on. */
  documents?: DocumentDeps;
  /** Moving a backup off the phone and back. Absent in tests that do not exercise it. */
  portableIo?: PortableIo;
  /** The `all` mode's downloads (026). Absent: the mode backs up what is on the phone. */
  missing?: MissingAttachments;
  appVersion: string;
  now?: () => number;
  /** Test seam only - production uses the envelope's memory-hard defaults. */
  kdf?: KdfParams;
}

export interface BackupStatus {
  /** A passphrase exists on this device, so backups can be made and read here. */
  enabled: boolean;
  /** The newest backup in the target, or null. Read from the target, never from a cached setting. */
  last: BackupManifest | null;
  /**
   * Whether this build can back up documents at all.
   *
   * Separate from the preference: a target with no object store (or a build with no filesystem
   * wiring) cannot hold documents however the switch is set, and a switch that cannot do anything
   * should not be shown.
   */
  documentsPossible: boolean;
  /** Whether the user has turned Tier 2 on. */
  documentsOn: boolean;
  /** Which attachments Tier 2 carries (026). */
  documentMode: BackupDocumentMode;
}

/**
 * The user dismissed the OS prompt (or there was no key to reveal).
 *
 * A distinct type because it is NOT a failure to report as one: cancelling a biometric prompt is a
 * decision, and the screen should quietly return to where it was rather than show an error.
 */
export class BackupCancelledError extends Error {
  constructor() {
    super('The backup passphrase was not unlocked.');
  }
}

/**
 * The phone has no screen lock, so the passphrase cannot be stored behind one.
 *
 * Its own type because the fix belongs to the user and is a single setting away. Reporting this as
 * "the backup failed" would leave them with a broken feature and no idea why.
 */
export class BackupLockUnavailableError extends Error {
  constructor() {
    super('This phone has no screen lock, so the backup passphrase cannot be protected.');
  }
}

/**
 * A restore that failed once its rows were in, from a backup it holds (2026-09-24).
 *
 * Its rows are in the archive and some of its documents are not, so the backup it came from stays
 * held, as it does for a restore that ended with documents missing. The failure said nothing of it,
 * and only the list row did. Its own type so the screen can say it where it says the failure; what
 * went wrong is `reason`, unchanged.
 */
export class BackupRestoreHeldError extends Error {
  constructor(readonly reason: unknown) {
    super(reason instanceof Error ? reason.message : String(reason));
    this.name = 'BackupRestoreHeldError';
  }
}

/** A backup, restore or verify that is happening right now, and how far it has got. */
export interface BackupRun {
  /**
   * A verify has a kind of its own (2026-09-15): it opens a backup the way a restore does, and ran as
   * one, so leaving it asked "Záloha ještě běží" and offered "Zrušit zálohu" for a check that writes
   * nothing.
   */
  kind: 'backup' | 'restore' | 'verify';
  progress: BackupProgress;
  /**
   * False for a run that cannot be stopped part-way: a phone-to-phone transfer's save (025 FR-012),
   * or a restore whose rows are in (FR-016, 2026-09-15), which the backup screen then offers no stop
   * for. Absent means it can be stopped. A restore changes it from one report to the next.
   */
  cancellable?: boolean;
}

/**
 * What writing into the archive from outside this controller takes: running as one of its runs, so
 * nothing else runs beside it (025 review, 2026-09-15). `BackupController` is the implementation, and
 * a write that has ended counts as a change to the archive, as a sync does (FR-017).
 */
export interface ArchiveRuns {
  runRestore<T>(work: (onProgress: ProgressFn) => Promise<T>): Promise<T>;
}

export class BackupController {
  constructor(private readonly deps: BackupControllerDeps) {}

  // ---------------------------------------------------------------------------------------------
  // The in-flight run lives HERE, not in the screen.
  //
  // Because the user asked for the obvious thing: start a backup, walk away from the screen, and have
  // it keep going. A run owned by a component dies with the component - so it is owned by the
  // controller, the screen SUBSCRIBES, and leaving is a question ("carry on, or stop?") rather than a
  // silent abort. `useSyncExternalStore` reads these two.
  // ---------------------------------------------------------------------------------------------

  private run: BackupRun | null = null;
  /**
   * The run in progress, settled - never rejected - once it has ended: what the next run waits for.
   *
   * ONE run at a time (025 review, 2026-09-15). A run asked for while another is going waits for it to
   * end instead of starting beside it. Two at once is how an automatic backup, scheduled by a sync
   * that settled a moment earlier, could read the archive while a transfer was writing into it - and,
   * with the default retention of one, prune the last good backup for a copy of a half-written one.
   */
  private running: Promise<void> | null = null;
  private settle: ReturnType<typeof setTimeout> | null = null;
  /**
   * The stop flag of every run that can be stopped and has not ended: the one running, and each one
   * waiting for it (2026-09-15).
   *
   * A flag per run, from the moment the run is asked for. There was one flag, reset whenever a run
   * STARTED, so a stop raised while a run waited behind another reached only the one running. Pressing
   * "Zálohovat nyní" during an automatic backup and then leaving with "Zrušit zálohu" stopped the
   * automatic backup, and the waiting backup started with a fresh flag and ran to the end.
   *
   * A restore lets go of its flag once its rows are in (see `restore`), and the run it publishes then
   * says it cannot be stopped.
   */
  private readonly stops = new Set<{ cancelled: boolean }>();
  private listeners = new Set<() => void>();

  /**
   * The backup the user asked for - `enable` or `backupNow` - while it runs, with everyone listening to
   * its progress (audit 2026-09-23).
   *
   * A second call while one runs JOINS it: the same promise, the same manifest, its progress reported
   * to both callers. Two `enable`s used to both find no key, both mint one and both save it - and the
   * first backup could end up sealed under a key the second save had already replaced, which nobody
   * can restore with the key the screen then shows. Two `backupNow`s queued a second full backup of an
   * unchanged archive behind the first, and under the default retention of one it evicted an older,
   * different backup to keep a duplicate. The screen guards its own buttons, but a controller cannot
   * assume every caller does - and a double tap is exactly when the caller's state is a render behind.
   */
  private manual: {
    readonly done: Promise<BackupManifest>;
    readonly progress: Set<ProgressFn>;
  } | null = null;

  /**
   * How the restores from the backup screen ended that no screen has said yet, oldest first
   * (2026-09-15).
   *
   * The screen that starts a restore says how it ended while it is open. Left with "Nechat běžet", it
   * cannot, and nothing else did: a restore that finished, or failed, with the screen closed was
   * reported nowhere. It is kept here the way a transfer's save keeps its outcome (025), and the backup
   * screen says it the next time it is in view. Taking it is what stops a second screen saying it.
   *
   * More than one, since the review the same day: nothing stops a restore being started on a later
   * visit while one an earlier visit left is still going, and one slot kept only the last to end.
   */
  private readonly unseenRestores: RestoreOutcome[] = [];
  private readonly restoreListeners = new Set<() => void>();

  /**
   * The turn every change to the held backups takes, retention included (2026-09-15, review).
   *
   * Each reads the list, changes it and writes it back, and a read answers with what was stored when
   * it was asked. Side by side, a delete letting go of one backup wrote its older copy of the list over
   * the hold a restore had just stored for another, and retention, having read the list a moment before
   * a restore held its backup, deleted that backup. Either way a document's last copy could go.
   */
  private heldTurn: Promise<void> = Promise.resolve();

  /**
   * How many attachment download runs are going (026 FR-006). Each downloaded message changes the
   * archive and would schedule a backup of its own; while this is above zero an automatic backup waits
   * for quiet again, so one backup follows the run.
   */
  private downloadHolds = 0;

  /** Keep automatic backups waiting until the release is called. Idempotent release. */
  holdAutomatic = (): (() => void) => {
    this.downloadHolds++;
    let released = false;
    return () => {
      if (!released) {
        released = true;
        this.downloadHolds--;
      }
    };
  };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** How the oldest restore no screen has said ended, handed out once: null when none is left. */
  takeRestoreOutcome(): RestoreOutcome | null {
    return this.unseenRestores.shift() ?? null;
  }

  /** Hear when a restore ends. The listener takes the outcome itself, if it is the screen to say it. */
  subscribeRestoreOutcome = (listener: () => void): (() => void) => {
    this.restoreListeners.add(listener);
    return () => {
      this.restoreListeners.delete(listener);
    };
  };

  private restoreEnded(outcome: RestoreOutcome, seen: (() => boolean) | undefined): void {
    // Asked as it ends rather than as it starts: the screen that started it may have been left since.
    // Kept only when that screen will not say it, so a restore it said is never said a second time, and
    // an outcome kept for the next screen is not taken by a screen on its way out (see `restore`).
    if (seen?.() === true) {
      return;
    }
    this.unseenRestores.push(outcome);
    for (const listener of [...this.restoreListeners]) {
      try {
        listener();
      } catch (e) {
        // A screen that cannot take the outcome leaves it for the next one; the restore has ended.
        reportFailure('backup.restore', e);
      }
    }
  }

  /** The current run, or null. Stable identity while nothing changes (useSyncExternalStore needs it). */
  currentRun = (): BackupRun | null => this.run;

  /**
   * Ask what is going on to stop: the run in progress and every run waiting for it. The running one
   * ends at the next step boundary and a waiting one never starts; nothing is left half-done. A run
   * asked for after the stop is not stopped by it.
   *
   * A run that cannot stop part-way (a transfer's save, or a restore whose rows are in) has no flag to
   * raise, so a stop passes it by rather than making it a promise it does not keep.
   *
   * Says whether the run in progress will stop: false when one is going that this stop passes by. A
   * question asked while a restore could still be stopped is answered after its rows are in, when the
   * leave dialog stays open across that point, and the answer "stop" must then not be dropped without
   * a word (2026-09-15). True when nothing is running, since then nothing goes on.
   */
  cancelRun = (): boolean => {
    for (const stop of this.stops) {
      stop.cancelled = true;
    }
    return this.run?.cancellable !== false;
  };

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private async track<T>(
    kind: BackupRun['kind'],
    work: (onProgress: ProgressFn, stop: CancelSignal) => Promise<T>,
    cancellable = true,
  ): Promise<T> {
    // The run's own flag, raised by a stop that comes while it is still waiting as well as later.
    const stop = { cancelled: false };
    if (cancellable) {
      this.stops.add(stop);
    }
    try {
      return await this.inTurn(kind, onProgress => work(onProgress, stop), stop);
    } finally {
      this.stops.delete(stop);
    }
  }

  private async inTurn<T>(
    kind: BackupRun['kind'],
    work: (onProgress: ProgressFn) => Promise<T>,
    stop: { cancelled: boolean },
  ): Promise<T> {
    // Re-checked after every wait: two runs waiting on the same one both wake, and the first to go
    // claims `running` before the second looks again.
    while (this.running) {
      await this.running;
    }
    // Stopped while it waited: it does not start, and ends the way a stopped run does.
    throwIfCancelled(stop);
    const ended = this.runNow(kind, work, () => this.stops.has(stop));
    const settled = ended.then(
      () => undefined,
      () => undefined,
    );
    this.running = settled;
    try {
      return await ended;
    } finally {
      if (this.running === settled) {
        this.running = null;
      }
    }
  }

  private async runNow<T>(
    kind: BackupRun['kind'],
    work: (onProgress: ProgressFn) => Promise<T>,
    stoppable: () => boolean,
  ): Promise<T> {
    // Asked at every report rather than once, because a restore stops being stoppable part-way.
    this.run = {
      kind,
      progress: { stage: kind === 'backup' ? 'reading' : 'fetching', done: 0, total: 0, fraction: 0 },
      cancellable: stoppable(),
    };
    this.emit();
    try {
      return await work(progress => {
        this.run = { kind, progress, cancellable: stoppable() };
        this.emit();
      });
    } finally {
      this.run = null;
      this.emit();
    }
  }

  async status(): Promise<BackupStatus> {
    const [enabled, manifests, preferences] = await Promise.all([
      this.deps.secret.has(),
      this.deps.target.listManifests().catch(() => [] as BackupManifest[]),
      this.preferences(),
    ]);
    const last = manifests.reduce<BackupManifest | null>(
      (newest, m) => (!newest || m.createdAt > newest.createdAt ? m : newest),
      null,
    );
    return {
      enabled,
      last,
      documentsPossible: this.canHoldDocuments(),
      documentsOn: preferences.documents,
      documentMode: preferences.documentMode,
    };
  }

  /** Both halves have to be there: the device wiring AND a target with an object store. */
  private canHoldDocuments(): boolean {
    const { documents, target } = this.deps;
    return (
      documents != null &&
      typeof target.hasObject === 'function' &&
      typeof target.putObject === 'function' &&
      typeof target.getObject === 'function'
    );
  }

  /**
   * Turn backups on: mint a key, store it behind the OS gate, and make the first backup immediately.
   *
   * The first backup is not optional. "Enabled" with nothing stored is the state where a user
   * believes they are covered and are not, and it is the exact state a phone gets lost in.
   *
   * A key this phone ALREADY holds is backed up under, never replaced (025 review, 2026-09-15). A
   * phone-to-phone transfer keeps the key that arrived from a screen of its own, while this screen,
   * still open underneath, could go on showing backups as off. Switching them on minted a new key over
   * the one the user holds on paper from the old phone - and a failed first backup then cleared it.
   * Only a key minted here is cleared when its first backup fails.
   */
  enable(promptTitle: string, onProgress?: ProgressFn): Promise<BackupManifest> {
    return this.joinManual(onProgress, fan => this.enableNow(promptTitle, fan));
  }

  private async enableNow(promptTitle: string, onProgress: ProgressFn): Promise<BackupManifest> {
    if (!(await this.deps.secret.canProtect())) {
      throw new BackupLockUnavailableError();
    }
    if (await this.deps.secret.has()) {
      return this.backupNowAlone(promptTitle, onProgress);
    }
    const passphrase = generateRecoveryKey();
    // The title matters on Android, which shows the gate when STORING as well as when reading.
    await this.deps.secret.save(passphrase, promptTitle);
    try {
      return await this.track('backup', (progress, stop) =>
        this.backupWith(passphrase, stop, combine(onProgress, progress)),
      );
    } catch (err) {
      // Leave nothing half-on: a key with no backup would report "enabled" forever.
      await this.deps.secret.clear();
      throw err;
    }
  }

  // Whether switching on asks for the gate is a PLATFORM difference, not a choice: iOS prompts only
  // when reading, Android also when writing (the Keystore key requires authentication to use). Both
  // are acceptable - what is not is an unnamed prompt, so the title travels with the write too.

  /**
   * Make a backup now.
   *
   * Uses the app's own copy of the passphrase, so it does NOT prompt: the user pressed a button that
   * says "back up", and answering it with a fingerprint challenge would be asking them to confirm the
   * thing they just asked for. The gate guards SHOWING the passphrase, not using it.
   *
   * Called while a backup the user asked for is still running, it joins that one (see `manual`).
   */
  backupNow(promptTitle: string, onProgress?: ProgressFn): Promise<BackupManifest> {
    return this.joinManual(onProgress, fan => this.backupNowAlone(promptTitle, fan));
  }

  /**
   * Join the backup the user asked for that is already running, or start this one as it (`manual`).
   * Claimed before anything awaits, so a call in the same tick - the second tap - already joins.
   */
  private joinManual(
    onProgress: ProgressFn | undefined,
    start: (onProgress: ProgressFn) => Promise<BackupManifest>,
  ): Promise<BackupManifest> {
    const running = this.manual;
    if (running) {
      if (onProgress) {
        running.progress.add(onProgress);
      }
      return running.done;
    }
    const progress = new Set<ProgressFn>();
    if (onProgress) {
      progress.add(onProgress);
    }
    const done = start(p => {
      for (const listener of [...progress]) {
        listener(p);
      }
    });
    const entry = { done, progress };
    this.manual = entry;
    const release = () => {
      if (this.manual === entry) {
        this.manual = null;
      }
    };
    done.then(release, release);
    return done;
  }

  private async backupNowAlone(
    promptTitle: string,
    onProgress: ProgressFn,
  ): Promise<BackupManifest> {
    const passphrase = await this.usableSecret(promptTitle);
    if (!passphrase) {
      throw new BackupCancelledError();
    }
    return this.track('backup', async (progress, stop) => {
      const report = combine(onProgress, progress);
      // The `all` mode downloads what is missing first, and only here: this is a backup the person
      // asked for. An automatic one never signs in (026 FR-006) - the refresh before it downloaded.
      if (!(await this.downloadsFirst())) {
        return this.backupWith(passphrase, stop, report);
      }
      await this.downloadMissing(stop, report);
      throwIfCancelled(stop);
      // The download took the first half of the bar; the backup the second, so it never runs back.
      return this.backupWith(passphrase, stop, p =>
        report({ ...p, fraction: DOWNLOAD_SHARE + (1 - DOWNLOAD_SHARE) * p.fraction }),
      );
    });
  }

  /** Whether a backup the person asked for downloads missing attachments before it starts. */
  private async downloadsFirst(): Promise<boolean> {
    if (!this.deps.missing) {
      return false;
    }
    const preferences = await this.preferences();
    return preferences.documents && preferences.documentMode === 'all';
  }

  private async downloadMissing(stop: CancelSignal, report: ProgressFn): Promise<void> {
    report({ stage: 'downloading', done: 0, total: 0, fraction: 0 });
    try {
      await this.deps.missing!.download({
        stop,
        onProgress: ({ done, total }) =>
          report({
            stage: 'downloading',
            done,
            total,
            fraction: total > 0 ? DOWNLOAD_SHARE * Math.min(done / total, 1) : 0,
          }),
      });
    } catch (e) {
      // The backup still runs: what did download is on the phone, and the manifest counts the rest.
      reportFailure('backup.document', e, { stage: 'transport' });
    }
  }

  /**
   * What the `all` mode would still have to download, and what ISDS no longer has - for the dialog
   * that offers it (026 US1). Zeros when this build has no downloader.
   */
  async missingEstimate(): Promise<{ askable: number; gone: number }> {
    return this.deps.missing ? this.deps.missing.estimate() : { askable: 0, gone: 0 };
  }

  /**
   * The archive changed - a sync brought messages, a document was downloaded, a reminder moved.
   *
   * This is what makes the switch mean what it says. It was reported as a fair question and it was
   * not: "when a new message appears, is it automatically backed up?" It was not; the toggle set
   * backups up and then waited for a button. Now a change schedules one.
   *
   * Nothing here runs in the background (014): it is a consequence of work the user just asked for,
   * in the foreground, and it is silent - the status line showing a newer time is the whole report.
   */
  archiveChanged(): void {
    if (this.settle) {
      clearTimeout(this.settle);
    }
    this.settle = setTimeout(() => {
      this.settle = null;
      void this.autoBackup();
    }, SETTLE_MS);
  }

  /** Stop any pending automatic backup. For teardown and for tests. */
  cancelPending(): void {
    if (this.settle) {
      clearTimeout(this.settle);
      this.settle = null;
    }
  }

  /**
   * The passphrase the app can work with, healing an older install on the way.
   *
   * Phones set up before the app kept two copies have only the gated one. Rather than leaving those
   * users with a switch that says on and a button that does nothing, the first backup after the
   * update asks once, uses the answer, and writes the app-usable copy - after which nothing asks
   * again. `promptTitle` is what the OS shows if that one prompt happens.
   */
  private async usableSecret(promptTitle: string): Promise<string | null> {
    const ready = await this.deps.secret.forUse();
    if (ready) {
      return ready;
    }
    if (!(await this.deps.secret.has())) {
      return null; // backups are genuinely off
    }
    const revealed = await this.deps.secret.reveal(promptTitle);
    if (revealed) {
      await this.deps.secret.save(revealed, promptTitle);
    }
    return revealed;
  }

  private async autoBackup(): Promise<void> {
    // All of it inside the one `try` (2026-09-15). It runs from a timer with nobody awaiting it, and
    // reading the preferences is a database read that can reject; outside the `try` that rejection went
    // unhandled, and a restore now schedules this too.
    try {
      if (!(await this.preferences()).automatic) {
        return; // the user asked to press the button themselves
      }
      // Something is already running (a manual backup, a restore, a transfer's save). Wait for quiet
      // again rather than queueing a second one behind it.
      if (this.run || this.running || this.downloadHolds > 0) {
        this.archiveChanged();
        return;
      }
      const passphrase = await this.deps.secret.forUse();
      if (!passphrase) {
        return; // backups are off - nothing to do, and nothing to say about it
      }
      await this.track('backup', (progress, stop) => this.backupWith(passphrase, stop, progress));
    } catch (e) {
      if (e instanceof BackupAbortedError) {
        return; // stopped by the person, which is a decision rather than a failure to report
      }
      // Silent TO THE USER by design. The user did not ask for THIS backup, so a failure must not
      // interrupt what they were doing; the status line keeps showing the older time, which is the
      // truth. Silent to us is a different matter: automatic backups that stop working look exactly
      // like automatic backups that work, right up until someone needs one.
      reportFailure('backup.snapshot', e, { stage: 'persist' });
    }
  }

  /** The key itself, for showing or for the QR code. Prompts. */
  async revealKey(promptTitle: string): Promise<string> {
    const passphrase = await this.deps.secret.reveal(promptTitle);
    if (!passphrase) {
      throw new BackupCancelledError();
    }
    return passphrase;
  }

  /**
   * What is out there and what this build can read - manifests only, no archives fetched - and which of
   * it retention is keeping back.
   */
  async list(): Promise<ListedBackup[]> {
    const [listed, held] = await Promise.all([
      listRestorable(this.deps.target),
      // Unreadable, no row claims to be held. Retention then deletes nothing (see `prune`), so the
      // list says less than is true rather than more.
      this.readHeld().catch(() => null),
    ]);
    return listed.map(item => ({ ...item, held: held?.has(item.manifest.archiveName) === true }));
  }

  /** Read the user's choices, falling back to the defaults for anything unset or unreadable. */
  async preferences(): Promise<BackupPreferences> {
    const [auto, keep, documents, mode] = await Promise.all([
      this.deps.settings.getSetting(AUTO_KEY),
      this.deps.settings.getSetting(KEEP_KEY),
      this.deps.settings.getSetting(DOCUMENTS_KEY),
      this.deps.settings.getSetting(DOCUMENT_MODE_KEY),
    ]);
    const parsed = Number(keep);
    return {
      // Only an explicit '0' turns it off: an absent or unreadable value means the default.
      automatic: auto !== '0',
      keep:
        Number.isFinite(parsed) && parsed >= 1
          ? Math.min(Math.trunc(parsed), MAX_KEEP)
          : BACKUP_DEFAULTS.keep,
      // The mirror image of `automatic`: only an explicit '1' turns Tier 2 ON. An unreadable value
      // must not start writing gigabytes.
      documents: documents === '1' && this.canHoldDocuments(),
      // Only an explicit 'all' downloads anything: an unreadable value backs up what is here.
      documentMode: mode === 'all' ? 'all' : 'downloaded',
    };
  }

  async setPreferences(next: Partial<BackupPreferences>): Promise<void> {
    if (next.automatic !== undefined) {
      await this.deps.settings.setSetting(AUTO_KEY, next.automatic ? '1' : '0');
      if (!next.automatic) {
        this.cancelPending();
      }
    }
    // The mode before the switch, so a dialog that sets both never leaves a moment where attachments
    // are on in a mode nobody chose.
    if (next.documentMode !== undefined) {
      await this.deps.settings.setSetting(DOCUMENT_MODE_KEY, next.documentMode);
      this.emit();
    }
    if (next.documents !== undefined) {
      if (next.documents && !this.canHoldDocuments()) {
        throw new Error('This backup destination cannot hold documents.');
      }
      await this.deps.settings.setSetting(DOCUMENTS_KEY, next.documents ? '1' : '0');
      this.emit();
    }
    if (next.keep !== undefined) {
      const keep = Math.min(Math.max(Math.trunc(next.keep), 1), MAX_KEEP);
      await this.deps.settings.setSetting(KEEP_KEY, String(keep));
      // Lowering the limit takes effect NOW rather than at the next backup: the user asked for less
      // space to be used, and making them wait for that is a strange way to answer.
      await this.prune(keep);
      this.emit();
    }
  }

  /** Delete one backup, on purpose. The one the user picked, not the oldest. */
  async deleteBackup(archiveName: string): Promise<void> {
    await this.deps.target.deleteBackup(archiveName);
    // Deleting a held backup is the person letting it go (see `restore`), so its hold goes with it.
    // After the delete, so a delete that failed leaves the backup still held.
    await this.releaseBackup(archiveName);
    this.emit();
  }

  /**
   * The backups retention sets aside, by archive name (see `restore`). Rejects when the setting cannot
   * be read, and resolves null, reported, when what is stored is not a list of names: which backups it
   * meant cannot be told then, and each caller decides what not knowing means for it.
   */
  private async readHeld(): Promise<Set<string> | null> {
    const raw = await this.deps.settings.getSetting(BACKUP_HELD_KEY);
    if (raw == null) {
      return new Set();
    }
    const names = parseNames(raw);
    if (names) {
      return new Set(names);
    }
    reportFailure('backup.snapshot', new Error('The held backups are not a list of names.'), {
      stage: 'parse',
    });
    return null;
  }

  /**
   * Set a backup aside from retention, and say whether this call is what set it aside. Rejects when it
   * cannot be kept, and then nothing has been restored: see `restore`.
   */
  private holdBackup(archiveName: string): Promise<boolean> {
    return this.inHeldTurn(async () => {
      // Over a value that is not a list of names, every backup now in the store is held: one too many
      // costs space the person can free by deleting it, and dropping the wrong one loses a document.
      const held =
        (await this.readHeld()) ??
        new Set((await this.deps.target.listManifests()).map(m => m.archiveName));
      if (held.has(archiveName)) {
        return false;
      }
      held.add(archiveName);
      await this.deps.settings.setSetting(BACKUP_HELD_KEY, JSON.stringify([...held]));
      return true;
    });
  }

  /**
   * Stop setting a backup aside. Never rejects: whatever this follows has already happened, and a hold
   * that could not be dropped keeps a backup longer than needed, which costs space and loses nothing.
   */
  private async releaseBackup(archiveName: string): Promise<void> {
    try {
      await this.inHeldTurn(async () => {
        const held = await this.readHeld();
        if (held?.delete(archiveName)) {
          await this.deps.settings.setSetting(BACKUP_HELD_KEY, JSON.stringify([...held]));
        }
      });
    } catch (e) {
      reportFailure('backup.snapshot', e, { stage: 'persist' });
    }
  }

  /**
   * Retention (FR-018), sparing every held backup. In the held turn from the read to the last delete,
   * so a backup a restore holds meanwhile is either held before the read or deleted before the restore
   * reads it, which then fails and holds nothing.
   */
  private prune(keep: number): Promise<void> {
    return this.inHeldTurn(async () => {
      let held: Set<string> | null;
      try {
        held = await this.readHeld();
      } catch (e) {
        reportFailure('backup.snapshot', e, { stage: 'persist' });
        held = null;
      }
      // Not knowing which backups are held, it deletes none. The older backups stay until the holds
      // can be read again, which costs space; deleting blind could take a held one, and a document
      // with it.
      if (held) {
        await pruneBackups(this.deps.target, keep, held);
      }
    });
  }

  /**
   * Whether retention still holds `archiveName`, read back rather than assumed: a delete on a later visit
   * lets a hold go while a restore from that backup is still running. Not knowing reads as held, since
   * unreadable holds keep every backup (`prune`). Never rejects.
   */
  private async stillHeld(archiveName: string): Promise<boolean> {
    const names = await this.readHeld().catch(() => null);
    return names?.has(archiveName) ?? true;
  }

  /** Run `work` once every earlier change to the held backups has ended (see `heldTurn`). */
  private inHeldTurn<T>(work: () => Promise<T>): Promise<T> {
    const done = this.heldTurn.then(work);
    // Settled, never rejected, so one failed change does not refuse every later one its turn.
    this.heldTurn = done.then(
      () => undefined,
      () => undefined,
    );
    return done;
  }

  /**
   * Restore one backup.
   *
   * The passphrase is passed in, because the common case is a NEW phone where nothing is stored yet
   * - typed from paper or scanned from the other phone's QR. When it opens, it is kept, so the
   * restored phone is immediately backing up under the same key instead of silently being off.
   *
   * A phone that ALREADY has a key keeps it. Two reasons, and the second is the important one: on
   * Android storing asks for the gate, so re-saving a key that is already there prompted the user a
   * second time for nothing (seen on the emulator); and overwriting a phone's own key would leave
   * every backup it had made unreadable from inside the app.
   *
   * How it ended is kept for a backup screen that did not see it end (see `takeRestoreOutcome`), and a
   * stopped restore keeps nothing: stopping was the person's own answer on the way out. `seen` says
   * whether the screen that started it is still the one in view to say it; asked when it ends, and when
   * it answers yes nothing is kept.
   */
  async restore(
    manifest: BackupManifest,
    passphrase: string,
    promptTitle: string,
    onProgress?: ProgressFn,
    seen?: () => boolean,
  ): Promise<RestoredBackup> {
    try {
      const restored = await this.restoreFromStore(manifest, passphrase, promptTitle, onProgress);
      this.restoreEnded({ ok: true, restored }, seen);
      return restored;
    } catch (error) {
      if (!(error instanceof BackupAbortedError)) {
        this.restoreEnded({ ok: false, error }, seen);
      }
      throw error;
    }
  }

  /**
   * A backup the restore could not bring every document back from is HELD: retention does not delete
   * it, and does not count it among the ones it keeps (constitution IV, 2026-09-15).
   *
   * It sits in this phone's own store and is the last place those documents can come back from. The
   * restore schedules an automatic backup, and so does every later change to the archive, and under the
   * default retention of one that backup replaced it. Not scheduling one after the restore only moved
   * the loss to the next sync.
   *
   * Held from before the first row is written, not from once the documents are counted. The documents
   * come after the rows and can take minutes, and an app closed part-way leaves the rows without their
   * documents, for the next sync's backup to replace the backup that has them. A hold that cannot be
   * stored refuses the restore before anything is written, so none goes ahead unprotected.
   *
   * The hold goes when a restore from that backup brings every document back, or when the person
   * deletes it. A restore that fails or is stopped before its rows are in wrote nothing, so a hold it
   * added goes too, while one an earlier restore left stays. Only backups with documents are held.
   */
  private async restoreFromStore(
    manifest: BackupManifest,
    passphrase: string,
    promptTitle: string,
    onProgress?: ProgressFn,
  ): Promise<RestoredBackup> {
    const documents = this.deps.documents;
    const name = manifest.archiveName;
    const holds = documents != null && manifest.tiers.documents === true;
    const added = holds ? await this.holdBackup(name) : false;
    let rowsIn = false;
    let report: FullRestoreReport;
    try {
      report = await this.track('restore', (progress, stop) =>
        restoreBackup(
          manifest,
          this.deps.target,
          passphrase,
          this.deps.sink,
          next => {
            // The documents are written after the rows are committed, so from here a stop could only
            // leave messages without their documents (FR-016, 2026-09-15), and the service no longer
            // passes one on. Letting go of the flag BEFORE the run is published shows it as one that
            // cannot be stopped from this very report, so the backup screen stops offering a stop.
            if (next.stage === 'documents') {
              rowsIn = true;
              this.stops.delete(stop);
            }
            progress(next);
            onProgress?.(next);
          },
          stop,
          documents
            ? {
                fs: documents.fs,
                details: documents.details,
                messageDir: documents.messageDir,
              }
            : undefined,
        ),
      );
    } catch (e) {
      if (added && !rowsIn) {
        await this.releaseBackup(name);
      }
      // Past the rows the hold stays, whether this restore added it or an earlier one did - unless the
      // backup was deleted meanwhile, which lets its hold go. Read back, as the result below reads it,
      // so a backup that is gone is not said to stay; unreadable holds keep every backup, so held.
      if (holds && rowsIn && (await this.stillHeld(name))) {
        throw new BackupRestoreHeldError(e);
      }
      throw e;
    }
    // ADOPT the backup's document key rather than keeping this phone's, and only when this phone has
    // none. Without it the restored device would name every document differently from the store it
    // just restored from, so its first backup would upload the whole archive a second time - beside
    // the copy already sitting there under names it can no longer produce.
    //
    // Resolves either way (2026-09-15): the archive is restored by now, and a password that could not
    // be kept - a declined screen lock - used to reject the whole restore, so the screen said it had
    // failed. The transfer (025) already told the two apart.
    const kept = await keepRestoredKeys(this.deps, passphrase, report.documentKey, promptTitle);
    // A document left with no message to belong to counts as not back too (2026-09-15, review): its
    // message went while the documents were written - its box removed, say - so it is not in this
    // archive and is still in the backup, and a restore from that backup brings both back.
    const notBack =
      (report.documents?.missing ?? 0) +
      (report.documents?.failed ?? 0) +
      (report.documents?.orphaned ?? 0);
    // Every document is back, so nothing is left that only this backup holds.
    if (holds && notBack === 0) {
      await this.releaseBackup(name);
    }
    // A restore changes the archive as a sync does, so it schedules an automatic backup the same way
    // (FR-017, 2026-09-15). Only from here, once the rows, the documents and the keys are all in: a
    // restore that failed or was stopped part-way never gets here, and the backup waits for quiet and
    // for any run still going, like every other. A restore that left a document behind schedules one
    // too, since 2026-09-15: the backup it came from is held, so this one no longer replaces it.
    this.archiveChanged();
    // Read back rather than assumed (2026-09-24): the backup can be deleted on a later visit while
    // this restore writes its documents, which lets its hold go, and the result then said the backup
    // "will not delete itself" about one that was gone. Unreadable holds keep every backup (`prune`),
    // so not knowing reads as held.
    const held = holds && notBack > 0 && (await this.stillHeld(name));
    return { ...report, keysFailed: !kept, held };
  }

  /**
   * Write into the archive from outside this controller, as a restore run: a phone-to-phone
   * transfer's save (025 review, 2026-09-15).
   *
   * The save went around the run tracking, so nothing stopped an automatic backup - scheduled by a
   * sync that settled a moment before - from starting while the transfer was restoring and keeping
   * its keys. Through here it waits for a backup that is already running, no automatic backup starts
   * beside it, and the backup screen shows it as the restore it is.
   *
   * Not cancellable: the transfer's save cannot stop part-way (025 FR-012), so no stop is offered.
   *
   * What it wrote is a change to the archive, and schedules an automatic backup once the run has ended
   * (FR-017, 2026-09-15). Until then a phone that kept the key arriving with a transfer showed backups
   * on and had no backup of what arrived until something else changed the archive. A write that failed
   * schedules nothing. One that could not bring every document back holds no backup, unlike the backup
   * screen's restore: what arrived is not in this phone's store, so no backup here holds those documents.
   */
  async runRestore<T>(work: (onProgress: ProgressFn) => Promise<T>): Promise<T> {
    const written = await this.track('restore', work, false);
    this.archiveChanged();
    return written;
  }

  /**
   * Stop backing up on this device: forget the key.
   *
   * Existing archives are LEFT ALONE. Deleting them here would make "turn it off" quietly mean
   * "destroy my only copy", and the archive is sacred (Principle IV) whether or not it is in this
   * phone. Removing a backup is its own, explicit action.
   */
  /**
   * Open a backup for real and say what is in it (T013).
   *
   * Goes through the OS gate for the passphrase, exactly as revealing it does: this decrypts the
   * user's archive, and the thing that guards that is the device's own lock, not the app's opinion.
   */
  async verify(
    manifest: BackupManifest,
    promptTitle: string,
    onProgress?: ProgressFn,
  ): Promise<VerifyReport> {
    const passphrase = await this.deps.secret.reveal(promptTitle);
    if (!passphrase) {
      throw new BackupCancelledError();
    }
    return this.track('verify', (progress, stop) =>
      verifyBackup(
        manifest,
        this.deps.target,
        passphrase,
        combine(onProgress, progress),
        stop,
      ),
    );
  }

  /**
   * Write one backup out as a single file the user chooses the home of (T014).
   *
   * No passphrase and no decryption: the archive leaves exactly as sealed, and the manifest rides
   * along so the file can answer "can this build read me?" on the way back in without anybody being
   * asked to unlock anything. Resolves false when the sheet was dismissed.
   */
  async exportBackup(manifest: BackupManifest): Promise<boolean> {
    const io = this.requireIo();
    const archive = await this.deps.target.getArchive(manifest.archiveName);
    return io.save(portableFileName(manifest), packPortable(manifest, archive));
  }

  /**
   * Take a file back in (T014).
   *
   * The imported backup joins the list beside the ones made on this phone and is restored by the
   * same path; nothing here is a second restore implementation. Resolves null when the user
   * cancelled, and throws `PortableFormatError` - which carries a sentence meant for a person - when
   * the file is not ours, is from a newer build, or is damaged.
   */
  async importBackup(): Promise<BackupManifest | null> {
    const io = this.requireIo();
    const bytes = await io.open();
    if (!bytes) {
      return null;
    }
    const { manifest, archive } = unpackPortable(bytes);
    await this.deps.target.putBackup(manifest, archive);
    return manifest;
  }

  /** Whether this build can move backups in and out at all (the seam is optional in tests). */
  canMoveBackups(): boolean {
    return this.deps.portableIo != null;
  }

  private requireIo(): PortableIo {
    const io = this.deps.portableIo;
    if (!io) {
      throw new Error('portableIo is not wired: export/import is unavailable in this build.');
    }
    return io;
  }

  disable(): Promise<void> {
    return this.deps.secret.clear();
  }

  /**
   * This device's document key, minted on first use.
   *
   * Read before it is created, and created only once, because the key IS the naming: a second key
   * would rename every object in the store, orphan everything already uploaded, and send the next
   * backup up the wire with the whole archive again.
   */
  private async documentKey(
    randomBytes: (n: number) => Uint8Array,
  ): Promise<Uint8Array> {
    const stored = await this.deps.settings.getSetting(DOCUMENT_KEY_KEY);
    if (stored) {
      try {
        return decodeDocumentKey(stored);
      } catch (e) {
        // A key that will not decode is not something to paper over by minting another one: that
        // would silently orphan every document already stored under the real one.
        reportFailure('backup.document', e, { stage: 'persist' });
        throw e;
      }
    }
    const key = randomBytes(32);
    await this.deps.settings.setSetting(DOCUMENT_KEY_KEY, encodeDocumentKey(key));
    return key;
  }

  /**
   * What turning Tier 2 on would cost, before it is turned on (006 T024).
   *
   * Reads the archive the same way a backup does and then measures the files, which is slower than
   * guessing from `attachmentSize` and is the only way to be right: `attachmentSize` is what ISDS
   * said the message weighed, not what is on this phone, and most messages have never had their
   * documents downloaded at all. An upper bound, since it cannot know what the store already holds.
   */
  async documentEstimate(): Promise<{
    count: number;
    plainBytes: number;
    sealedBytes: number;
    gone: number;
  }> {
    const documents = this.deps.documents;
    if (!documents) {
      return { count: 0, plainBytes: 0, sealedBytes: 0, gone: 0 };
    }
    const payload = await buildPayload(this.deps.source);
    return estimateDocuments(payload.messages, documents.source);
  }

  private async backupWith(
    passphrase: string,
    stop: CancelSignal,
    onProgress?: ProgressFn,
  ): Promise<BackupManifest> {
    const documents = this.deps.documents;
    const { documents: tierOn, documentMode } = await this.preferences();
    const manifest = await createBackup(
      this.deps.source,
      this.deps.target,
      passphrase,
      {
        appVersion: this.deps.appVersion,
        now: this.deps.now,
        kdf: this.deps.kdf,
        onProgress,
        signal: stop,
        documents:
          tierOn && documents
            ? {
                source: documents.source,
                key: await this.documentKey(documents.randomBytes),
                randomBytes: documents.randomBytes,
                mode: documentMode,
              }
            : undefined,
      },
    );
    // Prune AFTER the new one is written, never before: the window where the phone holds no backup
    // at all must not exist.
    const { keep } = await this.preferences();
    await this.prune(keep);
    return manifest;
  }
}

/** A stored list of archive names, or null when the value is not one. */
function parseNames(raw: string): string[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  return Array.isArray(parsed) && parsed.every(name => typeof name === 'string') ? parsed : null;
}

/** Feed both the caller's listener (if any) and the controller's own run state. */
function combine(a: ProgressFn | undefined, b: ProgressFn): ProgressFn {
  return progress => {
    a?.(progress);
    b(progress);
  };
}

/** Re-exported so screens can tell a cancellation from a failure without importing the service. */
export { BackupAbortedError };
