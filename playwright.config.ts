import { defineConfig, devices } from '@playwright/test';
import { E2E_API, E2E_WEB_PORT } from './e2e/support/api-process';

/**
 * E2E suite. The API is started by global-setup (isolated data dir, port 3100) so tests can restart it;
 * the Angular dev server runs on 4300 and proxies /api to that API.
 * Reference viewport = 1672x941 (size of the 27 design screenshots).
 */
export default defineConfig({
  testDir: './e2e',
  testIgnore: process.env.SHOTS ? [] : ['**/tools/**'], // ad-hoc screenshot helpers, not acceptance tests
  outputDir: './e2e/test-results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'e2e/report', open: 'never' }],
    ['json', { outputFile: 'e2e/report/results.json' }],
  ],
  globalSetup: './e2e/support/global-setup.ts',
  globalTeardown: './e2e/support/global-teardown.ts',
  use: {
    baseURL: `http://127.0.0.1:${E2E_WEB_PORT}`,
    viewport: { width: 1672, height: 941 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1672, height: 941 } } }],
  webServer: {
    command: `npx ng serve --port ${E2E_WEB_PORT} --host 127.0.0.1`,
    cwd: './apps/web',
    url: `http://127.0.0.1:${E2E_WEB_PORT}`,
    env: { AURORA_API_URL: E2E_API, NG_CLI_ANALYTICS: 'false' },
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
