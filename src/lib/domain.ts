export const MIGRATION_STATUSES = [
  "detected",
  "analyzing",
  "ready",
  "queued",
  "preparing",
  "migrating",
  "verifying",
  "verified",
  "failed",
  "pr_created",
] as const;

export type MigrationStatus = (typeof MIGRATION_STATUSES)[number];

export const JOB_STATUSES = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const SCAN_STATUSES = ["pending", "scanning", "completed", "failed"] as const;
export type ScanStatus = (typeof SCAN_STATUSES)[number];

export const PACKAGE_MANAGERS = ["npm", "pnpm", "unknown"] as const;
export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

export const CHANGE_SEVERITIES = [
  "breaking",
  "deprecated",
  "behavioral",
  "safe",
] as const;
export type ChangeSeverity = (typeof CHANGE_SEVERITIES)[number];

export const DEPENDENCY_STATUSES = ["current", "update_available"] as const;
export type DependencyStatus = (typeof DEPENDENCY_STATUSES)[number];

export const REPOSITORY_HEALTH = [
  "healthy",
  "update_available",
  "scanning",
  "needs_attention",
] as const;
export type RepositoryHealth = (typeof REPOSITORY_HEALTH)[number];

export const CHECK_NAMES = ["typecheck", "test", "lint", "build"] as const;
export type CheckName = (typeof CHECK_NAMES)[number];

export const CHECK_STATUSES = [
  "passed",
  "failed",
  "skipped",
  "not_configured",
] as const;
export type CheckStatus = (typeof CHECK_STATUSES)[number];

export const CONFIDENCE_LEVELS = ["high", "medium", "needs_review"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export const JOB_STEPS = [
  "queued",
  "preparing",
  "prepared",
  "upgraded",
  "analyzed",
  "applying",
  "typecheck",
  "test",
  "lint",
  "build",
  "collecting_diff",
  "completed",
  "failed",
] as const;
export type JobStep = (typeof JOB_STEPS)[number];

export type ApiChange = {
  id: string;
  providerId: string;
  fromVersion: string;
  toVersion: string;
  severity: ChangeSeverity;
  affectedSymbols: string[];
  description: string;
  migrationInstructions: string;
};

export type ProviderDefinition = {
  id: string;
  displayName: string;
  packages: string[];
};

export type CodeUsage = {
  filePath: string;
  symbol: string;
  startLine: number;
  endLine: number;
  snippet: string;
};

export type GeneratedFileChange = {
  path: string;
  action: "update" | "create" | "delete";
  content?: string;
};

export type GeneratedPatch = {
  files: GeneratedFileChange[];
  notes: string;
};

export type VerificationCheckResult = {
  name: CheckName;
  command: string | null;
  exitCode: number | null;
  durationMs: number;
  status: CheckStatus;
  output: string;
};

export type ProductErrorCode =
  | "unauthenticated"
  | "github_not_connected"
  | "github_installation_revoked"
  | "repository_inaccessible"
  | "unsupported_repository"
  | "unsupported_package_manager"
  | "no_supported_sdk"
  | "scan_failed"
  | "analysis_failed"
  | "generation_failed"
  | "install_failed"
  | "typecheck_failed"
  | "tests_failed"
  | "lint_failed"
  | "build_failed"
  | "pr_failed"
  | "executor_timeout"
  | "forbidden";
