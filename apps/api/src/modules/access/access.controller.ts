import { Body, Controller, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { DomainError, badRequest } from '../../common/errors';
import { USERS, currentUser, userById } from '../../common/request-context';
import type { ProjectRole } from '../../domain/types';
import { UnitOfWork } from '../../persistence/repositories';
import { audit } from '../audit/audit';
import { ANY_ROLE, OWNER, requireRole } from './access';

class RoleDto {
  @IsIn(['owner', 'reviewer', 'viewer']) role!: ProjectRole;
}
const uuid = new ParseUUIDPipe({ version: undefined });

@Controller()
export class AccessController {
  constructor(private readonly uow: UnitOfWork) {}

  /** Simulated local users (no authentication — see README "Local demo identity policy"). */
  @Get('users')
  users() {
    return USERS.map(({ id, name, initials, title }) => ({ id, name, initials, title }));
  }

  @Get('me')
  me() {
    const u = currentUser();
    return { id: u.id, name: u.name, initials: u.initials, title: u.title, authentication: 'simulated-local-user' };
  }

  @Get('projects/:projectId/members')
  members(@Param('projectId', uuid) projectId: string) {
    return this.uow.read((tx) => {
      requireRole(tx, projectId, ANY_ROLE, 'view members');
      return tx.memberships.listByProject(projectId).map((m) => {
        const u = userById(m.userId);
        return { ...m, name: u?.name ?? 'Unknown', initials: u?.initials ?? '?', title: u?.title ?? '' };
      });
    });
  }

  @Put('projects/:projectId/members/:userId')
  setRole(@Param('projectId', uuid) projectId: string, @Param('userId', uuid) userId: string, @Body() dto: RoleDto) {
    return this.uow.write((tx) => {
      requireRole(tx, projectId, OWNER, 'change project roles');
      if (!userById(userId)) throw badRequest('Unknown user', { userId });
      const members = tx.memberships.listByProject(projectId);
      const owners = members.filter((m) => m.role === 'owner');
      if (dto.role !== 'owner' && owners.length === 1 && owners[0].userId === userId)
        throw new DomainError(422, 'LAST_OWNER', 'A project must keep at least one owner');
      const prev = members.find((m) => m.userId === userId)?.role ?? null;
      const now = new Date().toISOString();
      tx.memberships.upsert({ projectId, userId, role: dto.role, updatedAt: now });
      audit(
        tx,
        projectId,
        'access.role_changed',
        'membership',
        userId,
        { from: prev, to: dto.role, user: userById(userId)?.name },
        now,
      );
      return { projectId, userId, role: dto.role, updatedAt: now };
    });
  }
}
