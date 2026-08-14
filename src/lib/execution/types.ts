import type { CheckName, JobStep, VerificationCheckResult } from "@/lib/domain";
import type { GeneratedPatch } from "@/lib/domain";

export type MigrationJobSpec = {
  jobId: string;
  migrationId: string;
  repositoryFullName: string;
  owner: string;
  name: string;
  cloneUrl: string;
  commitSha: string | null;
  defaultBranch: string;
  packageName: string;
  fromVersion: string;
  toVersion: string;
  packageManager: "npm" | "pnpm";
  installationToken?: string;
  localSourcePath?: string;
  patch: GeneratedPatch;
  checks: Record<CheckName, boolean>;
  timeoutMs: number;
};

export type ExecutionResult = {
  ok: boolean;
  errorCode?: string;
  errorMessage?: string;
  logs: string;
  diffs: Array<{
    filePath: string;
    additions: number;
    deletions: number;
    patch: string;
  }>;
  checks: VerificationCheckResult[];
  events: Array<{ step: JobStep; status: string; message: string }>;
};

export interface MigrationExecutor {
  execute(job: MigrationJobSpec): Promise<ExecutionResult>;
}

export type JobQueue = {
  enqueue(jobId: string): Promise<void>;
};
