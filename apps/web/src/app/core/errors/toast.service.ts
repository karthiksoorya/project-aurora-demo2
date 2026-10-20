import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  kind: 'ok' | 'err' | 'info' | 'warn';
  text: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private seq = 0;

  show(kind: Toast['kind'], text: string, ms = 4200) {
    const id = ++this.seq;
    this.toasts.update((t) => [...t.slice(-3), { id, kind, text }]);
    setTimeout(() => this.dismiss(id), ms);
  }
  ok(t: string) {
    this.show('ok', t);
  }
  err(t: string) {
    this.show('err', t, 6500);
  }
  info(t: string) {
    this.show('info', t);
  }
  warn(t: string) {
    this.show('warn', t, 5500);
  }
  dismiss(id: number) {
    this.toasts.update((t) => t.filter((x) => x.id !== id));
  }
}
