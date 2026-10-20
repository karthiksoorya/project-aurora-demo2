/**
 * Shared domain types for the Aurora API.
 * Quantities are carried as decimal strings (6 dp) at the API boundary and as
 * BigInt micro-units inside the formula engine — never as binary floats.
 */

export type VerificationStatus = 'verified' | 'unverified' | 'computed' | 'missing';

export interface SourceRef {
  name: string;
  reference?: string;
  retrievedAt?: string;
}

export interface SourcedProperty {
  key: string;
  label: string;
  value: string | null;
  status: VerificationStatus;
  source: SourceRef;
  note?: string;
}

export type IngredientKind = 'single_compound' | 'natural_mixture' | 'blend' | 'other';
export type NoteRole = 'top' | 'heart' | 'base';
export type Family =
  | 'citrus'
  | 'floral'
  | 'woody'
  | 'aromatic'
  | 'marine'
  | 'amber'
  | 'spicy'
  | 'green'
  | 'musky'
  | 'sweet'
  | 'fruity'
  | 'balsamic';

export interface Constituent {
  name: string;
  compoundId?: string;
}

export interface Ingredient {
  id: string;
  slug: string;
  name: string;
  kind: IngredientKind;
  /** INCI-style / botanical / chemical name (demo fixture text). */
  systematicName: string;
  family: Family;
  secondaryFamilies: Family[];
  /** Conventional evaporation-role classification used for grouping only. */
  role: NoteRole;
  descriptors: string[];
  /** Curator's qualitative emphasis for UI bars: 3 = primary, 2 = secondary, 1 = accent. Not measured. */
  descriptorEmphasis: { descriptor: string; level: 1 | 2 | 3 }[];
  description: string;
  art: { motif: string; hue: number };
  compoundId?: string;
  constituents?: Constituent[];
  properties: SourcedProperty[];
}

export interface StructureFixture {
  compoundId: string;
  name: string;
  smiles: string;
  declaredFormula: string;
  computedFormula: string;
  computedMolecularWeight: number;
  formulaConsistent: boolean;
  atoms: { el: string; x: number; y: number; z: number }[];
  bonds: { a: number; b: number; order: number }[];
  depiction2d: {
    atoms: { el: string; x: number; y: number }[];
    bonds: { a: number; b: number; order: number; aromatic: boolean }[];
  };
  provenance: { method: string; rdkitVersion: string; registryCheck: string; note: string };
}

/* ---------------- Projects / brief ---------------- */

export interface Project {
  id: string;
  name: string;
  status: 'draft' | 'archived';
  summary: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Inspiration {
  id: string;
  source: 'art' | 'upload';
  artKey?: string;
  uploadId?: string;
  title: string;
  tags: string[];
}

export interface Concept {
  id: string;
  name: string;
  tags: string[];
  description: string;
  artKey: string;
  selected: boolean;
}

export interface ReferenceMaterial {
  uploadId: string;
  name: string;
  mime: string;
  size: number;
}

export interface BriefContent {
  fragranceType: string;
  targetConsumer: string;
  keywords: string[];
  description: string;
  references: ReferenceMaterial[];
  inspirations: Inspiration[];
  concepts: Concept[];
}

export interface Brief {
  projectId: string;
  revision: number;
  content: BriefContent;
  updatedAt: string;
  updatedBy: string;
}

export interface Upload {
  id: string;
  projectId: string;
  originalName: string;
  storedName: string;
  mime: string;
  size: number;
  createdAt: string;
}

/* ---------------- Formula ---------------- */

export interface DraftItem {
  lineId: string;
  ingredientId: string;
  massPct: string;
  position: number;
}

export interface FormulaDraft {
  id: string;
  projectId: string;
  basedOnVersionId: string | null;
  revision: number;
  batchSizeG: string;
  items: DraftItem[];
  updatedAt: string;
  updatedBy: string;
}

export interface SnapshotItem {
  lineId: string;
  ingredientId: string;
  ingredientName: string;
  kind: IngredientKind;
  family: Family;
  role: NoteRole;
  massPct: string;
  position: number;
}

export interface FormulaSnapshot {
  projectId: string;
  versionLabel: string;
  note: string;
  parentVersionId: string | null;
  sourceDraftRevision: number;
  batchSizeG: string;
  unit: 'mass_pct_w_w';
  items: SnapshotItem[];
  totalPct: string;
  completeness: 'complete' | 'incomplete' | 'over';
  catalogVersion: string;
}

export interface FormulaVersion {
  id: string;
  projectId: string;
  versionLabel: string;
  snapshot: FormulaSnapshot;
  snapshotHash: string;
  hashAlgorithm: 'sha256-canonical-json-v1';
  savedBy: string;
  savedAt: string;
}

/* ---------------- Audit ---------------- */

export interface AuditEvent {
  id: string;
  projectId: string;
  actorId: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}

/* ---------------- Persistence shape ---------------- */

export interface DbState {
  schemaVersion: 1;
  projects: Project[];
  briefs: Brief[];
  drafts: FormulaDraft[];
  versions: FormulaVersion[];
  audit: AuditEvent[];
  uploads: Upload[];
}
