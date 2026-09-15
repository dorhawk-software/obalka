// What a backup CONTAINS, and how that shape is allowed to change (006 FR-009…FR-012).
//
// Two versions travel with every backup and they are deliberately independent, because they change
// for unrelated reasons:
//
//   `formatVersion`  (envelope.ts)  how the bytes are encrypted and framed
//   `schemaVersion`  (here)         what the decrypted payload contains
//
// A cipher change and a new column are different events; one version number for both would force a
// re-encryption to add a field, or - far worse - let a field change slip in under a version that
// says nothing changed.
//
// THE RULE, in one line: an older backup must open on a newer app, and a newer backup must be
// REFUSED by an older one rather than half-read. The asymmetry is the point. Migrating forward is a
// problem we can solve with code we have; reading a payload written by a version that did not exist
// yet is not, and pretending otherwise means importing half a backup over somebody's archive.

/**
 * The shape of the payload. Bump this whenever `SNAPSHOT_SHAPE` below changes, and add the migration
 * that carries old backups across - `migrate.ts` will not let you forget, and neither will the drift
 * test.
 */
export const BACKUP_SCHEMA_VERSION = 2;

/** Manifest stored NEXT TO the archive, small enough to fetch before deciding to download it. */
export interface BackupManifest {
  /** Envelope/crypto format. */
  formatVersion: number;
  /** Payload shape - what this file says it contains. */
  schemaVersion: number;
  /** For support and for the user's own "which of my phones was this" question. */
  appVersion: string;
  createdAt: number;
  /** Which tiers are inside: metadata is always present, documents are the user's choice. */
  tiers: { metadata: true; documents: boolean };
  /** Bytes of the archive object, so the app can say what a restore will cost before it starts. */
  sizeBytes: number;
  /** The archive object this manifest describes. */
  archiveName: string;
  /**
   * How many documents the Tier 2 pass stored, and what they occupy sealed.
   *
   * In the manifest rather than only in the payload because "Backed up" means two different things
   * once Tier 2 exists, and the screen has to be able to say WHICH without decrypting anything
   * (FR-008). Optional: a manifest written before Tier 2 has neither, and absent is not zero - it is
   * "this backup predates the question".
   */
  documentCount?: number;
  documentBytes?: number;
  /**
   * Which attachments the backup was made to carry (026 US2), when `tiers.documents` is true:
   * `downloaded` - those on the phone when it was made; `all` - the backup first downloaded what was
   * missing. Absent on a backup made before 026, which is a `downloaded` one.
   */
  documentMode?: BackupDocumentMode;
  /**
   * In the `all` mode, how many messages were still without their attachments on the phone when the
   * backup was made - deleted by ISDS, refused, or in a box that needed a sign-in.
   */
  documentsMissing?: number;
  /**
   * The stored object names the backup's document index uses (026 FR-002), so a phone transfer can
   * carry this backup's documents and no others without decrypting anything. Keyed hashes
   * (`contentId.ts`): readable without the password, and they say nothing about the mail.
   */
  documentObjects?: string[];
}

/** Which attachments a backup with documents carries (026). */
export type BackupDocumentMode = 'downloaded' | 'all';

/**
 * The payload itself.
 *
 * Every field here is part of the compatibility contract: adding, removing or renaming one is a
 * schema change, which is exactly what the drift test measures.
 */
export interface BackupPayload {
  schemaVersion: number;
  accounts: BackupAccount[];
  messages: BackupMessage[];
  drafts: BackupDraft[];
  reminders: BackupReminder[];
  settings: Record<string, string>;
  /** Which stored object holds which attachment (Tier 2). Empty when the tier is off. */
  documents: BackupDocument[];
  /**
   * The key the documents are named and sealed with, base64, or null when Tier 2 has never run.
   *
   * It travels INSIDE the sealed payload, which is the only reason Tier 2 needs no second Argon2id
   * run and no key file beside the objects. It also has to travel: the objects outlive any single
   * archive, so a phone restoring onto a fresh install must end up naming documents exactly as the
   * old one did, or every object in the store becomes unreachable litter and the next backup
   * uploads the whole archive again.
   */
  documentKey: string | null;
}

/**
 * One attachment, as stored.
 *
 * Deliberately NOT a path. `localPath` in `detailJson` is absolute and contains the app container,
 * which is a different directory on a different install - on iOS it changes on every reinstall. What
 * identifies a document across devices is the message it belongs to and its file name; the restore
 * rebuilds the path from those.
 */
export interface BackupDocument {
  boxId: string;
  messageId: string;
  /** The file's name inside the message's attachment directory. Never a path. */
  fileName: string;
  /** Keyed content id - see `contentId.ts`. `objectNameFor` turns it into the object's name. */
  contentId: string;
  /** Plaintext size, so a restore can state the cost before it starts fetching. */
  sizeBytes: number;
}

/** NOTE: no `sessionCookie` and no `secretRef` - see FR-007 as amended. */
export interface BackupAccount {
  boxId: string;
  loginName: string;
  label: string | null;
  alias: string | null;
  dbType: string | null;
  authMethod: string;
  host: string;
  passwordExpiresAt: number | null;
  createdAt: number;
}

export interface BackupMessage {
  boxId: string;
  messageId: string;
  folder: string | null;
  subject: string | null;
  sender: string | null;
  senderAddress: string | null;
  recipient: string | null;
  recipientAddress: string | null;
  deliveryTime: number | null;
  acceptanceTime: number | null;
  state: number | null;
  attachmentSize: number | null;
  detailJson: string | null;
  downloadedAt: number | null;
}

export interface BackupDraft {
  id: string;
  boxId: string;
  recipientBoxId: string | null;
  recipientName: string | null;
  recipientAddress: string | null;
  subject: string | null;
  body: string | null;
  updatedAt: number;
}

export interface BackupReminder {
  boxId: string;
  messageId: string;
  date: number;
  createdBy: string;
  createdAt: number;
}

/**
 * The schema, as data - the single source the drift test measures.
 *
 * Written out rather than derived from the TypeScript types because types vanish at runtime, and a
 * guard that cannot see the thing it guards is decoration. Keep this in step with the interfaces
 * above; the drift test fails loudly if a snapshot ever carries a field this does not list.
 */
export const SNAPSHOT_SHAPE = {
  accounts: [
    'boxId', 'loginName', 'label', 'alias', 'dbType', 'authMethod', 'host',
    'passwordExpiresAt', 'createdAt',
  ],
  messages: [
    'boxId', 'messageId', 'folder', 'subject', 'sender', 'senderAddress',
    'recipient', 'recipientAddress', 'deliveryTime', 'acceptanceTime', 'state',
    'attachmentSize', 'detailJson', 'downloadedAt',
  ],
  drafts: [
    'id', 'boxId', 'recipientBoxId', 'recipientName', 'recipientAddress',
    'subject', 'body', 'updatedAt',
  ],
  reminders: ['boxId', 'messageId', 'date', 'createdBy', 'createdAt'],
  settings: ['<key/value>'],
  documents: ['boxId', 'messageId', 'fileName', 'contentId', 'sizeBytes'],
  documentKey: ['<opaque>'],
} as const;

/**
 * A stable fingerprint of the shape.
 *
 * Order-insensitive on purpose: reordering fields is not a compatibility event, and a guard that
 * cried wolf over formatting would be switched off within a month.
 */
export function schemaFingerprint(
  shape: Record<string, readonly string[]> = SNAPSHOT_SHAPE,
): string {
  return Object.keys(shape)
    .sort()
    .map(table => `${table}(${[...shape[table]].sort().join(',')})`)
    .join('|');
}
