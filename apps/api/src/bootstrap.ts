import { INestApplication, ValidationError, ValidationPipe } from '@nestjs/common';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { badRequest, ErrorEnvelopeFilter } from './common/errors';
import { HealthController } from './modules/health/health.controller';

export const API_PREFIX = 'api/v1';

/** Shared app configuration (used by main.ts and by tests). */
export function configureApp(app: INestApplication) {
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => badRequest('Request validation failed', flatten(errors)),
    }),
  );
  app.useGlobalFilters(new ErrorEnvelopeFilter());
  // Un-prefixed liveness alias required by the M0 gate: GET /health
  const health = app.get(HealthController);
  const http = app.getHttpAdapter();
  serveWebApp(app);
  http.get('/health', (_req: Request, res: Response) => {
    health.health().then(
      (b) => res.json(b),
      (e: unknown) => res.status(503).json({ status: 'down', error: String(e) }),
    );
  });
}

/** Flatten nested class-validator errors into `[{ path: 'items.0.massPct', messages: [...] }]`. */
function flatten(errors: ValidationError[], prefix = ''): { path: string; messages: string[] }[] {
  return errors.flatMap((e) => {
    const p = prefix ? `${prefix}.${e.property}` : e.property;
    const own = e.constraints ? [{ path: p, messages: Object.values(e.constraints) }] : [];
    return [...own, ...flatten(e.children ?? [], p)];
  });
}

/**
 * Hosted single-service mode: when the built Angular app is present (AURORA_WEB_DIST, default
 * apps/web/dist/web/browser), the API also serves it, with an index.html fallback for client-side routes.
 */
function serveWebApp(app: INestApplication) {
  const dir = path.resolve(process.env.AURORA_WEB_DIST ?? path.join(__dirname, '../../web/dist/web/browser'));
  if (process.env.AURORA_SERVE_WEB === 'off' || !existsSync(path.join(dir, 'index.html'))) return;
  app.use(express.static(dir, { index: false, maxAge: '1h' }));
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/') || req.path === '/health') return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(dir, 'index.html'));
  });
}
