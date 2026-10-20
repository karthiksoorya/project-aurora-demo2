import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';
import type {
  ApiError,
  AuditEvent,
  Brief,
  BriefContent,
  CatalogPage,
  CompareResult,
  DraftItem,
  DraftView,
  FormulaVersion,
  IngredientDetail,
  ProjectDetail,
  ProjectSummary,
  Upload,
  VersionSummary,
} from '../models';

const BASE = '/api/v1';

/** Thin typed client for the local NestJS API. The only network endpoint the app uses. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  private async call<T>(o: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(o);
    } catch (e) {
      throw toApiError(e);
    }
  }

  health() {
    return this.call(this.http.get<{ status: string }>('/health'));
  }
  projects() {
    return this.call(this.http.get<ProjectSummary[]>(`${BASE}/projects`));
  }
  createProject(name: string) {
    return this.call(this.http.post<ProjectSummary>(`${BASE}/projects`, { name }));
  }
  project(id: string) {
    return this.call(this.http.get<ProjectDetail>(`${BASE}/projects/${id}`));
  }
  brief(id: string) {
    return this.call(this.http.get<Brief>(`${BASE}/projects/${id}/brief`));
  }
  saveBrief(id: string, revision: number, content: BriefContent) {
    return this.call(this.http.put<Brief>(`${BASE}/projects/${id}/brief`, { revision, content }));
  }
  upload(projectId: string, file: File) {
    const fd = new FormData();
    fd.append('file', file);
    return this.call(this.http.post<Upload>(`${BASE}/projects/${projectId}/uploads`, fd));
  }
  uploadUrl(uploadId: string) {
    return `${BASE}/uploads/${uploadId}`;
  }
  catalog() {
    return this.call(this.http.get<CatalogPage>(`${BASE}/ingredients?pageSize=200`));
  }
  ingredient(id: string) {
    return this.call(this.http.get<IngredientDetail>(`${BASE}/ingredients/${id}`));
  }
  draft(projectId: string) {
    return this.call(this.http.get<DraftView>(`${BASE}/projects/${projectId}/formula-draft`));
  }
  saveDraft(projectId: string, revision: number, items: DraftItem[], batchSizeG?: string) {
    return this.call(
      this.http.put<DraftView>(`${BASE}/projects/${projectId}/formula-draft`, { revision, items, batchSizeG }),
    );
  }
  normalize(projectId: string, revision: number) {
    return this.call(this.http.post<DraftView>(`${BASE}/projects/${projectId}/formula-draft/normalize`, { revision }));
  }
  versions(projectId: string) {
    return this.call(this.http.get<VersionSummary[]>(`${BASE}/projects/${projectId}/formula-versions`));
  }
  version(id: string) {
    return this.call(this.http.get<FormulaVersion>(`${BASE}/formula-versions/${id}`));
  }
  saveVersion(projectId: string, body: { expectedDraftRevision: number; versionLabel: string; note?: string }) {
    return this.call(this.http.post<FormulaVersion>(`${BASE}/projects/${projectId}/formula-versions`, body));
  }
  compare(leftId: string, rightId: string) {
    return this.call(
      this.http.get<CompareResult>(`${BASE}/formula-versions/compare`, { params: { leftId, rightId } }),
    );
  }
  branch(versionId: string, expectedDraftRevision: number) {
    return this.call(this.http.post<DraftView>(`${BASE}/formula-versions/${versionId}/branch`, { expectedDraftRevision }));
  }
  audit(projectId: string, limit = 30) {
    return this.call(this.http.get<AuditEvent[]>(`${BASE}/projects/${projectId}/audit`, { params: { limit } }));
  }
  /** Local status probe only — called exclusively when the user is in AI Assist mode. */
  aiStatus() {
    return this.call(this.http.get<{ enabled: boolean; message: string; requires: string }>(`${BASE}/ai/status`));
  }
}

export function toApiError(e: unknown): ApiError {
  if (e instanceof HttpErrorResponse) {
    const b = e.error as Partial<ApiError> | null;
    if (b && typeof b === 'object' && 'code' in b)
      return { code: b.code ?? 'ERROR', message: b.message ?? e.message, details: b.details, requestId: b.requestId ?? '' };
    return {
      code: e.status === 0 ? 'API_UNREACHABLE' : `HTTP_${e.status}`,
      message: e.status === 0 ? 'Local API is not reachable — is `npm run dev` running?' : e.message,
      details: null,
      requestId: '',
    };
  }
  return { code: 'ERROR', message: String(e), details: null, requestId: '' };
}

export const isApiError = (e: unknown): e is ApiError =>
  !!e && typeof e === 'object' && 'code' in e && 'message' in e;
