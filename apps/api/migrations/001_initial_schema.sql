-- Project Aurora · migration 001 · initial PostgreSQL schema (M3)
-- Derived from docs/handoff/schema_proposal.sql and the M2 domain model.
-- Conventions: mass fractions are numeric(12,6) % w/w (never floats); timestamps are timestamptz (UTC);
-- evidence records (versions, validation runs, audit, observations, comments, decisions) are append-only
-- and protected by triggers, not only by application code.

CREATE TABLE app_users (
  id          uuid PRIMARY KEY,
  name        text NOT NULL,
  initials    text NOT NULL,
  title       text NOT NULL,
  is_simulated boolean NOT NULL DEFAULT true
);

-- Mirror of the curated ingredient catalog (source of truth: versioned fixture in code).
-- Kept in the database so formula lines have referential integrity.
CREATE TABLE catalog_ingredients (
  id              uuid PRIMARY KEY,
  slug            text NOT NULL UNIQUE,
  name            text NOT NULL,
  kind            text NOT NULL CHECK (kind IN ('single_compound','natural_mixture','blend','other')),
  catalog_version text NOT NULL,
  data            jsonb NOT NULL,
  synced_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE projects (
  id          uuid PRIMARY KEY,
  name        text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  status      text NOT NULL CHECK (status IN ('draft','archived')),
  summary     text NOT NULL DEFAULT '',
  created_by  uuid NOT NULL REFERENCES app_users(id),
  created_at  timestamptz NOT NULL,
  updated_at  timestamptz NOT NULL
);
CREATE UNIQUE INDEX projects_name_ci ON projects (lower(name));

CREATE TABLE project_members (
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES app_users(id),
  role        text NOT NULL CHECK (role IN ('owner','reviewer','viewer')),
  updated_at  timestamptz NOT NULL,
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE creative_briefs (
  project_id  uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  revision    integer NOT NULL CHECK (revision > 0),
  content     jsonb NOT NULL,
  updated_at  timestamptz NOT NULL,
  updated_by  uuid NOT NULL REFERENCES app_users(id)
);

-- File bytes live on disk (AURORA_DATA_DIR/uploads); the database holds metadata.
CREATE TABLE uploads (
  id            uuid PRIMARY KEY,
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  original_name text NOT NULL,
  stored_name   text NOT NULL UNIQUE,
  mime          text NOT NULL,
  size_bytes    integer NOT NULL CHECK (size_bytes >= 0 AND size_bytes <= 5242880),
  created_at    timestamptz NOT NULL
);
CREATE INDEX uploads_project ON uploads (project_id);

CREATE TABLE formula_versions (
  id                uuid PRIMARY KEY,
  project_id        uuid NOT NULL REFERENCES projects(id),
  version_label     text NOT NULL CHECK (length(btrim(version_label)) BETWEEN 1 AND 60),
  parent_version_id uuid REFERENCES formula_versions(id),
  snapshot          jsonb NOT NULL,
  snapshot_hash     text NOT NULL CHECK (snapshot_hash ~ '^[0-9a-f]{64}$'),
  hash_algorithm    text NOT NULL CHECK (hash_algorithm = 'sha256-canonical-json-v1'),
  total_pct         numeric(12,6) NOT NULL,
  completeness      text NOT NULL CHECK (completeness IN ('complete','incomplete','over')),
  saved_by          uuid NOT NULL REFERENCES app_users(id),
  saved_at          timestamptz NOT NULL,
  CHECK (snapshot->>'versionLabel' = version_label),
  CHECK (snapshot->>'projectId' = project_id::text)
);
CREATE UNIQUE INDEX formula_versions_label_ci ON formula_versions (project_id, lower(version_label));
CREATE INDEX formula_versions_project ON formula_versions (project_id, saved_at);

CREATE TABLE formula_drafts (
  id                  uuid PRIMARY KEY,
  project_id          uuid NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  based_on_version_id uuid REFERENCES formula_versions(id),
  revision            integer NOT NULL CHECK (revision > 0),
  batch_size_g        numeric(12,3) NOT NULL CHECK (batch_size_g > 0),
  updated_at          timestamptz NOT NULL,
  updated_by          uuid NOT NULL REFERENCES app_users(id)
);

CREATE TABLE formula_draft_items (
  draft_id      uuid NOT NULL REFERENCES formula_drafts(id) ON DELETE CASCADE,
  line_id       uuid NOT NULL,
  ingredient_id uuid NOT NULL REFERENCES catalog_ingredients(id),
  mass_pct      numeric(12,6) NOT NULL CHECK (mass_pct >= 0 AND mass_pct <= 100),
  position      integer NOT NULL CHECK (position >= 0),
  PRIMARY KEY (draft_id, line_id),
  UNIQUE (draft_id, position) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE audit_events (
  seq          bigserial PRIMARY KEY,
  id           uuid NOT NULL UNIQUE,
  project_id   uuid NOT NULL REFERENCES projects(id),
  actor_id     uuid NOT NULL REFERENCES app_users(id),
  actor_name   text NOT NULL,
  action       text NOT NULL,
  target_type  text NOT NULL,
  target_id    text NOT NULL,
  payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at  timestamptz NOT NULL
);
CREATE INDEX audit_project_seq ON audit_events (project_id, seq DESC);
CREATE INDEX audit_project_action ON audit_events (project_id, action text_pattern_ops);
CREATE INDEX audit_target ON audit_events (target_id);

CREATE TABLE validation_runs (
  id                 uuid PRIMARY KEY,
  project_id         uuid NOT NULL REFERENCES projects(id),
  formula_version_id uuid NOT NULL REFERENCES formula_versions(id),
  version_label      text NOT NULL,
  snapshot_hash      text NOT NULL,
  market             text NOT NULL,
  product_category   text NOT NULL,
  rule_set_ids       text[] NOT NULL,
  status             text NOT NULL CHECK (status IN ('pass','warning','fail','not_assessed')),
  summary            jsonb NOT NULL,
  coverage           jsonb NOT NULL,
  findings           jsonb NOT NULL,
  evaluated_by       uuid NOT NULL REFERENCES app_users(id),
  evaluated_at       timestamptz NOT NULL,
  engine_version     text NOT NULL
);
CREATE INDEX validation_runs_project ON validation_runs (project_id, evaluated_at DESC);

CREATE TABLE experiments (
  id                 uuid PRIMARY KEY,
  project_id         uuid NOT NULL REFERENCES projects(id),
  formula_version_id uuid NOT NULL REFERENCES formula_versions(id),
  version_label      text NOT NULL,
  title              text NOT NULL,
  protocol           jsonb NOT NULL,
  status             text NOT NULL CHECK (status IN ('planned','in_progress','completed')),
  created_by         uuid NOT NULL REFERENCES app_users(id),
  created_at         timestamptz NOT NULL
);
CREATE INDEX experiments_project ON experiments (project_id, created_at DESC);

CREATE TABLE experiment_observations (
  seq              bigserial PRIMARY KEY,
  id               uuid NOT NULL UNIQUE,
  experiment_id    uuid NOT NULL REFERENCES experiments(id),
  kind             text NOT NULL CHECK (kind IN ('observation','measurement','hypothesis')),
  text             text NOT NULL,
  measurement      jsonb,
  recorded_by      uuid NOT NULL REFERENCES app_users(id),
  recorded_by_name text NOT NULL,
  recorded_at      timestamptz NOT NULL,
  -- a measurement must carry quantity, value, unit (may be empty for dimensionless) and method
  CHECK (kind <> 'measurement' OR (measurement ? 'quantity' AND measurement ? 'value' AND measurement ? 'unit' AND measurement ? 'method')),
  CHECK (kind = 'measurement' OR measurement IS NULL)
);
CREATE INDEX observations_experiment ON experiment_observations (experiment_id, seq);

CREATE TABLE review_requests (
  id                 uuid PRIMARY KEY,
  project_id         uuid NOT NULL REFERENCES projects(id),
  formula_version_id uuid NOT NULL REFERENCES formula_versions(id),
  version_label      text NOT NULL,
  snapshot_hash      text NOT NULL,
  title              text NOT NULL,
  message            text NOT NULL DEFAULT '',
  status             text NOT NULL CHECK (status IN ('submitted','changes_requested','approved','rejected','withdrawn')),
  requested_by       uuid NOT NULL REFERENCES app_users(id),
  created_at         timestamptz NOT NULL,
  updated_at         timestamptz NOT NULL
);
CREATE INDEX review_requests_project ON review_requests (project_id, created_at DESC);

CREATE TABLE review_reviewers (
  review_id  uuid NOT NULL REFERENCES review_requests(id),
  user_id    uuid NOT NULL REFERENCES app_users(id),
  permission text NOT NULL CHECK (permission IN ('comment','approve')),
  position   integer NOT NULL,
  PRIMARY KEY (review_id, user_id)
);

CREATE TABLE review_comments (
  seq         bigserial PRIMARY KEY,
  id          uuid NOT NULL UNIQUE,
  review_id   uuid NOT NULL REFERENCES review_requests(id),
  author_id   uuid NOT NULL REFERENCES app_users(id),
  author_name text NOT NULL,
  comment     text NOT NULL,
  kind        text NOT NULL CHECK (kind IN ('feedback','information','suggestion')),
  created_at  timestamptz NOT NULL
);
CREATE INDEX review_comments_review ON review_comments (review_id, seq);

CREATE TABLE review_decisions (
  seq        bigserial PRIMARY KEY,
  id         uuid NOT NULL UNIQUE,
  review_id  uuid NOT NULL REFERENCES review_requests(id),
  user_id    uuid NOT NULL REFERENCES app_users(id),
  user_name  text NOT NULL,
  decision   text NOT NULL CHECK (decision IN ('approved','changes_requested','rejected')),
  reason     text NOT NULL DEFAULT '',
  decided_at timestamptz NOT NULL
);
CREATE INDEX review_decisions_review ON review_decisions (review_id, seq);

-- Append-only enforcement for evidence records.
CREATE FUNCTION aurora_forbid_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'AURORA_IMMUTABLE: % rows are append-only (% rejected)', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END $$;

CREATE TRIGGER formula_versions_immutable BEFORE UPDATE OR DELETE ON formula_versions
  FOR EACH ROW EXECUTE FUNCTION aurora_forbid_change();
CREATE TRIGGER validation_runs_immutable BEFORE UPDATE OR DELETE ON validation_runs
  FOR EACH ROW EXECUTE FUNCTION aurora_forbid_change();
CREATE TRIGGER audit_events_immutable BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION aurora_forbid_change();
CREATE TRIGGER experiment_observations_immutable BEFORE UPDATE OR DELETE ON experiment_observations
  FOR EACH ROW EXECUTE FUNCTION aurora_forbid_change();
CREATE TRIGGER review_comments_immutable BEFORE UPDATE OR DELETE ON review_comments
  FOR EACH ROW EXECUTE FUNCTION aurora_forbid_change();
CREATE TRIGGER review_decisions_immutable BEFORE UPDATE OR DELETE ON review_decisions
  FOR EACH ROW EXECUTE FUNCTION aurora_forbid_change();

-- app_users and catalog_ingredients are synchronised from code (demo users, versioned catalog fixture) at startup.
