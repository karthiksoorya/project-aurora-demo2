# M2 — Complete Manual workflow · COMPLETE

**Scope:** Validation Studio, Experiment Explorer and Share & Review become real workflows on top of the M1
slice, with simulated users and per-project roles. Still local only: JSON persistence, no PostgreSQL, no AI
calls, no outbound network.

**Decisions confirmed by the product owner before M2:** saving incomplete versions is allowed and labelled;
drawn art plus user uploads (no stock photos); one global Manual / AI switch; simulated users (no real login).

## Test results (this build)
| Suite | Result |
|---|---|
| API Jest (unit + HTTP integration) | **34 / 34 passed** — M1 23 + M2 11 (roles 401/403/422, validation determinism + stale + FC-001 fail, experiments + typed measurements + lineage + branch parent, reviews: no self-approval, comment vs approve permission, withdraw, audit; schema v1→v2 upgrade with backup) |
| Web Vitest (units) | **5 / 5 passed** |
| Playwright E2E (Chromium, 1672×941) | **25 / 25 passed** in 13.8 min (M0 3, M1 gate 1, formula 4, context 4, 3D 5, science 2, visual smoke 1 → now 27 states, M2 journeys 5) |
| ESLint (api + web incl. template a11y) | clean |

### M2 journeys (Playwright)
| Spec | Journey | Acceptance |
|---|---|---|
| `m2-a` J1 | Save a complete version → validate for EU fine fragrance → formula checks pass, IFRA/allergens **Not assessed**, overall *Not assessed* (never "Compliant"), evidence hash = version hash, history marks *Current* | A8 |
| `m2-a` J2 | Save an incomplete version → FC-001 **Fail**; older run flagged **Stale**; reviewer cannot run validation (403) | A8, A11 |
| `m2-b` J3 | New experiment on an exact version; measurement blocked until quantity/value/method given; hypothesis labelled; Create Branch → edit → save child; lineage parent = base version; survives reload | A9 |
| `m2-c` J4 | Owner requests review (PD approve, RA comment); owner cannot self-approve; RA comments (read-only banner, no decision); PD approves; audit filter shows request / comment / decision with actor and version | A10, A11 |
| `m2-c` J5 | Viewer: read-only banner, Request Review / Save Version / Run Validation disabled, quantities read-only, no comment form; API 403 for viewer comment, decision, observation | A11 |

Visual smoke (`m1-f`) now seeds a synthetic history and captures all 27 manifest states, including
**VS-E, EE-X and SR-X**.

## Implemented
**API**
* `common/request-context` — AsyncLocalStorage user from `x-aurora-user`; four fixed demo users; unknown → 401.
* `modules/access` — users, me, members, role change (owner-only, last owner protected).
* `modules/validations` — rule-set registry (`aurora-formula-checks` evaluated; `ifra-standards`,
  `eu-cosmetics-allergens` declared *datasetConfigured: false* with missing inputs), deterministic engine,
  immutable runs, stale annotation (newer versions · draft changed · catalog changed).
* `modules/experiments` — experiments on versions, typed observations, status, lineage graph data.
* `modules/reviews` — review requests with per-reviewer permission, comments, decisions, withdraw.
* Persistence schema v2 (memberships, validations, experiments, reviews) with forward upgrade + backup.
* Every write is role-checked and audited.

**Web**
* Header user switcher, read-only banner, role-aware controls; HTTP interceptor sends the simulated user.
* `ValidationStudioComponent` (tabs Checks · Standards & Coverage · Evidence & Reports · History).
* `ExperimentExplorerComponent` + `LineageGraphComponent` (tabs Experiment History · Branching View · Compare · Notes).
* `ShareReviewComponent` (tabs Versions · Feedback · Audit), request-review dialog, decision panel.
* `StatusChipComponent` for Pass / Warning / Fail / Not assessed / review states.

## Scientific honesty in M2
* Overall status precedence: Fail > Not assessed > Warning > Pass. With a not-configured rule set selected,
  the best possible result is *Not assessed*.
* No compliance language ("Compliant", "Safe", "Approved for market") is produced by the engine; a review
  "Approved" is a human decision about a version, recorded with who and why.
* No performance numbers are generated; only scientist-recorded measurements are shown, with method and unit.

## Bugs found by the tests and fixed
* Validation overview could switch back to the latest run's version when the user picked a version while runs
  were still loading — the user's choice now wins.
* Recording an observation reset the note type chosen while the save was in flight — only the text fields reset now.

## Known limitations / next
* Simulated identity is not security (anyone local can act as anyone).
* IFRA / allergen evaluation needs a licensed, verified dataset — then the placeholders become real rule sets.
* **M3:** PostgreSQL via Docker behind the same repository interfaces, migrations, data import from JSON.
* **M4:** AI Assist provider integration — only after explicit approval.

## Screens (manifest IDs)
All **27 / 27** states implemented; M2 adds VS-M, VS-A, **VS-E**, EE-M1, EE-A, **EE-X**, SR-M, SR-A, **SR-X**.
Evidence: `docs/review/screens/<ID>.jpg` and `docs/review/<ID>-compare.jpg` (reference left, implementation right).
Mapping: `docs/SCREEN_INDEX.md`. Visual deviations (no "Compliant" badges, no invented performance metrics,
in-app members instead of external share links): `docs/DEVIATIONS.md` §B 9–11.

## Run the M2 demo
`npm ci` → `npm run dev` → open http://localhost:4200. In Formula Studio save a version, open **Validation
Studio** → *Run Validation*; open **Experiment Explorer** → *New Experiment*, add notes, *Branching View* →
*Create Branch*; open **Share & Review** → *Request Review*, then use the header user menu to act as
Product Development (approve) or Marketing (read-only).
