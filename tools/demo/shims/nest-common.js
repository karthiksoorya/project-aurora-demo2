// Browser shim for @nestjs/common: decorators record route metadata for the in-browser router.
// Only what the Aurora controllers and services use is implemented.
const errors = require('../errors-proxy');
const ROUTES = (globalThis.__auroraRoutes ??= new Map()); // Controller class -> { prefix, handlers }
const meta = (target) => {
  const C = target.constructor === Function ? target : target.constructor;
  if (!ROUTES.has(C)) ROUTES.set(C, { prefix: '', handlers: {} });
  return ROUTES.get(C);
};
const handler = (target, key) => (meta(target).handlers[key] ??= { methods: [], paths: [], params: [], code: undefined });
const route = (method) => (path) => (target, key) => {
  const h = handler(target, key);
  h.methods.push(method);
  const ps = Array.isArray(path) ? path : [path ?? ''];
  h.paths.push(...ps);
};
const param = (kind) => (name, pipe) => (target, key, index) => {
  if (typeof name === 'object') [name, pipe] = [undefined, name];
  handler(target, key).params[index] = { kind, name, pipe };
};
exports.Controller = (prefix) => (C) => {
  meta(C).prefix = typeof prefix === 'string' ? prefix : '';
};
exports.Get = route('GET');
exports.Post = route('POST');
exports.Put = route('PUT');
exports.Delete = route('DELETE');
exports.All = route('ALL');
exports.Param = param('param');
exports.Query = param('query');
exports.Body = param('body');
exports.Res = () => (t, k, i) => { handler(t, k).params[i] = { kind: 'res' }; };
exports.UploadedFile = () => (t, k, i) => { handler(t, k).params[i] = { kind: 'file' }; };
exports.HttpCode = (code) => (t, k) => { handler(t, k).code = code; };
exports.UseInterceptors = () => () => undefined;
exports.Injectable = () => () => undefined;
exports.Catch = () => () => undefined;
exports.Module = () => () => undefined;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
exports.ParseUUIDPipe = class ParseUUIDPipe {
  transform(v) {
    if (!UUID.test(String(v))) throw new errors.DomainError(400, 'VALIDATION_FAILED', 'Validation failed (uuid is expected)');
    return v;
  }
};
exports.Logger = class Logger {
  constructor(ctx) { this.ctx = ctx; }
  log(m) { console.debug(`[${this.ctx}] ${m}`); }
  warn(m) { console.warn(`[${this.ctx}] ${m}`); }
  error(m) { console.error(`[${this.ctx}] ${m}`); }
  static log() {}
};
exports.HttpException = class HttpException extends Error {};
exports.HttpStatus = { INTERNAL_SERVER_ERROR: 500 };
exports.__routes = ROUTES;
