import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * LOCAL DEMO IDENTITY POLICY (M1–M2)
 * There is no authentication. The browser selects one of four *simulated* local users with the
 * `x-aurora-user` header (default: the owner). Project roles are stored per project and enforced by the API
 * on every write. This is NOT production authentication (spec §10.6); it demonstrates authorisation rules only.
 */
export interface DemoUser {
  id: string;
  name: string;
  initials: string;
  title: string;
  defaultRole: ProjectRole;
}
export type ProjectRole = 'owner' | 'reviewer' | 'viewer';

export const USERS: DemoUser[] = [
  {
    id: '6f1c2a5e-0000-4000-8000-000000000001',
    name: 'Senior Perfumer',
    initials: 'SP',
    title: 'Perfumer',
    defaultRole: 'owner',
  },
  {
    id: '6f1c2a5e-0000-4000-8000-000000000002',
    name: 'Product Development',
    initials: 'PD',
    title: 'Product development lead',
    defaultRole: 'reviewer',
  },
  {
    id: '6f1c2a5e-0000-4000-8000-000000000003',
    name: 'Regulatory Affairs',
    initials: 'RA',
    title: 'Regulatory specialist',
    defaultRole: 'reviewer',
  },
  {
    id: '6f1c2a5e-0000-4000-8000-000000000004',
    name: 'Marketing',
    initials: 'MK',
    title: 'Marketing manager',
    defaultRole: 'viewer',
  },
];
export const DEMO_USER = USERS[0];
export const userById = (id: string) => USERS.find((u) => u.id === id);

const als = new AsyncLocalStorage<{ user: DemoUser }>();
/** The simulated user of the current request (owner outside a request, e.g. seeding). */
export const currentUser = (): DemoUser => als.getStore()?.user ?? DEMO_USER;

const RID_RE = /^[A-Za-z0-9._-]{1,64}$/;

export function requestContext(req: Request & { requestId?: string }, res: Response, next: NextFunction) {
  const incoming = req.header('x-request-id');
  req.requestId = incoming && RID_RE.test(incoming) ? incoming : randomUUID();
  res.setHeader('x-request-id', req.requestId);
  const uid = req.header('x-aurora-user');
  const user = uid ? userById(uid) : DEMO_USER;
  if (!user) {
    res
      .status(401)
      .json({ code: 'UNKNOWN_USER', message: 'Unknown simulated user', details: { uid }, requestId: req.requestId });
    return;
  }
  als.run({ user }, () => next());
}
