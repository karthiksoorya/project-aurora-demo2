import { Controller, Get } from '@nestjs/common';
import { USERS } from '../../common/request-context';
import { CatalogRepository, UnitOfWork } from '../../persistence/repositories';

@Controller()
export class HealthController {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly catalog: CatalogRepository,
  ) {}

  @Get('health')
  async health() {
    const persistence = await this.uow.health();
    const ok = persistence.writable && persistence.versionIntegrity.mismatched.length === 0;
    return {
      status: ok ? 'ok' : 'degraded',
      service: 'aurora-api',
      version: '0.3.0',
      milestone: 'M3',
      persistence,
      catalog: { version: this.catalog.version(), ingredients: this.catalog.all().length },
      ai: { enabled: false, reason: 'AI gateway not configured (M4 requires explicit approval)' },
      identity: { mode: 'local-demo-simulated-users', users: USERS.length },
      outboundNetwork: 'none',
    };
  }
}
