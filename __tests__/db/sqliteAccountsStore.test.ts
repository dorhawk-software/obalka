// What the device store reads back for a box's last refresh failure (001 FR-009), and what it does
// with the session cookies earlier builds kept in the accounts table (001 T028).
//
// The flag is persisted so a box that needs the user survives a restart: the switcher still marks
// it, and refresh-all still skips it instead of sending ISDS a password it has already refused.
// That only holds if `rowToAccount` recognises every value `SyncFailure` can take - an unknown one
// is read as "no failure", which is the right answer for garbage and exactly the wrong one for
// `passwordExpired`. The native SQLCipher engine cannot run under jest, so `getDb` hands the store
// the rows directly and records the statements; this checks the mapping and the statements' shape,
// not SQLite.

import type { DataBoxAccount } from '../../src/services/isds/types';

const mockRows: Record<string, unknown>[] = [];
const mockExecuted: { sql: string; params?: unknown[] }[] = [];

jest.mock('../../src/services/db/database', () => ({
  getDb: async () => ({
    execute: async (sql: string, params?: unknown[]) => {
      mockExecuted.push({ sql, params });
      return {
        rows:
          sql.startsWith('SELECT * FROM accounts') ||
          sql.startsWith('SELECT boxId, sessionCookie')
            ? mockRows
            : [],
        rowsAffected: 0,
      };
    },
  }),
}));

import { SqliteAccountsStore } from '../../src/services/db/sqliteAccountsStore';

const row = (boxId: string, syncError: unknown): Record<string, unknown> => ({
  id: boxId,
  boxId,
  loginName: `login-${boxId}`,
  label: boxId,
  dbType: null,
  alias: null,
  authMethod: 'password',
  host: 'czebox',
  secretRef: boxId,
  sessionValidUntil: null,
  sessionCookie: null,
  passwordExpiresAt: 1,
  lastSyncedAt: null,
  messageCount: null,
  unreadCount: null,
  pdzCreditCzk: null,
  syncError,
  createdAt: 1,
  updatedAt: 1,
});

beforeEach(() => {
  mockRows.length = 0;
  mockExecuted.length = 0;
});

describe('SqliteAccountsStore reads the stored refresh failure back', () => {
  it('keeps every failure the app writes, including an expired password', async () => {
    mockRows.push(row('a', 'reauth'), row('b', 'passwordExpired'), row('c', 'error'));
    const read = await new SqliteAccountsStore().list();
    const flags: DataBoxAccount['syncError'][] = read.map(a => a.syncError);
    expect(flags).toEqual(['reauth', 'passwordExpired', 'error']);
  });

  it('reads anything else as no failure', async () => {
    mockRows.push(row('a', null), row('b', 'expired'), row('c', 42));
    const read = await new SqliteAccountsStore().list();
    expect(read.map(a => a.syncError)).toEqual([null, null, null]);
  });
});

describe('the session cookies earlier builds kept in the table (001 T028)', () => {
  it('no longer reads a cookie into an account', async () => {
    mockRows.push({ ...row('a', null), sessionCookie: 'IPCZ-X-COOKIE=OLD' });
    const [account] = await new SqliteAccountsStore().list();
    expect('sessionCookie' in account).toBe(false);
    expect(JSON.stringify(account)).not.toContain('IPCZ-X-COOKIE');
  });

  it('lists what is left to move, asking only for rows that still hold one', async () => {
    mockRows.push({ boxId: 'a', sessionCookie: 'IPCZ-X-COOKIE=AAA' });
    expect(await new SqliteAccountsStore().legacySessionCookies()).toEqual([
      { boxId: 'a', sessionCookie: 'IPCZ-X-COOKIE=AAA' },
    ]);
    expect(mockExecuted.at(-1)?.sql).toMatch(/WHERE sessionCookie IS NOT NULL/);
  });

  it('empties one box’s column with NULL, and never writes a value into it', async () => {
    await new SqliteAccountsStore().clearLegacySessionCookie('a');
    const last = mockExecuted.at(-1);
    expect(last?.sql).toMatch(/SET sessionCookie = NULL WHERE boxId = \?/);
    expect(last?.params).toEqual(['a']);
  });

  it('adds a box without naming the column', async () => {
    const account: DataBoxAccount = {
      id: 'id-a',
      boxId: 'a',
      loginName: 'login-a',
      label: 'a',
      dbType: null,
      alias: null,
      authMethod: 'otp_totp',
      host: 'production',
      secretRef: 'a',
      sessionValidUntil: null,
      passwordExpiresAt: null,
      lastSyncedAt: null,
      messageCount: null,
      unreadCount: null,
      pdzCreditCzk: null,
      syncError: null,
      createdAt: 1,
      updatedAt: 1,
    };
    await new SqliteAccountsStore().add(account);
    const insert = mockExecuted.find(e => e.sql.includes('INSERT INTO accounts'));
    expect(insert?.sql).toContain('boxId');
    expect(insert?.sql).not.toContain('sessionCookie');
  });
});
