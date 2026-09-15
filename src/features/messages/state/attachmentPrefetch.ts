// Downloading the attachments the archive does not hold yet, without being asked message by message
// (026). One downloader for two reasons to want it: automatic download during a refresh (US4), and a
// backup set to carry every attachment (US1).
//
// What it may do is narrow, and the narrowness is the feature:
//
//   * It runs only behind something the user started - a listing (a box refresh, opening a box) or
//     "Zálohovat nyní". An app on a phone must sign in "pomocí manuálního příkazu uživatele" (Provozní
//     řád ISDS ch. 17), which is why nothing here has a timer and nothing runs in the background (014).
//   * It never delivers anything and never marks anything read. Delivery is the LISTING (§ 17 odst. 3,
//     Provozní řád ch. 8), and every message here was listed already; a web-service download does not
//     set state 7 either - only `MarkMessageAsDownloaded` does, which is `markRead`, which this never
//     calls. So a message downloaded here is still unread, in ISDS and in the app, until it is opened.
//   * It asks ISDS for each message once. ISDS counts single-message downloads per week against the
//     box's size, so a message in the archive, a message ISDS has already deleted, and a message that
//     failed during this run of the app are all left alone.
//
// It downloads through `getDetail`, the call the detail screen's button makes, so the files, the signed
// original, the large-volume path and the "ISDS deleted it" record are exactly what 002 and 004 define.

import type { DataBoxAccount } from '../../../services/isds/types';
import type {
  MessageFolder,
  UndownloadedMessage,
} from '../../../services/db/messagesStore';
import type { MessageDetailOutcome } from './messagesController';
import { needsSignIn } from './messagesController';
import { MESSAGE_STATE } from './messageState';
import { signedOriginalAvailability } from './signedOriginal';
import { reportFailure } from '../../../services/telemetry/telemetry';

/** The automatic-download switches (Nastavení → Přílohy). */
export interface AutoDownloadPrefs {
  on: boolean;
  /**
   * Only messages a listing first brought onto this phone at or after this moment; null = every
   * message in the archive. Set when the switch is turned on, from the choice the dialog offers.
   */
  since: number | null;
  /** Nothing automatic on a metered connection. On by default. */
  wifiOnly: boolean;
}

/** Which messages a run is for. */
export type PrefetchScope = { kind: 'all' } | { kind: 'since'; since: number };

export interface PrefetchProgress {
  done: number;
  total: number;
}

export interface PrefetchReport {
  /** Messages whose attachments are now on the phone. */
  downloaded: number;
  /** Asked for and not obtained: refused, failed, ISDS deleted it, or the box needs a sign-in. */
  failed: number;
}

export interface AttachmentPrefetcherDeps {
  listAccounts(): Promise<DataBoxAccount[]>;
  listUndownloaded(boxId: string): Promise<UndownloadedMessage[]>;
  /** `MessagesController.getDetail`. */
  download(
    account: DataBoxAccount,
    messageId: string,
    folder: MessageFolder,
    signal: AbortSignal,
  ): Promise<MessageDetailOutcome>;
  autoDownload(): Promise<AutoDownloadPrefs>;
  /** Whether backups are set to carry every attachment (026 US1). */
  backupWantsAll(): Promise<boolean>;
  /** `true` metered, `false` not, `null` not known (`services/transfer/connection`). */
  isMetered(): Promise<boolean | null>;
  /**
   * Keep automatic backups waiting while a run is going, so ONE backup follows a run instead of one
   * per downloaded message (026 FR-006). Returns the release.
   */
  holdBackups?(): () => void;
  now?(): number;
}

/**
 * Whether ISDS can be asked for this message's attachments at all. Pure, so the rules are testable
 * one by one.
 */
export function canAsk(message: UndownloadedMessage, now: number): boolean {
  const { state } = message.envelope;
  if (state === MESSAGE_STATE.contentErased) {
    return false; // ISDS has erased the content: nothing to download
  }
  if (message.folder === 'received' && state === MESSAGE_STATE.undeliverable) {
    return false; // never reached this box's content
  }
  if (message.folder === 'sent' && state === MESSAGE_STATE.antivirusFailed) {
    return false; // refused at the door, nothing was ever stored
  }
  // Past the retention window ISDS has deleted it (90 days from delivery by sign-in, three years
  // otherwise) - the same reading the signed-original row makes. Asking would be a call that can only
  // answer "gone", and a count toward the weekly limit for nothing.
  return (
    signedOriginalAvailability(
      { state, acceptanceTime: message.envelope.acceptanceTime },
      null,
      now,
    ) === 'held'
  );
}

/** Whether a message falls inside a run's scope. */
export function inScope(message: UndownloadedMessage, scope: PrefetchScope): boolean {
  if (scope.kind === 'all') {
    return true;
  }
  // A row without the stamp was here before the switch could have been turned on (026 FR-004).
  return message.firstSeenAt != null && message.firstSeenAt >= scope.since;
}

export class AttachmentPrefetcher {
  private readonly now: () => number;
  /** Runs one after another, never side by side: one ISDS download at a time for the whole app. */
  private queue: Promise<unknown> = Promise.resolve();
  /** Boxes with an automatic run waiting in the queue, so a burst of listings makes one run. */
  private readonly pending = new Set<string>();
  /** Messages that failed during this run of the app. Asked again after a restart, not before. */
  private readonly failedThisRun = new Set<string>();

  constructor(private readonly deps: AttachmentPrefetcherDeps) {
    this.now = deps.now ?? Date.now;
  }

  /**
   * A listing of this box has just succeeded - the user refreshed it or opened it. Downloads what the
   * settings ask for, after whatever is already running. Fire-and-forget: never rejects, and a
   * failure costs the downloads, never the refresh.
   */
  afterListing(account: DataBoxAccount): void {
    if (this.pending.has(account.boxId)) {
      return;
    }
    this.pending.add(account.boxId);
    // Reported by the queue itself; caught here so a failed run is not also an unhandled rejection.
    this.enqueue(async () => {
      this.pending.delete(account.boxId);
      const scope = await this.automaticScope();
      if (!scope) {
        return;
      }
      await this.runBox(account, scope, new AbortController().signal);
    }).catch(() => undefined);
  }

  /**
   * Download every missing attachment of every box that does not need a sign-in (026 US1, "Zálohovat
   * nyní" in the "all" mode). The person pressed the button, so the Wi-Fi setting does not apply.
   */
  downloadMissing(options: {
    /** The backup run's stop flag. Checked between messages, and a download under way is aborted. */
    stop: { readonly cancelled: boolean };
    onProgress?: (progress: PrefetchProgress) => void;
  }): Promise<PrefetchReport> {
    return this.enqueue(async () => {
      const ctrl = new AbortController();
      // The backup's stop is a flag, not an event, so it is looked at a few times a second - a large
      // message can take a minute to arrive, and a stop should not wait for it.
      const watch = setInterval(() => {
        if (options.stop.cancelled) {
          ctrl.abort();
        }
      }, STOP_POLL_MS);
      try {
        return await this.downloadEveryBox(
          ctrl.signal,
          () => options.stop.cancelled,
          options.onProgress,
        );
      } finally {
        clearInterval(watch);
      }
    });
  }

  /**
   * What `downloadMissing` would ask for, and what ISDS has already deleted - for the backup dialog.
   * Reads the archive only.
   */
  async estimate(): Promise<{ askable: number; gone: number }> {
    const now = this.now();
    let askable = 0;
    let gone = 0;
    for (const account of await this.deps.listAccounts()) {
      for (const message of await this.deps.listUndownloaded(account.boxId)) {
        if (canAsk(message, now)) {
          askable++;
        } else {
          gone++;
        }
      }
    }
    return { askable, gone };
  }

  private async downloadEveryBox(
    signal: AbortSignal,
    stopped: () => boolean,
    onProgress?: (progress: PrefetchProgress) => void,
  ): Promise<PrefetchReport> {
    const accounts = (await this.deps.listAccounts()).filter(a => !needsSignIn(a.syncError));
    const work: { account: DataBoxAccount; messages: UndownloadedMessage[] }[] = [];
    for (const account of accounts) {
      work.push({ account, messages: await this.askable(account.boxId, { kind: 'all' }) });
    }
    const total = work.reduce((sum, w) => sum + w.messages.length, 0);
    const report: PrefetchReport = { downloaded: 0, failed: 0 };
    let done = 0;
    onProgress?.({ done, total });
    for (const { account, messages } of work) {
      const box = await this.downloadAll(
        account,
        messages,
        signal,
        () => {
          done++;
          onProgress?.({ done, total });
        },
        stopped,
      );
      report.downloaded += box.downloaded;
      report.failed += box.failed;
      if (signal.aborted || stopped()) {
        break;
      }
    }
    return report;
  }

  /** What an automatic run may download now, or null when it may not run at all. */
  private async automaticScope(): Promise<PrefetchScope | null> {
    const [prefs, wantsAll] = await Promise.all([
      this.deps.autoDownload(),
      this.deps.backupWantsAll(),
    ]);
    if (!prefs.on && !wantsAll) {
      return null;
    }
    // Not known is not metered: `isMetered` answers null only where NetInfo is missing.
    if (prefs.wifiOnly && (await this.deps.isMetered()) === true) {
      return null;
    }
    if (wantsAll || prefs.since == null) {
      return { kind: 'all' };
    }
    return { kind: 'since', since: prefs.since };
  }

  private async runBox(
    account: DataBoxAccount,
    scope: PrefetchScope,
    signal: AbortSignal,
  ): Promise<PrefetchReport> {
    return this.downloadAll(account, await this.askable(account.boxId, scope), signal);
  }

  /** The box's messages this run may ask ISDS for, newest first. */
  private async askable(boxId: string, scope: PrefetchScope): Promise<UndownloadedMessage[]> {
    const now = this.now();
    return (await this.deps.listUndownloaded(boxId)).filter(
      m =>
        !this.failedThisRun.has(key(boxId, m.envelope.id)) &&
        inScope(m, scope) &&
        canAsk(m, now),
    );
  }

  private async downloadAll(
    account: DataBoxAccount,
    messages: readonly UndownloadedMessage[],
    signal: AbortSignal,
    onEach?: () => void,
    /** Asked before each message as well as the signal: a stop must not wait for the next poll. */
    stopped: () => boolean = () => false,
  ): Promise<PrefetchReport> {
    const report: PrefetchReport = { downloaded: 0, failed: 0 };
    if (messages.length === 0) {
      return report;
    }
    const release = this.deps.holdBackups?.();
    try {
      for (let i = 0; i < messages.length; i++) {
        if (signal.aborted || stopped()) {
          break;
        }
        const message = messages[i];
        let outcome: MessageDetailOutcome;
        try {
          outcome = await this.deps.download(account, message.envelope.id, message.folder, signal);
        } catch (e) {
          // `getDetail` answers its failures as outcomes; this is a fault underneath it.
          reportFailure('isds.download', e, { stage: 'transport' });
          outcome = { kind: 'error', messageKey: 'messages.error.load' };
        }
        onEach?.();
        if (outcome.kind === 'detail') {
          report.downloaded++;
          continue;
        }
        report.failed++;
        if (outcome.kind === 'reauth') {
          // The box needs a sign-in: every further call would be refused the same way, and ISDS locks
          // an account after repeated refused sign-ins. The rest count as not obtained.
          for (let rest = i + 1; rest < messages.length; rest++) {
            report.failed++;
            onEach?.();
          }
          break;
        }
        if (!signal.aborted) {
          // Refused, failed, cut off part-way or deleted by ISDS: not again until the app restarts.
          this.failedThisRun.add(key(account.boxId, message.envelope.id));
        }
      }
    } finally {
      release?.();
    }
    return report;
  }

  /** Run after everything queued before, and keep the queue going whatever this one does. */
  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const run = this.queue.then(work);
    this.queue = run.catch(e => {
      reportFailure('isds.download', e, { stage: 'transport' });
    });
    return run;
  }
}

/** How often a backup's stop flag is looked at during a download. */
const STOP_POLL_MS = 250;

function key(boxId: string, messageId: string): string {
  return `${boxId} ${messageId}`;
}
