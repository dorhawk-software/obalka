// MessagesController (feature 002). Loads the received-message list for a box over the ISDS
// transport. Like AuthService it NEVER throws - every path resolves to a typed MessagesOutcome, so
// the screen always has a recoverable state (constitution Principle II). Pure orchestration over
// injected deps → unit-tested with fakes.

import {
  CreditInfoResult,
  DownloadMessageArgs,
  GetCreditInfoArgs,
  ListMessagesArgs,
  MessageDetailResult,
  MessageListResult,
  MessageMarkResult,
  SignedMessageResult,
  TransportNetworkError,
  TransportTimeoutError,
} from '../../../services/isds/transport';
import {
  CredentialsUnavailableError,
  credentialsFor,
  type SecureStore,
} from '../../../services/secureStore/secureStore';
import {
  measure,
  reportFailure,
  type Op,
} from '../../../services/telemetry/telemetry';
import type {
  CachedList,
  MessageFolder,
  MergedList,
  MessageSearchHit,
  MessagesStore,
} from '../../../services/db/messagesStore';
import type {
  VodzAttachmentDownloader,
  VodzSignedZfoResult,
  VodzWalkStop,
} from '../../../services/files/vodzAttachmentDownloader';
import type { AttachmentFileStore } from '../../../services/files/attachmentFileStore';
import {
  MESSAGE_STATE_READ,
  type DataBoxAccount,
  type Host,
  type MessageAttachment,
  type MessageDetail,
  type MessageEnvelope,
  type OutgoingDocument,
  type Recipient,
  type SignedOriginal,
  type SyncFailure,
} from '../../../services/isds/types';
import { DEMO_DATA } from '../../../dev/demoData';
import { mustChangePassword } from '../../accounts/state/passwordExpiry';
import { signedOriginalAvailability } from './signedOriginal';
import { BoxGoneError, type BoxWork } from './boxWork';

export type MessagesOutcome =
  | {
      kind: 'loaded';
      messages: MessageEnvelope[];
      downloaded: string[];
      /**
       * When this folder last synced successfully (epoch ms), or null = never.
       *
       * The store has computed this all along and every caller dropped it, so the inbox could not
       * answer "how old is this list?" - the first-order question in an app that syncs ONLY when the
       * user asks it to (2026-09-09 critique).
       */
      syncedAt: number | null;
    }
  | { kind: 'reauth' } // session expired (401) - the box must sign in again
  | { kind: 'error'; messageKey: string };

/** Why a download did not bring everything, as the screen says it. */
export type DownloadFailure =
  | { kind: 'reauth' } // session expired - the box must sign in again
  | { kind: 'error'; messageKey: string };

export type MessageDetailOutcome =
  | { kind: 'detail'; detail: MessageDetail }
  /**
   * A large-volume message's enclosure walk stopped part-way (constitution IV). What arrived is in the
   * archive and `failure` is why the rest did not come. `detail.enclosuresMissingFrom` records where the
   * missing ones start, and the next `getDetail` asks ISDS for those alone - absent when the archive held
   * the message whole already and still holds the enclosures past the stop (`enclosuresAfterWalk`).
   */
  | { kind: 'partial'; detail: MessageDetail; failure: DownloadFailure }
  | { kind: 'reauth' } // session expired (401) - the box must sign in again
  /**
   * ISDS answered `1219` (it has deleted the message) and the message is past its retention window:
   * recorded as `attachmentsUnavailable` on the cached detail, so its files are known to be lost.
   */
  | { kind: 'gone' }
  | { kind: 'error'; messageKey: string };

/** Fetching the signed original of a message the archive already holds (004 amendment). */
export type SignedOriginalOutcome =
  | { kind: 'saved'; detail: MessageDetail }
  | { kind: 'reauth' }
  /** ISDS refused, past its retention window: recorded on the detail, so nothing offers it again. */
  | { kind: 'gone'; detail: MessageDetail }
  | { kind: 'error'; messageKey: string };

// ISDS dmMessageStatus: 7 = PŘEČTENO (read); a received message is unread until then. Confirmed
// live against production boxes - delivered-but-unread messages are state 6, read ones are 7.
/**
 * How many merged rows the screen will hold.
 *
 * A merged archive is the largest list this app can produce - four boxes times three years of mail
 * outlives ISDS's own 90-day window by design (Principle IV). The window is generous enough that
 * scrolling to its end is a deliberate act, and search covers everything beyond it.
 */
export const MERGED_LIMIT = 500;

export const isUnread = (state: number): boolean =>
  state > 0 && state < MESSAGE_STATE_READ;

// Optimistic state for a just-sent message (1 = podána / submitted → "Odesláno"). The sent-list sync
// replaces it with the real status (dodáno/doručeno) moments later.
const SENT_STATE_SUBMITTED = 1;

/**
 * What the screen says about a large-volume walk that stopped after some enclosures arrived.
 *
 * A lost session is re-authentication, as anywhere else. ISDS answering `1219` half-way is a refusal to
 * retry, not the message recorded as gone: it has just served enclosures, and only a walk that brought
 * nothing may make that record (`attachmentsGone`).
 */
export function walkFailure(stopped: VodzWalkStop): DownloadFailure {
  if (stopped === 'authFault') {
    return { kind: 'reauth' };
  }
  return {
    kind: 'error',
    messageKey: stopped === 'gone' ? 'detail.attachments.refused' : 'detail.attachments.missingFailed',
  };
}

/**
 * The enclosures an earlier walk that stopped part-way left in the archive, which the next walk
 * resumes after - or none, when the cached detail carries no such record or the record does not add
 * up (it names enclosures 0 … n-1, so it must hold exactly n).
 */
export function resumableEnclosures(cached: MessageDetail | null): MessageAttachment[] {
  const from = cached?.enclosuresMissingFrom;
  if (cached == null || from == null || from !== cached.attachments.length) {
    return [];
  }
  return cached.attachments;
}

/**
 * What the archive records for a large-volume message once a walk has brought enclosures: `held` (what
 * the walk resumed after) and what arrived, and - when the walk stopped part-way (`missingFrom`) - where
 * the missing ones start.
 *
 * Except for a message the archive already held whole. Its download is offered again only to bring back
 * files gone from the device, and that walk starts from the first enclosure. Stopped part-way, it has
 * replaced the enclosures before the stop, and the ones after it are still the ones the archive held:
 * recorded as missing instead, they fell out of the archive - their files unlisted and written over by
 * the resume, and lost for good once ISDS no longer serves the message.
 */
export function enclosuresAfterWalk(
  cached: MessageDetail | null,
  held: readonly MessageAttachment[],
  walk: { attachments: readonly MessageAttachment[]; missingFrom?: number },
): Pick<MessageDetail, 'attachments' | 'enclosuresMissingFrom'> {
  const attachments = [...held, ...walk.attachments];
  const from = walk.missingFrom;
  if (from == null) {
    return { attachments };
  }
  const wasWhole = held.length === 0 && cached != null && cached.enclosuresMissingFrom == null;
  if (wasWhole && cached.attachments.length > from) {
    return { attachments: [...attachments, ...cached.attachments.slice(from)] };
  }
  return { attachments, enclosuresMissingFrom: from };
}

/**
 * Classify a failed refresh into the recovery to offer. A clean 401 is always reauth. Otherwise: an
 * OTP box that fails for a non-network reason has almost certainly lost its login session (the cookie
 * expired → the SOAP call faults), which only re-authentication fixes; password boxes re-auth on every
 * call, so a server error there is transient → a plain retry. Pure - shared by the home + background sync.
 *
 * A password box refused after its stored password-expiry date is `passwordExpired`, not `reauth`
 * (001 FR-009, `mustChangePassword`): signing in again with that password cannot work until it is
 * changed on the portal. Only the clean 401 can be that - a server error refused nothing. `now` is
 * the moment of the failure; see `SyncFailure` for why the verdict is stored then.
 */
export function classifyFailure(
  account: DataBoxAccount,
  outcome: MessagesOutcome,
  now: number = Date.now(),
): SyncFailure {
  if (outcome.kind === 'reauth') {
    return mustChangePassword(account, now) ? 'passwordExpired' : 'reauth';
  }
  // `messages.error.credentials` belongs here too: the stored secret could not be read right now
  // (001 T028) - a Keychain hiccup, never a refusal - and a cookie box flagged for re-auth over it
  // would be sent to sign in again with a session that works.
  const transient =
    outcome.kind === 'error' &&
    (outcome.messageKey === 'messages.error.network' ||
      outcome.messageKey === 'messages.error.timeout' ||
      outcome.messageKey === 'messages.error.credentials');
  if (account.authMethod !== 'password' && !transient) {
    return 'reauth';
  }
  return 'error';
}

/**
 * A failure only the user can clear, by signing in again - after changing the password on the portal
 * first, for `passwordExpired`. Refresh-all skips these boxes rather than send ISDS a sign-in it has
 * already refused, and the merged inbox offers them the re-auth action.
 */
export function needsSignIn(
  failure: SyncFailure | null | undefined,
): failure is 'reauth' | 'passwordExpired' {
  return failure === 'reauth' || failure === 'passwordExpired';
}

/** The slice of the transport the controller needs (IsdsHttpTransport satisfies it structurally). */
export interface MessagesTransport {
  listReceivedMessages(args: ListMessagesArgs): Promise<MessageListResult>;
  getSentMessages(args: ListMessagesArgs): Promise<MessageListResult>;
  downloadMessage(args: DownloadMessageArgs): Promise<MessageDetailResult>;
  downloadSignedMessage(args: DownloadMessageArgs): Promise<SignedMessageResult>;
  markMessageAsDownloaded(
    args: DownloadMessageArgs,
  ): Promise<MessageMarkResult>;
  getCreditInfo(args: GetCreditInfoArgs): Promise<CreditInfoResult>;
}

export interface MessagesControllerDeps {
  transport: MessagesTransport;
  /**
   * The box's password and session, read at call time. With the app lock on, a read waits for the
   * unlock (001 T028), so no call below reaches ISDS while the app is locked.
   */
  secureStore: Pick<SecureStore, 'readPassword' | 'readSession'>;
  /** Offline cache: synced envelopes + downloaded message detail (offline-first archive). */
  messagesStore: MessagesStore;
  /** Streams a large-volume (VoDZ) message's enclosures, and its signed original, to files. */
  vodzDownloader?: VodzAttachmentDownloader;
  /**
   * Persists attachment content and signed originals to disk (files-on-disk); when absent, attachments
   * stay inline base64 and no original is kept - 27 MB of base64 has no place in a database row.
   */
  attachmentFiles?: AttachmentFileStore;
  host?: Host;
  now?: () => number;
  /**
   * The archive was written to - new envelopes, a downloaded document, a changed flag.
   *
   * Optional and fire-and-forget: this controller knows nothing about what listens (006 wires the
   * automatic backup to it). It fires only when something ACTUALLY changed, so a refresh that
   * returned the same messages does not trigger work.
   */
  onArchiveChanged?: () => void;
  /**
   * A listing of this box succeeded - the user refreshed it or opened it (026).
   *
   * What automatic attachment download hangs off: a download may only follow something the user
   * started, and a listing is that. Fire-and-forget, like `onArchiveChanged`.
   */
  onListed?: (account: DataBoxAccount) => void;
  /**
   * The work under way per box, which removing a box stops (`BoxWork`): every ISDS call runs under
   * its box's signal, every write of a box's archive or files is refused once the box is being
   * removed or gone, and clearing a box waits for its writes under way. The app always passes it
   * (`deps.ts`); without it nothing is guarded, as in the tests about everything else.
   */
  work?: BoxWork;
}

export class MessagesController {
  private readonly host: Host;
  private readonly now: () => number;

  constructor(private readonly deps: MessagesControllerDeps) {
    this.host = deps.host ?? 'czebox';
    this.now = deps.now ?? (() => Date.now());
  }

  /**
   * Load received messages for a box from ISDS. NEVER throws. On success the envelopes are cached so
   * they are viewable offline, and `downloaded` lists which messages are already available offline.
   * A failure (reauth/network/server) returns its typed outcome; the screen then falls back to the
   * cache via `getCachedMessages`.
   */
  async listReceived(
    account: DataBoxAccount,
    signal: AbortSignal,
  ): Promise<MessagesOutcome> {
    // Timed: this is the round trip Principle I is actually about - a SOAP call, an XML parse and a
    // write to an encrypted database, all on the path between a pull-to-refresh and the list moving.
    // "Never block the UI thread" has been asserted since the constitution was ratified and measured
    // never.
    return measure(
      'isds.listReceived',
      () => this.forBox(account.boxId, signal, s => this.loadFolder(account, 'received', s)),
      { stage: 'transport', host: account.host, folder: 'received' },
    );
  }

  /** Load the box's SENT messages (008) - same contract as {@link listReceived}, the sent folder. */
  async listSent(
    account: DataBoxAccount,
    signal: AbortSignal,
  ): Promise<MessagesOutcome> {
    return this.forBox(account.boxId, signal, s => this.loadFolder(account, 'sent', s));
  }

  private async loadFolder(
    account: DataBoxAccount,
    folder: MessageFolder,
    signal: AbortSignal,
  ): Promise<MessagesOutcome> {
    if (signal.aborted) {
      return { kind: 'error', messageKey: 'messages.error.load' };
    }
    // The fictional archive has no server behind it, so every sync would fail and paint a re-login
    // strip across each screenshot. Serve the cache and call it a successful sync: in demo mode the
    // cache IS the source of truth. Dev-only, off by default; see `dev/demoData.ts`.
    if (__DEV__ && DEMO_DATA) {
      const cached = await this.deps.messagesStore.getList(account.boxId, folder);
      return {
        kind: 'loaded',
        messages: cached.envelopes,
        downloaded: cached.downloaded ?? [],
        syncedAt: cached.syncedAt ?? null,
      };
    }
    try {
      const { password, sessionCookie } = await this.credentials(account, signal);
      const args = {
        host: account.host, // each box uses its own ISDS environment (production vs czebox test)
        authMethod: account.authMethod,
        sessionCookie,
        loginName: account.loginName,
        password,
        signal,
      };
      const result =
        folder === 'sent'
          ? await this.deps.transport.getSentMessages(args)
          : await this.deps.transport.listReceivedMessages(args);

      switch (result.type) {
        case 'messages': {
          // Through the box's guard: a listing that returns after the box's removal started must not
          // put its envelopes back into an archive the removal clears (`BoxWork`).
          await this.write(account.boxId, () =>
            this.deps.messagesStore.cacheList(account.boxId, folder, result.messages, this.now()),
          );
          if (result.messages.length > 0) {
            this.deps.onArchiveChanged?.();
          }
          this.deps.onListed?.(account);
          // What we render is the local ARCHIVE (which the upsert above has just brought up to
          // date), NOT the server's response. The two genuinely differ: ISDS keeps a message for 90
          // days from delivery-by-login and then drops it, while the archive existing at all is the
          // point of this app - the FAQ promises messages stay "i po 90 dnech".
          //
          // Returning `result.messages` here meant a message vanished from the inbox the moment ISDS
          // purged it. The row was still in the database and still searchable; it was simply no
          // longer listed. The visible symptom was a flash: opening the box rendered the archive
          // from cache, then the live result replaced it a few hundred ms later, minus everything
          // older than 90 days.
          const cached = await this.deps.messagesStore.getList(
            account.boxId,
            folder,
          );
          return {
            kind: 'loaded',
            messages: cached.envelopes,
            downloaded: cached.downloaded,
            syncedAt: cached.syncedAt,
          };
        }
        case 'authFault':
          return { kind: 'reauth' };
        default:
          return { kind: 'error', messageKey: 'messages.error.load' };
      }
    } catch (e: unknown) {
      return this.mapError(e, signal, 'isds.listSent');
    }
  }

  /** The cached (offline) messages for a box + folder - used when a live load fails or offline. */
  getCachedMessages(
    boxId: string,
    folder: MessageFolder = 'received',
  ): Promise<CachedList> {
    return this.deps.messagesStore.getList(boxId, folder);
  }

  /** Search the local archive across all boxes (envelope text, accent/case-insensitive). Offline. */
  searchMessages(query: string): Promise<MessageSearchHit[]> {
    return this.deps.messagesStore.search(query);
  }

  /**
   * The merged inbox (024 cycle 2): every box's messages in one list, newest first.
   *
   * Archive-only, like `searchMessages` and for the same reason. It is also why this is safe to
   * render on a screen the user opens constantly: no path from here reaches ISDS, so nothing here
   * can deliver anybody's mail under 17(3). Refreshing the merged view is the shell's `refreshAll`,
   * which is the sanctioned command shape it already runs at launch.
   */
  getMergedMessages(
    folder: MessageFolder = 'received',
    limit = MERGED_LIMIT,
  ): Promise<MergedList> {
    return this.deps.messagesStore.listAcrossBoxes(folder, limit);
  }

  /** A single cached envelope - the detail screen renders from this without downloading attachments. */
  getCachedEnvelope(
    boxId: string,
    messageId: string,
  ): Promise<MessageEnvelope | null> {
    return this.deps.messagesStore.getEnvelope(boxId, messageId);
  }

  /**
   * Download a full message (envelope + attachments) from ISDS. NEVER throws. On success the full
   * detail (incl. attachment content) is cached so the message + its attachments are available
   * offline. A failure returns its typed outcome; the screen falls back to `getCachedDetail`.
   */
  async getDetail(
    account: DataBoxAccount,
    messageId: string,
    folder: MessageFolder,
    signal: AbortSignal,
    onProgress?: (receivedBytes: number) => void,
  ): Promise<MessageDetailOutcome> {
    return this.forBox(account.boxId, signal, s =>
      this.downloadDetail(account, messageId, folder, s, onProgress),
    );
  }

  private async downloadDetail(
    account: DataBoxAccount,
    messageId: string,
    folder: MessageFolder,
    signal: AbortSignal,
    onProgress?: (receivedBytes: number) => void,
  ): Promise<MessageDetailOutcome> {
    if (signal.aborted) {
      return { kind: 'error', messageKey: 'messages.error.load' };
    }
    try {
      const { password, sessionCookie } = await this.credentials(account, signal);
      const result = await this.deps.transport.downloadMessage({
        host: account.host,
        authMethod: account.authMethod,
        sessionCookie,
        loginName: account.loginName,
        password,
        messageId,
        signedSent: folder === 'sent',
        signal,
      });

      switch (result.type) {
        case 'detail': {
          const detail = await this.persistAndCache(
            account.boxId,
            messageId,
            result.detail,
            result.signedZfo,
          );
          return { kind: 'detail', detail };
        }
        case 'authFault':
          return { kind: 'reauth' };
        case 'unsupported':
          // A large-volume (VoDZ) message, received or sent: the ordinary downloads can't serve it.
          // Stream its enclosures from the VoDZ service (one at a time, to files) instead.
          return this.downloadVodzDetail(
            account,
            messageId,
            folder,
            signal,
            onProgress,
          );
        case 'gone':
          return this.attachmentsGone(account.boxId, messageId);
        case 'refused':
          return { kind: 'error', messageKey: 'detail.attachments.refused' };
        default:
          return { kind: 'error', messageKey: 'messages.error.load' };
      }
    } catch (e: unknown) {
      return this.mapError(e, signal, 'isds.download');
    }
  }

  /**
   * Whether ISDS saying it deleted a message (`1219`) is recorded as the message being gone.
   *
   * Only past the retention window (`signedOriginalAvailability`, the same reading of the Provozní řád
   * the original row uses): ISDS documents 1219 for a message deleted 90 days after delivery or three
   * years after it was dropped into the box, so a 1219 inside that window contradicts the document,
   * and a permanent record is not made on a contradiction. It stays a refusal to retry.
   */
  private async pastRetention(boxId: string, messageId: string): Promise<boolean> {
    const envelope = await this.deps.messagesStore.getEnvelope(boxId, messageId);
    return (
      envelope != null && signedOriginalAvailability(envelope, null, this.now()) !== 'held'
    );
  }

  /**
   * ISDS said the message's download is gone for good. Recorded on the cached detail - the flag the
   * detail screen shows as "Příloha už není dostupná" - and cleared again by any later download that
   * works. Replaces the screen's old rule, which took ANY server failure past 90 days as that verdict.
   */
  private async attachmentsGone(
    boxId: string,
    messageId: string,
  ): Promise<MessageDetailOutcome> {
    if (!(await this.pastRetention(boxId, messageId))) {
      return { kind: 'error', messageKey: 'detail.attachments.refused' };
    }
    // The guarded write itself, so a box being removed ends as any stopped download does, not as gone.
    await this.markUnavailable(boxId, messageId, true);
    return { kind: 'gone' };
  }

  /**
   * Download a large-volume (VoDZ) message's enclosures to files and present them as a detail. The
   * VoDZ service only serves the FILES (no envelope), so the envelope is taken from the offline cache
   * (the list sync stored it) and merged with the streamed attachments. Honest fallback if the box has
   * no `vodzDownloader` wired or the download fails.
   *
   * A walk that stops after some enclosures arrived keeps them and records the rest as missing
   * (`partial`); the next call resumes at the first missing one and never asks for, or writes, an
   * enclosure the archive already holds. A file of those that has since gone from the device shows as
   * missing like any other, and comes back with the full download offered once the message is whole -
   * which, stopped part-way, keeps the message whole (`enclosuresAfterWalk`).
   */
  private async downloadVodzDetail(
    account: DataBoxAccount,
    messageId: string,
    folder: MessageFolder,
    signal: AbortSignal,
    onProgress?: (receivedBytes: number) => void,
  ): Promise<MessageDetailOutcome> {
    if (this.deps.vodzDownloader == null) {
      return { kind: 'error', messageKey: 'detail.attachments.vodzFailed' };
    }
    try {
      // The box's own session too, since 018 T015: until then this path read the password alone, and
      // a cookie box's enclosures went out with whatever session the shared native jar held.
      const credentials = await this.credentials(account, signal);
      const cached = await this.deps.messagesStore.getDetail(account.boxId, messageId);
      const held = resumableEnclosures(cached);
      const downloader = this.deps.vodzDownloader;
      // A write of the box's files: the walk streams each enclosure to disk as it arrives, so a removal
      // waits for it to stop - it has aborted it - before clearing the box's directory.
      const result = await this.write(account.boxId, () =>
        downloader.download({
          host: account.host,
          authMethod: account.authMethod,
          loginName: account.loginName,
          password: credentials.password,
          sessionCookie: credentials.sessionCookie,
          boxId: account.boxId,
          messageId,
          signal,
          onProgress,
          from: held.length,
        }),
      );
      if (result.type === 'authFault') {
        return { kind: 'reauth' };
      }
      if (result.type === 'gone') {
        return this.attachmentsGone(account.boxId, messageId);
      }
      if (result.type === 'serverFault') {
        // Nothing new arrived. A resumed walk leaves its record as it stood, so the message keeps
        // showing what it holds and offering the rest.
        return {
          kind: 'error',
          messageKey:
            held.length > 0 ? 'detail.attachments.missingFailed' : 'detail.attachments.vodzFailed',
        };
      }
      const envelope = await this.deps.messagesStore.getEnvelope(
        account.boxId,
        messageId,
      );
      if (envelope == null) {
        return { kind: 'error', messageKey: 'messages.error.load' };
      }
      const partial = result.type === 'partial';
      const detail = await this.persistAndCache(account.boxId, messageId, {
        id: envelope.id,
        subject: envelope.subject,
        sender: envelope.sender,
        senderAddress: envelope.senderAddress,
        recipient: envelope.recipient,
        recipientAddress: envelope.recipientAddress,
        deliveryTime: envelope.deliveryTime,
        acceptanceTime: envelope.acceptanceTime,
        // Built afresh, so a walk that reached the end drops the record of an earlier one that did not.
        ...enclosuresAfterWalk(cached, held, {
          attachments: result.attachments,
          missingFrom: partial ? result.missingFrom : undefined,
        }),
      });
      if (partial) {
        // No original fetched: the walk has just failed on this service, and a signed original can run
        // to gigabytes. It follows once the enclosures are all in, as it does for a message that is whole.
        return { kind: 'partial', detail, failure: walkFailure(result.stopped) };
      }
      // The enclosures are in the archive now. The original follows them, and only then (004).
      return {
        kind: 'detail',
        detail: await this.attachBigOriginal(
          account,
          messageId,
          folder,
          credentials,
          signal,
          detail,
          onProgress,
        ),
      };
    } catch (e: unknown) {
      return this.mapError(e, signal, 'isds.download');
    }
  }

  /**
   * A VoDZ message's signed original, streamed to disk after its enclosures and recorded on the
   * detail (004 amendment).
   *
   * Best-effort by design. The enclosures came through a path confirmed on czebox and are already in
   * the archive; the big signed download has never been observed on a real box. An original that does
   * not arrive leaves the detail offering to fetch it again - it never takes the documents with it.
   * It rides the same box session the enclosures did (018 T015).
   */
  private async attachBigOriginal(
    account: DataBoxAccount,
    messageId: string,
    folder: MessageFolder,
    credentials: { password: string | null; sessionCookie: string | null },
    signal: AbortSignal,
    detail: MessageDetail,
    onProgress?: (receivedBytes: number) => void,
  ): Promise<MessageDetail> {
    const downloader = this.deps.vodzDownloader;
    if (downloader == null || (await this.heldOriginal(detail)) != null) {
      return detail;
    }
    // Streamed into the box's directory, so a write of the box like the enclosures before it.
    const result = await this.write(account.boxId, () =>
      downloader.downloadSignedZfo({
        host: account.host,
        authMethod: account.authMethod,
        loginName: account.loginName,
        password: credentials.password,
        sessionCookie: credentials.sessionCookie,
        boxId: account.boxId,
        messageId,
        sent: folder === 'sent',
        signal,
        onProgress,
      }),
    );
    if (result.type !== 'zfo') {
      reportFailure('isds.download', new Error('The large-volume original did not arrive.'), {
        stage: 'transport',
        // The service the request actually went to: a cookie box's goes through the portal.
        endpoint: account.authMethod === 'password' ? '/DS/vodz' : '/apps/DS/vodz',
        folder,
      });
      return detail;
    }
    const withOriginal = { ...detail, signedZfo: result.original };
    await this.write(account.boxId, () =>
      this.deps.messagesStore.cacheDetail(account.boxId, withOriginal, this.now()),
    );
    this.deps.onArchiveChanged?.();
    return withOriginal;
  }

  /** The cached (offline) detail for a message, or null if it was never downloaded. */
  async getCachedDetail(
    boxId: string,
    messageId: string,
  ): Promise<MessageDetail | null> {
    const detail = await this.deps.messagesStore.getDetail(boxId, messageId);
    if (detail == null || this.deps.attachmentFiles == null) {
      return detail;
    }
    // Migrate-on-open: a legacy detail still holding base64 (pre files-on-disk), or one missing a
    // size, gets persisted to files + re-cached the first time it's opened. No bulk upgrade step.
    const needsWork = detail.attachments.some(
      a => (!a.localPath && !!a.contentBase64) || (!!a.localPath && a.size == null),
    );
    if (!needsWork) {
      return detail;
    }
    try {
      return await this.persistAndCache(boxId, messageId, detail);
    } catch (e) {
      // The box is being removed: nothing is written for it, and the detail is still the one read.
      if (e instanceof BoxGoneError) {
        return detail;
      }
      throw e;
    }
  }

  /**
   * Cache a just-SENT message's detail so its attachments are viewable immediately - we already hold
   * the files we uploaded, so re-downloading them would be absurd. The outgoing docs become the
   * message's attachments (base64 in hand; the migrate-on-open path writes them to disk on first
   * view). An optimistic "Odesláno" envelope is stored too; the next sent-list sync corrects its
   * state/times while preserving this detail.
   */
  async recordSentMessage(
    account: DataBoxAccount,
    params: {
      messageId: string;
      subject: string;
      recipient: Recipient;
      files: OutgoingDocument[];
      sentAt: number;
    },
  ): Promise<void> {
    const attachments: MessageAttachment[] = params.files.map(f => ({
      name: f.fileName,
      mimeType: f.mimeType,
      metaType: f.isMain ? 'main' : 'enclosure',
      // Keep the base64 only (not the picker's possibly-temporary localPath); getCachedDetail's
      // migrate-on-open then persists it to a stable on-disk path the first time it's viewed.
      contentBase64: f.contentBase64,
      size: f.sizeBytes,
    }));
    const common = {
      id: params.messageId,
      subject: params.subject,
      sender: account.label,
      senderAddress: null,
      recipient: params.recipient.name,
      // Carried through since 015: the address the user picked FROM is the address the sent row
      // should show, without waiting for the next sync to fill it in.
      recipientAddress: params.recipient.address,
      // Delivery into the recipient's box is effectively the send instant (mirrors the sent-detail
      // timeline's own assumption); the sync replaces these with the real values.
      deliveryTime: params.sentAt,
      acceptanceTime: null,
    };
    const detail: MessageDetail = { ...common, attachments };
    const totalKb = Math.max(
      1,
      Math.round(
        params.files.reduce((n, f) => n + f.sizeBytes, 0) / 1024,
      ),
    );
    const envelope: MessageEnvelope = {
      ...common,
      recipientBoxId: params.recipient.boxId,
      state: SENT_STATE_SUBMITTED,
      attachmentSize: totalKb,
    };
    try {
      await this.write(account.boxId, () =>
        this.deps.messagesStore.recordSent(account.boxId, envelope, detail, this.now()),
      );
    } catch (e) {
      // Sent from a box that is being removed: the message went, and there is no archive to keep it in.
      if (!(e instanceof BoxGoneError)) {
        throw e;
      }
    }
  }

  /**
   * Persist the "attachments no longer recoverable from ISDS" flag on a cached detail. Survives reopens.
   * Set to true only on ISDS's 1219 past the retention window (004 research R8): here by
   * `attachmentsGone`, and by `originalGone` on the detail it writes itself - no longer by the screen
   * after any failure past 90 days. The screen clears it after a download that works.
   */
  async setAttachmentsUnavailable(
    boxId: string,
    messageId: string,
    value: boolean,
  ): Promise<void> {
    try {
      await this.markUnavailable(boxId, messageId, value);
    } catch (e) {
      // The box is being removed or is gone: there is no detail left to flag.
      if (!(e instanceof BoxGoneError)) {
        throw e;
      }
    }
  }

  /** `setAttachmentsUnavailable`, rejecting with `BoxGoneError` for a box it may not write. */
  private async markUnavailable(boxId: string, messageId: string, value: boolean): Promise<void> {
    const detail = await this.deps.messagesStore.getDetail(boxId, messageId);
    if (detail == null || (detail.attachmentsUnavailable ?? false) === value) {
      return;
    }
    await this.write(boxId, () =>
      this.deps.messagesStore.cacheDetail(
        boxId,
        { ...detail, attachmentsUnavailable: value },
        this.now(),
      ),
    );
  }

  /**
   * Fetch the signed original of a message the archive already holds - one downloaded before originals
   * were kept, or whose .zfo has gone from the device (004 amendment). NEVER throws.
   *
   * Only ever called from the user's tap: opening a message makes no ISDS call, and neither does this
   * until asked. The attachments on disk are not touched, and an original already here is not replaced.
   */
  async fetchSignedOriginal(
    account: DataBoxAccount,
    messageId: string,
    folder: MessageFolder,
    signal: AbortSignal,
    onProgress?: (receivedBytes: number) => void,
  ): Promise<SignedOriginalOutcome> {
    return this.forBox(account.boxId, signal, s =>
      this.downloadSignedOriginal(account, messageId, folder, s, onProgress),
    );
  }

  private async downloadSignedOriginal(
    account: DataBoxAccount,
    messageId: string,
    folder: MessageFolder,
    signal: AbortSignal,
    onProgress?: (receivedBytes: number) => void,
  ): Promise<SignedOriginalOutcome> {
    const store = this.deps.messagesStore;
    const files = this.deps.attachmentFiles;
    if (signal.aborted) {
      return { kind: 'error', messageKey: 'messages.error.load' };
    }
    try {
      const cached = await store.getDetail(account.boxId, messageId);
      if (cached == null || files == null) {
        return { kind: 'error', messageKey: 'detail.original.fetchFailed' };
      }
      if ((await this.heldOriginal(cached)) != null) {
        return { kind: 'saved', detail: cached };
      }
      const { password, sessionCookie } = await this.credentials(account, signal);
      const result = await this.deps.transport.downloadSignedMessage({
        host: account.host,
        authMethod: account.authMethod,
        sessionCookie,
        loginName: account.loginName,
        password,
        messageId,
        signedSent: folder === 'sent',
        signal,
      });
      if (result.type === 'authFault') {
        return { kind: 'reauth' };
      }
      let original: SignedOriginal | null = null;
      // What ISDS answered, when it answered. Only `gone` (1219, the code ISDS documents for a deleted
      // message) may record the message as gone. Any other refusal - and until 2026-09-15 every one
      // counted, 1222 and a paused VoDZ service (3013) included - and an outage or a broken transfer
      // past the retention window are failures to retry.
      let answer: SignedMessageResult['type'] | VodzSignedZfoResult['type'] = result.type;
      if (result.type === 'signed') {
        const signedZfo = result.signedZfo;
        original = await this.write(account.boxId, () =>
          files.persistSignedZfo(account.boxId, messageId, signedZfo),
        );
        if (original == null) {
          return { kind: 'error', messageKey: 'detail.original.writeFailed' };
        }
      } else if (result.type === 'unsupported' && this.deps.vodzDownloader != null) {
        const downloader = this.deps.vodzDownloader;
        const big = await this.write(account.boxId, () =>
          downloader.downloadSignedZfo({
            host: account.host,
            authMethod: account.authMethod,
            loginName: account.loginName,
            password,
            // The box's own session, never the shared jar's (018 T015).
            sessionCookie,
            boxId: account.boxId,
            messageId,
            sent: folder === 'sent',
            signal,
            onProgress,
          }),
        );
        if (big.type === 'authFault') {
          return { kind: 'reauth' };
        }
        original = big.type === 'zfo' ? big.original : null;
        answer = big.type;
      }
      if (original == null) {
        if (answer === 'gone') {
          return this.originalGone(account.boxId, messageId, cached);
        }
        return {
          kind: 'error',
          messageKey: answer === 'refused' ? 'detail.original.refused' : 'detail.original.fetchFailed',
        };
      }
      // Re-read rather than write back what was read before the download: the attachments may have
      // been downloaded again meanwhile, and this must not put the old list back.
      const latest = (await store.getDetail(account.boxId, messageId)) ?? cached;
      const detail = { ...latest, signedZfo: original };
      await this.write(account.boxId, () => store.cacheDetail(account.boxId, detail, this.now()));
      this.deps.onArchiveChanged?.();
      return { kind: 'saved', detail };
    } catch (e: unknown) {
      return this.mapError(e, signal, 'isds.download');
    }
  }

  /**
   * ISDS answered 1219 for the original: it has deleted the message. Past the retention window that is
   * recorded - the same flag a download that ISDS answers 1219 sets (`attachmentsGone`) - so nothing
   * offers it again. Within the window it contradicts ISDS's own documentation, so it stays a refusal
   * with a retry (`pastRetention`).
   */
  private async originalGone(
    boxId: string,
    messageId: string,
    cached: MessageDetail,
  ): Promise<SignedOriginalOutcome> {
    if (!(await this.pastRetention(boxId, messageId))) {
      return { kind: 'error', messageKey: 'detail.original.refused' };
    }
    const detail = { ...cached, attachmentsUnavailable: true };
    await this.write(boxId, () => this.deps.messagesStore.cacheDetail(boxId, detail, this.now()));
    return { kind: 'gone', detail };
  }

  /** Whether a file is on disk - false, rather than a throw, when the question cannot be answered. */
  private async fileExists(path: string): Promise<boolean> {
    try {
      return (await this.deps.attachmentFiles?.exists(path)) ?? true;
    } catch {
      return false;
    }
  }

  /** The original a detail records, when its file is still on disk. That one is never replaced. */
  private async heldOriginal(detail: MessageDetail): Promise<SignedOriginal | null> {
    const original = detail.signedZfo;
    return original != null && (await this.fileExists(original.localPath)) ? original : null;
  }

  /**
   * Which signed original a detail being cached records (004 amendment).
   *
   * The one the archive already holds, while its file is still there - an original is never
   * overwritten (Principle IV), and a later download of the same message is not a better copy of it.
   * Otherwise the one that just arrived, written to disk. Never the base64 itself.
   */
  private async originalToRecord(
    boxId: string,
    messageId: string,
    detail: MessageDetail,
    arrived: string | undefined,
  ): Promise<SignedOriginal | undefined> {
    const files = this.deps.attachmentFiles;
    const recorded =
      detail.signedZfo ??
      (await this.deps.messagesStore.getDetail(boxId, messageId))?.signedZfo;
    if (arrived == null || files == null) {
      return recorded;
    }
    if (recorded != null && (await this.fileExists(recorded.localPath))) {
      return recorded;
    }
    return (await files.persistSignedZfo(boxId, messageId, arrived)) ?? recorded;
  }

  /**
   * Write a detail's attachments - and the signed original that came with it - to disk, cache the
   * (now small) metadata, return the persisted detail.
   */
  private async persistAndCache(
    boxId: string,
    messageId: string,
    detail: MessageDetail,
    arrivedOriginal?: string,
  ): Promise<MessageDetail> {
    // One write of the box: its files and the row naming them land together before a removal clears
    // the box, or not at all (`BoxWork`).
    const persisted = await this.write(boxId, async () => {
      const attachments =
        this.deps.attachmentFiles != null
          ? await this.deps.attachmentFiles.persist(
              boxId,
              messageId,
              detail.attachments,
            )
          : detail.attachments;
      const written: MessageDetail = { ...detail, attachments };
      const signedZfo = await this.originalToRecord(boxId, messageId, detail, arrivedOriginal);
      if (signedZfo != null) {
        written.signedZfo = signedZfo;
      }
      await this.deps.messagesStore.cacheDetail(boxId, written, this.now());
      return written;
    });
    // A downloaded document changes what a restore would bring back (its metadata, at this tier).
    this.deps.onArchiveChanged?.();
    return persisted;
  }

  /**
   * Mark a message read (called when its detail is opened). NEVER throws and is fire-and-forget:
   * tell ISDS (MarkMessageAsDownloaded) and, only if it confirms, flip the cached state to read so
   * the list drops its unread treatment. A failure (offline / session expired / server) is swallowed
   * - the read state stays the server's truth and the next live sync reconciles it. Manages its own
   * (un-aborted) signal so the call still completes if the user immediately navigates away. Resolves
   * `true` iff the message was newly marked read (so the caller can decrement the box's unread badge).
   */
  async markRead(account: DataBoxAccount, messageId: string): Promise<boolean> {
    // Record the LOCAL fact first, and unconditionally. It needs no network and no permission: the
    // user has opened this message, which is true whatever ISDS says next. Without it, reading eight
    // messages offline left the attention group at eight, because the group keys off `state` and
    // `state` only moves when the server confirms (2026-09-09 critique).
    try {
      await this.deps.messagesStore.markOpenedLocally(
        account.boxId,
        messageId,
        this.now(),
      );
    } catch {
      // A local convenience. Never let it interfere with the call below.
    }
    // No signal of the screen's: marking an opened message read may wait for the unlock if the app
    // locks first. Only the box's removal stops it (`forBox`).
    return this.forBox(account.boxId, undefined, async signal => {
      try {
        const { password, sessionCookie } = await this.credentials(account, signal);
        const result = await this.deps.transport.markMessageAsDownloaded({
          host: account.host,
          authMethod: account.authMethod,
          sessionCookie,
          loginName: account.loginName,
          password,
          messageId,
          signal,
        });
        // Not a guarded write: it only updates a row, and a row the removal has deleted stays deleted.
        if (result.type === 'ok') {
          await this.deps.messagesStore.markRead(account.boxId, messageId);
          return true;
        }
      } catch (e) {
        // Still best-effort - never surfaces to the user - but no longer invisible to us. A box whose
        // read receipts silently stop working looks, from the outside, like unread counts that never
        // go down. Not when the box's removal stopped it: an abort is the app working (`mapError`),
        // and this one was reported as read receipts failing.
        if (!signal.aborted) {
          reportFailure('isds.markRead', e, { stage: 'transport' });
        }
      }
      return false;
    });
  }

  /**
   * Fetch a box's PDZ credit balance (CZK) for display on the overview. NEVER throws and is
   * best-effort: returns the balance on success, or null when the box has no PDZ facility, the
   * session expired, or the network failed - so a missing credit never blocks or breaks a refresh.
   */
  async getCredit(
    account: DataBoxAccount,
    signal: AbortSignal,
  ): Promise<number | null> {
    return this.forBox(account.boxId, signal, async s => {
      try {
        const { password, sessionCookie } = await this.credentials(account, s);
        const result = await this.deps.transport.getCreditInfo({
          host: account.host,
          authMethod: account.authMethod,
          sessionCookie,
          loginName: account.loginName,
          password,
          boxId: account.boxId,
          signal: s,
        });
        return result.type === 'credit' ? result.balanceCzk : null;
      } catch (e) {
        // A call that was stopped - by its box's removal, or by the caller - is not a failure
        // (`mapError`): a removal during a refresh was reported as the credit service failing.
        if (!s.aborted) {
          reportFailure('isds.credit', e, { stage: 'transport' });
        }
        return null;
      }
    });
  }

  /**
   * Drop a removed box's offline archive: its rows, and the files they pointed at.
   *
   * The files go too since 2026-09-14 (004 amendment). They used to be left on disk "on purpose", but
   * once the rows naming them are gone nothing in the app can reach them, and the removal dialog
   * (`box.removeMessage`) tells the user the box's downloaded messages and attachments are deleted.
   * Keeping them broke that promise in private: unreachable copies of government mail, and now of its
   * signed originals, left in the app's storage.
   */
  async clearBoxCache(boxId: string): Promise<void> {
    // After the writes of the box already under way. Its removal has aborted them and refuses new
    // ones, so this waits only for what got in before it - which would otherwise land after the
    // clear and stay (`BoxWork`).
    await this.deps.work?.settled(boxId);
    try {
      await this.deps.messagesStore.clearBox(boxId);
    } finally {
      // The files go even when the rows would not. This runs once the box itself is gone
      // (`removeBox`), so nothing reaches them either way; kept back, they were mail left on the
      // device because an unrelated table was busy. The rows' failure still fails the step, and the
      // removal's retry clears them.
      try {
        await this.deps.attachmentFiles?.removeForBox(boxId);
      } catch (e) {
        // The box is removed either way; files that would not delete are litter, not a reason to fail
        // the removal. Reported, because this litter is somebody's mail.
        reportFailure('file.write', e, { stage: 'native' });
      }
    }
  }

  // Password boxes re-auth with HTTP Basic; OTP and Mobile Key boxes ride their own session cookie
  // (no password sent). Both come from the vault at call time and never from the account (001 T028):
  // an absent or lost secret is null, which the transport answers as an auth fault, and one that
  // cannot be read right now throws `CredentialsUnavailableError` - a retry, never a re-auth.
  private credentials(
    account: DataBoxAccount,
    signal?: AbortSignal,
  ): Promise<{ password: string | null; sessionCookie: string | null }> {
    return credentialsFor(this.deps.secureStore, account, signal);
  }

  /** One call of a box, under a signal its removal aborts too (`BoxWork.run`). */
  private forBox<T>(
    boxId: string,
    signal: AbortSignal | undefined,
    work: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const boxes = this.deps.work;
    if (boxes == null) {
      return work(signal ?? new AbortController().signal);
    }
    return boxes.run(boxId, signal, work);
  }

  /** One write of a box's archive or files, refused for a box being removed or gone (`BoxWork.write`). */
  private write<T>(boxId: string, work: () => Promise<T>): Promise<T> {
    const boxes = this.deps.work;
    return boxes == null ? work() : boxes.write(boxId, work);
  }

  // Map a thrown low-level error to the shared recoverable error outcome (never crashes - SC-002).
  /**
   * Turn a thrown transport error into the localized state the screen shows - and report it.
   *
   * The reporting lives here rather than at the three `catch` blocks that call it because this is
   * where the app already decides what KIND of failure it was, and that decision is exactly what a
   * report needs. Nothing about the returned state changes; the caller's degradation is untouched.
   *
   * An abort is deliberately NOT reported. The user navigating away or switching folders cancels the
   * in-flight call, which is the app working, not failing - and it is by far the most common thing
   * to land here. Reporting it would bury every real fault under noise.
   */
  private mapError(
    e: unknown,
    signal: AbortSignal,
    op: Op = 'isds.listReceived',
  ): { kind: 'error'; messageKey: string } {
    if (e instanceof CredentialsUnavailableError) {
      // Ahead of the abort check: a read abandoned while the app was locked has an aborted signal too,
      // and `messages.error.load` would read as a lost session to `classifyFailure` for a cookie box.
      // Not a transport failure either, and already reported where the Keychain refused.
      return { kind: 'error', messageKey: 'messages.error.credentials' };
    }
    // A write refused for a box being removed is the same non-event as an abort: its removal asked for
    // it, and nothing failed.
    if (e instanceof BoxGoneError || signal.aborted || (e instanceof Error && e.name === 'AbortError')) {
      return { kind: 'error', messageKey: 'messages.error.load' };
    }
    reportFailure(op, e, {
      stage: 'transport',
      errorClass: e instanceof Error ? e.name : typeof e,
    } as never);
    if (e instanceof TransportTimeoutError) {
      return { kind: 'error', messageKey: 'messages.error.timeout' };
    }
    if (e instanceof TransportNetworkError) {
      return { kind: 'error', messageKey: 'messages.error.network' };
    }
    return { kind: 'error', messageKey: 'messages.error.load' };
  }
}
