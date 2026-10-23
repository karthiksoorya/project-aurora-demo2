import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { from, map } from 'rxjs';

/**
 * Static demo build support. When the page ships `demo-backend.js` (tools/demo), the real API code runs inside
 * the browser and is exposed as `window.auroraDemo`; API calls are answered by it instead of the network.
 * In the normal build `window.auroraDemo` is undefined and nothing here is active.
 */
interface DemoBackend {
  handle(req: {
    method: string;
    url: string;
    body: unknown;
    file?: File;
    headers: Record<string, string>;
  }): Promise<{ status: number; body: unknown }>;
  uploadUrl(id: string): string;
  reset(): void;
}
export const demoBackend = (): DemoBackend | undefined =>
  (globalThis as unknown as { auroraDemo?: DemoBackend }).auroraDemo;
export const isDemoBuild = () => !!demoBackend();

export const demoBackendInterceptor: HttpInterceptorFn = (req, next) => {
  const demo = demoBackend();
  if (!demo || !/(^|\/)(api\/v1\/|health$)/.test(req.url)) return next(req);
  const headers: Record<string, string> = {};
  for (const k of req.headers.keys()) headers[k.toLowerCase()] = req.headers.get(k) ?? '';
  const file = req.body instanceof FormData ? (req.body.get('file') as File | null) : null;
  return from(
    demo.handle({
      method: req.method,
      url: req.urlWithParams,
      body: req.body instanceof FormData ? undefined : req.body,
      file: file ?? undefined,
      headers,
    }),
  ).pipe(
    map((r) => {
      if (r.status >= 400) throw new HttpErrorResponse({ status: r.status, error: r.body, url: req.url });
      return new HttpResponse({ status: r.status, body: r.body, url: req.url });
    }),
  );
};
