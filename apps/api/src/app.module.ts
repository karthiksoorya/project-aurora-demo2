import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { requestContext } from './common/request-context';
import { AiController } from './modules/ai/ai.controller';
import { FormulasController } from './modules/formulas/formulas.controller';
import { FormulasService } from './modules/formulas/formulas.service';
import { HealthController } from './modules/health/health.controller';
import { IngredientsController } from './modules/ingredients/ingredients.controller';
import { ProjectsController } from './modules/projects/projects.controller';
import { ProjectsService } from './modules/projects/projects.service';
import { FixtureCatalogRepository } from './persistence/fixture-catalog';
import { JsonUnitOfWork } from './persistence/json-store';
import { CatalogRepository, UnitOfWork } from './persistence/repositories';

/**
 * Persistence is bound through abstract tokens (UnitOfWork, CatalogRepository) so the
 * PostgreSQL adapters planned for M3 can be swapped in without touching domain services.
 */
@Module({
  controllers: [HealthController, ProjectsController, IngredientsController, FormulasController, AiController],
  providers: [
    JsonUnitOfWork,
    { provide: UnitOfWork, useExisting: JsonUnitOfWork },
    { provide: CatalogRepository, useClass: FixtureCatalogRepository },
    ProjectsService,
    FormulasService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(requestContext).forRoutes('*path');
  }
}
