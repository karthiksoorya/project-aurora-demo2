import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import type { Pool } from 'pg';

export interface MigrationFile {
  version: string;
  name: string;
  file: string;
  checksum: string;
  sql: string;
}
export interface MigrationStatus {
  applied: { version: string; name: string; appliedAt: string }[];
  pending: string[];
}

const LOCK_KEY = 7_311_001; // advisory lock id reserved for migrations

/** Versioned forward-only SQL migrations: NNN_description.sql, applied in order, each in its own transaction. */
export function readMigrations(dir: string): MigrationFile[] {
  return readdirSync(dir)
    .filter((f) => /^\d{3}_[a-z0-9_]+\.sql$/.test(f))
    .sort()
    .map((f) => {
      const sql = readFileSync(path.join(dir, f), 'utf8');
      return {
        version: f.slice(0, 3),
        name: f.slice(4, -4),
        file: f,
        checksum: createHash('sha256').update(sql).digest('hex'),
        sql,
      };
    });
}

async function ensureTable(pool: Pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version    text PRIMARY KEY,
    name       text NOT NULL,
    checksum   text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
}

export async function migrationStatus(pool: Pool, dir: string): Promise<MigrationStatus> {
  await ensureTable(pool);
  const files = readMigrations(dir);
  const rows = (
    await pool.query<{ version: string; name: string; checksum: string; applied_at: string }>(
      'SELECT version, name, checksum, applied_at FROM schema_migrations ORDER BY version',
    )
  ).rows;
  const byVersion = new Map(rows.map((r) => [r.version, r]));
  for (const f of files) {
    const r = byVersion.get(f.version);
    if (r && r.checksum !== f.checksum)
      throw new Error(
        `Migration ${f.file} was modified after it was applied (checksum mismatch). Add a new migration instead.`,
      );
  }
  return {
    applied: rows.map((r) => ({ version: r.version, name: r.name, appliedAt: r.applied_at })),
    pending: files.filter((f) => !byVersion.has(f.version)).map((f) => f.file),
  };
}

/** Apply pending migrations. Concurrent API starts are safe: a session advisory lock serialises them. */
export async function migrate(pool: Pool, dir: string, log: (m: string) => void = () => undefined): Promise<string[]> {
  const client = await pool.connect();
  const applied: string[] = [];
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
    await ensureTable(pool);
    const status = await migrationStatus(pool, dir);
    for (const f of readMigrations(dir).filter((m) => status.pending.includes(m.file))) {
      await client.query('BEGIN');
      try {
        await client.query(f.sql);
        await client.query('INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)', [
          f.version,
          f.name,
          f.checksum,
        ]);
        await client.query('COMMIT');
        applied.push(f.file);
        log(`Applied migration ${f.file}`);
      } catch (e) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${f.file} failed: ${(e as Error).message}`);
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => undefined);
    client.release();
  }
  return applied;
}
