import { desc, eq } from "drizzle-orm";
import { after } from "next/server";
import { getDb } from "@/db/client";
import {
  apiChanges,
  codeUsages,
  githubInstallations,
  migrationAttempts,
  migrationDiffs,
  migrationJobEvents,
  migrationJobs,
  migrations,
  pullRequests,
  repositories,
  repositoryDependencies,
  repositoryScans,
  userPreferences,
  verificationChecks,
  verificationRuns,
} from "@/db/schema";
import type { CheckName, MigrationStatus } from "@/lib/domain";
import { getEnv, isDevFixturesEnabled } from "@/lib/env";
import { getMigrationExecutor } from "@/lib/execution";
import type { MigrationJobSpec } from "@/lib/execution/types";
import { getGitHubPort } from "@/lib/github";
import { FIXTURE_INSTALLATION_ID, fixtureRoot } from "@/lib/github/fixture-port";
import { getGithubApp } from "@/lib/github/app";
import { logger } from "@/lib/logger";
import { getCodingModel } from "@/lib/models";
import { assertTransition } from "@/lib/migrations/state";
import { getProvider } from "@/lib/providers/registry";
import { deriveConfidence, parseTestSummary } from "@/lib/verification/results";
import { recordActivity } from "@/server/services/activity";
import { isGithubAppConfigured } from "@/lib/env";

async function setMigrationStatus(id: string, from: MigrationStatus, to: MigrationStatus, extra: Partial<typeof migrations.$inferInsert> = {}) {
  assertTransition(from, to);
  const db = getDb();
  await db
    .update(migrations)
    .set({ status: to, updatedAt: new Date(), ...extra })
    .where(eq(migrations.id, id));
}

export async function getMigrationPage(migrationId: string) {
  const db = getDb();
  const [migration] = await db.select().from(migrations).where(eq(migrations.id, migrationId)).limit(1);
  if (!migration) return null;
  const [repository] = await db
    .select()
    .from(repositories)
    .where(eq(repositories.id, migration.repositoryId))
    .limit(1);
  const change = migration.apiChangeId
    ? (
        await db.select().from(apiChanges).where(eq(apiChanges.id, migration.apiChangeId)).limit(1)
      )[0]
    : null;
  const usages = await db
    .select()
    .from(codeUsages)
    .where(eq(codeUsages.repositoryId, migration.repositoryId));
  const providerUsages = usages.filter((usage) => usage.providerId === migration.providerId);
  const [job] = await db
    .select()
    .from(migrationJobs)
    .where(eq(migrationJobs.migrationId, migrationId))
    .orderBy(desc(migrationJobs.createdAt))
    .limit(1);
  const events = job
    ? await db
        .select()
        .from(migrationJobEvents)
        .where(eq(migrationJobEvents.jobId, job.id))
        .orderBy(migrationJobEvents.createdAt)
    : [];
  const diffs = job
    ? await db.select().from(migrationDiffs).where(eq(migrationDiffs.jobId, job.id))
    : [];
  const [run] = job
    ? await db
        .select()
        .from(verificationRuns)
        .where(eq(verificationRuns.jobId, job.id))
        .orderBy(desc(verificationRuns.createdAt))
        .limit(1)
    : [];
  const checks = run
    ? await db.select().from(verificationChecks).where(eq(verificationChecks.runId, run.id))
    : [];
  const [pr] = await db
    .select()
    .from(pullRequests)
    .where(eq(pullRequests.migrationId, migrationId))
    .orderBy(desc(pullRequests.createdAt))
    .limit(1);

  return {
    migration,
    repository,
    change,
    usages: providerUsages,
    job,
    events,
    diffs,
    checks,
    pullRequest: pr ?? null,
  };
}

export async function queueMigrationJob(migrationId: string, clerkUserId: string) {
  const db = getDb();
  const [migration] = await db.select().from(migrations).where(eq(migrations.id, migrationId)).limit(1);
  if (!migration || migration.clerkUserId !== clerkUserId) {
    throw new Error("forbidden");
  }
  if (["queued", "preparing", "migrating", "verifying"].includes(migration.status)) {
    return migration.id;
  }

  await setMigrationStatus(migration.id, migration.status as MigrationStatus, "queued");
  const executorType = getEnv().MAINTAINER_EXECUTOR ?? "docker";
  const [job] = await db
    .insert(migrationJobs)
    .values({
      migrationId: migration.id,
      status: "queued",
      executorType,
      currentStep: "queued",
    })
    .returning();

  await db.insert(migrationJobEvents).values({
    jobId: job.id,
    step: "queued",
    status: "completed",
    message: "Migration queued",
  });

  after(async () => {
    await runMigrationJob(job.id);
  });

  return job.id;
}

export async function runMigrationJob(jobId: string) {
  const db = getDb();
  const [job] = await db.select().from(migrationJobs).where(eq(migrationJobs.id, jobId)).limit(1);
  if (!job) return;
  const [migration] = await db
    .select()
    .from(migrations)
    .where(eq(migrations.id, job.migrationId))
    .limit(1);
  if (!migration) return;
  const [repository] = await db
    .select()
    .from(repositories)
    .where(eq(repositories.id, migration.repositoryId))
    .limit(1);
  if (!repository) return;
  const [installation] = await db
    .select()
    .from(githubInstallations)
    .where(eq(githubInstallations.id, repository.githubInstallationId))
    .limit(1);
  const [prefs] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.clerkUserId, migration.clerkUserId))
    .limit(1);
  const [dep] = await db
    .select()
    .from(repositoryDependencies)
    .where(eq(repositoryDependencies.repositoryId, repository.id));
  const providerDep = (await db
    .select()
    .from(repositoryDependencies)
    .where(eq(repositoryDependencies.repositoryId, repository.id))).find(
    (item) => item.providerId === migration.providerId,
  );
  const [scan] = await db
    .select()
    .from(repositoryScans)
    .where(eq(repositoryScans.repositoryId, repository.id))
    .orderBy(desc(repositoryScans.createdAt))
    .limit(1);
  const usages = (
    await db.select().from(codeUsages).where(eq(codeUsages.repositoryId, repository.id))
  ).filter((usage) => usage.providerId === migration.providerId);
  const change = migration.apiChangeId
    ? (await db.select().from(apiChanges).where(eq(apiChanges.id, migration.apiChangeId)))[0]
    : null;
  const provider = getProvider(migration.providerId);
  if (!provider || !providerDep || !installation) {
    await failJob(job.id, migration.id, migration.status as MigrationStatus, "generation_failed", "Missing provider context");
    return;
  }

  const log = logger.child({
    jobId,
    migrationId: migration.id,
    repositoryId: repository.id,
    provider: provider.id,
  });

  try {
    await db
      .update(migrationJobs)
      .set({ status: "running", startedAt: new Date(), currentStep: "preparing", updatedAt: new Date() })
      .where(eq(migrationJobs.id, job.id));
    await setMigrationStatus(migration.id, "queued", "preparing");

    const port = getGitHubPort();
    const installationKey = installation.isFixture
      ? FIXTURE_INSTALLATION_ID
      : installation.installationId;
    const packageJson = await port.getFileContent(
      installationKey,
      repository.owner,
      repository.name,
      "package.json",
    );
    if (!packageJson) throw new Error("package.json missing");

    const uniquePaths = [...new Set(usages.map((usage) => usage.filePath))];
    const files = [];
    for (const filePath of uniquePaths) {
      const content = await port.getFileContent(
        installationKey,
        repository.owner,
        repository.name,
        filePath,
      );
      if (content) files.push({ path: filePath, content });
    }

    const model = getCodingModel();
    const patch = await model.generatePatch({
      provider,
      change: change
        ? {
            id: change.id,
            providerId: change.providerId,
            fromVersion: change.fromVersion,
            toVersion: change.toVersion,
            severity: change.severity as "breaking",
            affectedSymbols: change.affectedSymbols,
            description: change.description,
            migrationInstructions: change.migrationInstructions,
          }
        : null,
      fromVersion: migration.fromVersion,
      toVersion: migration.toVersion,
      packageName: providerDep.packageName,
      usages: usages.map((usage) => ({
        filePath: usage.filePath,
        symbol: usage.symbol,
        startLine: usage.startLine,
        endLine: usage.endLine,
        snippet: usage.snippet,
      })),
      files,
      packageJson,
      relatedTests: [],
    });

    let installationToken: string | undefined;
    if (!installation.isFixture && isGithubAppConfigured()) {
      const octokit = await getGithubApp().getInstallationOctokit(
        Number(installation.installationId),
      );
      const auth = (await octokit.auth({ type: "installation" })) as { token?: string };
      installationToken = auth.token;
    }

    const packageManager =
      scan?.packageManager === "pnpm" ? "pnpm" : "npm";

    const spec: MigrationJobSpec = {
      jobId: job.id,
      migrationId: migration.id,
      repositoryFullName: repository.fullName,
      owner: repository.owner,
      name: repository.name,
      cloneUrl: `https://github.com/${repository.fullName}.git`,
      commitSha: scan?.commitSha ?? null,
      defaultBranch: repository.defaultBranch,
      packageName: providerDep.packageName,
      fromVersion: migration.fromVersion,
      toVersion: migration.toVersion,
      packageManager,
      installationToken,
      localSourcePath:
        installation.isFixture || isDevFixturesEnabled() ? fixtureRoot() : undefined,
      patch,
      checks: {
        typecheck: prefs?.runTypecheck ?? true,
        test: prefs?.runTests ?? true,
        lint: prefs?.runLint ?? true,
        build: prefs?.runBuild ?? true,
      },
      timeoutMs: Number(getEnv().MAINTAINER_EXECUTOR_TIMEOUT_MS ?? 600_000),
    };

    await setMigrationStatus(migration.id, "preparing", "migrating");
    const executor = getMigrationExecutor();
    const result = await executor.execute(spec);

    for (const event of result.events) {
      await db.insert(migrationJobEvents).values({
        jobId: job.id,
        step: event.step,
        status: event.status,
        message: event.message,
      });
      await db
        .update(migrationJobs)
        .set({ currentStep: event.step, updatedAt: new Date() })
        .where(eq(migrationJobs.id, job.id));
      if (event.step === "typecheck" || event.step === "test" || event.step === "lint" || event.step === "build") {
        if (migration.status !== "verifying") {
          await db
            .update(migrations)
            .set({ status: "verifying", updatedAt: new Date() })
            .where(eq(migrations.id, migration.id));
        }
      }
    }

    await db.insert(migrationAttempts).values({
      jobId: job.id,
      attemptNumber: 1,
      status: result.ok ? "succeeded" : "failed",
      logs: result.logs,
    });

    if (result.diffs.length > 0) {
      await db.insert(migrationDiffs).values(
        result.diffs.map((diff) => ({
          jobId: job.id,
          filePath: diff.filePath,
          additions: diff.additions,
          deletions: diff.deletions,
          patch: diff.patch,
        })),
      );
    }

    if (result.checks.length > 0) {
      const [run] = await db
        .insert(verificationRuns)
        .values({
          jobId: job.id,
          overallStatus: result.ok ? "passed" : "failed",
        })
        .returning();
      await db.insert(verificationChecks).values(
        result.checks.map((check) => ({
          runId: run.id,
          name: check.name,
          command: check.command,
          exitCode: check.exitCode,
          durationMs: check.durationMs,
          status: check.status,
          output: check.output,
        })),
      );
    }

    const confidence = deriveConfidence({
      checks: result.checks,
      unresolvedUsages: 0,
      filesChanged: result.diffs.length,
    });

    if (!result.ok) {
      await failJob(
        job.id,
        migration.id,
        "verifying",
        result.errorCode ?? "generation_failed",
        result.errorMessage ?? "Migration failed",
      );
      await recordActivity({
        clerkUserId: migration.clerkUserId,
        repositoryId: repository.id,
        migrationId: migration.id,
        type: "migration.failed",
        title: `${provider.displayName} migration failed`,
        body: repository.fullName,
      });
      log.warn("migration_failed", { errorCode: result.errorCode });
      return;
    }

    await db
      .update(migrationJobs)
      .set({
        status: "succeeded",
        completedAt: new Date(),
        currentStep: "completed",
        updatedAt: new Date(),
      })
      .where(eq(migrationJobs.id, job.id));
    await db
      .update(migrations)
      .set({
        status: "verified",
        confidence,
        fileCount: result.diffs.length,
        updatedAt: new Date(),
        errorCode: null,
        errorMessage: null,
      })
      .where(eq(migrations.id, migration.id));

    const testCheck = result.checks.find((check) => check.name === "test");
    const testLabel = testCheck ? parseTestSummary(testCheck.output) : null;
    await recordActivity({
      clerkUserId: migration.clerkUserId,
      repositoryId: repository.id,
      migrationId: migration.id,
      type: "migration.verified",
      title: "Verification passed",
      body: repository.fullName,
    });
    await recordActivity({
      clerkUserId: migration.clerkUserId,
      repositoryId: repository.id,
      migrationId: migration.id,
      type: "migration.completed",
      title: `${provider.displayName} ${migration.fromVersion} → ${migration.toVersion} migration completed`,
      body: repository.fullName,
    });
    void testLabel;
    void dep;
    log.info("migration_verified", { confidence, duration: undefined });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Migration failed";
    log.error("migration_job_error", { error: message });
    await failJob(job.id, migration.id, "migrating", "generation_failed", message);
  }
}

async function failJob(
  jobId: string,
  migrationId: string,
  from: MigrationStatus,
  errorCode: string,
  errorMessage: string,
) {
  const db = getDb();
  await db
    .update(migrationJobs)
    .set({
      status: "failed",
      errorCode,
      errorMessage,
      completedAt: new Date(),
      currentStep: "failed",
      updatedAt: new Date(),
    })
    .where(eq(migrationJobs.id, jobId));
  await db
    .update(migrations)
    .set({
      status: "failed",
      errorCode,
      errorMessage,
      updatedAt: new Date(),
    })
    .where(eq(migrations.id, migrationId));
  void from;
}

export async function openPullRequest(migrationId: string, clerkUserId: string) {
  const db = getDb();
  const page = await getMigrationPage(migrationId);
  if (!page?.migration || page.migration.clerkUserId !== clerkUserId) {
    throw new Error("forbidden");
  }
  if (page.migration.status !== "verified" && page.migration.status !== "pr_created") {
    throw new Error("Migration is not verified");
  }
  if (page.pullRequest) return page.pullRequest;

  const { migration, repository, diffs, checks, change } = page;
  if (!repository) throw new Error("repository_inaccessible");
  const [installation] = await db
    .select()
    .from(githubInstallations)
    .where(eq(githubInstallations.id, repository.githubInstallationId))
    .limit(1);
  if (!installation || installation.revokedAt) throw new Error("github_installation_revoked");

  const provider = getProvider(migration.providerId);
  const branch = `maintainer/${migration.providerId}-${slug(migration.fromVersion)}-to-${slug(migration.toVersion)}`;
  const port = getGitHubPort();
  const installationKey = installation.isFixture
    ? FIXTURE_INSTALLATION_ID
    : installation.installationId;
  const sha = await port.getLatestCommitSha(
    installationKey,
    repository.owner,
    repository.name,
    repository.defaultBranch,
  );
  if (!sha && !installation.isFixture) throw new Error("Unable to read default branch");
  try {
    await port.createBranch(
      installationKey,
      repository.owner,
      repository.name,
      branch,
      sha ?? "fixture-sha",
    );
  } catch {
    // Branch may already exist from a previous attempt.
  }

  const files = diffs.map((diff) => {
    const content = applyPatchToPlaceholder(diff.patch);
    return { path: diff.filePath, content, action: "update" as const };
  });

  // Prefer writing full file contents from the last job workspace via patch headers.
  const commitFiles = await filesFromDiffs(page.job?.id, diffs);
  const commitSha = await port.commitFiles(
    installationKey,
    repository.owner,
    repository.name,
    branch,
    `Upgrade ${provider?.displayName ?? migration.providerId} SDK from ${migration.fromVersion} to ${migration.toVersion}`,
    commitFiles.length > 0 ? commitFiles : files,
  );

  const testCheck = checks.find((check) => check.name === "test");
  const testLine = testCheck
    ? parseTestSummary(testCheck.output) ?? (testCheck.status === "passed" ? "Tests passed" : "Tests")
    : null;
  const body = [
    `Upgrade ${provider?.displayName ?? migration.providerId} SDK from ${migration.fromVersion} to ${migration.toVersion}`,
    "",
    `Maintainer detected changes affecting ${migration.usageCount} usages across ${migration.fileCount} files.`,
    "",
    "Migration",
    `• Updated ${provider?.displayName ?? migration.providerId} SDK to ${migration.toVersion}`,
    "• Migrated affected API usages",
    "• Updated related TypeScript types",
    change ? `• ${change.description}` : null,
    "",
    "Verification",
    ...checks.map((check) => {
      const mark = check.status === "passed" ? "✓" : check.status === "failed" ? "✕" : "–";
      const extra =
        check.name === "test" && testLine ? ` ${testLine}` : ` ${labelStatus(check.status)}`;
      return `${mark} ${capitalize(check.name)}${extra}`;
    }),
    "",
    "Generated by Maintainer.",
  ]
    .filter(Boolean)
    .join("\n");

  const pr = await port.createPullRequest(
    installationKey,
    repository.owner,
    repository.name,
    {
      title: `Upgrade ${provider?.displayName ?? migration.providerId} SDK from ${migration.fromVersion} to ${migration.toVersion}`,
      body,
      head: branch,
      base: repository.defaultBranch,
    },
  );

  const [saved] = await db
    .insert(pullRequests)
    .values({
      migrationId: migration.id,
      githubPrNumber: pr.number,
      githubPrUrl: pr.url,
      branchName: pr.branchName,
      commitSha: commitSha ?? pr.commitSha,
    })
    .returning();
  await db
    .update(migrations)
    .set({ status: "pr_created", updatedAt: new Date() })
    .where(eq(migrations.id, migration.id));
  await recordActivity({
    clerkUserId: migration.clerkUserId,
    repositoryId: repository.id,
    migrationId: migration.id,
    type: "pr.created",
    title: "Pull request opened",
    body: repository.fullName,
  });
  return saved;
}

function slug(version: string) {
  return version.replace(/[^0-9A-Za-z]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function capitalize(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function labelStatus(status: string) {
  if (status === "passed") return "Passed";
  if (status === "failed") return "Failed";
  if (status === "not_configured") return "Not configured";
  return "Skipped";
}

function applyPatchToPlaceholder(patch: string): string {
  return patch;
}

async function filesFromDiffs(
  jobId: string | undefined,
  diffs: Array<{ filePath: string; patch: string }>,
): Promise<Array<{ path: string; content: string; action: "update" }>> {
  void jobId;
  const files: Array<{ path: string; content: string; action: "update" }> = [];
  for (const diff of diffs) {
    const content = fileFromUnifiedDiff(diff.patch);
    if (content != null) {
      files.push({ path: diff.filePath, content, action: "update" });
    }
  }
  return files;
}

import { fileFromUnifiedDiff } from "@/lib/migrations/diff";

export function formatCheckDetail(check: {
  name: CheckName | string;
  status: string;
  output: string;
}): string {
  if (check.name === "test" && check.status === "passed") {
    return parseTestSummary(check.output) ?? "Passed";
  }
  if (check.status === "passed") return "Passed";
  if (check.status === "failed") return "Failed";
  if (check.status === "not_configured") return "Not configured";
  return "Skipped";
}
