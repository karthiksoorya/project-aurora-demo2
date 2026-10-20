/**
 * Aurora database CLI (M3).
 *   npm run db:migrate              apply pending SQL migrations
 *   npm run db:status               list applied / pending migrations
 *   npm run db:import -- <file>     import a local JSON data file (aurora-db.json) into an empty database
 * Reads DATABASE_URL (and optionally apps/api/.env or the repo-root .env).
 */
import * as path from 'node:path';
import { loadEnv } from '../common/env';
import { dataDir } from '../persistence/json-store';
import { importJsonFile } from '../persistence/pg/import-json';
import { createPool, databaseUrl, migrationsDir, redactUrl } from '../persistence/pg/pg-config';
import { migrate, migrationStatus } from '../persistence/pg/migrator';

async function main() {
  loadEnv();
  const [cmd, arg] = process.argv.slice(2);
  const url = databaseUrl();
  console.log(`Database: ${redactUrl(url)}`);
  if (cmd === 'migrate' || cmd === 'status') {
    const pool = createPool(url);
    try {
      if (cmd === 'migrate') {
        const applied = await migrate(pool, migrationsDir(), (m) => console.log(m));
        console.log(applied.length ? `${applied.length} migration(s) applied.` : 'Schema already up to date.');
      }
      const s = await migrationStatus(pool, migrationsDir());
      for (const a of s.applied) console.log(`  applied  ${a.version}_${a.name}  ${a.appliedAt}`);
      for (const p of s.pending) console.log(`  pending  ${p}`);
    } finally {
      await pool.end();
    }
    return;
  }
  if (cmd === 'import') {
    const file = path.resolve(arg ?? path.join(dataDir(), 'aurora-db.json'));
    const report = await importJsonFile(file, path.join(dataDir(), 'uploads'));
    console.log(`Imported ${report.source} (JSON schema v${report.sourceSchema}):`);
    for (const [k, v] of Object.entries(report.counts)) console.log(`  ${k.padEnd(12)} ${v}`);
    console.log('  all version hashes verified after import');
    if (report.missingUploadFiles.length)
      console.warn(`  warning: ${report.missingUploadFiles.length} upload file(s) not found in ${dataDir()}/uploads`);
    return;
  }
  console.error('Usage: db <migrate|status|import [file]>');
  process.exitCode = 2;
}

main().catch((e: unknown) => {
  console.error(`Error: ${(e as Error).message}`);
  process.exitCode = 1;
});
