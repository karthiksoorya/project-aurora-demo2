import { expect, openApp, sceneScreenPos, setQty, test, waitForCalc, waitForScene } from './support/fixtures';

const WS = ['concept', 'ingredients', 'formula', 'validation', 'experiments', 'review'];

test.describe('M1 · context preservation (A1, A2, A14)', () => {
  test('navigating all six workspaces keeps project, unsaved brief edits and formula context', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('brief-description').fill('Unsaved idea: salt-air neroli.');
    await expect(page.getByTestId('brief-state')).toContainText('Unsaved changes');
    await page.getByTestId('nav-formula').click();
    await setQty(page, 'hedione', '10.25');
    await waitForCalc(page);
    for (const w of WS) {
      await page.getByTestId(`nav-${w}`).click();
      await expect(page.getByTestId('project-selector')).toContainText('Coastal Air');
    }
    await page.getByTestId('nav-concept').click();
    await expect(page.getByTestId('brief-description')).toHaveValue('Unsaved idea: salt-air neroli.');
    await expect(page.getByTestId('brief-state')).toContainText('Unsaved changes');
    await page.getByTestId('nav-formula').click();
    await expect(page.getByTestId('qty-hedione')).toHaveValue('10.25');
    await page.getByTestId('nav-concept').click();
    await page.getByRole('button', { name: 'Discard' }).click();
    await page.getByTestId('nav-formula').click();
    await setQty(page, 'hedione', '10');
    await waitForCalc(page);
  });

  test('Manual/AI switch preserves table, selection, canvas and camera; Manual makes zero AI calls', async ({
    page,
    net,
  }) => {
    await openApp(page);
    await page.getByTestId('nav-formula').click();
    await page.getByTestId('canvas-ingredients3d').click();
    await waitForScene(page, 'ingredients3d');
    // select Ambroxan by clicking its sphere in 3D
    const ambroxanId = await page.evaluate(() =>
      window.__aurora!.scenes['ingredients3d'].objectIds('ingredient').find((x) => x),
    );
    expect(ambroxanId).toBeTruthy();
    const ids = await page.evaluate(() => window.__aurora!.scenes['ingredients3d'].objectIds('ingredient'));
    let picked = '';
    for (const id of ids) {
      const pos = await sceneScreenPos(page, 'ingredients3d', id);
      if (!pos) continue;
      await page.mouse.click(pos.x, pos.y);
      picked = (await page.getByTestId('selected-chip').textContent()) ?? '';
      if (picked) break;
    }
    expect(picked).not.toBe('');
    const cam = await page.evaluate(() => window.__aurora!.scenes['ingredients3d'].camera());
    const table = await page.getByTestId('formula-table').innerText();
    expect(net.ai).toEqual([]);

    await page.getByTestId('mode-ai').click();
    await expect(page.getByTestId('ai-panel')).toBeVisible();
    await expect(page.getByTestId('canvas-ingredients3d')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('selected-chip')).toHaveText(picked);
    expect(await page.getByTestId('formula-table').innerText()).toBe(table);
    expect(await page.evaluate(() => window.__aurora!.scenes['ingredients3d'].camera())).toEqual(cam);

    await page.getByTestId('mode-manual').click();
    await expect(page.getByTestId('ai-panel')).toHaveCount(0);
    await expect(page.getByTestId('selected-chip')).toHaveText(picked);
    expect(await page.getByTestId('formula-table').innerText()).toBe(table);
    expect(net.ai.every((c) => c === 'GET /api/v1/ai/status')).toBe(true);
  });

  test('FS-06: AI Assist expanded 3D exploration shares the Manual formula state', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('nav-formula').click();
    await page.getByTestId('canvas-formula3d').click();
    await page.getByTestId('line-bergamot-eo').click();
    await page.getByTestId('mode-ai').click();
    await page.getByTestId('canvas-expand').click();
    await expect(page.getByTestId('workspace-title')).toHaveText('3D Exploration (AI Assisted)');
    await expect(page.getByTestId('formula-expanded')).toBeVisible();
    await expect(page.getByTestId('selected-ingredient-card')).toContainText('Bergamot EO');
    await expect(page.getByTestId('ai-exploration')).toContainText('No suggestions — AI gateway not connected');
    await expect(page.getByTestId('live-strip')).toContainText('Bergamot EO');
    await waitForScene(page, 'formula3d');
    // hide the optional AI panel: canvas keeps working
    await page.getByTestId('ai-exploration-close').click();
    await expect(page.getByTestId('ai-exploration')).toHaveCount(0);
    await expect(page.getByTestId('formula3d-canvas')).toBeVisible();
    // switch to Manual: same expanded canvas + selection, Formula Studio title
    await page.getByTestId('mode-manual').click();
    await expect(page.getByTestId('workspace-title')).toHaveText('Formula Studio');
    await expect(page.getByTestId('formula-expanded')).toBeVisible();
    await expect(page.getByTestId('selected-ingredient-card')).toContainText('Bergamot EO');
    await page.getByTestId('canvas-expand').click();
    await expect(page.getByTestId('formula-table')).toBeVisible();
  });

  test('refresh restores mode, canvas mode and selection (UI state) and server data', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('nav-formula').click();
    await page.getByTestId('canvas-inspiration').click();
    await page.getByTestId('line-vanillin').click();
    await page.reload();
    await expect(page.getByTestId('canvas-inspiration')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('inspiration-canvas')).toBeVisible();
    await expect(page.getByTestId('line-vanillin')).toHaveClass(/sel/);
  });
});
