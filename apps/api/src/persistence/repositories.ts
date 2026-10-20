import type {
  Experiment,
  Membership,
  ReviewRequest,
  ValidationRun,
  AuditEvent,
  Brief,
  FormulaDraft,
  FormulaVersion,
  Ingredient,
  Project,
  StructureFixture,
  Upload,
} from '../domain/types';

/**
 * Repository interfaces. Domain services depend only on these; the JSON adapter (local demo) and the
 * PostgreSQL adapter (M3) implement them. All methods are async; returned objects are copies.
 */
export interface ProjectRepository {
  list(): Promise<Project[]>;
  get(id: string): Promise<Project | undefined>;
  insert(p: Project): Promise<void>;
  touch(id: string, at: string): Promise<void>;
}

export interface BriefRepository {
  get(projectId: string): Promise<Brief | undefined>;
  upsert(b: Brief): Promise<void>;
}

export interface FormulaDraftRepository {
  getByProject(projectId: string): Promise<FormulaDraft | undefined>;
  upsert(d: FormulaDraft): Promise<void>;
}

/** Versions are append-only: no update or delete operations exist by design. */
export interface FormulaVersionRepository {
  listByProject(projectId: string): Promise<FormulaVersion[]>;
  get(id: string): Promise<FormulaVersion | undefined>;
  insert(v: FormulaVersion): Promise<void>;
}

export interface AuditRepository {
  append(e: AuditEvent): Promise<void>;
  /** Newest first. `actionPrefix` filters e.g. "review."; `targetId` filters one entity. */
  listByProject(
    projectId: string,
    limit: number,
    filter?: { actionPrefix?: string; targetId?: string },
  ): Promise<AuditEvent[]>;
}

export interface UploadRepository {
  insert(u: Upload): Promise<void>;
  get(id: string): Promise<Upload | undefined>;
}

export interface IngredientCatalogRepository {
  version(): string;
  all(): Ingredient[];
  get(id: string): Ingredient | undefined;
  structure(compoundId: string): StructureFixture | undefined;
}

export interface MembershipRepository {
  listByProject(projectId: string): Promise<Membership[]>;
  get(projectId: string, userId: string): Promise<Membership | undefined>;
  upsert(m: Membership): Promise<void>;
}

/** Validation runs are append-only evidence records. */
export interface ValidationRepository {
  insert(r: ValidationRun): Promise<void>;
  get(id: string): Promise<ValidationRun | undefined>;
  listByProject(projectId: string): Promise<ValidationRun[]>;
}

export interface ExperimentRepository {
  insert(e: Experiment): Promise<void>;
  update(e: Experiment): Promise<void>;
  get(id: string): Promise<Experiment | undefined>;
  listByProject(projectId: string): Promise<Experiment[]>;
}

export interface ReviewRepository {
  insert(r: ReviewRequest): Promise<void>;
  update(r: ReviewRequest): Promise<void>;
  get(id: string): Promise<ReviewRequest | undefined>;
  listByProject(projectId: string): Promise<ReviewRequest[]>;
}

/** Catalog reference data is static and in-memory (fixture), so it stays synchronous. */
/** A unit of work exposes repositories bound to one consistent snapshot / transaction. */
export interface AuroraTx {
  projects: ProjectRepository;
  briefs: BriefRepository;
  drafts: FormulaDraftRepository;
  versions: FormulaVersionRepository;
  audit: AuditRepository;
  uploads: UploadRepository;
  memberships: MembershipRepository;
  validations: ValidationRepository;
  experiments: ExperimentRepository;
  reviews: ReviewRepository;
}

export interface PersistenceHealth {
  adapter: 'json-file' | 'postgresql';
  location: string;
  writable: boolean;
  schemaVersion: string;
  versionIntegrity: { checkedVersions: number; mismatched: string[] };
}

export abstract class UnitOfWork {
  /** Read-only view of committed state. */
  abstract read<T>(work: (tx: AuroraTx) => Promise<T>): Promise<T>;
  /** Serialized, all-or-nothing write. If `work` throws nothing is persisted. */
  abstract write<T>(work: (tx: AuroraTx) => Promise<T>): Promise<T>;
  /** Directory for uploaded files (binary content stays on disk for both adapters). */
  abstract readonly uploadsDir: string;
  /** Adapter description + integrity status for /health. */
  abstract health(): Promise<PersistenceHealth>;
}

export abstract class CatalogRepository implements IngredientCatalogRepository {
  abstract version(): string;
  abstract all(): Ingredient[];
  abstract get(id: string): Ingredient | undefined;
  abstract structure(compoundId: string): StructureFixture | undefined;
}
