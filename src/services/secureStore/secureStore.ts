// Secure secret storage (feature 001, T008 and T028; constitution Principle III).
//
// Interface + in-memory implementation used by the controllers and tests. On a phone the store is
// `VaultSecureStore`: each box's password and session cookie is its own Keychain item, sealed under
// the vault key - which, with the app lock on, sits behind the biometric gate and is held in memory
// only while the app is unlocked (research R6b).

import type { AuthMethod } from '../isds/types';

/**
 * What reading a secret found.
 *
 * FOUR answers, because the two that mean "sign in again" and the one that must never mean it used to
 * be a single `null`:
 * - `found` - here it is.
 * - `absent` - nothing is stored (or what is stored is damaged beyond use). Sign in again.
 * - `lost` - it was sealed under a vault key this phone no longer has (the screen lock was removed or
 *   changed). Sign in again - and the user is owed the reason. Also, for that one box only, an item
 *   whose own Android Keystore key was lost: the vault key is fine, and so is every other box.
 * - `unavailable` - it could not be read right now: the read was abandoned while the app was locked,
 *   or the Keychain failed. The secret may be perfectly fine. Never a reason to re-authenticate.
 */
export type SecretRead =
  | { status: 'found'; value: string }
  | { status: 'absent' }
  | { status: 'lost' }
  | { status: 'unavailable' };

export interface SecureStore {
  savePassword(boxId: string, password: string): Promise<void>;
  /** Waits while the app is locked; `signal` abandons the wait as `unavailable`. */
  readPassword(boxId: string, signal?: AbortSignal): Promise<SecretRead>;
  /** Store the session this box's login established (018), or with null forget it. */
  saveSession(boxId: string, sessionCookie: string | null): Promise<void>;
  /** Waits while the app is locked; `signal` abandons the wait as `unavailable`. */
  readSession(boxId: string, signal?: AbortSignal): Promise<SecretRead>;
  /** Delete everything stored for the box: its password and its session. */
  deleteBox(boxId: string): Promise<void>;
}

/**
 * The stored credential could not be read right now (`unavailable`).
 *
 * Thrown by `credentialsFor` so the controllers' existing error mapping turns it into a plain, retryable
 * error - and, crucially, not into the `reauth` outcome a missing credential produces.
 */
export class CredentialsUnavailableError extends Error {
  constructor() {
    super('The stored credentials could not be read right now.');
    this.name = 'CredentialsUnavailableError';
  }
}

/**
 * The credentials one ISDS WS call needs, read at call time.
 *
 * A password box re-authenticates with HTTP Basic on every call and holds no session; every other box
 * rides its own session cookie and sends no password (018). A secret that is `absent` or `lost` comes
 * back as null, which the transport answers as an auth fault - the box asks to be signed in again, as
 * it always has for a missing credential. `unavailable` throws instead.
 */
export async function credentialsFor(
  store: Pick<SecureStore, 'readPassword' | 'readSession'>,
  account: { boxId: string; authMethod: AuthMethod },
  signal?: AbortSignal,
): Promise<{ password: string | null; sessionCookie: string | null }> {
  if (account.authMethod === 'password') {
    return {
      password: valueOrNull(await store.readPassword(account.boxId, signal)),
      sessionCookie: null,
    };
  }
  return {
    password: null,
    sessionCookie: valueOrNull(await store.readSession(account.boxId, signal)),
  };
}

function valueOrNull(read: SecretRead): string | null {
  if (read.status === 'found') {
    return read.value;
  }
  if (read.status === 'unavailable') {
    throw new CredentialsUnavailableError();
  }
  return null;
}

/** Deterministic, dependency-free implementation for tests and previews. Secrets are not persisted. */
export class InMemorySecureStore implements SecureStore {
  private passwords = new Map<string, string>();
  private sessions = new Map<string, string>();

  async savePassword(boxId: string, password: string): Promise<void> {
    this.passwords.set(boxId, password);
  }

  async readPassword(boxId: string): Promise<SecretRead> {
    return found(this.passwords.get(boxId));
  }

  async saveSession(boxId: string, sessionCookie: string | null): Promise<void> {
    if (sessionCookie === null) {
      this.sessions.delete(boxId);
    } else {
      this.sessions.set(boxId, sessionCookie);
    }
  }

  async readSession(boxId: string): Promise<SecretRead> {
    return found(this.sessions.get(boxId));
  }

  async deleteBox(boxId: string): Promise<void> {
    this.passwords.delete(boxId);
    this.sessions.delete(boxId);
  }
}

function found(value: string | undefined): SecretRead {
  return value === undefined ? { status: 'absent' } : { status: 'found', value };
}
