import { measure } from '../telemetry/telemetry';

// A small Flyway-style migration runner for the encrypted SQLite DB. Each migration has a unique,
// monotonically increasing `version`; the runner records applied versions in `schema_migrations`
// and on every open executes ONLY the versions not yet applied - so a user upgrading the app runs
// just the new scripts, never re-running old ones (which is what the ad-hoc CREATE-IF-NOT-EXISTS +
// "ALTER if column missing" checks were fragilely emulating).
//
// Conventions:
//   - Version 1 is the BASELINE: the full schema as it stood before migrations existed, via
//     CREATE TABLE IF NOT EXISTS. A fresh install creates everything; a DB from a pre-migration
//     build already has the tables, so v1 is a recorded no-op. Either way both reach v1.
//   - Every later change is a NEW version (2, 3, …) with its own ALTER/CREATE. **Never edit a
//     migration that has shipped** - add the next version instead.

/** Minimal slice of the op-sqlite DB the runner needs (so it is unit-testable with a fake). */
export interface MigrationDb {
  execute(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Array<Record<string, unknown>> }>;
}

export interface Migration {
  version: number;
  name: string;
  statements: string[];
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'baseline',
    statements: [
      `CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY NOT NULL,
        boxId TEXT NOT NULL UNIQUE,
        loginName TEXT NOT NULL,
        label TEXT NOT NULL,
        alias TEXT,
        authMethod TEXT NOT NULL,
        host TEXT NOT NULL DEFAULT 'czebox',
        secretRef TEXT NOT NULL,
        sessionValidUntil INTEGER,
        passwordExpiresAt INTEGER,
        lastSyncedAt INTEGER,
        messageCount INTEGER,
        unreadCount INTEGER,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT
      );`,
    ],
  },
  {
    version: 2,
    name: 'account_sync_error',
    // Persist the last refresh failure per box ('reauth' | 'error') so a box that needs re-auth
    // still shows its flag (and is skipped by refresh-all) after an app restart.
    statements: ['ALTER TABLE accounts ADD COLUMN syncError TEXT;'],
  },
  {
    version: 3,
    name: 'cached_messages',
    // Offline-first archive: every synced envelope is cached here so the message list is viewable
    // offline. When a message is downloaded (MessageDownload), its full detail + attachment content
    // is stored as `detailJson` and `downloadedAt` is set - so that message (and its attachments) is
    // available offline. A row with `detailJson = NULL` is list-only (not yet downloaded).
    statements: [
      `CREATE TABLE IF NOT EXISTS messages (
        boxId TEXT NOT NULL,
        messageId TEXT NOT NULL,
        subject TEXT,
        sender TEXT,
        senderAddress TEXT,
        deliveryTime INTEGER,
        acceptanceTime INTEGER,
        state INTEGER,
        attachmentSize INTEGER,
        detailJson TEXT,
        downloadedAt INTEGER,
        syncedAt INTEGER NOT NULL,
        PRIMARY KEY (boxId, messageId)
      );`,
    ],
  },
  {
    version: 4,
    name: 'cached_message_recipient',
    // The detail view renders its envelope from the cached list (no download needed); cache the
    // recipient + address so it is shown offline too.
    statements: [
      'ALTER TABLE messages ADD COLUMN recipient TEXT;',
      'ALTER TABLE messages ADD COLUMN recipientAddress TEXT;',
    ],
  },
  {
    version: 5,
    name: 'message_search_text',
    // Local archive search (004): a normalized (lower-cased, diacritics stripped) concatenation of the
    // envelope's searchable fields, populated on each sync. Searching is a substring match on this -
    // adequate + diacritic-insensitive for short envelope metadata (no large bodies → FTS5 unneeded).
    // Existing rows get it on their next sync (auto-sync-on-launch re-caches the list).
    statements: ['ALTER TABLE messages ADD COLUMN searchText TEXT;'],
  },
  {
    version: 6,
    name: 'drafts',
    // Compose drafts (feature 005): a saved-but-unsent message (recipient + subject). Attachments are
    // NOT persisted in v1 (they're re-added on resume) - large base64 blobs don't belong in the DB.
    statements: [
      `CREATE TABLE IF NOT EXISTS drafts (
        id TEXT PRIMARY KEY NOT NULL,
        boxId TEXT NOT NULL,
        recipientBoxId TEXT,
        recipientLabel TEXT,
        recipientDbType TEXT,
        subject TEXT,
        updatedAt INTEGER NOT NULL
      );`,
    ],
  },
  {
    version: 7,
    name: 'draft_body',
    // The typed message body (feature 005, FR-005: text → "Textová zpráva.pdf"). Persisted so a saved
    // draft restores the user's text, not just the subject. Existing drafts get NULL → empty on resume.
    statements: ['ALTER TABLE drafts ADD COLUMN body TEXT;'],
  },
  {
    version: 8,
    name: 'message_folder',
    // Sent messages (feature 008): which ISDS list a cached message came from, so a box's received +
    // sent folders don't interleave. Existing rows are received (NULL ⇒ 'received' via COALESCE in
    // the store query). Received + sent dmIDs are globally unique, so the (boxId, messageId) key holds.
    statements: ['ALTER TABLE messages ADD COLUMN folder TEXT;'],
  },
  {
    version: 9,
    name: 'account_pdz_credit',
    // The box's PDZ credit balance (CZK), shown on the box overview. Fetched per box on refresh
    // (DataBoxCreditInfo). REAL because a balance can be fractional. Existing rows are NULL until
    // their next refresh fetches it.
    statements: ['ALTER TABLE accounts ADD COLUMN pdzCreditCzk REAL;'],
  },
  {
    version: 10,
    name: 'account_db_type',
    // The box's legal form (dbType: OVM/FO/PFO/PO), shown as "{type} · ID {boxId}" in the switcher.
    // Captured from GetOwnerInfoFromLogin at login/re-auth; existing rows are NULL until backfilled on
    // their next refresh.
    statements: ['ALTER TABLE accounts ADD COLUMN dbType TEXT;'],
  },
  {
    version: 11,
    name: 'reminders',
    // User-set deadlines (feature 010 US2). A SEPARATE table, not a column on `messages`, for two
    // reasons: `cacheList` rewrites that table on every list sync, so user-owned state there is one
    // careless upsert from silent loss; and a reminder must OUTLIVE the message content it hangs on -
    // ISDS erases at 90 days (state 9) and the reminder is still the user's own note.
    //
    // One reminder per message (the PK), so setting a new date replaces rather than accumulates.
    // Only the DATE is stored: the two notification instants and both notification ids are derived
    // (see `reminders.ts`), so changing the reminder schedule later needs no migration.
    statements: [
      `CREATE TABLE IF NOT EXISTS reminders (
        boxId TEXT NOT NULL,
        messageId TEXT NOT NULL,
        date INTEGER NOT NULL,
        createdBy TEXT NOT NULL DEFAULT 'user',
        createdAt INTEGER NOT NULL,
        PRIMARY KEY (boxId, messageId)
      );`,
      'CREATE INDEX IF NOT EXISTS idx_reminders_box ON reminders (boxId);',
    ],
  },
  {
    version: 12,
    name: 'draft_recipient_address',
    // The picked recipient's address, kept on the draft (feature 015).
    //
    // A draft restores its recipient from these columns without re-running the search, so without
    // this the address would be gone on reopen - and the row would then render "Adresa neuvedena",
    // which would be a LIE: ISDS did give one, we just failed to keep it. Storing it is cheaper than
    // teaching the UI to distinguish "the register has none" from "we lost it" (Principle VI).
    statements: ['ALTER TABLE drafts ADD COLUMN recipientAddress TEXT;'],
  },
  {
    version: 13,
    name: 'account_session_cookie',
    // Each box's own ISDS session (feature 018).
    //
    // OTP and Mobile Key boxes authenticate their WS calls with a cookie set at login. React
    // Native's native cookie jar is per DOMAIN, so with two such boxes the second login overwrites
    // the first's cookie - and the first box then either 401s or rides the second box's session,
    // which would show one person's mail under another person's identity.
    //
    // Stored HERE rather than in the keychain because the keychain implementation is biometric-gated
    // per read, and a fingerprint prompt per WS call is unusable. This database is encrypted and
    // already holds the mail the session grants access to, so the session is no more exposed than
    // what it unlocks - and strictly better protected than the unencrypted native jar it replaces.
    //
    // Superseded by 001 T028 (2026-09-15), and left as shipped: the database key is readable whenever
    // the phone is unlocked, so a session here stayed readable while the app lock was on. Sessions are
    // now sealed under the vault key in the Keychain; `VaultSecureStore` moves any value found here
    // out once and empties the column, and nothing writes it again.
    statements: ['ALTER TABLE accounts ADD COLUMN sessionCookie TEXT;'],
  },
  {
    version: 14,
    name: 'message_opened_at',
    // When the USER opened a message on this device (feature-less; 2026-09-09 critique).
    //
    // `state` is the server's truth and stays that way: `markRead` only flips it once ISDS confirms
    // MarkMessageAsDownloaded, which is correct - the read state has legal weight and this app does
    // not get to assert it. But the consequence was that reading offline changed nothing at all. A
    // commuter who read eight messages on the metro arrived with the same "8" in the attention
    // group, because the group keys off `state`. The one number the design makes loudest was the
    // one the user had least control over.
    //
    // This column is the local half: it records that the user opened the message HERE, so the
    // attention group can stop nagging about it. It never touches `state`, never claims delivery,
    // and is reconciled by the next successful sync, which brings the server's answer as always.
    statements: ['ALTER TABLE messages ADD COLUMN openedAt INTEGER;'],
  },
  {
    version: 15,
    name: 'message_first_seen_at',
    // When a listing first brought this message onto this device (026 FR-004).
    //
    // Automatic attachment download can be switched on for "new messages only", and "new" has to mean
    // new to this phone - not delivered after some date, which would skip a message delivered while
    // the box went unrefreshed for a week. Written once, on the insert, and never updated. Rows from
    // before this migration, from a restore and from a phone transfer have none, which is what makes
    // them count as already present.
    statements: ['ALTER TABLE messages ADD COLUMN firstSeenAt INTEGER;'],
  },
];

/**
 * Apply all migrations not yet recorded, in version order. Returns how many were applied. Throws if
 * a statement fails (the DB is left at the last successfully recorded version).
 */
export async function runMigrations(
  db: MigrationDb,
  now: () => number = () => Date.now(),
): Promise<number> {
  return measure('db.migrate', () => runMigrationsInner(db, now), {
    stage: 'persist',
  });
}

/**
 * Timed by the wrapper above, because a migration runs on the launch path over an archive that is
 * meant to grow for years - and "the app froze on startup" is the single most-cited complaint about
 * the incumbent this one exists to replace (Principle I's rationale).
 */
async function runMigrationsInner(
  db: MigrationDb,
  now: () => number = () => Date.now(),
): Promise<number> {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      appliedAt INTEGER NOT NULL
    );`,
  );
  const res = await db.execute('SELECT version FROM schema_migrations');
  const applied = new Set(res.rows.map(r => Number(r.version)));
  const pending = MIGRATIONS.filter(m => !applied.has(m.version)).sort(
    (a, b) => a.version - b.version,
  );
  for (const m of pending) {
    for (const sql of m.statements) {
      await db.execute(sql);
    }
    await db.execute(
      'INSERT INTO schema_migrations (version, name, appliedAt) VALUES (?, ?, ?)',
      [m.version, m.name, now()],
    );
  }
  return pending.length;
}
