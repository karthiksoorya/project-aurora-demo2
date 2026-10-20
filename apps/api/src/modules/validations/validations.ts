import { Body, Controller, Get, Injectable, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { badRequest, notFound } from '../../common/errors';
import { newId } from '../../common/ids';
import { currentUser } from '../../common/request-context';
import type { ValidationRun } from '../../domain/types';
import { MARKETS, PRODUCT_CATEGORIES, RULE_SETS, VALIDATION_ENGINE_VERSION } from '../../fixtures/rule-sets';
import { CatalogRepository, UnitOfWork, type AuroraTx } from '../../persistence/repositories';
import { ANY_ROLE, OWNER, requireRole } from '../access/access';
import { audit } from '../audit/audit';
import { evaluate } from './validation-engine';

export class CreateValidationDto {
  @IsUUID('all') formulaVersionId!: string;
  @IsString() @IsIn(MARKETS) market!: string;
  @IsString() @IsIn(PRODUCT_CATEGORIES) category!: string;
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsIn(RULE_SETS.map((r) => r.id), { each: true })
  ruleSetIds?: string[];
}

@Injectable()
export class ValidationsService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly catalog: CatalogRepository,
  ) {}

  options() {
    return {
      markets: MARKETS,
      categories: PRODUCT_CATEGORIES,
      ruleSets: RULE_SETS,
      engineVersion: VALIDATION_ENGINE_VERSION,
    };
  }

  run(dto: CreateValidationDto) {
    return this.uow.write((tx) => {
      const v = tx.versions.get(dto.formulaVersionId);
      if (!v) throw notFound('Formula version', dto.formulaVersionId);
      requireRole(tx, v.projectId, OWNER, 'run validations');
      const ids = dto.ruleSetIds ?? RULE_SETS.map((r) => r.id);
      const sets = RULE_SETS.filter((r) => ids.includes(r.id));
      if (!sets.length) throw badRequest('No known rule set selected');
      const runId = newId();
      const { findings, status, summary } = evaluate(v, sets, (id) => this.catalog.get(id), runId);
      const now = new Date().toISOString();
      const run: ValidationRun = {
        id: runId,
        projectId: v.projectId,
        formulaVersionId: v.id,
        versionLabel: v.versionLabel,
        snapshotHash: v.snapshotHash,
        market: dto.market,
        productCategory: dto.category,
        ruleSetIds: sets.map((r) => r.id),
        status,
        summary,
        coverage: sets.map((r) => ({
          ruleSetId: r.id,
          title: r.title,
          edition: r.edition,
          status: r.datasetConfigured ? 'evaluated' : 'not_assessed',
          reason: r.datasetConfigured ? undefined : 'No verified dataset configured',
        })),
        findings,
        evaluatedBy: currentUser().id,
        evaluatedAt: now,
        engineVersion: VALIDATION_ENGINE_VERSION,
      };
      tx.validations.insert(run);
      audit(
        tx,
        v.projectId,
        'validation.run',
        'validation_run',
        runId,
        {
          versionLabel: v.versionLabel,
          formulaVersionId: v.id,
          status,
          market: dto.market,
          category: dto.category,
        },
        now,
      );
      return this.annotate(tx, run);
    });
  }

  /** Stale-result behaviour: a run is tied to an immutable version; we flag newer versions / changed draft / catalog. */
  private annotate(tx: AuroraTx, run: ValidationRun) {
    const versions = tx.versions.listByProject(run.projectId);
    const idx = versions.findIndex((x) => x.id === run.formulaVersionId);
    const v = versions[idx];
    const draft = tx.drafts.getByProject(run.projectId);
    const newer = versions.slice(idx + 1).map((x) => x.versionLabel);
    const reasons: string[] = [];
    if (newer.length) reasons.push(`Newer saved version(s): ${newer.join(', ')}`);
    if (
      draft &&
      (draft.basedOnVersionId !== run.formulaVersionId || draft.revision > (v?.snapshot.sourceDraftRevision ?? 0))
    )
      reasons.push('The working draft has changed since this version was saved');
    if (v && v.snapshot.catalogVersion !== this.catalog.version()) reasons.push('Ingredient catalog version changed');
    return { ...run, stale: { isStale: reasons.length > 0, reasons } };
  }

  list(projectId: string) {
    return this.uow.read((tx) => {
      requireRole(tx, projectId, ANY_ROLE, 'view validations');
      return tx.validations.listByProject(projectId).map((r) => {
        const { findings: _f, ...head } = this.annotate(tx, r);
        return head;
      });
    });
  }

  async get(runId: string) {
    const r = await this.uow.read((tx) => {
      const run = tx.validations.get(runId);
      if (!run) return undefined;
      requireRole(tx, run.projectId, ANY_ROLE, 'view validations');
      return this.annotate(tx, run);
    });
    if (!r) throw notFound('Validation run', runId);
    return r;
  }
}

const uuid = new ParseUUIDPipe({ version: undefined });

@Controller()
export class ValidationsController {
  constructor(private readonly svc: ValidationsService) {}
  @Get('validation-options') options() {
    return this.svc.options();
  }
  @Post('validations') run(@Body() dto: CreateValidationDto) {
    return this.svc.run(dto);
  }
  @Get('validations/:runId') get(@Param('runId', uuid) id: string) {
    return this.svc.get(id);
  }
  @Get('projects/:projectId/validations') list(@Param('projectId', uuid) id: string) {
    return this.svc.list(id);
  }
}
