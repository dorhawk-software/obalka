// SendController (feature 005). Recipient lookup, cost estimation, and sending a message. Like the
// other controllers it NEVER throws - every path resolves to a typed outcome (Principle II). Pure
// orchestration over injected deps → unit-tested with fakes.
//
// Recipient lookup uses fulltext ISDSSearch3 (all box types); the cost model is shown live (free for
// an OVM, paid PDZ otherwise). `send()` enforces the no-silent-spend invariant: a paid send needs
// explicit confirmation. (Producing the documents' base64 off-thread + the picker are upstream of
// this controller - it receives ready `OutgoingDocument`s.)

import {
  CreditInfoResult,
  FindRecipientsArgs,
  FindRecipientsResult,
  GetCreditInfoArgs,
  ListMessagesArgs,
  MessageListResult,
  SendMessageArgs,
  SendMessageResult,
  TransportNetworkError,
  TransportTimeoutError,
} from '../../../services/isds/transport';
import {
  CredentialsUnavailableError,
  credentialsFor,
  type SecureStore,
} from '../../../services/secureStore/secureStore';
import { reportFailure } from '../../../services/telemetry/telemetry';
import type {
  CostEstimate,
  CreditInfo,
  DataBoxAccount,
  Host,
  OutgoingDocument,
  Recipient,
} from '../../../services/isds/types';
import { classifyCost, type SizedAttachment } from './costModel';

export type SearchOutcome =
  | { kind: 'recipients'; recipients: Recipient[] }
  | { kind: 'reauth' } // session expired (401) - the box must sign in again
  | { kind: 'error'; messageKey: string };

/** A composed message ready to send. */
export interface OutgoingMessage {
  recipient: Recipient;
  subject: string;
  files: OutgoingDocument[];
}

/** Post-send delivery/acceptance state of a sent message, read back from the box's SENT list. */
export interface SentStatus {
  /** `dmDeliveryTime` - when ISDS delivered it to the recipient's box (epoch ms), or null. */
  deliveryTime: number | null;
  /** `dmAcceptanceTime` - when the recipient accepted/read it (epoch ms), or null (not yet). */
  acceptanceTime: number | null;
  /** `dmMessageStatus` (1–10). */
  state: number;
}

export type SendOutcome =
  // `reconciled` ⇒ a prior (timed-out) attempt had actually gone through; we did NOT re-send.
  | { kind: 'sent'; messageId: string; reconciled?: boolean }
  // paid → confirm (no silent spend); carries the estimate + the box's live credit
  | { kind: 'needsConfirmation'; estimate: CostEstimate; credit: CreditInfo }
  | {
      kind: 'blocked';
      reason:
        | 'recipientRejectsPdz'
        | 'pdzDisabled'
        | 'insufficientCredit'
        | 'tooLarge'; // over the VoDZ limit (VODZ_MAX_BYTES, 100 MB); 20–100 MB already goes out as a big message
    }
  | { kind: 'reauth' }
  // `ambiguous` ⇒ the request may have been delivered (a timeout) - a retry should reconcile first.
  | { kind: 'error'; messageKey: string; ambiguous?: boolean };

/** The slice of the transport the controller needs (IsdsHttpTransport satisfies it structurally). */
export interface SendTransport {
  findRecipients(args: FindRecipientsArgs): Promise<FindRecipientsResult>;
  sendMessage(args: SendMessageArgs): Promise<SendMessageResult>;
  sendBigMessage(args: SendMessageArgs): Promise<SendMessageResult>;
  getCreditInfo(args: GetCreditInfoArgs): Promise<CreditInfoResult>;
  getSentMessages(args: ListMessagesArgs): Promise<MessageListResult>;
}

export interface SendControllerDeps {
  transport: SendTransport;
  /** The box's password and session, read at call time; a read waits while the app is locked (001 T028). */
  secureStore: Pick<SecureStore, 'readPassword' | 'readSession'>;
  host?: Host;
  now?: () => number;
}

/** Window for reconciling a possibly-sent message after a timeout (a message sent "just now"). */
const RECONCILE_WINDOW_MS = 15 * 60 * 1000;

export class SendController {
  private readonly now: () => number;
  /**
   * The sends running now, by box and message, until each settles (audit 2026-09-23).
   *
   * ISDS has no idempotency key, so two `send` calls that overlap are two official messages - and,
   * for a PDZ, two charges. The compose screen guards its own button, but a controller cannot assume
   * every caller does, and a double tap is exactly the case where the caller's state is a render
   * behind. So a second call for the same message from the same box, while the first is still
   * running, never reaches the transport: it JOINS the running send and gets its outcome.
   *
   * "The same message" is the recipient and the subject - the identity `findRecentSent` already
   * reconciles a timed-out send by, for the same reason. Not the documents: a typed body is rendered
   * to a fresh PDF on every press, so a double tap never carries byte-identical files. A DIFFERENT
   * message from the same box is not held back; answering it with another message's outcome would
   * report as sent something that never left.
   */
  private readonly sending = new Map<string, Promise<SendOutcome>>();

  constructor(private readonly deps: SendControllerDeps) {
    this.now = deps.now ?? (() => Date.now());
  }

  /**
   * Look up recipient boxes for `query` (a box ID or a name). NEVER throws: a session expiry returns
   * `reauth`, any other failure a localized `error`; an empty/blank query or no match is an empty list.
   */
  async searchRecipients(
    account: DataBoxAccount,
    query: string,
    signal: AbortSignal,
  ): Promise<SearchOutcome> {
    if (query.trim() === '' || signal.aborted) {
      return { kind: 'recipients', recipients: [] };
    }
    try {
      const { password, sessionCookie } = await this.credentials(account, signal);
      const result = await this.deps.transport.findRecipients({
        host: account.host,
        authMethod: account.authMethod,
        sessionCookie,
        loginName: account.loginName,
        password,
        query,
        signal,
      });
      switch (result.type) {
        case 'recipients':
          return { kind: 'recipients', recipients: result.recipients };
        case 'authFault':
          return { kind: 'reauth' };
        default:
          return { kind: 'error', messageKey: 'send.error.search' };
      }
    } catch (e: unknown) {
      reportFailure('isds.send', e, { stage: 'transport' });
      return this.mapError(e);
    }
  }

  /** Pure cost estimate for a chosen recipient + attachments (free for OVM, paid PDZ otherwise). */
  estimate(
    recipient: Recipient,
    attachments: readonly SizedAttachment[] = [],
  ): CostEstimate {
    return classifyCost(recipient.dbType, attachments);
  }

  /**
   * Send `message` from `account`. NEVER throws. A FREE (OVM) send goes straight through. A PAID (PDZ)
   * send is gated: the recipient must accept PDZ, the box must have enough credit, and the user must
   * confirm - `send()` returns `blocked`/`needsConfirmation` (with the live credit) and only spends
   * once `confirmedPaid: true` is passed (the no-silent-spend invariant, Principle II). Requires ≥1
   * document (ISDS rejects an empty message).
   *
   * Single-flight per box and message: a call made while the same message is still being sent from
   * the same box joins that send - the same promise, the same outcome - rather than sending again (see
   * `sending`). The free, the paid and the large-volume (VoDZ) track all go through here.
   */
  send(
    account: DataBoxAccount,
    message: OutgoingMessage,
    signal: AbortSignal,
    opts: { confirmedPaid?: boolean; reconcileFirst?: boolean } = {},
  ): Promise<SendOutcome> {
    // The environment is part of the box: a test box and a production box are different boxes. JSON
    // rather than a joined string, so no subject can be spelled to collide with another key.
    const key = JSON.stringify([
      account.host,
      account.boxId,
      message.recipient.boxId,
      message.subject,
    ]);
    const running = this.sending.get(key);
    if (running) {
      return running;
    }
    // Claimed before anything awaits, so a call arriving in the same tick already finds it.
    const run = this.sendNow(account, message, signal, opts);
    this.sending.set(key, run);
    const release = () => {
      if (this.sending.get(key) === run) {
        this.sending.delete(key);
      }
    };
    // `sendNow` never rejects, but the claim must end even if that ever changes.
    run.then(release, release);
    return run;
  }

  private async sendNow(
    account: DataBoxAccount,
    message: OutgoingMessage,
    signal: AbortSignal,
    opts: { confirmedPaid?: boolean; reconcileFirst?: boolean },
  ): Promise<SendOutcome> {
    if (message.files.length === 0) {
      return { kind: 'error', messageKey: 'send.error.noDocument' };
    }
    const estimate = classifyCost(message.recipient.dbType, message.files);
    // Over even the VoDZ ceiling (100 MB) → genuinely unsupported; block clearly instead of letting
    // the send fail opaquely (Principle II). 20–100 MB still sends, via the VoDZ track below.
    if (estimate.oversize) {
      return { kind: 'blocked', reason: 'tooLarge' };
    }
    // NO DOUBLE CHARGE (Principle II): a prior attempt may have timed out AFTER ISDS charged + created
    // the message. Before re-sending, reconcile against the sent list - if our message is already there
    // (same subject, sent just now), report it sent instead of charging again.
    if (opts.reconcileFirst) {
      const reconciledId = await this.findRecentSent(account, message, signal);
      if (reconciledId) {
        return { kind: 'sent', messageId: reconciledId, reconciled: true };
      }
    }
    if (estimate.paid && opts.confirmedPaid !== true) {
      // The recipient must accept commercial messages at all (free, no network).
      if (!message.recipient.acceptsPdz) {
        return { kind: 'blocked', reason: 'recipientRejectsPdz' };
      }
      // Fetch the sender's credit to gate + show before any spend.
      let credit: CreditInfoResult;
      try {
        const { password, sessionCookie } = await this.credentials(account, signal);
        credit = await this.deps.transport.getCreditInfo({
          host: account.host,
          authMethod: account.authMethod,
          sessionCookie,
          loginName: account.loginName,
          password,
          boxId: account.boxId,
          signal,
        });
      } catch (e: unknown) {
        return this.mapError(e, 'send.error.send');
      }
      if (credit.type === 'authFault') {
        return { kind: 'reauth' };
      }
      if (credit.type !== 'credit') {
        return { kind: 'blocked', reason: 'pdzDisabled' };
      }
      if (credit.balanceCzk < (estimate.approxCzk ?? 0)) {
        return { kind: 'blocked', reason: 'insufficientCredit' };
      }
      return {
        kind: 'needsConfirmation',
        estimate,
        credit: {
          boxId: account.boxId,
          balanceCzk: credit.balanceCzk,
          pdzEnabled: true,
        },
      };
    }
    try {
      // The large-volume track included: `sendBigMessage` gets the same box session from the vault as
      // the ordinary send (018 T006, 001 T028).
      const { password, sessionCookie } = await this.credentials(account, signal);
      const args = {
        host: account.host,
        authMethod: account.authMethod,
        sessionCookie,
        loginName: account.loginName,
        password,
        recipientBoxId: message.recipient.boxId,
        subject: message.subject,
        files: message.files,
        signal,
      };
      // Over the ordinary ~20 MB limit ⇒ the VoDZ large-volume track (separate ws2 service); else the
      // ordinary CreateMessage. Both honour the paid/no-silent-spend/no-double-charge gates above.
      const result = estimate.bigMessage
        ? await this.deps.transport.sendBigMessage(args)
        : await this.deps.transport.sendMessage(args);
      switch (result.type) {
        case 'sent':
          return { kind: 'sent', messageId: result.messageId };
        case 'authFault':
          return { kind: 'reauth' };
        case 'recipientRejectsPdz':
          return { kind: 'blocked', reason: 'recipientRejectsPdz' };
        case 'insufficientCredit':
          return { kind: 'blocked', reason: 'insufficientCredit' };
        default:
          return { kind: 'error', messageKey: 'send.error.send' };
      }
    } catch (e: unknown) {
      // The user pressed Odeslat and it did not go. Whatever the screen tells them, this one is
      // always worth knowing about: sending is the only action in the app that spends their money.
      reportFailure('isds.send', e, { stage: 'transport' });
      const mapped = this.mapError(e, 'send.error.send');
      // A timeout AFTER firing CreateMessage is ambiguous: ISDS may have charged + created the message
      // even though we never saw the response. Flag it so a retry reconciles first (no double charge).
      return e instanceof TransportTimeoutError
        ? { ...mapped, ambiguous: true }
        : mapped;
    }
  }

  /**
   * Look in the box's SENT list for a message that matches `message` and was sent within the last
   * {@link RECONCILE_WINDOW_MS} - i.e. a send that likely went through despite a timeout. Returns its
   * `dmID`, or null if none matches (or the lookup fails - then the caller proceeds to a normal send).
   * Match is by recipient box + subject (ISDS has no client idempotency key), newest first.
   */
  private async findRecentSent(
    account: DataBoxAccount,
    message: OutgoingMessage,
    signal: AbortSignal,
  ): Promise<string | null> {
    let result: MessageListResult;
    try {
      const { password, sessionCookie } = await this.credentials(account, signal);
      result = await this.deps.transport.getSentMessages({
        host: account.host,
        authMethod: account.authMethod,
        sessionCookie,
        loginName: account.loginName,
        password,
        signal,
      });
    } catch {
      return null; // can't reconcile → let the caller fall through to a normal send attempt
    }
    if (result.type !== 'messages') {
      return null;
    }
    const cutoff = this.now() - RECONCILE_WINDOW_MS;
    const match = result.messages
      .filter(
        m =>
          m.recipientBoxId === message.recipient.boxId &&
          m.subject === message.subject &&
          m.deliveryTime != null &&
          m.deliveryTime >= cutoff,
      )
      // newest first (parseMessageList already sorts, but be explicit about which we pick)
      .sort((a, b) => (b.deliveryTime ?? 0) - (a.deliveryTime ?? 0))[0];
    return match?.id ?? null;
  }

  /**
   * Best-effort: read the just-sent message's current delivery/acceptance state from the box's SENT
   * list, for the single post-send confirmation. NEVER throws - returns null on any failure or if the
   * message isn't in the list yet (the caller simply shows nothing extra).
   */
  async fetchSentStatus(
    account: DataBoxAccount,
    messageId: string,
    signal: AbortSignal,
  ): Promise<SentStatus | null> {
    let result: MessageListResult;
    try {
      const { password, sessionCookie } = await this.credentials(account, signal);
      result = await this.deps.transport.getSentMessages({
        host: account.host,
        authMethod: account.authMethod,
        sessionCookie,
        loginName: account.loginName,
        password,
        signal,
      });
    } catch {
      return null;
    }
    if (result.type !== 'messages') {
      return null;
    }
    const env = result.messages.find(m => m.id === messageId);
    return env
      ? {
          deliveryTime: env.deliveryTime,
          acceptanceTime: env.acceptanceTime,
          state: env.state,
        }
      : null;
  }

  // Password boxes re-auth with HTTP Basic; OTP and Mobile Key boxes ride their own session cookie
  // (no password sent). Both come from the vault at call time (001 T028); see `credentialsFor`.
  private credentials(
    account: DataBoxAccount,
    signal?: AbortSignal,
  ): Promise<{ password: string | null; sessionCookie: string | null }> {
    return credentialsFor(this.deps.secureStore, account, signal);
  }

  private mapError(
    e: unknown,
    fallbackKey = 'send.error.search',
  ): { kind: 'error'; messageKey: string } {
    if (e instanceof CredentialsUnavailableError) {
      // The stored secret could not be read right now: a retry, and nothing was sent.
      return { kind: 'error', messageKey: 'send.error.credentials' };
    }
    if (e instanceof TransportTimeoutError) {
      return { kind: 'error', messageKey: 'send.error.timeout' };
    }
    if (e instanceof TransportNetworkError) {
      return { kind: 'error', messageKey: 'send.error.network' };
    }
    return { kind: 'error', messageKey: fallbackKey };
  }
}
