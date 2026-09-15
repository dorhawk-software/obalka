// ISDS transport boundary (feature 001).
//
// This interface abstracts the actual ISDS SOAP/HTTP calls so the login orchestration
// (`AuthService`) and the state machine can be unit-tested with a fake. The real, device-bound
// implementation (native `fetch` to czebox/prod access points, cookie handling, SOAP envelopes)
// implements this same interface in a later task (T011/T017/T030) without changing any caller.
//
// Convention: business outcomes are returned as a typed `TransportResult`. Low-level failures
// (no network, timeout, cancellation) are THROWN as the typed errors below; `AuthService` catches
// them and maps every one to a recoverable `LoginOutcome` (so nothing ever crashes - SC-002).

import type {
  AuthMethod,
  Host,
  MessageDetail,
  MessageEnvelope,
  OutgoingDocument,
  OwnerInfo,
  Recipient,
  ServerNotice,
} from './types';

/** Typed business outcomes from an ISDS auth call. */
export type TransportResult =
  | {
      type: 'success';
      ownerInfo: OwnerInfo;
      /**
       * The session this login established, as a `Cookie:` header value (018) - present for
       * cookie-authenticated boxes (OTP, Mobile Key), absent for password boxes, which hold no
       * session and re-authenticate per call.
       *
       * Returned rather than left in the native jar on purpose: the jar is per DOMAIN, so leaving it
       * there is what let a second box's login overwrite a first box's identity.
       */
      sessionCookie?: string | null;
    } // authenticated + owner info fetched
  | { type: 'otpSmsSent'; notice?: ServerNotice } // TOTP partial success - SMS dispatched, code next
  | { type: 'authFault' } // wrong login name / password
  | { type: 'otpFault' } // wrong or expired one-time code
  | { type: 'smsNotDelivered' } // SMS could not be sent
  | { type: 'passwordChangeRequired' } // ISDS forces a password change
  | { type: 'serverFault' }; // ISDS-side error (SOAP fault, 5xx)

/** Typed outcome of a message-list call. `authFault` (401) means the session expired → re-auth. */
export type MessageListResult =
  | { type: 'messages'; messages: MessageEnvelope[] }
  | { type: 'authFault' }
  | { type: 'serverFault' };

/** Typed outcome of a message-download call. `authFault` (401) means the session expired → re-auth. */
export type MessageDetailResult =
  | {
      type: 'detail';
      detail: MessageDetail;
      /**
       * The message as ISDS sealed it: `dmSignature`, base64 - the bytes of its .zfo (004 amendment).
       * Absent when only the unsigned download could serve the detail, which is a message without its
       * original, not a failure.
       */
      signedZfo?: string;
    }
  | { type: 'authFault' }
  // The message can't be served by this download service - a large-volume (VoDZ, >20 MB) message that
  // only the large-volume service can deliver (dmStatusCode 1281, received or sent). Distinct so the UI
  // can explain it honestly.
  | { type: 'unsupported' }
  /** ISDS answered `1219`: it has deleted the message (`STATUS_MESSAGE_DELETED`). */
  | { type: 'gone' }
  /** ISDS answered with some other status than `0000`/`1281`/`1219` - no, but not "deleted". */
  | { type: 'refused' }
  | { type: 'serverFault' };

/** Typed outcome of fetching ONLY the signed original of a message (004 amendment). */
export type SignedMessageResult =
  | { type: 'signed'; signedZfo: string }
  | { type: 'authFault' }
  /** A large-volume (VoDZ) message: only `SignedBigMessageDownload` on ws2 has its original. */
  | { type: 'unsupported' }
  /**
   * ISDS answered `1219`, the code it documents for a message it has deleted. The only result that may
   * lead to a message being recorded as gone.
   */
  | { type: 'gone' }
  /**
   * ISDS answered, and the answer was no - any other `dmStatusCode` than `0000`, `1281` or `1219`. Kept
   * apart from `gone` because ISDS documents none of those codes as a deletion (1222 is a message not
   * delivered yet, 1211 another box's, 3013 a paused VoDZ service), and apart from `serverFault` so the
   * screen can say ISDS refused rather than that it could not be reached.
   */
  | { type: 'refused' }
  | { type: 'serverFault' };

/** Typed outcome of a mark-as-read (MarkMessageAsDownloaded) call. */
export type MessageMarkResult =
  | { type: 'ok' }
  | { type: 'authFault' }
  | { type: 'serverFault' };

/** Typed outcome of a recipient lookup (ISDSSearch3 fulltext, db_search). `authFault` (401) ⇒ re-auth. */
export type FindRecipientsResult =
  | { type: 'recipients'; recipients: Recipient[] }
  | { type: 'authFault' }
  | { type: 'serverFault' };

/** Typed outcome of a CreateMessage send. `sent` carries the new message id (`dmID`). */
export type SendMessageResult =
  | { type: 'sent'; messageId: string }
  | { type: 'recipientRejectsPdz' } // recipient won't accept a commercial (PDZ) message
  | { type: 'insufficientCredit' } // sender box lacks PDZ credit
  | { type: 'authFault' } // session expired → re-auth
  | { type: 'serverFault' };

/** Typed outcome of a DataBoxCreditInfo lookup (the sender box's PDZ credit balance, in CZK). */
export type CreditInfoResult =
  | { type: 'credit'; balanceCzk: number }
  | { type: 'authFault' }
  | { type: 'serverFault' };

export interface ListMessagesArgs {
  host: Host;
  /** 'password' boxes re-authenticate with HTTP Basic; OTP boxes ride the login session cookie. */
  authMethod: AuthMethod;
  loginName: string;
  password: string | null;
  /**
   * THIS box's captured ISDS session, as a `Cookie:` header value (018). Null for password boxes,
   * and null before a cookie box has logged in - in which case the call goes out without one and
   * comes back 401, which is the honest outcome. It is never filled in from the shared native jar:
   * that jar is per domain, and a call wearing another box's session would be showing one person's
   * mail under another person's identity.
   */
  sessionCookie: string | null;
  signal: AbortSignal;
}

export interface DownloadMessageArgs extends ListMessagesArgs {
  /** The `dmID` of the message to download (from a list row). */
  messageId: string;
  /**
   * Sent messages use SignedSentMessageDownload (received-only MessageDownload won't work); received
   * ones SignedMessageDownload (004 amendment).
   */
  signedSent?: boolean;
}

export interface FindRecipientsArgs {
  host: Host;
  authMethod: AuthMethod;
  loginName: string;
  password: string | null;
  /** This box's own ISDS session (018) - see ListMessagesArgs. */
  sessionCookie: string | null;
  /** Free-text query: a box ID (exact) or a name/firm fragment. */
  query: string;
  signal: AbortSignal;
}

export interface SendMessageArgs {
  host: Host;
  authMethod: AuthMethod;
  loginName: string;
  password: string | null;
  /** This box's own ISDS session (018) - see ListMessagesArgs. */
  sessionCookie: string | null;
  recipientBoxId: string;
  subject: string;
  /** ≥1 document; the first/main is `dmFileMetaType="main"`. Content is base64 (encoded off-thread). */
  files: OutgoingDocument[];
  signal: AbortSignal;
}

export interface GetCreditInfoArgs {
  host: Host;
  authMethod: AuthMethod;
  loginName: string;
  password: string | null;
  /** This box's own ISDS session (018) - see ListMessagesArgs. */
  sessionCookie: string | null;
  boxId: string;
  signal: AbortSignal;
}

export interface PasswordLoginArgs {
  loginName: string;
  password: string;
  host: Host;
  signal: AbortSignal;
}

export interface OtpBeginArgs extends PasswordLoginArgs {
  method: 'otp_totp';
}

export interface OtpSubmitArgs {
  loginName: string;
  password: string;
  code: string;
  method: 'otp_totp';
  host: Host;
  signal: AbortSignal;
}

export interface MobileKeyLoginArgs {
  loginName: string;
  /** Portal-generated "komunikační kód" - the Basic-auth password (NOT the account password). */
  communicationCode: string;
  /** Shown in the user's Mobile Key push so they know which app is requesting access. */
  applicationName: string;
  host: Host;
  signal: AbortSignal;
}

export interface MobileKeyPollArgs {
  host: Host;
  signal: AbortSignal;
}

/**
 * One `mepWsStateUpdate2` poll value. `status` 2 = confirmed (signed in); 3 = rejected/timed-out;
 * 1/11/12/13 = in progress; 19 = push failed; -1 = unknown request. `description` is the server's text.
 */
export type MobileKeyPollResult =
  | { type: 'state'; status: number; description: string }
  | { type: 'serverFault' };

/** Result of the Mobile Key init POST: `pending` = S-COOKIE set + push dispatched (poll next). */
export type MobileKeyBeginResult =
  | { type: 'pending' }
  | { type: 'authFault' } // wrong login name / communication code (401)
  | { type: 'serverFault' };

export interface IsdsTransport {
  /** Username+password: authenticate against `/DS/dz` (HTTP Basic) and fetch owner info. */
  passwordLogin(args: PasswordLoginArgs): Promise<TransportResult>;
  /** Begin an SMS-code login: triggers the SMS (`sendSms=true`) and resolves `otpSmsSent`. */
  otpBegin(args: OtpBeginArgs): Promise<TransportResult>;
  /** Submit the OTP code via `as/processLogin`, completing login and fetching owner info. */
  otpSubmit(args: OtpSubmitArgs): Promise<TransportResult>;
  /** Re-request a TOTP SMS. */
  resendSms(args: PasswordLoginArgs): Promise<TransportResult>;
  /**
   * Mobile Key step 1: POST `as/processLogin?type=mep-ws` (Basic = loginName:communicationCode) →
   * a working S-COOKIE; ISDS pushes the user's Mobile Key app for approval. `pending` on success.
   */
  mepBegin(args: MobileKeyLoginArgs): Promise<MobileKeyBeginResult>;
  /** Mobile Key step 2: poll the login status (`mepWsStateUpdate2`) until status 2 / 3 / timeout. */
  mepPoll(args: MobileKeyPollArgs): Promise<MobileKeyPollResult>;
  /**
   * Mobile Key step 3 (only after a status-2 poll): POST `type=mep-ws` again → the `IPCZ-X-COOKIE`
   * WS session, then fetch owner info - exactly like {@link otpSubmit}'s second half.
   */
  mepConfirm(args: MobileKeyLoginArgs): Promise<TransportResult>;
  /**
   * A sign-in ended before the request that signs in - its first step refused or failed, an SMS
   * requested and no code entered, a Mobile Key request declined, timed out or cancelled, a failed
   * status poll. Empties the shared cookie jar of that half-finished handshake. Never throws.
   */
  abandonLogin(): Promise<void>;
  /** List received messages for the box (GetListOfReceivedMessages at `/DS/dx`). */
  listReceivedMessages(args: ListMessagesArgs): Promise<MessageListResult>;
  /**
   * Download a full message + its attachments at `/DS/dz`: the signed download for both folders, with
   * MessageDownload behind a received one whose original cannot be read (004 amendment).
   */
  downloadMessage(args: DownloadMessageArgs): Promise<MessageDetailResult>;
  /** Only a message's signed original, unparsed (004) - for a message downloaded before they were kept. */
  downloadSignedMessage(args: DownloadMessageArgs): Promise<SignedMessageResult>;
  /** Mark a message as read/downloaded (MarkMessageAsDownloaded at `/DS/dx`). */
  markMessageAsDownloaded(
    args: DownloadMessageArgs,
  ): Promise<MessageMarkResult>;
  /** Look up recipient data boxes by name/ID (fulltext ISDSSearch3, all box types, at `/DS/df`). */
  findRecipients(args: FindRecipientsArgs): Promise<FindRecipientsResult>;
  /** Send a data message (CreateMessage at dmOperations `/DS/dz`). Returns the new `dmID` on success. */
  sendMessage(args: SendMessageArgs): Promise<SendMessageResult>;
  /**
   * Send a LARGE-volume (VoDZ) message at the separate `ws2` `/vdz_ws/` service: upload each file
   * (`UploadAttachment`) then `CreateBigMessage`. Same typed outcomes as {@link sendMessage}. Used for
   * payloads over the ordinary ~20 MB limit (≤ 100 MB). See `contracts/isds-bigmessage.md`.
   */
  sendBigMessage(args: SendMessageArgs): Promise<SendMessageResult>;
  /** The sender box's PDZ credit balance in CZK (DataBoxCreditInfo at db_search `/DS/df`). */
  getCreditInfo(args: GetCreditInfoArgs): Promise<CreditInfoResult>;
  /** List SENT messages (GetListOfSentMessages at `/DS/dx`) - used to reconcile after a timeout. */
  getSentMessages(args: ListMessagesArgs): Promise<MessageListResult>;
}

/** Thrown by a transport when the network is unreachable. Mapped to `LoginErrorCode.network`. */
export class TransportNetworkError extends Error {
  constructor(message = 'network error') {
    super(message);
    this.name = 'TransportNetworkError';
  }
}

/** Thrown by a transport when a request times out. Mapped to `LoginErrorCode.timeout`. */
export class TransportTimeoutError extends Error {
  constructor(message = 'timeout') {
    super(message);
    this.name = 'TransportTimeoutError';
  }
}
