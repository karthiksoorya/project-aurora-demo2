-- Project Aurora: PostgreSQL REFERENCE DATA MODEL (not a complete production migration).
-- Convert into versioned migrations with authZ, constraints, indexes, delete policies and tests.
-- All formulas below use mass fraction percentages (not volumes); decimal numeric, not floats.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE creative_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id),
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  revision integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('single_compound','natural_mixture','blend','other')),
  external_identifier text,
  odor_descriptors jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ingredient_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id uuid NOT NULL REFERENCES ingredients(id),
  property_key text NOT NULL,
  property_value jsonb,
  source_name text NOT NULL,
  source_reference text,
  retrieved_at timestamptz,
  verification_status text NOT NULL CHECK(verification_status IN ('verified','unverified','missing'))
);
CREATE TABLE formula_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id),
  based_on_version_id uuid,
  revision integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE formula_draft_items (
  draft_id uuid NOT NULL REFERENCES formula_drafts(id) ON DELETE CASCADE,
  line_id uuid NOT NULL DEFAULT gen_random_uuid(),
  ingredient_id uuid NOT NULL REFERENCES ingredients(id),
  mass_pct numeric(12,6) NOT NULL CHECK(mass_pct >= 0 AND mass_pct <= 100),
  position integer NOT NULL,
  PRIMARY KEY(draft_id,line_id)
);
CREATE TABLE formula_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id),
  based_on_version_id uuid REFERENCES formula_versions(id),
  version_label text NOT NULL,
  formula_snapshot jsonb NOT NULL,
  snapshot_hash text NOT NULL,
  saved_by uuid NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id,version_label)
);
ALTER TABLE formula_drafts ADD CONSTRAINT fk_draft_base_version
 FOREIGN KEY (based_on_version_id) REFERENCES formula_versions(id);
CREATE TABLE validation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_version_id uuid NOT NULL REFERENCES formula_versions(id),
  rule_set_id text,
  product_category text,
  market text,
  status text NOT NULL CHECK (status IN ('pass','warning','fail','not_assessed')),
  evidence_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  evaluated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE validation_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES validation_runs(id),
  status text NOT NULL CHECK (status IN ('pass','warning','fail','not_assessed')),
  message text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id),
  formula_version_id uuid NOT NULL REFERENCES formula_versions(id),
  protocol jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE experiment_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES experiments(id),
  observation jsonb NOT NULL,
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE review_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_version_id uuid NOT NULL REFERENCES formula_versions(id),
  status text NOT NULL CHECK(status IN ('draft','submitted','changes_requested','approved','rejected')),
  requested_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE review_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES review_requests(id),
  author_id uuid NOT NULL,
  comment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ai_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id),
  target_version_id uuid REFERENCES formula_versions(id),
  proposed_diff jsonb NOT NULL,
  status text NOT NULL CHECK(status IN ('pending','accepted','rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- To implement: real identities/memberships/access policy; audit immutability;
-- review permissions; tenant/project scoping; transaction-safe snapshot creation;
-- revision conflict detection; total formula sum check (service layer/trigger);
-- accepted proposal audit; unique indexes and migrator permissions.
