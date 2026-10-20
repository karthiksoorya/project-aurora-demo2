import { mkdirSync } from 'node:fs';
import * as path from 'node:path';
import type { Page } from '@playwright/test';
import { E2E_API } from './support/api-process';
import { expect, openApp, projectId, test, waitForScene } from './support/fixtures';

/**
 * A15 visual smoke: one screenshot per implemented screen state at the 1672x941 reference viewport,
 * named by SCREEN_MANIFEST_FINAL.md ID. These are review evidence, not pixel-diff assertions.
 */
const OUT = path.resolve(__dirname, 'screenshots');
mkdirSync(OUT, { recursive: true });

async function shot(page: Page, id: string) {
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Workspace navigation' })).toBeVisible();
  await expect(page.getByTestId('mode-switch')).toBeVisible();
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, `${id}.png`) });
}
const ai = (page: Page) => page.getByTestId('mode-ai').click();
const manual = (page: Page) => page.getByTestId('mode-manual').click();

test('visual smoke: implemented states by manifest ID', async ({ page, request }) => {
  test.setTimeout(300_000);
  await openApp(page);
  const pid = await projectId(page);
  // ensure two saved versions exist for the comparison screen
  const vs = await (await request.get(`${E2E_API}/api/v1/projects/${pid}/formula-versions`)).json();
  if (vs.length < 2) {
    const d = await (await request.get(`${E2E_API}/api/v1/projects/${pid}/formula-draft`)).json();
    await request.post(`${E2E_API}/api/v1/projects/${pid}/formula-versions`, {
      data: {
        expectedDraftRevision: d.revision,
        versionLabel: `Smoke ${Date.now() % 1000}A`,
        note: 'visual smoke baseline',
      },
    });
    const items = d.items.map((i: { massPct: string }, k: number) =>
      k === 0 ? { ...i, massPct: '22.000000' } : k === 3 ? { ...i, massPct: '18.000000' } : i,
    );
    const d2 = await (
      await request.put(`${E2E_API}/api/v1/projects/${pid}/formula-draft`, { data: { revision: d.revision, items } })
    ).json();
    await request.post(`${E2E_API}/api/v1/projects/${pid}/formula-versions`, {
      data: {
        expectedDraftRevision: d2.revision,
        versionLabel: `Smoke ${Date.now() % 1000}B`,
        note: 'brighter citrus',
      },
    });
    await page.reload();
  }

  // Concept
  await shot(page, 'CS-M');
  await ai(page);
  await shot(page, 'CS-A');
  await manual(page);

  // Ingredients
  await page.getByTestId('nav-ingredients').click();
  await waitForScene(page, 'universe');
  await shot(page, 'IE-M');
  await shot(page, 'IE-U1');
  await page.getByTestId('tab-list').click();
  await page.getByTestId('row-bergamot-eo').click();
  await page.getByTestId('detail-tab-composition').click();
  await page.getByTestId('tab-universe').click();
  await waitForScene(page, 'universe');
  await shot(page, 'IE-U2');
  await page.getByTestId('universe-expand').click();
  await shot(page, 'IE-U3');
  await page.getByTestId('universe-expand').click();
  await ai(page);
  await page.getByTestId('detail-tab-overview').click();
  await shot(page, 'IE-A');
  await manual(page);
  for (const slug of ['bergamot-eo', 'jasmine-absolute', 'sandalwood-eo', 'ambroxan']) {
    await page.getByTestId('tab-list').click();
    await page.getByTestId(`row-${slug}`).click();
    await page.getByTestId('detail-compare').click();
  }
  await page.getByTestId('open-compare').click();
  await shot(page, 'IE-C');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Close compare' }).click();

  // Formula
  await page.getByTestId('nav-formula').click();
  await page.getByTestId('line-bergamot-eo').click();
  await page.getByTestId('canvas-formula3d').click();
  await waitForScene(page, 'formula3d');
  await shot(page, 'FS-M1');
  await page.getByTestId('canvas-inspiration').click();
  await shot(page, 'FS-M2');
  await ai(page);
  await shot(page, 'FS-M3');
  await page.getByTestId('canvas-formula3d').click();
  await waitForScene(page, 'formula3d');
  await shot(page, 'FS-A');
  await page.getByTestId('canvas-expand').click();
  await waitForScene(page, 'formula3d');
  await shot(page, 'FS-06');
  await manual(page);
  await shot(page, 'FS-3DF');
  await page.getByTestId('canvas-ingredients3d').click();
  await waitForScene(page, 'ingredients3d');
  await shot(page, 'FS-3DI');
  await page.getByTestId('canvas-expand').click();
  await page.getByTestId('line-linalool').click();
  await page.getByTestId('canvas-molecular').click();
  await expect(page.getByTestId('molecule-canvas')).toBeVisible();
  await shot(page, 'FS-MI1');
  await page.getByTestId('mi-pick-bergamot-eo').click();
  await page.getByTestId('mi-constituent-Limonene').click();
  await expect(page.getByTestId('mi-breadcrumb')).toContainText('Limonene');
  await shot(page, 'FS-MI2');
  await page.getByTestId('tab-compare').click();
  await expect(page.getByTestId('compare-table')).toBeVisible();
  await shot(page, 'FS-VC');

  // M2 workspaces (shell + honest scope state)
  for (const [ws, m, a] of [
    ['validation', 'VS-M', 'VS-A'],
    ['experiments', 'EE-M1', 'EE-A'],
    ['review', 'SR-M', 'SR-A'],
  ] as const) {
    await page.getByTestId(`nav-${ws}`).click();
    await shot(page, m);
    await ai(page);
    await shot(page, a);
    await manual(page);
  }
});
