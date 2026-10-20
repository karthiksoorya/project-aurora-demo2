# Project Aurora — Fragrance Creation Studio (local POC)

A bright, colourful, desktop-first creative tool for perfumers with **six workspaces** — Concept Studio,
Ingredient Explorer, Formula Studio, Validation Studio, Experiment Explorer and Share & Review.
This repository is an independent implementation of the handoff package (`docs/handoff/`), currently at
**milestone M1** (M0 + M1 complete).

| Layer | Technology |
|---|---|
| Frontend | Angular 21 (standalone components, signals, zoneless), SCSS design tokens |
| 3D | Three.js 0.181 (WebGL, OrbitControls, CSS2D labels) |
| Backend | NestJS 11, class-validator DTOs, JSON-file persistence (atomic writes) |
| Tests | Jest (API), Vitest (web units), Playwright 1.56 (browser E2E) |

> Everything runs on your machine. The API binds to `127.0.0.1` only, there is no AI service, no
> database server, no telemetry and no outbound network call. All data is synthetic ("Coastal Air").

---

## 1. Run it (Windows 11, macOS or Linux)

Prerequisites: **Node.js 20.19+ or 22.12+** (LTS) and npm. Nothing else.

```powershell
# from the repository root
npm ci                    # installs both apps from the lockfile
npm run dev               # API on http://127.0.0.1:3000  +  web on http://127.0.0.1:4200
```

Open **http://127.0.0.1:4200**. The landing route opens the most recently updated project in Concept Studio.

| Command | What it does |
|---|---|
| `npm run dev` | API (watch mode) + Angular dev server with `/api` proxy |
| `npm run build` | Production builds of both apps |
| `npm start` | Run the built API (`node apps/api/dist/main`) + web dev server |
| `npm test` | API unit/integration tests (Jest) + web unit tests (Vitest) |
| `npm run e2e` | Playwright suite (builds the API, starts isolated API :3100 + web :4300) |
| `npm run e2e:report` | Open the last Playwright HTML report |
| `npm run lint` | ESLint for both apps (Angular template a11y rules included) |
| `npm run seed:reset` | Delete local demo data; the API reseeds "Coastal Air" on next start |

First E2E run only: `npx playwright install chromium`.

Health check: `GET http://127.0.0.1:3000/health` (alias of `/api/v1/health`).

### Configuration (optional)
See `.env.example`. Variables are read from the environment (set them in the shell):
`AURORA_API_HOST` (default `127.0.0.1`), `AURORA_API_PORT` (`3000`), `AURORA_DATA_DIR`
(default `apps/api/data`), `AURORA_API_URL` (dev-proxy target).

---

## 2. What works in M1

* **Shared shell** — sidebar with exactly six workspace routes, Coastal Air project selector (create new
  projects), global search (ingredients, concepts, versions), Manual / AI Assist switch, audit-trail bell,
  "about this build" help, simulated local user.
* **Concept Studio** (CS-M, CS-A) — edit brief (type, consumer, keywords, description), upload reference
  files and inspiration images (stored locally), inspiration board with filters, concepts (create / select as
  direction / delete), quick creative directions → editable concepts. Explicit **Save Brief** with revision
  check; unsaved edits survive navigation.
* **Ingredient Explorer** (IE-M, IE-A, IE-U1/U2/U3, IE-C) — 25 curated demo ingredients; search + family /
  type / role filters; **3D Ingredient Universe** with picking, orbit/pan/zoom, keyboard control, expanded
  view; list view; detail panel with per-field provenance; constituent list for natural oils; structure for
  curated single compounds; side-by-side comparison of up to 4; explicit "Add to Formula".
* **Formula Studio** (FS-M1/M2/M3, FS-A, FS-3DF, FS-3DI, **FS-06**, FS-VC, FS-MI1/MI2) — editable formula
  table (% w/w, 6 dp), server-computed totals / completeness / accord balance / pyramid, explicit Normalize,
  optional grams for a batch, ingredient library, canvas switcher (**Inspiration Canvas · 3D Formula View ·
  3D Ingredients · Molecular Inspector**), expanded 3D state (FS-06 "3D Exploration (AI Assisted)" in AI
  mode), immutable **Save Version** (SHA-256 hashed), version history, load-version-into-draft, version
  comparison computed from saved snapshots, JSON/CSV export of the draft.
* **Validation / Experiment / Share & Review** — render inside the shared shell with real saved-version
  context and an explicit M2 scope notice (no mock results).
* **AI Assist** — switching mode only changes presentation. The AI partner panel is hideable and states
  honestly that AI is **unavailable**; the only call it makes is a local `GET /api/v1/ai/status`.
  Manual mode makes **zero** AI calls (verified by Playwright).

## 3. Scientific honesty rules (enforced in code and tests)

* Totals, completeness, accord balance and pyramid are deterministic NestJS calculations with BigInt
  fixed-point decimals — never computed only in the browser, never normalised implicitly.
* IFRA status, allergens, sustainability, typical usage, longevity, sillage, projection, tenacity →
  **Not assessed / Data unavailable** (no verified source configured).
* CAS numbers are curator-entered and labelled **Unverified**. Molecular formula and weight for single
  compounds are **Computed** from curated SMILES with RDKit (`tools/build_structures.py`), with a formula
  consistency check; registry verification is marked *pending*.
* Natural oils are mixtures: they show qualitative constituents, never one molecular structure.
* 3D layouts are exploratory groupings by family / role tags — explicitly not measured similarity.
* Descriptor bars are curator tags marked "Demo / illustrative".

## 4. Architecture

```
apps/api/src/
  common/            ids (UUID / deterministic fixture UUIDs), decimal (BigInt % w/w), hash (canonical JSON SHA-256),
                     errors (envelope {code,message,details,requestId}), request-context (request ids, demo identity)
  domain/types.ts    domain model
  fixtures/          demo ingredient catalog, RDKit structure fixtures, Coastal Air seed
  persistence/       repository interfaces + UnitOfWork; JSON adapter (atomic temp-file + fsync + rename, serialized
                     transactional writes, version-hash integrity check on load); fixture catalog repository
  modules/           health, projects (brief, uploads, audit), ingredients, formulas (engine, service, controller), ai (503)
apps/web/src/app/
  core/              api client, project-context (brief, draft save queue, versions), workspace-state (UI state), toasts
  shared/            app-shell, header, nav, AI partner panel, ingredient art/detail, formula table, evidence badge, scene art
  visuals/           three/ (SceneHost, materials, tool rail), ingredient-universe, formula-3d, ingredients-3d, molecular-inspector
  workspaces/        concept, ingredients, formula, planned (M2 workspaces)
e2e/                 Playwright specs, support (network guard, API process control), screenshots (generated)
tools/               build_structures.py (RDKit), verify-screens.mjs (reference hash check), make_compare_sheets.py
docs/                handoff package docs, SCREEN_INDEX, DEVIATIONS, milestone reports
```

API: `/api/v1` — `GET /health`, `GET|POST /projects`, `GET /projects/:id`, `GET|PUT /projects/:id/brief`,
`POST /projects/:id/uploads`, `GET /uploads/:id`, `GET /ingredients`, `GET /ingredients/:id`,
`GET|PUT /projects/:id/formula-draft`, `POST /projects/:id/formula-draft/normalize`,
`GET|POST /projects/:id/formula-versions`, `GET /formula-versions/:id`, `GET /formula-versions/compare`,
`POST /formula-versions/:id/branch`, `GET /projects/:id/audit`, `GET /ai/status`, `* /ai/proposals` → 503.
Stale revisions → **409**, invalid input → **400**, duplicate version label → **409**.

### Local demo identity policy (M1)
There is **no authentication**. Every request is attributed to one simulated local user
("Senior Perfumer", role owner). This is not production auth; real identity and roles are an open decision
(spec §10.6) and arrive with M2's role simulation.

### Persistence
`apps/api/data/aurora-db.json` (+ `uploads/`). Writes are serialized and atomic; a crash cannot leave a
half-written file. Saved versions are append-only and re-hashed on every start (`/health` reports any
mismatch). The JSON adapter is single-process only — PostgreSQL arrives in M3 behind the same interfaces.

## 5. Tooling decisions
* **Storybook: not configured.** Components are workspace-specific and state-heavy; the Playwright visual
  smoke suite (one screenshot per manifest state) gives better review value at this stage. Revisit in M4.
* **Angular 21, not 22:** Angular 22 requires Node ≥ 22.22.3/24.15; 21 runs on Node 20.19+/22.12+, which is
  safer for typical Windows installs.
* Fonts are bundled (`@fontsource-variable/inter`) — no Google Fonts request.
* Reference screenshots are **not** copied into the repo; verify an archive with
  `node tools/verify-screens.mjs <screens-folder>` (SHA-256 against `docs/handoff/ASSET_MANIFEST.json`).

See `docs/SCREEN_INDEX.md`, `docs/DEVIATIONS.md` and `docs/milestones/`.
