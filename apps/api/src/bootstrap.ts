import { INestApplication, ValidationError, ValidationPipe } from '@nestjs/common';
import type { Request, Response } from 'express';
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
