import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { notFound } from '../../common/errors';
import type { Ingredient } from '../../domain/types';
import { CatalogRepository } from '../../persistence/repositories';

const summary = (i: Ingredient) => ({
  id: i.id,
  slug: i.slug,
  name: i.name,
  kind: i.kind,
  systematicName: i.systematicName,
  family: i.family,
  secondaryFamilies: i.secondaryFamilies,
  role: i.role,
  descriptors: i.descriptors,
  art: i.art,
  hasStructure: !!i.compoundId,
});

@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly catalog: CatalogRepository) {}

  /** Paged, filterable catalog. Filters: q, family (csv), kind, role. */
  @Get()
  list(
    @Query('q') q?: string,
    @Query('family') family?: string,
    @Query('kind') kind?: string,
    @Query('role') role?: string,
    @Query('page') pageRaw?: string,
    @Query('pageSize') sizeRaw?: string,
  ) {
    const all = this.catalog.all();
    const needle = (q ?? '').trim().toLowerCase();
    const fams = (family ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const filtered = all.filter(
      (i) =>
        (!needle ||
          i.name.toLowerCase().includes(needle) ||
          i.systematicName.toLowerCase().includes(needle) ||
          i.descriptors.some((d) => d.toLowerCase().includes(needle))) &&
        (!fams.length || fams.includes(i.family)) &&
        (!kind || i.kind === kind) &&
        (!role || i.role === role),
    );
    const pageSize = Math.min(Math.max(Number(sizeRaw) || 100, 1), 200);
    const page = Math.max(Number(pageRaw) || 1, 1);
    const facets: Record<string, number> = {};
    for (const i of all) facets[i.family] = (facets[i.family] ?? 0) + 1;
    return {
      catalogVersion: this.catalog.version(),
      page,
      pageSize,
      total: filtered.length,
      items: filtered.slice((page - 1) * pageSize, page * pageSize).map(summary),
      facets: { family: facets },
    };
  }

  @Get(':ingredientId')
  get(@Param('ingredientId', new ParseUUIDPipe({ version: undefined })) id: string) {
    const i = this.catalog.get(id);
    if (!i) throw notFound('Ingredient', id);
    const structure = i.compoundId ? this.catalog.structure(i.compoundId) : undefined;
    const constituents = (i.constituents ?? []).map((c) => {
      const st = c.compoundId ? this.catalog.structure(c.compoundId) : undefined;
      const linked = c.compoundId ? all(this.catalog).find((x) => x.compoundId === c.compoundId) : undefined;
      return { ...c, hasStructure: !!st, ingredientId: linked?.id ?? null };
    });
    return {
      ...i,
      constituents,
      structure: structure ?? null,
      structurePolicy:
        i.kind === 'natural_mixture'
          ? 'Natural mixture: no single molecular structure is shown. Inspect individual constituents.'
          : structure
            ? 'Single compound: computed conformer from curated SMILES; see provenance.'
            : 'Single compound: no curated structure fixture available — structure not shown.',
    };
  }
}

const all = (c: CatalogRepository) => c.all();
