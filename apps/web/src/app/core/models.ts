/** Client-side mirrors of the NestJS API contracts (/api/v1). */

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
export type NoteRole = 'top' | 'heart' | 'base';
export type IngredientKind = 'single_compound' | 'natural_mixture' | 'blend' | 'other';
export type VerificationStatus = 'verified' | 'unverified' | 'computed' | 'missing';

export interface IngredientSummary {
  id: string;
  slug: string;
  name: string;
  kind: IngredientKind;
  systematicName: string;
  family: Family;
  secondaryFamilies: Family[];
  role: NoteRole;
  descriptors: string[];
  art: { motif: string; hue: number };
  hasStructure: boolean;
}

export interface SourcedProperty {
  key: string;
  label: string;
  value: string | null;
  status: VerificationStatus;
  source: { name: string; reference?: string };
  note?: string;
}

export interface Structure {
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

export interface IngredientDetail extends IngredientSummary {
  description: string;
  descriptorEmphasis: { descriptor: string; level: 1 | 2 | 3 }[];
  compoundId?: string;
  constituents: { name: string; compoundId?: string; hasStructure: boolean; ingredientId: string | null }[];
  properties: SourcedProperty[];
  structure: Structure | null;
  structurePolicy: string;
}

export interface CatalogPage {
  catalogVersion: string;
  total: number;
  items: IngredientSummary[];
  facets: { family: Record<string, number> };
}

export interface ProjectSummary {
  id: string;
  name: string;
  status: string;
  summary: string;
  updatedAt: string;
  createdAt: string;
  versionCount: number;
}

export interface ProjectDetail extends ProjectSummary {
  draftId: string | null;
  draftRevision: number | null;
  draftBasedOnVersionId: string | null;
  latestVersionId: string | null;
  briefRevision: number | null;
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
}
export interface Upload {
  id: string;
  originalName: string;
  mime: string;
  size: number;
}

export interface DraftItem {
  lineId: string;
  ingredientId: string;
  massPct: string;
  position: number;
}
export type Completeness = 'complete' | 'incomplete' | 'over' | 'empty';
export interface FormulaIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  lineId?: string;
}
export interface FormulaComputation {
  unit: string;
  totalPct: string;
  totalPctDisplay: string;
  remainingPct: string;
  completeness: Completeness;
  lineCount: number;
  issues: FormulaIssue[];
  accords: { family: Family; massPct: string; sharePct: string }[];
  pyramid: Record<NoteRole, { massPct: string; ingredientIds: string[] }>;
  gramsByLine: Record<string, string>;
  method: string;
}
export interface DraftView {
  id: string;
  projectId: string;
  basedOnVersionId: string | null;
  revision: number;
  batchSizeG: string;
  items: DraftItem[];
  updatedAt: string;
  computed: FormulaComputation;
}

export interface VersionSummary {
  id: string;
  versionLabel: string;
  parentVersionId: string | null;
  savedAt: string;
  totalPct: string;
  completeness: 'complete' | 'incomplete' | 'over';
  lineCount: number;
  snapshotHash: string;
  note: string;
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
export interface FormulaVersion {
  id: string;
  projectId: string;
  versionLabel: string;
  snapshot: {
    versionLabel: string;
    note: string;
    parentVersionId: string | null;
    sourceDraftRevision: number;
    batchSizeG: string;
    unit: string;
    items: SnapshotItem[];
    totalPct: string;
    completeness: string;
    catalogVersion: string;
  };
  snapshotHash: string;
  hashAlgorithm: string;
  savedAt: string;
  hashVerified: boolean;
}
export interface CompareResult {
  left: { id: string; versionLabel: string; savedAt: string; snapshotHash: string; hashVerified: boolean; totalPct: string; completeness: string };
  right: CompareResult['left'];
  basis: string;
  rows: {
    ingredientId: string;
    ingredientName: string;
    family: Family;
    role: NoteRole;
    leftPct: string | null;
    rightPct: string | null;
    deltaPct: string;
    change: 'added' | 'removed' | 'changed' | 'unchanged';
  }[];
  accords: { family: Family; leftSharePct: string; rightSharePct: string }[];
  summary: { added: number; removed: number; changed: number; unchanged: number };
}

export interface AuditEvent {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  actorName: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}

export interface ApiError {
  code: string;
  message: string;
  details: unknown;
  requestId: string;
}

export type WorkspaceKey = 'concept' | 'ingredients' | 'formula' | 'validation' | 'experiments' | 'review';
