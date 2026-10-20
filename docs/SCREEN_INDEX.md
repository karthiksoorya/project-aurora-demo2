# Screen index — 27 references → implementation

All 27 reference screenshots from `SCREEN_MANIFEST_FINAL.md` are mapped below. Six routes only; every other
image is a tab, canvas mode, panel, expanded state or overlay of those routes. "Smoke" = file written by
`e2e/m1-f-visual-smoke.spec.ts` to `e2e/screenshots/<ID>.png` at 1672×941.

Status legend: **M1** implemented and tested in M1 · **M2** implemented and tested in M2. All 27 states are implemented.

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
| VS-M | Validation Studio · Manual | `/validation`, tab *Checks* | `ValidationStudioComponent` (version picker, market/category, rule sets, run; overall status; ingredient table; formula checks FC-001…FC-005, DC-001) | M2 | ✓ |
| VS-A | Validation · AI Assist | AI Assist mode | + AI panel (unavailable) | M2 | ✓ |
| VS-E | Validation evidence expanded | tab *Evidence & Reports* | evidence view: version hash, engine version, rule-set coverage, per-finding sources & missing inputs | M2 | ✓ |
| EE-M1 | Experiment Explorer · Manual | `/experiments`, tab *Experiment History* | `ExperimentExplorerComponent` (experiment table, detail, typed observations, compact lineage card) | M2 | ✓ |
| EE-A | Experiment · AI Assist | AI Assist mode | + AI panel | M2 | ✓ |
| EE-X | Experiment branching expanded | tab *Branching View* | `LineageGraphComponent` (saved parent links, zoom) + branch side panel (Create Branch, compare with parent) | M2 | ✓ |
| SR-M | Share & Review · Manual | `/review`, tab *Versions* | `ShareReviewComponent` (version list, snapshot detail, review stepper, members & roles, audit) | M2 | ✓ |
| SR-A | Share & Review · AI Assist | AI Assist mode | + AI panel | M2 | ✓ |
| SR-X | Review expanded (snapshot, comments) | tab *Feedback* | frozen snapshot, comment thread, decision panel (role-gated) | M2 | ✓ |

Formula Studio canvas switcher is always **Inspiration Canvas · 3D Formula View · 3D Ingredients ·
Molecular Inspector** (FS-06's alternate internal tabs and step sidebar were reconciled into this shell,
per the manifest).
