import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import type { FormulaVersion } from '../../core/models';
import { ProjectContextService } from '../../core/project-context/project-context.service';
import {
  WorkspaceStateService,
  type CanvasMode,
  type FormulaUi,
} from '../../core/workspace-state/workspace-state.service';
import { AiPartnerPanelComponent } from '../../shared/contextual-panel/ai-partner-panel.component';
import { fam, kindLabel, role } from '../../shared/families';
import { FormulaTableComponent } from '../../shared/formula-table/formula-table.component';
import { I } from '../../shared/icons';
import { IngredientArtComponent } from '../../shared/ingredient-card/ingredient-art.component';
import { Formula3dComponent, type FormulaLine } from '../../visuals/formula-3d/formula-3d.component';
import { Ingredients3dComponent } from '../../visuals/ingredients-3d/ingredients-3d.component';
import { MolecularInspectorComponent } from '../../visuals/molecular-inspector/molecular-inspector.component';
import { FormulaInsightsComponent } from './formula-insights.component';
import { IngredientLibraryComponent } from './ingredient-library.component';
import { InspirationCanvasComponent } from './inspiration-canvas.component';
import { SaveVersionDialogComponent } from './save-version-dialog.component';
import { VersionCompareComponent, VersionHistoryComponent } from './versions.component';

const CANVASES: { key: CanvasMode; label: string; icon: keyof typeof I }[] = [
  { key: 'inspiration', label: 'Inspiration Canvas', icon: 'Image' },
  { key: 'formula3d', label: '3D Formula View', icon: 'Box' },
  { key: 'ingredients3d', label: '3D Ingredients', icon: 'Network' },
  { key: 'molecular', label: 'Molecular Inspector', icon: 'Atom' },
];

/**
 * Formula Studio — one workspace, many states:
 *  FS-M1 builder · FS-M2 inspiration canvas · FS-3DF / FS-3DI 3D canvases · FS-MI1/MI2 inspector ·
 *  FS-VC version compare · FS-A / FS-M3 AI-mode panel · FS-06 expanded 3D exploration (AI Assist).
 * All share the same draft, selection, canvas mode and camera state.
 */
@Component({
  selector: 'aur-formula-studio',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    LucideAngularModule,
    AiPartnerPanelComponent,
    FormulaTableComponent,
    IngredientArtComponent,
    Formula3dComponent,
    Ingredients3dComponent,
    MolecularInspectorComponent,
    FormulaInsightsComponent,
    IngredientLibraryComponent,
    InspirationCanvasComponent,
    SaveVersionDialogComponent,
    VersionHistoryComponent,
    VersionCompareComponent,
  ],
  templateUrl: './formula-studio.component.html',
  styleUrl: './formula-studio.component.scss',
})
export class FormulaStudioComponent {
  readonly ctx = inject(ProjectContextService);
  readonly ui = inject(WorkspaceStateService);
  private readonly router = inject(Router);
  readonly I = I;
  readonly fam = fam;
  readonly role = role;
  readonly kindLabel = kindLabel;
  readonly canvases = CANVASES;
  readonly f = this.ui.formula;
  readonly saveOpen = signal(false);
  readonly menuOpen = signal<'more' | 'export' | 'analysis' | null>(null);
  readonly addOpen = signal(false);

  readonly lines = computed<FormulaLine[]>(() =>
    this.ctx
      .workingItems()
      .map((it) => ({ lineId: it.lineId, ingredient: this.ctx.ingredient(it.ingredientId)!, pct: Number(it.massPct) }))
      .filter((l) => !!l.ingredient),
  );
  readonly accords = computed(() => this.ctx.draft()?.computed.accords ?? []);
  readonly pyramid = computed(() => this.ctx.draft()?.computed.pyramid ?? null);
  readonly basedOnLabel = computed(() => {
    const id = this.ctx.draft()?.basedOnVersionId;
    return id ? (this.ctx.versions().find((v) => v.id === id)?.versionLabel ?? null) : null;
  });
  readonly selected = computed(() => this.ctx.ingredient(this.ui.selectedIngredientId()));
  readonly selectedPct = computed(() => {
    const id = this.ui.selectedIngredientId();
    const sum = this.ctx
      .workingItems()
      .filter((i) => i.ingredientId === id)
      .reduce((s, i) => s + Number(i.massPct), 0);
    return this.ctx.workingItems().some((i) => i.ingredientId === id) ? sum.toFixed(2) : null;
  });
  readonly aiOn = computed(() => this.ui.aiPanelVisible('formula'));
  /** FS-06: expanded 3D exploration while in AI Assist mode. */
  readonly explorationAi = computed(() => this.f().expanded && this.ui.mode() === 'ai');

  constructor() {
    if (!this.ui.selectedIngredientId()) {
      const first = this.ctx.workingItems()[0]?.ingredientId;
      if (first) this.ui.selectIngredient(first);
    }
  }

  patch(p: Partial<FormulaUi>) {
    this.ui.patchFormula(p);
  }
  setCanvas(c: CanvasMode) {
    // FS-MI1: the inspector's details take the right column; other canvases bring the formula table back
    this.patch({ canvasMode: c, rightPanel: c === 'molecular' ? 'inspector' : 'table' });
  }
  selectIngredient(id: string) {
    this.ui.selectIngredient(id);
    this.patch({ selectedFamily: null });
  }
  selectFamily(f: string | null) {
    this.patch({ selectedFamily: f });
  }
  onSaved(v: FormulaVersion) {
    this.saveOpen.set(false);
    this.ctx.reportInfo(`Saved ${v.versionLabel} · sha256 ${v.snapshotHash.slice(0, 12)}…`);
  }
  inspectSelected() {
    this.patch({ canvasMode: 'molecular', rightPanel: 'inspector', inspectorCompoundIngredientId: null });
  }
  openInExplorer() {
    void this.router.navigate(['/projects', this.ctx.projectId(), 'ingredients']);
  }
  goValidation() {
    void this.router.navigate(['/projects', this.ctx.projectId(), 'validation']);
  }
  removeSelectedFromFormula(lineId: string) {
    this.ctx.removeLine(lineId);
  }

  exportDraft(kind: 'json' | 'csv') {
    this.menuOpen.set(null);
    const d = this.ctx.draft();
    if (!d) return;
    const name = (this.ctx.project()?.name ?? 'formula').replace(/\W+/g, '-').toLowerCase();
    let blob: Blob;
    if (kind === 'json') {
      blob = new Blob(
        [
          JSON.stringify(
            {
              project: this.ctx.project()?.name,
              exportedAt: new Date().toISOString(),
              note: 'Working draft export (not a saved version). Synthetic demo data.',
              revision: d.revision,
              unit: '% (w/w)',
              items: d.items.map((i) => ({
                ingredient: this.ctx.ingredient(i.ingredientId)?.name,
                ingredientId: i.ingredientId,
                massPct: i.massPct,
              })),
              computed: {
                totalPct: d.computed.totalPct,
                completeness: d.computed.completeness,
                accords: d.computed.accords,
              },
            },
            null,
            2,
          ),
        ],
        { type: 'application/json' },
      );
    } else {
      const rows = [
        ['position', 'ingredient', 'ingredient_id', 'mass_pct_w_w'],
        ...d.items.map((i) => [
          String(i.position + 1),
          this.ctx.ingredient(i.ingredientId)?.name ?? '',
          i.ingredientId,
          i.massPct,
        ]),
      ];
      blob = new Blob([rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')], {
        type: 'text/csv',
      });
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${name}-draft-rev${d.revision}.${kind}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  lineOf(ingredientId: string) {
    return this.ctx.workingItems().find((i) => i.ingredientId === ingredientId);
  }

  @HostListener('document:keydown.escape')
  esc() {
    this.menuOpen.set(null);
    this.addOpen.set(false);
    if (this.f().expanded) this.patch({ expanded: false });
  }
}
