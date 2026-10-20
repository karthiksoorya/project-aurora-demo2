import { Body, Controller, Get, HttpCode, Injectable, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DomainError, badRequest, notFound } from '../../common/errors';
import { newId } from '../../common/ids';
import { currentUser, userById } from '../../common/request-context';
import type { ReviewRequest } from '../../domain/types';
import { UnitOfWork, type AuroraTx } from '../../persistence/repositories';
import { ANY_ROLE, OWNER, requireRole } from '../access/access';
import { audit } from '../audit/audit';

class ReviewerDto {
  @IsUUID('all') userId!: string;
  @IsIn(['comment', 'approve']) permission!: 'comment' | 'approve';
}
export class CreateReviewDto {
  @IsUUID('all') formulaVersionId!: string;
  @IsString() @MinLength(1) @MaxLength(80) title!: string;
  @IsOptional() @IsString() @MaxLength(1000) message?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ReviewerDto)
  reviewers!: ReviewerDto[];
}
export class CommentDto {
  @IsString() @MinLength(1) @MaxLength(2000) comment!: string;
  @IsOptional() @IsIn(['feedback', 'information', 'suggestion']) kind?: 'feedback' | 'information' | 'suggestion';
}
export class DecisionDto {
  @IsIn(['approved', 'changes_requested', 'rejected']) decision!: 'approved' | 'changes_requested' | 'rejected';
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}

const forbid = (message: string, details?: unknown) => new DomainError(403, 'FORBIDDEN', message, details);
const OPEN = ['submitted', 'changes_requested'];

/**
 * Version-specific review requests. Rules (enforced here, regardless of UI):
 *  - only owners create / withdraw requests, for a saved version of their project;
 *  - commenting: owners and listed reviewers whose project role is reviewer; viewers never comment;
 *  - deciding: only listed reviewers with "approve" permission; requesters cannot approve their own request;
 *  - approved when every approver's latest decision is "approved"; any "changes requested"/"rejected" applies at once.
 */
@Injectable()
export class ReviewsService {
  constructor(private readonly uow: UnitOfWork) {}

  create(dto: CreateReviewDto) {
    return this.uow.write(async (tx) => {
      const v = await tx.versions.get(dto.formulaVersionId);
      if (!v) throw notFound('Formula version', dto.formulaVersionId);
      await requireRole(tx, v.projectId, OWNER, 'request reviews');
      const me = currentUser();
      const ids = new Set<string>();
      for (const r of dto.reviewers) {
        if (ids.has(r.userId)) throw badRequest('Reviewer listed twice', { userId: r.userId });
        ids.add(r.userId);
        if (r.userId === me.id) throw badRequest('You cannot review your own request');
        const m = await tx.memberships.get(v.projectId, r.userId);
        if (!m) throw badRequest('Reviewer is not a project member', { userId: r.userId });
        if (m.role !== 'reviewer')
          throw new DomainError(
            422,
            'ROLE_CANNOT_REVIEW',
            `${userById(r.userId)?.name} has project role "${m.role}" and cannot review`,
            { userId: r.userId },
          );
      }
      const now = new Date().toISOString();
      const review: ReviewRequest = {
        id: newId(),
        projectId: v.projectId,
        formulaVersionId: v.id,
        versionLabel: v.versionLabel,
        snapshotHash: v.snapshotHash,
        title: dto.title.trim(),
        message: dto.message?.trim() ?? '',
        status: 'submitted',
        reviewers: dto.reviewers,
        comments: [],
        decisions: [],
        requestedBy: me.id,
        createdAt: now,
        updatedAt: now,
      };
      await tx.reviews.insert(review);
      await audit(
        tx,
        v.projectId,
        'review.requested',
        'review',
        review.id,
        {
          versionLabel: v.versionLabel,
          formulaVersionId: v.id,
          reviewers: dto.reviewers.map((r) => `${userById(r.userId)?.name} (${r.permission})`),
        },
        now,
      );
      return review;
    });
  }

  private async load(tx: AuroraTx, id: string) {
    const r = await tx.reviews.get(id);
    if (!r) throw notFound('Review', id);
    return r;
  }

  comment(id: string, dto: CommentDto) {
    return this.uow.write(async (tx) => {
      const r = await this.load(tx, id);
      const m = await requireRole(tx, r.projectId, ['owner', 'reviewer'], 'comment on reviews');
      const me = currentUser();
      if (m.role === 'reviewer' && !r.reviewers.some((x) => x.userId === me.id))
        throw forbid('Only reviewers invited to this request can comment');
      if (r.status === 'withdrawn') throw new DomainError(422, 'REVIEW_CLOSED', 'This review was withdrawn');
      const now = new Date().toISOString();
      const c = {
        id: newId(),
        authorId: me.id,
        authorName: me.name,
        comment: dto.comment.trim(),
        kind: dto.kind ?? 'feedback',
        createdAt: now,
      };
      const next = { ...r, comments: [...r.comments, c], updatedAt: now };
      await tx.reviews.update(next);
      await audit(
        tx,
        r.projectId,
        'review.commented',
        'review',
        r.id,
        { versionLabel: r.versionLabel, kind: c.kind },
        now,
      );
      return next;
    });
  }

  decide(id: string, dto: DecisionDto) {
    return this.uow.write(async (tx) => {
      const r = await this.load(tx, id);
      await requireRole(tx, r.projectId, ['reviewer'], 'approve or reject');
      const me = currentUser();
      const slot = r.reviewers.find((x) => x.userId === me.id);
      if (!slot || slot.permission !== 'approve') throw forbid('You do not have approval permission on this review');
      if (!OPEN.includes(r.status)) throw new DomainError(422, 'REVIEW_CLOSED', `Review is already ${r.status}`);
      if (dto.decision !== 'approved' && !dto.reason?.trim())
        throw badRequest('A reason is required when requesting changes or rejecting');
      const now = new Date().toISOString();
      const decisions = [
        ...r.decisions,
        {
          id: newId(),
          userId: me.id,
          userName: me.name,
          decision: dto.decision,
          reason: dto.reason?.trim() ?? '',
          decidedAt: now,
        },
      ];
      const approvers = r.reviewers.filter((x) => x.permission === 'approve').map((x) => x.userId);
      const latest = (uid: string) => [...decisions].reverse().find((d) => d.userId === uid)?.decision;
      const status: ReviewRequest['status'] =
        dto.decision === 'rejected'
          ? 'rejected'
          : dto.decision === 'changes_requested'
            ? 'changes_requested'
            : approvers.every((u) => latest(u) === 'approved')
              ? 'approved'
              : 'submitted';
      const next = { ...r, decisions, status, updatedAt: now };
      await tx.reviews.update(next);
      await audit(
        tx,
        r.projectId,
        'review.decision',
        'review',
        r.id,
        { versionLabel: r.versionLabel, decision: dto.decision, status },
        now,
      );
      return next;
    });
  }

  withdraw(id: string) {
    return this.uow.write(async (tx) => {
      const r = await this.load(tx, id);
      await requireRole(tx, r.projectId, OWNER, 'withdraw reviews');
      if (!OPEN.includes(r.status)) throw new DomainError(422, 'REVIEW_CLOSED', `Review is already ${r.status}`);
      const next = { ...r, status: 'withdrawn' as const, updatedAt: new Date().toISOString() };
      await tx.reviews.update(next);
      await audit(tx, r.projectId, 'review.withdrawn', 'review', r.id, { versionLabel: r.versionLabel });
      return next;
    });
  }

  list(projectId: string) {
    return this.uow.read(async (tx) => {
      await requireRole(tx, projectId, ANY_ROLE, 'view reviews');
      return await tx.reviews.listByProject(projectId);
    });
  }

  async get(id: string) {
    const r = await this.uow.read(async (tx) => {
      const x = await tx.reviews.get(id);
      if (x) await requireRole(tx, x.projectId, ANY_ROLE, 'view reviews');
      return x;
    });
    if (!r) throw notFound('Review', id);
    return r;
  }
}

const uuid = new ParseUUIDPipe({ version: undefined });

@Controller()
export class ReviewsController {
  constructor(private readonly svc: ReviewsService) {}
  @Post('reviews') create(@Body() dto: CreateReviewDto) {
    return this.svc.create(dto);
  }
  @Post('reviews/:id/comments') comment(@Param('id', uuid) id: string, @Body() dto: CommentDto) {
    return this.svc.comment(id, dto);
  }
  @Post('reviews/:id/decisions') decide(@Param('id', uuid) id: string, @Body() dto: DecisionDto) {
    return this.svc.decide(id, dto);
  }
  @Post('reviews/:id/withdraw') @HttpCode(200) withdraw(@Param('id', uuid) id: string) {
    return this.svc.withdraw(id);
  }
  @Get('reviews/:id') get(@Param('id', uuid) id: string) {
    return this.svc.get(id);
  }
  @Get('projects/:projectId/reviews') list(@Param('projectId', uuid) id: string) {
    return this.svc.list(id);
  }
}
