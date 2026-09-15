// Building the thing that gets encrypted (006 Phase 2).
//
// A snapshot is a plain object, deliberately: it is the format's contract, it round-trips through
// JSON, and every field in it is listed in `SNAPSHOT_SHAPE` where the drift guard can see it.
//
// What is NOT in it matters as much as what is:
//
//   * `sessionCookie` - a bearer credential since 018. A restored device re-authenticates anyway, and
//     a session that has been sitting in a backup is long dead, so carrying it would widen what the
//     ciphertext protects in exchange for nothing (FR-007 as amended).
//   * `secretRef` - a Keychain pointer, meaningless on another device.
//   * Sync bookkeeping (`lastSyncedAt`, counters, `syncError`, `pdzCreditCzk`) - facts about THIS
//     device's last conversation with ISDS. Restoring them onto another phone would state something
//     false; they cost nothing to re-fetch.
//   * Device-local settings (`DEVICE_LOCAL_SETTINGS` in `settingsKeys.ts`) - the box this phone had
//     open, the app lock that follows this phone's vault key, a removal that did not finish here, the
//     diagnostics answer given on this phone, and the backups this phone's retention is holding.
//
// The source is an interface rather than the stores themselves so this is testable without a
// database, in the same way `messagesController` takes its stores.

import { decodeUtf8, encodeUtf8Async } from '../text/textCodec';
import { throwIfCancelled, type CancelSignal } from './progress';
import type { MessageFolder } from '../db/messagesStore';
import { isDeviceLocalSetting } from '../../app/settings/settingsKeys';
import {
  BACKUP_SCHEMA_VERSION,
  type BackupAccount,
  type BackupDraft,
  type BackupMessage,
  type BackupPayload,
  type BackupReminder,
} from './schema';

/** Everything a snapshot needs to read. Composed from the stores; see `deps.ts` for the real wiring. */
export interface BackupSource {
  listAccounts(): Promise<
    {
      boxId: string;
      loginName: string;
      label: string | null;
      alias: string | null;
      dbType: string | null;
      authMethod: string;
      host: string;
      passwordExpiresAt: number | null;
      createdAt: number;
    }[]
  >;
  /**
   * The envelopes of one folder, WITHOUT their bodies.
   *
   * Split from the detail read so a backup can count before it works: the envelopes of every box are
   * cheap and give the exact number of messages, which is what turns "Pracuji…" into "412 z 1 380".
   * The rows come back with `detailJson: null` - `messageDetail` fills that in.
   */
  listEnvelopes(boxId: string, folder: MessageFolder): Promise<BackupMessage[]>;
  /** The stored body of one message, or null when it was never downloaded. */
  messageDetail(boxId: string, messageId: string): Promise<string | null>;
  listDrafts(boxId: string): Promise<BackupDraft[]>;
  listReminders(boxId: string): Promise<BackupReminder[]>;
  allSettings(): Promise<Record<string, string>>;
}

/**
 * Read the whole archive into a payload.
 *
 * Ordered deterministically - by box, then by message id - so two snapshots of an unchanged archive
 * produce identical plaintext. That is what lets a future version skip an upload it does not need,
 * and it makes a diff between two backups mean something.
 */
export async function buildPayload(
  source: BackupSource,
  report?: (done: number, total: number, detail?: string) => void,
  signal?: CancelSignal,
): Promise<BackupPayload> {
  const accounts = await source.listAccounts();
  const sorted = [...accounts].sort((a, b) => a.boxId.localeCompare(b.boxId));

  const messages: BackupMessage[] = [];
  const drafts: BackupDraft[] = [];
  const reminders: BackupReminder[] = [];

  // Pass one: envelopes, drafts and reminders for every box. Cheap, and it is what makes the count
  // exact - the alternative is a bar whose total grows as it goes, which is not a total.
  for (const account of sorted) {
    throwIfCancelled(signal);
    for (const folder of ['received', 'sent'] as MessageFolder[]) {
      messages.push(...(await source.listEnvelopes(account.boxId, folder)));
    }
    drafts.push(...(await source.listDrafts(account.boxId)));
    reminders.push(...(await source.listReminders(account.boxId)));
  }

  // Pass two: the bodies, which is where the time actually goes.
  const labelOf = new Map(sorted.map(a => [a.boxId, a.label ?? a.boxId]));
  report?.(0, messages.length);
  for (let i = 0; i < messages.length; i++) {
    throwIfCancelled(signal);
    const message = messages[i];
    message.detailJson = await source.messageDetail(
      message.boxId,
      message.messageId,
    );
    message.downloadedAt = message.detailJson ? 1 : null;
    report?.(i + 1, messages.length, labelOf.get(message.boxId));
  }

  const settings = await source.allSettings();
  const portable: Record<string, string> = {};
  for (const [key, value] of Object.entries(settings)) {
    // Settings that describe THIS install - which box was open, the app lock, a removal that did not
    // finish, the diagnostics answer, the backups retention holds - and would be wrong on another one. The list and its reasons are
    // `DEVICE_LOCAL_SETTINGS`; the restore skips the same keys, for backups made before a key joined it.
    if (!isDeviceLocalSetting(key)) {
      portable[key] = value;
    }
  }

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    accounts: sorted.map(toBackupAccount),
    messages: messages.sort(byBoxThenId),
    drafts: drafts.sort((a, b) => a.id.localeCompare(b.id)),
    reminders: reminders.sort(byBoxThenId),
    settings: Object.fromEntries(Object.entries(portable).sort()),
    // Tier 2 is filled in by `createBackup` AFTER this, because storing the documents is what
    // produces the index - and the index has to be inside the payload it describes.
    documents: [],
    documentKey: null,
  };
}

function byBoxThenId(
  a: { boxId: string; messageId: string },
  b: { boxId: string; messageId: string },
): number {
  return (
    a.boxId.localeCompare(b.boxId) || a.messageId.localeCompare(b.messageId)
  );
}

/**
 * Copy field by field, never by spread.
 *
 * `{...account}` would carry whatever the row happens to hold today - including `sessionCookie`, and
 * including any credential-shaped column a future migration adds. Listing the fields means a new
 * column has to be added HERE, deliberately, and the drift guard notices when one is.
 */
function toBackupAccount(a: BackupSource extends never ? never : {
  boxId: string;
  loginName: string;
  label: string | null;
  alias: string | null;
  dbType: string | null;
  authMethod: string;
  host: string;
  passwordExpiresAt: number | null;
  createdAt: number;
}): BackupAccount {
  return {
    boxId: a.boxId,
    loginName: a.loginName,
    label: a.label,
    alias: a.alias,
    dbType: a.dbType,
    authMethod: a.authMethod,
    host: a.host,
    passwordExpiresAt: a.passwordExpiresAt,
    createdAt: a.createdAt,
  };
}

/** The payload as bytes, ready for `seal()`. */
export function encodePayload(payload: BackupPayload): Promise<Uint8Array> {
  // Our own UTF-8, never the globals: Hermes has no `TextDecoder` at all, and its `TextEncoder` is
  // not something to rely on either. See `services/text/textCodec.ts`.
  //
  // ASYNC because the size of this string is the size of the user's archive. `JSON.stringify` is a
  // native builtin and fast; the conversion after it is interpreted, and holding the thread for it
  // froze the app eight seconds after every sync once backups became automatic.
  return encodeUtf8Async(JSON.stringify(payload));
}

/** Bytes back to a payload - unvalidated; `migratePayload` decides whether it can be used. */
export function decodePayload(bytes: Uint8Array): Record<string, unknown> {
  return JSON.parse(decodeUtf8(bytes)) as Record<string, unknown>;
}
