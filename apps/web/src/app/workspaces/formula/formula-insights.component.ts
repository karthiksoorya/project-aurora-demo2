import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ProjectContextService } from '../../core/project-context/project-context.service';
import { WorkspaceStateService } from '../../core/workspace-state/workspace-state.service';
import { fam } from '../../shared/families';
import { I } from '../../shared/icons';
import { SourceEvidenceComponent } from '../../shared/source-evidence/source-evidence.component';

/** Accord Balance · Scent Pyramid · Key Properties (FS-M1 bottom row). All numbers come from the API. */
@Component({
  selector: 'aur-formula-insights',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, SourceEvidenceComponent],
  styles: `
    :host {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr) minmax(0, 1fr);
      gap: 14px;
      min-height: 0;
    }
    .card {
      padding: 12px 14px;
      min-height: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    h3 {
      font-size: 15px;
    }
    .accords {
      display: grid;
      grid-template-columns: 70px 1fr 44px;
      gap: 8px 10px;
      align-items: center;
      margin-top: 4px;
      overflow: auto;
    }
    .accords button {
      all: unset;
      display: contents;
      cursor: pointer;
    }
    .accords .sel {
      font-weight: 700;
      color: var(--primary);
    }
    .pyr {
      display: flex;
      gap: 14px;
      align-items: center;
      flex: 1;
      min-height: 0;
    }
    .pyr svg {
      height: 100%;
      max-height: 160px;
      flex: none;
    }
    .tiers {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
    }
    .tier b {
      font-size: 13px;
    }
    .tier .names {
      display: flex;
      flex-wrap: wrap;
      gap: 3px 10px;
      font-size: 11.5px;
      color: var(--ink-2);
    }
    .tier .names span {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .kp {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      flex: 1;
    }
    .kp > div {
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 8px 10px;
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .kp lucide-icon {
      color: var(--violet);
    }
    .kp b {
      display: block;
      font-size: 13px;
      color: var(--na);
    }
  `,
  template: `
    <section class="card" aria-labelledby="ab-h" data-testid="accord-balance">
      <div class="row" style="margin-bottom: 6px">
        <h3 id="ab-h" class="grow">Accord Balance</h3>
        <aur-evidence status="deterministic" [source]="method()" />
      </div>
      <div class="accords">
        @for (a of accords(); track a.family) {
          <button
            (click)="ui.patchFormula({ selectedFamily: ui.formula().selectedFamily === a.family ? null : a.family })"
            [attr.aria-pressed]="ui.formula().selectedFamily === a.family"
          >
            <span class="small" [class.sel]="ui.formula().selectedFamily === a.family">{{ fam(a.family).label }}</span>
            <div class="bar"><span [style.width.%]="+a.sharePct" [style.background]="fam(a.family).color"></span></div>
            <span class="small" style="text-align: right">{{ (+a.sharePct).toFixed(0) }}%</span>
          </button>
        } @empty {
          <span class="small muted" style="grid-column: 1 / -1"
            >Add ingredients with quantities to see the balance.</span
          >
        }
      </div>
    </section>

    <section class="card" aria-labelledby="sp-h" data-testid="scent-pyramid">
      <div class="row" style="margin-bottom: 6px">
        <h3 id="sp-h" class="grow">Scent Pyramid</h3>
        <span class="tiny muted">grouped by role tag</span>
      </div>
      <div class="pyr">
        <svg viewBox="0 0 160 140" aria-hidden="true">
          <defs>
            <linearGradient id="pt" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#ffd84d" />
              <stop offset="1" stop-color="#f6a21a" />
            </linearGradient>
            <linearGradient id="ph" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#f58fd0" />
              <stop offset="1" stop-color="#b65cf0" />
            </linearGradient>
            <linearGradient id="pb" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#8a5a3c" />
              <stop offset=".55" stop-color="#3e8fe0" />
              <stop offset="1" stop-color="#1a5fb8" />
            </linearGradient>
          </defs>
          <polygon points="80,4 107,48 53,48" fill="url(#pt)" />
          <polygon points="51,52 109,52 132,92 28,92" fill="url(#ph)" />
          <polygon points="26,96 134,96 157,136 3,136" fill="url(#pb)" />
          <text x="80" y="38" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">
            {{ tierPct('top') }}
          </text>
          <text x="80" y="78" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">
            {{ tierPct('heart') }}
          </text>
          <text x="80" y="122" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">
            {{ tierPct('base') }}
          </text>
        </svg>
        <div class="tiers">
          @for (t of tiers; track t.key) {
            <div class="tier">
              <b>{{ t.label }}</b
              >&nbsp;<span class="tiny muted">{{ tierPct(t.key) }} w/w</span>
              <div class="names">
                @for (id of pyramid()?.[t.key]?.ingredientIds ?? []; track id) {
                  @let ing = ctx.ingredient(id);
                  <span><i class="dot" [style.background]="fam(ing?.family ?? '').color"></i>{{ ing?.name }}</span>
                } @empty {
                  <span class="muted">—</span>
                }
              </div>
            </div>
          }
        </div>
      </div>
    </section>

    <section class="card" aria-labelledby="kp-h" data-testid="key-properties">
      <div class="row" style="margin-bottom: 6px">
        <h3 id="kp-h" class="grow">Key Properties</h3>
        <aur-evidence status="not-assessed" source="No validated performance model or measurement configured" />
      </div>
      <div class="kp">
        @for (k of props; track k[0]) {
          <div>
            <lucide-icon [img]="k[1]" [size]="22" />
            <span class="col" style="gap: 1px"
              ><span class="tiny muted">{{ k[0] }}</span
              ><b>Not assessed</b></span
            >
          </div>
        }
      </div>
      <p class="tiny muted" style="margin-top: 6px">
        Longevity, sillage and projection need measured data; Aurora does not predict them.
      </p>
    </section>
  `,
})
export class FormulaInsightsComponent {
  readonly ctx = inject(ProjectContextService);
  readonly ui = inject(WorkspaceStateService);
  readonly fam = fam;
  readonly accords = computed(() => this.ctx.draft()?.computed.accords ?? []);
  readonly pyramid = computed(() => this.ctx.draft()?.computed.pyramid);
  readonly method = computed(() => this.ctx.draft()?.computed.method ?? '');
  readonly tiers = [
    { key: 'top' as const, label: 'Top Notes' },
    { key: 'heart' as const, label: 'Heart Notes' },
    { key: 'base' as const, label: 'Base Notes' },
  ];
  readonly props: [string, typeof I.Clock][] = [
    ['Longevity', I.Clock],
    ['Sillage', I.Sparkles],
    ['Projection', I.Crosshair],
    ['Complexity', I.Network],
  ];
  tierPct(k: 'top' | 'heart' | 'base') {
    const v = this.pyramid()?.[k]?.massPct;
    return v ? `${Number(v).toFixed(1)}%` : '0%';
  }
}
