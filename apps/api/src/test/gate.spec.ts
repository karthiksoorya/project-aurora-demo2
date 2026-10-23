import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module';
import { configureApp } from '../bootstrap';
import { setupStore, type TestStore } from './harness';

/** Hosted-demo access gate (AURORA_ACCESS_PASSWORD). */
describe('access gate', () => {
  let store: TestStore;
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    store = await setupStore('aurora-gate');
    process.env.AURORA_ACCESS_PASSWORD = 'coastal-air-2026';
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
  });
  afterAll(async () => {
    delete process.env.AURORA_ACCESS_PASSWORD;
    await app.close();
    await store.cleanup();
  });

  it('blocks the API without the access cookie but keeps health and status open', async () => {
    const r = await http().get('/api/v1/projects').expect(401);
    expect(r.body.code).toBe('ACCESS_REQUIRED');
    await http().post('/api/v1/validations').send({}).expect(401);
    await http().get('/health').expect(200);
    expect((await http().get('/api/v1/access/status').expect(200)).body).toEqual({ required: true, granted: false });
  });

  it('rejects a wrong password and grants access with the right one', async () => {
    expect((await http().post('/api/v1/access/login').send({ password: 'nope' }).expect(401)).body.code).toBe(
      'WRONG_PASSWORD',
    );
    const ok = await http().post('/api/v1/access/login').send({ password: 'coastal-air-2026' }).expect(200);
    const cookie = ok.headers['set-cookie'] as unknown as string[];
    expect(cookie[0]).toMatch(/aurora_access=.*HttpOnly/);
    const list = await http().get('/api/v1/projects').set('Cookie', cookie).expect(200);
    expect(list.body.length).toBeGreaterThan(0);
    expect((await http().get('/api/v1/access/status').set('Cookie', cookie)).body.granted).toBe(true);
  });

  it('rejects forged or expired cookies, and a password change signs everyone out', async () => {
    await http().get('/api/v1/projects').set('Cookie', 'aurora_access=9999999999999.forged').expect(401);
    await http().get('/api/v1/projects').set('Cookie', 'aurora_access=1.abc').expect(401);
    const ok = await http().post('/api/v1/access/login').send({ password: 'coastal-air-2026' }).expect(200);
    const cookie = ok.headers['set-cookie'] as unknown as string[];
    process.env.AURORA_ACCESS_PASSWORD = 'rotated';
    await http().get('/api/v1/projects').set('Cookie', cookie).expect(401);
    process.env.AURORA_ACCESS_PASSWORD = 'coastal-air-2026';
  });

  it('throttles repeated wrong passwords', async () => {
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await http().post('/api/v1/access/login').send({ password: 'x' })).status;
    expect(last).toBe(429);
  });
});
