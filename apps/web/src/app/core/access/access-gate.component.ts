import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { LucideAngularModule } from 'lucide-angular';
import { I } from '../../shared/icons';
import { AccessGateService } from './access-gate.service';

@Component({
  selector: 'aur-access-gate',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule],
  styles: `
    :host {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      background:
        radial-gradient(60% 70% at 30% 20%, #e8f1ff, transparent 70%),
        radial-gradient(50% 60% at 80% 80%, #fdeaf5, transparent 70%), #f7f9fd;
    }
    .card {
      width: min(420px, 100%);
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 18px;
      box-shadow: 0 18px 50px rgba(32, 52, 110, 0.12);
      padding: 28px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .brand {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .logo {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      color: #fff;
      background: linear-gradient(135deg, #2f7bff, #6a5cff);
    }
    h1 {
      font-size: 20px;
      margin: 0;
    }
    .err {
      color: #c4314b;
      font-size: 13px;
    }
    .note {
      font-size: 12px;
      color: var(--muted);
    }
  `,
  template: `
    <form class="card" (ngSubmit)="submit()" data-testid="access-gate">
      <div class="brand">
        <div class="logo"><lucide-icon [img]="I.Hexagon" [size]="24" /></div>
        <div>
          <h1>Aurora</h1>
          <span class="small muted">Fragrance Creation Studio · demo</span>
        </div>
      </div>
      <label class="col" style="gap: 6px">
        <span class="small">Access password</span>
        <input
          class="input"
          type="password"
          name="password"
          id="access-password"
          autocomplete="current-password"
          [(ngModel)]="password"
          data-testid="access-password"
          required
        />
      </label>
      @if (error()) {
        <span class="err" role="alert" data-testid="access-error">{{ error() }}</span>
      }
      <button class="btn primary" type="submit" [disabled]="busy() || !password" data-testid="access-submit">
        <lucide-icon [img]="I.LockOpen" [size]="16" /> Open Aurora
      </button>
      <span class="note">Ask the project owner for the password. All data in this demo is synthetic.</span>
    </form>
  `,
})
export class AccessGateComponent {
  private readonly gate = inject(AccessGateService);
  readonly I = I;
  password = '';
  readonly error = signal('');
  readonly busy = signal(false);

  async submit() {
    this.busy.set(true);
    this.error.set('');
    try {
      await this.gate.login(this.password);
    } catch (e) {
      const code = e instanceof HttpErrorResponse ? (e.error as { code?: string; message?: string }) : undefined;
      this.error.set(code?.message ?? 'Could not sign in — try again');
      this.busy.set(false);
    }
  }
}
