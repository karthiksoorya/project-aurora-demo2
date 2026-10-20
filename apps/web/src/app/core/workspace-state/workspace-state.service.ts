import { Injectable, effect, signal } from '@angular/core';
import type { WorkspaceKey } from '../models';

export type Mode = 'manual' | 'ai';
export type CanvasMode = 'inspiration' | 'formula3d' | 'ingredients3d' | 'molecular';
export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
}

export interface FormulaUi {
  tab: 'builder' | 'history' | 'compare';
  canvasMode: CanvasMode;
  expanded: boolean;
  formula3dView: 'families' | 'volatility';
  formula3dLayer: 'bottle' | 'ingredients';
  ingredients3dView: 'clusters' | 'network' | 'list';
  showLabels: boolean;
  showConnections: boolean;
  showRelated: boolean;
  libraryCollapsed: boolean;
  libraryFilter: 'all' | 'in-formula' | 'recent';
  selectedFamily: string | null;
  compareLeftId: string | null;
  compareRightId: string | null;
  inspectorCompoundIngredientId: string | null;
  showGrams: boolean;
  rightPanel: 'table' | 'inspector';
}

export interface IngredientsUi {
  tab: 'universe' | 'list';
  q: string;
  families: string[];
  kind: '' | 'single_compound' | 'natural_mixture';
  role: '' | 'top' | 'heart' | 'base';
  expanded: boolean;
  compareIds: string[];
  detailTab: 'overview' | 'properties' | 'safety' | 'composition';
}

interface Persisted {
  v: 1;
  mode: Mode;
  aiPanel: Partial<Record<WorkspaceKey, boolean>>;
  selectedIngredientId: string | null;
  formula: FormulaUi;
  ingredients: IngredientsUi;
  cameras: Record<string, CameraState>;
  recentIngredientIds: string[];
}

const KEY = 'aurora.ui.v1';

const DEFAULTS: Persisted = {
  v: 1,
  mode: 'manual',
  aiPanel: {},
  selectedIngredientId: null,
  formula: {
    tab: 'builder',
    canvasMode: 'formula3d',
    expanded: false,
    formula3dView: 'families',
    formula3dLayer: 'bottle',
    ingredients3dView: 'clusters',
    showLabels: true,
    showConnections: true,
    showRelated: true,
    libraryCollapsed: false,
    libraryFilter: 'all',
    selectedFamily: null,
    compareLeftId: null,
    compareRightId: null,
    inspectorCompoundIngredientId: null,
    showGrams: false,
    rightPanel: 'table',
  },
  ingredients: {
    tab: 'universe',
    q: '',
    families: [],
    kind: '',
    role: '',
    expanded: false,
    compareIds: [],
    detailTab: 'overview',
  },
  cameras: {},
  recentIngredientIds: [],
};

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const p = JSON.parse(raw) as Partial<Persisted>;
    return {
      ...structuredClone(DEFAULTS),
      ...p,
      formula: { ...DEFAULTS.formula, ...(p.formula ?? {}) },
      ingredients: { ...DEFAULTS.ingredients, ...(p.ingredients ?? {}) },
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

/**
 * UI/session state shared across workspaces (spec §2): mode, AI panel visibility per workspace,
 * selected ingredient, canvas mode, 3D camera states, filters. Persisted per viewer in localStorage
 * so a refresh restores the workspace context. Business data (brief, draft, versions) lives in NestJS.
 * Switching mode never touches any of this state — only presentation changes.
 */
@Injectable({ providedIn: 'root' })
export class WorkspaceStateService {
  private readonly initial = load();
  readonly mode = signal<Mode>(this.initial.mode);
  readonly aiPanel = signal(this.initial.aiPanel);
  readonly selectedIngredientId = signal<string | null>(this.initial.selectedIngredientId);
  readonly formula = signal<FormulaUi>(this.initial.formula);
  readonly ingredients = signal<IngredientsUi>(this.initial.ingredients);
  readonly cameras = signal<Record<string, CameraState>>(this.initial.cameras);
  readonly recentIngredientIds = signal<string[]>(this.initial.recentIngredientIds);

  constructor() {
    effect(() => {
      const s: Persisted = {
        v: 1,
        mode: this.mode(),
        aiPanel: this.aiPanel(),
        selectedIngredientId: this.selectedIngredientId(),
        formula: this.formula(),
        ingredients: this.ingredients(),
        cameras: this.cameras(),
        recentIngredientIds: this.recentIngredientIds(),
      };
      try {
        localStorage.setItem(KEY, JSON.stringify(s));
      } catch {
        /* storage unavailable: state stays in memory */
      }
    });
  }

  setMode(m: Mode) {
    this.mode.set(m);
  }
  aiPanelVisible(ws: WorkspaceKey) {
    return this.mode() === 'ai' && this.aiPanel()[ws] !== false;
  }
  setAiPanel(ws: WorkspaceKey, visible: boolean) {
    this.aiPanel.update((p) => ({ ...p, [ws]: visible }));
  }
  patchFormula(p: Partial<FormulaUi>) {
    this.formula.update((f) => ({ ...f, ...p }));
  }
  patchIngredients(p: Partial<IngredientsUi>) {
    this.ingredients.update((f) => ({ ...f, ...p }));
  }
  selectIngredient(id: string | null) {
    this.selectedIngredientId.set(id);
    if (id) this.recentIngredientIds.update((r) => [id, ...r.filter((x) => x !== id)].slice(0, 12));
  }
  saveCamera(key: string, c: CameraState) {
    this.cameras.update((m) => ({ ...m, [key]: c }));
  }
  camera(key: string): CameraState | undefined {
    return this.cameras()[key];
  }
  resetAll() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }
}
