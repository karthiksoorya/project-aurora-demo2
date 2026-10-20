import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { Client } from 'pg';

/**
 * Test storage harness. By default tests run against the JSON adapter in a temp dir.
 * With TEST_DATABASE_URL (an admin connection, e.g. postgres://postgres@127.0.0.1:5432/postgres) every test file
 * gets its own freshly created database and runs against the PostgreSQL adapter — same assertions, both adapters.
 */
export const PG_ADMIN_URL = process.env.TEST_DATABASE_URL;
export const usingPg = () => !!PG_ADMIN_URL;

export interface TestStore {
  mode: 'json' | 'postgres';
  dir: string;
  dbUrl?: string;
  /** Corrupt the first saved version's snapshot behind the API's back (integrity-check tests). */
  tamperFirstVersion(): Promise<void>;
  cleanup(): Promise<void>;
}

function dbUrlFor(name: string) {
  const u = new URL(PG_ADMIN_URL!);
  u.pathname = `/${name}`;
  return u.toString();
}

export async function createTestDatabase(prefix = 'aurora_t'): Promise<{ url: string; drop: () => Promise<void> }> {
  const name = `${prefix}_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
  const admin = new Client({ connectionString: PG_ADMIN_URL });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();
  return {
    url: dbUrlFor(name),
    drop: async () => {
      const a = new Client({ connectionString: PG_ADMIN_URL });
      await a.connect();
      await a.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await a.end();
    },
  };
}

export async function setupStore(prefix: string): Promise<TestStore> {
  const dir = mkdtempSync(path.join(tmpdir(), `${prefix}-`));
  process.env.AURORA_DATA_DIR = dir;
  if (!usingPg()) {
    process.env.AURORA_PERSISTENCE = 'json';
    return {
      mode: 'json',
      dir,
      tamperFirstVersion: () => {
        const file = path.join(dir, 'aurora-db.json');
        const db = JSON.parse(readFileSync(file, 'utf8')) as {
          versions: { snapshot: { items: { massPct: string }[] } }[];
        };
        db.versions[0].snapshot.items[0].massPct = '99.000000';
        writeFileSync(file, JSON.stringify(db));
        return Promise.resolve();
      },
      cleanup: () => Promise.resolve(rmSync(dir, { recursive: true, force: true })),
    };
  }
  const db = await createTestDatabase();
  process.env.AURORA_PERSISTENCE = 'postgres';
  process.env.DATABASE_URL = db.url;
  return {
    mode: 'postgres',
    dir,
    dbUrl: db.url,
    tamperFirstVersion: async () => {
      // simulates out-of-band corruption by a superuser: the append-only trigger must be bypassed explicitly
      const c = new Client({ connectionString: db.url });
      await c.connect();
      await c.query('ALTER TABLE formula_versions DISABLE TRIGGER formula_versions_immutable');
      await c.query(
        `UPDATE formula_versions SET snapshot = jsonb_set(snapshot, '{items,0,massPct}', '"99.000000"')
         WHERE id = (SELECT id FROM formula_versions ORDER BY saved_at LIMIT 1)`,
      );
      await c.query('ALTER TABLE formula_versions ENABLE TRIGGER formula_versions_immutable');
      await c.end();
    },
    cleanup: async () => {
      await db.drop();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
