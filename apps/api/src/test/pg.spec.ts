import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { Client } from 'pg';
import request from 'supertest';
import { AppModule } from '../app.module';
import { configureApp } from '../bootstrap';
import { USERS } from '../common/request-context';
import { SEED_PROJECT_ID } from '../fixtures/seed';
import { buildSeed } from '../fixtures/seed';
import { importJsonFile } from '../persistence/pg/import-json';
import { createPool, migrationsDir } from '../persistence/pg/pg-config';
import { UnitOfWork } from '../persistence/repositories';
import { migrate, migrationStatus } from '../persistence/pg/migrator';
import { createTestDatabase, setupStore, usingPg, type TestStore } from './harness';

/** PostgreSQL-only guarantees (M3). Skipped unless TEST_DATABASE_URL is set (npm run test:pg). */
const d = usingPg() ? describe : describe.skip;
const P = SEED_PROJECT_ID;
const OWNER = USERS[0].id;

async function boot() {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const a = mod.createNestApplication({ logger: false });
  configureApp(a);
  await a.init();
  return a;
}

d('PostgreSQL adapter (M3)', () => {
  let store: TestStore;
  let app: INestApplication;
  let sql: Client;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    store = await setupStore('aurora-pg');
    app = await boot();
    sql = new Client({ connectionString: store.dbUrl });
    await sql.connect();
  });
  afterAll(async () => {
    await sql.end();
    await app.close();
    await store.cleanup();
  });

  it('health reports the postgresql adapter, applied schema and verified hashes', async () => {
    const h = (await http().get('/health').expect(200)).body;
    expect(h.status).toBe('ok');
    expect(h.persistence.adapter).toBe('postgresql');
    expect(h.persistence.schemaVersion).toBe('migration-001');
    expect(h.persistence.location).not.toContain('aurora:aurora'); // credentials redacted
  });

  it('migrations are recorded once, re-running is a no-op, edited migrations are detected', async () => {
    const pool = createPool(store.dbUrl);
    try {
      expect(await migrate(pool, migrationsDir())).toEqual([]);
      const s = await migrationStatus(pool, migrationsDir());
      expect(s.applied.map((a) => a.version)).toEqual(['001']);
      expect(s.pending).toEqual([]);
      const tmp = mkdtempSync(path.join(tmpdir(), 'aurora-mig-'));
      writeFileSync(path.join(tmp, '001_initial_schema.sql'), '-- edited after apply\n');
      await expect(migrationStatus(pool, tmp)).rejects.toThrow(/checksum mismatch/);
      rmSync(tmp, { recursive: true, force: true });
    } finally {
      await pool.end();
    }
  });

  it('evidence tables are append-only at the database level', async () => {
    await sql.query('SELECT 1'); // connection sanity
    const draft = (await http().get(`/api/v1/projects/${P}/formula-draft`).expect(200)).body;
    const v = (
      await http()
        .post(`/api/v1/projects/${P}/formula-versions`)
        .send({ expectedDraftRevision: draft.revision, versionLabel: 'PG-1' })
        .expect(201)
    ).body;
    await expect(sql.query(`UPDATE formula_versions SET version_label = 'X' WHERE id = $1`, [v.id])).rejects.toThrow(
      /AURORA_IMMUTABLE/,
    );
    await expect(sql.query('DELETE FROM formula_versions WHERE id = $1', [v.id])).rejects.toThrow(/AURORA_IMMUTABLE/);
    await expect(sql.query('DELETE FROM audit_events')).rejects.toThrow(/AURORA_IMMUTABLE/);
    const { rows } = await sql.query<{ total_pct: string; completeness: string; snapshot_hash: string }>(
      'SELECT total_pct, completeness, snapshot_hash FROM formula_versions WHERE id = $1',
      [v.id],
    );
    expect(rows[0]).toEqual({ total_pct: '100.000000', completeness: 'complete', snapshot_hash: v.snapshotHash });
  });

  it('quantities are exact numeric(12,6) and range-checked by the database', async () => {
    const { rows } = await sql.query<{ mass_pct: string }>(
      `SELECT i.mass_pct FROM formula_draft_items i JOIN formula_drafts d ON d.id = i.draft_id
       WHERE d.project_id = $1 ORDER BY position LIMIT 1`,
      [P],
    );
    expect(rows[0].mass_pct).toMatch(/^\d+\.\d{6}$/);
    await expect(
      sql.query(
        `UPDATE formula_draft_items SET mass_pct = 100.5 WHERE ctid = (SELECT ctid FROM formula_draft_items LIMIT 1)`,
      ),
    ).rejects.toThrow(/check constraint/);
    await expect(
      sql.query(
        `UPDATE formula_draft_items SET ingredient_id = '00000000-0000-4000-8000-000000000000'
         WHERE ctid = (SELECT ctid FROM formula_draft_items LIMIT 1)`,
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it('concurrent saves with the same draft revision: exactly one wins, the rest get 409', async () => {
    const draft = (await http().get(`/api/v1/projects/${P}/formula-draft`).expect(200)).body;
    const tries = await Promise.all(
      Array.from({ length: 8 }, (_, k) =>
        http()
          .put(`/api/v1/projects/${P}/formula-draft`)
          .send({
            revision: draft.revision,
            items: draft.items.map((i: { massPct: string }, n: number) =>
              n === 0 ? { ...i, massPct: `${10 + k}.000000` } : i,
            ),
          }),
      ),
    );
    const codes = tries.map((r) => r.status).sort();
    expect(codes.filter((c) => c === 200)).toHaveLength(1);
    expect(codes.filter((c) => c === 409)).toHaveLength(7);
    const after = (await http().get(`/api/v1/projects/${P}/formula-draft`).expect(200)).body;
    expect(after.revision).toBe(draft.revision + 1);
  });

  it('two API processes on one database see each other’s writes and still serialise conflicts', async () => {
    const app2 = await boot();
    try {
      const h2 = () => request(app2.getHttpServer());
      const draft = (await http().get(`/api/v1/projects/${P}/formula-draft`).expect(200)).body;
      const [a, b] = await Promise.all([
        http()
          .post(`/api/v1/projects/${P}/formula-versions`)
          .send({ expectedDraftRevision: draft.revision, versionLabel: 'RACE-A' }),
        h2()
          .post(`/api/v1/projects/${P}/formula-versions`)
          .send({ expectedDraftRevision: draft.revision, versionLabel: 'RACE-A' }),
      ]);
      expect([a.status, b.status].sort()).toEqual([201, 409]);
      const list = (await h2().get(`/api/v1/projects/${P}/formula-versions`).expect(200)).body;
      expect(list.filter((v: { versionLabel: string }) => v.versionLabel === 'RACE-A')).toHaveLength(1);
    } finally {
      await app2.close();
    }
  });

  it('a failed unit of work rolls back every statement it made', async () => {
    const uow = app.get(UnitOfWork);
    const count = async () => (await sql.query<{ n: number }>('SELECT count(*)::int AS n FROM audit_events')).rows[0].n;
    const before = await count();
    await expect(
      uow.write(async (tx) => {
        await tx.audit.append({
          id: '22222222-2222-4222-8222-222222222222',
          projectId: P,
          actorId: OWNER,
          actorName: 'test',
          action: 'test.should_roll_back',
          targetType: 'project',
          targetId: P,
          payload: {},
          occurredAt: new Date().toISOString(),
        });
        await tx.projects.touch(P, new Date().toISOString());
        throw new Error('boom after two writes');
      }),
    ).rejects.toThrow('boom');
    expect(await count()).toBe(before);
  });
});

d('JSON → PostgreSQL import', () => {
  it('imports a JSON data file exactly, verifies hashes, and refuses a second import', async () => {
    const db = await createTestDatabase('aurora_imp');
    const dir = mkdtempSync(path.join(tmpdir(), 'aurora-imp-'));
    const prev = process.env.DATABASE_URL;
    process.env.DATABASE_URL = db.url;
    try {
      const seed = buildSeed();
      const file = path.join(dir, 'aurora-db.json');
      writeFileSync(file, JSON.stringify(seed));
      const rep = await importJsonFile(file, path.join(dir, 'uploads'));
      expect(rep.counts.projects).toBe(seed.projects.length);
      await expect(importJsonFile(file, dir)).rejects.toThrow(/already contains projects/);
      const c = new Client({ connectionString: db.url });
      await c.connect();
      const m = await c.query<{ n: number }>('SELECT count(*)::int AS n FROM project_members WHERE user_id = $1', [
        OWNER,
      ]);
      expect(m.rows[0].n).toBe(seed.projects.length);
      await c.end();

      // tampered source is refused before anything is written
      const db2 = await createTestDatabase('aurora_imp');
      process.env.DATABASE_URL = db2.url;
      const bad = structuredClone(seed);
      bad.versions = [
        {
          id: '11111111-1111-4111-8111-111111111111',
          projectId: seed.projects[0].id,
          versionLabel: 'T',
          snapshot: { versionLabel: 'T' } as never,
          snapshotHash: '0'.repeat(64),
          hashAlgorithm: 'sha256-canonical-json-v1',
          savedBy: OWNER,
          savedAt: new Date().toISOString(),
        },
      ];
      writeFileSync(file, JSON.stringify(bad));
      await expect(importJsonFile(file, dir)).rejects.toThrow(/fail hash verification/);
      await db2.drop();
    } finally {
      process.env.DATABASE_URL = prev;
      await db.drop();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
