/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return --
   row mappers: SQL rows are untyped by nature; each mapper below is the single typed boundary. */
import type { PoolClient } from 'pg';
import type {
  AuditEvent,
  Brief,
  Experiment,
  FormulaDraft,
  FormulaVersion,
  Membership,
  Observation,
  Project,
  ReviewRequest,
  Upload,
  ValidationRun,
} from '../../domain/types';
import type { AuroraTx } from '../repositories';

type Row = Record<string, any>;

/** Escape LIKE wildcards so an action prefix is matched literally. */
const likePrefix = (s: string) => `${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

const toProject = (r: Row): Project => ({
  id: r.id,
  name: r.name,
  status: r.status,
  summary: r.summary,
  createdBy: r.created_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const toVersion = (r: Row): FormulaVersion => ({
  id: r.id,
  projectId: r.project_id,
  versionLabel: r.version_label,
  snapshot: r.snapshot,
  snapshotHash: r.snapshot_hash,
  hashAlgorithm: r.hash_algorithm,
  savedBy: r.saved_by,
  savedAt: r.saved_at,
});
const toAudit = (r: Row): AuditEvent => ({
  id: r.id,
  projectId: r.project_id,
  actorId: r.actor_id,
  actorName: r.actor_name,
  action: r.action,
  targetType: r.target_type,
  targetId: r.target_id,
  payload: r.payload,
  occurredAt: r.occurred_at,
});
const toValidation = (r: Row): ValidationRun => ({
  id: r.id,
  projectId: r.project_id,
  formulaVersionId: r.formula_version_id,
  versionLabel: r.version_label,
  snapshotHash: r.snapshot_hash,
  market: r.market,
  productCategory: r.product_category,
  ruleSetIds: r.rule_set_ids,
  status: r.status,
  summary: r.summary,
  coverage: r.coverage,
  findings: r.findings,
  evaluatedBy: r.evaluated_by,
  evaluatedAt: r.evaluated_at,
  engineVersion: r.engine_version,
});
const toObservation = (r: Row): Observation => ({
  id: r.id,
  kind: r.kind,
  text: r.text,
  ...(r.measurement ? { measurement: r.measurement } : {}),
  recordedBy: r.recorded_by,
  recordedByName: r.recorded_by_name,
  recordedAt: r.recorded_at,
});

/**
 * PostgreSQL implementation of the repository contract, bound to one client/transaction.
 * Child collections (draft lines, observations, reviewers, comments, decisions) live in their own tables;
 * the domain objects are re-assembled here so services stay storage-agnostic.
 */
export function pgRepositories(c: PoolClient): AuroraTx {
  const q = async (sql: string, params: unknown[] = []) => (await c.query(sql, params)).rows as Row[];
  const one = async (sql: string, params: unknown[] = []) => (await q(sql, params))[0];
  const json = (v: unknown) => JSON.stringify(v);

  const experimentsWhere = async (where: string, params: unknown[]): Promise<Experiment[]> => {
    const exps = await q(`SELECT * FROM experiments WHERE ${where} ORDER BY created_at DESC, id`, params);
    if (!exps.length) return [];
    const obs = await q('SELECT * FROM experiment_observations WHERE experiment_id = ANY($1) ORDER BY seq', [
      exps.map((e) => e.id),
    ]);
    return exps.map((e) => ({
      id: e.id,
      projectId: e.project_id,
      formulaVersionId: e.formula_version_id,
      versionLabel: e.version_label,
      title: e.title,
      protocol: e.protocol,
      status: e.status,
      observations: obs.filter((o) => o.experiment_id === e.id).map(toObservation),
      createdBy: e.created_by,
      createdAt: e.created_at,
    }));
  };

  const reviewsWhere = async (where: string, params: unknown[]): Promise<ReviewRequest[]> => {
    const revs = await q(`SELECT * FROM review_requests WHERE ${where} ORDER BY created_at DESC, id`, params);
    if (!revs.length) return [];
    const ids = [revs.map((r) => r.id)];
    const [reviewers, comments, decisions] = await Promise.all([
      q('SELECT * FROM review_reviewers WHERE review_id = ANY($1) ORDER BY position', ids),
      q('SELECT * FROM review_comments WHERE review_id = ANY($1) ORDER BY seq', ids),
      q('SELECT * FROM review_decisions WHERE review_id = ANY($1) ORDER BY seq', ids),
    ]);
    return revs.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      formulaVersionId: r.formula_version_id,
      versionLabel: r.version_label,
      snapshotHash: r.snapshot_hash,
      title: r.title,
      message: r.message,
      status: r.status,
      reviewers: reviewers
        .filter((x) => x.review_id === r.id)
        .map((x) => ({ userId: x.user_id, permission: x.permission })),
      comments: comments
        .filter((x) => x.review_id === r.id)
        .map((x) => ({
          id: x.id,
          authorId: x.author_id,
          authorName: x.author_name,
          comment: x.comment,
          kind: x.kind,
          createdAt: x.created_at,
        })),
      decisions: decisions
        .filter((x) => x.review_id === r.id)
        .map((x) => ({
          id: x.id,
          userId: x.user_id,
          userName: x.user_name,
          decision: x.decision,
          reason: x.reason,
          decidedAt: x.decided_at,
        })),
      requestedBy: r.requested_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  };

  const writeReviewChildren = async (r: ReviewRequest) => {
    for (const [i, x] of r.reviewers.entries())
      await q(
        `INSERT INTO review_reviewers (review_id, user_id, permission, position) VALUES ($1,$2,$3,$4)
         ON CONFLICT (review_id, user_id) DO UPDATE SET permission = EXCLUDED.permission, position = EXCLUDED.position`,
        [r.id, x.userId, x.permission, i],
      );
    for (const x of r.comments)
      await q(
        `INSERT INTO review_comments (id, review_id, author_id, author_name, comment, kind, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
        [x.id, r.id, x.authorId, x.authorName, x.comment, x.kind, x.createdAt],
      );
    for (const x of r.decisions)
      await q(
        `INSERT INTO review_decisions (id, review_id, user_id, user_name, decision, reason, decided_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
        [x.id, r.id, x.userId, x.userName, x.decision, x.reason, x.decidedAt],
      );
  };

  const writeObservations = async (e: Experiment) => {
    for (const o of e.observations)
      await q(
        `INSERT INTO experiment_observations (id, experiment_id, kind, text, measurement, recorded_by, recorded_by_name, recorded_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
        [
          o.id,
          e.id,
          o.kind,
          o.text,
          o.measurement ? json(o.measurement) : null,
          o.recordedBy,
          o.recordedByName,
          o.recordedAt,
        ],
      );
  };

  return {
    projects: {
      list: async () => (await q('SELECT * FROM projects ORDER BY created_at, id')).map(toProject),
      get: async (id) => {
        const r = await one('SELECT * FROM projects WHERE id = $1', [id]);
        return r ? toProject(r) : undefined;
      },
      insert: async (p) => {
        await q(
          'INSERT INTO projects (id, name, status, summary, created_by, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
          [p.id, p.name, p.status, p.summary, p.createdBy, p.createdAt, p.updatedAt],
        );
      },
      touch: async (id, at) => {
        await q('UPDATE projects SET updated_at = $2 WHERE id = $1', [id, at]);
      },
    },
    briefs: {
      get: async (projectId) => {
        const r = await one('SELECT * FROM creative_briefs WHERE project_id = $1', [projectId]);
        return r
          ? ({
              projectId: r.project_id,
              revision: r.revision,
              content: r.content,
              updatedAt: r.updated_at,
              updatedBy: r.updated_by,
            } satisfies Brief)
          : undefined;
      },
      upsert: async (b) => {
        await q(
          `INSERT INTO creative_briefs (project_id, revision, content, updated_at, updated_by) VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (project_id) DO UPDATE SET revision = EXCLUDED.revision, content = EXCLUDED.content,
             updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by`,
          [b.projectId, b.revision, json(b.content), b.updatedAt, b.updatedBy],
        );
      },
    },
    drafts: {
      getByProject: async (projectId) => {
        const d = await one('SELECT * FROM formula_drafts WHERE project_id = $1', [projectId]);
        if (!d) return undefined;
        const items = await q(
          'SELECT line_id, ingredient_id, mass_pct, position FROM formula_draft_items WHERE draft_id = $1 ORDER BY position',
          [d.id],
        );
        return {
          id: d.id,
          projectId: d.project_id,
          basedOnVersionId: d.based_on_version_id,
          revision: d.revision,
          batchSizeG: d.batch_size_g,
          items: items.map((i) => ({
            lineId: i.line_id,
            ingredientId: i.ingredient_id,
            massPct: i.mass_pct,
            position: i.position,
          })),
          updatedAt: d.updated_at,
          updatedBy: d.updated_by,
        } satisfies FormulaDraft;
      },
      upsert: async (d) => {
        await q(
          `INSERT INTO formula_drafts (id, project_id, based_on_version_id, revision, batch_size_g, updated_at, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (id) DO UPDATE SET based_on_version_id = EXCLUDED.based_on_version_id, revision = EXCLUDED.revision,
             batch_size_g = EXCLUDED.batch_size_g, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by`,
          [d.id, d.projectId, d.basedOnVersionId, d.revision, d.batchSizeG, d.updatedAt, d.updatedBy],
        );
        await q('DELETE FROM formula_draft_items WHERE draft_id = $1', [d.id]);
        if (d.items.length)
          await q(
            `INSERT INTO formula_draft_items (draft_id, line_id, ingredient_id, mass_pct, position)
             SELECT $1, * FROM unnest($2::uuid[], $3::uuid[], $4::numeric[], $5::int[])`,
            [
              d.id,
              d.items.map((i) => i.lineId),
              d.items.map((i) => i.ingredientId),
              d.items.map((i) => i.massPct),
              d.items.map((i) => i.position),
            ],
          );
      },
    },
    versions: {
      listByProject: async (projectId) =>
        (await q('SELECT * FROM formula_versions WHERE project_id = $1 ORDER BY saved_at, id', [projectId])).map(
          toVersion,
        ),
      get: async (id) => {
        const r = await one('SELECT * FROM formula_versions WHERE id = $1', [id]);
        return r ? toVersion(r) : undefined;
      },
      insert: async (v) => {
        await q(
          `INSERT INTO formula_versions (id, project_id, version_label, parent_version_id, snapshot, snapshot_hash,
             hash_algorithm, total_pct, completeness, saved_by, saved_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            v.id,
            v.projectId,
            v.versionLabel,
            v.snapshot.parentVersionId,
            json(v.snapshot),
            v.snapshotHash,
            v.hashAlgorithm,
            v.snapshot.totalPct,
            v.snapshot.completeness,
            v.savedBy,
            v.savedAt,
          ],
        );
      },
    },
    audit: {
      append: async (e) => {
        await q(
          `INSERT INTO audit_events (id, project_id, actor_id, actor_name, action, target_type, target_id, payload, occurred_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            e.id,
            e.projectId,
            e.actorId,
            e.actorName,
            e.action,
            e.targetType,
            e.targetId,
            json(e.payload),
            e.occurredAt,
          ],
        );
      },
      listByProject: async (projectId, limit, f) =>
        (
          await q(
            `SELECT * FROM audit_events WHERE project_id = $1
               AND ($2::text IS NULL OR action LIKE $2) AND ($3::text IS NULL OR target_id = $3)
             ORDER BY seq DESC LIMIT $4`,
            [projectId, f?.actionPrefix ? likePrefix(f.actionPrefix) : null, f?.targetId ?? null, limit],
          )
        ).map(toAudit),
    },
    uploads: {
      insert: async (u) => {
        await q(
          'INSERT INTO uploads (id, project_id, original_name, stored_name, mime, size_bytes, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
          [u.id, u.projectId, u.originalName, u.storedName, u.mime, u.size, u.createdAt],
        );
      },
      get: async (id) => {
        const r = await one('SELECT * FROM uploads WHERE id = $1', [id]);
        return r
          ? ({
              id: r.id,
              projectId: r.project_id,
              originalName: r.original_name,
              storedName: r.stored_name,
              mime: r.mime,
              size: r.size_bytes,
              createdAt: r.created_at,
            } satisfies Upload)
          : undefined;
      },
    },
    memberships: {
      listByProject: async (projectId) =>
        (await q('SELECT * FROM project_members WHERE project_id = $1 ORDER BY user_id', [projectId])).map(
          (r): Membership => ({ projectId: r.project_id, userId: r.user_id, role: r.role, updatedAt: r.updated_at }),
        ),
      get: async (projectId, userId) => {
        const r = await one('SELECT * FROM project_members WHERE project_id = $1 AND user_id = $2', [
          projectId,
          userId,
        ]);
        return r ? { projectId: r.project_id, userId: r.user_id, role: r.role, updatedAt: r.updated_at } : undefined;
      },
      upsert: async (m) => {
        await q(
          `INSERT INTO project_members (project_id, user_id, role, updated_at) VALUES ($1,$2,$3,$4)
           ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role, updated_at = EXCLUDED.updated_at`,
          [m.projectId, m.userId, m.role, m.updatedAt],
        );
      },
    },
    validations: {
      insert: async (r) => {
        await q(
          `INSERT INTO validation_runs (id, project_id, formula_version_id, version_label, snapshot_hash, market,
             product_category, rule_set_ids, status, summary, coverage, findings, evaluated_by, evaluated_at, engine_version)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [
            r.id,
            r.projectId,
            r.formulaVersionId,
            r.versionLabel,
            r.snapshotHash,
            r.market,
            r.productCategory,
            r.ruleSetIds,
            r.status,
            json(r.summary),
            json(r.coverage),
            json(r.findings),
            r.evaluatedBy,
            r.evaluatedAt,
            r.engineVersion,
          ],
        );
      },
      get: async (id) => {
        const r = await one('SELECT * FROM validation_runs WHERE id = $1', [id]);
        return r ? toValidation(r) : undefined;
      },
      listByProject: async (projectId) =>
        (
          await q('SELECT * FROM validation_runs WHERE project_id = $1 ORDER BY evaluated_at DESC, id', [projectId])
        ).map(toValidation),
    },
    experiments: {
      insert: async (e) => {
        await q(
          `INSERT INTO experiments (id, project_id, formula_version_id, version_label, title, protocol, status, created_by, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            e.id,
            e.projectId,
            e.formulaVersionId,
            e.versionLabel,
            e.title,
            json(e.protocol),
            e.status,
            e.createdBy,
            e.createdAt,
          ],
        );
        await writeObservations(e);
      },
      update: async (e) => {
        const r = await q('UPDATE experiments SET title = $2, protocol = $3, status = $4 WHERE id = $1 RETURNING id', [
          e.id,
          e.title,
          json(e.protocol),
          e.status,
        ]);
        if (!r.length) throw new Error('Experiment not found');
        await writeObservations(e); // observations are append-only: only new ids are inserted
      },
      get: async (id) => (await experimentsWhere('id = $1', [id]))[0],
      listByProject: (projectId) => experimentsWhere('project_id = $1', [projectId]),
    },
    reviews: {
      insert: async (r) => {
        await q(
          `INSERT INTO review_requests (id, project_id, formula_version_id, version_label, snapshot_hash, title, message,
             status, requested_by, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            r.id,
            r.projectId,
            r.formulaVersionId,
            r.versionLabel,
            r.snapshotHash,
            r.title,
            r.message,
            r.status,
            r.requestedBy,
            r.createdAt,
            r.updatedAt,
          ],
        );
        await writeReviewChildren(r);
      },
      update: async (r) => {
        const res = await q(
          'UPDATE review_requests SET status = $2, title = $3, message = $4, updated_at = $5 WHERE id = $1 RETURNING id',
          [r.id, r.status, r.title, r.message, r.updatedAt],
        );
        if (!res.length) throw new Error('Review not found');
        await writeReviewChildren(r); // comments and decisions are append-only
      },
      get: async (id) => (await reviewsWhere('id = $1', [id]))[0],
      listByProject: (projectId) => reviewsWhere('project_id = $1', [projectId]),
    },
  };
}
