import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { promises as fs, existsSync, mkdirSync } from 'node:fs';
import * as path from 'node:path';
import { sha256Canonical } from '../common/hash';
import type { DbState } from '../domain/types';
import { buildSeed, defaultMemberships } from '../fixtures/seed';
import type { AuroraTx } from './repositories';
import { UnitOfWork } from './repositories';

const clone = <T>(v: T): T => structuredClone(v);

/** Forward-only schema upgrade of the JSON file (v1 -> v2 adds access, validation, experiments, reviews). */
export function upgrade(raw: { schemaVersion: number }): { state: DbState; migrated: boolean } {
  if (raw.schemaVersion === 2) return { state: raw as DbState, migrated: false };
  if (raw.schemaVersion !== 1) throw new Error(`Unsupported data schema v${raw.schemaVersion}`);
  const v1 = raw as unknown as Omit<
    DbState,
    'schemaVersion' | 'memberships' | 'validations' | 'experiments' | 'reviews'
  >;
  const now = new Date().toISOString();
  return {
    migrated: true,
    state: {
      ...v1,
      schemaVersion: 2,
      memberships: v1.projects.flatMap((p) => defaultMemberships(p.id, p.createdBy, now)),
      validations: [],
      experiments: [],
      reviews: [],
    },
  };
}

export function dataDir(): string {
  return path.resolve(process.env.AURORA_DATA_DIR ?? path.join(process.cwd(), 'data'));
}

/**
 * JSON-file persistence for the M1 demo.
 *  - Single process, single writer: writes are serialized through a promise chain.
 *  - Atomic: state is written to a temp file, fsync'd, then renamed over the real file.
 *  - Transactional: a write works on a deep copy; the copy replaces committed state only after
 *    the file write succeeds. Not suitable for concurrent multi-user editing (spec §3).
 */
@Injectable()
export class JsonUnitOfWork extends UnitOfWork implements OnModuleInit {
  private readonly log = new Logger('JsonStore');
  private state!: DbState;
  private queue: Promise<unknown> = Promise.resolve();
  readonly file = path.join(dataDir(), 'aurora-db.json');
  readonly uploadsDir = path.join(dataDir(), 'uploads');
  integrity: { checkedVersions: number; mismatched: string[] } = { checkedVersions: 0, mismatched: [] };

  async onModuleInit() {
    mkdirSync(path.dirname(this.file), { recursive: true });
    mkdirSync(this.uploadsDir, { recursive: true });
    if (existsSync(this.file)) {
      const raw = JSON.parse(await fs.readFile(this.file, 'utf8')) as { schemaVersion: number };
      const { state, migrated } = upgrade(raw);
      this.state = state;
      if (migrated) {
        await fs.copyFile(this.file, `${this.file}.v${raw.schemaVersion}.bak`);
        await this.persist(this.state);
        this.log.log(`Upgraded ${this.file} from schema v${raw.schemaVersion} to v2 (backup kept)`);
      } else this.log.log(`Loaded ${this.file}`);
    } else {
      this.state = buildSeed();
      await this.persist(this.state);
      this.log.log(`Seeded new data file ${this.file}`);
    }
    this.verifyIntegrity();
  }

  /** Recompute every saved version hash; any mismatch is reported by /health. */
  verifyIntegrity() {
    const mismatched = this.state.versions
      .filter((v) => sha256Canonical(v.snapshot) !== v.snapshotHash)
      .map((v) => v.id);
    this.integrity = { checkedVersions: this.state.versions.length, mismatched };
    if (mismatched.length) this.log.error(`Version hash mismatch: ${mismatched.join(', ')}`);
  }

  read<T>(work: (tx: AuroraTx) => T): Promise<T> {
    // reads wait for in-flight writes so callers observe their own writes
    return this.queue.then(() => clone(work(this.bind(this.state))));
  }

  write<T>(work: (tx: AuroraTx) => T): Promise<T> {
    const run = this.queue.then(async () => {
      const working = clone(this.state);
      const result = work(this.bind(working));
      await this.persist(working);
      this.state = working;
      return clone(result);
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async persist(s: DbState) {
    const tmp = `${this.file}.${process.pid}.${Date.now()}.tmp`;
    const fh = await fs.open(tmp, 'w');
    try {
      await fh.writeFile(JSON.stringify(s, null, 1), 'utf8');
      await fh.sync();
    } finally {
      await fh.close();
    }
    await fs.rename(tmp, this.file);
  }

  private bind(s: DbState): AuroraTx {
    return {
      projects: {
        list: () => s.projects.map(clone),
        get: (id) => clone(s.projects.find((p) => p.id === id)),
        insert: (p) => void s.projects.push(clone(p)),
        touch: (id, at) => {
          const p = s.projects.find((x) => x.id === id);
          if (p) p.updatedAt = at;
        },
      },
      briefs: {
        get: (projectId) => clone(s.briefs.find((b) => b.projectId === projectId)),
        upsert: (b) => {
          const i = s.briefs.findIndex((x) => x.projectId === b.projectId);
          if (i >= 0) s.briefs[i] = clone(b);
          else s.briefs.push(clone(b));
        },
      },
      drafts: {
        getByProject: (projectId) => clone(s.drafts.find((d) => d.projectId === projectId)),
        upsert: (d) => {
          const i = s.drafts.findIndex((x) => x.id === d.id);
          if (i >= 0) s.drafts[i] = clone(d);
          else s.drafts.push(clone(d));
        },
      },
      versions: {
        listByProject: (projectId) =>
          s.versions
            .filter((v) => v.projectId === projectId)
            .sort((a, b) => a.savedAt.localeCompare(b.savedAt))
            .map(clone),
        get: (id) => clone(s.versions.find((v) => v.id === id)),
        insert: (v) => {
          if (s.versions.some((x) => x.id === v.id)) throw new Error('Version id collision');
          s.versions.push(clone(v));
        },
      },
      audit: {
        append: (e) => void s.audit.push(clone(e)),
        listByProject: (projectId, limit) =>
          s.audit
            .filter((e) => e.projectId === projectId)
            .slice(-limit)
            .reverse()
            .map(clone),
      },
      uploads: {
        insert: (u) => void s.uploads.push(clone(u)),
        get: (id) => clone(s.uploads.find((u) => u.id === id)),
      },
      memberships: {
        listByProject: (projectId) => s.memberships.filter((m) => m.projectId === projectId).map(clone),
        get: (projectId, userId) => clone(s.memberships.find((m) => m.projectId === projectId && m.userId === userId)),
        upsert: (m) => {
          const i = s.memberships.findIndex((x) => x.projectId === m.projectId && x.userId === m.userId);
          if (i >= 0) s.memberships[i] = clone(m);
          else s.memberships.push(clone(m));
        },
      },
      validations: {
        insert: (r) => void s.validations.push(clone(r)),
        get: (id) => clone(s.validations.find((r) => r.id === id)),
        listByProject: (projectId) =>
          s.validations
            .filter((r) => r.projectId === projectId)
            .sort((a, b) => b.evaluatedAt.localeCompare(a.evaluatedAt))
            .map(clone),
      },
      experiments: {
        insert: (e) => void s.experiments.push(clone(e)),
        update: (e) => {
          const i = s.experiments.findIndex((x) => x.id === e.id);
          if (i < 0) throw new Error('Experiment not found');
          s.experiments[i] = clone(e);
        },
        get: (id) => clone(s.experiments.find((e) => e.id === id)),
        listByProject: (projectId) =>
          s.experiments
            .filter((e) => e.projectId === projectId)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map(clone),
      },
      reviews: {
        insert: (r) => void s.reviews.push(clone(r)),
        update: (r) => {
          const i = s.reviews.findIndex((x) => x.id === r.id);
          if (i < 0) throw new Error('Review not found');
          s.reviews[i] = clone(r);
        },
        get: (id) => clone(s.reviews.find((r) => r.id === id)),
        listByProject: (projectId) =>
          s.reviews
            .filter((r) => r.projectId === projectId)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map(clone),
      },
    };
  }
}
