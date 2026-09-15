// AccountsStore (feature 001).
//
// Non-secret account metadata. The production implementation is encrypted SQLite (op-sqlite/SQLCipher,
// task T007); this file defines the interface and a pure in-memory implementation used by unit tests
// and as a reference. Secrets NEVER live here - only a `secretRef` into the secure enclave.

import type { AuthMethod, BoxType, DataBoxAccount, SyncFailure } from '../isds/types';

export class DuplicateBoxError extends Error {
  constructor(public readonly boxId: string) {
    super(`A box with id "${boxId}" is already added`);
    this.name = 'DuplicateBoxError';
  }
}

export interface AccountsStore {
  list(): Promise<DataBoxAccount[]>;
  /** Adds an account. Rejects with `DuplicateBoxError` if `boxId` is already present. */
  add(account: DataBoxAccount): Promise<void>;
  /** Removes the account row for `boxId` (secret purge is the controller's responsibility). */
  remove(boxId: string): Promise<void>;
  setActive(boxId: string): Promise<void>;
  getActiveBoxId(): Promise<string | null>;
  /** Set (or clear, with null) a box's user-defined alias. */
  setAlias(boxId: string, alias: string | null): Promise<void>;
  /** Update a box's authentication method (a re-auth may discover the box's method changed). */
  setAuthMethod(boxId: string, authMethod: AuthMethod): Promise<void>;
  /** Record the result of a successful refresh: timestamp + received-message counts (clears syncError). */
  setSyncResult(
    boxId: string,
    lastSyncedAt: number,
    messageCount: number,
    unreadCount: number,
  ): Promise<void>;
  /** Persist (or clear, with null) a box's last-refresh failure flag. */
  setSyncError(boxId: string, syncError: SyncFailure | null): Promise<void>;
  /** Persist (or clear, with null) a box's PDZ credit balance in CZK (shown on the box overview). */
  setCredit(boxId: string, pdzCreditCzk: number | null): Promise<void>;
  /** Persist (or clear, with null) a box's legal form (dbType) - a backfill for pre-existing boxes. */
  setDbType(boxId: string, dbType: BoxType | null): Promise<void>;
  /** Refresh the password-expiry date ISDS reported at the last sign-in (001 T041). */
  setPasswordExpiresAt(boxId: string, passwordExpiresAt: number | null): Promise<void>;
  /** Decrement a box's unread count by one (floored at 0; a no-op when null/already 0). Used when a
   *  message is marked read by opening it, so the home badge reflects it before the next sync. */
  decrementUnread(boxId: string): Promise<void>;
  /** Read an app-level key/value setting (e.g. theme, locale), or null if unset. */
  getSetting(key: string): Promise<string | null>;
  /** Write an app-level key/value setting. */
  setSetting(key: string, value: string): Promise<void>;
  /**
   * Every setting, for the backup snapshot (006).
   *
   * `getSetting` cannot stand in for this: the table holds dynamically-named rows - every dismissed
   * scan suggestion is `scanDismiss:<boxId>:<messageId>` - so there is no key list to iterate.
   */
  allSettings(): Promise<Record<string, string>>;
  /**
   * Drop every setting whose key starts with `prefix`.
   *
   * Exists for per-box entries that are too small to deserve a table of their own - today the scan
   * suggestions a user dismissed (010 US3). Removing a box must take them with it, and they are
   * keyed `…:<boxId>:<messageId>`, so the cleanup is a prefix delete rather than a lookup.
   */
  removeSettingsWithPrefix(prefix: string): Promise<void>;
}

/** Deterministic, dependency-free implementation for tests and previews. */
export class InMemoryAccountsStore implements AccountsStore {
  private accounts = new Map<string, DataBoxAccount>();
  private activeBoxId: string | null = null;
  private settings = new Map<string, string>();

  async getSetting(key: string): Promise<string | null> {
    return this.settings.get(key) ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    this.settings.set(key, value);
  }

  async allSettings(): Promise<Record<string, string>> {
    return Object.fromEntries(this.settings);
  }

  async removeSettingsWithPrefix(prefix: string): Promise<void> {
    for (const key of [...this.settings.keys()]) {
      if (key.startsWith(prefix)) {
        this.settings.delete(key);
      }
    }
  }

  async list(): Promise<DataBoxAccount[]> {
    return [...this.accounts.values()].sort(
      (a, b) => a.createdAt - b.createdAt,
    );
  }

  async add(account: DataBoxAccount): Promise<void> {
    if (this.accounts.has(account.boxId)) {
      throw new DuplicateBoxError(account.boxId);
    }
    this.accounts.set(account.boxId, account);
    if (this.activeBoxId === null) {
      this.activeBoxId = account.boxId; // first box becomes active
    }
  }

  async remove(boxId: string): Promise<void> {
    this.accounts.delete(boxId);
    if (this.activeBoxId === boxId) {
      const next = await this.list();
      this.activeBoxId = next.length > 0 ? next[0].boxId : null;
    }
  }

  async setActive(boxId: string): Promise<void> {
    if (!this.accounts.has(boxId)) {
      throw new Error(`Cannot activate unknown box "${boxId}"`);
    }
    this.activeBoxId = boxId;
  }

  async getActiveBoxId(): Promise<string | null> {
    return this.activeBoxId;
  }

  async setAlias(boxId: string, alias: string | null): Promise<void> {
    const account = this.accounts.get(boxId);
    if (account) {
      this.accounts.set(boxId, { ...account, alias });
    }
  }

  async setAuthMethod(boxId: string, authMethod: AuthMethod): Promise<void> {
    const account = this.accounts.get(boxId);
    if (account) {
      this.accounts.set(boxId, { ...account, authMethod });
    }
  }

  async setSyncResult(
    boxId: string,
    lastSyncedAt: number,
    messageCount: number,
    unreadCount: number,
  ): Promise<void> {
    const account = this.accounts.get(boxId);
    if (account) {
      this.accounts.set(boxId, {
        ...account,
        lastSyncedAt,
        messageCount,
        unreadCount,
        syncError: null,
      });
    }
  }

  async setSyncError(boxId: string, syncError: SyncFailure | null): Promise<void> {
    const account = this.accounts.get(boxId);
    if (account) {
      this.accounts.set(boxId, { ...account, syncError });
    }
  }

  async setCredit(boxId: string, pdzCreditCzk: number | null): Promise<void> {
    const account = this.accounts.get(boxId);
    if (account) {
      this.accounts.set(boxId, { ...account, pdzCreditCzk });
    }
  }

  async setPasswordExpiresAt(
    boxId: string,
    passwordExpiresAt: number | null,
  ): Promise<void> {
    const a = this.accounts.get(boxId);
    if (a) {
      this.accounts.set(boxId, { ...a, passwordExpiresAt });
    }
  }

  async setDbType(boxId: string, dbType: BoxType | null): Promise<void> {
    const account = this.accounts.get(boxId);
    if (account) {
      this.accounts.set(boxId, { ...account, dbType });
    }
  }

  async decrementUnread(boxId: string): Promise<void> {
    const account = this.accounts.get(boxId);
    if (account && (account.unreadCount ?? 0) > 0) {
      this.accounts.set(boxId, { ...account, unreadCount: (account.unreadCount ?? 0) - 1 });
    }
  }
}
