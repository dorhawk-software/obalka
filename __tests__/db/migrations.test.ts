import { MIGRATIONS, MigrationDb, runMigrations } from '../../src/services/db/migrations';

/** In-memory fake of the SQLite slice the runner uses: tracks recorded versions + executed SQL. */
class FakeDb implements MigrationDb {
  readonly executed: string[] = [];
  private readonly versions: number[] = [];

  async execute(sql: string, params?: unknown[]) {
    this.executed.push(sql.trim().replace(/\s+/g, ' '));
    if (sql.includes('SELECT version FROM schema_migrations')) {
      return { rows: this.versions.map(v => ({ version: v })) };
    }
    if (sql.includes('INSERT INTO schema_migrations')) {
      this.versions.push(Number(params?.[0]));
    }
    return { rows: [] as Array<Record<string, unknown>> };
  }

  appliedVersions(): number[] {
    return [...this.versions];
  }
}

describe('runMigrations', () => {
  it('applies every migration on a fresh DB and records each version', async () => {
    const db = new FakeDb();
    const applied = await runMigrations(db, () => 1000);
    expect(applied).toBe(MIGRATIONS.length);
    expect(db.appliedVersions()).toEqual(MIGRATIONS.map(m => m.version));
  });

  it('is idempotent - a second run applies nothing', async () => {
    const db = new FakeDb();
    await runMigrations(db);
    const before = db.executed.length;
    const applied = await runMigrations(db);
    expect(applied).toBe(0);
    // Only the schema_migrations CREATE + the SELECT run on the no-op pass (no migration statements).
    expect(db.executed.length).toBe(before + 2);
  });

  it('runs only the versions not yet applied (an upgrade), in order', async () => {
    const db = new FakeDb();
    // Simulate a DB already at version 1: pre-record it.
    await db.execute('INSERT INTO schema_migrations (version, name, appliedAt) VALUES (?, ?, ?)', [
      1,
      'baseline',
      1,
    ]);
    db.executed.length = 0;
    const applied = await runMigrations(db);
    expect(applied).toBe(MIGRATIONS.length - 1); // every version above 1
    // The baseline's `accounts` table CREATE must NOT re-run; the new ALTER must.
    expect(db.executed.some(s => s.includes('CREATE TABLE IF NOT EXISTS accounts'))).toBe(false);
    expect(db.executed.some(s => s.includes('ALTER TABLE accounts ADD COLUMN syncError'))).toBe(true);
  });

  it('migration versions are unique and strictly increasing', () => {
    const versions = MIGRATIONS.map(m => m.version);
    expect(new Set(versions).size).toBe(versions.length);
    expect([...versions].sort((a, b) => a - b)).toEqual(versions);
  });
});
