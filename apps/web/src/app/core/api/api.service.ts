import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';
import type {
  DemoUser,
  Experiment,
  Lineage,
  Member,
  ObservationKind,
  ProjectRole,
  Review,
  ValidationOptions,
  ValidationRun,
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
    return this.call(this.http.get<CompareResult>(`${BASE}/formula-versions/compare`, { params: { leftId, rightId } }));
  }
  branch(versionId: string, expectedDraftRevision: number) {
    return this.call(
      this.http.post<DraftView>(`${BASE}/formula-versions/${versionId}/branch`, { expectedDraftRevision }),
    );
  }
  audit(projectId: string, limit = 30) {
    return this.call(this.http.get<AuditEvent[]>(`${BASE}/projects/${projectId}/audit`, { params: { limit } }));
  }
  // ---------------- M2: access, validation, experiments, reviews
  users() {
    return this.call(this.http.get<DemoUser[]>(`${BASE}/users`));
  }
  members(projectId: string) {
    return this.call(this.http.get<Member[]>(`${BASE}/projects/${projectId}/members`));
  }
  setRole(projectId: string, userId: string, role: ProjectRole) {
    return this.call(this.http.put<Member>(`${BASE}/projects/${projectId}/members/${userId}`, { role }));
  }
  validationOptions() {
    return this.call(this.http.get<ValidationOptions>(`${BASE}/validation-options`));
  }
  runValidation(body: { formulaVersionId: string; market: string; category: string; ruleSetIds: string[] }) {
    return this.call(this.http.post<ValidationRun>(`${BASE}/validations`, body));
  }
  validations(projectId: string) {
    return this.call(this.http.get<Omit<ValidationRun, 'findings'>[]>(`${BASE}/projects/${projectId}/validations`));
  }
  validation(runId: string) {
    return this.call(this.http.get<ValidationRun>(`${BASE}/validations/${runId}`));
  }
  experiments(projectId: string) {
    return this.call(this.http.get<Experiment[]>(`${BASE}/projects/${projectId}/experiments`));
  }
  createExperiment(body: { formulaVersionId: string; title: string; protocol: Experiment['protocol'] }) {
    return this.call(this.http.post<Experiment>(`${BASE}/experiments`, body));
  }
  addObservation(
    id: string,
    body: {
      kind: ObservationKind;
      text: string;
      measurement?: { quantity: string; value: string; unit: string; method: string };
    },
  ) {
    return this.call(this.http.post<Experiment>(`${BASE}/experiments/${id}/observations`, body));
  }
  setExperimentStatus(id: string, status: Experiment['status']) {
    return this.call(this.http.post<Experiment>(`${BASE}/experiments/${id}/status`, { status }));
  }
  lineage(projectId: string) {
    return this.call(this.http.get<Lineage>(`${BASE}/projects/${projectId}/lineage`));
  }
  reviews(projectId: string) {
    return this.call(this.http.get<Review[]>(`${BASE}/projects/${projectId}/reviews`));
  }
  createReview(body: {
    formulaVersionId: string;
    title: string;
    message: string;
    reviewers: { userId: string; permission: 'comment' | 'approve' }[];
  }) {
    return this.call(this.http.post<Review>(`${BASE}/reviews`, body));
  }
  comment(id: string, comment: string, kind: string) {
    return this.call(this.http.post<Review>(`${BASE}/reviews/${id}/comments`, { comment, kind }));
  }
  decide(id: string, decision: 'approved' | 'changes_requested' | 'rejected', reason: string) {
    return this.call(this.http.post<Review>(`${BASE}/reviews/${id}/decisions`, { decision, reason }));
  }
  withdrawReview(id: string) {
    return this.call(this.http.post<Review>(`${BASE}/reviews/${id}/withdraw`, {}));
  }
  auditFiltered(projectId: string, params: { limit?: number; action?: string; targetId?: string }) {
    const p: Record<string, string> = { limit: String(params.limit ?? 100) };
    if (params.action) p['action'] = params.action;
    if (params.targetId) p['targetId'] = params.targetId;
    return this.call(this.http.get<AuditEvent[]>(`${BASE}/projects/${projectId}/audit`, { params: p }));
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
      return {
        code: b.code ?? 'ERROR',
        message: b.message ?? e.message,
        details: b.details,
        requestId: b.requestId ?? '',
      };
    return {
      code: e.status === 0 ? 'API_UNREACHABLE' : `HTTP_${e.status}`,
      message: e.status === 0 ? 'Local API is not reachable — is `npm run dev` running?' : e.message,
      details: null,
      requestId: '',
    };
  }
  return { code: 'ERROR', message: String(e), details: null, requestId: '' };
}

export const isApiError = (e: unknown): e is ApiError => !!e && typeof e === 'object' && 'code' in e && 'message' in e;
