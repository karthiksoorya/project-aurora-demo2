import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * LOCAL DEMO IDENTITY POLICY (M1)
 * There is no authentication in M1. Every request is attributed to a single simulated local user.
 * This is NOT production authentication; real identity + memberships are an open decision (spec §10.6).
 */
export const DEMO_USER = {
  id: '6f1c2a5e-0000-4000-8000-000000000001',
  name: 'Senior Perfumer',
  initials: 'SP',
  role: 'owner' as const,
  note: 'Simulated local demo user — no authentication configured',
};

const RID_RE = /^[A-Za-z0-9._-]{1,64}$/;

export function requestContext(req: Request & { requestId?: string }, res: Response, next: NextFunction) {
  const incoming = req.header('x-request-id');
  req.requestId = incoming && RID_RE.test(incoming) ? incoming : randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
}
