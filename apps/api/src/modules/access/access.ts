import { DomainError, notFound } from '../../common/errors';
import { currentUser } from '../../common/request-context';
import type { Membership, ProjectRole } from '../../domain/types';
import type { AuroraTx } from '../../persistence/repositories';

export const ANY_ROLE: ProjectRole[] = ['owner', 'reviewer', 'viewer'];
export const OWNER: ProjectRole[] = ['owner'];

/**
 * Project-scoped authorisation, enforced in the API for every request (spec §3, §4: "Authorization enforced in
 * NestJS even when UI hides controls"). Throws 404 for an unknown project, 403 when the simulated user is not a
 * member or lacks the role.
 */
export function requireRole(
  tx: AuroraTx,
  projectId: string,
  allowed: ProjectRole[],
  action = 'perform this action',
): Membership {
  if (!tx.projects.get(projectId)) throw notFound('Project', projectId);
  const user = currentUser();
  const m = tx.memberships.get(projectId, user.id);
  if (!m) throw new DomainError(403, 'FORBIDDEN', 'You are not a member of this project', { userId: user.id });
  if (!allowed.includes(m.role))
    throw new DomainError(403, 'FORBIDDEN', `Role "${m.role}" cannot ${action}`, { role: m.role, allowed });
  return m;
}
