-- Maintainer V1 schema
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text NOT NULL,
  organization_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_clerk_user_id_idx ON user_profiles (clerk_user_id);

CREATE TABLE IF NOT EXISTS user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text NOT NULL,
  run_typecheck boolean NOT NULL DEFAULT true,
  run_tests boolean NOT NULL DEFAULT true,
  run_build boolean NOT NULL DEFAULT true,
  run_lint boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS user_preferences_clerk_user_id_idx ON user_preferences (clerk_user_id);

CREATE TABLE IF NOT EXISTS github_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text NOT NULL,
  installation_id text NOT NULL,
  account_login text NOT NULL,
  account_type text NOT NULL,
  account_id text NOT NULL,
  is_fixture boolean NOT NULL DEFAULT false,
  suspended_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS github_installations_installation_id_idx ON github_installations (installation_id);
CREATE INDEX IF NOT EXISTS github_installations_clerk_user_id_idx ON github_installations (clerk_user_id);

CREATE TABLE IF NOT EXISTS repositories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text NOT NULL,
  github_installation_id uuid NOT NULL REFERENCES github_installations(id),
  github_repo_id text NOT NULL,
  owner text NOT NULL,
  name text NOT NULL,
  full_name text NOT NULL,
  default_branch text NOT NULL,
  html_url text NOT NULL,
  language text,
  is_private boolean NOT NULL DEFAULT false,
  is_fixture boolean NOT NULL DEFAULT false,
  last_scanned_at timestamptz,
  last_successful_scan_at timestamptz,
  disconnected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS repositories_installation_repo_idx ON repositories (github_installation_id, github_repo_id);
CREATE INDEX IF NOT EXISTS repositories_clerk_user_id_idx ON repositories (clerk_user_id);

CREATE TABLE IF NOT EXISTS repository_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id uuid NOT NULL REFERENCES repositories(id),
  status text NOT NULL DEFAULT 'pending',
  commit_sha text,
  package_manager text,
  error_code text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS repository_scans_repository_id_idx ON repository_scans (repository_id);

CREATE TABLE IF NOT EXISTS providers (
  id text PRIMARY KEY,
  display_name text NOT NULL,
  packages jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS repository_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id uuid NOT NULL REFERENCES repositories(id),
  scan_id uuid NOT NULL REFERENCES repository_scans(id),
  provider_id text NOT NULL REFERENCES providers(id),
  package_name text NOT NULL,
  current_version text NOT NULL,
  latest_version text NOT NULL,
  lockfile_version text,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS repository_dependencies_repository_id_idx ON repository_dependencies (repository_id);

CREATE TABLE IF NOT EXISTS api_changes (
  id text PRIMARY KEY,
  provider_id text NOT NULL REFERENCES providers(id),
  from_version text NOT NULL,
  to_version text NOT NULL,
  severity text NOT NULL,
  affected_symbols jsonb NOT NULL,
  description text NOT NULL,
  migration_instructions text NOT NULL,
  is_fixture boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS api_changes_provider_id_idx ON api_changes (provider_id);

CREATE TABLE IF NOT EXISTS code_usages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id uuid NOT NULL REFERENCES repositories(id),
  scan_id uuid NOT NULL REFERENCES repository_scans(id),
  provider_id text NOT NULL,
  file_path text NOT NULL,
  symbol text NOT NULL,
  start_line integer NOT NULL,
  end_line integer NOT NULL,
  snippet text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS code_usages_repository_provider_idx ON code_usages (repository_id, provider_id);

CREATE TABLE IF NOT EXISTS migrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id uuid NOT NULL REFERENCES repositories(id),
  clerk_user_id text NOT NULL,
  provider_id text NOT NULL,
  api_change_id text REFERENCES api_changes(id),
  from_version text NOT NULL,
  to_version text NOT NULL,
  status text NOT NULL DEFAULT 'detected',
  usage_count integer NOT NULL DEFAULT 0,
  file_count integer NOT NULL DEFAULT 0,
  confidence text,
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS migrations_repository_id_idx ON migrations (repository_id);
CREATE INDEX IF NOT EXISTS migrations_clerk_user_id_idx ON migrations (clerk_user_id);

CREATE TABLE IF NOT EXISTS migration_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_id uuid NOT NULL REFERENCES migrations(id),
  status text NOT NULL DEFAULT 'queued',
  executor_type text NOT NULL,
  current_step text NOT NULL DEFAULT 'queued',
  started_at timestamptz,
  completed_at timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS migration_jobs_migration_id_idx ON migration_jobs (migration_id);

CREATE TABLE IF NOT EXISTS migration_job_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES migration_jobs(id),
  step text NOT NULL,
  status text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS migration_job_events_job_id_idx ON migration_job_events (job_id);

CREATE TABLE IF NOT EXISTS migration_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES migration_jobs(id),
  attempt_number integer NOT NULL DEFAULT 1,
  status text NOT NULL,
  logs text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS migration_attempts_job_id_idx ON migration_attempts (job_id);

CREATE TABLE IF NOT EXISTS migration_diffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES migration_jobs(id),
  file_path text NOT NULL,
  additions integer NOT NULL DEFAULT 0,
  deletions integer NOT NULL DEFAULT 0,
  patch text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS migration_diffs_job_id_idx ON migration_diffs (job_id);

CREATE TABLE IF NOT EXISTS verification_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES migration_jobs(id),
  overall_status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verification_runs_job_id_idx ON verification_runs (job_id);

CREATE TABLE IF NOT EXISTS verification_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES verification_runs(id),
  name text NOT NULL,
  command text,
  exit_code integer,
  duration_ms integer NOT NULL DEFAULT 0,
  status text NOT NULL,
  output text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verification_checks_run_id_idx ON verification_checks (run_id);

CREATE TABLE IF NOT EXISTS pull_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_id uuid NOT NULL REFERENCES migrations(id),
  github_pr_number integer NOT NULL,
  github_pr_url text NOT NULL,
  branch_name text NOT NULL,
  commit_sha text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pull_requests_migration_id_idx ON pull_requests (migration_id);

CREATE TABLE IF NOT EXISTS activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text NOT NULL,
  repository_id uuid REFERENCES repositories(id),
  migration_id uuid REFERENCES migrations(id),
  type text NOT NULL,
  title text NOT NULL,
  body text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activity_events_clerk_user_created_idx ON activity_events (clerk_user_id, created_at);
