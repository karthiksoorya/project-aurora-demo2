import { newId } from '../../common/ids';
import { currentUser } from '../../common/request-context';
import type { AuditEvent } from '../../domain/types';
import type { AuroraTx } from '../../persistence/repositories';

/** Append an immutable audit event inside the caller's unit of work. */
export async function audit(
  tx: AuroraTx,
  projectId: string,
  action: string,
  targetType: string,
  targetId: string,
  payload: Record<string, unknown> = {},
  at = new Date().toISOString(),
): Promise<AuditEvent> {
  const e: AuditEvent = {
    id: newId(),
    projectId,
    actorId: currentUser().id,
    actorName: currentUser().name,
    action,
    targetType,
    targetId,
    payload,
    occurredAt: at,
  };
  await tx.audit.append(e);
  return e;
}
