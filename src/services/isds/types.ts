// Core domain types for ISDS accounts & login (feature 001).
// Pure TypeScript - no React Native / native imports, so it is unit-testable off-device.

/** ISDS environment. Dev/test builds MUST use `czebox`; `production` is release-only (Principle VII). */
export type Host = 'czebox' | 'production';

/**
 * Last-refresh failure state persisted per box. `reauth` = the box must sign in again (an expired
 * OTP session, or a password box's now-invalid credentials); `passwordExpired` = a password box was
 * refused after its stored password-expiry date, so the password has to be changed on the portal
 * before signing in again can work (001 FR-009, `mustChangePassword` in `passwordExpiry.ts`);
 * `error` = a transient failure. Persisted so the flag (and the refresh-all skip) survives an app
 * restart.
 *
 * `passwordExpired` is decided at the moment of the failure and stored, rather than re-derived from
 * the date whenever the row is drawn: a box refused BEFORE its date - a password changed on the
 * portal - must not turn into "expired" a week later just because the calendar caught up.
 */
export type SyncFailure = 'reauth' | 'passwordExpired' | 'error';

/**
 * Authentication methods ISDS exposes to third-party apps. `mobile_key` = Mobilní klíč (NIA app push
 * approval); like OTP it rides the portal session cookie for WS calls (not Basic), so anywhere we
 * branch on `=== 'password'` it correctly takes the cookie path.
 */
export type AuthMethod = 'password' | 'otp_totp' | 'mobile_key';

/** Every failure the login flow can surface. All are recoverable and localized; none crash. */
export type LoginErrorCode =
  | 'invalidCredentials'
  | 'invalidOrExpiredOtp'
  | 'smsNotDelivered'
  | 'passwordChangeRequired'
  | 'duplicateBox'
  | 'network'
  | 'timeout'
  | 'serverFault'
  | 'cancelled'
  | 'mobileKeyRejected' // the user declined the Mobile Key push
  | 'mobileKeyTimeout'; // not approved within the 240 s window

/**
 * Lean APP-level projection of a box's identity, returned by a successful authenticated lookup.
 * The raw ISDS wire model is `tDbOwnerInfo` in `./generated/isdsTypes.ts` (auto-generated from the
 * official v20 XSD, `npm run codegen:isds`); the transport maps `dbID → boxId`,
 * `firmName ?? pnLastName → label`, and `GetPasswordInfo → passwordExpiresAt`. Keeping a small app
 * model here decouples the UI/state machine from the full SOAP schema.
 */
/** The box owner's legal form - the same four-way collapse as {@link RecipientDbType}. */
export type BoxType = RecipientDbType;
export interface OwnerInfo {
  /** ISDS data-box ID. */
  boxId: string;
  /** Human-visible name (box owner / name); used as the default account label. */
  label: string;
  /** The box's legal form (`dbType`, collapsed to our four-way type), or null if ISDS omitted it. */
  dbType: BoxType | null;
  /** Epoch ms when the password expires, or null if it does not (OTP/cert accounts). */
  passwordExpiresAt: number | null;
}

/**
 * ISDS `dmMessageStatus` for a READ message (PŘEČTENO). A received message is "unread" at any lower
 * state (delivered/accepted) until it is read; `MarkMessageAsDownloaded` transitions it to this.
 */
export const MESSAGE_STATE_READ = 7;

/**
 * Lean app projection of an ISDS message envelope (`tRecord`) for list rows. The full wire record has
 * ~30 fields; we keep what a list needs. `state` is `dmMessageStatus` (1–10); `attachmentSize` is
 * `dmAttachmentSize` (number of attachments, per ISDS), 0/None when there are none.
 */
export interface MessageEnvelope {
  id: string;
  subject: string;
  sender: string;
  senderAddress: string | null;
  recipient: string | null;
  recipientAddress: string | null;
  /** `dbIDRecipient` - the recipient box ID; lets a sent message be reconciled after a timeout. */
  recipientBoxId: string | null;
  deliveryTime: number | null;
  acceptanceTime: number | null;
  state: number;
  /**
   * `dmAttachmentSize` - the TOTAL size of the attachments in KILOBYTES, and hence the "has
   * attachments" indicator (non-zero ⇒ there are attachments). It is NOT a file count: ISDS gives no
   * count, and no per-file names or sizes, before the whole message is fetched (MessageDownload).
   */
  attachmentSize: number | null;
  /**
   * When the user opened this message on THIS device, or null.
   *
   * Local-only and never sent anywhere. `state` remains the server's truth about delivery; this is
   * the app's own record that the person has in fact looked, which is what lets offline reading
   * quiet the attention group (2026-09-09 critique).
   */
  openedAt?: number | null;
}

/** One attachment of a downloaded message (`dmFile`): metadata + a pointer to the decoded file. */
export interface MessageAttachment {
  name: string; // dmFileDescr
  mimeType: string; // dmMimeType
  metaType: string; // dmFileMetaType: main | enclosure | signature | meta
  /**
   * dmEncodedContent - the inline base64 as it comes off the wire. TRANSIENT: once an attachment is
   * persisted to disk (`localPath` set) this is cleared to ''; `localPath` is the source of truth.
   * Only ever non-empty for a freshly downloaded inline (≤20 MB) attachment before it's written out,
   * or for a legacy cached detail that predates files-on-disk (migrated on next open).
   */
  contentBase64: string;
  /**
   * On-disk path to the decoded file in the app's private storage. Set for every persisted
   * attachment (inline + large-volume VoDZ). When present, the opener reads this file directly.
   */
  localPath?: string;
  /** Byte size of the on-disk file (from `fs.stat` at persist time) - shown in the detail. */
  size?: number;
}

/** A fully downloaded message: envelope detail + its attachments (from MessageDownload). */
export interface MessageDetail {
  id: string;
  subject: string;
  sender: string;
  senderAddress: string | null;
  recipient: string | null;
  recipientAddress: string | null;
  deliveryTime: number | null;
  acceptanceTime: number | null;
  attachments: MessageAttachment[];
  /**
   * Set once a re-download has confirmed the message no longer exists in ISDS (90-day deletion). When
   * true and a local attachment file is missing, it's permanently unrecoverable - the detail shows a
   * standing "no longer available" notice instead of offering re-download. Persisted in detailJson.
   * Since 004's amendment it also stops the detail offering to fetch the signed original.
   */
  attachmentsUnavailable?: boolean;
  /**
   * A large-volume (VoDZ) message whose enclosure download stopped part-way (constitution IV). Its
   * `attachments` are enclosures 0 … n-1, in ISDS's order; enclosure n and every one after it did not
   * arrive, and how many there are ISDS says only by answering past the last one. Absent once every
   * enclosure is in, and on every other message. Persisted in detailJson.
   */
  enclosuresMissingFrom?: number;
  /**
   * The message as ISDS sealed it - its .zfo, a file beside the attachments (004 amendment,
   * 2026-09-14). Absent for a message downloaded before originals were kept, or when the original
   * could not be fetched or written; the detail then offers to fetch it while ISDS still holds it.
   */
  signedZfo?: SignedOriginal;
}

/** The registered media type of a .zfo - what a viewer, a save sheet or the scan is told it is. */
export const ZFO_MIME_TYPE = 'application/vnd.software602.filler.form-xml-zip';

/** A message's signed original on disk: what the detail records about it (004 amendment). */
export interface SignedOriginal {
  /** `DZ_<dmID>.zfo` - also the name a saved copy is offered under. */
  fileName: string;
  /** The file in the app's private storage, exactly like an attachment's `localPath`. */
  localPath: string;
  /** Bytes on disk. */
  size: number;
}

/**
 * A localized notice from ISDS (e.g. an OTP "code sent" confirmation). `code` is the
 * language-independent `X-Response-message-code` (mapped to our own localized copy when known);
 * `text` is the server's already-localized message (Czech), used as a fallback for unknown codes.
 */
export interface ServerNotice {
  code?: string;
  text?: string;
}

/** A configured data-box account. Non-secret; the password lives only in the secure enclave. */
export interface DataBoxAccount {
  /** Stable local id (UUID). */
  id: string;
  boxId: string;
  loginName: string;
  /** The box owner's name from ISDS (the default display name). */
  label: string;
  /** The box's legal form (`dbType`) - rendered as "{type} · ID {boxId}" in the switcher. Null until
   *  captured at login/re-auth or backfilled on a refresh (existing boxes predate this field). */
  dbType: BoxType | null;
  /** Optional user-set nickname; when present it is the box's primary display name. */
  alias: string | null;
  authMethod: AuthMethod;
  /** ISDS environment this box belongs to (production vs the czebox test system). */
  host: Host;
  /** Keychain/Keystore reference for this box's secret (never the secret itself). */
  secretRef: string;
  /** Last known session validity (epoch ms), or null = must re-auth. */
  sessionValidUntil: number | null;
  // No `sessionCookie` here since 001 T028. The box's own session (018) is a bearer credential and is
  // sealed under the vault key beside its password; a controller reads it at call time
  // (`credentialsFor`). A field that stayed on the account would let a call site keep compiling while
  // passing a cookie that is no longer there.
  passwordExpiresAt: number | null;
  /** When this box's messages were last successfully refreshed (epoch ms), or null = never. */
  lastSyncedAt: number | null;
  /** Received-message counts from the last refresh, or null = never refreshed. */
  messageCount: number | null;
  unreadCount: number | null;
  /**
   * The box's PDZ (Poštovní datová zpráva) credit balance in CZK from the last refresh, or null =
   * never fetched / the box has no PDZ credit facility. Used to send paid messages to private boxes.
   */
  pdzCreditCzk: number | null;
  /** Last refresh failure, or null = last refresh succeeded (or none yet). Persisted across restarts. */
  syncError: SyncFailure | null;
  createdAt: number;
  updatedAt: number;
}

// ── Sending messages (feature 005) ───────────────────────────────────────────────────────────────

/**
 * Recipient box type from `FindDataBox2`. Drives the cost model: `OVM` (public authority) = a free
 * data message (DZ); the private types (`FO`/`PFO`/`PO`) = a paid Poštovní datová zpráva (PDZ).
 */
export type RecipientDbType = 'OVM' | 'FO' | 'PFO' | 'PO';

/** A recipient resolved via fulltext search (`ISDSSearch3`) - a lookup result the user picks. */
export interface Recipient {
  boxId: string;
  /** The owner's name, on its own. */
  name: string;
  /**
   * The address exactly as ISDS composed it (`dbAddress`), or null when it returned none.
   *
   * Kept SEPARATE from the name, which it was not until 015. Concatenated into one `label` and
   * rendered on one clipped line, the address was always the half that got cut - leaving three
   * different people called Jan Novak indistinguishable in a search result.
   */
  address: string | null;
  dbType: RecipientDbType;
  /** Whether the box accepts commercial (PDZ) messages - gates a paid send. */
  acceptsPdz: boolean;
}

/** Sender's PDZ credit + eligibility, from `DataBoxCreditInfo` / `PDZInfo`. */
export interface CreditInfo {
  boxId: string;
  balanceCzk: number;
  /** Whether this box may send PDZ at all (false ⇒ block a paid send, link out to top up). */
  pdzEnabled: boolean;
}

/** Price tier for a send. `none` = free (OVM); `normal`/`large` = paid PDZ, by total attachment size. */
export type CostTier = 'none' | 'normal' | 'large';

/**
 * A pre-send cost estimate. `approxCzk` is intentionally APPROXIMATE (the operator tariff can change
 * and is confirmed live before charging). `bigMessage` ⇒ over the ordinary limit, so the send takes
 * the VoDZ `CreateBigMessage` track; `oversize` ⇒ over even the VoDZ max (100 MB) → genuinely unsupported.
 */
export interface CostEstimate {
  paid: boolean;
  tier: CostTier;
  approxCzk: number | null;
  bigMessage: boolean;
  oversize: boolean;
}

/**
 * One document to send (a `dmFile`). `contentBase64` is produced OFF the JS thread (Principle I). The
 * first/main document carries `isMain` (`dmFileMetaType="main"`); ISDS requires at least one.
 */
export interface OutgoingDocument {
  fileName: string; // dmFileDescr
  mimeType: string; // dmMimeType
  /** Original file size in bytes - drives the cost tier + big-message routing (`SizedAttachment`). */
  sizeBytes: number;
  contentBase64: string; // dmEncodedContent
  isMain: boolean;
  /**
   * Local cache path of the picked file (no `file://`). Kept so the VoDZ track can hash + upload a
   * large file from disk OFF the JS thread (Principle I) instead of via the in-memory `contentBase64`.
   */
  localPath?: string;
}

/**
 * A large attachment already uploaded to the VoDZ service (`UploadAttachment` → `dmAttID`), described
 * for `CreateBigMessage`'s `dmExtFile` by reference (id + two DIFFERENT-algorithm hashes), NOT content.
 * Content is read + hashed + uploaded off the JS thread (Principle I). See contract `isds-bigmessage.md`.
 */
export interface BigAttachmentRef {
  /** `dmAttID` returned by `UploadAttachment`. */
  attId: string;
  /** First/main document of the message (`dmFileMetaType="main"`); the rest are `enclosure`. */
  isMain: boolean;
  /** `dmAttHash1` + its algorithm (`dmAttHash1Alg`, e.g. `SHA-1`). */
  hash1: string;
  hash1Alg: string;
  /** `dmAttHash2` + its algorithm (`dmAttHash2Alg`, e.g. `SHA-256`) - must differ from hash1's. */
  hash2: string;
  hash2Alg: string;
}

/**
 * The only shapes a login step may resolve to. `AuthService` NEVER throws - it always returns one
 * of these, which is what guarantees "zero crashes" (spec SC-002).
 */
export type LoginOutcome =
  | {
      kind: 'signedIn';
      ownerInfo: OwnerInfo;
      /**
       * The session this login established (018) - stored against the box and replayed only on its
       * own calls. Absent for password boxes, which hold no session.
       */
      sessionCookie?: string | null;
    }
  | { kind: 'needsOtpSms'; notice?: ServerNotice } // TOTP: SMS sent, awaiting code
  | {
      kind: 'error';
      code: LoginErrorCode;
      recoverable: true;
      messageKey: string;
      /**
       * Set when a username+password attempt was rejected and the box likely requires a one-time
       * code instead (enabling OTP on a box disables password-only login). The UI offers a one-tap
       * retry with an OTP method using the same credentials.
       */
      suggestOtp?: boolean;
    };
