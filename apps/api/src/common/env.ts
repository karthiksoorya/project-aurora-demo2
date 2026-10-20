import { existsSync } from 'node:fs';
import * as path from 'node:path';

/**
 * Load KEY=VALUE pairs from the first .env found (apps/api/.env, then the repository root .env).
 * Already-set environment variables win. Uses Node's built-in parser (no extra dependency).
 */
export function loadEnv() {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env'),
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../../../../.env'),
  ];
  const file = candidates.find((f) => existsSync(f));
  if (file) process.loadEnvFile(file);
}
