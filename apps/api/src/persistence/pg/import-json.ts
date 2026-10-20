import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { sha256Canonical } from '../../common/hash';
import { upgrade } from '../json-store';
import { PgUnitOfWork } from './pg-store';

export interface ImportReport {
  source: string;
  sourceSchema: number;
  counts: Record<string, number>;
  missingUploadFiles: string[];
}

/**
 * One-time move of a local JSON data file (M1/M2) into PostgreSQL.
 * Refuses to run when the database already holds projects, or when any saved version fails its hash check —
 * evidence is copied exactly as recorded, never repaired silently.
 */
export async function importJsonFile(file: string, uploadsDir: string): Promise<ImportReport> {
  const raw = JSON.parse(readFileSync(file, 'utf8')) as { schemaVersion: number };
  const { state } = upgrade(raw);
  const bad = state.versions.filter((v) => sha256Canonical(v.snapshot) !== v.snapshotHash).map((v) => v.id);
  if (bad.length)
    throw new Error(`Refusing to import: ${bad.length} version(s) fail hash verification: ${bad.join(', ')}`);

  const prevSeed = process.env.AURORA_SEED;
  process.env.AURORA_SEED = 'off';
  const store = new PgUnitOfWork();
  try {
    await store.onModuleInit();
    const { rows } = await store.pool.query<{ n: number }>('SELECT count(*)::int AS n FROM projects');
    if (rows[0].n > 0)
      throw new Error('Refusing to import: the database already contains projects (import into an empty database)');
    const counts = await store.importState(state);
    await store.verifyIntegrity();
    if (store.integrity.mismatched.length)
      throw new Error(`Post-import integrity check failed: ${store.integrity.mismatched.join(', ')}`);
    return {
      source: path.resolve(file),
      sourceSchema: raw.schemaVersion,
      counts,
      missingUploadFiles: state.uploads
        .filter((u) => !existsSync(path.join(uploadsDir, u.storedName)))
        .map((u) => u.storedName),
    };
  } finally {
    if (prevSeed === undefined) delete process.env.AURORA_SEED;
    else process.env.AURORA_SEED = prevSeed;
    await store.onModuleDestroy();
  }
}
