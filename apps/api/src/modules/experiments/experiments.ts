import { Body, Controller, Get, HttpCode, Injectable, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { DomainError, notFound } from '../../common/errors';
import { newId } from '../../common/ids';
import { currentUser } from '../../common/request-context';
import type { Experiment, Observation } from '../../domain/types';
import { UnitOfWork } from '../../persistence/repositories';
import { ANY_ROLE, OWNER, requireRole } from '../access/access';
import { audit } from '../audit/audit';

class ProtocolDto {
  @IsString() @MaxLength(300) objective!: string;
  @IsString() @MaxLength(500) method!: string;
  @IsString() @MaxLength(300) conditions!: string;
}
export class CreateExperimentDto {
  @IsUUID('all') formulaVersionId!: string;
  @IsString() @MinLength(1) @MaxLength(80) title!: string;
  @ValidateNested() @Type(() => ProtocolDto) protocol!: ProtocolDto;
}
class MeasurementDto {
  @IsString() @MinLength(1) @MaxLength(60) quantity!: string;
  @IsString() @MinLength(1) @MaxLength(30) value!: string;
  @IsString() @MaxLength(20) unit!: string;
  @IsString() @MinLength(1) @MaxLength(120) method!: string;
}
export class ObservationDto {
  @IsIn(['observation', 'measurement', 'hypothesis']) kind!: 'observation' | 'measurement' | 'hypothesis';
  @IsString() @MinLength(1) @MaxLength(1000) text!: string;
  @IsOptional() @ValidateNested() @Type(() => MeasurementDto) measurement?: MeasurementDto;
}
export class StatusDto {
  @IsIn(['planned', 'in_progress', 'completed']) status!: Experiment['status'];
}

/**
 * Experiments attach to exactly one saved formula version. Observations are typed so subjective notes,
 * measurements (with method and unit) and hypotheses are never confused. Nothing is predicted.
 */
@Injectable()
export class ExperimentsService {
  constructor(private readonly uow: UnitOfWork) {}

  create(dto: CreateExperimentDto) {
    return this.uow.write((tx) => {
      const v = tx.versions.get(dto.formulaVersionId);
      if (!v) throw notFound('Formula version', dto.formulaVersionId);
      requireRole(tx, v.projectId, OWNER, 'create experiments');
      const now = new Date().toISOString();
      const e: Experiment = {
        id: newId(),
        projectId: v.projectId,
        formulaVersionId: v.id,
        versionLabel: v.versionLabel,
        title: dto.title.trim(),
        protocol: dto.protocol,
        status: 'planned',
        observations: [],
        createdBy: currentUser().id,
        createdAt: now,
      };
      tx.experiments.insert(e);
      audit(
        tx,
        v.projectId,
        'experiment.created',
        'experiment',
        e.id,
        { title: e.title, versionLabel: v.versionLabel, formulaVersionId: v.id },
        now,
      );
      return e;
    });
  }

  addObservation(id: string, dto: ObservationDto) {
    return this.uow.write((tx) => {
      const e = tx.experiments.get(id);
      if (!e) throw notFound('Experiment', id);
      requireRole(tx, e.projectId, ['owner', 'reviewer'], 'record observations');
      if (dto.kind === 'measurement' && !dto.measurement)
        throw new DomainError(400, 'VALIDATION_FAILED', 'A measurement needs quantity, value, unit and method');
      if (dto.kind !== 'measurement' && dto.measurement)
        throw new DomainError(400, 'VALIDATION_FAILED', 'Only measurement observations carry measured values');
      const now = new Date().toISOString();
      const o: Observation = {
        id: newId(),
        kind: dto.kind,
        text: dto.text.trim(),
        measurement: dto.measurement,
        recordedBy: currentUser().id,
        recordedByName: currentUser().name,
        recordedAt: now,
      };
      const next = {
        ...e,
        observations: [...e.observations, o],
        status: e.status === 'planned' ? ('in_progress' as const) : e.status,
      };
      tx.experiments.update(next);
      audit(
        tx,
        e.projectId,
        'experiment.observation_added',
        'experiment',
        e.id,
        { kind: o.kind, versionLabel: e.versionLabel },
        now,
      );
      return next;
    });
  }

  setStatus(id: string, dto: StatusDto) {
    return this.uow.write((tx) => {
      const e = tx.experiments.get(id);
      if (!e) throw notFound('Experiment', id);
      requireRole(tx, e.projectId, OWNER, 'change experiment status');
      const next = { ...e, status: dto.status };
      tx.experiments.update(next);
      audit(tx, e.projectId, 'experiment.status_changed', 'experiment', e.id, { from: e.status, to: dto.status });
      return next;
    });
  }

  list(projectId: string) {
    return this.uow.read((tx) => {
      requireRole(tx, projectId, ANY_ROLE, 'view experiments');
      return tx.experiments.listByProject(projectId);
    });
  }

  async get(id: string) {
    const e = await this.uow.read((tx) => {
      const x = tx.experiments.get(id);
      if (x) requireRole(tx, x.projectId, ANY_ROLE, 'view experiments');
      return x;
    });
    if (!e) throw notFound('Experiment', id);
    return e;
  }

  /** Version ancestry graph with linked records — feeds the branching canvas (EE-X) and review screens. */
  lineage(projectId: string) {
    return this.uow.read((tx) => {
      requireRole(tx, projectId, ANY_ROLE, 'view lineage');
      const exps = tx.experiments.listByProject(projectId);
      const vals = tx.validations.listByProject(projectId);
      const revs = tx.reviews.listByProject(projectId);
      const draft = tx.drafts.getByProject(projectId);
      return {
        draftBasedOnVersionId: draft?.basedOnVersionId ?? null,
        nodes: tx.versions.listByProject(projectId).map((v) => ({
          id: v.id,
          versionLabel: v.versionLabel,
          parentVersionId: v.snapshot.parentVersionId,
          savedAt: v.savedAt,
          totalPct: v.snapshot.totalPct,
          completeness: v.snapshot.completeness,
          note: v.snapshot.note,
          experiments: exps.filter((e) => e.formulaVersionId === v.id).length,
          observations: exps.filter((e) => e.formulaVersionId === v.id).reduce((n, e) => n + e.observations.length, 0),
          latestValidation: vals.find((r) => r.formulaVersionId === v.id)?.status ?? null,
          latestReview: revs.find((r) => r.formulaVersionId === v.id)?.status ?? null,
        })),
      };
    });
  }
}

const uuid = new ParseUUIDPipe({ version: undefined });

@Controller()
export class ExperimentsController {
  constructor(private readonly svc: ExperimentsService) {}
  @Post('experiments') create(@Body() dto: CreateExperimentDto) {
    return this.svc.create(dto);
  }
  @Post('experiments/:id/observations') observe(@Param('id', uuid) id: string, @Body() dto: ObservationDto) {
    return this.svc.addObservation(id, dto);
  }
  @Post('experiments/:id/status') @HttpCode(200) status(@Param('id', uuid) id: string, @Body() dto: StatusDto) {
    return this.svc.setStatus(id, dto);
  }
  @Get('experiments/:id') get(@Param('id', uuid) id: string) {
    return this.svc.get(id);
  }
  @Get('projects/:projectId/experiments') list(@Param('projectId', uuid) id: string) {
    return this.svc.list(id);
  }
  @Get('projects/:projectId/lineage') lineage(@Param('projectId', uuid) id: string) {
    return this.svc.lineage(id);
  }
}
