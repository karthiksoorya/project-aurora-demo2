import { apiAs, USERS } from './support/demo-data';
import { COASTAL_AIR_ID, expect, openApp, setQty, test, waitForCalc } from './support/fixtures';

/** Journey 3: experiments attach to exact versions; branching provenance persists (A9). */
test('J3 experiment on a version, typed observations, branch and parent link', async ({ page, request }) => {
  test.setTimeout(150_000);
  const o = apiAs(request, USERS.owner);
  const sfx = Date.now() % 100000;
  const d = await o.get(`/projects/${COASTAL_AIR_ID}/formula-draft`);
  const base = await o.post(`/projects/${COASTAL_AIR_ID}/formula-versions`, {
    expectedDraftRevision: d.revision,
    versionLabel: `EXP-${sfx}`,
  });

  await openApp(page);
  await page.getByTestId('nav-experiments').click();
  await page.getByTestId('new-experiment').click();
  await page.getByTestId('ne-version').selectOption(base.id);
  await page.getByTestId('ne-title').fill(`Strip test ${sfx}`);
  await page.getByTestId('ne-create').click();
  await expect(page.getByTestId('exp-version')).toContainText(`EXP-${sfx}`);

  // a measurement must carry quantity, value, unit, method
  await page.getByTestId('obs-kind').selectOption('measurement');
  await page.getByTestId('obs-text').fill('Residual mass after 6 h');
  await expect(page.getByTestId('obs-add')).toBeDisabled();
  await page.getByTestId('obs-quantity').fill('Residual mass');
  await page.getByTestId('obs-value').fill('0.28');
  await page.getByTestId('obs-method').fill('Analytical balance');
  await page.getByTestId('obs-add').click();
  await expect(page.getByTestId('observations')).toContainText('Residual mass = 0.28');
  await page.getByTestId('obs-kind').selectOption('hypothesis');
  await page.getByTestId('obs-text').fill('Higher ambroxan could extend the trail');
  await page.getByTestId('obs-add').click();
  await expect(page.getByTestId('observations')).toContainText('Residual mass = 0.28');
  await expect(page.getByTestId('observations')).toContainText('Hypothesis');

  // branch from that version -> Formula Studio -> save child version
  await page.getByTestId('ee-tab-branching').click();
  await page.getByTestId(`lineage-EXP-${sfx}`).click();
  await page.getByTestId('create-branch').click();
  await expect(page).toHaveURL(/\/formula$/);
  await setQty(page, 'linalool', '11');
  await setQty(page, 'hedione', '11');
  await waitForCalc(page);
  await page.getByTestId('save-version').click();
  await page.getByTestId('version-label').fill(`EXP-${sfx}-B`);
  await page.getByTestId('confirm-save-version').click();
  await expect(page.getByTestId('save-version-dialog')).toHaveCount(0);

  const lin = await o.get(`/projects/${COASTAL_AIR_ID}/lineage`);
  const child = lin.nodes.find((n: { versionLabel: string }) => n.versionLabel === `EXP-${sfx}-B`);
  expect(child.parentVersionId).toBe(base.id);
  expect(lin.nodes.find((n: { id: string }) => n.id === base.id).experiments).toBe(1);

  await page.getByTestId('nav-experiments').click();
  await page.getByTestId('ee-tab-branching').click();
  await expect(page.getByTestId(`lineage-EXP-${sfx}-B`)).toBeVisible();
  // provenance survives a reload
  await page.reload();
  await page.getByTestId('ee-tab-branching').click();
  await page.getByTestId(`lineage-EXP-${sfx}-B`).click();
  await expect(page.getByTestId('branch-side')).toContainText(`EXP-${sfx}`);
});
