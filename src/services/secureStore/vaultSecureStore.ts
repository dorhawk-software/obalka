// Box secrets sealed under the vault key, one Keychain item each (001 T028, research R6b).
//
// A box's password lives in `cz.obalka.box.<boxId>` - the item it always had - and its session cookie
// (018) in `cz.obalka.session.<boxId>`. What is in either item is a seal (`seal.ts`), readable only
// with the vault key, and the vault key is behind the biometric gate whenever the app lock is on. So
// a read waits for the unlock (`Vault.useKey`) rather than answering while the app is locked.
//
// It also carries the one-time move from what earlier builds stored: a plain `{"password": …}` JSON in
// the password item, and the cookie in the accounts table's `sessionCookie` column. That migration has
// to be boring in the way only a migration of credentials has to be - idempotent, resumable after a
// crash at any line, and never the reason a password is gone.

import { reportFailure } from '../telemetry/telemetry';
import { SealError, isSealed, openSecret, sealSecret, type SecretKind } from './seal';
import { isPermanentKeyLoss } from './vault';
import type { SecretRead, SecureStore } from './secureStore';

/** One string per Keychain service. Every method may throw. */
export interface SecretItems {
  get(service: string): Promise<string | null>;
  set(service: string, value: string): Promise<void>;
  remove(service: string): Promise<void>;
}

/** The cookies earlier builds kept in the accounts table (migration 13), for the move out of it. */
export interface LegacySessionCookies {
  legacySessionCookies(): Promise<{ boxId: string; sessionCookie: string }[]>;
  clearLegacySessionCookie(boxId: string): Promise<void>;
}

export interface VaultSecureStoreDeps {
  vault: {
    useKey(signal?: AbortSignal): Promise<Uint8Array>;
    discardIfLockOff(): Promise<void>;
  };
  items: SecretItems;
  /** The boxes the accounts table holds, by boxId. */
  boxIds: () => Promise<string[]>;
  legacySessions: LegacySessionCookies;
}

const passwordService = (boxId: string) => `cz.obalka.box.${boxId}`;
/** The plain password, kept only while the migration proves its sealed replacement reads back. */
const plainCopyService = (boxId: string) => `cz.obalka.box.${boxId}.plain`;
const sessionService = (boxId: string) => `cz.obalka.session.${boxId}`;

const serviceFor = (kind: SecretKind, boxId: string) =>
  kind === 'password' ? passwordService(boxId) : sessionService(boxId);

const ABSENT: SecretRead = { status: 'absent' };
const LOST: SecretRead = { status: 'lost' };
const UNAVAILABLE: SecretRead = { status: 'unavailable' };

/** The shape every build before the vault wrote into a password item. */
function parsePlainPassword(stored: string): string | null {
  try {
    const parsed = JSON.parse(stored) as { password?: unknown };
    return typeof parsed?.password === 'string' ? parsed.password : null;
  } catch {
    return null;
  }
}

/** Resolves true once `work` settles, or false as soon as `signal` aborts - whichever comes first. */
function settledUnlessAborted(work: Promise<void>, signal?: AbortSignal): Promise<boolean> {
  if (!signal) {
    return work.then(() => true);
  }
  if (signal.aborted) {
    return Promise.resolve(false);
  }
  return new Promise<boolean>(resolve => {
    const onAbort = () => resolve(false);
    signal.addEventListener('abort', onAbort);
    void work.then(() => {
      signal.removeEventListener('abort', onAbort);
      resolve(true);
    });
  });
}

export class VaultSecureStore implements SecureStore {
  private preparing: Promise<void> | null = null;
  /** Boxes whose cookie is still in the accounts table after this launch's migration. */
  private readonly legacySessionsLeft = new Set<string>();
  /**
   * Whether this launch's migration got as far as listing the table's cookies. Until it has, any row
   * may still hold one - a Keychain that failed at launch must not turn every cookie box into a
   * signed-out box - so the column is consulted, and cleared on a save, for every box.
   */
  private sessionsListed = false;
  private readonly lostListeners = new Set<() => void>();
  private lostSeen = false;
  private lostAcknowledged = false;

  constructor(private readonly deps: VaultSecureStoreDeps) {}

  /**
   * Bring what earlier builds stored under the vault, once per launch. Every read, save and delete
   * waits for it, so nothing can observe a half-moved secret; `AppShell` also starts it at launch.
   * Never rejects - a box whose move fails keeps its old copy, stays usable, and is tried again on
   * the next launch.
   */
  prepare(): Promise<void> {
    this.preparing ??= this.migrate().catch(e => {
      reportFailure('keychain.write', e, { stage: 'crypto' });
    });
    return this.preparing;
  }

  async savePassword(boxId: string, password: string): Promise<void> {
    await this.prepare();
    const key = await this.deps.vault.useKey();
    try {
      await this.deps.items.set(passwordService(boxId), sealSecret(key, 'password', boxId, password));
    } finally {
      key.fill(0);
    }
    // A plain copy a failed migration left behind is now older than the password it would restore.
    await this.deps.items.remove(plainCopyService(boxId));
  }

  readPassword(boxId: string, signal?: AbortSignal): Promise<SecretRead> {
    return this.read('password', boxId, signal);
  }

  async saveSession(boxId: string, sessionCookie: string | null): Promise<void> {
    await this.prepare();
    if (sessionCookie === null) {
      await this.deps.items.remove(sessionService(boxId));
    } else {
      const key = await this.deps.vault.useKey();
      try {
        await this.deps.items.set(
          sessionService(boxId),
          sealSecret(key, 'session', boxId, sessionCookie),
        );
      } finally {
        key.fill(0);
      }
    }
    if (!this.sessionsListed || this.legacySessionsLeft.has(boxId)) {
      // The column may still hold an older session; the one just stored replaces it. Writes NULL
      // only, and only where a value is left.
      await this.deps.legacySessions.clearLegacySessionCookie(boxId);
      this.legacySessionsLeft.delete(boxId);
    }
  }

  readSession(boxId: string, signal?: AbortSignal): Promise<SecretRead> {
    return this.read('session', boxId, signal);
  }

  /** Delete the box's password, session and any plain copy. Every one is attempted; the first failure is rethrown. */
  async deleteBox(boxId: string): Promise<void> {
    // After the migration, so a move still running cannot write a seal for a box already removed.
    await this.prepare();
    let failure: unknown = null;
    for (const service of [
      passwordService(boxId),
      plainCopyService(boxId),
      sessionService(boxId),
    ]) {
      try {
        await this.deps.items.remove(service);
      } catch (e) {
        failure ??= e;
      }
    }
    this.legacySessionsLeft.delete(boxId);
    if (failure !== null) {
      throw failure;
    }
  }

  /**
   * Be told when a secret turned out to be sealed under a key this phone no longer has.
   *
   * Fires once for the session (and at once, if it already happened before this listener arrived),
   * until `acknowledgeLost` - one explanation is owed, not one per box per refresh.
   */
  subscribeLost(listener: () => void): () => void {
    this.lostListeners.add(listener);
    if (this.lostSeen && !this.lostAcknowledged) {
      listener();
    }
    return () => {
      this.lostListeners.delete(listener);
    };
  }

  acknowledgeLost(): void {
    this.lostAcknowledged = true;
  }

  // --- Internals ---------------------------------------------------------------------------------

  private async read(kind: SecretKind, boxId: string, signal?: AbortSignal): Promise<SecretRead> {
    // The migration waits for the unlock as well, so a read abandoned while it waits is abandoned
    // there - not left hanging until somebody unlocks the app.
    if (!(await settledUnlessAborted(this.prepare(), signal))) {
      return UNAVAILABLE;
    }
    let key: Uint8Array;
    try {
      key = await this.deps.vault.useKey(signal);
    } catch {
      // Abandoned while the app was locked, or no key could be had. Either way the secret itself may
      // be fine, and "absent" here would send a working box to re-authentication.
      return UNAVAILABLE;
    }
    try {
      const stored = await this.deps.items.get(serviceFor(kind, boxId));
      if (stored === null) {
        return kind === 'session' ? await this.legacySession(boxId) : ABSENT;
      }
      if (!isSealed(stored)) {
        if (kind === 'session') {
          reportFailure('keychain.read', new Error('A stored session is not sealed.'), {
            stage: 'crypto',
          });
          return ABSENT;
        }
        // Not migrated yet - its move failed this launch and is retried on the next. Still usable,
        // at exactly the exposure it had before the vault.
        const plain = parsePlainPassword(stored);
        if (plain === null) {
          reportFailure('keychain.read', new Error('A stored password is in no known shape.'), {
            stage: 'crypto',
          });
          return ABSENT;
        }
        return { status: 'found', value: plain };
      }
      return { status: 'found', value: openSecret(key, kind, boxId, stored) };
    } catch (e) {
      if (e instanceof SealError) {
        if (e.reason === 'keyMismatch') {
          this.noteLost();
          return LOST;
        }
        // Reported, because `absent` sends the user to sign in again, and this is the only trace of
        // WHY. The message never quotes the secret: a SealError carries only its reason.
        reportFailure('keychain.read', e, { stage: 'crypto' });
        return e.reason === 'version' ? UNAVAILABLE : ABSENT;
      }
      if (isPermanentKeyLoss(e)) {
        // This item's own key, not the vault key. On Android every Keychain item is encrypted under a
        // Keystore key of its own, and the two can part: the Keystore key lost while the item
        // survives. react-native-keychain then makes a new key under the same alias, and every read
        // of the item fails its authentication tag until the item is written again - the words the
        // vault key's own loss is recognised by. Rethrown as "unavailable", the box said "try again"
        // for ever and was never asked to sign in. Lost for this box only: the vault key and every
        // other item are fine, so nothing is said about the phone losing its key (`noteLost`), and
        // nothing is deleted - signing in again writes the item over. Any other Keychain error proves
        // nothing and stays "unavailable" below.
        reportFailure('keychain.read', e, { stage: 'crypto' });
        return LOST;
      }
      reportFailure('keychain.read', e, { stage: 'native' });
      return UNAVAILABLE;
    } finally {
      key.fill(0);
    }
  }

  /** A cookie whose move out of the accounts table failed this launch is still used from there. */
  private async legacySession(boxId: string): Promise<SecretRead> {
    if (this.sessionsListed && !this.legacySessionsLeft.has(boxId)) {
      return ABSENT;
    }
    const left = (await this.deps.legacySessions.legacySessionCookies()).find(
      c => c.boxId === boxId,
    );
    return left ? { status: 'found', value: left.sessionCookie } : ABSENT;
  }

  private noteLost(): void {
    this.lostSeen = true;
    if (this.lostAcknowledged) {
      return;
    }
    for (const listener of [...this.lostListeners]) {
      listener();
    }
  }

  private async migrate(): Promise<void> {
    const boxIds = await this.deps.boxIds();
    if (boxIds.length === 0) {
      // No row, so no cookie column to move either.
      this.sessionsListed = true;
      // No box, so no secret the app could ever look up depends on the key. Keychain items outlive an
      // iOS reinstall while the database does not, and a stale key there would otherwise resurface as
      // a surprise unlock the first time a box is added.
      await this.deps.vault.discardIfLockOff();
      return;
    }
    // The key BEFORE any plain value is read: with the lock on this waits for the unlock, so not even
    // the migration touches a password while the app is locked.
    const key = await this.deps.vault.useKey();
    try {
      for (const boxId of boxIds) {
        try {
          await this.migratePassword(key, boxId);
        } catch (e) {
          reportFailure('keychain.write', e, { stage: 'crypto' });
        }
      }
      let cookies: { boxId: string; sessionCookie: string }[];
      try {
        cookies = await this.deps.legacySessions.legacySessionCookies();
      } catch (e) {
        // Unknown what the table holds: `sessionsListed` stays false, so reads still look there.
        reportFailure('db.read', e, { stage: 'persist' });
        return;
      }
      for (const cookie of cookies) {
        try {
          await this.migrateSession(key, cookie.boxId, cookie.sessionCookie);
        } catch (e) {
          this.legacySessionsLeft.add(cookie.boxId);
          reportFailure('keychain.write', e, { stage: 'crypto' });
        }
      }
      this.sessionsListed = true;
    } finally {
      key.fill(0);
    }
  }

  /**
   * Plain password → sealed, in the same item. The plain value is copied aside first and deleted only
   * once the seal has been read back and opened to the same password, so a crash between any two
   * lines leaves at least one intact copy for the next launch to finish from.
   */
  private async migratePassword(key: Uint8Array, boxId: string): Promise<void> {
    const { items } = this.deps;
    const main = await items.get(passwordService(boxId));
    const copy = await items.get(plainCopyService(boxId));

    if (main !== null && isSealed(main)) {
      if (copy === null) {
        return; // already migrated
      }
      // A run that stopped after writing the seal - or a `savePassword` that stopped before removing a
      // copy an earlier failed run left. The copy wins only when the seal does not open at all: a seal
      // that opens to a DIFFERENT password was written after the copy was taken, so it is the newer
      // one, and restoring the copy would put an old password back over a new one.
      const plain = parsePlainPassword(copy);
      if (plain !== null && !this.opens(key, 'password', boxId, main)) {
        await this.writeVerified(key, 'password', boxId, plain);
      }
      await items.remove(plainCopyService(boxId));
      return;
    }

    const source = main ?? copy;
    if (source === null) {
      return; // nothing stored for this box
    }
    const plain = parsePlainPassword(source);
    if (plain === null) {
      // Left exactly as found: an unknown shape is not ours to overwrite.
      throw new Error('A stored password is in no known shape.');
    }
    if (main !== null && copy === null) {
      await items.set(plainCopyService(boxId), main);
      if ((await items.get(plainCopyService(boxId))) !== main) {
        throw new Error('The plain password copy did not read back.');
      }
    }
    await this.writeVerified(key, 'password', boxId, plain);
    await items.remove(plainCopyService(boxId));
  }

  /**
   * Database cookie → sealed item. The column is cleared only once the seal has been read back and
   * opened; a sealed session that already opens is newer than the column and wins.
   */
  private async migrateSession(key: Uint8Array, boxId: string, cookie: string): Promise<void> {
    const existing = await this.deps.items.get(sessionService(boxId));
    if (existing === null || !this.opens(key, 'session', boxId, existing)) {
      await this.writeVerified(key, 'session', boxId, cookie);
    }
    await this.deps.legacySessions.clearLegacySessionCookie(boxId);
  }

  private async writeVerified(
    key: Uint8Array,
    kind: SecretKind,
    boxId: string,
    plaintext: string,
  ): Promise<void> {
    const service = serviceFor(kind, boxId);
    await this.deps.items.set(service, sealSecret(key, kind, boxId, plaintext));
    const back = await this.deps.items.get(service);
    if (back === null || !this.opensTo(key, kind, boxId, back, plaintext)) {
      throw new Error(`The sealed ${kind} did not read back.`);
    }
  }

  private opens(key: Uint8Array, kind: SecretKind, boxId: string, stored: string): boolean {
    try {
      openSecret(key, kind, boxId, stored);
      return true;
    } catch {
      return false;
    }
  }

  private opensTo(
    key: Uint8Array,
    kind: SecretKind,
    boxId: string,
    stored: string,
    expected: string,
  ): boolean {
    try {
      return openSecret(key, kind, boxId, stored) === expected;
    } catch {
      return false;
    }
  }
}

/**
 * The Keychain for tests: a map of services, a log of writes, and a way to make one write or delete
 * fail - which is how a crash between two steps is simulated.
 */
export class InMemorySecretItems implements SecretItems {
  readonly values = new Map<string, string>();
  readonly log: string[] = [];
  /** Throws (once per matching call) when it returns true for an operation and service. */
  failWhen: ((op: 'get' | 'set' | 'remove', service: string) => boolean) | null = null;
  /**
   * Items whose own Keystore key Android lost while the item survived: every read fails its
   * authentication tag, as react-native-keychain reports it, until the item is written or removed.
   */
  readonly keyLost = new Set<string>();

  async get(service: string): Promise<string | null> {
    this.maybeFail('get', service);
    if (this.keyLost.has(service) && this.values.has(service)) {
      throw new Error(
        'Decryption failed: Authentication tag verification failed. This usually indicates that the encrypted data was modified, corrupted, or is being decrypted with the wrong key.',
      );
    }
    return this.values.get(service) ?? null;
  }

  async set(service: string, value: string): Promise<void> {
    this.maybeFail('set', service);
    this.values.set(service, value);
    this.keyLost.delete(service);
    this.log.push(`set ${service}`);
  }

  async remove(service: string): Promise<void> {
    this.maybeFail('remove', service);
    this.keyLost.delete(service);
    if (this.values.delete(service)) {
      this.log.push(`remove ${service}`);
    }
  }

  private maybeFail(op: 'get' | 'set' | 'remove', service: string): void {
    if (this.failWhen?.(op, service)) {
      throw new Error(`simulated Keychain failure: ${op} ${service}`);
    }
  }
}
