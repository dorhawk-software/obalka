// AccountsController (feature 001): ties a successful login to durable persistence - it records the
// box metadata via AccountsStore and the password and session via SecureStore, restores accounts on
// launch, and removes a box (purging its secrets). Pure orchestration over injected stores, so it is
// unit-tested with in-memory fakes; the real op-sqlite / vault implementations slot in behind the
// interfaces.

import { AccountsStore } from '../../../services/db/accountsStore';
import { SecureStore } from '../../../services/secureStore/secureStore';
import { reportFailure } from '../../../services/telemetry/telemetry';
import { isUnread } from '../../messages/state/messagesController';
import type {
  AuthMethod,
  BoxType,
  DataBoxAccount,
  Host,
  MessageEnvelope,
  OwnerInfo,
  SyncFailure,
} from '../../../services/isds/types';

export interface AddAccountInput {
  loginName: string;
  password: string;
  method: AuthMethod;
  host: Host;
  /** Optional user-set nickname entered on the add-box form. */
  alias?: string;
  ownerInfo: OwnerInfo;
  /** The session this box's login established (018); null for password boxes. */
  sessionCookie?: string | null;
}

export interface AccountsControllerDeps {
  accounts: AccountsStore;
  secureStore: SecureStore;
  now?: () => number;
  genId?: () => string;
}

export class AccountsController {
  private readonly now: () => number;
  private readonly genId: () => string;

  constructor(private readonly deps: AccountsControllerDeps) {
    this.now = deps.now ?? (() => Date.now());
    this.genId = deps.genId ?? (() => `acc_${Math.random().toString(36).slice(2, 11)}`);
  }

  /**
   * Persist a newly authenticated box. Rejects with DuplicateBoxError if already added. The account
   * row and the secrets are kept consistent: if storing either secret fails, the row is rolled back.
   *
   * With the app lock on, the secrets are sealed under a key that is only in memory while the app is
   * unlocked, so a login that finishes while the app sits locked (a Mobile Key approval in another
   * app) waits here for the unlock rather than failing.
   */
  async addAccount(input: AddAccountInput): Promise<DataBoxAccount> {
    const ts = this.now();
    const { boxId, label, dbType, passwordExpiresAt } = input.ownerInfo;
    const account: DataBoxAccount = {
      id: this.genId(),
      boxId,
      loginName: input.loginName,
      label,
      dbType,
      alias: input.alias?.trim() || null,
      authMethod: input.method,
      host: input.host,
      secretRef: boxId,
      sessionValidUntil: null,
      passwordExpiresAt,
      lastSyncedAt: null,
      messageCount: null,
      unreadCount: null,
      pdzCreditCzk: null,
      syncError: null,
      createdAt: ts,
      updatedAt: ts,
    };
    await this.deps.accounts.add(account); // throws DuplicateBoxError if boxId already present
    try {
      await this.deps.secureStore.savePassword(boxId, input.password);
      // 018: captured at THIS box's login and replayed only on its calls - sealed like the password.
      await this.deps.secureStore.saveSession(boxId, input.sessionCookie ?? null);
    } catch (e) {
      await this.deps.accounts.remove(boxId); // keep store + enclave consistent
      // A half-stored box must not leave a sealed password behind for a row that no longer exists.
      await this.deps.secureStore.deleteBox(boxId).catch(cleanup => {
        reportFailure('keychain.write', cleanup, { stage: 'native' });
      });
      throw e;
    }
    return account;
  }

  listAccounts(): Promise<DataBoxAccount[]> {
    return this.deps.accounts.list();
  }

  /** Set or clear (empty → null) a box's user-defined alias. */
  setAlias(boxId: string, alias: string | null): Promise<void> {
    const trimmed = alias?.trim();
    return this.deps.accounts.setAlias(boxId, trimmed ? trimmed : null);
  }

  /** Record a successful refresh: store the timestamp + total/unread message counts (clears the flag). */
  recordSync(boxId: string, messages: MessageEnvelope[], ts: number = this.now()): Promise<void> {
    const unread = messages.reduce((n, m) => n + (isUnread(m.state) ? 1 : 0), 0);
    return this.deps.accounts.setSyncResult(boxId, ts, messages.length, unread);
  }

  /** Record a box's PDZ credit balance (CZK) from a refresh, or null when it couldn't be fetched. */
  recordCredit(boxId: string, pdzCreditCzk: number | null): Promise<void> {
    return this.deps.accounts.setCredit(boxId, pdzCreditCzk);
  }

  /** Backfill a box's legal form (dbType) once captured on a refresh - for boxes added before it existed. */
  recordDbType(boxId: string, dbType: BoxType | null): Promise<void> {
    return this.deps.accounts.setDbType(boxId, dbType);
  }

  /** Persist a failed refresh so the box's flag survives a restart (null clears it). */
  recordSyncFailure(boxId: string, syncError: SyncFailure | null): Promise<void> {
    return this.deps.accounts.setSyncError(boxId, syncError);
  }

  /** A message in this box was just read (opened): decrement its unread badge (floored at 0). The
   *  next successful sync re-derives the true count from the server, so any drift self-corrects. */
  decrementUnread(boxId: string): Promise<void> {
    return this.deps.accounts.decrementUnread(boxId);
  }

  /**
   * Re-authenticate an existing box after its session expired (or its auth config changed). Keeps
   * the box metadata/alias/counts; refreshes the stored secret AND the auth method that actually
   * worked. The method matters because a user can turn OTP on/off on the ISDS portal after adding
   * the box - persisting the working method here keeps the UI honest and the next re-auth correct
   * (otherwise a box switched from OTP→password would still try to send an SMS).
   */
  async reauthAccount(
    boxId: string,
    password: string,
    method: AuthMethod,
    dbType: BoxType | null = null,
    sessionCookie: string | null = null,
    passwordExpiresAt: number | null = null,
  ): Promise<void> {
    await this.deps.secureStore.savePassword(boxId, password);
    await this.deps.accounts.setAuthMethod(boxId, method);
    // The session the re-auth just established replaces the dead one (018). Without this a
    // re-authenticated box would keep the cookie that had already stopped working - which is the
    // whole reason it was asked to re-authenticate. Null forgets it, for a box that became a
    // password box.
    await this.deps.secureStore.saveSession(boxId, sessionCookie);
    // Backfill the legal form for a box added before dbType was captured (re-auth re-fetches owner info).
    if (dbType) {
      await this.deps.accounts.setDbType(boxId, dbType);
    }
    // …and the password-expiry date, for the same reason and a sharper one: a re-auth is usually
    // what FOLLOWS a password change, so the stored date is the one most likely to be wrong. A
    // warning computed from a stale date is worse than no warning (001 T041).
    if (passwordExpiresAt !== null) {
      await this.deps.accounts.setPasswordExpiresAt(boxId, passwordExpiresAt);
    }
  }

  /** Remove a box: drop its metadata row and purge its secrets. */
  async removeAccount(boxId: string): Promise<void> {
    await this.removeRow(boxId);
    await this.forgetSecrets(boxId);
  }

  /**
   * The first step of removing a box: its row. Separate from `forgetSecrets` so the removal
   * (`removeBox`) knows which of the two failed - a row that stayed and a Keychain that refused are
   * different faults, and only the second leaves a box the app can no longer reach.
   */
  removeRow(boxId: string): Promise<void> {
    return this.deps.accounts.remove(boxId);
  }

  /**
   * What a removed box held outside its row: its two Keychain items, the sealed password and the
   * sealed session (001 T028).
   *
   * Not RN's shared cookie jar, which removal emptied from 2026-09-14 until 2026-09-15 (018 T010).
   * No session stays there to forget: a sign-in empties the jar once its session is taken out, and a
   * sign-in that ends before that empties it too (`IsdsHttpTransport.endHandshake`,
   * `IsdsAuthService`). All a removal could find there is a sign-in still under way - an SMS asked
   * for, a Mobile Key approval awaited - and the jar can only be emptied whole, so a removal queued
   * behind a long one, or resumed later, broke that sign-in whenever its turn came.
   */
  async forgetSecrets(boxId: string): Promise<void> {
    await this.deps.secureStore.deleteBox(boxId);
  }
}
