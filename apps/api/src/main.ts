import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['log', 'warn', 'error'] });
  configureApp(app);
  // Private-first: bind to loopback only unless explicitly overridden.
  const host = process.env.AURORA_API_HOST ?? '127.0.0.1';
  const port = Number(process.env.AURORA_API_PORT ?? 3000);
  app.enableCors({ origin: [/^http:\/\/(localhost|127\.0\.0\.1):\d+$/] });
  app.enableShutdownHooks();
  await app.listen(port, host);
  Logger.log(`Aurora API listening on http://${host}:${port} (prefix /api/v1, health /health)`, 'Bootstrap');
}
void bootstrap();
