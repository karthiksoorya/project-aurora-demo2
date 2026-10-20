import { restartApi, E2E_API } from './support/api-process';
import { expect, openApp, projectId, setQty, test, waitForCalc } from './support/fixtures';

/**
 * M1 GATE: create concept -> select ingredient -> edit formula -> save v1 -> refresh/restart ->
 * inspect v1 unchanged -> edit draft -> save v2 -> compare.  Runs on a brand-new project.
 */
test('M1 gate journey on a new project', async ({ page, request, net }) => {
  test.setTimeout(180_000);
  await openApp(page);

  // --- new project (header selector)
  const name = `Gate Journey ${Date.now() % 100000}`;
  await page.getByTestId('project-selector').click();
  await page.getByLabel('New project name').fill(name);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByTestId('project-selector')).toContainText(name);
  const pid = await projectId(page);

  // --- Concept Studio: brief + concept, save, reload
  await page.getByTestId('brief-description').fill('A bright marine citrus with a soft musky trail.');
  await page.getByTestId('keyword-add').click();
  await page.getByTestId('keyword-input').fill('Marine');
  await page.getByTestId('keyword-input').press('Enter');
  await page.getByTestId('new-concept').click();
  await page.getByTestId('concept-name').fill('Tidal Neroli');
  await page.getByTestId('concept-tags').fill('Marine, Floral');
  await page.getByTestId('concept-desc').fill('Neroli over a watery, mineral heart.');
  await page.getByTestId('concept-add').click();
  await expect(page.getByTestId('brief-state')).toContainText('Unsaved changes');
  await page.getByTestId('save-brief').click();
  await expect(page.getByTestId('brief-state')).toContainText('rev 2');
  await page.reload();
  await expect(page.getByTestId('concept-Tidal Neroli')).toBeVisible();
  await expect(page.getByTestId('brief-description')).toHaveValue('A bright marine citrus with a soft musky trail.');

  // --- Ingredient Explorer: search, select (does NOT add), then explicit add
  await page.getByTestId('nav-ingredients').click();
  await page.getByTestId('tab-list').click();
  for (const [q, slug] of [
    ['bergamot', 'bergamot-eo'],
    ['calone', 'calone'],
    ['hedione', 'hedione'],
  ] as const) {
    await page.getByTestId('ingredient-search').fill(q);
    await page.getByTestId(`row-${slug}`).click();
    await expect(page.getByTestId('detail-name')).toBeVisible();
    await page.getByTestId('detail-add-to-formula').click();
  }
  // selection alone never added anything: exactly 3 lines in the new draft
  await expect
    .poll(
      async () => (await (await request.get(`${E2E_API}/api/v1/projects/${pid}/formula-draft`)).json()).items.length,
    )
    .toBe(3);

  // --- Formula Studio: edit quantities (server computes totals)
  await page.getByTestId('nav-formula').click();
  await setQty(page, 'bergamot-eo', '40');
  await setQty(page, 'calone', '25.5');
  await setQty(page, 'hedione', '34.5');
  await waitForCalc(page);
  await expect(page.getByTestId('formula-total')).toHaveText('100.00 %');
  await expect(page.getByTestId('formula-completeness')).toContainText('Complete');

  // --- save V1
  await page.getByTestId('save-version').click();
  await expect(page.getByTestId('version-label')).toHaveValue('V1');
  await page.getByTestId('confirm-save-version').click();
  await expect(page.getByTestId('save-version-dialog')).toHaveCount(0);
  const versions1 = await (await request.get(`${E2E_API}/api/v1/projects/${pid}/formula-versions`)).json();
  expect(versions1).toHaveLength(1);
  const v1 = versions1[0];
  const v1Before = await (await request.get(`${E2E_API}/api/v1/formula-versions/${v1.id}`)).json();

  // --- restart the API and refresh the page: everything persists
  await restartApi();
  await page.reload();
  await expect(page.getByTestId('formula-total')).toHaveText('100.00 %');
  await page.getByTestId('tab-history').click();
  await page.getByTestId('version-V1').click();
  await expect(page.getByTestId('hash-verified')).toHaveText('Hash verified');
  await expect(page.getByTestId('version-snapshot')).toContainText('25.500000');

  // --- edit the draft (over 100 -> explicit normalize) and save V2
  await page.getByTestId('tab-builder').click();
  await setQty(page, 'bergamot-eo', '45');
  await waitForCalc(page);
  await expect(page.getByTestId('formula-total')).toHaveText('105.00 %');
  await expect(page.getByTestId('formula-completeness')).toContainText('Over 100');
  await page.getByTestId('normalize').click();
  await waitForCalc(page);
  await expect(page.getByTestId('formula-total')).toHaveText('100.00 %');
  await page.getByTestId('save-version').click();
  await expect(page.getByTestId('version-label')).toHaveValue('V2');
  await page.getByTestId('confirm-save-version').click();
  await expect(page.getByTestId('save-version-dialog')).toHaveCount(0);

  // --- v1 is bit-for-bit unchanged
  const v1After = await (await request.get(`${E2E_API}/api/v1/formula-versions/${v1.id}`)).json();
  expect(JSON.stringify(v1After)).toBe(JSON.stringify(v1Before));

  // --- compare V1 vs V2 with real deltas from saved snapshots
  await page.getByTestId('tab-compare').click();
  await expect(page.getByTestId('compare-table')).toBeVisible();
  const berg = page.getByTestId('cmp-bergamot-eo');
  await expect(berg).toContainText('40.00');
  await expect(berg).toContainText('42.86'); // 45 / 105 * 100, largest-remainder normalised
  await expect(berg.getByTestId('cmp-delta')).toContainText('+2.86');
  await expect(page.getByTestId('version-compare')).toContainText('Computed from saved immutable snapshots');

  expect(net.ai, 'no AI calls in Manual mode').toEqual([]);
});
