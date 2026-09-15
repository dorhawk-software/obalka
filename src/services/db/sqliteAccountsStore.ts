// SQLite-backed AccountsStore (feature 001, task T007, constitution Principle III).
//
// Non-secret account metadata in the shared encrypted DB (see database.ts); the password and the
// session cookie are sealed under the vault key in the Keychain (see VaultSecureStore, 001 T028).

import { AccountsStore, DuplicateBoxError } from './accountsStore';
import { getDb, type DB } from './database';
import type { AuthMethod, BoxType, DataBoxAccount, SyncFailure } from '../isds/types';
import type { LegacySessionCookies } from '../secureStore/vaultSecureStore';

const ACTIVE_KEY = 'activeBoxId';

/** Narrow a stored dbType cell to our four-way type, or null (unknown / not yet backfilled). */
function toBoxType(v: unknown): BoxType | null {
  const s = String(v);
  return s === 'OVM' || s === 'FO' || s === 'PFO' || s === 'PO' ? s : null;
}

function rowToAccount(r: Record<string, unknown>): DataBoxAccount {
  const num = (v: unknown): number | null => (v == null ? null : Number(v));
  return {
    id: String(r.id),
    boxId: String(r.boxId),
    loginName: String(r.loginName),
    label: String(r.label),
    dbType: toBoxType(r.dbType),
    alias: r.alias == null ? null : String(r.alias),
    authMethod: String(r.authMethod) as AuthMethod,
    host: r.host === 'production' ? 'production' : 'czebox',
    secretRef: String(r.secretRef),
    sessionValidUntil: num(r.sessionValidUntil),
    passwordExpiresAt: num(r.passwordExpiresAt),
    lastSyncedAt: num(r.lastSyncedAt),
    messageCount: num(r.messageCount),
    unreadCount: num(r.unreadCount),
    pdzCreditCzk: num(r.pdzCreditCzk),
    syncError:
      r.syncError === 'reauth' || r.syncError === 'passwordExpired' || r.syncError === 'error'
        ? (r.syncError as SyncFailure)
        : null,
    createdAt: Number(r.createdAt),
    updatedAt: Number(r.updatedAt),
  };
}

export class SqliteAccountsStore implements AccountsStore, LegacySessionCookies {
  /** The shared, lazily-opened + migrated DB. */
  private ready(): Promise<DB> {
    return getDb();
  }

  async list(): Promise<DataBoxAccount[]> {
    const db = await this.ready();
    const res = await db.execute('SELECT * FROM accounts ORDER BY createdAt ASC');
    return res.rows.map(rowToAccount);
  }

  async add(account: DataBoxAccount): Promise<void> {
    const db = await this.ready();
    const dup = await db.execute('SELECT 1 FROM accounts WHERE boxId = ? LIMIT 1', [account.boxId]);
    if (dup.rows.length > 0) {
      throw new DuplicateBoxError(account.boxId);
    }
    // No `sessionCookie`: the column (migration 13) stays in the schema because a shipped migration is
    // never edited, but a new row leaves it NULL and nothing writes it again (001 T028).
    await db.execute(
      `INSERT INTO accounts
        (id, boxId, loginName, label, dbType, alias, authMethod, host, secretRef, sessionValidUntil, passwordExpiresAt, lastSyncedAt, messageCount, unreadCount, syncError, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        account.id,
        account.boxId,
        account.loginName,
        account.label,
        account.dbType,
        account.alias,
        account.authMethod,
        account.host,
        account.secretRef,
        account.sessionValidUntil,
        account.passwordExpiresAt,
        account.lastSyncedAt,
        account.messageCount,
        account.unreadCount,
        account.syncError,
        account.createdAt,
        account.updatedAt,
      ],
    );
    if ((await this.getActiveBoxId()) === null) {
      await this.writeActive(account.boxId); // first box becomes active
    }
  }

  async remove(boxId: string): Promise<void> {
    const db = await this.ready();
    await db.execute('DELETE FROM accounts WHERE boxId = ?', [boxId]);
    if ((await this.getActiveBoxId()) === boxId) {
      const next = await this.list();
      await this.writeActive(next.length > 0 ? next[0].boxId : null);
    }
  }

  async setActive(boxId: string): Promise<void> {
    await this.writeActive(boxId);
  }

  async setAlias(boxId: string, alias: string | null): Promise<void> {
    const db = await this.ready();
    await db.execute('UPDATE accounts SET alias = ? WHERE boxId = ?', [alias, boxId]);
  }

  async setAuthMethod(boxId: string, authMethod: AuthMethod): Promise<void> {
    const db = await this.ready();
    await db.execute('UPDATE accounts SET authMethod = ?, updatedAt = ? WHERE boxId = ?', [
      authMethod,
      Date.now(),
      boxId,
    ]);
  }

  /**
   * The cookies builds before 001 T028 kept in the `sessionCookie` column, for the one-time move into
   * the Keychain (`VaultSecureStore`). Empty once that move has run.
   */
  async legacySessionCookies(): Promise<{ boxId: string; sessionCookie: string }[]> {
    const db = await this.ready();
    const res = await db.execute(
      "SELECT boxId, sessionCookie FROM accounts WHERE sessionCookie IS NOT NULL AND sessionCookie != ''",
    );
    return res.rows.map(r => ({ boxId: String(r.boxId), sessionCookie: String(r.sessionCookie) }));
  }

  /** Empty one box's column - only ever after its sealed copy has been read back. Writes NULL, never a value. */
  async clearLegacySessionCookie(boxId: string): Promise<void> {
    const db = await this.ready();
    await db.execute(
      'UPDATE accounts SET sessionCookie = NULL WHERE boxId = ? AND sessionCookie IS NOT NULL',
      [boxId],
    );
  }

  async setSyncResult(
    boxId: string,
    lastSyncedAt: number,
    messageCount: number,
    unreadCount: number,
  ): Promise<void> {
    const db = await this.ready();
    // A successful refresh also clears any prior failure flag.
    await db.execute(
      'UPDATE accounts SET lastSyncedAt = ?, messageCount = ?, unreadCount = ?, syncError = NULL WHERE boxId = ?',
      [lastSyncedAt, messageCount, unreadCount, boxId],
    );
  }

  async setSyncError(boxId: string, syncError: SyncFailure | null): Promise<void> {
    const db = await this.ready();
    await db.execute('UPDATE accounts SET syncError = ? WHERE boxId = ?', [syncError, boxId]);
  }

  async setCredit(boxId: string, pdzCreditCzk: number | null): Promise<void> {
    const db = await this.ready();
    await db.execute('UPDATE accounts SET pdzCreditCzk = ? WHERE boxId = ?', [
      pdzCreditCzk,
      boxId,
    ]);
  }

  async setDbType(boxId: string, dbType: BoxType | null): Promise<void> {
    const db = await this.ready();
    await db.execute('UPDATE accounts SET dbType = ? WHERE boxId = ?', [dbType, boxId]);
  }

  async setPasswordExpiresAt(
    boxId: string,
    passwordExpiresAt: number | null,
  ): Promise<void> {
    const db = await this.ready();
    await db.execute('UPDATE accounts SET passwordExpiresAt = ? WHERE boxId = ?', [
      passwordExpiresAt,
      boxId,
    ]);
  }

  async decrementUnread(boxId: string): Promise<void> {
    const db = await this.ready();
    await db.execute(
      'UPDATE accounts SET unreadCount = max(unreadCount - 1, 0) WHERE boxId = ? AND unreadCount > 0',
      [boxId],
    );
  }

  async getSetting(key: string): Promise<string | null> {
    const db = await this.ready();
    const res = await db.execute('SELECT value FROM app_settings WHERE key = ?', [key]);
    const v = res.rows[0]?.value;
    return v == null ? null : String(v);
  }

  async setSetting(key: string, value: string): Promise<void> {
    const db = await this.ready();
    await db.execute(
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value],
    );
  }

  async allSettings(): Promise<Record<string, string>> {
    const db = await this.ready();
    const res = await db.execute('SELECT key, value FROM app_settings');
    const out: Record<string, string> = {};
    for (const row of res.rows) {
      out[String(row.key)] = String(row.value);
    }
    return out;
  }

  async removeSettingsWithPrefix(prefix: string): Promise<void> {
    const db = await this.ready();
    // ESCAPE, because a prefix built from a boxId could in principle contain `_` - SQLite's
    // single-character wildcard - and a stray one would delete another box's rows.
    await db.execute(
      "DELETE FROM app_settings WHERE key LIKE ? ESCAPE '\\'",
      [`${prefix.replace(/[\\%_]/g, c => `\\${c}`)}%`],
    );
  }

  async getActiveBoxId(): Promise<string | null> {
    const db = await this.ready();
    const res = await db.execute('SELECT value FROM app_settings WHERE key = ?', [ACTIVE_KEY]);
    const v = res.rows[0]?.value;
    return v == null ? null : String(v);
  }

  private async writeActive(boxId: string | null): Promise<void> {
    const db = await this.ready();
    if (boxId === null) {
      await db.execute('DELETE FROM app_settings WHERE key = ?', [ACTIVE_KEY]);
      return;
    }
    await db.execute(
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [ACTIVE_KEY, boxId],
    );
  }
}
