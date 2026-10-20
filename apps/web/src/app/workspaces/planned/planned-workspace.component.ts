import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import type { WorkspaceKey } from '../../core/models';
import { ProjectContextService } from '../../core/project-context/project-context.service';
import { WorkspaceStateService } from '../../core/workspace-state/workspace-state.service';
import { WORKSPACES } from '../../shared/app-shell/nav';
import { AiPartnerPanelComponent } from '../../shared/contextual-panel/ai-partner-panel.component';
import { I } from '../../shared/icons';

interface PlannedData {
  key: WorkspaceKey;
  subtitle: string;
  screens: string[];
  planned: { title: string; detail: string }[];
  honesty: string;
}

/**
 * Validation Studio, Experiment Explorer and Share & Review are M2. In M1 they render inside the
 * shared shell with real project context (saved immutable versions) and an explicit scope notice —
 * no mock results, scores or compliance claims.
 */
@Component({
  selector: 'aur-planned-workspace',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, DatePipe, RouterLink, AiPartnerPanelComponent],
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 0;
      gap: 12px;
    }
    .body {
      flex: 1;
      min-height: 0;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 360px;
      gap: 14px;
    }
    .body.with-ai {
      grid-template-columns: minmax(0, 1fr) 360px 330px;
    }
    .hero {
      display: flex;
      gap: 16px;
      align-items: center;
      padding: 22px;
      background: linear-gradient(120deg, #eef4ff, #fbf1ff 60%, #fff6ec);
      border-color: #e3e6fb;
    }
    .hero h2 {
      font-size: 19px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-top: 14px;
    }
    .feat {
      padding: 14px;
      border-radius: 14px;
      border: 1px solid var(--border);
      background: #fff;
    }
    .feat b {
      display: block;
      margin-bottom: 4px;
    }
    .v {
      display: flex;
      gap: 10px;
      align-items: center;
      padding: 10px;
      border: 1px solid var(--border);
      border-radius: 12px;
    }
    .left {
      overflow: auto;
      min-height: 0;
    }
    .na {
      display: flex;
      gap: 10px;
      padding: 12px;
      border-radius: 12px;
      background: var(--na-50);
      color: var(--ink-2);
      margin-top: 14px;
    }
  `,
  template: `
    <div class="page-head">
      <span class="ws-icon"><lucide-icon [img]="nav().icon" [size]="28" [style.color]="nav().color" /></span>
      <h1 data-testid="workspace-title">{{ nav().label }}</h1>
      <span class="sub">{{ data().subtitle }}</span>
      <span class="grow"></span>
      @if (ui.mode() === 'ai' && !ui.aiPanelVisible(data().key)) {
        <button class="btn soft sm" (click)="ui.setAiPanel(data().key, true)">
          <lucide-icon [img]="I.Sparkles" [size]="15" /> Show AI panel
        </button>
      }
      <span class="badge info">Planned for M2</span>
    </div>
    <div class="body" [class.with-ai]="ui.aiPanelVisible(data().key)" [attr.data-workspace]="data().key">
      <section class="left">
        <div class="card hero">
          <lucide-icon [img]="nav().icon" [size]="44" [style.color]="nav().color" />
          <div class="col" style="gap: 6px">
            <h2>This workspace is part of milestone M2</h2>
            <p class="muted">
              The shared shell, navigation, project context and mode switch are live. Workflows below are designed from
              reference screens {{ data().screens.join(', ') }} and will be implemented next.
            </p>
          </div>
        </div>
        <div class="grid">
          @for (f of data().planned; track f.title) {
            <div class="feat">
              <b>{{ f.title }}</b
              ><span class="small muted">{{ f.detail }}</span>
            </div>
          }
        </div>
        <div class="na" role="note">
          <lucide-icon [img]="I.Info" [size]="18" />
          <span class="small">{{ data().honesty }}</span>
        </div>
      </section>
      <aside class="card card-pad" style="overflow: auto">
        <div class="card-head">
          <h3 class="grow">Saved formula versions</h3>
          <span class="tiny muted">immutable</span>
        </div>
        <p class="small muted" style="margin-bottom: 10px">
          M2 records in this workspace will reference one of these exact version IDs — never the editable draft.
        </p>
        <div class="col">
          @for (v of ctx.versions(); track v.id) {
            <div class="v">
              <lucide-icon [img]="I.History" [size]="18" />
              <div class="col grow" style="gap: 1px">
                <b class="small">{{ ctx.project()?.name }} – {{ v.versionLabel }}</b>
                <span class="tiny muted"
                  >{{ v.savedAt | date: 'd MMM y, HH:mm' }} · {{ v.totalPct.slice(0, -4) }} %</span
                >
                <span class="tiny mono muted">#{{ v.snapshotHash.slice(0, 12) }}</span>
              </div>
            </div>
          } @empty {
            <p class="small muted">
              No saved versions yet. Save one in <a [routerLink]="['../formula']">Formula Studio</a>.
            </p>
          }
        </div>
      </aside>
      @if (ui.aiPanelVisible(data().key)) {
        <aur-ai-partner-panel [workspace]="data().key" />
      }
    </div>
  `,
})
export class PlannedWorkspaceComponent {
  private readonly route = inject(ActivatedRoute);
  readonly ctx = inject(ProjectContextService);
  readonly ui = inject(WorkspaceStateService);
  readonly I = I;
  readonly data = toSignal(this.route.data, { initialValue: this.route.snapshot.data }) as unknown as () => PlannedData;
  readonly nav = computed(() => WORKSPACES.find((w) => w.key === this.data().key)!);
}

export const PLANNED: Record<'validation' | 'experiments' | 'review', PlannedData> = {
  validation: {
    key: 'validation',
    subtitle: 'Validate saved formula versions with traceable rules',
    screens: ['VS-M', 'VS-A', 'VS-E'],
    planned: [
      {
        title: 'Formula checks',
        detail: 'Deterministic numeric checks on a saved version: totals, zero lines, duplicates, completeness.',
      },
      {
        title: 'Rule-set selection',
        detail: 'Market, product category and rule-set edition chosen explicitly and stored with each run.',
      },
      {
        title: 'Evidence panel',
        detail: 'Per-finding source, edition, input confidence; stale-result marking when inputs change.',
      },
      {
        title: 'AI explanation (optional)',
        detail: 'Plain-language explanation of computed findings — never computes compliance.',
      },
    ],
    honesty:
      'No regulatory dataset (IFRA standard, allergen lists, market rules) is configured. Every regulatory, allergen, stability and performance result will show “Not assessed” until a verified source is provided.',
  },
  experiments: {
    key: 'experiments',
    subtitle: 'Track experiments against exact saved versions',
    screens: ['EE-M1', 'EE-A', 'EE-X'],
    planned: [
      { title: 'Experiment history', detail: 'Experiments and observations linked to one formula version ID.' },
      {
        title: 'Branching graph',
        detail: 'Expanded canvas of version ancestry and branches (the API already records parent versions).',
      },
      { title: 'Observation types', detail: 'Subjective observation, measurement and hypothesis labelled distinctly.' },
      { title: 'Compare across branches', detail: 'Only saved observations are compared — no predicted measurements.' },
    ],
    honesty:
      'No experimental results exist yet. Ratings, longevity or stability figures will only appear when a scientist records them.',
  },
  review: {
    key: 'review',
    subtitle: 'Share versions, collect feedback and track decisions',
    screens: ['SR-M', 'SR-A', 'SR-X'],
    planned: [
      {
        title: 'Version sharing',
        detail: 'Share a specific saved version with simulated local roles (owner, reviewer, viewer).',
      },
      {
        title: 'Comments & decisions',
        detail: 'Permission-checked comments, approval and change requests enforced by the API.',
      },
      {
        title: 'Audit history',
        detail: 'Immutable event feed — already recording brief, version and draft events today.',
      },
      {
        title: 'AI review assistance (optional)',
        detail: 'Feedback summaries drafted for a human to edit; never approves.',
      },
    ],
    honesty: 'Local simulated users only; there is no authentication or external sharing in this proof of concept.',
  },
};
