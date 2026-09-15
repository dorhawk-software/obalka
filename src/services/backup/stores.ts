// Binding the backup to the app's real stores (006 Phase 2/3).
//
// Deliberately built from the store methods that already exist rather than new export/import SQL.
// `cacheList` turned out to be exactly right for a restore: it upserts and PRUNES NOTHING, and it
// leaves `detailJson`/`downloadedAt` alone - which is the additive rule and the never-replace-
// something-with-nothing rule already implemented at the storage layer. Writing a parallel import
// path would have meant re-deciding both, in a place where getting them wrong destroys an archive.
//
// Works against either implementation of each store, so the tests run it over the real in-memory
// stores rather than over fakes written to agree with it.

import type { AccountsStore } from '../db/accountsStore';
import { NEVER_SYNCED, type MessagesStore, type MessageFolder } from '../db/messagesStore';
import type { DraftsStore } from '../db/draftsStore';
import type { RemindersStore } from '../db/remindersStore';
import type { DataBoxAccount, MessageDetail } from '../isds/types';
import type { BackupSource } from './snapshot';
import type { BackupSink } from './restore';
import type { DocumentDetails } from './documents';
import type { BackupMessage } from './schema';

export interface BackupStores {
  accounts: AccountsStore;
  messages: MessagesStore;
  drafts: DraftsStore;
  reminders: RemindersStore;
}

/** Read side. */
export function backupSource(stores: BackupStores): BackupSource {
  return {
    listAccounts: async () => (await stores.accounts.list()).map(a => ({
      boxId: a.boxId,
      loginName: a.loginName,
      label: a.label,
      alias: a.alias,
      dbType: a.dbType,
      authMethod: a.authMethod,
      host: a.host,
      passwordExpiresAt: a.passwordExpiresAt,
      createdAt: a.createdAt,
    })),
    // Envelopes only. The detail read is a separate call so the backup can COUNT the messages before
    // it starts fetching bodies - an exact "x z y" instead of a spinner (see `buildPayload`).
    listEnvelopes: async (boxId, folder) => {
      const { envelopes } = await stores.messages.getList(boxId, folder);
      const rows: BackupMessage[] = [];
      for (const e of envelopes) {
        rows.push({
          boxId,
          messageId: e.id,
          folder,
          subject: e.subject,
          sender: e.sender,
          senderAddress: e.senderAddress,
          recipient: e.recipient,
          recipientAddress: e.recipientAddress,
          deliveryTime: e.deliveryTime,
          acceptanceTime: e.acceptanceTime,
          state: e.state,
          attachmentSize: e.attachmentSize,
          // The attachment BYTES are not here - `localPath` points at files this tier does not carry
          // (Tier 2). What travels is the description of them, so a Tier 2 restore has somewhere to
          // put the documents back.
          detailJson: null, // filled in by `messageDetail`
          downloadedAt: null,
        });
      }
      return rows;
    },
    messageDetail: async (boxId, messageId) => {
      const detail = await stores.messages.getDetail(boxId, messageId);
      return detail ? JSON.stringify(detail) : null;
    },
    listDrafts: async boxId =>
      (await stores.drafts.list(boxId)).map(d => ({
        id: d.id,
        boxId: d.boxId,
        recipientBoxId: d.recipientBoxId ?? null,
        recipientName: d.recipientLabel,
        recipientAddress: d.recipientAddress ?? null,
        subject: d.subject,
        body: d.body,
        updatedAt: d.updatedAt,
      })),
    listReminders: async boxId =>
      (await stores.reminders.listForBox(boxId)).map(r => ({
        boxId: r.boxId,
        messageId: r.messageId,
        date: r.date,
        createdBy: r.createdBy,
        createdAt: r.createdAt,
      })),
    allSettings: () => stores.accounts.allSettings(),
  };
}

/**
 * The half of the message store Tier 2 writes through (006 T022).
 *
 * Separate from `BackupSink` because it runs OUTSIDE the restore's transaction: the documents are
 * files on disk, and no database transaction can roll those back. The rows are committed first, then
 * the files are written, then the detail is repointed at where they actually landed.
 */
export function documentDetails(stores: BackupStores): DocumentDetails {
  return {
    getDetail: (boxId, messageId) => stores.messages.getDetail(boxId, messageId),
    // `downloadedAt` is the store's "this body has been fetched" marker. Nothing in the app reads
    // it as a date, so re-stamping it here costs nothing; what would cost something is leaving the
    // detail unwritten, because then the restored files sit on disk with nothing pointing at them.
    putDetail: async (boxId, _messageId, detail) => {
      await stores.messages.cacheDetail(boxId, detail, Date.now());
    },
  };
}

/**
 * Write side.
 *
 * `transaction` is supplied by the caller: the in-memory stores have no transactions and the SQLite
 * ones share a connection, so the mechanism differs by wiring rather than by store. Passing it in
 * keeps this composable and keeps the atomicity decision visible at the call site instead of buried.
 */
export function backupSink(
  stores: BackupStores,
  transaction: BackupSink['transaction'],
): BackupSink {
  return {
    transaction,
    hasAccount: async boxId =>
      (await stores.accounts.list()).some(a => a.boxId === boxId),
    existingMessage: async (boxId, messageId) => {
      const envelope = await stores.messages.getEnvelope(boxId, messageId);
      if (!envelope) {
        return null;
      }
      const detail = await stores.messages.getDetail(boxId, messageId);
      return {
        boxId,
        messageId,
        folder: null,
        subject: envelope.subject,
        sender: envelope.sender,
        senderAddress: envelope.senderAddress,
        recipient: envelope.recipient,
        recipientAddress: envelope.recipientAddress,
        deliveryTime: envelope.deliveryTime,
        acceptanceTime: envelope.acceptanceTime,
        state: envelope.state,
        attachmentSize: envelope.attachmentSize,
        detailJson: detail ? JSON.stringify(detail) : null,
        downloadedAt: detail ? 1 : null,
      };
    },
    upsertAccount: async a => {
      // A restored box arrives WITHOUT a secret and without a session, which is the honest state: it
      // exists, it is listed, and the first thing it will do is ask to be signed in. That is also why
      // the backup never carried them (FR-007).
      const account: DataBoxAccount = {
        id: `acc_${a.boxId}`,
        boxId: a.boxId,
        loginName: a.loginName,
        label: a.label ?? '',
        dbType: a.dbType as DataBoxAccount['dbType'],
        alias: a.alias,
        authMethod: a.authMethod as DataBoxAccount['authMethod'],
        host: a.host as DataBoxAccount['host'],
        secretRef: '',
        sessionValidUntil: null,
        passwordExpiresAt: a.passwordExpiresAt,
        lastSyncedAt: null,
        messageCount: null,
        unreadCount: null,
        pdzCreditCzk: null,
        syncError: null,
        createdAt: a.createdAt,
        updatedAt: Date.now(),
      };
      await stores.accounts.add(account);
    },
    upsertMessage: async m => {
      await stores.messages.cacheList(
        m.boxId,
        (m.folder ?? 'received') as MessageFolder,
        [
          {
            id: m.messageId,
            subject: m.subject ?? '',
            sender: m.sender ?? '',
            senderAddress: m.senderAddress,
            recipient: m.recipient,
            recipientAddress: m.recipientAddress,
            recipientBoxId: null,
            deliveryTime: m.deliveryTime,
            acceptanceTime: m.acceptanceTime,
            state: (m.state ?? 0) as never,
            attachmentSize: m.attachmentSize,
          },
        ],
        // Never synced HERE, which is the only true thing a restore knows. Not "now", which would
        // make the inbox fresher than it is, and not the backup's date either: a backup records no
        // sync time (sync bookkeeping is this phone's own, see `snapshot.ts`), and its creation is
        // only a bound on one. Least of all `downloadedAt`, which a backup carries as a marker - 1,
        // "the body is here" - and which as a time put "Aktualizováno 01.01.1970" at the end of a
        // restored inbox (2026-09-24). The store keeps the later of this and a row's own stamp, so
        // restoring over a box this phone did sync leaves its real sync time where it was.
        NEVER_SYNCED,
      );
      if (m.detailJson) {
        await stores.messages.cacheDetail(
          m.boxId,
          JSON.parse(m.detailJson) as MessageDetail,
          m.downloadedAt ?? Date.now(),
        );
      }
    },
    upsertDraft: async d => {
      await stores.drafts.save({
        id: d.id,
        boxId: d.boxId,
        recipientBoxId: d.recipientBoxId,
        recipientLabel: d.recipientName,
        recipientAddress: d.recipientAddress,
        recipientDbType: null,
        subject: d.subject ?? '',
        body: d.body ?? '',
        updatedAt: d.updatedAt,
      });
    },
    upsertReminder: async r => {
      await stores.reminders.set({
        boxId: r.boxId,
        messageId: r.messageId,
        date: r.date,
        createdBy: r.createdBy as 'user' | 'scan',
        createdAt: r.createdAt,
      });
    },
    putSetting: (key, value) => stores.accounts.setSetting(key, value),
  };
}
