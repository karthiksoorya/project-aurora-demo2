import { E2E_API, E2E_PG_ADMIN, restartApi } from './support/api-process';
import { apiAs, USERS } from './support/demo-data';
import { COASTAL_AIR_ID, expect, openApp, test } from './support/fixtures';

/** M3: the running build reports its storage honestly; review/experiment evidence survives an API restart. */
test('M3 storage adapter is reported and M2 evidence survives a restart', async ({ page, request }) => {
  test.setTimeout(120_000);
  const h = await (await request.get(`${E2E_API}/health`)).json();
  const expected = E2E_PG_ADMIN ? 'postgresql' : 'json-file';
  expect(h.persistence.adapter).toBe(expected);
  expect(h.persistence.versionIntegrity.mismatched).toEqual([]);

  const o = apiAs(request, USERS.owner);
  const sfx = Date.now() % 100000;
  const d = await o.get(`/projects/${COASTAL_AIR_ID}/formula-draft`);
  const v = await o.post(`/projects/${COASTAL_AIR_ID}/formula-versions`, {
    expectedDraftRevision: d.revision,
    versionLabel: `DB-${sfx}`,
  });
  const run = await o.post('/validations', {
    formulaVersionId: v.id,
    market: 'EU',
    category: 'Fine fragrance (hydroalcoholic)',
  });
  const exp = await o.post('/experiments', {
    formulaVersionId: v.id,
    title: `Persist ${sfx}`,
    protocol: { objective: 'x', method: 'y', conditions: 'z' },
  });
  await o.post(`/experiments/${exp.id}/observations`, {
    kind: 'measurement',
    text: 'Residual',
    measurement: { quantity: 'Mass', value: '0.25', unit: 'g', method: 'Balance' },
  });
  const rev = await o.post('/reviews', {
    formulaVersionId: v.id,
    title: `Persist ${sfx}`,
    reviewers: [{ userId: USERS.pd, permission: 'approve' }],
  });
  await apiAs(request, USERS.pd).post(`/reviews/${rev.id}/decisions`, { decision: 'approved', reason: 'ok' });

  await restartApi();

  expect((await o.get(`/validations/${run.id}`)).snapshotHash).toBe(v.snapshotHash);
  const e2 = await o.get(`/experiments/${exp.id}`);
  expect(e2.observations[0].measurement).toEqual({ quantity: 'Mass', value: '0.25', unit: 'g', method: 'Balance' });
  const r2 = await o.get(`/reviews/${rev.id}`);
  expect(r2.status).toBe('approved');
  expect(r2.decisions[0].userName).toBe('Product Development');

  await openApp(page);
  await page.getByRole('button', { name: 'About this build' }).click();
  await expect(page.getByTestId('help-storage')).toContainText(
    E2E_PG_ADMIN ? 'PostgreSQL database' : 'local JSON file',
  );
});
