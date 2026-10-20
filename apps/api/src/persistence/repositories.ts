import type {
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
 * Repository interfaces. Domain services depend only on these; the JSON adapter (M1) and the
 * planned PostgreSQL adapter (M3) implement them. All returned objects are copies.
 */
export interface ProjectRepository {
  list(): Project[];
  get(id: string): Project | undefined;
  insert(p: Project): void;
  touch(id: string, at: string): void;
}

export interface BriefRepository {
  get(projectId: string): Brief | undefined;
  upsert(b: Brief): void;
}

export interface FormulaDraftRepository {
  getByProject(projectId: string): FormulaDraft | undefined;
  upsert(d: FormulaDraft): void;
}

/** Versions are append-only: no update or delete operations exist by design. */
export interface FormulaVersionRepository {
  listByProject(projectId: string): FormulaVersion[];
  get(id: string): FormulaVersion | undefined;
  insert(v: FormulaVersion): void;
}

export interface AuditRepository {
  append(e: AuditEvent): void;
  listByProject(projectId: string, limit: number): AuditEvent[];
}

export interface UploadRepository {
  insert(u: Upload): void;
  get(id: string): Upload | undefined;
}

export interface IngredientCatalogRepository {
  version(): string;
  all(): Ingredient[];
  get(id: string): Ingredient | undefined;
  structure(compoundId: string): StructureFixture | undefined;
}

/** A unit of work exposes repositories bound to one consistent snapshot / transaction. */
export interface AuroraTx {
  projects: ProjectRepository;
  briefs: BriefRepository;
  drafts: FormulaDraftRepository;
  versions: FormulaVersionRepository;
  audit: AuditRepository;
  uploads: UploadRepository;
}

export abstract class UnitOfWork {
  /** Read-only view of committed state. */
  abstract read<T>(work: (tx: AuroraTx) => T): Promise<T>;
  /** Serialized, all-or-nothing write. If `work` throws nothing is persisted. */
  abstract write<T>(work: (tx: AuroraTx) => T): Promise<T>;
}

export abstract class CatalogRepository implements IngredientCatalogRepository {
  abstract version(): string;
  abstract all(): Ingredient[];
  abstract get(id: string): Ingredient | undefined;
  abstract structure(compoundId: string): StructureFixture | undefined;
}
