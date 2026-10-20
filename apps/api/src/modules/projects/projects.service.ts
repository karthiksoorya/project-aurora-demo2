import { Injectable } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { badRequest, conflict, notFound } from '../../common/errors';
import { newId } from '../../common/ids';
import { DEMO_USER } from '../../common/request-context';
import type { Brief, BriefContent, Project, Upload } from '../../domain/types';
import { JsonUnitOfWork } from '../../persistence/json-store';
import { UnitOfWork } from '../../persistence/repositories';
import { audit } from '../audit/audit';
import type { CreateProjectDto, UpdateBriefDto } from './projects.dto';

export const UPLOAD_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
};
export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

const EMPTY_BRIEF: BriefContent = {
  fragranceType: 'Fine Fragrance',
  targetConsumer: '',
  keywords: [],
  description: '',
  references: [],
  inspirations: [],
  concepts: [],
};

@Injectable()
export class ProjectsService {
  constructor(private readonly uow: UnitOfWork) {}

  list() {
    return this.uow.read((tx) =>
      tx.projects.list().map((p) => {
        const d = tx.drafts.getByProject(p.id);
        return { ...p, draftRevision: d?.revision ?? null, versionCount: tx.versions.listByProject(p.id).length };
      }),
    );
  }

  async get(projectId: string) {
    const r = await this.uow.read((tx) => {
      const p = tx.projects.get(projectId);
      if (!p) return undefined;
      const d = tx.drafts.getByProject(projectId);
      const versions = tx.versions.listByProject(projectId);
      return {
        ...p,
        draftId: d?.id ?? null,
        draftRevision: d?.revision ?? null,
        draftBasedOnVersionId: d?.basedOnVersionId ?? null,
        latestVersionId: versions.at(-1)?.id ?? null,
        versionCount: versions.length,
        briefRevision: tx.briefs.get(projectId)?.revision ?? null,
      };
    });
    if (!r) throw notFound('Project', projectId);
    return r;
  }

  create(dto: CreateProjectDto) {
    return this.uow.write((tx) => {
      const name = dto.name.trim();
      if (tx.projects.list().some((p) => p.name.toLowerCase() === name.toLowerCase()))
        throw conflict('DUPLICATE_PROJECT_NAME', `A project named "${name}" already exists`);
      const now = new Date().toISOString();
      const p: Project = {
        id: newId(),
        name,
        status: 'draft',
        summary: dto.summary?.trim() ?? '',
        createdBy: DEMO_USER.id,
        createdAt: now,
        updatedAt: now,
      };
      tx.projects.insert(p);
      tx.briefs.upsert({
        projectId: p.id,
        revision: 1,
        content: structuredClone(EMPTY_BRIEF),
        updatedAt: now,
        updatedBy: DEMO_USER.id,
      });
      tx.drafts.upsert({
        id: newId(),
        projectId: p.id,
        basedOnVersionId: null,
        revision: 1,
        batchSizeG: '100.000',
        items: [],
        updatedAt: now,
        updatedBy: DEMO_USER.id,
      });
      audit(tx, p.id, 'project.created', 'project', p.id, { name }, now);
      return p;
    });
  }

  async getBrief(projectId: string) {
    const b = await this.uow.read((tx) => {
      if (!tx.projects.get(projectId)) throw notFound('Project', projectId);
      return tx.briefs.get(projectId);
    });
    if (!b) throw notFound('Brief', projectId);
    return b;
  }

  updateBrief(projectId: string, dto: UpdateBriefDto) {
    return this.uow.write((tx) => {
      if (!tx.projects.get(projectId)) throw notFound('Project', projectId);
      const cur = tx.briefs.get(projectId);
      if (!cur) throw notFound('Brief', projectId);
      if (cur.revision !== dto.revision)
        throw conflict('STALE_REVISION', 'Brief was changed elsewhere; reload before saving', {
          expectedRevision: dto.revision,
          currentRevision: cur.revision,
        });
      const content = dto.content;
      const ids = [...content.inspirations.map((i) => i.id), ...content.concepts.map((c) => c.id)];
      if (new Set(ids).size !== ids.length) throw badRequest('Duplicate inspiration/concept id');
      for (const u of [
        ...content.inspirations.filter((i) => i.source === 'upload').map((i) => i.uploadId!),
        ...content.references.map((r) => r.uploadId),
      ]) {
        const up = tx.uploads.get(u);
        if (!up || up.projectId !== projectId) throw badRequest('Unknown upload referenced', { uploadId: u });
      }
      const now = new Date().toISOString();
      const next: Brief = { projectId, revision: cur.revision + 1, content, updatedAt: now, updatedBy: DEMO_USER.id };
      tx.briefs.upsert(next);
      tx.projects.touch(projectId, now);
      const prevConcepts = new Set(cur.content.concepts.map((c) => c.id));
      const added = content.concepts.filter((c) => !prevConcepts.has(c.id)).map((c) => c.name);
      audit(
        tx,
        projectId,
        'brief.updated',
        'creative_brief',
        projectId,
        {
          revision: next.revision,
          conceptsAdded: added,
          selectedConcepts: content.concepts.filter((c) => c.selected).map((c) => c.name),
        },
        now,
      );
      return next;
    });
  }

  async addUpload(
    projectId: string,
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer } | undefined,
  ) {
    if (!file) throw badRequest('Missing file field "file"');
    const ext = UPLOAD_MIME[file.mimetype];
    if (!ext) throw badRequest('Unsupported file type', { allowed: Object.keys(UPLOAD_MIME) });
    if (file.size > UPLOAD_MAX_BYTES) throw badRequest('File exceeds 5 MB');
    const id = newId();
    const storedName = `${id}${ext}`;
    const dir = (this.uow as JsonUnitOfWork).uploadsDir;
    await fs.writeFile(path.join(dir, storedName), file.buffer);
    return this.uow.write((tx) => {
      if (!tx.projects.get(projectId)) throw notFound('Project', projectId);
      const u: Upload = {
        id,
        projectId,
        originalName: path.basename(file.originalname).slice(0, 200),
        storedName,
        mime: file.mimetype,
        size: file.size,
        createdAt: new Date().toISOString(),
      };
      tx.uploads.insert(u);
      audit(tx, projectId, 'upload.added', 'upload', id, { name: u.originalName, mime: u.mime, size: u.size });
      return u;
    });
  }

  async getUpload(id: string) {
    const u = await this.uow.read((tx) => tx.uploads.get(id));
    if (!u) throw notFound('Upload', id);
    return { upload: u, file: path.join((this.uow as JsonUnitOfWork).uploadsDir, u.storedName) };
  }

  audit(projectId: string, limit: number) {
    return this.uow.read((tx) => {
      if (!tx.projects.get(projectId)) throw notFound('Project', projectId);
      return tx.audit.listByProject(projectId, Math.min(Math.max(limit, 1), 200));
    });
  }
}
