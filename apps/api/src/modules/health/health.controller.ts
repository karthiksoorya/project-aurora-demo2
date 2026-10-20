import { Controller, Get } from '@nestjs/common';
import { accessSync, constants } from 'node:fs';
import * as path from 'node:path';
import { DEMO_USER } from '../../common/request-context';
import { JsonUnitOfWork } from '../../persistence/json-store';
import { CatalogRepository, UnitOfWork } from '../../persistence/repositories';

@Controller()
export class HealthController {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly catalog: CatalogRepository,
  ) {}

  @Get('health')
  health() {
    const store = this.uow as JsonUnitOfWork;
    let writable = true;
    try {
      accessSync(path.dirname(store.file), constants.W_OK);
    } catch {
      writable = false;
    }
    const ok = writable && store.integrity.mismatched.length === 0;
    return {
      status: ok ? 'ok' : 'degraded',
      service: 'aurora-api',
      version: '0.1.0',
      milestone: 'M1',
      persistence: {
        adapter: 'json-file',
        file: path.basename(store.file),
        writable,
        versionIntegrity: store.integrity,
      },
      catalog: { version: this.catalog.version(), ingredients: this.catalog.all().length },
      ai: { enabled: false, reason: 'AI gateway not configured (M4 requires explicit approval)' },
      identity: { mode: 'local-demo', user: DEMO_USER.name },
      outboundNetwork: 'none',
    };
  }
}
