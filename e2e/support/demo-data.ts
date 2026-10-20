import type { APIRequestContext } from '@playwright/test';
import { E2E_API } from './api-process';

export const USERS = {
  owner: '6f1c2a5e-0000-4000-8000-000000000001',
  pd: '6f1c2a5e-0000-4000-8000-000000000002',
  ra: '6f1c2a5e-0000-4000-8000-000000000003',
  mk: '6f1c2a5e-0000-4000-8000-000000000004',
};

/** Thin API client acting as a simulated user (header x-aurora-user). */
export function apiAs(request: APIRequestContext, user: string) {
  const h = { 'x-aurora-user': user };
  const ok = async (r: Awaited<ReturnType<APIRequestContext['get']>>) => {
    if (!r.ok()) throw new Error(`${r.status()} ${r.url()} ${await r.text()}`);
    return r.json();
  };
  return {
    get: (p: string) => request.get(`${E2E_API}/api/v1${p}`, { headers: h }).then(ok),
    post: (p: string, data: unknown) => request.post(`${E2E_API}/api/v1${p}`, { headers: h, data }).then(ok),
    put: (p: string, data: unknown) => request.put(`${E2E_API}/api/v1${p}`, { headers: h, data }).then(ok),
    raw: {
      post: (p: string, data: unknown) => request.post(`${E2E_API}/api/v1${p}`, { headers: h, data }),
    },
  };
}

/**
 * Builds a realistic, fully synthetic history for a project: three versions with a branch, a validation run,
 * an experiment with typed observations and a review with comments and a decision. Idempotent by label suffix.
 */
export async function seedDemoHistory(request: APIRequestContext, projectId: string, suffix = '') {
  const o = apiAs(request, USERS.owner);
  const save = async (label: string, note: string, mutate?: (items: { massPct: string }[]) => void) => {
    const d = await o.get(`/projects/${projectId}/formula-draft`);
    let rev = d.revision;
    if (mutate) {
      const items = structuredClone(d.items);
      mutate(items);
      rev = (await o.put(`/projects/${projectId}/formula-draft`, { revision: rev, items })).revision;
    }
    return o.post(`/projects/${projectId}/formula-versions`, { expectedDraftRevision: rev, versionLabel: label, note });
  };
  const v1 = await save(`V1${suffix}`, 'Initial coastal concept');
  const v2 = await save(`V2${suffix}`, 'Brighter citrus top', (it) => {
    it[0].massPct = '22.000000'; // bergamot +4
    it[3].massPct = '18.000000'; // iso e super -4
  });
  await o.post('/validations', {
    formulaVersionId: v2.id,
    market: 'EU',
    category: 'Fine fragrance (hydroalcoholic)',
    ruleSetIds: ['aurora-formula-checks', 'ifra-standards', 'eu-cosmetics-allergens'],
  });
  const exp = await o.post('/experiments', {
    formulaVersionId: v1.id,
    title: `Blotter dry-down${suffix}`,
    protocol: {
      objective: 'Compare top-note fade',
      method: 'Smelling strips, 10 % in ethanol',
      conditions: '22 °C, 45 % RH',
    },
  });
  await o.post(`/experiments/${exp.id}/observations`, {
    kind: 'observation',
    text: 'Fresh citrus opening; marine heart reads clearly after 15 min.',
  });
  await o.post(`/experiments/${exp.id}/observations`, {
    kind: 'measurement',
    text: 'Strip mass after 6 h',
    measurement: { quantity: 'Residual mass', value: '0.31', unit: 'g', method: 'Analytical balance (0.01 g)' },
  });
  await apiAs(request, USERS.pd).post(`/experiments/${exp.id}/observations`, {
    kind: 'hypothesis',
    text: 'More ambroxan may extend the woody trail.',
  });
  // branch from V1 -> V3
  const d = await o.get(`/projects/${projectId}/formula-draft`);
  await o.post(`/formula-versions/${v1.id}/branch`, { expectedDraftRevision: d.revision });
  const v3 = await save(`V3${suffix}`, 'Woody marine branch from V1', (it) => {
    it[1].massPct = '10.000000';
    it[4].massPct = '20.000000';
  });
  const review = await o.post('/reviews', {
    formulaVersionId: v2.id,
    title: `V2 sign-off${suffix}`,
    message: 'Please review the brighter citrus direction before stability testing.',
    reviewers: [
      { userId: USERS.pd, permission: 'approve' },
      { userId: USERS.ra, permission: 'comment' },
    ],
  });
  await apiAs(request, USERS.ra).post(`/reviews/${review.id}/comments`, {
    comment: 'Supplier certificate of analysis needed for bergamot before any regulatory assessment.',
    kind: 'information',
  });
  await apiAs(request, USERS.pd).post(`/reviews/${review.id}/comments`, {
    comment: 'Citrus opening is fresher. Could we keep the marine accord as prominent?',
    kind: 'suggestion',
  });
  return { v1, v2, v3, exp, review };
}

/** Rescale item 0 so the shared Coastal Air draft totals exactly 100 % (specs share one data dir). */
export async function normaliseDraft(o: ReturnType<typeof apiAs>, projectId: string) {
  const d = await o.get(`/projects/${projectId}/formula-draft`);
  const rest = d.items
    .slice(1)
    .reduce((a: number, i: { massPct: string }) => a + Math.round(Number(i.massPct) * 1e6), 0);
  const items = d.items.map((i: { massPct: string }, k: number) =>
    k === 0 ? { ...i, massPct: ((1e8 - rest) / 1e6).toFixed(6) } : i,
  );
  return o.put(`/projects/${projectId}/formula-draft`, { revision: d.revision, items });
}
