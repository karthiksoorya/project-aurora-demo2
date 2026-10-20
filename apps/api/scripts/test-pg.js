// Runs the API Jest suite against PostgreSQL. Each test file creates (and drops) its own database
// through the admin connection in TEST_DATABASE_URL (default: the docker compose service).
const { spawnSync } = require('node:child_process');
const url = process.env.TEST_DATABASE_URL ?? 'postgres://aurora:aurora@127.0.0.1:5432/postgres';
const r = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['jest', '--runInBand', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, TEST_DATABASE_URL: url },
  shell: process.platform === 'win32',
});
process.exit(r.status ?? 1);
