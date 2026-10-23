import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom, tap } from 'rxjs';

/**
 * Hosted-demo access gate. When the server sets AURORA_ACCESS_PASSWORD the app shows a password screen first.
 * Local builds (no password) and the static demo (no gate route) report "not required" and open directly.
 */
@Injectable({ providedIn: 'root' })
export class AccessGateService {
  private readonly http = inject(HttpClient);
  readonly state = signal<'checking' | 'open' | 'locked'>('checking');

  async check() {
    try {
      const s = await firstValueFrom(this.http.get<{ required: boolean; granted: boolean }>('/api/v1/access/status'));
      this.state.set(s.required && !s.granted ? 'locked' : 'open');
    } catch {
      this.state.set('open'); // older API or static demo: no gate
    }
  }

  async login(password: string) {
    await firstValueFrom(this.http.post('/api/v1/access/login', { password }));
    location.reload(); // start the app cleanly with access
  }

  lock() {
    this.state.set('locked');
  }
}

/** Any API call answered with ACCESS_REQUIRED (e.g. cookie expired, password rotated) shows the gate again. */
export const accessRequiredInterceptor: HttpInterceptorFn = (req, next) => {
  const gate = inject(AccessGateService);
  return next(req).pipe(
    tap({
      error: (e: unknown) => {
        if (
          e instanceof HttpErrorResponse &&
          e.status === 401 &&
          (e.error as { code?: string })?.code === 'ACCESS_REQUIRED'
        )
          gate.lock();
      },
    }),
  );
};
