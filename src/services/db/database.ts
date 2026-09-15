// The shared encrypted SQLite database (op-sqlite + SQLCipher). One DB, opened once, migrated once,
// shared by every store (accounts, messages, settings). Encrypted at rest with a 256-bit key from a
// CSPRNG kept in the Keychain, so the file is unreadable without the device's secure enclave.

import 'react-native-get-random-values';
import { open } from '@op-engineering/op-sqlite';
import * as Keychain from 'react-native-keychain';
import { runMigrations } from './migrations';
import { reportFailure } from '../telemetry/telemetry';

export type DB = ReturnType<typeof open>;

const DB_NAME = 'obalka.db';
const DB_KEY_SERVICE = 'cz.obalka.dbkey';

/** Get the DB encryption key from the Keychain, generating + storing one on first run. */
async function getOrCreateDbKey(): Promise<string> {
  const existing = await Keychain.getGenericPassword({ service: DB_KEY_SERVICE });
  if (existing) {
    return existing.password;
  }
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  const key = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  await Keychain.setGenericPassword('dbkey', key, {
    service: DB_KEY_SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return key;
}

let dbPromise: Promise<DB> | null = null;

/**
 * Lazily open + migrate the shared DB (singleton). All stores await this.
 *
 * An open that failed is NOT kept (2026-09-24). The key is read from the Keychain, and a Keychain can
 * fail and then answer - a vendor Keystore bug, or react-native-keychain after a reload ("multiple
 * DataStores active"). A rejected promise held here answered every later read with the same failure,
 * so no retry on any screen could ever succeed without killing the app. A failed read still never
 * makes a new key (`getOrCreateDbKey` generates one only when the Keychain answers "no item").
 */
export function getDb(): Promise<DB> {
  if (!dbPromise) {
    const opening = (async () => {
      const encryptionKey = await getOrCreateDbKey();
      const db = open({ name: DB_NAME, encryptionKey });
      try {
        await db.execute('PRAGMA journal_mode = WAL;');
        await runMigrations(db); // runs only the migrations this DB hasn't applied yet
      } catch (e) {
        // The next attempt opens a connection of its own; this one would only be left dangling.
        try {
          db.close();
        } catch {
          // The failure being rethrown is the one worth reporting.
        }
        throw e;
      }
      return db;
    })();
    dbPromise = opening;
    opening.catch(() => {
      if (dbPromise === opening) {
        dbPromise = null;
      }
    });
  }
  return dbPromise;
}

/**
 * Where the database file is, as op-sqlite itself resolves it - once the DB is open (2026-09-24).
 *
 * Asked of the open connection rather than rebuilt from a directory, so the answer cannot drift from
 * op-sqlite's own choice: on iOS it is the app's `Library` directory, which the phone's backup
 * includes. The launch step that keeps the archive out of that backup is the reader.
 */
export async function getDbFilePath(): Promise<string> {
  return (await getDb()).getDbPath();
}

/**
 * Run `fn` inside one SQLite transaction (006): everything it writes lands together, or nothing does.
 *
 * The one caller is the backup restore, and that is the reason this exists at all - a restore that
 * fails halfway would leave an archive holding some of one phone's messages and some of another's,
 * which is precisely the state Principle IV says must not be reachable. Not re-entrant: SQLite has no
 * nested BEGIN, so this must not be called from inside itself.
 */
export async function withTransaction<T>(fn: () => Promise<T>): Promise<T> {
  const db = await getDb();
  await db.execute('BEGIN');
  try {
    const result = await fn();
    await db.execute('COMMIT');
    return result;
  } catch (err) {
    // Best-effort: if the rollback itself fails there is nothing further to try, and the original
    // error is the one worth reporting.
    await db.execute('ROLLBACK').catch(rollbackError => {
      // A failed ROLLBACK is the one case this function exists to prevent: the transaction stays
      // open and the archive is left holding half a restore. It is also the only failure here that
      // nothing downstream can detect, since the caller only ever sees `err`.
      reportFailure('db.write', rollbackError, { stage: 'persist' });
    });
    throw err;
  }
}
