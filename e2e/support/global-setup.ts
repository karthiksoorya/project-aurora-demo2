import { execSync } from 'node:child_process';
import * as path from 'node:path';
import { startApi, stopApi } from './api-process';

export default async function globalSetup() {
  execSync('npm run build -w apps/api', { cwd: path.resolve(__dirname, '..', '..'), stdio: 'inherit' });
  await stopApi();
  await startApi({ reset: true });
}
