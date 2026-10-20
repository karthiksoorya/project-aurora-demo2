import {
  expect,
  freeCanvasPoint,
  liveScenes,
  openApp,
  sceneCamera,
  sceneScreenPos,
  test,
  waitForScene,
} from './support/fixtures';

async function clickFirstPickable(page: import('@playwright/test').Page, key: string, kind: string, chip: string) {
  const ids = await page.evaluate(([k, kd]) => window.__aurora!.scenes[k].objectIds(kd), [key, kind] as const);
  for (const id of ids) {
    const pos = await sceneScreenPos(page, key, id);
    if (!pos) continue;
    await page.mouse.click(pos.x, pos.y);
    const txt = await page
      .getByTestId(chip)
      .first()
      .textContent()
      .catch(() => '');
    if (txt) return id.split(':')[1];
  }
  return null;
}

test.describe('M1 · 3D canvases (A3, A6)', () => {
  test('canvas switcher renders all four views with WebGL', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('nav-formula').click();
    await page.getByTestId('canvas-inspiration').click();
    await expect(page.getByTestId('inspiration-canvas')).toBeVisible();
    await page.getByTestId('canvas-formula3d').click();
    await waitForScene(page, 'formula3d');
    await expect(page.locator('[data-testid=formula3d-canvas] canvas')).toHaveCount(1);
    await page.getByTestId('canvas-ingredients3d').click();
    await waitForScene(page, 'ingredients3d');
    await page.getByTestId('i3d-network').click();
    await waitForScene(page, 'ingredients3d');
    await page.getByTestId('i3d-list').click();
    await expect(page.getByTestId('i3d-fallback-list')).toBeVisible();
    await page.getByTestId('canvas-molecular').click();
    await expect(page.getByTestId('mi-side')).toBeVisible();
  });

  test('orbit, zoom and pan change the camera; reset restores it; camera persists', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('nav-formula').click();
    await page.getByTestId('canvas-formula3d').click();
    await waitForScene(page, 'formula3d');
    const c0 = await sceneCamera(page, 'formula3d');
    const p = (await freeCanvasPoint(page, 'formula3d-canvas'))!;
    expect(p).toBeTruthy();
    // orbit: left-drag on the canvas
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(p.x - 120, p.y - 20, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(600);
    const c1 = await sceneCamera(page, 'formula3d');
    expect(c1!.position).not.toEqual(c0!.position);
    // zoom: wheel
    await page.mouse.move(p.x, p.y);
    await page.mouse.wheel(0, -400);
    await page.waitForTimeout(600);
    const c2 = await sceneCamera(page, 'formula3d');
    const dist = (c: { position: number[]; target: number[] }) =>
      Math.hypot(...c.position.map((p, i) => p - c.target[i]));
    expect(dist(c2!)).toBeLessThan(dist(c1!));
    // keyboard pan (accessible alternative)
    await page.getByTestId('formula3d-canvas').focus();
    await page.keyboard.press('d');
    await page.waitForTimeout(200);
    const c3 = await sceneCamera(page, 'formula3d');
    expect(c3!.target).not.toEqual(c2!.target);
    // camera survives a canvas switch (state saved per scene)
    await page.waitForTimeout(400);
    await page.getByTestId('canvas-inspiration').click();
    await page.getByTestId('canvas-formula3d').click();
    await waitForScene(page, 'formula3d');
    expect(await sceneCamera(page, 'formula3d')).toEqual(await sceneCamera(page, 'formula3d'));
    const restored = await sceneCamera(page, 'formula3d');
    expect(restored!.target[0]).toBeCloseTo(c3!.target[0], 1);
    await page.getByTestId('view-reset').click();
    await page.waitForTimeout(300);
    expect((await sceneCamera(page, 'formula3d'))!.position).toEqual(c0!.position);
  });

  test('3D picking selects an ingredient and syncs with the formula table', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('nav-formula').click();
    await page.getByTestId('canvas-formula3d').click();
    await page.getByTestId('f3d-ingredient-view').click();
    await waitForScene(page, 'formula3d');
    const picked = await clickFirstPickable(page, 'formula3d', 'ingredient', 'selected-chip');
    expect(picked).toBeTruthy();
    await expect(page.locator('[data-testid=formula-table] tr.sel')).toHaveCount(1);
    // table -> 3D: selecting a row moves the selection chip
    await page.getByTestId('line-cashmeran').click();
    await expect(page.getByTestId('selected-chip')).toContainText('Cashmeran');
    // volatility layout also renders and is pickable
    await page.getByTestId('f3d-volatility').click();
    await waitForScene(page, 'formula3d');
    expect(
      await page.evaluate(() => window.__aurora!.scenes['formula3d'].objectIds('ingredient').length),
    ).toBeGreaterThan(5);
  });

  test('Ingredient Universe: filter + 3D pick + list stay in sync; adding needs an explicit action (A3)', async ({
    page,
  }) => {
    await openApp(page);
    await page.getByTestId('nav-ingredients').click();
    await waitForScene(page, 'universe');
    const count0 = await page.getByRole('button', { name: /^Formula \(/ }).innerText();
    await page.getByTestId('family-marine').click();
    await expect(page.getByTestId('result-count')).toContainText('1 of');
    // pick Calone (the only marine ingredient) in 3D
    const caloneId = await page.evaluate(() => {
      const s = window.__aurora!.scenes['universe'];
      return s.objectIds('ingredient');
    });
    let selected = false;
    for (const id of caloneId) {
      const p = await sceneScreenPos(page, 'universe', id);
      if (!p) continue;
      await page.mouse.click(p.x, p.y);
      await page.waitForTimeout(500); // detail is fetched from the API
      if ((await page.getByTestId('detail-name').textContent())?.trim() === 'Calone') {
        selected = true;
        break;
      }
    }
    expect(selected).toBe(true);
    await expect(page.getByRole('button', { name: /^Formula \(/ })).toHaveText(count0);
    await page.getByTestId('tab-list').click();
    await expect(page.getByTestId('row-calone')).toHaveClass(/sel/);
    await page.getByTestId('clear-filters').click();
  });

  test('WebGL resources are disposed when leaving a 3D workspace (A6)', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('nav-ingredients').click();
    await waitForScene(page, 'universe');
    expect(await liveScenes(page)).toBe(1);
    await page.getByTestId('nav-formula').click();
    await page.getByTestId('canvas-formula3d').click();
    await waitForScene(page, 'formula3d');
    expect(await liveScenes(page)).toBe(1);
    await page.getByTestId('canvas-inspiration').click();
    await expect.poll(() => liveScenes(page)).toBe(0);
    await page.getByTestId('canvas-formula3d').click();
    await waitForScene(page, 'formula3d');
    await page.getByTestId('nav-validation').click();
    await expect.poll(() => liveScenes(page)).toBe(0);
  });
});
