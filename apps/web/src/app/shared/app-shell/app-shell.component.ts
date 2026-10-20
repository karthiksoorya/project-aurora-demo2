import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { map } from 'rxjs';
import { ToastService } from '../../core/errors/toast.service';
import { ProjectContextService } from '../../core/project-context/project-context.service';
import { WorkspaceStateService } from '../../core/workspace-state/workspace-state.service';
import { I } from '../icons';
import { SceneArtComponent } from '../scene-art/scene-art.component';
import { HeaderBarComponent } from './header-bar.component';
import { WORKSPACES } from './nav';

@Component({
  selector: 'aur-app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LucideAngularModule, DatePipe, SceneArtComponent, HeaderBarComponent],
  styleUrl: './app-shell.component.scss',
  template: `
    <div class="shell" [class.ai]="ui.mode() === 'ai'" [attr.data-mode]="ui.mode()">
      <aside class="sidebar" aria-label="Workspaces">
        <a class="brand" [routerLink]="['/projects', ctx.projectId(), 'concept']" aria-label="Aurora home">
          <svg viewBox="0 0 64 64" width="38" height="38" aria-hidden="true">
            <defs>
              <linearGradient id="brandg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#3b82ff" /><stop offset="1" stop-color="#1446d8" />
              </linearGradient>
            </defs>
            <path d="M32 4 56 18v28L32 60 8 46V18z" fill="url(#brandg)" />
            <path d="M32 16 45 24v16l-13 8-13-8V24z" fill="#fff" opacity=".92" />
            <path d="M32 24l6 4v8l-6 4-6-4v-8z" fill="#2f6bff" />
          </svg>
          <span>
            <b>Aurora</b>
            <small>Fragrance Creation Studio</small>
          </span>
        </a>
        <nav class="nav" aria-label="Workspace navigation">
          @for (w of workspaces; track w.key) {
            <a
              class="nav-item"
              [routerLink]="['/projects', ctx.projectId(), w.key]"
              routerLinkActive="on"
              #rla="routerLinkActive"
              [attr.aria-current]="rla.isActive ? 'page' : null"
              [attr.data-testid]="'nav-' + w.key"
            >
              <lucide-icon [img]="w.icon" [size]="20" [style.color]="w.color" />
              <span>{{ w.label }}</span>
            </a>
          }
        </nav>
        @if (ctx.project(); as p) {
          <section class="project-card" aria-label="Current project" data-testid="current-project-card">
            <div class="small muted">Current Project</div>
            <div class="row pc-row">
              <div class="pc-thumb"><aur-scene-art key="waves" /></div>
              <div class="col" style="gap: 4px">
                <b class="pc-name">{{ p.name }}</b>
                <span class="badge draft">Draft</span>
              </div>
            </div>
            @if (p.summary) {
              <p class="small pc-sum">{{ p.summary }}</p>
            }
            <div class="pc-meta">
              <div class="small muted">Last updated</div>
              <div class="small">{{ p.updatedAt | date: 'd MMM y, h:mm a' }}</div>
              <div class="tiny muted">{{ p.versionCount }} saved version{{ p.versionCount === 1 ? '' : 's' }}</div>
            </div>
            <a class="btn view-project" [routerLink]="['/projects', p.id, 'concept']">
              View Project <lucide-icon [img]="I.ArrowRight" [size]="16" />
            </a>
          </section>
        }
      </aside>

      <aur-header-bar class="header" [workspace]="workspace()" />

      <main class="content" id="main">
        @if (ctx.loadError(); as e) {
          <div class="card card-pad load-error" role="alert">
            <b>Could not load the project.</b>
            <span class="muted">{{ e.message }}</span>
            <button class="btn sm" (click)="retry()">Retry</button>
          </div>
        } @else if (ready()) {
          <router-outlet />
        } @else {
          <div class="loading" aria-busy="true">Loading workspace…</div>
        }
      </main>

      <div class="toasts" aria-live="polite">
        @for (t of toast.toasts(); track t.id) {
          <div class="toast" [class]="'toast ' + t.kind" role="status">
            <span>{{ t.text }}</span>
            <button class="icon-btn" aria-label="Dismiss" (click)="toast.dismiss(t.id)"><lucide-icon [img]="I.X" [size]="14" /></button>
          </div>
        }
      </div>
    </div>
  `,
})
export class AppShellComponent {
  readonly ctx = inject(ProjectContextService);
  readonly ui = inject(WorkspaceStateService);
  readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly I = I;
  readonly workspaces = WORKSPACES;
  readonly ready = signal(false);

  private readonly projectIdParam = toSignal(this.route.paramMap.pipe(map((p) => p.get('projectId'))), {
    initialValue: null,
  });
  private readonly url = toSignal(this.router.events.pipe(map(() => this.router.url)), {
    initialValue: this.router.url,
  });
  readonly workspace = computed(() => {
    const seg = this.url().split('?')[0].split('/')[3] ?? 'concept';
    return WORKSPACES.find((w) => w.key === seg) ?? WORKSPACES[0];
  });

  constructor() {
    effect(() => {
      const id = this.projectIdParam();
      if (id) void this.load(id);
    });
  }

  private async load(id: string) {
    this.ready.set(false);
    try {
      if (!this.ctx.catalog().length) await this.ctx.init();
      await this.ctx.open(id);
      this.ready.set(true);
    } catch {
      /* loadError is shown */
    }
  }
  retry() {
    const id = this.projectIdParam();
    if (id) void this.load(id);
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(e: BeforeUnloadEvent) {
    if (this.ctx.briefDirty() || this.ctx.computedStale()) {
      e.preventDefault();
    }
  }
}
