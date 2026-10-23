import { Logger } from '@nestjs/common';
import type { Express } from 'express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { loadEnv } from './common/env';

async function bootstrap() {
  loadEnv(); // optional .env (DATABASE_URL etc.); real environment variables take precedence
  // Fail closed on hosting platforms: never serve a hosted demo without the access gate.
  const hosted = !!process.env.RENDER || process.env.AURORA_HOSTED === '1';
  if (hosted && !process.env.AURORA_ACCESS_PASSWORD && process.env.AURORA_ALLOW_OPEN !== '1') {
    Logger.error(
      'AURORA_ACCESS_PASSWORD is not set — refusing to start a hosted instance without the access gate',
      'Bootstrap',
    );
    process.exit(1);
  }
  const app = await NestFactory.create(AppModule, { logger: ['log', 'warn', 'error'] });
  configureApp(app);
  // Private-first: bind to loopback only unless explicitly overridden.
  const host = process.env.AURORA_API_HOST ?? '127.0.0.1';
  const port = Number(process.env.AURORA_API_PORT ?? process.env.PORT ?? 3000); // PORT: hosting platforms
  // behind a hosting proxy (Render etc.): trust X-Forwarded-* for client IP and HTTPS detection
  if (process.env.AURORA_TRUST_PROXY === '1') (app.getHttpAdapter().getInstance() as Express).set('trust proxy', 1);
  app.enableCors({ origin: [/^http:\/\/(localhost|127\.0\.0\.1):\d+$/] });
  app.enableShutdownHooks();
  await app.listen(port, host);
  Logger.log(`Aurora API listening on http://${host}:${port} (prefix /api/v1, health /health)`, 'Bootstrap');
}
void bootstrap();
