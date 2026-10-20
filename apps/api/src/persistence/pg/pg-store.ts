import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { accessSync, constants, mkdirSync } from 'node:fs';
import * as path from 'node:path';
import type { Pool, PoolClient } from 'pg';
import { DomainError } from '../../common/errors';
import { sha256Canonical } from '../../common/hash';
import { USERS } from '../../common/request-context';
import type { DbState } from '../../domain/types';
import { CATALOG_VERSION, INGREDIENTS } from '../../fixtures/ingredients';
import { buildSeed } from '../../fixtures/seed';
import { dataDir } from '../json-store';
import type { AuroraTx, PersistenceHealth } from '../repositories';
import { UnitOfWork } from '../repositories';
import { createPool, databaseUrl, migrationsDir, redactUrl } from './pg-config';
import { migrate, migrationStatus } from './migrator';
import { pgRepositories } from './pg-repositories';

const WRITE_LOCK = 7_311_002; // transaction-scoped advisory lock: one writer at a time (see README)

/** Map database constraint violations that slip past service checks onto the API error envelope. */
function translate(e: unknown): unknown {
  if (e instanceof DomainError) return e;
  const pg = e as { code?: string; constraint?: string; message?: string };
  if (pg?.code === '23505')
    return new DomainError(409, 'UNIQUE_VIOLATION', 'A record with the same unique key already exists', {
      constraint: pg.constraint,
    });
  if (pg?.code === '23001')
    return new DomainError(409, 'IMMUTABLE_RECORD', 'Evidence records are append-only', { detail: pg.message });
  if (pg?.code === '23503' || pg?.code === '23514')
    return new DomainError(422, 'CONSTRAINT_VIOLATION', 'The change violates a data integrity rule', {
      constraint: pg.constraint,
    });
  return e;
}

/**
 * PostgreSQL unit of work (M3).
 *  - Schema is managed by versioned SQL migrations (apps/api/migrations), applied on start unless
 *    AURORA_DB_MIGRATE=off.
 *  - write(): one SQL transaction (READ COMMITTED) guarded by a transaction-level advisory lock, so the
 *    services' read-check-write logic (revision checks → 409) is race-free across API processes.
 *  - read(): REPEATABLE READ, READ ONLY transaction — a consistent snapshot for multi-query reads.
 *  - Append-only evidence tables are additionally protected by database triggers.
 */
@Injectable()
export class PgUnitOfWork extends UnitOfWork implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('PgStore');
  pool!: Pool;
  readonly uploadsDir = path.join(dataDir(), 'uploads');
  integrity: { checkedVersions: number; mismatched: string[] } = { checkedVersions: 0, mismatched: [] };
  private url = '';

  async onModuleInit() {
    mkdirSync(this.uploadsDir, { recursive: true });
    this.url = databaseUrl();
    this.pool = createPool(this.url);
    this.pool.on('error', (e) => this.log.error(`Idle client error: ${e.message}`));
    if ((process.env.AURORA_DB_MIGRATE ?? 'auto') !== 'off') {
      const applied = await migrate(this.pool, migrationsDir(), (m) => this.log.log(m));
      if (!applied.length) this.log.log('Database schema up to date');
    } else {
      const s = await migrationStatus(this.pool, migrationsDir());
      if (s.pending.length) throw new Error(`Pending migrations: ${s.pending.join(', ')} (run npm run db:migrate)`);
    }
    await this.syncReferenceData();
    if ((process.env.AURORA_SEED ?? 'auto') !== 'off') await this.seedIfEmpty();
    await this.verifyIntegrity();
    this.log.log(`Connected to ${redactUrl(this.url)}`);
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }

  /** Demo users and the versioned catalog fixture are upserted so foreign keys always resolve. */
  private async syncReferenceData() {
    await this.tx(async (c) => {
      for (const u of USERS)
        await c.query(
          `INSERT INTO app_users (id, name, initials, title) VALUES ($1,$2,$3,$4)
           ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, initials = EXCLUDED.initials, title = EXCLUDED.title`,
          [u.id, u.name, u.initials, u.title],
        );
      for (const i of INGREDIENTS)
        await c.query(
          `INSERT INTO catalog_ingredients (id, slug, name, kind, catalog_version, data) VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, name = EXCLUDED.name, kind = EXCLUDED.kind,
             catalog_version = EXCLUDED.catalog_version, data = EXCLUDED.data, synced_at = now()
           WHERE catalog_ingredients.catalog_version IS DISTINCT FROM EXCLUDED.catalog_version`,
          [i.id, i.slug, i.name, i.kind, CATALOG_VERSION, JSON.stringify(i)],
        );
    });
  }

  private async seedIfEmpty() {
    const { rows } = await this.pool.query<{ n: number }>('SELECT count(*)::int AS n FROM projects');
    if (rows[0].n > 0) return;
    await this.importState(buildSeed());
    this.log.log('Seeded demo project "Coastal Air"');
  }

  /** Insert a whole DbState (seed or JSON import) in one transaction, in dependency order. */
  async importState(s: DbState) {
    return this.write(async (tx) => {
      for (const p of s.projects) await tx.projects.insert(p);
      for (const m of s.memberships) await tx.memberships.upsert(m);
      for (const b of s.briefs) await tx.briefs.upsert(b);
      for (const u of s.uploads) await tx.uploads.insert(u);
      // versions: parents before children
      const done = new Set<string>();
      const pending = [...s.versions].sort((a, b) => a.savedAt.localeCompare(b.savedAt));
      while (pending.length) {
        const i = pending.findIndex((v) => !v.snapshot.parentVersionId || done.has(v.snapshot.parentVersionId));
        if (i < 0) throw new Error('Version lineage references a missing parent');
        const [v] = pending.splice(i, 1);
        await tx.versions.insert(v);
        done.add(v.id);
      }
      for (const d of s.drafts) await tx.drafts.upsert(d);
      for (const e of s.audit) await tx.audit.append(e);
      for (const r of s.validations) await tx.validations.insert(r);
      for (const e of s.experiments) await tx.experiments.insert(e);
      for (const r of s.reviews) await tx.reviews.insert(r);
      return {
        projects: s.projects.length,
        versions: s.versions.length,
        audit: s.audit.length,
        validations: s.validations.length,
        experiments: s.experiments.length,
        reviews: s.reviews.length,
      };
    });
  }

  async verifyIntegrity() {
    const { rows } = await this.pool.query<{ id: string; snapshot: unknown; snapshot_hash: string }>(
      'SELECT id, snapshot, snapshot_hash FROM formula_versions',
    );
    const mismatched = rows.filter((r) => sha256Canonical(r.snapshot) !== r.snapshot_hash).map((r) => r.id);
    this.integrity = { checkedVersions: rows.length, mismatched };
    if (mismatched.length) this.log.error(`Version hash mismatch: ${mismatched.join(', ')}`);
  }

  async health(): Promise<PersistenceHealth> {
    let writable = true;
    try {
      await this.pool.query('SELECT 1');
      accessSync(this.uploadsDir, constants.W_OK);
    } catch {
      writable = false;
    }
    let schemaVersion = 'unknown';
    try {
      const { rows } = await this.pool.query<{ v: string }>('SELECT max(version) AS v FROM schema_migrations');
      schemaVersion = `migration-${rows[0].v}`;
    } catch {
      /* reported as unknown */
    }
    return {
      adapter: 'postgresql',
      location: redactUrl(this.url),
      writable,
      schemaVersion,
      versionIntegrity: this.integrity,
    };
  }

  private async tx<T>(fn: (c: PoolClient) => Promise<T>, mode = 'BEGIN'): Promise<T> {
    const c = await this.pool.connect();
    try {
      await c.query(mode);
      const r = await fn(c);
      await c.query('COMMIT');
      return r;
    } catch (e) {
      await c.query('ROLLBACK').catch(() => undefined);
      throw translate(e);
    } finally {
      c.release();
    }
  }

  read<T>(work: (tx: AuroraTx) => Promise<T>): Promise<T> {
    return this.tx((c) => work(pgRepositories(c)), 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  }

  write<T>(work: (tx: AuroraTx) => Promise<T>): Promise<T> {
    return this.tx(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock($1)', [WRITE_LOCK]);
      return work(pgRepositories(c));
    });
  }
}
