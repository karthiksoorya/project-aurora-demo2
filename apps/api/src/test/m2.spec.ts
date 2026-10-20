import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import request from 'supertest';
import { AppModule } from '../app.module';
import { configureApp } from '../bootstrap';
import { USERS } from '../common/request-context';
import { SEED_PROJECT_ID } from '../fixtures/seed';

const P = SEED_PROJECT_ID;
const [OWNER, PD, RA, MK] = USERS.map((u) => u.id);
let dir: string;
let app: INestApplication;

async function boot() {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const a = mod.createNestApplication({ logger: false });
  configureApp(a);
  await a.init();
  return a;
}
const as = (user: string) => ({
  get: (u: string) => request(app.getHttpServer()).get(u).set('x-aurora-user', user),
  post: (u: string) => request(app.getHttpServer()).post(u).set('x-aurora-user', user),
  put: (u: string) => request(app.getHttpServer()).put(u).set('x-aurora-user', user),
});

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'aurora-m2-'));
  process.env.AURORA_DATA_DIR = dir;
  app = await boot();
});
afterAll(async () => {
  await app.close();
  rmSync(dir, { recursive: true, force: true });
});

async function saveVersion(label: string, mutate?: (items: { massPct: string }[]) => void) {
  const d = (await as(OWNER).get(`/api/v1/projects/${P}/formula-draft`).expect(200)).body;
  let rev = d.revision;
  if (mutate) {
    const items = structuredClone(d.items);
    mutate(items);
    rev = (await as(OWNER).put(`/api/v1/projects/${P}/formula-draft`).send({ revision: rev, items }).expect(200)).body
      .revision;
  }
  return (
    await as(OWNER)
      .post(`/api/v1/projects/${P}/formula-versions`)
      .send({ expectedDraftRevision: rev, versionLabel: label })
      .expect(201)
  ).body;
}

describe('simulated identity & project roles (A10)', () => {
  it('lists the four simulated users and resolves the caller', async () => {
    expect((await as(OWNER).get('/api/v1/users').expect(200)).body).toHaveLength(4);
    expect((await as(MK).get('/api/v1/me').expect(200)).body.name).toBe('Marketing');
    await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('x-aurora-user', '00000000-0000-4000-8000-000000000000')
      .expect(401);
  });
  it('members have seeded roles; project detail exposes my role', async () => {
    const m = (await as(OWNER).get(`/api/v1/projects/${P}/members`).expect(200)).body;
    expect(Object.fromEntries(m.map((x: { name: string; role: string }) => [x.name, x.role]))).toEqual({
      'Senior Perfumer': 'owner',
      'Product Development': 'reviewer',
      'Regulatory Affairs': 'reviewer',
      Marketing: 'viewer',
    });
    expect((await as(MK).get(`/api/v1/projects/${P}`).expect(200)).body.myRole).toBe('viewer');
  });
  it('viewers and reviewers can read but never modify formula / brief', async () => {
    const d = (await as(MK).get(`/api/v1/projects/${P}/formula-draft`).expect(200)).body;
    const r1 = await as(MK)
      .put(`/api/v1/projects/${P}/formula-draft`)
      .send({ revision: d.revision, items: d.items })
      .expect(403);
    expect(r1.body.code).toBe('FORBIDDEN');
    await as(PD)
      .post(`/api/v1/projects/${P}/formula-versions`)
      .send({ expectedDraftRevision: d.revision, versionLabel: 'X' })
      .expect(403);
    const b = (await as(PD).get(`/api/v1/projects/${P}/brief`).expect(200)).body;
    await as(PD).put(`/api/v1/projects/${P}/brief`).send({ revision: b.revision, content: b.content }).expect(403);
  });
  it('only owners change roles and the last owner cannot be demoted', async () => {
    await as(PD).put(`/api/v1/projects/${P}/members/${MK}`).send({ role: 'reviewer' }).expect(403);
    const r = await as(OWNER).put(`/api/v1/projects/${P}/members/${OWNER}`).send({ role: 'viewer' }).expect(422);
    expect(r.body.code).toBe('LAST_OWNER');
  });
});

describe('validation runs (A8)', () => {
  let v1: { id: string };
  it('complete formula: checks pass, regulatory is Not assessed, overall not_assessed', async () => {
    v1 = await saveVersion('V1');
    const run = (
      await as(OWNER)
        .post('/api/v1/validations')
        .send({ formulaVersionId: v1.id, market: 'EU', category: 'Fine fragrance (hydroalcoholic)' })
        .expect(201)
    ).body;
    const byRule = (id: string) => run.findings.filter((f: { ruleId: string }) => f.ruleId === id);
    expect(byRule('FC-001')[0].status).toBe('pass');
    expect(byRule('FC-005')[0].status).toBe('pass');
    expect(byRule('REG-NA').every((f: { status: string }) => f.status === 'not_assessed')).toBe(true);
    expect(byRule('REG-NA')[0].evidence.missingInputs.length).toBeGreaterThan(0);
    expect(run.status).toBe('not_assessed');
    expect(
      run.findings.some(
        (f: { status: string; category: string }) =>
          f.category !== 'formula_check' && f.category !== 'data_completeness' && f.status === 'pass',
      ),
    ).toBe(false);
    expect(run.coverage.find((c: { ruleSetId: string }) => c.ruleSetId === 'ifra-standards').status).toBe(
      'not_assessed',
    );
    expect(run.snapshotHash).toBeTruthy();
    expect(run.stale.isStale).toBe(false);
  });
  it('is deterministic for the same version and rule sets', async () => {
    const body = {
      formulaVersionId: v1.id,
      market: 'EU',
      category: 'Fine fragrance (hydroalcoholic)',
      ruleSetIds: ['aurora-formula-checks'],
    };
    const a = (await as(OWNER).post('/api/v1/validations').send(body).expect(201)).body;
    const b = (await as(OWNER).post('/api/v1/validations').send(body).expect(201)).body;
    const strip = (r: { findings: { ruleId: string; status: string; message: string }[] }) =>
      r.findings.map((f) => [f.ruleId, f.status, f.message]);
    expect(strip(a)).toEqual(strip(b));
    expect(a.status).toBe('warning'); // data-completeness warnings only
  });
  it('incomplete formula fails FC-001; older runs become stale when a newer version exists', async () => {
    const v2 = await saveVersion('V2-incomplete', (items) => (items[0].massPct = '10.000000'));
    const run = (
      await as(OWNER)
        .post('/api/v1/validations')
        .send({
          formulaVersionId: v2.id,
          market: 'Global',
          category: 'Candle / home fragrance',
          ruleSetIds: ['aurora-formula-checks'],
        })
        .expect(201)
    ).body;
    expect(run.findings.find((f: { ruleId: string }) => f.ruleId === 'FC-001').status).toBe('fail');
    expect(run.status).toBe('fail');
    const list = (await as(OWNER).get(`/api/v1/projects/${P}/validations`).expect(200)).body;
    const old = list.find((r: { formulaVersionId: string }) => r.formulaVersionId === v1.id);
    expect(old.stale.isStale).toBe(true);
    expect(old.stale.reasons.join(' ')).toContain('V2-incomplete');
  });
  it('only owners run validations; unknown markets are rejected', async () => {
    await as(RA)
      .post('/api/v1/validations')
      .send({ formulaVersionId: v1.id, market: 'EU', category: 'Fine fragrance (hydroalcoholic)' })
      .expect(403);
    await as(OWNER)
      .post('/api/v1/validations')
      .send({ formulaVersionId: v1.id, market: 'Mars', category: 'Fine fragrance (hydroalcoholic)' })
      .expect(400);
  });
});

describe('experiments & lineage (A9)', () => {
  it('attach to an exact version, typed observations, permissions, ancestry', async () => {
    const versions = (await as(OWNER).get(`/api/v1/projects/${P}/formula-versions`).expect(200)).body;
    const v1 = versions[0];
    const e = (
      await as(OWNER)
        .post('/api/v1/experiments')
        .send({
          formulaVersionId: v1.id,
          title: 'Blotter 24 h',
          protocol: { objective: 'Dry-down', method: 'Blotter, 10 % in ethanol', conditions: '22 °C' },
        })
        .expect(201)
    ).body;
    expect(e.versionLabel).toBe('V1');
    await as(OWNER)
      .post(`/api/v1/experiments/${e.id}/observations`)
      .send({ kind: 'measurement', text: 'Evaporation' })
      .expect(400);
    await as(OWNER)
      .post(`/api/v1/experiments/${e.id}/observations`)
      .send({
        kind: 'measurement',
        text: 'Mass after 24 h',
        measurement: { quantity: 'Residual mass', value: '0.42', unit: 'g', method: 'Analytical balance' },
      })
      .expect(201);
    await as(PD)
      .post(`/api/v1/experiments/${e.id}/observations`)
      .send({ kind: 'observation', text: 'Citrus fades by 2 h' })
      .expect(201);
    await as(MK)
      .post(`/api/v1/experiments/${e.id}/observations`)
      .send({ kind: 'observation', text: 'nope' })
      .expect(403);
    const got = (await as(MK).get(`/api/v1/experiments/${e.id}`).expect(200)).body;
    expect(got.observations.map((o: { kind: string }) => o.kind)).toEqual(['measurement', 'observation']);
    expect(got.status).toBe('in_progress');

    // branch from V1 -> save V3 -> parent is V1
    const d = (await as(OWNER).get(`/api/v1/projects/${P}/formula-draft`).expect(200)).body;
    await as(OWNER)
      .post(`/api/v1/formula-versions/${v1.id}/branch`)
      .send({ expectedDraftRevision: d.revision })
      .expect(200);
    const v3 = await saveVersion('V3-branch', (items) => {
      items[0].massPct = '16.000000';
      items[1].massPct = '14.000000';
    });
    expect(v3.snapshot.parentVersionId).toBe(v1.id);
    const lin = (await as(MK).get(`/api/v1/projects/${P}/lineage`).expect(200)).body;
    const node = lin.nodes.find((n: { versionLabel: string }) => n.versionLabel === 'V1');
    expect(node.experiments).toBe(1);
    expect(node.observations).toBe(2);
    expect(lin.nodes.find((n: { versionLabel: string }) => n.versionLabel === 'V3-branch').parentVersionId).toBe(v1.id);
  });
});

describe('reviews, comments, decisions, audit (A10, A11)', () => {
  it('enforces who may comment and approve, and audits every action', async () => {
    const v1 = (await as(OWNER).get(`/api/v1/projects/${P}/formula-versions`).expect(200)).body[0];
    await as(PD)
      .post('/api/v1/reviews')
      .send({ formulaVersionId: v1.id, title: 'x', reviewers: [{ userId: RA, permission: 'approve' }] })
      .expect(403);
    const bad = await as(OWNER)
      .post('/api/v1/reviews')
      .send({ formulaVersionId: v1.id, title: 'x', reviewers: [{ userId: MK, permission: 'approve' }] })
      .expect(422);
    expect(bad.body.code).toBe('ROLE_CANNOT_REVIEW');
    const r = (
      await as(OWNER)
        .post('/api/v1/reviews')
        .send({
          formulaVersionId: v1.id,
          title: 'V1 sign-off',
          reviewers: [
            { userId: PD, permission: 'approve' },
            { userId: RA, permission: 'comment' },
          ],
        })
        .expect(201)
    ).body;
    expect(r.status).toBe('submitted');
    expect(r.versionLabel).toBe('V1');

    await as(MK).post(`/api/v1/reviews/${r.id}/comments`).send({ comment: 'Looks great' }).expect(403); // viewer: read-only
    expect((await as(MK).get(`/api/v1/reviews/${r.id}`).expect(200)).body.title).toBe('V1 sign-off');
    await as(RA)
      .post(`/api/v1/reviews/${r.id}/comments`)
      .send({ comment: 'Supplier CoA needed for bergamot', kind: 'information' })
      .expect(201);
    await as(RA).post(`/api/v1/reviews/${r.id}/decisions`).send({ decision: 'approved' }).expect(403); // comment-only
    await as(OWNER).post(`/api/v1/reviews/${r.id}/decisions`).send({ decision: 'approved' }).expect(403); // no self-approval
    await as(PD).post(`/api/v1/reviews/${r.id}/decisions`).send({ decision: 'changes_requested' }).expect(400); // reason required
    const cr = (
      await as(PD)
        .post(`/api/v1/reviews/${r.id}/decisions`)
        .send({ decision: 'changes_requested', reason: 'Brighter top' })
        .expect(201)
    ).body;
    expect(cr.status).toBe('changes_requested');
    const ok = (
      await as(PD)
        .post(`/api/v1/reviews/${r.id}/decisions`)
        .send({ decision: 'approved', reason: 'Fine as reference' })
        .expect(201)
    ).body;
    expect(ok.status).toBe('approved');
    await as(PD).post(`/api/v1/reviews/${r.id}/decisions`).send({ decision: 'rejected', reason: 'late' }).expect(422);

    const events = (await as(MK).get(`/api/v1/projects/${P}/audit?action=review.&targetId=${r.id}`).expect(200)).body;
    expect(events.map((e: { action: string }) => e.action).sort()).toEqual(
      ['review.commented', 'review.decision', 'review.decision', 'review.requested'].sort(),
    );
    expect(events.every((e: { targetId: string }) => e.targetId === r.id)).toBe(true);
    expect(events.find((e: { action: string }) => e.action === 'review.commented').actorName).toBe(
      'Regulatory Affairs',
    );
  });
});

describe('schema upgrade v1 -> v2', () => {
  it('adds default memberships and keeps a backup', async () => {
    await app.close();
    const file = path.join(dir, 'aurora-db.json');
    const db = JSON.parse(readFileSync(file, 'utf8'));
    const v1 = {
      schemaVersion: 1,
      projects: db.projects,
      briefs: db.briefs,
      drafts: db.drafts,
      versions: db.versions,
      audit: db.audit,
      uploads: db.uploads,
    };
    writeFileSync(file, JSON.stringify(v1));
    app = await boot();
    const up = JSON.parse(readFileSync(file, 'utf8'));
    expect(up.schemaVersion).toBe(2);
    expect(up.memberships.length).toBe(4 * up.projects.length);
    expect(readFileSync(`${file}.v1.bak`, 'utf8')).toContain('"schemaVersion":1');
    expect((await as(MK).get(`/api/v1/projects/${P}`).expect(200)).body.myRole).toBe('viewer');
  });
});
