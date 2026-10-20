# M3 — PostgreSQL persistence · COMPLETE

**Scope:** replace the single-process JSON file with PostgreSQL behind the existing repository interfaces,
with versioned migrations, Docker Compose for local use, and a one-time import of M1/M2 data. No UI workflow
changes; no AI; still private-by-default (database bound to 127.0.0.1).

## Test results (this build)
| Suite | Result |
|---|---|
| API Jest on **PostgreSQL** (`npm run test:pg`) | **41 / 41 passed** (+1 JSON-only upgrade test skipped) — the full M1/M2 HTTP suite plus 8 PostgreSQL guarantees |
| API Jest on JSON (`npm test`) | **34 / 34 passed** (PostgreSQL-only tests skipped) |
| Web Vitest | **5 / 5 passed** |
| Playwright E2E on **PostgreSQL** (`E2E_DATABASE_URL=… npm run e2e`) | **26 / 26 passed** in 14.1 min (all M0–M2 journeys + visual smoke + new `m3-a`) — also 25/26 → 26/26 on the JSON fallback after the fix below |
| ESLint (api incl. `no-floating-promises`, `no-misused-promises`; web) | clean |

### PostgreSQL guarantees under test (`apps/api/src/test/pg.spec.ts`)
1. `/health` reports `adapter: postgresql`, `schemaVersion: migration-001`, verified hashes, redacted credentials.
2. Migrations are applied once, re-runs are no-ops, and an edited, already-applied migration is detected (checksum).
3. Saved versions and audit events cannot be updated or deleted — even with direct SQL (trigger `AURORA_IMMUTABLE`).
4. Quantities are exact `numeric(12,6)`; > 100 % is rejected by a CHECK; unknown ingredients by a foreign key.
5. 8 concurrent draft saves on the same revision → exactly one 200, seven 409.
6. Two API instances on one database: the same version save races → one 201, one 409, one row.
7. A failing unit of work rolls back every statement it made.
8. JSON → PostgreSQL import copies data exactly, re-verifies hashes, refuses a second import and refuses
   tampered source files.
Plus the M1 tamper test runs on PostgreSQL: a snapshot changed behind the API's back is reported as
`degraded` with the version id.

## Implemented
* **Async repository contract** — all repository methods return promises; services await them inside one
  unit of work (`read` / `write`). Type-aware lint rules guard against un-awaited calls.
* **`PgUnitOfWork`** (`persistence/pg/`) — `pg` pool; writes = one transaction + transaction-scoped advisory
  lock (race-free revision checks across processes); reads = `REPEATABLE READ READ ONLY`; DB errors mapped
  to the API error envelope (409 unique / immutable, 422 constraint).
* **Migration 001** — 17 tables (+ `schema_migrations`): users, catalog mirror, projects, members, briefs, uploads, versions (+ label
  uniqueness, hash format, snapshot/label consistency checks), drafts + lines, audit, validation runs,
  experiments + observations (measurement completeness check), reviews + reviewers / comments / decisions;
  append-only triggers on all evidence tables; indexes for every list query.
* **Migrator** — `NNN_name.sql` files, SHA-256 checksums in `schema_migrations`, advisory lock, each
  migration in its own transaction; auto-applied on API start (`AURORA_DB_MIGRATE=off` to require
  `npm run db:migrate`).
* **Reference data sync** — simulated users and the versioned ingredient catalog are upserted on start so
  foreign keys always resolve; the demo project is seeded into an empty database (`AURORA_SEED=off` to skip).
* **CLI** — `npm run db:migrate`, `db:status`, `db:import -- <file>`; `.env` support (Node built-in loader).
* **Docker Compose** — `postgres:16-alpine`, port bound to 127.0.0.1, named volume, health check;
  `npm run db:up` waits until healthy.
* **Adapter selection** — `DATABASE_URL` set → PostgreSQL; otherwise the JSON file (zero-setup demo).
* **E2E on PostgreSQL** — `E2E_DATABASE_URL` recreates a dedicated `aurora_e2e` database per run; new
  `m3-a` spec checks the reported adapter and that validation, experiment and review evidence survives an
  API restart. "About this build" now shows which storage the running API uses.

## Bugs found and fixed
* UI state (selection, canvas mode) could be lost when the page was reloaded within a few milliseconds of a
  click: the save ran in an async effect. It is now also written synchronously on `pagehide`.
* The un-prefixed `/health` alias returned an empty body once health became async — fixed and covered.

## How to run
```powershell
npm ci
copy .env.example .env      # sets DATABASE_URL
npm run db:up               # Docker Desktop must be running
npm run dev                 # migrations + seed happen automatically on first start
npm run db:import           # optional: bring over apps/api/data/aurora-db.json from M1/M2 (empty DB only)
```

## Notes and limits
* Writes are serialised database-wide (one advisory lock). Simple and correct for a POC team; per-project
  locking is the next step if many users write at once.
* Upload bytes stay on disk (`AURORA_DATA_DIR/uploads`); the database stores their metadata.
* Compose credentials (`aurora/aurora`) are local demo values; change them before any shared deployment.
* Identity is still simulated (no login). AI Assist (M4) remains off pending explicit approval.
