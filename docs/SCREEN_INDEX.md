# Screen index — 27 references → implementation

All 27 reference screenshots from `SCREEN_MANIFEST_FINAL.md` are mapped below. Six routes only; every other
image is a tab, canvas mode, panel, expanded state or overlay of those routes. "Smoke" = file written by
`e2e/m1-f-visual-smoke.spec.ts` to `e2e/screenshots/<ID>.png` at 1672×941.

Status legend: **M1** implemented and tested · **M1-shell** route/shell/AI-mode live, workflow is M2 ·
**M2** not yet implemented (state planned).

| ID | Workspace / state | How to reach it in the app | Main components | Status | Smoke |
|---|---|---|---|---|---|
| CS-M | Concept Studio · Manual | `/projects/:id/concept` | `ConceptStudioComponent` | M1 | ✓ |
| CS-A | Concept Studio · AI Assist | header **AI Assist** | + `AiPartnerPanelComponent` (unavailable state) | M1 | ✓ |
| IE-M | Ingredient Explorer · Manual | `/ingredients` (Universe tab) | `IngredientExplorerComponent`, `IngredientDetailComponent` | M1 | ✓ |
| IE-A | Ingredient Explorer · AI Assist | AI Assist mode | + AI panel | M1 | ✓ |
| IE-U1 | 3D Universe baseline | Universe tab | `IngredientUniverseComponent` (Three.js) | M1 | ✓ |
| IE-U2 | Universe selection + details | click a sphere / list row; detail tab *Composition* | universe halo + detail panel | M1 | ✓ |
| IE-U3 | Universe expanded camera variant | expand button on the universe | same component, expanded layout | M1 | ✓ |
| IE-C | Ingredient comparison overlay | compare toggle on 2–4 ingredients → **Compare** | compare dialog | M1 | ✓ |
| FS-M1 | Formula Studio · Manual baseline | `/formula`, Formula Builder | `FormulaStudioComponent`, `FormulaTableComponent`, `FormulaInsightsComponent`, `IngredientLibraryComponent` | M1 | ✓ |
| FS-M2 | Inspiration Canvas state | canvas tab **Inspiration Canvas** | `InspirationCanvasComponent` (live brief data) | M1 | ✓ |
| FS-M3 | AI partner on Formula canvas | AI Assist + Inspiration/3D canvas | AI panel column | M1 | ✓ |
| FS-A | Formula Studio · AI main | AI Assist mode | AI panel column | M1 | ✓ |
| FS-3DF | 3D Formula View (expanded) | canvas **3D Formula View** + expand | `Formula3dComponent` (bottle + accords, families / volatility, bottle / ingredient view) | M1 | ✓ |
| FS-3DI | 3D Ingredients view | canvas **3D Ingredients** (clusters / network / list) | `Ingredients3dComponent` | M1 | ✓ |
| FS-06 | 3D Exploration (AI Assisted) | AI Assist + expand on a 3D canvas | expanded layout: canvas, Selected Ingredient, AI Exploration Suggestions (unavailable, hideable), Formula Ingredients live strip | M1 | ✓ |
| FS-VC | Version comparison | tab **Compare Versions** | `VersionCompareComponent` (API compare of saved snapshots) | M1 | ✓ |
| FS-MI1 | Molecular Inspector (compound) | canvas **Molecular Inspector**, pick Linalool | `MolecularInspectorComponent` viewer + right-column details, `MoleculeViewerComponent` | M1 | ✓ |
| FS-MI2 | Inspector, constituent focus | pick Bergamot EO → Limonene | same inspector, breadcrumb *Bergamot EO › Limonene* | M1 | ✓ |
| VS-M | Validation Studio · Manual | `/validation` | `PlannedWorkspaceComponent` (saved versions, scope notice) | M1-shell | ✓ |
| VS-A | Validation · AI Assist | AI Assist mode | + AI panel | M1-shell | ✓ |
| VS-E | Validation evidence expanded | — | planned evidence panel | M2 | — |
| EE-M1 | Experiment Explorer · Manual | `/experiments` | planned workspace | M1-shell | ✓ |
| EE-A | Experiment · AI Assist | AI Assist mode | + AI panel | M1-shell | ✓ |
| EE-X | Experiment branching expanded | — | planned graph canvas (API already stores parent versions) | M2 | — |
| SR-M | Share & Review · Manual | `/review` | planned workspace | M1-shell | ✓ |
| SR-A | Share & Review · AI Assist | AI Assist mode | + AI panel | M1-shell | ✓ |
| SR-X | Review expanded (snapshot, comments) | — | planned | M2 | — |

Formula Studio canvas switcher is always **Inspiration Canvas · 3D Formula View · 3D Ingredients ·
Molecular Inspector** (FS-06's alternate internal tabs and step sidebar were reconciled into this shell,
per the manifest).
