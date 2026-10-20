import { test as base, expect, type Page } from '@playwright/test';

export interface NetLog {
  external: string[];
  ai: string[];
  api: string[];
}

/**
 * Every test runs with an outbound-network guard: any request that is not to 127.0.0.1/localhost is
 * aborted and recorded, and the test fails if one happened. AI endpoint calls are recorded separately.
 */
export const test = base.extend<{ net: NetLog }>({
  net: [
    async ({ page }, use) => {
      const log: NetLog = { external: [], ai: [], api: [] };
      await page.route('**/*', (route) => {
        const u = new URL(route.request().url());
        const local = ['127.0.0.1', 'localhost'].includes(u.hostname) || u.protocol === 'data:' || u.protocol === 'blob:';
        if (!local) {
          log.external.push(route.request().url());
          return route.abort('blockedbyclient');
        }
        if (u.pathname.startsWith('/api/')) log.api.push(`${route.request().method()} ${u.pathname}`);
        if (u.pathname.startsWith('/api/v1/ai')) log.ai.push(`${route.request().method()} ${u.pathname}`);
        return route.continue();
      });
      await use(log);
      expect(log.external, 'no outbound (non-loopback) requests').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

export async function openApp(page: Page, path = '/') {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('aurora.e2e.init')) {
      localStorage.clear();
      sessionStorage.setItem('aurora.e2e.init', '1');
    }
  });
  await page.goto(path);
  await expect(page.getByTestId('workspace-title')).toBeVisible();
}

export async function projectId(page: Page) {
  const m = /\/projects\/([^/]+)\//.exec(page.url());
  if (!m) throw new Error(`no project id in ${page.url()}`);
  return m[1];
}
