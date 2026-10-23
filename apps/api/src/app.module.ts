import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { requestContext } from './common/request-context';
import { AccessController } from './modules/access/access.controller';
import { AccessGateController, accessGate } from './modules/gate/access-gate';
import { AiController } from './modules/ai/ai.controller';
import { ExperimentsController, ExperimentsService } from './modules/experiments/experiments';
import { ReviewsController, ReviewsService } from './modules/reviews/reviews';
import { ValidationsController, ValidationsService } from './modules/validations/validations';
import { FormulasController } from './modules/formulas/formulas.controller';
import { FormulasService } from './modules/formulas/formulas.service';
import { HealthController } from './modules/health/health.controller';
import { IngredientsController } from './modules/ingredients/ingredients.controller';
import { ProjectsController } from './modules/projects/projects.controller';
import { ProjectsService } from './modules/projects/projects.service';
import { FixtureCatalogRepository } from './persistence/fixture-catalog';
import { JsonUnitOfWork } from './persistence/json-store';
import { persistenceMode } from './persistence/pg/pg-config';
import { PgUnitOfWork } from './persistence/pg/pg-store';
import { CatalogRepository, UnitOfWork } from './persistence/repositories';

/**
 * Persistence is bound through abstract tokens (UnitOfWork, CatalogRepository) so the
 * PostgreSQL adapter (M3) is selected by configuration without touching domain services.
 */
@Module({
  controllers: [
    HealthController,
    AccessGateController,
    AccessController,
    ProjectsController,
    IngredientsController,
    FormulasController,
    ValidationsController,
    ExperimentsController,
    ReviewsController,
    AiController,
  ],
  providers: [
    {
      // AURORA_PERSISTENCE=postgres|json; defaults to postgres when DATABASE_URL is set
      provide: UnitOfWork,
      useFactory: () => (persistenceMode() === 'postgres' ? new PgUnitOfWork() : new JsonUnitOfWork()),
    },
    { provide: CatalogRepository, useClass: FixtureCatalogRepository },
    ProjectsService,
    FormulasService,
    ValidationsService,
    ExperimentsService,
    ReviewsService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(accessGate, requestContext).forRoutes('*path');
  }
}
