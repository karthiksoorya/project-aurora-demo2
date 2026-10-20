import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ApiService } from '../../core/api/api.service';
import type { WorkspaceKey } from '../../core/models';
import { WorkspaceStateService } from '../../core/workspace-state/workspace-state.service';
import { I } from '../icons';

const CAPABILITIES: Record<WorkspaceKey, string[]> = {
  concept: [
    'Suggest creative directions from the brief',
    'Recommend key accords',
    'Draft concept variations',
    'Refine brief wording',
  ],
  ingredients: [
    'Suggest alternatives within a family',
    'Explain ingredient roles',
    'Find complementary materials',
    'Compare olfactive profiles',
  ],
  formula: [
    'Propose formula tweaks as a reviewable diff',
    'Explain accord balance',
    'Suggest variations for review',
    'Annotate the 3D exploration',
  ],
  validation: ['Explain computed findings in plain language', 'Point to missing evidence', 'Never computes compliance'],
  experiments: ['Summarise logged observations', 'Suggest next experiments to consider'],
  review: ['Summarise reviewer feedback', 'Draft review notes for a human to edit'],
};

/**
 * AI Creative Partner — honest disabled state (M1).
 * Shown only in AI Assist mode. It makes one *local* status request (`/api/v1/ai/status`) and never
 * generates or fabricates suggestions. Proposals will be untrusted diffs requiring explicit acceptance (M4).
 */
@Component({
  selector: 'aur-ai-partner-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  styleUrl: './ai-partner-panel.component.scss',
  template: `
    <aside class="card ai" aria-label="AI Creative Partner" data-testid="ai-panel">
      <div class="head">
        <span class="spark"><lucide-icon [img]="I.Sparkles" [size]="18" /></span>
        <h2 class="grow">{{ title() }}</h2>
        <button
          class="icon-btn"
          aria-label="Hide AI panel"
          (click)="ui.setAiPanel(workspace(), false)"
          data-testid="ai-panel-close"
        >
          <lucide-icon [img]="I.X" [size]="18" />
        </button>
      </div>
      <div class="tabs mini" role="tablist">
        @for (t of ['Suggestions', 'Insights', 'Variations', 'Ask']; track t) {
          <button class="tab" role="tab" [class.on]="$first" disabled [attr.aria-selected]="$first">{{ t }}</button>
        }
      </div>

      <div class="status" role="status" data-testid="ai-unavailable">
        <lucide-icon [img]="I.Lock" [size]="18" />
        <div class="col" style="gap: 3px">
          <b>AI Assist is unavailable</b>
          <span class="small">
            {{ status()?.message ?? 'AI gateway not connected in this build.' }}
            No suggestions are generated and nothing leaves this computer.
          </span>
          <span class="tiny muted">{{ status()?.requires ?? 'Requires explicit approval (M4).' }}</span>
        </div>
      </div>

      <div class="section-title" style="margin: 14px 0 8px">Planned for this workspace</div>
      <ul class="caps">
        @for (c of caps(); track c) {
          <li>
            <lucide-icon [img]="I.WandSparkles" [size]="15" /> <span>{{ c }}</span>
          </li>
        }
      </ul>
      <p class="tiny muted rule">
        When enabled, every AI suggestion will appear as a pending proposal you can preview, accept or reject. Nothing
        is applied automatically. Manual tools stay fully available.
      </p>

      <div class="ask">
        <input class="input" disabled placeholder="Ask for ideas, variations…" aria-label="Ask AI (disabled)" />
        <button class="btn primary icon" disabled aria-label="Send (disabled)">
          <lucide-icon [img]="I.Send" [size]="16" />
        </button>
      </div>
    </aside>
  `,
})
export class AiPartnerPanelComponent implements OnInit {
  readonly workspace = input.required<WorkspaceKey>();
  readonly title = input('AI Creative Partner');
  readonly ui = inject(WorkspaceStateService);
  private readonly api = inject(ApiService);
  readonly I = I;
  readonly status = signal<{ message: string; requires: string } | null>(null);
  readonly caps = () => CAPABILITIES[this.workspace()];

  ngOnInit() {
    this.api.aiStatus().then(
      (s) => this.status.set(s),
      () => this.status.set({ message: 'AI status endpoint unreachable.', requires: 'Local API offline.' }),
    );
  }
}
