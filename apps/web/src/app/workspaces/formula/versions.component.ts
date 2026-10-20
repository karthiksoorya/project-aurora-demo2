import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ApiService } from '../../core/api/api.service';
import type { CompareResult, FormulaVersion } from '../../core/models';
import { ProjectContextService } from '../../core/project-context/project-context.service';
import { WorkspaceStateService } from '../../core/workspace-state/workspace-state.service';
import { fam, role } from '../../shared/families';
import { I } from '../../shared/icons';
import { IngredientArtComponent } from '../../shared/ingredient-card/ingredient-art.component';
import { SourceEvidenceComponent } from '../../shared/source-evidence/source-evidence.component';

/** Version history ("Formula Variations"): immutable saved snapshots, view / compare / load-into-draft. */
@Component({
  selector: 'aur-version-history',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, DatePipe],
  styles: `
    :host {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
      gap: 14px;
      min-height: 0;
      height: 100%;
    }
    .list {
      overflow: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .v {
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 12px;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: #fff;
      cursor: pointer;
    }
    .v.on {
      border-color: var(--primary);
      box-shadow: var(--focus);
    }
    .v-ic {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      background: var(--primary-50);
      color: var(--primary);
      flex: none;
    }
    .snap {
      overflow: auto;
    }
    .snap table td {
      padding: 5px 8px;
    }
  `,
  template: `
    <section class="card card-pad list" aria-label="Saved versions" data-testid="version-list">
      <div class="card-head">
        <h2 class="grow">Saved versions</h2>
        <span class="tiny muted">immutable · newest last</span>
      </div>
      @for (v of ctx.versions(); track v.id) {
        <div
          class="v"
          [class.on]="v.id === viewId()"
          (click)="view(v.id)"
          [attr.data-testid]="'version-' + v.versionLabel"
          role="button"
          tabindex="0"
          (keydown.enter)="view(v.id)"
        >
          <span class="v-ic"><lucide-icon [img]="I.History" [size]="18" /></span>
          <div class="col grow" style="gap: 2px">
            <b>{{ ctx.project()?.name }} – {{ v.versionLabel }}</b>
            <span class="tiny muted"
              >{{ v.savedAt | date: 'd MMM y, HH:mm:ss' }} · {{ v.lineCount }} lines · total
              {{ v.totalPct.slice(0, -4) }} %</span
            >
            <span class="tiny mono muted"
              >sha256 {{ v.snapshotHash.slice(0, 16) }}…{{
                v.parentVersionId ? ' · parent ' + label(v.parentVersionId) : ''
              }}</span
            >
            @if (v.note) {
              <span class="tiny">{{ v.note }}</span>
            }
          </div>
          <span class="badge" [class]="v.completeness === 'complete' ? 'badge ok' : 'badge warn'">{{
            v.completeness
          }}</span>
        </div>
      } @empty {
        <p class="small muted">
          No saved versions yet. Use <b>Save Version</b> to create an immutable snapshot of the draft.
        </p>
      }
    </section>
    <section class="card card-pad snap" aria-label="Version snapshot" data-testid="version-snapshot">
      @if (snapshot(); as s) {
        <div class="card-head">
          <div class="col grow" style="gap: 2px">
            <h2>{{ s.versionLabel }} snapshot</h2>
            <span class="tiny muted"
              >Read-only · catalog {{ s.snapshot.catalogVersion }} · draft rev
              {{ s.snapshot.sourceDraftRevision }}</span
            >
          </div>
          <span class="badge" [class]="s.hashVerified ? 'badge ok' : 'badge err'" data-testid="hash-verified">{{
            s.hashVerified ? 'Hash verified' : 'Hash mismatch'
          }}</span>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Ingredient</th>
              <th>% (w/w)</th>
              <th>Role</th>
              <th>Family</th>
            </tr>
          </thead>
          <tbody>
            @for (it of s.snapshot.items; track it.lineId; let i = $index) {
              <tr>
                <td class="muted small">{{ i + 1 }}</td>
                <td class="small">
                  <b>{{ it.ingredientName }}</b>
                </td>
                <td class="small mono">{{ it.massPct }}</td>
                <td class="small">{{ role(it.role).label }}</td>
                <td class="small">{{ fam(it.family).label }}</td>
              </tr>
            }
          </tbody>
        </table>
        <div class="row" style="margin-top: 10px">
          <b class="grow">Total {{ s.snapshot.totalPct }} %</b>
          <button class="btn sm" (click)="compareWithPrevious(s.id)" [disabled]="ctx.versions().length < 2">
            <lucide-icon [img]="I.GitCompareArrows" [size]="15" /> Compare
          </button>
          <button class="btn sm" (click)="confirmLoad.set(s.id)" data-testid="load-into-draft">
            <lucide-icon [img]="I.GitBranch" [size]="15" /> Load into draft
          </button>
        </div>
        <p class="tiny mono muted" style="margin-top: 8px; word-break: break-all">
          {{ s.hashAlgorithm }}: {{ s.snapshotHash }}
        </p>
        @if (confirmLoad() === s.id) {
          <div
            class="card card-pad"
            style="margin-top: 10px; background: var(--warn-50); border-color: #f6d39a"
            role="alertdialog"
            aria-label="Confirm load"
          >
            <p class="small">
              Replace the current working draft with <b>{{ s.versionLabel }}</b
              >? The draft is not versioned; saved versions are unaffected. This is recorded in the audit trail.
            </p>
            <div class="row" style="justify-content: flex-end; margin-top: 8px">
              <button class="btn sm ghost" (click)="confirmLoad.set(null)">Cancel</button>
              <button class="btn sm primary" (click)="load(s.id)" data-testid="confirm-load">
                Load {{ s.versionLabel }}
              </button>
            </div>
          </div>
        }
      } @else {
        <p class="small muted">Select a version to view its snapshot.</p>
      }
    </section>
  `,
})
export class VersionHistoryComponent {
  readonly ctx = inject(ProjectContextService);
  private readonly api = inject(ApiService);
  private readonly ui = inject(WorkspaceStateService);
  readonly compare = output<void>();
  readonly I = I;
  readonly fam = fam;
  readonly role = role;
  readonly viewId = signal<string | null>(this.ctx.versions().at(-1)?.id ?? null);
  readonly snapshot = signal<FormulaVersion | null>(null);
  readonly confirmLoad = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.viewId();
      if (id) void this.api.version(id).then((v) => this.snapshot.set(v));
    });
  }
  view(id: string) {
    this.viewId.set(id);
  }
  label(id: string) {
    return this.ctx.versions().find((v) => v.id === id)?.versionLabel ?? id.slice(0, 8);
  }
  compareWithPrevious(id: string) {
    const vs = this.ctx.versions();
    const i = vs.findIndex((v) => v.id === id);
    const other = i > 0 ? vs[i - 1] : vs[1];
    this.ui.patchFormula({
      compareLeftId: i > 0 ? other.id : id,
      compareRightId: i > 0 ? id : other.id,
      tab: 'compare',
    });
    this.compare.emit();
  }
  async load(id: string) {
    this.confirmLoad.set(null);
    await this.ctx.loadVersionIntoDraft(id);
    this.ui.patchFormula({ tab: 'builder' });
  }
}

/** Version comparison (FS-VC). Uses only saved immutable snapshots; deltas computed by the API. */
@Component({
  selector: 'aur-version-compare',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, FormsModule, IngredientArtComponent, SourceEvidenceComponent],
  styles: `
    :host {
      display: grid;
      grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
      gap: 14px;
      min-height: 0;
      height: 100%;
    }
    .main,
    .side {
      overflow: auto;
    }
    .pickers {
      display: flex;
      gap: 10px;
      align-items: flex-end;
      margin-bottom: 12px;
    }
    .pickers .field {
      flex: 1;
    }
    .d-pos {
      color: var(--ok);
      font-weight: 650;
    }
    .d-neg {
      color: var(--err);
      font-weight: 650;
    }
    .acc {
      display: grid;
      grid-template-columns: 70px 1fr 90px;
      gap: 6px 10px;
      align-items: center;
    }
    .twobar {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .twobar .bar {
      height: 7px;
    }
    .hash {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    tr.added td {
      background: #f1fbf5;
    }
    tr.removed td {
      background: #fff4f5;
    }
    .pyrs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .pyr-card {
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    .pyr-card svg {
      width: 100%;
      max-width: 150px;
    }
  `,
  template: `
    <section class="card card-pad main" data-testid="version-compare">
      <div class="card-head">
        <h2 class="grow">Version Comparison</h2>
        <span class="tiny muted">{{ result()?.basis }}</span>
      </div>
      <div class="pickers">
        <div class="field">
          <label for="cl">Left (baseline)</label>
          <select
            id="cl"
            class="select"
            [ngModel]="ui.formula().compareLeftId"
            (ngModelChange)="ui.patchFormula({ compareLeftId: $event })"
            data-testid="compare-left"
          >
            @for (v of ctx.versions(); track v.id) {
              <option [value]="v.id">{{ v.versionLabel }}</option>
            }
          </select>
        </div>
        <button class="icon-btn bordered" aria-label="Swap" (click)="swap()">
          <lucide-icon [img]="I.ArrowLeftRight" [size]="16" />
        </button>
        <div class="field">
          <label for="cr">Right</label>
          <select
            id="cr"
            class="select"
            [ngModel]="ui.formula().compareRightId"
            (ngModelChange)="ui.patchFormula({ compareRightId: $event })"
            data-testid="compare-right"
          >
            @for (v of ctx.versions(); track v.id) {
              <option [value]="v.id">{{ v.versionLabel }}</option>
            }
          </select>
        </div>
      </div>
      @if (ctx.versions().length < 2) {
        <p class="small muted">Save at least two versions to compare them.</p>
      } @else if (result(); as r) {
        <div class="row" style="gap: 8px; margin-bottom: 8px">
          <span class="badge ok">{{ r.summary.changed }} changed</span>
          <span class="badge info">{{ r.summary.added }} added</span>
          <span class="badge err">{{ r.summary.removed }} removed</span>
          <span class="badge na">{{ r.summary.unchanged }} unchanged</span>
        </div>
        <table class="table" data-testid="compare-table">
          <thead>
            <tr>
              <th>Ingredient</th>
              <th>Family</th>
              <th>{{ r.left.versionLabel }}</th>
              <th>{{ r.right.versionLabel }}</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            @for (row of r.rows; track row.ingredientId) {
              @let ing = ctx.ingredient(row.ingredientId);
              <tr [class]="row.change" [attr.data-testid]="'cmp-' + (ing?.slug ?? row.ingredientId)">
                <td>
                  <div class="row">
                    @if (ing) {
                      <aur-ingredient-art [motif]="ing.art.motif" [hue]="ing.art.hue" [size]="26" />
                    }
                    <b class="small">{{ row.ingredientName }}</b>
                  </div>
                </td>
                <td>
                  <span class="chip" [style.background]="fam(row.family).tint" [style.color]="fam(row.family).ink">{{
                    fam(row.family).label
                  }}</span>
                </td>
                <td class="small mono">{{ row.leftPct ? (+row.leftPct).toFixed(2) : '—' }}</td>
                <td class="small mono">{{ row.rightPct ? (+row.rightPct).toFixed(2) : '—' }}</td>
                <td
                  class="small mono"
                  [class.d-pos]="+row.deltaPct > 0"
                  [class.d-neg]="+row.deltaPct < 0"
                  data-testid="cmp-delta"
                >
                  {{
                    row.change === 'unchanged' ? '0.00' : (+row.deltaPct > 0 ? '+' : '') + (+row.deltaPct).toFixed(2)
                  }}
                  @if (row.change === 'added' || row.change === 'removed') {
                    <span class="tiny">({{ row.change }})</span>
                  }
                </td>
              </tr>
            }
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2"><b>Total</b></td>
              <td class="small mono">{{ (+r.left.totalPct).toFixed(2) }}</td>
              <td class="small mono">{{ (+r.right.totalPct).toFixed(2) }}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      }
    </section>
    <section class="card card-pad side">
      @if (result(); as r) {
        <div class="card-head">
          <h3 class="grow">Accord Balance Comparison</h3>
          <aur-evidence status="deterministic" />
        </div>
        <div class="acc">
          @for (a of r.accords; track a.family) {
            <span class="small">{{ fam(a.family).label }}</span>
            <div class="twobar">
              <div class="bar">
                <span
                  [style.width.%]="+a.leftSharePct"
                  [style.background]="fam(a.family).color"
                  style="opacity: 0.55"
                ></span>
              </div>
              <div class="bar">
                <span [style.width.%]="+a.rightSharePct" [style.background]="fam(a.family).color"></span>
              </div>
            </div>
            <span class="tiny mono">{{ (+a.leftSharePct).toFixed(0) }}% → {{ (+a.rightSharePct).toFixed(0) }}%</span>
          }
        </div>
        <div class="section-title" style="margin: 16px 0 8px">
          Scent Pyramid Comparison <span class="tiny muted">(% w/w by role tag)</span>
        </div>
        <div class="pyrs" data-testid="pyramid-compare">
          @for (side of ['left', 'right']; track side) {
            <div class="pyr-card">
              <b class="small">{{ side === 'left' ? r.left.versionLabel : r.right.versionLabel }}</b>
              <svg viewBox="0 0 120 96" aria-hidden="true">
                <polygon points="60,2 80,32 40,32" fill="#f7c331" />
                <polygon points="38,35 82,35 99,64 21,64" fill="#e57ad0" />
                <polygon points="19,67 101,67 118,94 2,94" fill="#3f86de" />
                <text x="60" y="26" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">
                  {{ (+$any(r.pyramid)[side].top.sharePct).toFixed(0) }}%
                </text>
                <text x="60" y="54" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">
                  {{ (+$any(r.pyramid)[side].heart.sharePct).toFixed(0) }}%
                </text>
                <text x="60" y="85" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">
                  {{ (+$any(r.pyramid)[side].base.sharePct).toFixed(0) }}%
                </text>
              </svg>
            </div>
          }
        </div>
        <div class="section-title" style="margin: 16px 0 8px">Snapshot integrity</div>
        @for (h of [r.left, r.right]; track h.id) {
          <div class="hash small">
            <b>{{ h.versionLabel }}</b>
            <span class="mono tiny muted grow">{{ h.snapshotHash.slice(0, 20) }}…</span>
            <span class="badge" [class]="h.hashVerified ? 'badge ok' : 'badge err'">{{
              h.hashVerified ? 'verified' : 'mismatch'
            }}</span>
          </div>
        }
        <div class="section-title" style="margin: 16px 0 8px">Key metrics</div>
        <p class="small muted">
          Longevity, projection, stability: <aur-evidence status="not-assessed" /> — no measured data recorded for these
          versions.
        </p>
      }
    </section>
  `,
})
export class VersionCompareComponent {
  readonly ctx = inject(ProjectContextService);
  readonly ui = inject(WorkspaceStateService);
  private readonly api = inject(ApiService);
  readonly I = I;
  readonly fam = fam;
  readonly result = signal<CompareResult | null>(null);
  private readonly pair = computed(() => [this.ui.formula().compareLeftId, this.ui.formula().compareRightId] as const);

  constructor() {
    // default the pair to the two most recent versions
    const vs = this.ctx.versions();
    const f = this.ui.formula();
    const ids = new Set(vs.map((v) => v.id));
    if (
      vs.length >= 2 &&
      (!f.compareLeftId || !ids.has(f.compareLeftId) || !f.compareRightId || !ids.has(f.compareRightId))
    )
      this.ui.patchFormula({ compareLeftId: vs.at(-2)!.id, compareRightId: vs.at(-1)!.id });
    effect(() => {
      const [l, r] = this.pair();
      if (!l || !r) return;
      this.api.compare(l, r).then(
        (res) => this.result.set(res),
        (e) => this.ctx.reportError(e, 'Compare failed'),
      );
    });
  }
  swap() {
    const f = this.ui.formula();
    this.ui.patchFormula({ compareLeftId: f.compareRightId, compareRightId: f.compareLeftId });
  }
}
