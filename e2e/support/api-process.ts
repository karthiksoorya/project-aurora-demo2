import { ChildProcess, spawn } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

export const E2E_API_PORT = 3100;
export const E2E_WEB_PORT = 4300;
export const E2E_API = `http://127.0.0.1:${E2E_API_PORT}`;
export const DATA_DIR = path.resolve(__dirname, '..', '.data');
const PID_FILE = path.join(DATA_DIR, 'api.pid');
const API_MAIN = path.resolve(__dirname, '..', '..', 'apps', 'api', 'dist', 'main.js');

let child: ChildProcess | undefined;

export async function waitForHealth(timeoutMs = 20_000) {
  const t0 = Date.now();
  for (;;) {
    try {
      const r = await fetch(`${E2E_API}/health`);
      if (r.ok) return (await r.json()) as { status: string };
    } catch {
      /* not up yet */
    }
    if (Date.now() - t0 > timeoutMs) throw new Error('API did not become healthy');
    await new Promise((r) => setTimeout(r, 200));
  }
}

/** Start the built NestJS API as a child process on the e2e port with an isolated data dir. */
export async function startApi(opts: { reset?: boolean } = {}) {
  if (opts.reset) rmSync(DATA_DIR, { recursive: true, force: true });
  if (!existsSync(API_MAIN)) throw new Error('Build the API first: npm run build -w apps/api');
  child = spawn(process.execPath, [API_MAIN], {
    env: { ...process.env, AURORA_API_PORT: String(E2E_API_PORT), AURORA_DATA_DIR: DATA_DIR },
    stdio: 'ignore',
    detached: false,
  });
  await waitForHealth();
  writeFileSync(PID_FILE, String(child.pid));
  return child.pid;
}

/** Stop whichever API process is recorded in the pid file (works across Playwright processes). */
export async function stopApi() {
  if (!existsSync(PID_FILE)) return;
  const pid = Number(readFileSync(PID_FILE, 'utf8'));
  try {
    process.kill(pid);
  } catch {
    /* already gone */
  }
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(`${E2E_API}/health`);
      await new Promise((r) => setTimeout(r, 100));
    } catch {
      break;
    }
  }
  rmSync(PID_FILE, { force: true });
}

export async function restartApi() {
  await stopApi();
  await startApi();
}
