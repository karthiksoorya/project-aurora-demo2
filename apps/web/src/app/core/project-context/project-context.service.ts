import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService, isApiError } from '../api/api.service';
import { ToastService } from '../errors/toast.service';
import type {
  ApiError,
  AuditEvent,
  Brief,
  BriefContent,
  DraftItem,
  DraftView,
  IngredientDetail,
  IngredientSummary,
  ProjectDetail,
  ProjectSummary,
  VersionSummary,
} from '../models';

export const PCT_INPUT_RE = /^\d{1,3}(\.\d{1,6})?$/;

const uuid = () => crypto.randomUUID();
const sameItems = (a: DraftItem[], b: DraftItem[]) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Project context: the current project, its creative brief (with a local editable copy),
 * the ingredient catalog, the formula draft and saved versions.
 *
 * Formula rules: the client edits *items* only. Totals, accords, completeness and all issues are
 * computed by the NestJS formula engine and shown from the last server response. Edits are
 * auto-saved to the server draft through a serialized queue carrying the draft revision.
 */
@Injectable({ providedIn: 'root' })
export class ProjectContextService {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly projects = signal<ProjectSummary[]>([]);
  readonly projectId = signal<string | null>(null);
  readonly project = signal<ProjectDetail | null>(null);
  readonly loadError = signal<ApiError | null>(null);

  // ---- brief ----
  readonly brief = signal<Brief | null>(null);
  readonly briefEdit = signal<BriefContent | null>(null);
  readonly briefDirty = computed(() => {
    const b = this.brief();
    const e = this.briefEdit();
    return !!b && !!e && JSON.stringify(b.content) !== JSON.stringify(e);
  });
  readonly briefSaving = signal(false);

  // ---- catalog ----
  readonly catalog = signal<IngredientSummary[]>([]);
  readonly catalogVersion = signal('');
  readonly familyFacets = signal<Record<string, number>>({});
  private readonly details = new Map<string, Promise<IngredientDetail>>();
  readonly byId = computed(() => new Map(this.catalog().map((i) => [i.id, i])));

  // ---- formula draft ----
  readonly draft = signal<DraftView | null>(null);
  /** Items as currently shown/edited (may be ahead of the server while a save is in flight). */
  readonly workingItems = signal<DraftItem[]>([]);
  /** Raw text of quantity inputs that are not (yet) valid decimals, keyed by lineId. */
  readonly invalidInputs = signal<Partial<Record<string, string>>>({});
  readonly draftSaving = signal(false);
  readonly computedStale = computed(() => {
    const d = this.draft();
    return !!d && (!sameItems(d.items, this.workingItems()) || Object.keys(this.invalidInputs()).length > 0);
  });
  readonly versions = signal<VersionSummary[]>([]);
  readonly audit = signal<AuditEvent[]>([]);

  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private saving: Promise<void> | null = null;

  async init() {
    const [projects, cat] = await Promise.all([this.api.projects(), this.api.catalog()]);
    this.projects.set(projects);
    this.catalog.set(cat.items);
    this.catalogVersion.set(cat.catalogVersion);
    this.familyFacets.set(cat.facets.family);
    return projects;
  }

  private opening: { id: string; p: Promise<void> } | null = null;
  async open(projectId: string) {
    if (this.projectId() === projectId && this.project()) return;
    if (this.opening?.id === projectId) return this.opening.p;
    const p = this.doOpen(projectId).finally(() => (this.opening = null));
    this.opening = { id: projectId, p };
    return p;
  }
  private async doOpen(projectId: string) {
    await this.flushDraft();
    this.projectId.set(projectId);
    this.loadError.set(null);
    try {
      const [p, b, d, v] = await Promise.all([
        this.api.project(projectId),
        this.api.brief(projectId),
        this.api.draft(projectId),
        this.api.versions(projectId),
      ]);
      this.project.set(p);
      this.brief.set(b);
      this.briefEdit.set(structuredClone(b.content));
      this.setDraft(d);
      this.versions.set(v);
      void this.refreshAudit();
    } catch (e) {
      this.loadError.set(isApiError(e) ? e : null);
      throw e;
    }
  }

  async refreshProjects() {
    this.projects.set(await this.api.projects());
  }
  async refreshAudit() {
    const id = this.projectId();
    if (id) this.audit.set(await this.api.audit(id, 30));
  }
  async createProject(name: string) {
    const p = await this.api.createProject(name);
    await this.refreshProjects();
    return p;
  }

  ingredient(id: string | null | undefined) {
    return id ? this.byId().get(id) : undefined;
  }
  detail(id: string): Promise<IngredientDetail> {
    let p = this.details.get(id);
    if (!p) {
      p = this.api.ingredient(id);
      this.details.set(id, p);
      p.catch(() => this.details.delete(id));
    }
    return p;
  }

  // ------------------------------------------------------------------ brief
  patchBrief(p: Partial<BriefContent>) {
    this.briefEdit.update((b) => (b ? { ...b, ...p } : b));
  }
  discardBrief() {
    const b = this.brief();
    if (b) this.briefEdit.set(structuredClone(b.content));
  }
  async saveBrief(): Promise<boolean> {
    const id = this.projectId();
    const b = this.brief();
    const content = this.briefEdit();
    if (!id || !b || !content) return false;
    this.briefSaving.set(true);
    try {
      const saved = await this.api.saveBrief(id, b.revision, content);
      this.brief.set(saved);
      this.briefEdit.set(structuredClone(saved.content));
      this.toast.ok(`Brief saved (revision ${saved.revision})`);
      void this.refreshAudit();
      void this.refreshProjectHeader();
      return true;
    } catch (e) {
      this.reportError(e, 'Could not save brief');
      if (isApiError(e) && e.code === 'STALE_REVISION')
        this.toast.warn('Brief changed elsewhere — your edits are kept; reload to compare.');
      return false;
    } finally {
      this.briefSaving.set(false);
    }
  }
  async uploadFile(file: File) {
    const id = this.projectId();
    if (!id) throw new Error('No project');
    return this.api.upload(id, file);
  }
  uploadUrl(uploadId: string) {
    return this.api.uploadUrl(uploadId);
  }

  // ------------------------------------------------------------------ formula draft
  private setDraft(d: DraftView) {
    this.draft.set(d);
    this.workingItems.set(structuredClone(d.items));
    this.invalidInputs.set({});
  }

  addIngredient(ingredientId: string, massPct = '0.000000') {
    const items = this.workingItems();
    const line: DraftItem = { lineId: uuid(), ingredientId, massPct, position: items.length };
    this.workingItems.set([...items, line]);
    this.scheduleSave(0);
    return line.lineId;
  }
  removeLine(lineId: string) {
    this.workingItems.set(
      this.workingItems()
        .filter((i) => i.lineId !== lineId)
        .map((i, position) => ({ ...i, position })),
    );
    this.invalidInputs.update((m) => {
      const { [lineId]: _drop, ...rest } = m;
      return rest;
    });
    this.scheduleSave(0);
  }
  moveLine(lineId: string, dir: -1 | 1) {
    const items = [...this.workingItems()];
    const i = items.findIndex((x) => x.lineId === lineId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    this.workingItems.set(items.map((x, position) => ({ ...x, position })));
    this.scheduleSave(0);
  }
  /** Quantity text from an input. Valid decimals are queued for save; invalid text is held and flagged. */
  setQuantity(lineId: string, raw: string) {
    let v = raw.trim();
    if (/^\d{1,3}\.$/.test(v)) v = v.slice(0, -1); // "12." while typing == 12
    if (!PCT_INPUT_RE.test(v) || Number(v) > 100) {
      this.invalidInputs.update((m) => ({ ...m, [lineId]: raw }));
      return false;
    }
    this.invalidInputs.update((m) => {
      const { [lineId]: _drop, ...rest } = m;
      return rest;
    });
    this.workingItems.update((items) => items.map((i) => (i.lineId === lineId ? { ...i, massPct: v } : i)));
    this.scheduleSave();
    return true;
  }
  setBatchSize(g: string) {
    const d = this.draft();
    if (!d || !/^\d{1,6}(\.\d{1,3})?$/.test(g) || Number(g) <= 0) return false;
    this.draft.set({ ...d, batchSizeG: g });
    this.scheduleSave(0, g);
    return true;
  }

  private pendingBatch: string | undefined;
  private scheduleSave(ms = 350, batch?: string) {
    if (batch) this.pendingBatch = batch;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.pump();
    }, ms);
  }

  /** Serialized save loop: always sends the latest working items with the latest known revision. */
  private async pump(): Promise<void> {
    if (this.saving) return this.saving;
    this.saving = (async () => {
      // yield first so `this.saving` is assigned before the finally-block can reset it
      await Promise.resolve();
      this.draftSaving.set(true);
      try {
        for (;;) {
          const d = this.draft();
          const pid = this.projectId();
          if (!d || !pid) break;
          const items = this.workingItems();
          const batch = this.pendingBatch;
          if (sameItems(items, d.items) && !batch) break;
          this.pendingBatch = undefined;
          try {
            const next = await this.api.saveDraft(pid, d.revision, items, batch);
            const newer = !sameItems(this.workingItems(), items);
            this.draft.set(next);
            if (!newer) this.workingItems.set(structuredClone(next.items));
          } catch (e) {
            if (isApiError(e) && e.code === 'STALE_REVISION') {
              this.toast.warn('The draft was changed elsewhere. Loaded the latest saved draft.');
              this.setDraft(await this.api.draft(pid));
            } else {
              this.reportError(e, 'Draft not saved');
              this.workingItems.set(structuredClone(d.items));
            }
            break;
          }
        }
      } finally {
        this.draftSaving.set(false);
        this.saving = null;
      }
    })();
    return this.saving;
  }

  /** Wait until all queued edits reached the server. */
  async flushDraft() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await this.pump();
  }

  async normalize() {
    await this.flushDraft();
    const d = this.draft();
    const pid = this.projectId();
    if (!d || !pid) return;
    try {
      this.setDraft(await this.api.normalize(pid, d.revision));
      this.toast.ok('Normalised to exactly 100 % (explicit action, audited)');
      void this.refreshAudit();
    } catch (e) {
      this.reportError(e, 'Could not normalise');
    }
  }

  async saveVersion(versionLabel: string, note: string) {
    await this.flushDraft();
    const d = this.draft();
    const pid = this.projectId();
    if (!d || !pid) throw new Error('No draft');
    const v = await this.api.saveVersion(pid, {
      expectedDraftRevision: d.revision,
      versionLabel,
      note: note || undefined,
    });
    this.draft.set({ ...d, basedOnVersionId: v.id });
    this.versions.set(await this.api.versions(pid));
    void this.refreshAudit();
    void this.refreshProjectHeader();
    return v;
  }

  async loadVersionIntoDraft(versionId: string) {
    await this.flushDraft();
    const d = this.draft();
    if (!d) return;
    try {
      this.setDraft(await this.api.branch(versionId, d.revision));
      void this.refreshAudit();
      this.toast.ok('Version loaded into the working draft');
    } catch (e) {
      this.reportError(e, 'Could not load version');
    }
  }

  suggestVersionLabel() {
    const labels = new Set(this.versions().map((v) => v.versionLabel.toLowerCase()));
    let n = this.versions().length + 1;
    while (labels.has(`v${n}`)) n++;
    return `V${n}`;
  }

  private async refreshProjectHeader() {
    const id = this.projectId();
    if (!id) return;
    this.project.set(await this.api.project(id));
    void this.refreshProjects();
  }

  reportInfo(text: string) {
    this.toast.info(text);
  }

  reportError(e: unknown, prefix: string) {
    const msg = isApiError(e) ? `${e.message}${e.code ? ` (${e.code})` : ''}` : String(e);
    this.toast.err(`${prefix}: ${msg}`);
  }
}
