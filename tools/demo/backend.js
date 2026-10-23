/**
 * Aurora in-browser demo backend.
 * Runs the real compiled NestJS controllers, services, formula + validation engines and the JSON unit of work
 * (apps/api/dist) inside the page, with Nest decorators shimmed into a small router. No server, no network.
 * Exposes window.auroraDemo = { handle(req), uploadUrl(id), reset() }.
 */
require('reflect-metadata');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const { Buffer } = require('buffer');
const vfs = require('fs');
const { randomUUID } = require('node:crypto');
const D = '../../apps/api/dist';
const { __routes: ROUTES } = require('@nestjs/common');
const { DomainError } = require('../../apps/api/dist/common/errors');
const { USERS, DEMO_USER, userById } = require('../../apps/api/dist/common/request-context');
const { UnitOfWork, CatalogRepository } = require('../../apps/api/dist/persistence/repositories');
const { JsonUnitOfWork } = require('../../apps/api/dist/persistence/json-store');
const { FixtureCatalogRepository } = require('../../apps/api/dist/persistence/fixture-catalog');
const controllers = [
  require('../../apps/api/dist/modules/health/health.controller').HealthController,
  require('../../apps/api/dist/modules/access/access.controller').AccessController,
  require('../../apps/api/dist/modules/projects/projects.controller').ProjectsController,
  require('../../apps/api/dist/modules/ingredients/ingredients.controller').IngredientsController,
  require('../../apps/api/dist/modules/formulas/formulas.controller').FormulasController,
  require('../../apps/api/dist/modules/validations/validations').ValidationsController,
  require('../../apps/api/dist/modules/experiments/experiments').ExperimentsController,
  require('../../apps/api/dist/modules/reviews/reviews').ReviewsController,
  require('../../apps/api/dist/modules/ai/ai.controller').AiController,
];

// ---------- tiny DI container driven by TypeScript's emitted design:paramtypes ----------
const uow = new JsonUnitOfWork();
// same JSON unit of work as the local API; the "file" lives in this browser's localStorage
const jsonHealth = uow.health.bind(uow);
uow.health = async () => ({ ...(await jsonHealth()), adapter: 'browser-demo', location: 'this browser (localStorage)' });
const instances = new Map([
  [UnitOfWork, uow],
  [JsonUnitOfWork, uow],
  [CatalogRepository, new FixtureCatalogRepository()],
]);
function resolve(C) {
  if (instances.has(C)) return instances.get(C);
  const deps = (Reflect.getMetadata('design:paramtypes', C) ?? []).map(resolve);
  const inst = new C(...deps);
  instances.set(C, inst);
  return inst;
}

// ---------- route table ----------
const table = [];
for (const C of controllers) {
  const m = ROUTES.get(C);
  const inst = resolve(C);
  for (const [key, h] of Object.entries(m.handlers)) {
    const types = Reflect.getMetadata('design:paramtypes', C.prototype, key) ?? [];
    for (const method of h.methods)
      for (const p of h.paths) {
        const full = ['api/v1', m.prefix, p].filter(Boolean).join('/').replace(/\/+/g, '/');
        const names = [];
        const re = new RegExp(
          '^/' +
            full
              .split('/')
              .map((seg) => {
                if (seg.startsWith(':')) return names.push(seg.slice(1)), '([^/]+)';
                if (seg.startsWith('*')) return names.push(seg.slice(1)), '(.*)';
                return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              })
              .join('/') +
            '$',
        );
        table.push({ method, re, names, inst, key, h, types });
      }
  }
}
const health = table.find((r) => r.key === 'health' && r.method === 'GET');

function flatten(errors, prefix = '') {
  return errors.flatMap((e) => {
    const p = prefix ? `${prefix}.${e.property}` : e.property;
    const own = e.constraints ? [{ path: p, messages: Object.values(e.constraints) }] : [];
    return [...own, ...flatten(e.children ?? [], p)];
  });
}
async function validated(Type, body) {
  if (!Type || [String, Number, Boolean, Object, Array].includes(Type)) return body;
  const obj = plainToInstance(Type, body ?? {});
  const errs = await validate(obj, { whitelist: true, forbidNonWhitelisted: true });
  if (errs.length) throw new DomainError(400, 'VALIDATION_FAILED', 'Request validation failed', flatten(errs));
  return obj;
}

const blobUrls = new Map();
let ready;
let queue = Promise.resolve();

async function dispatch(req) {
  await (ready ??= uow.onModuleInit());
  const url = new URL(req.url, 'http://demo.local');
  let path = url.pathname.replace(/^.*?(\/api\/v1\/|\/health$)/, (_m, g) => (g === '/health' ? '/health' : '/api/v1/'));
  const requestId = randomUUID();
  const uid = req.headers?.['x-aurora-user'];
  const user = uid ? userById(uid) : DEMO_USER;
  if (!user) return { status: 401, body: { code: 'UNKNOWN_USER', message: 'Unknown simulated user', details: { uid }, requestId } };
  for (const als of globalThis.__auroraAls ?? []) als.enterWith({ user });

  const r = path === '/health' ? { ...health, match: [] } : null;
  const hit =
    r ??
    table
      .map((t) => ({ ...t, match: (t.method === req.method || t.method === 'ALL') && path.match(t.re) }))
      .find((t) => t.match);
  if (!hit) return { status: 404, body: { code: 'NOT_FOUND', message: `Cannot ${req.method} ${path}`, requestId } };
  const params = Object.fromEntries(hit.names.map((n, i) => [n, decodeURIComponent(hit.match[i + 1])]));
  let raw;
  const res = {
    headers: {},
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    sendFile(file) { raw = vfs.__read(file); },
  };
  try {
    const args = [];
    for (const [i, p] of hit.h.params.entries()) {
      if (!p) continue;
      let v;
      if (p.kind === 'param') v = params[p.name];
      else if (p.kind === 'query') v = p.name ? (url.searchParams.get(p.name) ?? undefined) : Object.fromEntries(url.searchParams);
      else if (p.kind === 'body') v = await validated(hit.types[i], req.body);
      else if (p.kind === 'res') v = res;
      else if (p.kind === 'file') v = req.file;
      if (p.pipe && v !== undefined) v = p.pipe.transform(v);
      args[i] = v;
    }
    const out = await hit.inst[hit.key](...args);
    if (raw !== undefined)
      return { status: 200, body: new Blob([raw], { type: res.headers['content-type'] }), blob: true };
    if (hit.key === 'upload' && out?.id) uploadUrl(out.id);
    return { status: hit.h.code ?? (req.method === 'POST' ? 201 : 200), body: out };
  } catch (e) {
    if (e instanceof DomainError)
      return { status: e.status, body: { code: e.code, message: e.message, details: e.details, requestId } };
    console.error(e);
    return { status: 500, body: { code: 'INTERNAL', message: 'Unexpected error in the demo backend', requestId } };
  }
}

/** Requests run strictly one at a time (single simulated user context, deterministic like the real API). */
function handle(req) {
  const run = queue.then(async () => {
    if (req.file instanceof File) {
      const f = req.file;
      req = { ...req, file: { originalname: f.name, mimetype: f.type, size: f.size, buffer: Buffer.from(await f.arrayBuffer()) } };
    }
    return dispatch(req);
  });
  queue = run.catch(() => undefined);
  return run;
}

/** Upload bytes are served to <img> tags through blob: URLs (there is no HTTP server). */
function uploadUrl(id) {
  if (blobUrls.has(id)) return blobUrls.get(id);
  const state = vfs.__read(`${uow.file}`);
  try {
    const db = JSON.parse(String(state));
    const u = db.uploads.find((x) => x.id === id);
    const bytes = u && vfs.__read(`${uow.uploadsDir}/${u.storedName}`);
    if (!bytes) return '';
    const url = URL.createObjectURL(new Blob([bytes], { type: u.mime }));
    blobUrls.set(id, url);
    return url;
  } catch {
    return '';
  }
}

window.auroraDemo = {
  handle,
  uploadUrl,
  users: USERS,
  reset() {
    vfs.__resetAll();
    try {
      Object.keys(localStorage).filter((k) => k.startsWith('aurora.')).forEach((k) => localStorage.removeItem(k));
    } catch { /* */ }
    location.reload();
  },
};
