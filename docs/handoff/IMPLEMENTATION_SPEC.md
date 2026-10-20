# Project Aurora — Implementation Specification v1.0

## 0. Product intent and boundaries
Premium, desktop-first, bright and colorful creative tool for fragrance scientists, especially expert perfumers. **Six flexible workspaces**: Concept Studio, Ingredient Explorer, Formula Studio, Validation Studio, Experiment Explorer, Share & Review. Navigation is nonlinear; no mandatory wizard. Use a neutral product identity **Aurora Fragrance Creation Studio** and synthetic `Coastal Air` project. Never add employer name, logo, actual internal formulas, or proprietary data.

### Hard constraints
- Angular (current compatible stable version selected by Codex) + TypeScript UI; NestJS API; Three.js 3D; Playwright browser tests; Docker for local infrastructure; PostgreSQL after mock-first acceptance. No Figma requirement. Storybook optional **only when useful** and Codex owns setup.
- Screenshots in this package’s `screens/` directory (unchanged from `ScentStudioUpdated.zip`) are the authoritative visual source; use `SCREEN_MANIFEST_FINAL.md` for resolved implementation baseline roles. No CSS redesign or dark theme. One shared product shell, consistent workspaces.
- Manual mode is fully usable offline and makes **zero LLM calls**. Mode switch cannot change formula state. AI Assist can be switched on and partner panel hidden; disabled mode shows honest unavailable state, never fake live suggestions.
- Formula editing, saved version creation, calculation and validation are deterministic NestJS domain services, **not LLM responses**.
- Unknown scientific or regulatory input => `Not assessed` / `Data unavailable`; never invent IFRA pass/fail, allergen exposure, compound structure, measured odor, sustainability or model performance.
- 3D concept clusters are exploratory UI visualization, *not* validated chemistry or sensory prediction. Molecular inspector renders a verified **single compound** (e.g. limonene), never a natural oil as one molecular structure.
- Versioned artifacts are immutable and linked: a validation, experiment or review must reference a saved formula version ID. AI suggestions are untrusted diffs requiring explicit scientist acceptance.
- No public deployment, outbound AI API, externally connected data or authentication provider without user approval.

## 1. Delivery milestones and exit gates
### M0 — repository + traceability
- Initialize Angular frontend and NestJS backend in one local workspace with distinct apps. TypeScript strict, lint/format, test tasks, `.env.example`, explanatory README.
- Index all 27 included screenshots using `SCREEN_MANIFEST_FINAL.md`. Canonical and alternate assignments are already resolved as implementation baselines; log fidelity issues for iterative review rather than blocking M0/M1.
- Create shared UI tokens (light background, cards, gradients, spacing, typography, shadows), common shell, routing, accessible navigation and mock project fixture.
- **Gate:** both apps start locally; `/health` returns healthy; six routes render expected shared shell; no external calls by default.

### M1 — thin, functional Manual slice (FIRST DEMO)
- Concept Studio: edit brief, inspirations, selected directions and save. Ingredient Explorer: searchable/filtered local ingredient catalog; details, select and add to working formula.
- Formula Studio: deterministic editable formula table; add/delete ingredients, quantities, unit labels; validated mass fractions, total calculation; save immutable snapshots and compare v1/v2. JSON-backed repository for persistence through server restart, written atomically, or SQLite **only with an explicit approval** (default JSON). NestJS owns business rules.
- Formula Studio canvases: Inspiration Canvas plus initial functional Three.js 3D Formula and 3D Ingredients switcher (orbit/pan/zoom, selection synchronization). Ingredient Universe is an additional Three.js client scene.
- Manual/AI toggle visibly switches presentation without state loss; AI disabled indicates unavailable or demo-only, with no fake network service.
- **Gate:** create concept -> select ingredient -> edit formula -> save v1 -> refresh/restart -> inspect v1 unchanged -> edit draft -> save v2 -> compare. Playwright E2E passing.

### M2 — complete Manual workflow
- Validation: base numerical/formula checks only and documented rule coverage; for unprovided official regulatory data show `Not assessed`. Specific market/category and dataset/rule-set version selection, provenance UI, stale-results behavior.
- Experiment: log observations against exact saved formula versions; create branches from versions; compare notes/data across branches, no predicted measurements unless sourced.
- Share & Review: local-role demonstration (owner, reviewer, viewer); permission-checked reviews and comments, version-specific sharing and audit history. For POC avoid exposing host/network; local simulated users only until auth is designed.
- **Gate:** 5 cross-workspace journeys pass end-to-end; approvals authorization tested; no invented science claims.

### M3 — PostgreSQL via Docker
- Codex creates `docker-compose.yml` for local PostgreSQL with loopback-bound host port, named volume, healthcheck, env secret file excluded from VCS; migration and seed scripts; no cloud dependency.
- Implement PostgreSQL repository adapters preserving M1/M2 domain interfaces. Migration plan moves JSON fixture data safely. Use decimal `numeric`, transactions for version save, optimistic draft revision (409 conflict), migrations with down/recovery strategy.
- Database constraints and service tests ensure immutable versions, project scope and referential integrity. Separate isolated test DB and reset strategy.
- **Gate:** run equivalent E2E suite against Postgres; restart containers -> data persists; DB can be rebuilt and seeded deterministically.

### M4 — optional AI Assist and polish
- Only after explicit approval, implement isolated NestJS AI gateway with privacy controls; audit prompt/template versions, proposals and human acceptance. No writes from model to formula or review.
- Build contextual AI partner, diff preview/accept/reject, suggested ingredient alternatives, scientifically cautious narrative. Manual mode proven functional with gateway unplugged.
- Inspect all 27 screens to achieve layout fidelity, refine image variants against the approved design direction in visual review, complete accessibility/responsive and browser tests.
- **Gate:** user approves AI endpoint and data policy; E2E proves rejection changes nothing and acceptance updates draft only.

## 2. Angular app architecture
```
apps/web/src/app/
  core/{api,auth,project-context,workspace-state,errors}/
  shared/{app-shell,sidebar,mode-switch,project-header,contextual-panel,
          version-selector,ingredient-card,formula-table,confirm-dialog,
          empty-state,loading-state,source-evidence}/
  workspaces/{concept,ingredients,formula,validation,experiments,review}/
  visuals/{ingredient-universe,formula-3d,ingredients-3d,molecular-inspector}/
```
Six application routes under `/projects/:projectId/{concept,ingredients,formula,validation,experiments,review}` with optional landing redirect. Panels/dialogs are local UI state, optionally query-param deep-linkable; avoid extra full page routes for every screenshot. Preserve `currentProjectId`, `currentDraftId`, `selectedIngredientId`, `canvasMode`, `3DCameraState`, `mode` and `aiPanelVisible` per workspace. Keep shared session state stable across navigation/mode changes; drafts persist to NestJS. Design tokens central; no embedded screenshots as full-page background.

Three.js layers: semantic object selection, raycast picking, orbit control, keyboard/focus alternative, dispose GPU geometry/materials and animation loops on unmount, accessible 2D selection fallback, deterministic positions for reproducible screenshots, realistic performance targets and no scientifically unsupported proximity claims. Molecular structure must come from curated verified structure fixtures and show source/compound identifier; a natural mixture displays constituents with per-compound inspector.

## 3. NestJS domain boundaries
```
apps/api/src/
  modules/{health,projects,concepts,ingredients,formulas,validations,
           experiments,reviews,access,audit,ai-proposals}/
  persistence/{repository-interfaces,json-adapters,postgres-adapters}/
  common/{errors,guards,validation,logging}/
```
Use DTO validation at all API boundaries; project-scoped access controls; explicit domain services. Never compute totals or validation results solely in Angular. `IngredientCatalogRepository`, `ProjectRepository`, `FormulaRepository`, etc., abstract persistence. JSON adapter is transitional; not suitable for concurrent multiuser editing. Use atomic write/rename and revision numbers to reduce partial writes in M1.

## 4. Data invariants
- Formula draft item: stable `lineId`, valid ingredient ID, `massPct` as decimal string for API precision, `massPct >= 0`; total across draft rows computed deterministically. Whether total must equal 100% on save is a **policy decision**: initial design should mark incomplete draft clearly and require explicit normalization/complete formula before *finalizing* an assessment, not silently normalize user inputs.
- Immutable snapshot includes item identifiers, names/strength/unit as needed, mass fractions, source/version references, creator/time, hash and parent version ID; never mutate or delete history implicitly.
- Review/experiment/validation reference `formulaVersionId`, not an unversioned draft.
- Catalog properties carry source name, identifier, retrieval/verification timestamp and explicit missing-data status.
- AI proposal records scope, exact draft/version baseline, structured diff, human decision and audit metadata; conflicts block stale acceptance.
- Authorization enforced in NestJS even when UI hides controls.

## 5. API contracts (proposed v1)
Prefix `/api/v1`; JSON, request IDs, stable error envelope `{code,message,details,requestId}`. IDs UUID. Pagination/cursor for lists; optimistic updates use revision ETags or `revision` in bodies. All examples contain **synthetic** data.

| Method | Endpoint | Request/behavior | Response / notes |
|---|---|---|---|
| GET | `/health` | none | `{status:'ok'}` |
| GET | `/projects` | query page | project summaries |
| POST | `/projects` | `{name}` | `201 Project` |
| GET | `/projects/:projectId` | none | project, draft pointers |
| GET/PUT | `/projects/:projectId/brief` | PUT `{revision,content}` | revised brief; conflict=409 |
| GET | `/ingredients` | `q,descriptors,kind,page` | paged IngredientSummary |
| GET | `/ingredients/:ingredientId` | none | properties + per-field source + missing data |
| GET | `/projects/:projectId/formula-draft` | none | draft items and revision |
| PUT | `/projects/:projectId/formula-draft` | `{revision,items:[{lineId,ingredientId,massPct,position}]}` | normalized **display only** total + new revision; 409 conflict |
| POST | `/projects/:projectId/formula-versions` | `{expectedDraftRevision,versionLabel,parentVersionId?}` | 201 immutable snapshot/version |
| GET | `/projects/:projectId/formula-versions` | none | version history |
| GET | `/formula-versions/:versionId` | none | saved snapshot |
| GET | `/formula-versions/compare` | `leftId,rightId` | row-level differences computed from snapshots |
| POST | `/formula-versions/:versionId/branch` | none | new editable draft based on version |
| POST | `/validations` | `{formulaVersionId,market,category,ruleSetId?}` | status, findings, coverage/missing inputs |
| GET | `/validations/:runId` | none | evidence sources and run snapshot |
| POST | `/experiments` | `{formulaVersionId,protocol}` | linked experiment |
| POST | `/experiments/:id/observations` | `{observation}` | persisted observation |
| GET | `/projects/:projectId/experiments` | filters | chronology and ancestry |
| POST | `/reviews` | `{formulaVersionId,reviewers,permissions}` | review request |
| POST | `/reviews/:id/comments` | `{comment}` | comment with author/time |
| POST | `/reviews/:id/decisions` | `{decision,reason}` | role-authorized change + audit |
| GET | `/projects/:projectId/audit` | filters | immutable event feed |
| POST | `/ai/proposals` | optional **later** | human-reviewable suggestion, never direct mutation |
| POST | `/ai/proposals/:id/decision` | `{decision,expectedDraftRevision}` | guarded apply or reject |

### Example draft update
```json
{
  "revision": 3,
  "items": [
    {"lineId":"example-line-1","ingredientId":"<valid-id>","massPct":"12.500000","position":0},
    {"lineId":"example-line-2","ingredientId":"<valid-id>","massPct":"87.500000","position":1}
  ]
}
```
`<valid-id>` is placeholder text only, not an actual UUID to send. API must validate decimals, uniqueness of line IDs, project permissions and stale revisions.

### Error behavior
400 for invalid input, 401 unauthenticated, 403 forbidden, 404 scoped resource absent, 409 stale revision/duplicate version label, 422 impossible domain operation, 503 gated AI unavailable. In mock-only M1, document the local demo identity policy explicitly (not pretend it is production authentication).

## 6. Data design: JSON-first then PostgreSQL
`schema_proposal.sql` describes table boundaries. Additional real tables required for full product: users, memberships, per-review ACLs, inspirations, version-line snapshot normalization (if needed), regulatory rules and coverage, attachments and source revisions. Implement migrations based on policy decisions, never treat illustrative mock outcomes as real compliance.

Use synthetic seed fixtures with traceable fictional descriptions. Ingredient names like limonene, hedione or bergamot EO can be used as product examples; their properties and molecular structures must be verified or clearly marked illustrative. Natural oil is a mixture and cannot be rendered as a single molecular entity.

## 7. Scientific credibility and privacy gate
- Formula engine: documented units, precision, totals and normalization; no faux stability/performance scores.
- Standards: validation rule requires edition/version, market, product category, concentration context, rule identifier, data input confidence and evidence. Missing any essential field -> `not_assessed` (not green compliance).
- Experiment findings: subjective observation vs measurement vs model hypothesis distinctly labeled.
- AI: prompt injection isolation, privacy check before outbound transmission, audit proposal origin and accept/reject, never autonomous share/publish/approve.
- Private-first: loopback local services, secrets out of git, no public endpoints, no external telemetry by default, anonymized/synthetic data, backup local database volume and audit data.

## 8. QA and Playwright acceptance suite
- A1: Navigation across all six workspaces keeps current project and unsaved formula context.
- A2: Manual/AI switch preserves formula table, selected ingredient, canvas view and selection; Manual causes zero AI calls.
- A3: Search/filter/3D Universe/table/detail selection synchronize; selected ingredient adds to draft only with explicit action.
- A4: Formula math: decimal precision, total, validation of invalid/negative quantities, no implicit normalization.
- A5: Save v1 snapshot, change draft, save v2; v1 hash/items remain unchanged, comparison uses saved data.
- A6: 3D switcher works for both modes; orbit controls, point selection and fallback; memory cleanup on route exit.
- A7: A natural oil presents constituent list, while a verified compound displays its sourced molecular structure.
- A8: Missing regulatory rule/category data yields `Not assessed`; no invented success claim.
- A9: Experiment attaches to exact version and branching provenance persists.
- A10: Read-only reviewer can view/comment only as permitted, never modify/approve.
- A11: Share/review actions append audit events and reflect saved version ID.
- A12: Refresh and NestJS restart preserve saved data (M1 JSON file; M3 DB and container restart).
- A13: API rejects stale revision with 409 and never loses newer edits.
- A14: Disabled AI gateway/offline run leaves all Manual screens operational.
- A15: Visual smoke screenshots at 1672x941 reference viewport; test shell/nav/sidebar/mode switch and workspace landmarks. Human visual signoff required, don't overstate pixel-perfect similarity.

## 9. Codex work protocol
- At start, produce a terse inventory and milestone plan; flag visual ambiguity as a decision. Do **not** ask user to select every interaction popup.
- Implement M0+M1 before deploying database or AI. Use versioned commits and runnable scripts.
- After each milestone, provide: changed modules, `npm` / docker commands to start, screens implemented with manifest IDs, automated test results, remaining gaps, screenshot evidence, and explicit requests for decisions.
- Do not rewrite requirements or substitute generic admin dashboards for approved 3D scientific workspaces.
- Respect original image archive; never edit and overwrite it.

## 10. Decisions still open
1. Select canonical Formula Studio Manual image among FS-M1/M2/M3.
2. Select Ingredient Universe canonical image among IE-U1/U2/U3.
3. Molecular Inspector alternatives: same flow vs distinct instances.
4. Experiment/Share alternate image roles and mode toggle.
5. Accept FS-06 visually against approved Formula parent.
6. For POC, choose an explicit local demo identity/role simulation until secure auth requirements are determined.
7. Formula completion rule (draft total != 100 allowed; validation may require complete 100% formula).

These are intentional **approval gates**, not permission for Codex to invent product choices.
