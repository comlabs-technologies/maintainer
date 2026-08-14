import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
};

export const userProfiles = pgTable(
  "user_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    organizationId: text("organization_id"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("user_profiles_clerk_user_id_idx").on(table.clerkUserId),
  ],
);

export const userPreferences = pgTable(
  "user_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    runTypecheck: boolean("run_typecheck").notNull().default(true),
    runTests: boolean("run_tests").notNull().default(true),
    runBuild: boolean("run_build").notNull().default(true),
    runLint: boolean("run_lint").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("user_preferences_clerk_user_id_idx").on(table.clerkUserId),
  ],
);

export const githubInstallations = pgTable(
  "github_installations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    installationId: text("installation_id").notNull(),
    accountLogin: text("account_login").notNull(),
    accountType: text("account_type").notNull(),
    accountId: text("account_id").notNull(),
    isFixture: boolean("is_fixture").notNull().default(false),
    suspendedAt: timestamp("suspended_at", { withTimezone: true, mode: "date" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("github_installations_installation_id_idx").on(
      table.installationId,
    ),
    index("github_installations_clerk_user_id_idx").on(table.clerkUserId),
  ],
);

export const repositories = pgTable(
  "repositories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    githubInstallationId: uuid("github_installation_id")
      .notNull()
      .references(() => githubInstallations.id),
    githubRepoId: text("github_repo_id").notNull(),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    fullName: text("full_name").notNull(),
    defaultBranch: text("default_branch").notNull(),
    htmlUrl: text("html_url").notNull(),
    language: text("language"),
    isPrivate: boolean("is_private").notNull().default(false),
    isFixture: boolean("is_fixture").notNull().default(false),
    lastScannedAt: timestamp("last_scanned_at", {
      withTimezone: true,
      mode: "date",
    }),
    lastSuccessfulScanAt: timestamp("last_successful_scan_at", {
      withTimezone: true,
      mode: "date",
    }),
    disconnectedAt: timestamp("disconnected_at", {
      withTimezone: true,
      mode: "date",
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("repositories_installation_repo_idx").on(
      table.githubInstallationId,
      table.githubRepoId,
    ),
    index("repositories_clerk_user_id_idx").on(table.clerkUserId),
  ],
);

export const repositoryScans = pgTable(
  "repository_scans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repositories.id),
    status: text("status").notNull().default("pending"),
    commitSha: text("commit_sha"),
    packageManager: text("package_manager"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [index("repository_scans_repository_id_idx").on(table.repositoryId)],
);

export const providers = pgTable("providers", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  packages: jsonb("packages").$type<string[]>().notNull(),
  ...timestamps,
});

export const repositoryDependencies = pgTable(
  "repository_dependencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repositories.id),
    scanId: uuid("scan_id")
      .notNull()
      .references(() => repositoryScans.id),
    providerId: text("provider_id")
      .notNull()
      .references(() => providers.id),
    packageName: text("package_name").notNull(),
    currentVersion: text("current_version").notNull(),
    latestVersion: text("latest_version").notNull(),
    lockfileVersion: text("lockfile_version"),
    status: text("status").notNull(),
    ...timestamps,
  },
  (table) => [
    index("repository_dependencies_repository_id_idx").on(table.repositoryId),
  ],
);

export const apiChanges = pgTable(
  "api_changes",
  {
    id: text("id").primaryKey(),
    providerId: text("provider_id")
      .notNull()
      .references(() => providers.id),
    fromVersion: text("from_version").notNull(),
    toVersion: text("to_version").notNull(),
    severity: text("severity").notNull(),
    affectedSymbols: jsonb("affected_symbols").$type<string[]>().notNull(),
    description: text("description").notNull(),
    migrationInstructions: text("migration_instructions").notNull(),
    isFixture: boolean("is_fixture").notNull().default(false),
    ...timestamps,
  },
  (table) => [index("api_changes_provider_id_idx").on(table.providerId)],
);

export const codeUsages = pgTable(
  "code_usages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repositories.id),
    scanId: uuid("scan_id")
      .notNull()
      .references(() => repositoryScans.id),
    providerId: text("provider_id").notNull(),
    filePath: text("file_path").notNull(),
    symbol: text("symbol").notNull(),
    startLine: integer("start_line").notNull(),
    endLine: integer("end_line").notNull(),
    snippet: text("snippet").notNull(),
    ...timestamps,
  },
  (table) => [index("code_usages_repository_provider_idx").on(table.repositoryId, table.providerId)],
);

export const migrations = pgTable(
  "migrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repositories.id),
    clerkUserId: text("clerk_user_id").notNull(),
    providerId: text("provider_id").notNull(),
    apiChangeId: text("api_change_id").references(() => apiChanges.id),
    fromVersion: text("from_version").notNull(),
    toVersion: text("to_version").notNull(),
    status: text("status").notNull().default("detected"),
    usageCount: integer("usage_count").notNull().default(0),
    fileCount: integer("file_count").notNull().default(0),
    confidence: text("confidence"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    ...timestamps,
  },
  (table) => [
    index("migrations_repository_id_idx").on(table.repositoryId),
    index("migrations_clerk_user_id_idx").on(table.clerkUserId),
  ],
);

export const migrationJobs = pgTable(
  "migration_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    migrationId: uuid("migration_id")
      .notNull()
      .references(() => migrations.id),
    status: text("status").notNull().default("queued"),
    executorType: text("executor_type").notNull(),
    currentStep: text("current_step").notNull().default("queued"),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    ...timestamps,
  },
  (table) => [index("migration_jobs_migration_id_idx").on(table.migrationId)],
);

export const migrationJobEvents = pgTable(
  "migration_job_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => migrationJobs.id),
    step: text("step").notNull(),
    status: text("status").notNull(),
    message: text("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("migration_job_events_job_id_idx").on(table.jobId)],
);

export const migrationAttempts = pgTable(
  "migration_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => migrationJobs.id),
    attemptNumber: integer("attempt_number").notNull().default(1),
    status: text("status").notNull(),
    logs: text("logs"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("migration_attempts_job_id_idx").on(table.jobId)],
);

export const migrationDiffs = pgTable(
  "migration_diffs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => migrationJobs.id),
    filePath: text("file_path").notNull(),
    additions: integer("additions").notNull().default(0),
    deletions: integer("deletions").notNull().default(0),
    patch: text("patch").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("migration_diffs_job_id_idx").on(table.jobId)],
);

export const verificationRuns = pgTable(
  "verification_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => migrationJobs.id),
    overallStatus: text("overall_status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("verification_runs_job_id_idx").on(table.jobId)],
);

export const verificationChecks = pgTable(
  "verification_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => verificationRuns.id),
    name: text("name").notNull(),
    command: text("command"),
    exitCode: integer("exit_code"),
    durationMs: integer("duration_ms").notNull().default(0),
    status: text("status").notNull(),
    output: text("output").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("verification_checks_run_id_idx").on(table.runId)],
);

export const pullRequests = pgTable(
  "pull_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    migrationId: uuid("migration_id")
      .notNull()
      .references(() => migrations.id),
    githubPrNumber: integer("github_pr_number").notNull(),
    githubPrUrl: text("github_pr_url").notNull(),
    branchName: text("branch_name").notNull(),
    commitSha: text("commit_sha"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("pull_requests_migration_id_idx").on(table.migrationId)],
);

export const activityEvents = pgTable(
  "activity_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    repositoryId: uuid("repository_id").references(() => repositories.id),
    migrationId: uuid("migration_id").references(() => migrations.id),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("activity_events_clerk_user_created_idx").on(
      table.clerkUserId,
      table.createdAt,
    ),
  ],
);
