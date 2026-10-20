import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ApiService } from '../../core/api/api.service';
import type { Experiment, FormulaVersion, Lineage, ObservationKind } from '../../core/models';
import { ProjectContextService } from '../../core/project-context/project-context.service';
import { WorkspaceStateService } from '../../core/workspace-state/workspace-state.service';
import { AiPartnerPanelComponent } from '../../shared/contextual-panel/ai-partner-panel.component';
import { fam, role } from '../../shared/families';
import { I } from '../../shared/icons';
import { IngredientArtComponent } from '../../shared/ingredient-card/ingredient-art.component';
import { SceneArtComponent } from '../../shared/scene-art/scene-art.component';
import { StatusChipComponent } from '../../shared/status-chip/status-chip.component';
import { VersionCompareComponent } from '../formula/versions.component';
import { LineageGraphComponent } from './lineage-graph.component';

type Tab = 'history' | 'branching' | 'compare' | 'notes';

/**
 * Experiment Explorer (EE-M1 history, EE-A AI mode, EE-X expanded branching canvas).
 * Experiments reference exact saved versions; observations are typed (observation / measurement / hypothesis).
 * No performance figures are shown unless a scientist recorded them as measurements.
 */
@Component({
  selector: 'aur-experiment-explorer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideAngularModule,
    FormsModule,
    DatePipe,
    AiPartnerPanelComponent,
    IngredientArtComponent,
    SceneArtComponent,
    StatusChipComponent,
    LineageGraphComponent,
    VersionCompareComponent,
  ],
  templateUrl: './experiment-explorer.component.html',
  styleUrl: './experiment-explorer.component.scss',
})
export class ExperimentExplorerComponent {
  readonly ctx = inject(ProjectContextService);
  readonly ui = inject(WorkspaceStateService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  readonly I = I;
  readonly fam = fam;
  readonly role = role;

  readonly tab = signal<Tab>('history');
  readonly experiments = signal<Experiment[]>([]);
  readonly lineage = signal<Lineage | null>(null);
  readonly selectedId = signal<string | null>(null);
  readonly selectedVersionId = signal<string | null>(null);
  readonly snapshot = signal<FormulaVersion | null>(null);
  readonly q = signal('');
  readonly statusFilter = signal<'' | Experiment['status']>('');
  readonly kindFilter = signal<'' | ObservationKind>('');
  readonly newOpen = signal(false);
  readonly form = signal({ formulaVersionId: '', title: '', objective: '', method: '', conditions: '' });
  readonly obs = signal({
    kind: 'observation' as ObservationKind,
    text: '',
    quantity: '',
    value: '',
    unit: '',
    method: '',
  });
  readonly busy = signal(false);

  readonly canObserve = computed(() => this.ctx.myRole() !== 'viewer');
  readonly filtered = computed(() => {
    const q = this.q().trim().toLowerCase();
    return this.experiments().filter(
      (e) =>
        (!q || e.title.toLowerCase().includes(q) || e.versionLabel.toLowerCase().includes(q)) &&
        (!this.statusFilter() || e.status === this.statusFilter()),
    );
  });
  readonly selected = computed(() => this.experiments().find((e) => e.id === this.selectedId()) ?? null);
  readonly selectedNode = computed(() => this.lineage()?.nodes.find((n) => n.id === this.selectedVersionId()) ?? null);
  readonly allNotes = computed(() =>
    this.experiments()
      .flatMap((e) => e.observations.map((o) => ({ ...o, experiment: e.title, versionLabel: e.versionLabel })))
      .filter((o) => !this.kindFilter() || o.kind === this.kindFilter())
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)),
  );
  readonly versionExperiments = computed(() =>
    this.experiments().filter((e) => e.formulaVersionId === this.selectedVersionId()),
  );

  constructor() {
    effect(() => {
      this.ctx.tick();
      const pid = this.ctx.projectId();
      if (pid) untracked(() => void this.load(pid));
    });
    effect(() => {
      const vid = this.selectedVersionId();
      if (!vid) return this.snapshot.set(null);
      void this.api.version(vid).then((v) => {
        if (this.selectedVersionId() === vid) this.snapshot.set(v);
      });
    });
  }

  private async load(pid: string) {
    const [exps, lin] = await Promise.all([this.api.experiments(pid), this.api.lineage(pid)]);
    this.experiments.set(exps);
    this.lineage.set(lin);
    if (!this.selectedId() || !exps.some((e) => e.id === this.selectedId())) this.selectedId.set(exps[0]?.id ?? null);
    const sel = exps.find((e) => e.id === this.selectedId());
    if (!this.selectedVersionId()) this.selectedVersionId.set(sel?.formulaVersionId ?? lin.nodes.at(-1)?.id ?? null);
  }

  selectExperiment(e: Experiment) {
    this.selectedId.set(e.id);
    this.selectedVersionId.set(e.formulaVersionId);
  }
  selectVersion(id: string) {
    this.selectedVersionId.set(id);
    const e = this.experiments().find((x) => x.formulaVersionId === id);
    if (e) this.selectedId.set(e.id);
  }

  openNew(versionId?: string) {
    const v = versionId ?? this.selectedVersionId() ?? this.ctx.versions().at(-1)?.id ?? '';
    this.form.set({ formulaVersionId: v, title: '', objective: '', method: '', conditions: '' });
    this.newOpen.set(true);
  }
  patchForm(p: Partial<ReturnType<typeof this.form>>) {
    this.form.update((f) => ({ ...f, ...p }));
  }
  async createExperiment() {
    const f = this.form();
    this.busy.set(true);
    try {
      const e = await this.api.createExperiment({
        formulaVersionId: f.formulaVersionId,
        title: f.title,
        protocol: { objective: f.objective, method: f.method, conditions: f.conditions },
      });
      this.newOpen.set(false);
      await this.load(e.projectId);
      this.selectExperiment(e);
      this.tab.set('history');
      void this.ctx.refreshAudit();
    } catch (e) {
      this.ctx.reportError(e, 'Experiment not created');
    } finally {
      this.busy.set(false);
    }
  }
  patchObs(p: Partial<ReturnType<typeof this.obs>>) {
    this.obs.update((o) => ({ ...o, ...p }));
  }
  async addObservation() {
    const e = this.selected();
    const o = this.obs();
    if (!e || !o.text.trim()) return;
    this.busy.set(true);
    try {
      const next = await this.api.addObservation(e.id, {
        kind: o.kind,
        text: o.text,
        measurement:
          o.kind === 'measurement'
            ? { quantity: o.quantity, value: o.value, unit: o.unit, method: o.method }
            : undefined,
      });
      this.experiments.update((xs) => xs.map((x) => (x.id === next.id ? next : x)));
      this.obs.update((cur) => ({
        ...cur,
        text: cur.text === o.text ? '' : cur.text,
        quantity: '',
        value: '',
        unit: '',
        method: '',
      }));
      void this.api.lineage(e.projectId).then((l) => this.lineage.set(l));
      void this.ctx.refreshAudit();
    } catch (err) {
      this.ctx.reportError(err, 'Observation not saved');
    } finally {
      this.busy.set(false);
    }
  }
  async setStatus(status: Experiment['status']) {
    const e = this.selected();
    if (!e) return;
    try {
      const next = await this.api.setExperimentStatus(e.id, status);
      this.experiments.update((xs) => xs.map((x) => (x.id === next.id ? next : x)));
    } catch (err) {
      this.ctx.reportError(err, 'Status not changed');
    }
  }
  /** "Create branch": load the version into the working draft; the next saved version records it as parent. */
  async createBranch(versionId: string) {
    await this.ctx.loadVersionIntoDraft(versionId);
    this.ui.patchFormula({ tab: 'builder' });
    void this.router.navigate(['/projects', this.ctx.projectId(), 'formula']);
  }
  compareWithParent(versionId: string) {
    const n = this.lineage()?.nodes.find((x) => x.id === versionId);
    if (!n?.parentVersionId) return;
    this.ui.patchFormula({ compareLeftId: n.parentVersionId, compareRightId: n.id });
    this.tab.set('compare');
  }
  initials(name: string) {
    return name
      .split(' ')
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }
  parentLabel(id: string | null) {
    return id ? (this.lineage()?.nodes.find((x) => x.id === id)?.versionLabel ?? id.slice(0, 8)) : '— (root)';
  }
  measurementValid() {
    const o = this.obs();
    return o.kind !== 'measurement' || (!!o.quantity.trim() && !!o.value.trim() && !!o.method.trim());
  }
}
