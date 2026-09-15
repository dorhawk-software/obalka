// Putting a backup back (006 Phase 2), which is the half that can destroy something.
//
// Two rules, and both exist because the archive is Principle IV's "sacred" store - the copy of
// government mail that outlives ISDS's own 90-day retention.
//
// **1. Additive.** A restore never deletes. The archive is append-mostly, so a message present here
// and absent from the backup is almost certainly newer than the backup, not deleted from it -
// treating the backup as authoritative would quietly destroy everything received since it was
// written. A restore is a merge, not a replacement.
//
// **2. Never replace something with nothing.** A field that is present locally and absent in the
// backup keeps its local value. The case that makes this concrete: `detailJson` and `downloadedAt`
// carry a message's downloaded attachments. Restoring an older backup over a message whose documents
// have since been fetched would blank the paths and leave the files orphaned on disk - a restore that
// costs you the very documents it exists to protect.
//
// The write itself is wrapped in one transaction by the sink, so a failure part-way leaves the
// archive exactly as it was (FR-006) rather than half-merged.

import { throwIfCancelled, type CancelSignal } from './progress';
import { isDeviceLocalSetting } from '../../app/settings/settingsKeys';
import type {
  BackupAccount,
  BackupDraft,
  BackupMessage,
  BackupPayload,
  BackupReminder,
} from './schema';

/** What a restore writes through. One transaction per restore; the sink owns atomicity. */
export interface BackupSink {
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  existingMessage(
    boxId: string,
    messageId: string,
  ): Promise<BackupMessage | null>;
  hasAccount(boxId: string): Promise<boolean>;
  upsertAccount(account: BackupAccount): Promise<void>;
  upsertMessage(message: BackupMessage): Promise<void>;
  upsertDraft(draft: BackupDraft): Promise<void>;
  upsertReminder(reminder: BackupReminder): Promise<void>;
  putSetting(key: string, value: string): Promise<void>;
}

export interface RestoreReport {
  accountsAdded: number;
  accountsKept: number;
  messagesAdded: number;
  messagesMerged: number;
  draftsRestored: number;
  remindersRestored: number;
  settingsRestored: number;
}

/**
 * Merge one message from a backup with what is already here.
 *
 * Pure, and separated from the writing so the rule can be tested without a database - it is the rule
 * that decides whether a restore is safe, and the one most likely to be "simplified" later by someone
 * who has not thought about the orphaned-attachments case.
 */
export function mergeMessage(
  local: BackupMessage | null,
  fromBackup: BackupMessage,
): BackupMessage {
  if (!local) {
    return fromBackup;
  }
  const merged: BackupMessage = { ...fromBackup };
  for (const key of Object.keys(local) as (keyof BackupMessage)[]) {
    const localValue = local[key];
    const backupValue = merged[key];
    // Present beats absent, whichever side it is on. Never the other way round.
    if (backupValue == null && localValue != null) {
      (merged[key] as unknown) = localValue;
    }
  }
  return merged;
}

/**
 * Restore a payload into whatever is already on this device.
 *
 * Returns what it did rather than a boolean: after a restore the user's next question is "did my
 * messages come back", and a count is the only honest answer to it.
 */
export async function restorePayload(
  payload: BackupPayload,
  sink: BackupSink,
  report?: (done: number, total: number, detail?: string) => void,
  signal?: CancelSignal,
): Promise<RestoreReport> {
  // Settings that describe the phone the backup was made on, never this one (`DEVICE_LOCAL_SETTINGS`).
  // Skipped here as well as left out of a new snapshot, because a backup made before a key joined the
  // list still carries it - and an app lock restored as "on" armed a gate on a phone whose vault key
  // had not travelled with it.
  const settings = Object.entries(payload.settings).filter(
    ([key]) => !isDeviceLocalSetting(key),
  );
  // Every row the restore will write, counted before the first one goes in - so the bar counts what
  // is actually happening rather than the four loops below finishing at four different speeds.
  const total =
    payload.accounts.length +
    payload.messages.length +
    payload.drafts.length +
    payload.reminders.length +
    settings.length;
  let done = 0;
  const step = (detail?: string) => {
    throwIfCancelled(signal);
    report?.(++done, total, detail);
  };

  return sink.transaction(async () => {
    const result: RestoreReport = {
      accountsAdded: 0,
      accountsKept: 0,
      messagesAdded: 0,
      messagesMerged: 0,
      draftsRestored: 0,
      remindersRestored: 0,
      settingsRestored: 0,
    };

    for (const account of payload.accounts) {
      // An existing box keeps its local row: it holds a live session and current sync state, and the
      // backup's copy of those is stale by definition (and stripped of the session anyway).
      if (await sink.hasAccount(account.boxId)) {
        result.accountsKept++;
        step(account.label ?? account.boxId);
        continue;
      }
      await sink.upsertAccount(account);
      result.accountsAdded++;
      step(account.label ?? account.boxId);
    }

    for (const message of payload.messages) {
      const local = await sink.existingMessage(message.boxId, message.messageId);
      await sink.upsertMessage(mergeMessage(local, message));
      if (local) {
        result.messagesMerged++;
      } else {
        result.messagesAdded++;
      }
      step();
    }

    for (const draft of payload.drafts) {
      await sink.upsertDraft(draft);
      result.draftsRestored++;
      step();
    }
    for (const reminder of payload.reminders) {
      await sink.upsertReminder(reminder);
      result.remindersRestored++;
      step();
    }
    for (const [key, value] of settings) {
      await sink.putSetting(key, value);
      result.settingsRestored++;
      step();
    }
    return result;
  });
}
