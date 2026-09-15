// Moving an archive from one phone to another (025 T012/T013).
//
// The ordering here is the feature. Nothing else in this file is hard, and getting the order wrong
// is how an archive gets destroyed:
//
//   1. The receiving phone fetches the bundle and reads the MANIFEST before anything else, so an
//      incompatible backup is refused while it is still bytes in a temporary directory (FR-002).
//   2. It then reports what it is holding and STOPS. Nothing reaches the archive until the user has
//      seen a count and said yes (FR-004).
//   3. Applying goes through `restoreBackup` - the same path an import takes, full stop (FR-003).
//      A transport that wrote rows itself would be re-deciding the merge rules in the one place
//      where getting them wrong loses somebody's mail.
//
// The recovery key travels beside the archive rather than being typed at the end, which is the whole
// promise of the feature - see `specs/025-phone-to-phone-transfer/research.md` §4 for why a
// PAKE channel is the right place for it and `codePhrase.ts` for what that costs.

import {
  restoreBackup,
  type DocumentRestore,
  type FullRestoreReport,
  type SyncTarget,
} from '../../../services/backup/backupService';
import { compatibilityOf, type Compatibility } from '../../../services/backup/migrate';
import { packPortable, unpackPortable } from '../../../services/backup/portable';
import { parseRecoveryKey } from '../../../services/backup/recoveryKey';
import type { BackupManifest } from '../../../services/backup/schema';
import type { ChunkSource } from '../../../services/backup/fileSeal';
import { chunksOnRequest } from '../../../services/files/sliceSource';
import type { BackupSink } from '../../../services/backup/restore';
import type { BackupSource } from '../../../services/backup/snapshot';
import type { ProgressFn } from '../../../services/backup/progress';
import {
  keepRestoredKeys,
  type ArchiveRuns,
  type RestoredKeyStores,
} from '../../backup/state/backupController';
import type { MessageFolder } from '../../../services/db/messagesStore';
import { decodeUtf8, encodeUtf8 } from '../../../services/text/textCodec';
import { generateCodePhrase } from '../../../services/transfer/codePhrase';
import {
  TRANSFER_BACKUP_FILE,
  TRANSFER_KEY_FILE,
  TransferBackupGoneError,
  TransferBusyError,
  TransferCancelledError,
  TransferFailedError,
  TransferRunningError,
  TransferUnavailableError,
  type Transport,
  type TransferProgressFn,
} from '../../../services/transfer/transport';

/** The sliver of a filesystem a transfer needs. Satisfied by `BackupFs`. */
export interface TransferFs {
  ensureDir(path: string): Promise<void>;
  list(path: string): Promise<string[]>;
  /** For the bundle and the key, which are small by construction. Never for a document. */
  readBytes(path: string): Promise<Uint8Array>;
  /** A document, a slice at a time - see `BackupFs.open`. */
  open(path: string): Promise<ChunkSource>;
  writeBytes(path: string, bytes: Uint8Array): Promise<void>;
  appendBytes(path: string, bytes: Uint8Array): Promise<void>;
  remove(path: string): Promise<void>;
}

/**
 * The prefix every Tier 2 document object carries (`contentId.ts`'s `objectNameFor`).
 *
 * Matched rather than imported so this file does not reach into the naming scheme it is only
 * carrying - but the two must agree, and `__tests__/transfer/` holds them against each other.
 */
const DOCUMENT_PREFIX = 'doc-';

export interface TransferControllerDeps {
  transport: Transport;
  fs: TransferFs;
  /** A scratch directory. Everything a transfer stages lives here and is swept afterwards. */
  workDir: string;
  target: SyncTarget;
  sink: BackupSink;
  /** The recovery key this phone holds, so the far side does not have to be told it by hand. */
  recoveryKey(): Promise<string | null>;
  /** Where the backup store keeps its objects, so Tier 2 documents can travel too (T014). */
  backupDir?: string;
  /**
   * Where the documents that travelled are written back on THIS phone - the same wiring the backup
   * screen's restore uses.
   *
   * Added 2026-09-14 (004 amendment). Until then `apply` restored without it: the objects crossed,
   * were counted, and were swept, and the details kept pointing at the old phone's paths - the
   * attachments and signed originals the transfer had just carried never reached this archive.
   * Optional only so a test can leave Tier 2 out.
   */
  documents?: DocumentRestore;
  /**
   * Where the keys that arrived are kept once applied: the Keychain and the settings table, the same
   * two the backup screen's restore writes (006, `adoptRestoredKeys`).
   *
   * Added 2026-09-15. Until then the receiving phone restored the archive and kept neither key, so
   * its backups stayed off, and turning them on minted a new document key - the first backup then
   * uploaded every document again under names the store did not have. Optional only so a test can
   * leave it out.
   */
  keys?: RestoredKeyStores;
  /**
   * The backup controller's run tracking, which a save goes through as one restore run (025 review,
   * 2026-09-15) - the way the backup screen's own restore does.
   *
   * Without it, on a phone with automatic backups on, a backup scheduled by a sync a moment earlier
   * could start while the save was writing the archive and keeping the keys, and read the archive
   * half written. Optional only so a test can leave it out.
   */
  runs?: ArchiveRuns;
  onlyLocal?: boolean;
  /**
   * This phone's archive, read only to COUNT boxes and messages before a send (US1 scenario 1).
   *
   * From the archive rather than the manifest because 006 FR-011 keeps counts out of the manifest:
   * it travels in the clear, and how much government mail somebody holds is something it must not
   * say. Optional so a wiring without it still sends and states the size.
   */
  source?: Pick<BackupSource, 'listAccounts' | 'listEnvelopes'>;
}

/**
 * What a send carries, counted, so it can be checked against what the other phone reports (US1).
 *
 * Boxes and messages are counted the way a backup enumerates them (`buildPayload`: every box, the
 * received and the sent folder). Documents come from the manifest, because that count is of what the
 * backup INDEXES - the documents the receiving phone will be able to restore - and it is there
 * without decrypting anything.
 *
 * The limit, stated rather than hidden: boxes and messages are the archive as it is NOW, so they are
 * given only when the backup chosen is the newest one (026), made from that archive when it last
 * settled - null for an older backup, whose counts only decrypting it could give, which T014 already
 * weighed and turned down before the phrase is shown.
 */
export interface TransferContents {
  boxes: number | null;
  messages: number | null;
  /** Null when the manifest cannot say: a Tier 2 backup written before the count existed. */
  documents: number | null;
}

/** The folders a backup reads per box - `buildPayload`'s list, held against it by a test. */
const COUNTED_FOLDERS: readonly MessageFolder[] = ['received', 'sent'];

/** What the sending phone shows while it waits. */
export interface TransferOffer {
  /** Read aloud or copied across the table. `7K2M-ryba-kotva-duha-lampa`. */
  phrase: string;
  /** What is about to move, so the size is on screen before it does (FR-008). */
  sizeBytes: number;
  /** What is about to move, counted. Null when the archive could not be read to count it. */
  contents: TransferContents | null;
  /** Resolves when the far side has taken it, rejects if it failed. */
  done: Promise<void>;
}

/** What the receiving phone holds after fetching and before writing anything. */
export interface ReceivedTransfer {
  manifest: BackupManifest;
  compatibility: Compatibility;
  /** False when this build cannot read it - shown with the reason rather than hidden (FR-002). */
  restorable: boolean;
  /** The recovery key that came with it, or null when the sender did not have one. */
  recoveryKey: string | null;
  /** Staged, not applied. Held so `apply` needs no second fetch. */
  archive: Uint8Array;
  /** How many Tier 2 documents came with it. */
  documents: number;
  /**
   * Where the documents are staged.
   *
   * They stay on DISK rather than in memory - an archive's documents are the one part of a transfer
   * that can be gigabytes, which is the whole reason Tier 2 is content-addressed in the first place.
   * The caller owns this directory until `apply` or `dispose`.
   */
  dir: string;
}

/** What `apply` needs besides what arrived and the key that opens it. */
export interface ApplyOptions {
  /** What the OS prompt says if storing the recovery key asks for the screen lock, as Android does. */
  promptTitle: string;
  onProgress?: ProgressFn;
}

/** What applying did: the restore's own report, and whether the keys that came with it were kept. */
export interface AppliedTransfer extends FullRestoreReport {
  /**
   * True when keeping the recovery key or the document key failed - a declined screen-lock prompt,
   * most likely. The archive is written either way; this decides only whether the screen says so.
   */
  keysFailed: boolean;
}

/**
 * How a save ended, for a screen that was only SHOWING it: one opened again while a save started
 * from an earlier visit was still running (025 review, 2026-09-15).
 */
export type ApplyOutcome =
  | { readonly ok: true; readonly applied: AppliedTransfer }
  | { readonly ok: false; readonly error: unknown };

/** What a screen needs to say how a save ended that it did not see end (025 review, 2026-09-15). */
export type TransferOutcomes = Pick<TransferController, 'takeOutcome' | 'subscribeOutcome'>;

export class TransferController {
  constructor(private readonly deps: TransferControllerDeps) {}

  /**
   * The received transfer being written into the archive right now, or null (025 review, 2026-09-15).
   *
   * A save reads documents out of the receive directory until the last one is written, which can take
   * minutes. The screen used to let its cancel row return to idle meanwhile, and a receive started
   * then swept the very directory the save was reading from - while the save's own sweep at the end
   * would have taken the new transfer's files. So everything that starts a run or sweeps staging asks
   * this first, and the save itself cannot be cancelled (see `apply`).
   */
  private applying: { dir: string; done: Promise<ApplyOutcome> } | null = null;

  /**
   * The staging directories a run of THIS process is still using (025 review, 2026-09-15).
   *
   * Every offer and every receive stages into a directory of its own, and only the run that owns one
   * sweeps it. They used to share `out/` and `in/`. The native module runs one transfer at a time, so
   * a stopped run lets go - and its cleanup runs - at the very moment the transfer started after it
   * begins, and that cleanup swept the new transfer's directory: the bundle it had staged, or the
   * directory it was receiving into. Sweeping leftovers skips every directory named here.
   */
  private readonly inUse = new Set<string>();
  private runCount = 0;

  /**
   * The offer or receive running now, or null (audit 2026-09-23).
   *
   * An offer is live from the call until the far side has taken it (`done` settles), a receive until
   * it returns - and either stops being live the moment it is stopped: its signal is cancelled, or
   * `abandon` is called. That last part matters, because a stopped offer's `done` may never settle
   * (nobody ever connects), and a guard that waited for it would refuse every later transfer.
   */
  private live: { readonly signal?: { readonly cancelled: boolean } } | null = null;

  /**
   * How the last save ended, until a screen has said so (025 review, 2026-09-15).
   *
   * The screen that starts a save says how it ended - while it is open. Left during the save, it
   * could not, and nothing else did: a save that finished with no transfer screen open was reported
   * nowhere. Now whichever screen is in view first hands it to the user - the backup screen under the
   * transfer, or the transfer screen opened again - and taking it is what stops a second one saying it.
   */
  private unseen: ApplyOutcome | null = null;
  private readonly outcomeListeners = new Set<() => void>();

  /** Whether a received transfer is still being written into the archive. */
  isApplying(): boolean {
    return this.applying !== null;
  }

  /** How the last save ended, handed out once: null once a screen has taken it, or before any save. */
  takeOutcome(): ApplyOutcome | null {
    const outcome = this.unseen;
    this.unseen = null;
    return outcome;
  }

  /** Hear when a save ends. The listener takes the outcome itself, if it is the screen to say it. */
  subscribeOutcome = (listener: () => void): (() => void) => {
    this.outcomeListeners.add(listener);
    return () => {
      this.outcomeListeners.delete(listener);
    };
  };

  private ended(outcome: ApplyOutcome): ApplyOutcome {
    this.unseen = outcome;
    for (const listener of [...this.outcomeListeners]) {
      try {
        listener();
      } catch {
        // A screen that cannot take the outcome leaves it for the next one; the save has ended either way.
      }
    }
    return outcome;
  }

  /**
   * Resolves once nothing is being written into the archive, with how the last save ended - or with
   * null at once when nothing was being saved.
   */
  async whenApplied(): Promise<ApplyOutcome | null> {
    let outcome: ApplyOutcome | null = null;
    while (this.applying) {
      outcome = await this.applying.done;
    }
    return outcome;
  }

  private refuseWhileApplying(): void {
    if (this.applying) {
      throw new TransferBusyError();
    }
  }

  /**
   * Refuse a run while another is live, or claim the controller for this one (audit 2026-09-23).
   * Synchronous, before the caller's first await, so a second call in the same tick - a double tap,
   * two camera frames - is refused rather than started. Returns what ends the claim; ending it twice,
   * or after a newer run has claimed, leaves the newer claim alone.
   */
  private claimRun(signal?: { readonly cancelled: boolean }): () => void {
    if (this.live && this.live.signal?.cancelled !== true) {
      throw new TransferRunningError();
    }
    const run = { signal };
    this.live = run;
    return () => {
      if (this.live === run) {
        this.live = null;
      }
    };
  }

  /**
   * Keep the display on while a transfer is live (FR-014). Never throws: a display that times out is a
   * stopped transfer the screen explains, not a reason for the screen to break.
   */
  keepScreenOn(on: boolean): void {
    try {
      this.deps.transport.keepScreenOn(on);
    } catch {
      // A transport that cannot be reached has no display to keep on.
    }
  }

  /** Whether this build can transfer at all. The screen hides the feature when it cannot. */
  available(): boolean {
    try {
      return this.deps.transport.available();
    } catch {
      // A native module that throws while being asked whether it exists is a missing native module.
      return false;
    }
  }

  private requireTransport(): Transport {
    if (!this.available()) {
      throw new TransferUnavailableError();
    }
    return this.deps.transport;
  }

  /**
   * Offer one of this phone's backups - the one the person chose (026 US3) - to another phone. Nothing
   * is backed up here: the backup exists, and it goes as it is.
   *
   * The phrase is minted here and the size is known before a byte moves, because both belong on
   * screen BEFORE the user commits to anything (FR-008).
   */
  offer(
    manifest: BackupManifest,
    onProgress?: TransferProgressFn,
    signal?: { readonly cancelled: boolean },
  ): Promise<TransferOffer> {
    let transport: Transport;
    let endRun: () => void;
    try {
      transport = this.requireTransport();
      // One thing at a time: nothing is sent while a received transfer is still being saved, nor
      // while another offer or receive is running.
      this.refuseWhileApplying();
      endRun = this.claimRun(signal);
    } catch (e) {
      return Promise.reject(e);
    }
    const staged = this.offerClaimed(transport, manifest, endRun, onProgress, signal);
    // Staging that fails ends the run here; a staged offer ends it when `done` settles. The caller
    // gets `staged` itself - not a promise chained after it - so it is handed the offer in the same
    // turn the offer is ready, as before the claim existed.
    staged.catch(() => endRun());
    return staged;
  }

  /** `offer`, once it holds the claim. `endRun` is called when the far side has taken it. */
  private async offerClaimed(
    transport: Transport,
    manifest: BackupManifest,
    endRun: () => void,
    onProgress?: TransferProgressFn,
    signal?: { readonly cancelled: boolean },
  ): Promise<TransferOffer> {
    // Preparing is not instant - the walk measured 25 seconds for an archive with 9 documents - and
    // during it the screen used to say "waiting for the other phone", which was false: the other
    // phone had nothing to wait FOR, because the phrase did not exist yet.
    onProgress?.({ stage: 'preparing', sent: 0, total: 0, relayed: null });
    const { manifest: sending, archive } = await this.chosenToSend(manifest);
    // Counted while nothing is staged. It is a read of the archive's envelope lists, and a count that
    // fails costs the count, never the send.
    const contents = await this.contentsOf(sending);
    const bundle = packPortable(sending, archive);

    const outbox = `${this.deps.workDir}/out`;
    const dir = this.claimRunDir(outbox);
    let documentBytes = 0;
    try {
      await this.deps.fs.ensureDir(this.deps.workDir);
      await this.deps.fs.ensureDir(outbox);
      await this.deps.fs.ensureDir(dir);
      // Sweep BEFORE staging, not only after sending. The cleanup on `done` runs when the send settles
      // - and a send that nobody ever takes up does not settle: the walk left 7 MB of sealed archive
      // in the cache from a transfer abandoned an hour earlier. Clearing on the way IN is what makes
      // that bounded no matter how the previous attempt ended. Only what no run is still using.
      await this.sweepUnused(outbox);
      await this.deps.fs.writeBytes(`${dir}/${TRANSFER_BACKUP_FILE}`, bundle);

      // The key rides along, which is the difference between this feature and the file export. It is
      // written beside the archive rather than inside it so neither format has to learn about the
      // other, and so a bundle that leaks is still just a sealed archive.
      const key = await this.deps.recoveryKey();
      if (key) {
        await this.deps.fs.writeBytes(`${dir}/${TRANSFER_KEY_FILE}`, encodeUtf8(key));
      }

      // Tier 2, if this backup has it (T014): only the objects its manifest lists (026 FR-007). A backup
      // without documents sends none, and an older backup does not drag along every document the store
      // gained since - which is what sending every object did, and why the send looked like a backup
      // being made again. Listed in the manifest so no Argon2id derivation or decrypt is needed to know
      // them before the phrase is shown.
      documentBytes = await this.copyDocuments(
        dir,
        sending.tiers.documents ? sending.documentObjects ?? [] : [],
        (done, total) => onProgress?.({ stage: 'preparing', sent: done, total, relayed: null }),
        signal,
      );
      // Stopped while staging - the cancel button, or the app leaving the foreground (FR-014). The
      // transport is never reached: croc started with a flag that is already set still opens a relay
      // connection for as long as it takes to notice, and that time would be spent in the background.
      throwIfStopped(signal);
    } catch (e) {
      // Stopped, or staging failed part-way (a document gone, a full disk). Either way what was staged
      // - the recovery key among it - goes now, not whenever the next transfer happens.
      await this.releaseRunDir(dir);
      throw e;
    }

    const phrase = generateCodePhrase();
    const done = transport
      .send(dir, {
        secret: phrase,
        onlyLocal: this.deps.onlyLocal === true,
        onProgress,
        signal,
      })
      .finally(() => {
        endRun();
        return this.releaseRunDir(dir);
      });

    // What actually MOVES, not what the bundle weighs. The walk found this saying "15 kB" while
    // 6.9 MB of documents went across behind it - a number 469 times too small is worse than no
    // number at all, and FR-008 exists to stop exactly that.
    return { phrase, sizeBytes: bundle.length + documentBytes, contents, done };
  }

  /**
   * Fetch a transfer and say what is in it. WRITES NOTHING to the archive.
   *
   * Compatibility is judged from the manifest here, while the bundle is still a file in a scratch
   * directory - the same rule the cloud path follows for the same reason, except that here the
   * bytes have already arrived, so the point is not to save a download but to refuse BEFORE the
   * merge rather than during it.
   */
  async receive(
    phrase: string,
    onProgress?: TransferProgressFn,
    signal?: { readonly cancelled: boolean },
  ): Promise<ReceivedTransfer> {
    const transport = this.requireTransport();
    // BEFORE anything is swept: a save still in progress reads what an earlier receive staged, and a
    // run still going is staging or receiving right now.
    this.refuseWhileApplying();
    const endRun = this.claimRun(signal);
    const inbox = `${this.deps.workDir}/in`;
    const dir = this.claimRunDir(inbox);

    try {
      await this.deps.fs.ensureDir(this.deps.workDir);
      await this.deps.fs.ensureDir(inbox);
      await this.deps.fs.ensureDir(dir);
      // What earlier receives left and nobody holds any more - one whose question was never answered
      // because the screen was left, say - goes on the way in, as it always did.
      await this.sweepUnused(inbox);
      throwIfStopped(signal);
      await transport.receive(dir, {
        secret: phrase,
        onlyLocal: this.deps.onlyLocal === true,
        onProgress,
        signal,
      });
      // Stopped while it ran, and it finished anyway in the moment before the native side noticed.
      // What arrived is let go of rather than handed back: the user has been told the transfer
      // stopped, and a recovery key left in the cache for a transfer nobody is finishing is exactly
      // what T005 swept away. The catch below does the sweeping.
      throwIfStopped(signal);

      const names = await this.deps.fs.list(dir);
      if (!names.includes(TRANSFER_BACKUP_FILE)) {
        // The far side sent something, and it was not one of ours. Said as what it is rather than
        // as a decrypt failure, which is what the user would otherwise chase.
        throw new TransferFailedError(
          'The other phone did not send a backup.',
        );
      }
      const bundle = await this.deps.fs.readBytes(`${dir}/${TRANSFER_BACKUP_FILE}`);
      // Throws `PortableFormatError` with a sentence meant for a person when it is not ours, is from
      // a newer build, or is damaged. Left to propagate: it already says the right thing.
      const { manifest, archive } = unpackPortable(bundle);

      const compatibility = compatibilityOf(manifest);
      const recoveryKey = names.includes(TRANSFER_KEY_FILE)
        ? parseRecoveryKey(
            decodeUtf8(await this.deps.fs.readBytes(`${dir}/${TRANSFER_KEY_FILE}`)),
          )
        : null;

      return {
        manifest,
        compatibility,
        restorable:
          compatibility.kind === 'current' || compatibility.kind === 'migratable',
        recoveryKey,
        archive,
        documents: names.filter(n => n.startsWith(DOCUMENT_PREFIX)).length,
        dir,
      };
    } catch (e) {
      // Only swept on the way OUT. A successful receive leaves the documents where they are,
      // because `apply` still has to read them and they are too large to hold in memory.
      await this.sweep(dir);
      throw e;
    } finally {
      // Swept, or handed to the caller, who owns it until `apply` or `dispose`: no longer this run's.
      this.inUse.delete(dir);
      endRun();
    }
  }

  /** Let go of a received transfer the user decided not to keep. */
  async dispose(received: ReceivedTransfer): Promise<void> {
    // Not while a save is reading that directory. The save sweeps it itself once it is done.
    if (this.applying?.dir === received.dir) {
      return;
    }
    await this.sweep(received.dir);
  }

  /**
   * Let go of a run the user walked away from - an offer or a receive, by the cancel button or by
   * leaving the app (FR-014).
   *
   * Cancelling is cooperative, so the Go side may take a moment to notice and the `finally` on
   * `done` may never run at all if nobody ever connects. This is the caller saying "I am done with
   * this", and it is what stops a sealed copy of the archive living in the cache until the next
   * transfer happens to overwrite it. A receive sweeps its own directory once the stop reaches it.
   */
  async abandon(): Promise<void> {
    // Whatever was running is over as far as the caller is concerned, so the next run may start - even
    // if the stopped one's own end has not arrived yet, which for an offer nobody took it never does.
    this.live = null;
    // First, and before anything awaits: the caller's signal only reaches the native side on a JS
    // timer, and Android does not run those while the app is in the background (see
    // `Transport.cancel`). Without this a transfer "stopped" for leaving the app went on running
    // until the user came back.
    try {
      this.deps.transport.cancel();
    } catch {
      // A transport that cannot be reached has nothing running to stop.
    }
    // The offers running NOW are the ones walked away from. Named before anything awaits, so an offer
    // started after this call - the screen does not wait for it - is not swept by it (025 review,
    // 2026-09-15).
    const outbox = `${this.deps.workDir}/out/`;
    const walkedAway = [...this.inUse].filter(dir => dir.startsWith(outbox));
    for (const dir of walkedAway) {
      await this.sweep(dir);
    }
  }

  /**
   * Clear anything a previous RUN of the app left staged. Called once at start-up.
   *
   * `abandon` covers the user walking away; `offer` covers the next transfer. Neither covers the
   * process simply ending - and Android ends processes without asking. Walked on the device: a send
   * waiting for a receiver, force-stopped, left 6.9 MB of sealed archive AND `recovery.key` in the
   * cache, and relaunching the app did not touch them. They would have sat there until somebody
   * happened to start another transfer.
   *
   * The archive is the smaller half of that. `recovery.key` is the one secret that opens the whole
   * backup, and it belongs in the Keystore - it is written to disk for the seconds a transfer needs
   * it and nowhere else. A killed transfer turned "seconds" into "indefinitely", which is a
   * different security property than the one the feature was designed with.
   *
   * Safe precisely because it runs at start-up: a fresh process has no transfer in flight, so there
   * is nothing here that anybody is still using. Should a run of this process be under way all the
   * same - a save, or a transfer started in the instant after launch - its directory is left to it.
   */
  async sweepStale(): Promise<void> {
    await this.sweepUnused(this.deps.workDir);
  }

  /**
   * Count what a send carries (US1 scenario 1). Null, never a guess, when the archive cannot be read.
   */
  private async contentsOf(manifest: BackupManifest): Promise<TransferContents | null> {
    const source = this.deps.source;
    if (!source) {
      return null;
    }
    // A metadata-only backup restores no documents whatever else sits in the object store, so zero is
    // the true answer there rather than "not known".
    const documents = manifest.tiers.documents ? manifest.documentCount ?? null : 0;
    // The archive as it is now describes the newest backup only (see `TransferContents`).
    const newest = await this.deps.target
      .listManifests()
      .then(listed => listed.every(m => m.createdAt <= manifest.createdAt))
      .catch(() => false);
    if (!newest) {
      return { boxes: null, messages: null, documents };
    }
    try {
      const accounts = await source.listAccounts();
      let messages = 0;
      for (const account of accounts) {
        for (const folder of COUNTED_FOLDERS) {
          messages += (await source.listEnvelopes(account.boxId, folder)).length;
        }
      }
      return { boxes: accounts.length, messages, documents };
    } catch {
      // The size is still stated (FR-008). Losing the count is not worth losing the send over.
      return null;
    }
  }

  /**
   * The backup the person chose and its archive (026 FR-007).
   *
   * Until 026 this sent the newest backup the phone held at the moment of sending, whichever the screen
   * had named, so a backup made while the screen was open replaced the one on it. Which backup travels
   * is the person's choice now, so it is that one or none: a backup deleted since it was chosen -
   * retention after a newer one, most likely - ends the send with `TransferBackupGoneError`, and the
   * screen reads its list again.
   */
  private async chosenToSend(
    chosen: BackupManifest,
  ): Promise<{ manifest: BackupManifest; archive: Uint8Array }> {
    try {
      return { manifest: chosen, archive: await this.deps.target.getArchive(chosen.archiveName) };
    } catch (e) {
      const listed = await this.deps.target.listManifests().catch(() => null);
      if (listed && !listed.some(m => m.archiveName === chosen.archiveName)) {
        throw new TransferBackupGoneError();
      }
      throw e;
    }
  }

  /** Copy the named Tier 2 objects into the outgoing directory. Returns the bytes copied. */
  private async copyDocuments(
    dir: string,
    only: readonly string[],
    onCopied?: (done: number, total: number) => void,
    signal?: { readonly cancelled: boolean },
  ): Promise<number> {
    const from = this.deps.backupDir;
    if (!from) {
      return 0;
    }
    let names: string[] = [];
    try {
      names = await this.deps.fs.list(from);
    } catch {
      return 0; // no backup directory yet, which is not a failure
    }
    const wanted = new Set(only);
    const documents = names.filter(n => n.startsWith(DOCUMENT_PREFIX) && wanted.has(n));
    let bytes = 0;
    for (let i = 0; i < documents.length; i++) {
      // Between files, not inside one. The documents are the part of a send that can take minutes,
      // and copying on after a stop would be doing exactly that work in the background (FR-014).
      if (signal?.cancelled) {
        break;
      }
      bytes += await this.copyFile(`${from}/${documents[i]}`, `${dir}/${documents[i]}`, signal);
      onCopied?.(i + 1, documents.length);
    }
    return bytes;
  }

  /**
   * Copy one file a slice at a time, never holding it whole (025 review, 2026-09-15).
   *
   * It was `readBytes` then `writeBytes`, which put each document in the JS heap at once - and one of
   * them can be a 100 MB large-volume attachment, or a signed original larger than that. A stop is
   * checked between slices as well as between files, so a large document does not finish copying for
   * nobody (FR-014); the part it leaves is swept with the rest of the staging. Returns the bytes copied.
   */
  private async copyFile(
    from: string,
    to: string,
    signal?: { readonly cancelled: boolean },
  ): Promise<number> {
    const read = await this.deps.fs.open(from);
    let copied = 0;
    let first = true;
    for (;;) {
      const piece = await read();
      if (piece == null) {
        break;
      }
      if (first) {
        await this.deps.fs.writeBytes(to, piece);
        first = false;
      } else {
        await this.deps.fs.appendBytes(to, piece);
      }
      copied += piece.length;
      if (signal?.cancelled) {
        break;
      }
    }
    if (first) {
      // An empty document is still a document, and its object is still named for it.
      await this.deps.fs.writeBytes(to, new Uint8Array(0));
    }
    return copied;
  }

  /**
   * Write a received transfer into this phone's archive.
   *
   * Separate from `receive` so there is a moment between "we have it" and "it is in your archive"
   * that the user has to pass through (FR-004). Everything below this line is the existing restore:
   * the merge is additive and never replaces something with nothing.
   *
   * NOT CANCELLABLE, deliberately (025 review, 2026-09-15). The rows go in one transaction, but the
   * documents are written after it commits, and FR-012 says a cancel leaves the archive exactly as it
   * was - which a stop between the two cannot do: it would leave messages restored without their
   * documents. The question before this call is the moment to say no. While it runs, nothing else
   * may start or sweep (`isApplying`).
   *
   * Once the archive is written, the keys that came with it are kept the way the backup screen's
   * restore keeps them (006), so this phone backs up under them rather than starting over.
   */
  async apply(
    received: ReceivedTransfer,
    passphrase: string,
    options: ApplyOptions,
  ): Promise<AppliedTransfer> {
    if (!received.restorable) {
      throw new TransferFailedError(
        'This backup cannot be restored by this version of the app.',
      );
    }
    this.refuseWhileApplying();
    this.inUse.add(received.dir);
    const saving = this.saveInTurn(received, passphrase, options).finally(async () => {
      // Swept while still marked as saving, so nothing can start in the gap and lose its files to it.
      await this.sweep(received.dir);
      this.inUse.delete(received.dir);
      this.applying = null;
    });
    // Before anything awaits, so `isApplying` is true from the moment this is called. The outcome is
    // kept here, before the caller's own `then` on `saving` runs, so a screen still open to hear the
    // save end finds it there to take.
    this.applying = {
      dir: received.dir,
      done: saving.then(
        (applied): ApplyOutcome => this.ended({ ok: true, applied }),
        (error: unknown): ApplyOutcome => this.ended({ ok: false, error }),
      ),
    };
    return saving;
  }

  /**
   * The save as one run of the backup controller's, when it is wired (`runs`): the restore and the
   * keys together, since an automatic backup between the two would be the same overlap. Its progress
   * reaches both the transfer screen and the backup screen underneath.
   */
  private saveInTurn(
    received: ReceivedTransfer,
    passphrase: string,
    options: ApplyOptions,
  ): Promise<AppliedTransfer> {
    const runs = this.deps.runs;
    if (!runs) {
      return this.save(received, passphrase, options);
    }
    return runs.runRestore(onRun =>
      this.save(received, passphrase, {
        ...options,
        onProgress: progress => {
          options.onProgress?.(progress);
          onRun(progress);
        },
      }),
    );
  }

  /** The save itself: the existing restore, then the keys that came with it. */
  private async save(
    received: ReceivedTransfer,
    passphrase: string,
    options: ApplyOptions,
  ): Promise<AppliedTransfer> {
    const restored = await restoreBackup(
      received.manifest,
      // The bytes are already here, so the restore is handed a target that answers from what
      // arrived rather than fetching again. Everything else about the path is unchanged.
      stagedTarget(
        this.deps.target,
        received.manifest.archiveName,
        received.archive,
        received.dir,
        this.deps.fs,
      ),
      passphrase,
      this.deps.sink,
      options.onProgress,
      undefined,
      // Tier 2 is answered from the staged directory by `stagedTarget`, so this is all it takes for
      // the documents that travelled to be written back - and without it they never were.
      this.deps.documents,
    );
    const kept = await this.keepKeys(passphrase, restored.documentKey, options.promptTitle);
    return { ...restored, keysFailed: !kept };
  }

  /**
   * Keep the recovery key and the document key that arrived, where this phone has none (006).
   *
   * The archive is already written when this runs, so a failure here is not a failed transfer: the
   * screen says the backup password was not kept. Resolves whether they were. How a failure is told
   * apart from a declined screen lock is `keepRestoredKeys`'s, shared with the backup screen's restore
   * since 2026-09-15.
   */
  private async keepKeys(
    passphrase: string,
    documentKey: string | null | undefined,
    promptTitle: string,
  ): Promise<boolean> {
    const keys = this.deps.keys;
    if (!keys) {
      return true;
    }
    return keepRestoredKeys(keys, passphrase, documentKey, promptTitle);
  }

  /** Remove what a transfer staged. Best effort: litter is not worth failing a restore over. */
  private async sweep(dir: string): Promise<void> {
    try {
      for (const name of await this.deps.fs.list(dir)) {
        await this.deps.fs.remove(`${dir}/${name}`).catch(() => undefined);
      }
      await this.deps.fs.remove(dir).catch(() => undefined);
    } catch {
      // The directory was never created, or is already gone. Both are the desired state.
    }
  }

  /**
   * A directory of one run's own under `parent`, marked in use before anything creates it, so no sweep
   * can take it however the two interleave (025 review, 2026-09-15). The time is in the name so a run
   * never lands in what an earlier process left, even before the start-up sweep has reached it.
   */
  private claimRunDir(parent: string): string {
    this.runCount += 1;
    const dir = `${parent}/${Date.now().toString(36)}-${this.runCount}`;
    this.inUse.add(dir);
    return dir;
  }

  /** Sweep a run's directory and let go of it. */
  private async releaseRunDir(dir: string): Promise<void> {
    await this.sweep(dir);
    this.inUse.delete(dir);
  }

  /**
   * Remove everything under `parent` that no run of this process is using (025 review, 2026-09-15).
   *
   * A path inside a run's directory is that run's and is left alone; a directory that HOLDS one is
   * gone into rather than removed whole, so the leftovers beside the run still go.
   */
  private async sweepUnused(parent: string): Promise<void> {
    let names: string[];
    try {
      names = await this.deps.fs.list(parent);
    } catch {
      return; // never created, or already gone: both the desired state
    }
    for (const name of names) {
      const path = `${parent}/${name}`;
      // Read again for every name: a run can start while this is awaiting the one before.
      const inUse = [...this.inUse];
      if (inUse.some(dir => path === dir || path.startsWith(`${dir}/`))) {
        continue;
      }
      if (inUse.some(dir => dir.startsWith(`${path}/`))) {
        await this.sweepUnused(path);
        continue;
      }
      await this.deps.fs.remove(path).catch(() => undefined);
    }
  }
}

/** A stop is checked between steps, never inside one - the same rule `progress.ts` follows. */
function throwIfStopped(signal?: { readonly cancelled: boolean }): void {
  if (signal?.cancelled) {
    throw new TransferCancelledError();
  }
}

/**
 * The real target, with one archive answered from memory.
 *
 * A transfer has already downloaded the bytes; making `restoreBackup` fetch them again would mean
 * writing them into the backup store first, which is a side effect nobody asked for - this phone
 * did not make that backup and should not start listing it as its own.
 */
function stagedTarget(
  real: SyncTarget,
  archiveName: string,
  archive: Uint8Array,
  dir: string,
  fs: TransferFs,
): SyncTarget {
  return {
    ...real,
    listManifests: () => real.listManifests(),
    getArchive: async name =>
      name === archiveName ? archive : real.getArchive(name),
    // Tier 2 documents come from what ARRIVED, not from this phone's own store - it has never held
    // these objects and must not start listing them as its own just to be able to restore them.
    hasObject: async name => {
      try {
        return (await fs.list(dir)).includes(name);
      } catch {
        return false;
      }
    },
    // Read from disk a slice at a time (025 review, 2026-09-15). This comment used to say so while the
    // code read each object whole and only HANDED it out in pieces, which a 100 MB enclosure or a
    // signed original does not survive in the JS heap.
    getObject: async name => chunksOnRequest(await fs.open(`${dir}/${name}`)),
  };
}
