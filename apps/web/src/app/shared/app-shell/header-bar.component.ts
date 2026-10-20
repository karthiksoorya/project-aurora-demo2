import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ApiService } from '../../core/api/api.service';
import { ProjectContextService } from '../../core/project-context/project-context.service';
import { WorkspaceStateService } from '../../core/workspace-state/workspace-state.service';
import { fam } from '../families';
import { I } from '../icons';
import { IngredientArtComponent } from '../ingredient-card/ingredient-art.component';
import type { WorkspaceNav } from './nav';

type Menu = 'project' | 'bell' | 'help' | 'search' | 'user' | null;

@Component({
  selector: 'aur-header-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, FormsModule, DatePipe, IngredientArtComponent],
  styleUrl: './header-bar.component.scss',
  template: `
    <header class="bar" role="banner">
      <div class="search" style="flex: 1; max-width: 520px">
        <span class="search-icon"><lucide-icon [img]="I.Search" [size]="18" /></span>
        <input
          class="input gsearch"
          type="search"
          placeholder="Search ingredients, concepts, formulas, versions…"
          aria-label="Global search"
          [ngModel]="q()"
          (ngModelChange)="q.set($event); open.set($event ? 'search' : null)"
          (focus)="q() && open.set('search')"
          data-testid="global-search"
        />
        @if (open() === 'search' && q()) {
          <div class="menu results" role="listbox">
            @for (r of results(); track r.key) {
              <button class="menu-item" role="option" aria-selected="false" (click)="go(r)">
                @if (r.art) {
                  <aur-ingredient-art [motif]="r.art.motif" [hue]="r.art.hue" [size]="28" />
                } @else {
                  <span class="r-ic"><lucide-icon [img]="r.icon" [size]="16" /></span>
                }
                <span class="col" style="gap: 0">
                  <b class="small">{{ r.title }}</b>
                  <span class="tiny muted">{{ r.sub }}</span>
                </span>
              </button>
            } @empty {
              <div class="small muted" style="padding: 10px">No matches in this project or the demo catalog.</div>
            }
          </div>
        }
      </div>

      <div class="spacer"></div>

      <div class="pos">
        <button
          class="proj"
          (click)="toggle('project')"
          [attr.aria-expanded]="open() === 'project'"
          aria-haspopup="menu"
          data-testid="project-selector"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 2.5 20.5 7.3v9.4L12 21.5 3.5 16.7V7.3z"
              fill="none"
              stroke="#f2861f"
              stroke-width="2.2"
              stroke-linejoin="round"
            />
          </svg>
          <span class="col" style="gap: 0; text-align: left">
            <b>{{ ctx.project()?.name ?? '…' }}</b>
            <span class="tiny muted">Draft</span>
          </span>
          <lucide-icon [img]="I.ChevronDown" [size]="18" />
        </button>
        @if (open() === 'project') {
          <div class="menu proj-menu" role="menu">
            <div class="tiny muted" style="padding: 4px 10px">Projects (synthetic demo data)</div>
            @for (p of ctx.projects(); track p.id) {
              <button class="menu-item" role="menuitem" (click)="switchProject(p.id)">
                <lucide-icon [img]="p.id === ctx.projectId() ? I.Check : I.Box" [size]="16" />
                <span class="grow">{{ p.name }}</span>
                <span class="tiny muted">{{ p.versionCount }} v</span>
              </button>
            }
            <form class="new-proj" (submit)="$event.preventDefault(); createProject()">
              <input
                class="input"
                style="height: 32px"
                placeholder="New project name"
                [(ngModel)]="newName"
                name="newName"
                aria-label="New project name"
                maxlength="80"
              />
              <button class="btn sm primary" type="submit" [disabled]="!newName.trim()">Create</button>
            </form>
          </div>
        }
      </div>

      <div class="mode" role="group" aria-label="Working mode" data-testid="mode-switch">
        <button
          [class.on]="ui.mode() === 'manual'"
          [attr.aria-pressed]="ui.mode() === 'manual'"
          (click)="ui.setMode('manual')"
          data-testid="mode-manual"
        >
          Manual
        </button>
        <button
          [class.on]="ui.mode() === 'ai'"
          [attr.aria-pressed]="ui.mode() === 'ai'"
          (click)="ui.setMode('ai')"
          data-testid="mode-ai"
        >
          AI Assist
        </button>
      </div>

      <div class="pos">
        <button
          class="icon-btn"
          aria-label="Activity"
          (click)="toggle('bell'); ctx.refreshAudit()"
          data-testid="activity-button"
        >
          <lucide-icon [img]="I.Bell" [size]="20" />
        </button>
        @if (open() === 'bell') {
          <div class="menu bell-menu" role="dialog" aria-label="Recent activity">
            <div class="row" style="padding: 4px 8px 8px">
              <b class="grow">Audit trail</b><span class="tiny muted">immutable, local</span>
            </div>
            @for (e of ctx.audit(); track e.id) {
              <div class="ev">
                <span class="dot" [style.background]="e.action.startsWith('version') ? '#1f66ff' : '#a7b1c9'"></span>
                <span class="col" style="gap: 1px">
                  <span class="small">{{ describe(e.action, e.payload) }}</span>
                  <span class="tiny muted">{{ e.actorName }} · {{ e.occurredAt | date: 'd MMM, HH:mm:ss' }}</span>
                </span>
              </div>
            } @empty {
              <div class="small muted" style="padding: 8px">No events yet.</div>
            }
          </div>
        }
      </div>

      <div class="pos">
        <button class="icon-btn" aria-label="About this build" (click)="toggle('help')">
          <lucide-icon [img]="I.CircleHelp" [size]="20" />
        </button>
        @if (open() === 'help') {
          <div class="menu help-menu" role="dialog" aria-label="About this build">
            <b>Aurora — local proof of concept (M3)</b>
            <ul class="small">
              <li data-testid="help-storage">
                All data is synthetic and stays on this computer (local NestJS API +
                {{
                  storage() === 'postgresql'
                    ? 'PostgreSQL database'
                    : storage() === 'json-file'
                      ? 'local JSON file'
                      : 'local storage'
                }}).
              </li>
              <li>
                Manual mode makes zero AI calls. AI Assist is shown as <i>unavailable</i> until an endpoint is approved
                (M4).
              </li>
              <li>Totals, accords and versions are computed deterministically by the API.</li>
              <li>
                Regulatory, allergen, sustainability and performance data are <b>Not assessed</b> — no verified source
                is configured.
              </li>
              <li>3D layouts are exploratory visualisations, not measured similarity or sensory prediction.</li>
            </ul>
          </div>
        }
      </div>

      <div class="pos">
        <button
          class="user"
          (click)="toggle('user')"
          aria-haspopup="menu"
          [attr.aria-expanded]="open() === 'user'"
          data-testid="user-switcher"
          title="Simulated local user — no authentication in this POC"
        >
          <span class="avatar" [class]="'avatar r-' + ctx.myRole()">{{ me()?.initials ?? 'SP' }}</span>
          <span class="col" style="gap: 0; text-align: left">
            <b class="small">{{ me()?.name ?? 'Senior Perfumer' }}</b>
            <span class="tiny muted" data-testid="my-role">{{ roleLabel(ctx.myRole()) }} · simulated</span>
          </span>
          <lucide-icon [img]="I.ChevronDown" [size]="16" />
        </button>
        @if (open() === 'user') {
          <div class="menu user-menu" role="menu">
            <div class="tiny muted" style="padding: 4px 10px 6px">Act as (simulated local users, no login)</div>
            @for (u of ctx.session.users(); track u.id) {
              <button
                class="menu-item"
                role="menuitem"
                (click)="switchUser(u.id)"
                [attr.data-testid]="'act-as-' + u.initials"
              >
                <span class="avatar sm">{{ u.initials }}</span>
                <span class="col grow" style="gap: 0">
                  <b class="small">{{ u.name }}</b>
                  <span class="tiny muted">{{ u.title }}</span>
                </span>
                @if (u.id === ctx.session.userId()) {
                  <lucide-icon [img]="I.Check" [size]="15" style="color: var(--primary)" />
                }
              </button>
            }
            <p class="tiny muted" style="padding: 6px 10px 2px; max-width: 260px">
              Permissions come from each user's project role and are enforced by the API.
            </p>
          </div>
        }
      </div>
    </header>
  `,
})
export class HeaderBarComponent {
  readonly workspace = input.required<WorkspaceNav>();
  readonly ctx = inject(ProjectContextService);
  readonly ui = inject(WorkspaceStateService);
  private readonly router = inject(Router);
  private readonly el = inject(ElementRef<HTMLElement>);
  readonly I = I;
  readonly open = signal<Menu>(null);
  readonly q = signal('');
  private readonly api = inject(ApiService);
  /** Persistence adapter reported by /health (shown in "About this build"). */
  readonly storage = signal<string | null>(null);
  newName = '';

  readonly results = computed(() => {
    const n = this.q().trim().toLowerCase();
    if (!n) return [];
    const ing = this.ctx
      .catalog()
      .filter((i) => i.name.toLowerCase().includes(n) || i.descriptors.some((d) => d.toLowerCase().includes(n)))
      .slice(0, 6)
      .map((i) => ({
        key: `i${i.id}`,
        kind: 'ingredient' as const,
        id: i.id,
        title: i.name,
        sub: `Ingredient · ${fam(i.family).label}`,
        art: i.art,
        icon: I.Leaf,
      }));
    const concepts = (this.ctx.briefEdit()?.concepts ?? [])
      .filter((c) => c.name.toLowerCase().includes(n))
      .map((c) => ({
        key: `c${c.id}`,
        kind: 'concept' as const,
        id: c.id,
        title: c.name,
        sub: 'Concept',
        art: null,
        icon: I.Lightbulb,
      }));
    const versions = this.ctx
      .versions()
      .filter(
        (v) =>
          v.versionLabel.toLowerCase().includes(n) ||
          `${this.ctx.project()?.name} ${v.versionLabel}`.toLowerCase().includes(n),
      )
      .map((v) => ({
        key: `v${v.id}`,
        kind: 'version' as const,
        id: v.id,
        title: `${this.ctx.project()?.name} – ${v.versionLabel}`,
        sub: `Saved formula version · ${v.totalPct.slice(0, -4)} %`,
        art: null,
        icon: I.History,
      }));
    return [...ing, ...concepts, ...versions].slice(0, 10);
  });

  readonly me = computed(() => this.ctx.session.current());
  roleLabel(r: string) {
    return { owner: 'Owner', reviewer: 'Reviewer', viewer: 'Viewer' }[r] ?? r;
  }
  async switchUser(id: string) {
    this.open.set(null);
    if (id === this.ctx.session.userId()) return;
    try {
      await this.ctx.switchUser(id);
      this.ctx.reportInfo(`Now acting as ${this.me()?.name} (${this.roleLabel(this.ctx.myRole())})`);
    } catch (e) {
      this.ctx.reportError(e, 'Could not switch user');
    }
  }

  toggle(m: Menu) {
    this.open.update((o) => (o === m ? null : m));
    if (m === 'help' && this.open() === 'help' && !this.storage())
      void this.api
        .health()
        .then((h) => this.storage.set(h.persistence?.adapter ?? null))
        .catch(() => undefined);
  }

  go(r: { kind: 'ingredient' | 'concept' | 'version'; id: string }) {
    const pid = this.ctx.projectId();
    this.open.set(null);
    this.q.set('');
    if (r.kind === 'ingredient') {
      this.ui.selectIngredient(r.id);
      void this.router.navigate(['/projects', pid, 'ingredients']);
    } else if (r.kind === 'concept') void this.router.navigate(['/projects', pid, 'concept']);
    else {
      this.ui.patchFormula({ tab: 'history' });
      void this.router.navigate(['/projects', pid, 'formula']);
    }
  }

  async switchProject(id: string) {
    this.open.set(null);
    if (id === this.ctx.projectId()) return;
    await this.router.navigate(['/projects', id, this.workspace().key]);
  }

  async createProject() {
    const name = this.newName.trim();
    if (!name) return;
    try {
      const p = await this.ctx.createProject(name);
      this.newName = '';
      this.open.set(null);
      await this.router.navigate(['/projects', p.id, 'concept']);
    } catch (e) {
      this.ctx.reportError(e, 'Could not create project');
    }
  }

  describe(action: string, p: Record<string, unknown>) {
    switch (action) {
      case 'version.saved':
        return `Saved formula version ${String(p['versionLabel'])}`;
      case 'brief.updated':
        return `Updated creative brief (rev ${String(p['revision'])})`;
      case 'draft.normalized':
        return 'Normalised draft to 100 %';
      case 'draft.branched_from_version':
        return `Loaded ${String(p['versionLabel'])} into the draft`;
      case 'validation.run':
        return `Ran validation on ${String(p['versionLabel'])} → ${String(p['status']).replace('_', ' ')}`;
      case 'experiment.created':
        return `Created experiment “${String(p['title'])}” on ${String(p['versionLabel'])}`;
      case 'experiment.observation_added':
        return `Recorded a ${String(p['kind'])} on ${String(p['versionLabel'])}`;
      case 'review.requested':
        return `Requested review of ${String(p['versionLabel'])}`;
      case 'review.commented':
        return `Commented on review of ${String(p['versionLabel'])}`;
      case 'review.decision':
        return `Review decision on ${String(p['versionLabel'])}: ${String(p['decision']).replace('_', ' ')}`;
      case 'review.withdrawn':
        return `Withdrew review of ${String(p['versionLabel'])}`;
      case 'access.role_changed':
        return `Changed ${String(p['user'])} role to ${String(p['to'])}`;
      case 'upload.added':
        return `Uploaded ${String(p['name'])}`;
      case 'project.created':
        return `Created project ${String(p['name'])}`;
      default:
        return action;
    }
  }

  @HostListener('document:click', ['$event'])
  outside(e: MouseEvent) {
    if (!this.el.nativeElement.contains(e.target as Node)) this.open.set(null);
  }
  @HostListener('document:keydown.escape')
  esc() {
    this.open.set(null);
  }
}
