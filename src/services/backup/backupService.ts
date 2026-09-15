// The whole operation, end to end (006): archive -> snapshot -> sealed bytes -> somewhere, and back.
//
// The order of the restore path is the point of this file. Compatibility is decided from the
// MANIFEST - a few hundred bytes - before the archive is fetched, because the archive can be
// gigabytes and discovering it is unreadable after pulling all of it over a phone connection is a
// design failure rather than an inconvenience (FR-011).
//
// Where the bytes actually go is a `SyncTarget`, and nothing here knows whether that is a file, a
// Drive folder or an iCloud container. That seam is what let the crypto, the schema and the merge
// rules be finished and tested while the cloud half still needs entitlements this project does not
// yet have.

import { open, seal, type KdfParams } from './envelope';
import { objectNameFor } from './contentId';
import {
  backupDocuments,
  encodeDocumentKey,
  decodeDocumentKey,
  restoreDocuments,
  type DocumentDetails,
  type DocumentFs,
  type DocumentRestoreReport,
  type DocumentSource,
} from './documents';
import {
  progressReporter,
  throwIfCancelled,
  type CancelSignal,
  type ProgressFn,
} from './progress';
import { compatibilityOf, migratePayload, type Compatibility } from './migrate';
import { buildPayload, decodePayload, encodePayload, type BackupSource } from './snapshot';
import { restorePayload, type BackupSink, type RestoreReport } from './restore';
import { BACKUP_SCHEMA_VERSION, type BackupDocumentMode, type BackupManifest } from './schema';
import { FORMAT_VERSION } from './envelope';

/** Where backups live. One implementation per destination; none of them knows what is inside. */
export interface SyncTarget {
  /** Manifests only - small, and enough to decide what can be restored. */
  listManifests(): Promise<BackupManifest[]>;
  putBackup(manifest: BackupManifest, archive: Uint8Array): Promise<void>;
  /** Fetch the archive a manifest names. Called only AFTER compatibility is settled. */
  getArchive(archiveName: string): Promise<Uint8Array>;
  /** Remove one backup - its archive and its manifest. Idempotent: a missing one is not an error. */
  deleteBackup(archiveName: string): Promise<void>;

  // ── Tier 2 documents (006 T020-T022) ──────────────────────────────────────────────────────────
  //
  // Optional, because a target may hold metadata only and Tier 2 is the user's choice. Objects are
  // named by a KEYED hash of their content (`contentId.ts`), so the same document is stored once and
  // an interrupted run skips what is already there - without the store being able to recognise what
  // any of them are.

  /** Whether an object is already stored. The whole of resume and dedup rests on this (T021). */
  hasObject?(name: string): Promise<boolean>;
  /** Write an object, pulling it a chunk at a time so a large document never lands in memory whole. */
  putObject?(name: string, source: () => Promise<Uint8Array | null>): Promise<void>;
  /** Read an object back, a piece at a time. `byteCount` is a request, a short answer is the end. */
  getObject?(name: string): Promise<(byteCount: number) => Promise<Uint8Array | null>>;
}

/**
 * Turning Tier 2 on for one run.
 *
 * Present means documents are backed up; absent means the metadata tier alone. It is an OPTION
 * rather than a flag because the tier needs three things the service has no way to invent - where
 * the files are, which key names them, and a CSPRNG - and passing them together makes it impossible
 * to switch the tier on without supplying all three.
 */
export interface DocumentTier {
  /** Reading this device's attachment files. */
  source: DocumentSource;
  /** 32 bytes. Kept by the app and carried inside the payload, so a restored phone keeps using it. */
  key: Uint8Array;
  randomBytes(n: number): Uint8Array;
  /** Recorded in the manifest (026 US2). Absent = `downloaded`. */
  mode?: BackupDocumentMode;
}

export interface CreateBackupOptions {
  appVersion: string;
  now?: () => number;
  /** Overridable so tests are not slowed by a memory-hard KDF; production uses the defaults. */
  kdf?: KdfParams;
  /** Where the work has got to. Optional: nothing here depends on anyone watching. */
  onProgress?: ProgressFn;
  /** Lets the user stop. Checked between steps - see `throwIfCancelled`. */
  signal?: CancelSignal;
  /** Tier 2. Absent = metadata only, which is the default and what FR-008 makes the UI say. */
  documents?: DocumentTier;
}

/** Build, seal and store one backup. Returns the manifest that describes it. */
export async function createBackup(
  source: BackupSource,
  target: SyncTarget,
  passphrase: string,
  options: CreateBackupOptions,
): Promise<BackupManifest> {
  const now = options.now ? options.now() : Date.now();
  const tier = options.documents;
  const report = progressReporter(
    options.onProgress,
    tier ? 'backupWithDocuments' : 'backup',
  );
  const payload = await buildPayload(
    source,
    (done, total, detail) => report('reading', done, total, detail),
    options.signal,
  );

  // Tier 2 runs BEFORE the payload is sealed, because its result - which object holds which
  // attachment - is part of the payload. An index written after the archive would describe a
  // backup that does not contain it.
  let documentCount = 0;
  let documentBytes = 0;
  let documentObjects: string[] = [];
  if (tier) {
    const stored = await backupDocuments(
      payload.messages,
      tier.source,
      target,
      tier.key,
      {
        randomBytes: tier.randomBytes,
        onProgress: (done, total, detail) => report('documents', done, total, detail),
        signal: options.signal,
      },
    );
    payload.documents = stored.documents;
    payload.documentKey = encodeDocumentKey(tier.key);
    documentCount = stored.documents.length;
    documentBytes = stored.sealedBytes;
    documentObjects = [...new Set(stored.documents.map(d => objectNameFor(d.contentId)))].sort();
  }
  // The KDF reports its own fraction - it is the longest step by a wide margin, and it is the one
  // step whose duration nothing else can predict, so guessing at it would be the bar's biggest lie.
  const plaintext = await encodePayload(payload);
  throwIfCancelled(options.signal);
  const archive = await seal(
    plaintext,
    passphrase,
    options.kdf,
    fraction => {
      // The KDF is the longest step, so this is where a cancel most often lands. Throwing from the
      // tick callback stops it mid-derivation instead of making the user watch it finish.
      throwIfCancelled(options.signal);
      report('sealing', fraction, 1);
    },
  );
  throwIfCancelled(options.signal);
  report('writing', 0, 1);
  const manifest: BackupManifest = {
    formatVersion: FORMAT_VERSION,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion: options.appVersion,
    createdAt: now,
    // Read by the UI rather than assumed, because "backed up" means two different things once Tier 2
    // exists and the screen is where that stops being ambiguous (FR-008).
    tiers: { metadata: true, documents: tier != null },
    sizeBytes: archive.length,
    archiveName: `obalka-${now}.backup`,
    documentCount,
    documentBytes,
  };
  if (tier) {
    const mode = tier.mode ?? 'downloaded';
    manifest.documentMode = mode;
    manifest.documentObjects = documentObjects;
    if (mode === 'all') {
      // Every data message has at least one document, so a message without its detail here is a
      // message whose attachments this backup does not hold.
      manifest.documentsMissing = payload.messages.filter(m => !m.detailJson).length;
    }
  }
  await target.putBackup(manifest, archive);
  report('writing', 1, 1);
  return manifest;
}

/**
 * Keep the newest `keep` backups and delete the rest. Returns how many went.
 *
 * Retention exists because an archive is not small and a phone is not big: a backup per refresh,
 * kept forever, is a slow way to fill someone's storage with copies of the same messages. The
 * DEFAULT is one - the newest - and anything more is a choice the user makes deliberately.
 *
 * Deletes oldest-first and only after the new backup is safely written, so the moment where the
 * phone holds nothing at all never exists.
 *
 * `spare` names backups set aside before counting (2026-09-15): each is the last place a document
 * this archive does not have can come back from, so none of them is deleted and none of them takes
 * one of the `keep` places. Counting them would let a held backup push the newest one out instead.
 */
export async function pruneBackups(
  target: SyncTarget,
  keep: number,
  spare: ReadonlySet<string> = new Set(),
): Promise<number> {
  const manifests = (await target.listManifests())
    .filter(manifest => !spare.has(manifest.archiveName))
    .sort((a, b) => b.createdAt - a.createdAt);
  const doomed = manifests.slice(Math.max(1, keep));
  for (const manifest of doomed) {
    await target.deleteBackup(manifest.archiveName);
  }
  return doomed.length;
}

export interface RestorableBackup {
  manifest: BackupManifest;
  compatibility: Compatibility;
  /** False when this build cannot read it - the UI shows it, greyed, with the reason. */
  restorable: boolean;
}

/**
 * What is out there, and which of it this app can actually read.
 *
 * Unreadable backups are LISTED rather than hidden. A backup made by a newer app is exactly the one
 * a user is looking for after replacing a phone, and silently omitting it would look like the backup
 * was lost - when the answer is simply "update the app".
 */
export async function listRestorable(
  target: SyncTarget,
): Promise<RestorableBackup[]> {
  const manifests = await target.listManifests();
  return manifests
    .map(manifest => {
      const compatibility = compatibilityOf(manifest);
      return {
        manifest,
        compatibility,
        restorable:
          compatibility.kind === 'current' || compatibility.kind === 'migratable',
      };
    })
    .sort((a, b) => b.manifest.createdAt - a.manifest.createdAt);
}

export class BackupNotRestorableError extends Error {
  constructor(readonly compatibility: Compatibility, message: string) {
    super(message);
  }
}

/**
 * Putting the documents back, if this app is asked to.
 *
 * The KEY is not in here: it comes out of the restored payload, because the objects were named under
 * the key of whichever device made the backup and nothing on this one can reconstruct it.
 */
export interface DocumentRestore {
  fs: DocumentFs;
  details: DocumentDetails;
  /** Where this device keeps a message's attachment files. */
  messageDir(boxId: string, messageId: string): string;
}

/** What a restore did, including Tier 2 when the backup carried it. */
export interface FullRestoreReport extends RestoreReport {
  documents?: DocumentRestoreReport;
  /**
   * The document key the backup carried, hex, or null.
   *
   * Handed back so the caller can keep it: without it the next backup on this phone would mint a new
   * one, name every document differently, and upload the whole archive again beside the copy that is
   * already there.
   */
  documentKey?: string | null;
}

/**
 * Restore one backup.
 *
 * Refuses BEFORE downloading when the manifest already says it cannot work - that check is the whole
 * reason the manifest is a separate object.
 */
export async function restoreBackup(
  manifest: BackupManifest,
  target: SyncTarget,
  passphrase: string,
  sink: BackupSink,
  onProgress?: ProgressFn,
  signal?: CancelSignal,
  documents?: DocumentRestore,
): Promise<FullRestoreReport> {
  const compatibility = compatibilityOf(manifest);
  if (compatibility.kind === 'tooNew') {
    throw new BackupNotRestorableError(
      compatibility,
      `This backup was made by a newer version of the app (${compatibility.what} version ${compatibility.theirs}; this app reads ${compatibility.ours}). Update the app and try again.`,
    );
  }
  if (compatibility.kind === 'unsupported') {
    throw new BackupNotRestorableError(compatibility, compatibility.reason);
  }
  // Whether Tier 2 will run is known from the manifest, before a byte is fetched - which is what
  // lets the bar be weighted for the run that is actually about to happen.
  const withDocuments = documents != null && manifest.tiers.documents === true;
  const report = progressReporter(
    onProgress,
    withDocuments ? 'restoreWithDocuments' : 'restore',
  );
  report('fetching', 0, 1);
  const archive = await target.getArchive(manifest.archiveName);
  report('fetching', 1, 1);
  const plaintext = await open(archive, passphrase, fraction => {
    throwIfCancelled(signal);
    report('opening', fraction, 1);
  });
  const payload = migratePayload(decodePayload(plaintext));
  // A cancel during the write phase aborts the transaction, so the archive is left exactly as it was
  // - which is the whole reason the restore runs in one.
  const written = await restorePayload(
    payload,
    sink,
    (done, total, detail) => report('restoring', done, total, detail),
    signal,
  );
  if (!documents || !payload.documentKey || payload.documents.length === 0) {
    return { ...written, documentKey: payload.documentKey ?? null };
  }
  // AFTER the metadata transaction, never inside it. The documents are files on disk, which no
  // database transaction can roll back - so they are written once the rows they belong to are
  // safely committed, and a per-file failure costs one document rather than the restore (T022).
  //
  // And to the end once begun (2026-09-15). A stop that reached this point could no longer leave the
  // archive as it was, only leave the rows just committed without their documents, so it is not passed
  // on. The first report says the point has passed before any document is written, which is what a
  // caller offering a stop needs in order to stop offering it.
  report('documents', 0, payload.documents.length);
  const restored = await restoreDocuments(
    payload.documents,
    target,
    documents.fs,
    documents.details,
    documents.messageDir,
    decodeDocumentKey(payload.documentKey),
    {
      onProgress: (done, total, detail) => report('documents', done, total, detail),
    },
  );
  return { ...written, documents: restored, documentKey: payload.documentKey };
}

/** What a verified backup turned out to contain. Counts, never content. */
export interface VerifyReport {
  createdAt: number;
  accounts: number;
  messages: number;
  drafts: number;
  reminders: number;
}

/**
 * Open a backup for real and report what is inside it (006 T013).
 *
 * The failure this whole feature exists to survive is a backup that LOOKED fine for two years. A
 * check that the file is present and the right size cannot see a truncated archive, a wrong
 * passphrase, a payload this build can no longer migrate, or bytes that rotted on a memory card.
 * Only decrypting can, so this decrypts: the same `open` + `decodePayload` + `migratePayload` path a
 * restore takes, stopping one step short of writing anything.
 *
 * It returns COUNTS rather than a bare true. "Verified" tells the user nothing they can check; "3
 * boxes, 412 messages" is a sentence they can compare against the phone in their hand, which is what
 * actually tells them the backup is the one they think it is.
 */
export async function verifyBackup(
  manifest: BackupManifest,
  target: SyncTarget,
  passphrase: string,
  onProgress?: ProgressFn,
  signal?: CancelSignal,
): Promise<VerifyReport> {
  const compatibility = compatibilityOf(manifest);
  if (compatibility.kind === 'tooNew') {
    throw new BackupNotRestorableError(
      compatibility,
      `This backup was made by a newer version of the app (${compatibility.what} version ${compatibility.theirs}; this app reads ${compatibility.ours}). Update the app and try again.`,
    );
  }
  if (compatibility.kind === 'unsupported') {
    throw new BackupNotRestorableError(compatibility, compatibility.reason);
  }
  const report = progressReporter(onProgress, 'restore');
  report('fetching', 0, 1);
  const archive = await target.getArchive(manifest.archiveName);
  report('fetching', 1, 1);
  const plaintext = await open(archive, passphrase, fraction => {
    throwIfCancelled(signal);
    report('opening', fraction, 1);
  });
  const payload = migratePayload(decodePayload(plaintext));
  return {
    createdAt: manifest.createdAt,
    accounts: payload.accounts.length,
    messages: payload.messages.length,
    drafts: payload.drafts.length,
    reminders: payload.reminders.length,
  };
}
