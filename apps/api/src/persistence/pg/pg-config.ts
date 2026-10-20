import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { Pool, types } from 'pg';

/**
 * Which persistence adapter to use.
 *  AURORA_PERSISTENCE=postgres|json (explicit), otherwise postgres when DATABASE_URL is set, else json.
 */
export function persistenceMode(): 'postgres' | 'json' {
  const m = process.env.AURORA_PERSISTENCE?.toLowerCase();
  if (m === 'postgres' || m === 'json') return m;
  return process.env.DATABASE_URL ? 'postgres' : 'json';
}

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required when AURORA_PERSISTENCE=postgres');
  return url;
}

let parsersInstalled = false;
/** timestamptz -> ISO-8601 UTC string (domain model uses ISO strings); numeric stays a string (exact decimals). */
export function installTypeParsers() {
  if (parsersInstalled) return;
  types.setTypeParser(types.builtins.TIMESTAMPTZ, (v) => new Date(v).toISOString());
  types.setTypeParser(types.builtins.INT8, (v) => Number(v));
  parsersInstalled = true;
}

export function createPool(url = databaseUrl()) {
  installTypeParsers();
  return new Pool({
    connectionString: url,
    max: Number(process.env.AURORA_DB_POOL_MAX ?? 10),
    application_name: 'aurora-api',
    idleTimeoutMillis: 30_000,
  });
}

/** Migrations ship as plain .sql files next to the package (apps/api/migrations), in src and dist builds. */
export function migrationsDir(): string {
  const candidates = [
    process.env.AURORA_MIGRATIONS_DIR,
    path.resolve(__dirname, '../../../migrations'),
    path.resolve(__dirname, '../../../../migrations'),
    path.resolve(process.cwd(), 'migrations'),
    path.resolve(process.cwd(), 'apps/api/migrations'),
  ].filter((p): p is string => !!p);
  const found = candidates.find((p) => existsSync(path.join(p, '001_initial_schema.sql')));
  if (!found) throw new Error(`Migrations directory not found (looked in ${candidates.join(', ')})`);
  return found;
}

/** Hide credentials when logging or reporting the connection target. */
export function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return 'postgresql://(unparseable)';
  }
}
