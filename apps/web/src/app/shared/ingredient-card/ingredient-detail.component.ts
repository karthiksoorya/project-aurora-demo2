import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import type { IngredientDetail } from '../../core/models';
import { ProjectContextService } from '../../core/project-context/project-context.service';
import { MoleculeViewerComponent } from '../../visuals/molecular-inspector/molecule-viewer.component';
import { fam, kindLabel, role } from '../families';
import { I } from '../icons';
import { SourceEvidenceComponent } from '../source-evidence/source-evidence.component';
import { IngredientArtComponent } from './ingredient-art.component';

export type DetailTab = 'overview' | 'properties' | 'safety' | 'composition';

/**
 * Ingredient detail panel with per-field provenance. Natural mixtures list constituents
 * (each inspectable if a curated compound structure exists); single compounds show their structure.
 */
@Component({
  selector: 'aur-ingredient-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, IngredientArtComponent, SourceEvidenceComponent, MoleculeViewerComponent],
  styleUrl: './ingredient-detail.component.scss',
  template: `
    @if (detail(); as d) {
      <div class="head">
        <aur-ingredient-art [motif]="d.art.motif" [hue]="d.art.hue" [size]="84" />
        <div class="col grow" style="gap: 3px; min-width: 0">
          <h2 class="name ellipsis" data-testid="detail-name">{{ d.name }}</h2>
          <span class="small muted ellipsis">{{ d.systematicName }}</span>
          <span
            ><span
              class="badge"
              [class]="d.kind === 'natural_mixture' ? 'badge ok' : 'badge info'"
              data-testid="detail-kind"
              >{{ kindLabel(d.kind) }}</span
            ></span
          >
          <span class="small"
            ><span [style.color]="fam(d.family).ink">{{ fam(d.family).label }}</span> › {{ role(d.role).label }} note
            <span class="muted">(role tag)</span></span
          >
        </div>
        <div class="col" style="gap: 6px">
          <button
            class="icon-btn bordered"
            [class.on]="compared()"
            [attr.aria-pressed]="compared()"
            aria-label="Toggle compare"
            (click)="toggleCompare.emit(d.id)"
            data-testid="detail-compare"
          >
            <lucide-icon [img]="I.GitCompareArrows" [size]="16" />
          </button>
        </div>
      </div>
      <div class="add-row">
        @if (inFormulaPct(); as pct) {
          <span class="badge ok"><lucide-icon [img]="I.Check" [size]="13" /> In formula · {{ pct }} %</span>
        }
        <button class="btn primary sm" (click)="addToFormula.emit(d.id)" data-testid="detail-add-to-formula">
          <lucide-icon [img]="I.Plus" [size]="15" /> Add to Formula
        </button>
      </div>

      <div class="tabs" role="tablist">
        @for (t of tabs; track t[0]) {
          <button
            class="tab"
            role="tab"
            [class.on]="tab() === t[0]"
            [attr.aria-selected]="tab() === t[0]"
            (click)="tab.set(t[0])"
            [attr.data-testid]="'detail-tab-' + t[0]"
          >
            {{ t[0] === 'composition' ? (d.kind === 'natural_mixture' ? 'Composition' : 'Structure') : t[1] }}
          </button>
        }
      </div>

      <div class="body">
        @switch (tab()) {
          @case ('overview') {
            <section>
              <div class="section-title">Description</div>
              <p class="small desc">{{ d.description }}</p>
            </section>
            <section>
              <div class="row">
                <span class="section-title grow">Olfactive profile</span
                ><aur-evidence
                  status="illustrative"
                  source="Curator descriptor tags for this demo — not measured odour data"
                />
              </div>
              <div class="profile">
                @for (e of d.descriptorEmphasis; track e.descriptor) {
                  <span class="small">{{ e.descriptor }}</span>
                  <div class="bar">
                    <span [style.width.%]="e.level * 31" [style.background]="barColor(e.descriptor, d.family)"></span>
                  </div>
                  <span class="tiny muted">{{ ['', 'Accent', 'Secondary', 'Primary'][e.level] }}</span>
                }
              </div>
            </section>
            <div class="kpis">
              @for (k of ['Tenacity', 'Impact', 'Typical usage']; track k) {
                <div class="kpi">
                  <span class="tiny muted">{{ k }}</span>
                  <b class="na-cell">Not assessed</b>
                  <span class="tiny muted">no verified source</span>
                </div>
              }
            </div>
          }
          @case ('properties') {
            <table class="table props" data-testid="detail-properties">
              <tbody>
                @for (p of d.properties; track p.key) {
                  <tr>
                    <td class="small muted">{{ p.label }}</td>
                    <td class="small">
                      @if (p.value) {
                        {{ p.value }}
                      } @else {
                        <span class="na-cell">{{ p.status === 'missing' ? 'Data unavailable' : '—' }}</span>
                      }
                      @if (p.note) {
                        <div class="tiny muted">{{ p.note }}</div>
                      }
                    </td>
                    <td><aur-evidence [status]="p.status" [source]="p.source.name" /></td>
                  </tr>
                }
              </tbody>
            </table>
            <p class="tiny muted" style="margin-top: 8px">
              Catalog {{ ctx.catalogVersion() }} · hover a status for its source.
            </p>
          }
          @case ('safety') {
            <div class="col" style="gap: 8px" data-testid="detail-safety">
              @for (k of safety(); track k.key) {
                <div class="safety">
                  <span class="grow small"
                    ><b>{{ k.label }}</b></span
                  >
                  <aur-evidence status="not-assessed" [source]="k.source.name" />
                </div>
              }
              <p class="small muted note">
                No IFRA standard edition, product category, market rule set or allergen dataset is configured. Aurora
                does not infer compliance — these remain <b>Not assessed</b> until verified data is provided (Validation
                Studio, M2).
              </p>
            </div>
          }
          @case ('composition') {
            @if (d.kind === 'natural_mixture') {
              <p class="small muted note" data-testid="mixture-policy">
                <lucide-icon [img]="I.Info" [size]="14" /> {{ d.structurePolicy }}
              </p>
              <div class="section-title" style="margin: 8px 0 6px">
                Commonly reported constituents <span class="tiny muted">(qualitative · batch % not assessed)</span>
              </div>
              <ul class="constituents" data-testid="constituents">
                @for (c of d.constituents; track c.name) {
                  <li>
                    <lucide-icon [img]="I.Atom" [size]="15" />
                    <span class="grow small">{{ c.name }}</span>
                    @if (c.hasStructure && c.ingredientId) {
                      <button
                        class="btn sm soft"
                        (click)="inspect.emit(c.ingredientId)"
                        [attr.data-testid]="'inspect-' + c.name"
                      >
                        Inspect structure
                      </button>
                    } @else {
                      <span class="tiny muted">no curated structure</span>
                    }
                  </li>
                }
              </ul>
            } @else if (d.structure; as st) {
              <div class="mol"><aur-molecule-viewer [structure]="st" [tools]="false" key="detail-molecule" /></div>
              <dl class="prov" data-testid="structure-provenance">
                <dt>Compound</dt>
                <dd>{{ st.name }}</dd>
                <dt>Formula</dt>
                <dd>
                  {{ st.computedFormula }} · {{ st.computedMolecularWeight }} g/mol
                  <aur-evidence status="computed" source="Computed from SMILES by RDKit" />
                </dd>
                <dt>SMILES</dt>
                <dd class="mono">{{ st.smiles }}</dd>
                <dt>Method</dt>
                <dd class="tiny">{{ st.provenance.method }}</dd>
                <dt>Registry check</dt>
                <dd>
                  <span class="badge warn">{{ st.provenance.registryCheck }}</span>
                </dd>
              </dl>
            } @else {
              <p class="small muted note" data-testid="no-structure">{{ d.structurePolicy }}</p>
            }
          }
        }
      </div>
    } @else {
      <div class="empty">
        <lucide-icon [img]="I.Leaf" [size]="28" />
        <p class="small muted">Select an ingredient in the universe, list or search to see its details.</p>
      </div>
    }
  `,
})
export class IngredientDetailComponent {
  readonly ingredientId = input<string | null>(null);
  readonly compared = input(false);
  readonly inFormulaPct = input<string | null>(null);
  readonly initialTab = input<DetailTab>('overview');
  readonly addToFormula = output<string>();
  readonly toggleCompare = output<string>();
  readonly inspect = output<string>();
  readonly tabChange = output<DetailTab>();
  readonly ctx = inject(ProjectContextService);
  readonly I = I;
  readonly fam = fam;
  readonly role = role;
  readonly kindLabel = kindLabel;
  readonly tabs: [DetailTab, string][] = [
    ['overview', 'Overview'],
    ['properties', 'Properties'],
    ['safety', 'Safety & Regulatory'],
    ['composition', 'Composition'],
  ];
  readonly tab = signal<DetailTab>('overview');
  readonly detail = signal<IngredientDetail | null>(null);
  readonly safety = computed(() =>
    (this.detail()?.properties ?? []).filter((p) =>
      ['ifra', 'allergens', 'sustainability', 'typicalUsage'].includes(p.key),
    ),
  );

  constructor() {
    effect(() => this.tab.set(this.initialTab()));
    effect(() => this.tabChange.emit(this.tab()));
    effect(() => {
      const id = this.ingredientId();
      if (!id) {
        this.detail.set(null);
        return;
      }
      this.ctx.detail(id).then(
        (d) => {
          if (this.ingredientId() === id) this.detail.set(d);
        },
        (e) => this.ctx.reportError(e, 'Could not load ingredient'),
      );
    });
  }

  barColor(descriptor: string, family: string) {
    const f = fam(descriptor.toLowerCase());
    return f.color !== '#8f9ab3' ? f.color : fam(family).color;
  }
}
