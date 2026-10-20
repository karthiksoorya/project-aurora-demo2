import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import type { IngredientDetail, IngredientSummary } from '../../core/models';
import { ProjectContextService } from '../../core/project-context/project-context.service';
import { WorkspaceStateService, type IngredientsUi } from '../../core/workspace-state/workspace-state.service';
import { AiPartnerPanelComponent } from '../../shared/contextual-panel/ai-partner-panel.component';
import { FAMILIES, ROLES, fam, kindLabel, role } from '../../shared/families';
import { I } from '../../shared/icons';
import { IngredientArtComponent } from '../../shared/ingredient-card/ingredient-art.component';
import { IngredientDetailComponent } from '../../shared/ingredient-card/ingredient-detail.component';
import { SourceEvidenceComponent } from '../../shared/source-evidence/source-evidence.component';
import { IngredientUniverseComponent } from '../../visuals/ingredient-universe/ingredient-universe.component';

@Component({
  selector: 'aur-ingredient-explorer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideAngularModule,
    FormsModule,
    IngredientArtComponent,
    IngredientDetailComponent,
    IngredientUniverseComponent,
    AiPartnerPanelComponent,
    SourceEvidenceComponent,
  ],
  templateUrl: './ingredient-explorer.component.html',
  styleUrl: './ingredient-explorer.component.scss',
})
export class IngredientExplorerComponent {
  readonly ctx = inject(ProjectContextService);
  readonly ui = inject(WorkspaceStateService);
  private readonly router = inject(Router);
  readonly I = I;
  readonly fam = fam;
  readonly role = role;
  readonly roles = ROLES;
  readonly kindLabel = kindLabel;
  readonly s = this.ui.ingredients;
  readonly compareOpen = signal(false);
  readonly compareDetails = signal<IngredientDetail[]>([]);

  readonly families = computed(() => {
    const facets = this.ctx.familyFacets();
    return FAMILIES.filter((f) => facets[f.key]).map((f) => ({ ...f, count: facets[f.key] ?? 0 }));
  });

  /** Client-side filter over the (small) local catalog; identical semantics to GET /ingredients. */
  readonly filtered = computed(() => {
    const st = this.s();
    const q = st.q.trim().toLowerCase();
    return this.ctx
      .catalog()
      .filter(
        (i) =>
          (!q ||
            i.name.toLowerCase().includes(q) ||
            i.systematicName.toLowerCase().includes(q) ||
            i.descriptors.some((d) => d.toLowerCase().includes(q))) &&
          (!st.families.length || st.families.includes(i.family)) &&
          (!st.kind || i.kind === st.kind) &&
          (!st.role || i.role === st.role),
      );
  });
  readonly visibleIds = computed(() => new Set(this.filtered().map((i) => i.id)));
  readonly inFormula = computed(() => {
    const m = new Map<string, string>();
    for (const it of this.ctx.workingItems()) {
      const prev = m.get(it.ingredientId);
      m.set(it.ingredientId, prev ? (Number(prev) + Number(it.massPct)).toFixed(2) : Number(it.massPct).toFixed(2));
    }
    return m;
  });
  readonly inFormulaIds = computed(() => new Set(this.inFormula().keys()));
  readonly selected = computed(() => this.ctx.ingredient(this.ui.selectedIngredientId()));
  readonly sameFamily = computed(() => {
    const sel = this.selected();
    if (!sel) return [];
    return this.ctx.catalog().filter((i) => i.family === sel.family && i.id !== sel.id);
  });
  readonly filtersActive = computed(() => {
    const st = this.s();
    return !!(st.q || st.families.length || st.kind || st.role);
  });

  constructor() {
    // default selection so the detail panel is never empty on first visit
    if (!this.ui.selectedIngredientId()) {
      const first = this.ctx.workingItems()[0]?.ingredientId ?? this.ctx.catalog()[0]?.id;
      if (first) this.ui.selectIngredient(first);
    }
  }

  patch(p: Partial<IngredientsUi>) {
    this.ui.patchIngredients(p);
  }
  toggleFamily(key: string) {
    const f = this.s().families;
    this.patch({ families: f.includes(key) ? f.filter((x) => x !== key) : [...f, key] });
  }
  clearFilters() {
    this.patch({ q: '', families: [], kind: '', role: '' });
  }
  select(id: string) {
    this.ui.selectIngredient(id);
  }

  /** Explicit action only — selection never adds to the formula by itself (A3). */
  addToFormula(id: string) {
    const ing = this.ctx.ingredient(id);
    this.ctx.addIngredient(id);
    this.ctx.reportInfo(
      `${ing?.name ?? 'Ingredient'} added to the working draft at 0 % — set its quantity in Formula Studio.`,
    );
  }

  toggleCompare(id: string) {
    const c = this.s().compareIds;
    if (c.includes(id)) this.patch({ compareIds: c.filter((x) => x !== id) });
    else if (c.length < 4) this.patch({ compareIds: [...c, id] });
    else this.ctx.reportInfo('Compare holds up to 4 ingredients.');
  }
  async openCompare() {
    const ids = this.s().compareIds;
    this.compareDetails.set(await Promise.all(ids.map((id) => this.ctx.detail(id))));
    this.compareOpen.set(true);
  }
  addComparedToFormula() {
    for (const d of this.compareDetails()) if (!this.inFormulaIds().has(d.id)) this.ctx.addIngredient(d.id);
    this.compareOpen.set(false);
    this.ctx.reportInfo('Compared ingredients added to the working draft at 0 %.');
  }
  prop(d: IngredientDetail, key: string) {
    return d.properties.find((p) => p.key === key);
  }
  inspect(ingredientId: string) {
    this.ui.patchFormula({
      canvasMode: 'molecular',
      rightPanel: 'inspector',
      inspectorCompoundIngredientId: ingredientId,
      tab: 'builder',
      expanded: false,
    });
    void this.router.navigate(['/projects', this.ctx.projectId(), 'formula']);
  }
  goFormula() {
    void this.router.navigate(['/projects', this.ctx.projectId(), 'formula']);
  }
  trackId(_: number, i: IngredientSummary) {
    return i.id;
  }
}
