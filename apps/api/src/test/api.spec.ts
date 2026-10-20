import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import request from 'supertest';
import { AppModule } from '../app.module';
import { configureApp } from '../bootstrap';
import { ingredientIdBySlug } from '../fixtures/ingredients';
import { SEED_PROJECT_ID } from '../fixtures/seed';

const P = SEED_PROJECT_ID;
let dir: string;
let app: INestApplication;

async function boot() {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const a = mod.createNestApplication({ logger: false });
  configureApp(a);
  await a.init();
  return a;
}
const http = () => request(app.getHttpServer());

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'aurora-api-'));
  process.env.AURORA_DATA_DIR = dir;
  app = await boot();
});
afterAll(async () => {
  await app.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('health & envelope', () => {
  it('GET /health and /api/v1/health are healthy', async () => {
    for (const url of ['/health', '/api/v1/health']) {
      const r = await http().get(url).expect(200);
      expect(r.body.status).toBe('ok');
      expect(r.body.ai.enabled).toBe(false);
    }
  });
  it('errors use the stable envelope with request id', async () => {
    const r = await http()
      .get('/api/v1/projects/00000000-0000-4000-8000-000000000000')
      .set('x-request-id', 'test-1')
      .expect(404);
    expect(r.body).toEqual({
      code: 'NOT_FOUND',
      message: 'Project not found',
      details: expect.anything(),
      requestId: 'test-1',
    });
  });
  it('AI proposals answer 503 (gateway disabled)', async () => {
    const r = await http().post('/api/v1/ai/proposals').send({}).expect(503);
    expect(r.body.code).toBe('AI_UNAVAILABLE');
  });
});

describe('catalog', () => {
  it('filters by query and family with facets', async () => {
    const r = await http().get('/api/v1/ingredients?q=berg').expect(200);
    // matches name and descriptor tags ("Bergamot-like" on Linalyl Acetate)
    expect(r.body.items.map((i: { name: string }) => i.name)).toEqual(['Bergamot EO', 'Linalyl Acetate']);
    const f = await http().get('/api/v1/ingredients?family=citrus').expect(200);
    expect(f.body.items.every((i: { family: string }) => i.family === 'citrus')).toBe(true);
    expect(f.body.facets.family.citrus).toBe(f.body.total);
  });
  it('natural mixture has constituents and no single structure (A7)', async () => {
    const r = await http()
      .get(`/api/v1/ingredients/${ingredientIdBySlug('bergamot-eo')}`)
      .expect(200);
    expect(r.body.kind).toBe('natural_mixture');
    expect(r.body.structure).toBeNull();
    expect(r.body.constituents.find((c: { name: string }) => c.name === 'Limonene').hasStructure).toBe(true);
    const ifra = r.body.properties.find((p: { key: string }) => p.key === 'ifra');
    expect(ifra).toMatchObject({ value: null, status: 'missing' });
  });
  it('single compound exposes a sourced structure whose formula matches (A7)', async () => {
    const r = await http()
      .get(`/api/v1/ingredients/${ingredientIdBySlug('limonene')}`)
      .expect(200);
    expect(r.body.structure.computedFormula).toBe('C10H16');
    expect(r.body.structure.formulaConsistent).toBe(true);
    expect(r.body.structure.provenance.method).toMatch(/RDKit/);
  });
});

describe('brief', () => {
  it('saves with revision and rejects stale revision (409)', async () => {
    const b = (await http().get(`/api/v1/projects/${P}/brief`).expect(200)).body;
    const content = { ...b.content, description: 'Updated by test', keywords: [...b.content.keywords, 'Airy'] };
    const saved = (await http().put(`/api/v1/projects/${P}/brief`).send({ revision: b.revision, content }).expect(200))
      .body;
    expect(saved.revision).toBe(b.revision + 1);
    const stale = await http().put(`/api/v1/projects/${P}/brief`).send({ revision: b.revision, content }).expect(409);
    expect(stale.body.code).toBe('STALE_REVISION');
  });
});

describe('formula draft, versions, compare (A4, A5, A12, A13)', () => {
  let v1: { id: string; snapshotHash: string };

  it('rejects negative / malformed quantities (400) and unknown ingredients', async () => {
    const d = (await http().get(`/api/v1/projects/${P}/formula-draft`).expect(200)).body;
    const bad = d.items.map((i: { massPct: string }, k: number) => (k === 0 ? { ...i, massPct: '-5' } : i));
    const r = await http()
      .put(`/api/v1/projects/${P}/formula-draft`)
      .send({ revision: d.revision, items: bad })
      .expect(400);
    expect(r.body.details[0].path).toBe('items.0.massPct');
    const unknown = [{ ...d.items[0], ingredientId: '00000000-0000-4000-8000-000000000000' }];
    await http().put(`/api/v1/projects/${P}/formula-draft`).send({ revision: d.revision, items: unknown }).expect(400);
  });

  it('save v1, edit draft, save v2: v1 stays bit-for-bit identical', async () => {
    const d = (await http().get(`/api/v1/projects/${P}/formula-draft`).expect(200)).body;
    expect(d.computed.totalPct).toBe('100.000000');
    v1 = (
      await http()
        .post(`/api/v1/projects/${P}/formula-versions`)
        .send({ expectedDraftRevision: d.revision, versionLabel: 'V1' })
        .expect(201)
    ).body;
    const v1Before = (await http().get(`/api/v1/formula-versions/${v1.id}`).expect(200)).body;
    expect(v1Before.hashVerified).toBe(true);

    const items = d.items.map((i: { ingredientId: string; massPct: string }) =>
      i.ingredientId === ingredientIdBySlug('bergamot-eo') ? { ...i, massPct: '22.000000' } : i,
    );
    const d2 = (
      await http().put(`/api/v1/projects/${P}/formula-draft`).send({ revision: d.revision, items }).expect(200)
    ).body;
    expect(d2.computed.totalPct).toBe('104.000000');
    expect(d2.computed.completeness).toBe('over');

    // stale revision never overwrites newer edits
    const stale = await http()
      .put(`/api/v1/projects/${P}/formula-draft`)
      .send({ revision: d.revision, items: d.items })
      .expect(409);
    expect(stale.body.details.currentRevision).toBe(d2.revision);

    const norm = (
      await http().post(`/api/v1/projects/${P}/formula-draft/normalize`).send({ revision: d2.revision }).expect(200)
    ).body;
    expect(norm.computed.totalPct).toBe('100.000000');

    await http()
      .post(`/api/v1/projects/${P}/formula-versions`)
      .send({ expectedDraftRevision: norm.revision, versionLabel: 'v1' })
      .expect(409);
    const v2 = (
      await http()
        .post(`/api/v1/projects/${P}/formula-versions`)
        .send({ expectedDraftRevision: norm.revision, versionLabel: 'V2' })
        .expect(201)
    ).body;
    expect(v2.snapshot.parentVersionId).toBe(v1.id);

    const v1After = (await http().get(`/api/v1/formula-versions/${v1.id}`).expect(200)).body;
    expect(JSON.stringify(v1After)).toBe(JSON.stringify(v1Before));

    const cmp = (await http().get(`/api/v1/formula-versions/compare?leftId=${v1.id}&rightId=${v2.id}`).expect(200))
      .body;
    const berg = cmp.rows.find((r: { ingredientId: string }) => r.ingredientId === ingredientIdBySlug('bergamot-eo'));
    expect(berg.leftPct).toBe('18.000000');
    expect(berg.change).toBe('changed');
    expect(cmp.summary.changed).toBeGreaterThan(0);
    expect(cmp.pyramid.left.top.massPct).toBe('30.000000'); // bergamot 18 + linalool 12 in V1
    expect(Number(cmp.pyramid.right.top.sharePct)).toBeGreaterThan(30);
  });

  it('data and hashes survive an API restart (A12)', async () => {
    await app.close();
    app = await boot();
    const list = (await http().get(`/api/v1/projects/${P}/formula-versions`).expect(200)).body;
    expect(list.map((v: { versionLabel: string }) => v.versionLabel)).toEqual(['V1', 'V2']);
    const v = (await http().get(`/api/v1/formula-versions/${v1.id}`).expect(200)).body;
    expect(v.snapshotHash).toBe(v1.snapshotHash);
    expect(v.hashVerified).toBe(true);
    expect((await http().get('/health')).body.persistence.versionIntegrity.mismatched).toEqual([]);
  });

  it('branching loads a version into the draft and is audited', async () => {
    const d = (await http().get(`/api/v1/projects/${P}/formula-draft`).expect(200)).body;
    const b = (
      await http()
        .post(`/api/v1/formula-versions/${v1.id}/branch`)
        .send({ expectedDraftRevision: d.revision })
        .expect(200)
    ).body;
    expect(b.basedOnVersionId).toBe(v1.id);
    expect(b.computed.totalPct).toBe('100.000000');
    const events = (await http().get(`/api/v1/projects/${P}/audit`).expect(200)).body.map(
      (e: { action: string }) => e.action,
    );
    expect(events).toEqual(
      expect.arrayContaining(['version.saved', 'draft.normalized', 'draft.branched_from_version', 'brief.updated']),
    );
  });

  it('tampering with a stored snapshot is detected on load', async () => {
    await app.close();
    const file = path.join(dir, 'aurora-db.json');
    const db = JSON.parse(readFileSync(file, 'utf8'));
    db.versions[0].snapshot.items[0].massPct = '99.000000';
    writeFileSync(file, JSON.stringify(db));
    app = await boot();
    const h = (await http().get('/health').expect(200)).body;
    expect(h.status).toBe('degraded');
    expect(h.persistence.versionIntegrity.mismatched).toEqual([v1.id]);
  });
});
