# Project Aurora — Consolidated Screen Manifest (implementation baseline)

**Source:** `ScentStudioUpdated.zip`, exactly 27 PNGs. Original bytes preserved.

**Decision:** All 27 images are in scope as primary screens or interaction states. No screenshots or additional UX approval are prerequisites for Codex M0/M1. Primary layout assignments below are design implementation defaults, not retroactive claims of explicit screenshot approval. Any visual conflict is resolved by keeping the six-workspace shell, Manual baseline, and feature register consistent.

| ID | Screenshot path | Workspace | Mode | UI role | Implementation instruction |
|---|---|---|---|---|---|
| CS-M | `screens/1.Aurora Coastal Fragrance Studio.png` | Concept | Manual | Main workspace | Primary Manual baseline |
| CS-A | `screens/1.Aurora AI Fragrance Concept Studio.png` | Concept | AI Assist | Main workspace mode | AI panel state |
| IE-M | `screens/2.Fragrance Ingredient Explorer Dashboard.png` | Ingredient | Manual | Main workspace | Primary Manual baseline |
| IE-A | `screens/2.Ingredient Explorer with AI Creative Partner.png` | Ingredient | AI Assist | Main workspace mode | AI panel state |
| IE-U1 | `screens/2.Aurora Ingredient Universe Dashboard.png` | Ingredient | Manual | Expanded 3D state | 3D Universe baseline; camera and details variants follow |
| IE-U2 | `screens/2.Aurora Ingredient Universe Dashboard check.png` | Ingredient | Manual | 3D selection/details state | Selected ingredient + details/constituent panel |
| IE-U3 | `screens/2.Aurora Fragrance Ingredient Universe.png` | Ingredient | Manual | 3D expanded variant | Alternate camera/composition, not new route |
| IE-C | `screens/2.Aurora Ingredient Comparison Dashboard.png` | Ingredient | Manual | Comparison overlay | Comparison modal/expanded overlay |
| FS-M1 | `screens/3.Aurora Fragrance Formula Studio.png` | Formula | Manual | Main workspace | PRIMARY Formula Manual baseline; tab/canvas/table/balance |
| FS-M2 | `screens/3.Coastal Air Fragrance Studio Dashboard.png` | Formula | Manual | Canvas state | Inspiration canvas focus, not competing main |
| FS-M3 | `screens/3.Aurora Coastal Fragrance Studio Dashboard.png` | Formula | AI Assist | Canvas state | AI contextual partner on Formula canvas; support mode toggle |
| FS-A | `screens/3.Aurora AI Fragrance Studio Dashboard.png` | Formula | AI Assist | Main workspace mode | PRIMARY Formula AI baseline aligned to Manual shell |
| FS-3DF | `screens/3.Aurora Coastal Air Formula Studio 3d formula View.png` | Formula | Manual | Expanded 3D state | 3D Formula view |
| FS-3DI | `screens/3.Aurora 3D Ingredient Formula Studio.png` | Formula | Manual | Expanded 3D state | 3D Ingredients view |
| FS-06 | `screens/3.Aurora Fragrance 3D Exploration Studio.png` | Formula | AI Assist | Expanded 3D AI state | IN SCOPE; 3D exploration + optional hideable suggestions; reconcile alternate internal tabs/sidebar with approved Formula shell |
| FS-VC | `screens/3.Aurora Fragrance Formula Comparison Dashboard.png` | Formula | Manual | Comparison expanded state | Version compare, saved immutable versions only |
| FS-MI1 | `screens/3.Aurora Molecular Inspector Dashboard.png` | Formula | Manual | Inspector panel | Compound-specific single molecular inspector, evidence label |
| FS-MI2 | `screens/3.Molecular Inspector_ Citrus Formula Dashboard.png` | Formula | Manual | Inspector alternate state | Alternate compound focus, reuse same inspector |
| VS-M | `screens/4.Aurora Fragrance Validation Dashboard.png` | Validation | Manual | Main workspace | Primary Manual baseline |
| VS-A | `screens/4.Aurora AI Validation Dashboard.png` | Validation | AI Assist | Main workspace mode | Optional AI explanation, never computed compliance |
| VS-E | `screens/4.Aurora Fragrance Validation Dashboard Check.png` | Validation | Manual | Evidence expanded state | Evidence details, not-assessed defaults |
| EE-M1 | `screens/5.Aurora Fragrance Experiment Explorer Dashboard.png` | Experiment | Manual | Main workspace | Primary experiment Manual baseline: history, version compare, branching |
| EE-A | `screens/5.Aurora Fragrance Experiment Explorer.png` | Experiment | AI Assist | Main workspace mode | AI Creative Partner visible |
| EE-X | `screens/5. Aurora Fragrance Experiment Explorer.png` | Experiment | Manual | Branching expanded state | Graph/canvas expanded state |
| SR-M | `screens/6.Aurora Coastal Air Review Dashboard.png` | Review | Manual | Main workspace | Primary Manual version history and permissions |
| SR-A | `screens/6.AI-Assisted Fragrance Review Dashboard.png` | Review | AI Assist | Main workspace mode | Optional AI review assistance |
| SR-X | `screens/6.Aurora Fragrance Review Dashboard.png` | Review | Manual | Review expanded state | Formula snapshot, comments and status |

## FS-06 — resolved, no separate approval gate

FS-06 is a **required AI Assist state within Formula Studio**. It is neither a seventh workspace nor a replacement for the Formula Studio Manual main screenshot. Use the same global header, navigation, project selection, formula state and 3D canvas controls as the primary Formula Studio design. Its visual is a reference for the expanded olfactive 3D view, selected ingredient context and optional AI suggestions. Clicking suggestions presents a pending proposal/preview; no automatic changes. Closing the AI panel keeps the canvas working; switching to Manual preserves selection/camera/draft.

## Decisions for screenshot ambiguities

- Formula Manual canonical layout: `FS-M1`; `FS-M2` inspiration canvas state; `FS-M3` AI/context state; `FS-A` AI main. Do not count alternatives as separate pages.
- Ingredient 3D Universe: `IE-U1` baseline, `IE-U2` selection detail, `IE-U3` expanded/camera variant. All three represent one component, not three independent modules.
- Molecular Inspector: `FS-MI1` reusable inspector; `FS-MI2` compound selection variant. Verify constituent/compound references before drawing any molecular structure.
- Experiment: `EE-M1` Manual main, `EE-A` AI mode, `EE-X` expanded branching canvas.
- Share/Review: `SR-M` Manual main, `SR-A` AI main, `SR-X` expanded review/comments.
- No assumption that mockup labels, quantitative scores, CAS IDs, compliance findings or chemical images are scientifically verified. Replace with honest missing data when no verified source is configured.

## UI implementation state versus screen

Implement **six Angular workspace routes**; render the remaining screenshot designs through tabs, 3D view modes, panels, expanded states and comparison overlays. The tab structure shown in one variant cannot overwrite the established Formula Studio canvas switcher (`Inspiration Canvas`, `3D Formula View`, `3D Ingredients`).
