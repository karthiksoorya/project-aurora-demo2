import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { promises as fs, existsSync, mkdirSync } from 'node:fs';
import * as path from 'node:path';
import { sha256Canonical } from '../common/hash';
import type { DbState } from '../domain/types';
import { buildSeed } from '../fixtures/seed';
import type { AuroraTx } from './repositories';
import { UnitOfWork } from './repositories';

const clone = <T>(v: T): T => structuredClone(v);

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
      this.state = JSON.parse(await fs.readFile(this.file, 'utf8')) as DbState;
      this.log.log(`Loaded ${this.file}`);
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
    };
  }
}
