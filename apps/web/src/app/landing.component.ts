import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ProjectContextService } from './core/project-context/project-context.service';

/** Optional landing redirect: opens the most recently updated project's Concept Studio. */
@Component({
  selector: 'aur-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: grid;
      place-items: center;
      height: 100vh;
      color: var(--muted);
    }
  `,
  template: `@if (error()) {
      <div class="card card-pad" role="alert">
        <b>Local API not reachable.</b>
        <p class="small muted">{{ error() }}</p>
      </div>
    } @else {
      <span>Opening Aurora…</span>
    }`,
})
export class LandingComponent implements OnInit {
  private readonly ctx = inject(ProjectContextService);
  private readonly router = inject(Router);
  readonly error = signal('');

  async ngOnInit() {
    try {
      const projects = await this.ctx.init();
      const latest = [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      if (latest) await this.router.navigate(['/projects', latest.id, 'concept'], { replaceUrl: true });
      else this.error.set('No projects found.');
    } catch (e) {
      this.error.set((e as { message?: string }).message ?? String(e));
    }
  }
}
