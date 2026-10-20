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
        const local =
          ['127.0.0.1', 'localhost'].includes(u.hostname) || u.protocol === 'data:' || u.protocol === 'blob:';
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

/**
 * Opens the app on the seeded "Coastal Air" project (stable fixture UUID) so specs do not depend on which
 * project was updated last (the landing route opens the most recent one). Pass a path to override.
 */
export const COASTAL_AIR_ID = '449b5ed1-d098-5f91-9839-006e26c6dd99';
export async function openApp(page: Page, path = `/projects/${COASTAL_AIR_ID}/concept`) {
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

/** Read the debug API that each SceneHost registers (window.__aurora). */
export async function sceneScreenPos(page: Page, sceneKey: string, objectId: string) {
  return page.evaluate(([k, id]) => window.__aurora?.scenes[k]?.screenPos(id) ?? null, [sceneKey, objectId] as const);
}
export async function sceneCamera(page: Page, sceneKey: string) {
  return page.evaluate((k) => window.__aurora?.scenes[k]?.camera() ?? null, sceneKey);
}
export async function waitForScene(page: Page, sceneKey: string) {
  await page.waitForFunction(
    (k) => !!window.__aurora?.scenes[k] && window.__aurora.scenes[k].pickables() > 0,
    sceneKey,
  );
}
export async function liveScenes(page: Page) {
  return page.evaluate(() => window.__aurora?.live() ?? 0);
}

/** Wait until the server-computed totals reflect all local edits. */
export async function waitForCalc(page: Page) {
  await expect(page.getByTestId('calc-state')).toContainText('Totals computed by API');
}

export async function setQty(page: Page, slug: string, value: string) {
  const input = page.getByTestId(`qty-${slug}`);
  await input.click();
  await input.fill(value);
  await input.blur();
}

declare global {
  interface Window {
    __aurora?: {
      scenes: Record<
        string,
        {
          screenPos(id: string): { x: number; y: number } | null;
          camera(): { position: number[]; target: number[] };
          pickables(): number;
          objectIds(kind?: string): string[];
        }
      >;
      live(): number;
    };
  }
}

/** A point inside a 3D stage where the WebGL canvas itself (not a label/toolbar) receives the pointer. */
export async function freeCanvasPoint(page: Page, stageTestId: string) {
  return page.evaluate((tid) => {
    const stage = document.querySelector(`[data-testid="${tid}"]`) as HTMLElement;
    const canvas = stage.querySelector('canvas')!;
    const r = canvas.getBoundingClientRect();
    for (const fy of [0.5, 0.35, 0.65, 0.25, 0.75])
      for (const fx of [0.5, 0.3, 0.7, 0.2, 0.8, 0.4, 0.6]) {
        const x = r.left + r.width * fx;
        const y = r.top + r.height * fy;
        if (document.elementFromPoint(x, y) === canvas) return { x, y };
      }
    return null;
  }, stageTestId);
}
