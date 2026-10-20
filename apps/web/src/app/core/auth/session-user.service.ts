import { HttpInterceptorFn } from '@angular/common/http';
import { Injectable, effect, inject, signal } from '@angular/core';
import type { DemoUser } from '../models';

const KEY = 'aurora.user.v1';
export const OWNER_ID = '6f1c2a5e-0000-4000-8000-000000000001';

/**
 * Simulated local user (no authentication in this POC). The selected id is sent as `x-aurora-user`;
 * the API resolves it and enforces project roles. Switching user never changes data.
 */
@Injectable({ providedIn: 'root' })
export class SessionUserService {
  readonly userId = signal<string>(read());
  readonly users = signal<DemoUser[]>([]);
  readonly current = () => this.users().find((u) => u.id === this.userId());

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(KEY, this.userId());
      } catch {
        /* ignore */
      }
    });
  }
}

function read() {
  try {
    return localStorage.getItem(KEY) ?? OWNER_ID;
  } catch {
    return OWNER_ID;
  }
}

export const userHeaderInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/')) return next(req);
  const id = inject(SessionUserService).userId();
  return next(req.clone({ setHeaders: { 'x-aurora-user': id } }));
};
