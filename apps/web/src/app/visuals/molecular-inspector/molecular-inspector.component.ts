import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import type { IngredientDetail } from '../../core/models';
import { ProjectContextService } from '../../core/project-context/project-context.service';
import { WorkspaceStateService } from '../../core/workspace-state/workspace-state.service';
import { kindLabel } from '../../shared/families';
import { I } from '../../shared/icons';
import { IngredientArtComponent } from '../../shared/ingredient-card/ingredient-art.component';
import { SourceEvidenceComponent } from '../../shared/source-evidence/source-evidence.component';
import { MoleculeViewerComponent } from './molecule-viewer.component';

/**
 * Molecular Inspector (FS-MI1 compound view, FS-MI2 constituent focus).
 * One reusable inspector: a natural mixture shows its constituents (no single structure);
 * picking a constituent with a curated structure opens that single compound (breadcrumb Mixture › Compound).
 */
@Component({
  selector: 'aur-molecular-inspector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, MoleculeViewerComponent, IngredientArtComponent, SourceEvidenceComponent],
  styles: `
    :host {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 300px;
      gap: 12px;
      height: 100%;
      padding: 10px;
      min-height: 0;
    }
    :host(.viewer-only),
    :host(.side-only) {
      grid-template-columns: minmax(0, 1fr);
    }
    :host(.side-only) {
      padding: 0;
    }
    .viewer {
      position: relative;
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .crumbs {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .crumbs button {
      border: 1px solid var(--border);
      background: #fff;
      border-radius: 99px;
      height: 28px;
      padding: 0 10px;
      cursor: pointer;
      font-size: 12.5px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .crumbs button.on {
      border-color: var(--primary);
      color: var(--primary);
      background: var(--primary-50);
      font-weight: 600;
    }
    .stage {
      flex: 1;
      min-height: 0;
    }
    .side {
      min-height: 0;
      overflow: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .side h3 {
      font-size: 16px;
    }
    dl {
      display: grid;
      grid-template-columns: 92px 1fr;
      gap: 6px 8px;
      margin: 0;
      font-size: 12.5px;
    }
    dt {
      color: var(--muted);
    }
    dd {
      margin: 0;
      word-break: break-all;
    }
    .cons {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .cons li {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border: 1px solid var(--border);
      border-radius: 10px;
      font-size: 12.5px;
    }
    .mixture {
      flex: 1;
      display: grid;
      place-items: center;
      text-align: center;
      border-radius: 12px;
      background: linear-gradient(135deg, #f3f8ff, #fff6ec);
      padding: 20px;
    }
    .pick {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
  `,
  host: { '[class.viewer-only]': "layout() === 'viewer'", '[class.side-only]': "layout() === 'side'" },
  template: `
    @if (layout() !== 'side') {
      <div class="viewer">
        <div class="crumbs" aria-label="Inspector focus">
          <span class="tiny muted">Formula ingredient:</span>
          @for (l of formulaIngredients(); track l.id) {
            <button [class.on]="l.id === baseId()" (click)="selectBase(l.id)" [attr.data-testid]="'mi-pick-' + l.slug">
              {{ l.name }}
            </button>
          }
        </div>
        @if (base(); as b) {
          <div class="crumbs" data-testid="mi-breadcrumb">
            <lucide-icon [img]="I.Atom" [size]="15" />
            <button [class.on]="!compoundDetail()" (click)="compoundId.set(null)">{{ b.name }}</button>
            @if (compoundDetail(); as c) {
              <lucide-icon [img]="I.ChevronRight" [size]="14" />
              <button class="on">{{ c.name }}</button>
            }
          </div>
        }
        <div class="stage">
          @if (structure(); as st) {
            <aur-molecule-viewer [structure]="st" key="inspector-molecule" />
          } @else if (base(); as b) {
            <div class="mixture" data-testid="mi-mixture">
              <div class="col" style="align-items: center; gap: 10px; max-width: 420px">
                <aur-ingredient-art [motif]="b.art.motif" [hue]="b.art.hue" [size]="72" />
                @if (b.kind === 'natural_mixture') {
                  <b>{{ b.name }} is a natural mixture</b>
                  <span class="small muted"
                    >A natural oil is not one molecule, so no single structure is drawn. Choose a constituent with a
                    curated structure:</span
                  >
                  <div class="pick">
                    @for (c of b.constituents; track c.name) {
                      @if (c.hasStructure && c.ingredientId) {
                        <button
                          class="btn sm soft"
                          (click)="compoundId.set(c.ingredientId)"
                          [attr.data-testid]="'mi-constituent-' + c.name"
                        >
                          {{ c.name }}
                        </button>
                      }
                    }
                  </div>
                } @else {
                  <b>No curated structure for {{ b.name }}</b>
                  <span class="small muted">{{ b.structurePolicy }}</span>
                }
              </div>
            </div>
          } @else {
            <div class="mixture"><span class="small muted">Add ingredients to the formula to inspect them.</span></div>
          }
        </div>
      </div>
    }
    @if (layout() !== 'viewer') {
      <aside class="side" aria-label="Inspector details" data-testid="mi-side">
        @if (shown(); as d) {
          <div class="row" style="gap: 10px">
            <aur-ingredient-art [motif]="d.art.motif" [hue]="d.art.hue" [size]="52" />
            <div class="col" style="gap: 2px">
              <h3>{{ d.name }}</h3>
              <span class="badge" [class]="d.kind === 'natural_mixture' ? 'badge ok' : 'badge info'">{{
                kindLabel(d.kind)
              }}</span>
            </div>
          </div>
          <dl>
            <dt>Name</dt>
            <dd>{{ d.systematicName }}</dd>
            @for (p of keyProps(d); track p.key) {
              <dt>{{ p.label }}</dt>
              <dd>{{ p.value ?? 'Data unavailable' }} <aur-evidence [status]="p.status" [source]="p.source.name" /></dd>
            }
          </dl>
          @if (d.structure; as st) {
            <div class="section-title">Structure provenance</div>
            <dl data-testid="mi-provenance">
              <dt>Compound ID</dt>
              <dd class="mono">{{ st.compoundId }}</dd>
              <dt>SMILES</dt>
              <dd class="mono">{{ st.smiles }}</dd>
              <dt>Consistency</dt>
              <dd>{{ st.formulaConsistent ? 'Formula from SMILES matches fixture' : 'MISMATCH' }}</dd>
              <dt>Method</dt>
              <dd class="tiny">{{ st.provenance.method }}</dd>
              <dt>Registry</dt>
              <dd>
                <span class="badge warn">check {{ st.provenance.registryCheck }}</span>
              </dd>
            </dl>
            <p class="tiny muted">{{ st.provenance.note }}</p>
          }
          @if (d.kind === 'natural_mixture') {
            <div class="section-title">Constituents (qualitative)</div>
            <ul class="cons">
              @for (c of d.constituents; track c.name) {
                <li>
                  <span class="grow">{{ c.name }}</span>
                  @if (c.hasStructure && c.ingredientId) {
                    <button class="btn sm ghost" (click)="compoundId.set(c.ingredientId)">Inspect</button>
                  } @else {
                    <span class="tiny muted">not curated</span>
                  }
                </li>
              }
            </ul>
          }
          <div class="row">
            <span class="section-title grow">IFRA status</span>
            <aur-evidence status="not-assessed" />
          </div>
        }
      </aside>
    }
  `,
})
export class MolecularInspectorComponent {
  readonly ctx = inject(ProjectContextService);
  readonly ui = inject(WorkspaceStateService);
  readonly I = I;
  readonly kindLabel = kindLabel;
  /** 'split' = viewer + details; 'viewer' / 'side' render one half (two instances stay in sync via shared UI state). */
  readonly layout = input<'split' | 'viewer' | 'side'>('split');
  readonly compoundId = {
    get: () => this.ui.formula().inspectorCompoundIngredientId,
    set: (id: string | null) => this.ui.patchFormula({ inspectorCompoundIngredientId: id }),
  };
  readonly base = signal<IngredientDetail | null>(null);
  readonly compoundDetail = signal<IngredientDetail | null>(null);

  readonly formulaIngredients = computed(() => {
    const seen = new Set<string>();
    return this.ctx
      .workingItems()
      .map((i) => this.ctx.ingredient(i.ingredientId))
      .filter((i): i is NonNullable<typeof i> => !!i && !seen.has(i.id) && !!seen.add(i.id));
  });
  readonly baseId = computed(() => {
    const sel = this.ui.selectedIngredientId();
    const ids = this.formulaIngredients().map((i) => i.id);
    if (sel && (ids.includes(sel) || this.ctx.ingredient(sel))) return sel;
    return ids[0] ?? null;
  });
  readonly shown = computed(() => this.compoundDetail() ?? this.base());
  readonly structure = computed(
    () =>
      this.compoundDetail()?.structure ??
      (this.base()?.kind === 'single_compound' ? this.base()?.structure : null) ??
      null,
  );

  constructor() {
    effect(() => {
      const id = this.baseId();
      if (!id) {
        this.base.set(null);
        return;
      }
      void this.ctx.detail(id).then((d) => {
        if (this.baseId() !== id) return;
        this.base.set(d);
        const cid = this.compoundId.get();
        // keep a constituent focus only if it belongs to this base ingredient
        if (cid && cid !== id && !d.constituents.some((c) => c.ingredientId === cid)) this.compoundId.set(null);
      });
    });
    effect(() => {
      const cid = this.compoundId.get();
      if (!cid) {
        this.compoundDetail.set(null);
        return;
      }
      void this.ctx.detail(cid).then((d) => {
        if (this.compoundId.get() === cid) this.compoundDetail.set(d.structure ? d : null);
      });
    });
  }

  selectBase(id: string) {
    this.compoundId.set(null);
    this.ui.selectIngredient(id);
  }
  keyProps(d: IngredientDetail) {
    return d.properties.filter((p) => ['cas', 'formula', 'mw', 'appearance'].includes(p.key));
  }
}
