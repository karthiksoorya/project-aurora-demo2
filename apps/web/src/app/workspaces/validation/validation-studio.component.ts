import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ApiService } from '../../core/api/api.service';
import type { CheckStatus, ValidationFinding, ValidationOptions, ValidationRun } from '../../core/models';
import { ProjectContextService } from '../../core/project-context/project-context.service';
import { WorkspaceStateService } from '../../core/workspace-state/workspace-state.service';
import { AiPartnerPanelComponent } from '../../shared/contextual-panel/ai-partner-panel.component';
import { I } from '../../shared/icons';
import { IngredientArtComponent } from '../../shared/ingredient-card/ingredient-art.component';
import { SceneArtComponent } from '../../shared/scene-art/scene-art.component';
import { StatusChipComponent } from '../../shared/status-chip/status-chip.component';

type Tab = 'checks' | 'standards' | 'evidence' | 'history';

/**
 * Validation Studio (VS-M main, VS-A AI mode, VS-E evidence expanded).
 * Every run references one immutable formula version. Only deterministic formula checks are evaluated;
 * regulatory and allergen rule sets have no verified dataset and are reported "Not assessed".
 */
@Component({
  selector: 'aur-validation-studio',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideAngularModule,
    FormsModule,
    DatePipe,
    AiPartnerPanelComponent,
    IngredientArtComponent,
    SceneArtComponent,
    StatusChipComponent,
  ],
  templateUrl: './validation-studio.component.html',
  styleUrl: './validation-studio.component.scss',
})
export class ValidationStudioComponent {
  readonly ctx = inject(ProjectContextService);
  readonly ui = inject(WorkspaceStateService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  readonly I = I;

  readonly tab = signal<Tab>('checks');
  readonly options = signal<ValidationOptions | null>(null);
  readonly runs = signal<Omit<ValidationRun, 'findings'>[]>([]);
  readonly run = signal<ValidationRun | null>(null);
  readonly versionId = signal<string | null>(null);
  readonly market = signal('EU');
  readonly category = signal('Fine fragrance (hydroalcoholic)');
  readonly ruleSetIds = signal<string[]>([]);
  readonly running = signal(false);
  readonly filter = signal<'all' | CheckStatus>('all');
  readonly q = signal('');
  readonly findingId = signal<string | null>(null);

  readonly version = computed(() => this.ctx.versions().find((v) => v.id === this.versionId()));
  readonly formulaChecks = computed(() => (this.run()?.findings ?? []).filter((f) => f.category === 'formula_check'));
  /** One row per formula line combining that line's ingredient findings. */
  readonly rows = computed(() => {
    const r = this.run();
    if (!r) return [];
    const byLine = new Map<string, ValidationFinding[]>();
    for (const f of r.findings) if (f.lineId) byLine.set(f.lineId, [...(byLine.get(f.lineId) ?? []), f]);
    const q = this.q().trim().toLowerCase();
    return [...byLine.entries()]
      .map(([lineId, fs]) => {
        const ing = this.ctx.ingredient(fs[0].ingredientId);
        const reg = fs.find((f) => f.category === 'regulatory');
        const alg = fs.find((f) => f.category === 'allergen');
        const dc = fs.find((f) => f.category === 'data_completeness');
        const worst = fs.reduce<CheckStatus>((w, f) => (rank(f.status) > rank(w) ? f.status : w), 'pass');
        return { lineId, ing, name: ing?.name ?? '?', reg, alg, dc, worst, findings: fs };
      })
      .filter(
        (x) =>
          (!q || x.name.toLowerCase().includes(q)) &&
          (this.filter() === 'all' || x.findings.some((f) => f.status === this.filter())),
      );
  });
  readonly selectedFinding = computed<ValidationFinding | null>(
    () => this.run()?.findings.find((f) => f.id === this.findingId()) ?? this.formulaChecks()[0] ?? null,
  );
  readonly passPct = computed(() => {
    const s = this.run()?.summary;
    if (!s) return 0;
    const total = s.pass + s.warning + s.fail + s.not_assessed;
    return total ? Math.round((s.pass / total) * 100) : 0;
  });
  readonly donut = computed(() => {
    const s = this.run()?.summary;
    if (!s) return [];
    const total = s.pass + s.warning + s.fail + s.not_assessed || 1;
    const parts: { k: CheckStatus; c: string }[] = [
      { k: 'pass', c: '#17a568' },
      { k: 'warning', c: '#f2b01e' },
      { k: 'fail', c: '#e0384f' },
      { k: 'not_assessed', c: '#a8b1c7' },
    ];
    let acc = 0;
    return parts.map((p) => {
      const len = (s[p.k] / total) * 100;
      const seg = { color: p.c, dash: `${len} ${100 - len}`, offset: 25 - acc };
      acc += len;
      return seg;
    });
  });
  /** Deterministic "insights" derived only from the run's own findings (no AI, no inference). */
  readonly insights = computed(() => {
    const r = this.run();
    if (!r) return [];
    const out: { icon: 'ok' | 'warn' | 'err' | 'na'; text: string }[] = [];
    const fc1 = r.findings.find((f) => f.ruleId === 'FC-001');
    if (fc1) out.push({ icon: fc1.status === 'pass' ? 'ok' : 'err', text: fc1.message });
    const dcw = r.findings.filter((f) => f.category === 'data_completeness' && f.status === 'warning').length;
    if (dcw) out.push({ icon: 'warn', text: `${dcw} ingredient(s) have unavailable or unverified catalog data` });
    for (const c of r.coverage.filter((x) => x.status === 'not_assessed'))
      out.push({ icon: 'na', text: `${c.title}: Not assessed — ${c.reason?.toLowerCase()}` });
    const hash = r.findings.find((f) => f.ruleId === 'FC-005');
    if (hash) out.push({ icon: hash.status === 'pass' ? 'ok' : 'err', text: hash.message });
    return out;
  });

  constructor() {
    void this.api.validationOptions().then((o) => {
      this.options.set(o);
      this.ruleSetIds.set(o.ruleSets.map((r) => r.id));
    });
    effect(() => {
      this.ctx.tick();
      const pid = this.ctx.projectId();
      if (pid) untracked(() => void this.loadRuns(pid));
    });
    effect(() => {
      const vs = this.ctx.versions();
      if (!untracked(this.versionId) && vs.length) this.versionId.set(vs.at(-1)!.id);
    });
  }

  private async loadRuns(pid: string, selectId?: string) {
    const runs = await this.api.validations(pid);
    this.runs.set(runs);
    if (!selectId && this.userPicks > 0) {
      // once the user has picked a version, background reloads never switch it
      const mine = runs.find((r) => r.formulaVersionId === this.versionId());
      this.run.set(mine ? await this.api.validation(mine.id) : null);
      return;
    }
    const id =
      selectId ?? this.run()?.id ?? runs.find((r) => r.formulaVersionId === this.versionId())?.id ?? runs[0]?.id;
    if (id) {
      const picks = this.userPicks;
      const r = await this.api.validation(id);
      if (!selectId && this.userPicks !== picks) return; // user picked a version meanwhile
      this.run.set(r);
      this.versionId.set(r.formulaVersionId); // the overview always shows the version the run belongs to
    } else this.run.set(null);
  }

  private userPicks = 0;
  async selectVersion(id: string) {
    this.userPicks++;
    this.versionId.set(id);
    const r = this.runs().find((x) => x.formulaVersionId === id);
    this.run.set(r ? await this.api.validation(r.id) : null);
  }
  async openRun(id: string) {
    const r = await this.api.validation(id);
    this.run.set(r);
    this.versionId.set(r.formulaVersionId);
    this.tab.set('checks');
  }
  toggleRuleSet(id: string) {
    this.ruleSetIds.update((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }
  async runValidation() {
    const vid = this.versionId();
    if (!vid) return;
    this.running.set(true);
    try {
      const r = await this.api.runValidation({
        formulaVersionId: vid,
        market: this.market(),
        category: this.category(),
        ruleSetIds: this.ruleSetIds(),
      });
      this.run.set(r);
      await this.loadRuns(r.projectId, r.id);
      void this.ctx.refreshAudit();
      this.ctx.reportInfo(`Validation run recorded for ${r.versionLabel}`);
    } catch (e) {
      this.ctx.reportError(e, 'Validation not run');
    } finally {
      this.running.set(false);
    }
  }
  showEvidence(id: string) {
    this.findingId.set(id);
    this.tab.set('evidence');
  }
  exportRun() {
    const r = this.run();
    if (!r) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' }));
    a.download = `validation-${r.versionLabel}-${r.id.slice(0, 8)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  compareVersions() {
    this.ui.patchFormula({ tab: 'compare' });
    void this.router.navigate(['/projects', this.ctx.projectId(), 'formula']);
  }
  goFormula() {
    void this.router.navigate(['/projects', this.ctx.projectId(), 'formula']);
  }
  readonly ruleSetNames = computed(() => (this.run()?.ruleSetIds ?? []).map((id) => this.ruleSetTitle(id)).join(', '));
  ruleSetTitle(id: string) {
    return this.options()?.ruleSets.find((r) => r.id === id)?.title ?? id;
  }
  inputs(f: ValidationFinding) {
    return Object.entries(f.evidence.inputs ?? {}).map(([k, v]) => [
      k,
      Array.isArray(v) ? v.join(', ') || '—' : String(v),
    ]);
  }
}

const rank = (s: CheckStatus) => ({ pass: 0, warning: 1, not_assessed: 2, fail: 3 })[s];
