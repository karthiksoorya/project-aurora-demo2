import { apiAs, normaliseDraft, USERS } from './support/demo-data';
import { COASTAL_AIR_ID, expect, openApp, test } from './support/fixtures';

/** Journey 1 + 2: validation tied to an immutable version, honest Not assessed, stale results (A8). */
test.describe('M2 · Validation Studio', () => {
  test('J1 run validation on a saved version: checks evaluated, regulatory Not assessed, evidence traceable', async ({
    page,
    request,
  }) => {
    const o = apiAs(request, USERS.owner);
    const sfx = Date.now() % 100000;
    const d = await o.get(`/projects/${COASTAL_AIR_ID}/formula-draft`);
    // normalise the shared draft to exactly 100 % (other specs may have left it incomplete)
    const rest = d.items
      .slice(1)
      .reduce((a: number, i: { massPct: string }) => a + Math.round(Number(i.massPct) * 1e6), 0);
    const items = d.items.map((i: { massPct: string }, k: number) =>
      k === 0 ? { ...i, massPct: ((1e8 - rest) / 1e6).toFixed(6) } : i,
    );
    const d2 = await o.put(`/projects/${COASTAL_AIR_ID}/formula-draft`, { revision: d.revision, items });
    const v = await o.post(`/projects/${COASTAL_AIR_ID}/formula-versions`, {
      expectedDraftRevision: d2.revision,
      versionLabel: `VAL-${sfx}`,
    });
    expect(v.snapshot.completeness).toBe('complete');

    await openApp(page);
    await page.getByTestId('nav-validation').click();
    await page.getByTestId('vs-version').selectOption(v.id);
    await page.getByTestId('vs-market').selectOption('EU');
    await page.getByTestId('run-validation').click();
    await expect(page.getByTestId('vs-version-label')).toContainText(`VAL-${sfx}`);
    await expect(page.getByTestId('vs-run-status')).toContainText('Not assessed');
    await expect(page.getByTestId('vs-check-FC-001')).toContainText('Pass');
    await expect(page.getByTestId('vs-check-FC-005')).toContainText('Snapshot integrity verified');
    await expect(page.getByTestId('vs-row-bergamot-eo')).toContainText('Not assessed');
    await expect(page.getByTestId('vs-insights')).toContainText('IFRA Standards: Not assessed');
    // never a compliance claim
    await expect(page.locator('main')).not.toContainText(/\bCompliant\b/);

    await page.getByTestId('vs-tab-standards').click();
    await expect(page.getByTestId('vs-coverage')).toContainText('No verified dataset configured');
    await page.getByTestId('vs-tab-evidence').click();
    await expect(page.getByTestId('vs-evidence-hash')).toHaveText(v.snapshotHash);
    await page.getByTestId('vs-tab-history').click();
    await expect(page.getByTestId('vs-history')).toContainText(`VAL-${sfx}`);
    await expect(page.getByTestId('vs-history')).toContainText('Current');
  });

  test('J2 incomplete version fails FC-001 and older results are flagged stale', async ({ page, request }) => {
    const o = apiAs(request, USERS.owner);
    const sfx = Date.now() % 100000;
    const d = await o.get(`/projects/${COASTAL_AIR_ID}/formula-draft`);
    const items = d.items.map((i: { massPct: string }, k: number) => (k === 0 ? { ...i, massPct: '1.000000' } : i));
    const d2 = await o.put(`/projects/${COASTAL_AIR_ID}/formula-draft`, { revision: d.revision, items });
    const v = await o.post(`/projects/${COASTAL_AIR_ID}/formula-versions`, {
      expectedDraftRevision: d2.revision,
      versionLabel: `INC-${sfx}`,
    });
    expect(v.snapshot.completeness).toBe('incomplete');

    await openApp(page);
    await page.getByTestId('nav-validation').click();
    await page.getByTestId('vs-version').selectOption(v.id);
    await page.getByTestId('run-validation').click();
    await expect(page.getByTestId('vs-run-status')).toContainText('Fail');
    await expect(page.getByTestId('vs-check-FC-001')).toContainText('complete formula (100 %) is required');
    await page.getByTestId('vs-tab-history').click();
    await expect(page.getByTestId('vs-history').getByText('Stale').first()).toBeVisible();

    // reviewers cannot run validations (UI disabled, API 403)
    const r = await apiAs(request, USERS.ra).raw.post('/validations', {
      formulaVersionId: v.id,
      market: 'EU',
      category: 'Fine fragrance (hydroalcoholic)',
    });
    expect(r.status()).toBe(403);
    await normaliseDraft(o, COASTAL_AIR_ID);
  });
});
