import { E2E_API } from './support/api-process';
import { expect, openApp, projectId, setQty, test, waitForCalc } from './support/fixtures';

test.describe('M1 · formula math & API rules (A4, A13)', () => {
  test('invalid / negative quantities are rejected client-side and never saved', async ({ page, request }) => {
    await openApp(page);
    const pid = await projectId(page);
    await page.getByTestId('nav-formula').click();
    await waitForCalc(page);
    const before = await (await request.get(`${E2E_API}/api/v1/projects/${pid}/formula-draft`)).json();

    for (const bad of ['-5', 'abc', '12.1234567', '150']) {
      await setQty(page, 'linalool', bad);
      await expect(page.getByTestId('qty-linalool')).toHaveAttribute('aria-invalid', 'true');
      await expect(page.getByRole('alert').filter({ hasText: 'Not saved' })).toBeVisible();
    }
    await page.waitForTimeout(600);
    const after = await (await request.get(`${E2E_API}/api/v1/projects/${pid}/formula-draft`)).json();
    expect(after.revision).toBe(before.revision);
    expect(after.items).toEqual(before.items);

    // the API also refuses a negative value sent directly
    const bad = await request.put(`${E2E_API}/api/v1/projects/${pid}/formula-draft`, {
      data: {
        revision: after.revision,
        items: after.items.map((i: { massPct: string }, k: number) => (k === 0 ? { ...i, massPct: '-1' } : i)),
      },
    });
    expect(bad.status()).toBe(400);
    expect((await bad.json()).code).toBe('VALIDATION_FAILED');
  });

  test('decimal totals are exact, incomplete/over states are flagged, nothing normalised implicitly', async ({
    page,
    request,
  }) => {
    await openApp(page);
    const pid = await projectId(page);
    await page.getByTestId('nav-formula').click();
    await setQty(page, 'linalool', '12.000001'); // 6 dp precision
    await waitForCalc(page);
    const d1 = await (await request.get(`${E2E_API}/api/v1/projects/${pid}/formula-draft`)).json();
    expect(d1.computed.totalPct).toBe('100.000001');
    await expect(page.getByTestId('formula-completeness')).toContainText('Over 100');

    await setQty(page, 'linalool', '11.5');
    await waitForCalc(page);
    await expect(page.getByTestId('formula-total')).toHaveText('99.50 %');
    await expect(page.getByTestId('formula-completeness')).toContainText('Incomplete · 0.50 % unassigned');
    await expect(page.getByTestId('formula-issues')).toContainText('0.50 % unassigned');
    const d2 = await (await request.get(`${E2E_API}/api/v1/projects/${pid}/formula-draft`)).json();
    expect(d2.items.find((i: { massPct: string }) => i.massPct === '11.500000')).toBeTruthy();
    expect(d2.computed.totalPct).toBe('99.500000');

    await setQty(page, 'linalool', '12');
    await waitForCalc(page);
    await expect(page.getByTestId('formula-total')).toHaveText('100.00 %');
  });

  test('stale draft revision is rejected with 409 and never overwrites newer edits (A13)', async ({ request }) => {
    const projects = await (await request.get(`${E2E_API}/api/v1/projects`)).json();
    const pid = projects.find((p: { name: string }) => p.name === 'Coastal Air').id;
    const d = await (await request.get(`${E2E_API}/api/v1/projects/${pid}/formula-draft`)).json();
    const newer = d.items.map((i: { massPct: string }, k: number) => (k === 0 ? { ...i, massPct: '18.000000' } : i));
    const ok = await request.put(`${E2E_API}/api/v1/projects/${pid}/formula-draft`, {
      data: { revision: d.revision, items: newer },
    });
    expect(ok.status()).toBe(200);
    const stale = await request.put(`${E2E_API}/api/v1/projects/${pid}/formula-draft`, {
      data: { revision: d.revision, items: d.items.map((i: object) => ({ ...i, massPct: '1.000000' })) },
    });
    expect(stale.status()).toBe(409);
    const body = await stale.json();
    expect(body.code).toBe('STALE_REVISION');
    expect(body.requestId).toBeTruthy();
    const now = await (await request.get(`${E2E_API}/api/v1/projects/${pid}/formula-draft`)).json();
    expect(now.revision).toBe(d.revision + 1);
    expect(now.items.some((i: { massPct: string }) => i.massPct === '1.000000')).toBe(false);
  });

  test('duplicate version labels are refused (409)', async ({ request }) => {
    const projects = await (await request.get(`${E2E_API}/api/v1/projects`)).json();
    const pid = projects.find((p: { name: string }) => p.name === 'Coastal Air').id;
    const d = await (await request.get(`${E2E_API}/api/v1/projects/${pid}/formula-draft`)).json();
    const a = await request.post(`${E2E_API}/api/v1/projects/${pid}/formula-versions`, {
      data: { expectedDraftRevision: d.revision, versionLabel: 'API-dup' },
    });
    expect(a.status()).toBe(201);
    const b = await request.post(`${E2E_API}/api/v1/projects/${pid}/formula-versions`, {
      data: { expectedDraftRevision: d.revision, versionLabel: 'api-DUP' },
    });
    expect(b.status()).toBe(409);
    expect((await b.json()).code).toBe('DUPLICATE_VERSION_LABEL');
  });
});
