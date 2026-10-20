import { Injectable } from '@nestjs/common';
import { CATALOG_VERSION, INGREDIENTS, STRUCTURES } from '../fixtures/ingredients';
import type { Ingredient, StructureFixture } from '../domain/types';
import { CatalogRepository } from './repositories';

/** Read-only catalog backed by the curated demo fixture. */
@Injectable()
export class FixtureCatalogRepository extends CatalogRepository {
  private readonly byId = new Map(INGREDIENTS.map((i) => [i.id, i]));
  version() {
    return CATALOG_VERSION;
  }
  all(): Ingredient[] {
    return INGREDIENTS.map((i) => structuredClone(i));
  }
  get(id: string): Ingredient | undefined {
    const i = this.byId.get(id);
    return i ? structuredClone(i) : undefined;
  }
  structure(compoundId: string): StructureFixture | undefined {
    const s = STRUCTURES.find((x) => x.compoundId === compoundId);
    return s ? structuredClone(s) : undefined;
  }
}
