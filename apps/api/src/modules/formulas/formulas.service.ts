import { Injectable } from '@nestjs/common';
import { HUNDRED_PCT, formatPct, parsePct, shareOf } from '../../common/decimal';
import { badRequest, conflict, notFound, unprocessable } from '../../common/errors';
import { sha256Canonical } from '../../common/hash';
import { newId } from '../../common/ids';
import { currentUser } from '../../common/request-context';
import type { DraftItem, FormulaDraft, FormulaSnapshot, FormulaVersion } from '../../domain/types';
import { CatalogRepository, UnitOfWork, type AuroraTx } from '../../persistence/repositories';
import { ANY_ROLE, OWNER, requireRole } from '../access/access';
import { audit } from '../audit/audit';
import { completenessOf, computeFormula, normalize } from './formula-engine';
import type { CreateVersionDto, UpdateDraftDto } from './formula.dto';

@Injectable()
export class FormulasService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly catalog: CatalogRepository,
  ) {}

  private view(d: FormulaDraft) {
    return { ...d, computed: computeFormula(d.items, (id) => this.catalog.get(id), d.batchSizeG) };
  }

  private async requireProject(tx: AuroraTx, projectId: string, roles = ANY_ROLE, action = 'view this formula') {
    await requireRole(tx, projectId, roles, action);
    const d = await tx.drafts.getByProject(projectId);
    if (!d) throw notFound('Formula draft', projectId);
    return d;
  }

  async getDraft(projectId: string) {
    const d = await this.uow.read(async (tx) => await this.requireProject(tx, projectId));
    return this.view(d);
  }

  private validateItems(items: DraftItem[]) {
    const ids = new Set<string>();
    items.forEach((it, index) => {
      if (ids.has(it.lineId)) throw badRequest('Duplicate lineId', { index, lineId: it.lineId });
      ids.add(it.lineId);
      if (!this.catalog.get(it.ingredientId))
        throw badRequest('Unknown ingredientId', { index, ingredientId: it.ingredientId });
      if (parsePct(it.massPct) > HUNDRED_PCT)
        throw badRequest('massPct cannot exceed 100', { index, massPct: it.massPct });
    });
    // canonical ordering by position, then renumber 0..n-1; quantities canonicalised to 6 dp
    return [...items]
      .sort((a, b) => a.position - b.position)
      .map((it, position) => ({
        lineId: it.lineId,
        ingredientId: it.ingredientId,
        massPct: formatPct(parsePct(it.massPct)),
        position,
      }));
  }

  async updateDraft(projectId: string, dto: UpdateDraftDto) {
    const items = this.validateItems(dto.items);
    const d = await this.uow.write(async (tx) => {
      const cur = await this.requireProject(tx, projectId, OWNER, 'edit the formula draft');
      if (cur.revision !== dto.revision)
        throw conflict('STALE_REVISION', 'Draft was changed elsewhere; reload before saving', {
          expectedRevision: dto.revision,
          currentRevision: cur.revision,
        });
      const now = new Date().toISOString();
      const next: FormulaDraft = {
        ...cur,
        items,
        batchSizeG: dto.batchSizeG ?? cur.batchSizeG,
        revision: cur.revision + 1,
        updatedAt: now,
        updatedBy: currentUser().id,
      };
      await tx.drafts.upsert(next);
      await tx.projects.touch(projectId, now);
      return next;
    });
    return this.view(d);
  }

  async normalizeDraft(projectId: string, revision: number) {
    const d = await this.uow.write(async (tx) => {
      const cur = await this.requireProject(tx, projectId, OWNER, 'normalise the formula');
      if (cur.revision !== revision)
        throw conflict('STALE_REVISION', 'Draft was changed elsewhere', {
          expectedRevision: revision,
          currentRevision: cur.revision,
        });
      let items: DraftItem[];
      try {
        items = normalize(cur.items);
      } catch {
        throw unprocessable('CANNOT_NORMALIZE', 'Formula total is 0 % — nothing to normalise');
      }
      const now = new Date().toISOString();
      const next = { ...cur, items, revision: cur.revision + 1, updatedAt: now };
      await tx.drafts.upsert(next);
      await audit(
        tx,
        projectId,
        'draft.normalized',
        'formula_draft',
        cur.id,
        {
          fromTotal: computeFormula(cur.items, (id) => this.catalog.get(id), cur.batchSizeG).totalPct,
          revision: next.revision,
        },
        now,
      );
      return next;
    });
    return this.view(d);
  }

  async createVersion(projectId: string, dto: CreateVersionDto) {
    return this.uow.write(async (tx) => {
      const draft = await this.requireProject(tx, projectId, OWNER, 'save formula versions');
      if (draft.revision !== dto.expectedDraftRevision)
        throw conflict('STALE_REVISION', 'Draft changed since you opened the save dialog', {
          expectedRevision: dto.expectedDraftRevision,
          currentRevision: draft.revision,
        });
      const label = dto.versionLabel.trim();
      const existing = await tx.versions.listByProject(projectId);
      if (existing.some((v) => v.versionLabel.toLowerCase() === label.toLowerCase()))
        throw conflict('DUPLICATE_VERSION_LABEL', `Version label "${label}" already exists`, { versionLabel: label });
      const parentVersionId = dto.parentVersionId ?? draft.basedOnVersionId ?? null;
      if (parentVersionId && !existing.some((v) => v.id === parentVersionId))
        throw badRequest('parentVersionId does not belong to this project', { parentVersionId });
      if (draft.items.length === 0) throw unprocessable('EMPTY_FORMULA', 'Cannot save a version with no ingredients');

      const computed = computeFormula(draft.items, (id) => this.catalog.get(id), draft.batchSizeG);
      const snapshot: FormulaSnapshot = {
        projectId,
        versionLabel: label,
        note: dto.note?.trim() ?? '',
        parentVersionId,
        sourceDraftRevision: draft.revision,
        batchSizeG: draft.batchSizeG,
        unit: 'mass_pct_w_w',
        items: draft.items.map((it) => {
          const ing = this.catalog.get(it.ingredientId)!;
          return {
            lineId: it.lineId,
            ingredientId: it.ingredientId,
            ingredientName: ing.name,
            kind: ing.kind,
            family: ing.family,
            role: ing.role,
            massPct: it.massPct,
            position: it.position,
          };
        }),
        totalPct: computed.totalPct,
        completeness: computed.completeness === 'empty' ? 'incomplete' : computed.completeness,
        catalogVersion: this.catalog.version(),
      };
      const now = new Date().toISOString();
      const version: FormulaVersion = {
        id: newId(),
        projectId,
        versionLabel: label,
        snapshot,
        snapshotHash: sha256Canonical(snapshot),
        hashAlgorithm: 'sha256-canonical-json-v1',
        savedBy: currentUser().id,
        savedAt: now,
      };
      await tx.versions.insert(version);
      // the draft continues from the version it just produced
      await tx.drafts.upsert({ ...draft, basedOnVersionId: version.id, updatedAt: now });
      await tx.projects.touch(projectId, now);
      await audit(
        tx,
        projectId,
        'version.saved',
        'formula_version',
        version.id,
        {
          versionLabel: label,
          snapshotHash: version.snapshotHash,
          parentVersionId,
          totalPct: snapshot.totalPct,
          completeness: snapshot.completeness,
        },
        now,
      );
      return version;
    });
  }

  async listVersions(projectId: string) {
    return this.uow.read(async (tx) => {
      await requireRole(tx, projectId, ANY_ROLE, 'view versions');
      return (await tx.versions.listByProject(projectId)).map((v) => ({
        id: v.id,
        versionLabel: v.versionLabel,
        parentVersionId: v.snapshot.parentVersionId,
        savedAt: v.savedAt,
        savedBy: v.savedBy,
        totalPct: v.snapshot.totalPct,
        completeness: v.snapshot.completeness,
        lineCount: v.snapshot.items.length,
        snapshotHash: v.snapshotHash,
        note: v.snapshot.note,
      }));
    });
  }

  async getVersion(versionId: string) {
    const v = await this.uow.read(async (tx) => {
      const found = await tx.versions.get(versionId);
      if (found) await requireRole(tx, found.projectId, ANY_ROLE, 'view versions');
      return found;
    });
    if (!v) throw notFound('Formula version', versionId);
    return { ...v, hashVerified: sha256Canonical(v.snapshot) === v.snapshotHash };
  }

  async compare(leftId: string, rightId: string) {
    const [l, r] = await Promise.all([this.getVersion(leftId), this.getVersion(rightId)]);
    if (l.projectId !== r.projectId)
      throw unprocessable('CROSS_PROJECT_COMPARE', 'Versions belong to different projects');
    const agg = (v: FormulaVersion) => {
      const m = new Map<string, { name: string; family: string; role: string; sum: bigint; firstPos: number }>();
      for (const it of v.snapshot.items) {
        const e = m.get(it.ingredientId);
        if (e) e.sum += parsePct(it.massPct);
        else
          m.set(it.ingredientId, {
            name: it.ingredientName,
            family: it.family,
            role: it.role,
            sum: parsePct(it.massPct),
            firstPos: it.position,
          });
      }
      return m;
    };
    const L = agg(l);
    const R = agg(r);
    const ids = [...new Set([...L.keys(), ...R.keys()])].sort((a, b) => {
      const pa = L.get(a)?.firstPos ?? 1000 + (R.get(a)?.firstPos ?? 0);
      const pb = L.get(b)?.firstPos ?? 1000 + (R.get(b)?.firstPos ?? 0);
      return pa - pb;
    });
    const rows = ids.map((id) => {
      const a = L.get(id);
      const b = R.get(id);
      const lv = a?.sum ?? 0n;
      const rv = b?.sum ?? 0n;
      const delta = rv - lv;
      return {
        ingredientId: id,
        ingredientName: (a ?? b)!.name,
        family: (a ?? b)!.family,
        role: (a ?? b)!.role,
        leftPct: a ? formatPct(lv) : null,
        rightPct: b ? formatPct(rv) : null,
        deltaPct: formatPct(delta),
        change: !a ? 'added' : !b ? 'removed' : delta === 0n ? 'unchanged' : 'changed',
      };
    });
    const famSums = (m: ReturnType<typeof agg>) => {
      const f = new Map<string, bigint>();
      let t = 0n;
      for (const e of m.values()) {
        f.set(e.family, (f.get(e.family) ?? 0n) + e.sum);
        t += e.sum;
      }
      return { f, t };
    };
    const FL = famSums(L);
    const FR = famSums(R);
    const families = [...new Set([...FL.f.keys(), ...FR.f.keys()])].sort();
    const head = (v: typeof l) => ({
      id: v.id,
      versionLabel: v.versionLabel,
      savedAt: v.savedAt,
      snapshotHash: v.snapshotHash,
      hashVerified: v.hashVerified,
      totalPct: v.snapshot.totalPct,
      completeness: v.snapshot.completeness,
    });
    const pyr = (m: ReturnType<typeof agg>) => {
      const t: Record<string, bigint> = { top: 0n, heart: 0n, base: 0n };
      let total = 0n;
      for (const e of m.values()) {
        t[e.role] = (t[e.role] ?? 0n) + e.sum;
        total += e.sum;
      }
      return Object.fromEntries(
        Object.entries(t).map(([k, v]) => [k, { massPct: formatPct(v), sharePct: shareOf(v, total) }]),
      );
    };
    return {
      left: head(l),
      right: head(r),
      pyramid: { left: pyr(L), right: pyr(R) },
      basis: 'Computed from saved immutable snapshots only (draft is never used).',
      rows,
      accords: families.map((family) => ({
        family,
        leftSharePct: shareOf(FL.f.get(family) ?? 0n, FL.t),
        rightSharePct: shareOf(FR.f.get(family) ?? 0n, FR.t),
      })),
      summary: {
        added: rows.filter((x) => x.change === 'added').length,
        removed: rows.filter((x) => x.change === 'removed').length,
        changed: rows.filter((x) => x.change === 'changed').length,
        unchanged: rows.filter((x) => x.change === 'unchanged').length,
      },
    };
  }

  async branch(versionId: string, expectedDraftRevision?: number) {
    const d = await this.uow.write(async (tx) => {
      const v = await tx.versions.get(versionId);
      if (!v) throw notFound('Formula version', versionId);
      const draft = await this.requireProject(tx, v.projectId, OWNER, 'load a version into the draft');
      if (expectedDraftRevision !== undefined && draft.revision !== expectedDraftRevision)
        throw conflict('STALE_REVISION', 'Draft changed; reload before loading a version', {
          expectedRevision: expectedDraftRevision,
          currentRevision: draft.revision,
        });
      const now = new Date().toISOString();
      const next: FormulaDraft = {
        ...draft,
        basedOnVersionId: v.id,
        batchSizeG: v.snapshot.batchSizeG,
        items: v.snapshot.items.map((it) => ({
          lineId: newId(),
          ingredientId: it.ingredientId,
          massPct: it.massPct,
          position: it.position,
        })),
        revision: draft.revision + 1,
        updatedAt: now,
        updatedBy: currentUser().id,
      };
      await tx.drafts.upsert(next);
      await audit(
        tx,
        v.projectId,
        'draft.branched_from_version',
        'formula_version',
        v.id,
        {
          versionLabel: v.versionLabel,
          previousDraftRevision: draft.revision,
          revision: next.revision,
        },
        now,
      );
      return next;
    });
    return this.view(d);
  }

  /** exposed for tests */
  static completeness = completenessOf;
}
