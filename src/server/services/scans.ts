import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  apiChanges,
  codeUsages,
  githubInstallations,
  migrations,
  repositories,
  repositoryDependencies,
  repositoryScans,
} from "@/db/schema";
import { getGitHubPort } from "@/lib/github";
import { FIXTURE_INSTALLATION_ID } from "@/lib/github/fixture-port";
import { analyzeProviderUsages, isAnalyzablePath } from "@/lib/scanner/analyze-usages";
import {
  collectDeclaredDependencies,
  detectPackageManager,
  parsePackageJson,
} from "@/lib/scanner/manifest";
import { parseNpmLockfileVersion, parsePnpmLockfileVersion } from "@/lib/scanner/lockfile";
import { findProviderByPackage, getProvider } from "@/lib/providers/registry";
import { FIXTURE_LATEST_VERSIONS } from "@/lib/providers/catalog";
import {
  coerceVersion,
  isNewerVersion,
  pickPrimaryChange,
} from "@/lib/providers/versions";
import { recordActivity } from "@/server/services/activity";
import { logger } from "@/lib/logger";
import { isDevFixturesEnabled } from "@/lib/env";

async function fetchLatestVersion(packageName: string, current: string) {
  if (isDevFixturesEnabled() && FIXTURE_LATEST_VERSIONS[packageName]) {
    return FIXTURE_LATEST_VERSIONS[packageName];
  }
  try {
    const response = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`,
      { headers: { accept: "application/json" } },
    );
    if (!response.ok) return current;
    const json = (await response.json()) as { version?: string };
    return json.version ?? current;
  } catch {
    return current;
  }
}

export async function scanRepository(repositoryId: string) {
  const db = getDb();
  const [repository] = await db
    .select()
    .from(repositories)
    .where(eq(repositories.id, repositoryId))
    .limit(1);
  if (!repository) throw new Error("repository_inaccessible");

  const [installation] = await db
    .select()
    .from(githubInstallations)
    .where(eq(githubInstallations.id, repository.githubInstallationId))
    .limit(1);
  if (!installation || installation.revokedAt) {
    throw new Error("github_installation_revoked");
  }

  const [scan] = await db
    .insert(repositoryScans)
    .values({
      repositoryId: repository.id,
      status: "scanning",
      startedAt: new Date(),
    })
    .returning();

  await db
    .update(repositories)
    .set({ lastScannedAt: new Date(), updatedAt: new Date() })
    .where(eq(repositories.id, repository.id));

  const log = logger.child({
    repositoryId: repository.id,
    scanId: scan.id,
  });

  try {
    const port = getGitHubPort();
    const installationKey = installation.isFixture
      ? FIXTURE_INSTALLATION_ID
      : installation.installationId;

    const packageJsonRaw = await port.getFileContent(
      installationKey,
      repository.owner,
      repository.name,
      "package.json",
      repository.defaultBranch,
    );
    if (!packageJsonRaw) {
      throw Object.assign(new Error("No package.json found"), {
        code: "unsupported_repository",
      });
    }

    const manifest = parsePackageJson(packageJsonRaw);
    const packageLock = await port.getFileContent(
      installationKey,
      repository.owner,
      repository.name,
      "package-lock.json",
      repository.defaultBranch,
    );
    const pnpmLock = await port.getFileContent(
      installationKey,
      repository.owner,
      repository.name,
      "pnpm-lock.yaml",
      repository.defaultBranch,
    );
    const yarnLock = await port.getFileContent(
      installationKey,
      repository.owner,
      repository.name,
      "yarn.lock",
      repository.defaultBranch,
    );

    const packageManager = detectPackageManager({
      packageManagerField: manifest.packageManagerField,
      hasPackageLock: Boolean(packageLock),
      hasPnpmLock: Boolean(pnpmLock),
      hasYarnLock: Boolean(yarnLock),
    });

    if (packageManager === "unsupported") {
      throw Object.assign(new Error("Unsupported package manager"), {
        code: "unsupported_package_manager",
      });
    }

    const declared = collectDeclaredDependencies(manifest);
    const detected = [];
    for (const [packageName, specifier] of Object.entries(declared)) {
      const provider = findProviderByPackage(packageName);
      if (!provider) continue;
      let lockVersion: string | null = null;
      if (packageLock) lockVersion = parseNpmLockfileVersion(packageLock, packageName);
      if (!lockVersion && pnpmLock) {
        lockVersion = parsePnpmLockfileVersion(pnpmLock, packageName);
      }
      const current =
        coerceVersion(lockVersion) ?? coerceVersion(specifier) ?? specifier.replace(/^[\^~]/, "");
      const latest = await fetchLatestVersion(packageName, current);
      detected.push({
        provider,
        packageName,
        currentVersion: current,
        latestVersion: latest,
        lockfileVersion: lockVersion,
        status: isNewerVersion(latest, current) ? "update_available" : "current",
      });
    }

    const commitSha = await port.getLatestCommitSha(
      installationKey,
      repository.owner,
      repository.name,
      repository.defaultBranch,
    );

    const tree = await port.getTree(
      installationKey,
      repository.owner,
      repository.name,
      commitSha ?? repository.defaultBranch,
    );
    const tsFiles = tree.filter((item) => item.type === "blob" && isAnalyzablePath(item.path));
    const sources: Array<{ path: string; content: string }> = [];
    for (const file of tsFiles.slice(0, 250)) {
      const content = await port.getBlob(
        installationKey,
        repository.owner,
        repository.name,
        file.sha,
      );
      sources.push({ path: file.path, content });
    }

    const catalog = await db.select().from(apiChanges);
    const usageRows: Array<{
      providerId: string;
      filePath: string;
      symbol: string;
      startLine: number;
      endLine: number;
      snippet: string;
    }> = [];

    for (const item of detected) {
      const usages = analyzeProviderUsages(sources, item.provider);
      for (const usage of usages) {
        usageRows.push({
          providerId: item.provider.id,
          filePath: usage.filePath,
          symbol: usage.symbol,
          startLine: usage.startLine,
          endLine: usage.endLine,
          snippet: usage.snippet,
        });
      }
    }

    await db
      .update(repositoryScans)
      .set({
        status: "completed",
        commitSha,
        packageManager: packageManager === "unknown" ? "npm" : packageManager,
        completedAt: new Date(),
        updatedAt: new Date(),
        errorCode: null,
        errorMessage: null,
      })
      .where(eq(repositoryScans.id, scan.id));

    await db
      .delete(repositoryDependencies)
      .where(eq(repositoryDependencies.repositoryId, repository.id));
    await db.delete(codeUsages).where(eq(codeUsages.repositoryId, repository.id));

    if (detected.length > 0) {
      await db.insert(repositoryDependencies).values(
        detected.map((item) => ({
          repositoryId: repository.id,
          scanId: scan.id,
          providerId: item.provider.id,
          packageName: item.packageName,
          currentVersion: item.currentVersion,
          latestVersion: item.latestVersion,
          lockfileVersion: item.lockfileVersion,
          status: item.status,
        })),
      );
    }
    if (usageRows.length > 0) {
      await db.insert(codeUsages).values(
        usageRows.map((row) => ({
          repositoryId: repository.id,
          scanId: scan.id,
          ...row,
        })),
      );
    }

    for (const item of detected) {
      if (item.status !== "update_available") continue;
      const change = pickPrimaryChange(
        item.provider.id,
        item.currentVersion,
        item.latestVersion,
        catalog.map((row) => ({
          id: row.id,
          providerId: row.providerId,
          fromVersion: row.fromVersion,
          toVersion: row.toVersion,
          severity: row.severity as "breaking",
          affectedSymbols: row.affectedSymbols,
          description: row.description,
          migrationInstructions: row.migrationInstructions,
        })),
      );
      const providerUsages = usageRows.filter((row) => row.providerId === item.provider.id);
      const fileCount = new Set(providerUsages.map((row) => row.filePath)).size;

      const [existingMigration] = await db
        .select()
        .from(migrations)
        .where(
          and(
            eq(migrations.repositoryId, repository.id),
            eq(migrations.providerId, item.provider.id),
            eq(migrations.fromVersion, item.currentVersion),
            eq(migrations.toVersion, change?.toVersion ?? item.latestVersion),
          ),
        )
        .limit(1);

      if (existingMigration && ["pr_created", "verified", "queued", "migrating", "verifying", "preparing"].includes(existingMigration.status)) {
        continue;
      }

      if (existingMigration) {
        await db
          .update(migrations)
          .set({
            status: "ready",
            apiChangeId: change?.id ?? null,
            usageCount: providerUsages.length,
            fileCount,
            updatedAt: new Date(),
            errorCode: null,
            errorMessage: null,
          })
          .where(eq(migrations.id, existingMigration.id));
      } else {
        const [created] = await db
          .insert(migrations)
          .values({
            repositoryId: repository.id,
            clerkUserId: repository.clerkUserId,
            providerId: item.provider.id,
            apiChangeId: change?.id ?? null,
            fromVersion: item.currentVersion,
            toVersion: change?.toVersion ?? item.latestVersion,
            status: "ready",
            usageCount: providerUsages.length,
            fileCount,
          })
          .returning();
        await recordActivity({
          clerkUserId: repository.clerkUserId,
          repositoryId: repository.id,
          migrationId: created.id,
          type: "scan.update_detected",
          title: `${item.provider.displayName} ${item.currentVersion} → ${created.toVersion} detected`,
          body: repository.fullName,
        });
      }
    }

    await db
      .update(repositories)
      .set({ lastSuccessfulScanAt: new Date(), updatedAt: new Date() })
      .where(eq(repositories.id, repository.id));

    if (detected.length === 0) {
      await recordActivity({
        clerkUserId: repository.clerkUserId,
        repositoryId: repository.id,
        type: "scan.no_sdks",
        title: "Scan completed — no supported SDKs",
        body: repository.fullName,
      });
    } else {
      await recordActivity({
        clerkUserId: repository.clerkUserId,
        repositoryId: repository.id,
        type: "scan.completed",
        title: "Repository scan completed",
        body: repository.fullName,
      });
    }

    log.info("scan_completed", {
      providers: detected.map((item) => item.provider.id),
      usages: usageRows.length,
    });
    return scan.id;
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: string }).code)
        : "scan_failed";
    const message = error instanceof Error ? error.message : "Scan failed";
    log.error("scan_failed", { error: message, code });
    await db
      .update(repositoryScans)
      .set({
        status: "failed",
        errorCode: code,
        errorMessage: message,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(repositoryScans.id, scan.id));
    throw error;
  }
}

export async function repositoryDetail(repositoryId: string) {
  const db = getDb();
  const [repository] = await db
    .select()
    .from(repositories)
    .where(eq(repositories.id, repositoryId))
    .limit(1);
  if (!repository) return null;

  const [latestScan] = await db
    .select()
    .from(repositoryScans)
    .where(eq(repositoryScans.repositoryId, repositoryId))
    .orderBy(desc(repositoryScans.createdAt))
    .limit(1);

  const dependencies = await db
    .select()
    .from(repositoryDependencies)
    .where(eq(repositoryDependencies.repositoryId, repositoryId));

  const usages = await db
    .select()
    .from(codeUsages)
    .where(eq(codeUsages.repositoryId, repositoryId));

  const repoMigrations = await db
    .select()
    .from(migrations)
    .where(eq(migrations.repositoryId, repositoryId));

  return { repository, latestScan, dependencies, usages, migrations: repoMigrations };
}

export function repositoryHealth(input: {
  scanning: boolean;
  scanFailed: boolean;
  updateCount: number;
}): "healthy" | "update_available" | "scanning" | "needs_attention" {
  if (input.scanning) return "scanning";
  if (input.scanFailed) return "needs_attention";
  if (input.updateCount > 0) return "update_available";
  return "healthy";
}

export async function listRepositorySummaries(clerkUserId: string) {
  const db = getDb();
  const repos = await db
    .select()
    .from(repositories)
    .where(eq(repositories.clerkUserId, clerkUserId));

  const connected = repos.filter((repo) => !repo.disconnectedAt);
  if (connected.length === 0) return [];

  const ids = connected.map((repo) => repo.id);
  const deps = await db
    .select()
    .from(repositoryDependencies)
    .where(inArray(repositoryDependencies.repositoryId, ids));
  const scans = await db
    .select()
    .from(repositoryScans)
    .where(inArray(repositoryScans.repositoryId, ids))
    .orderBy(desc(repositoryScans.createdAt));

  return connected.map((repo) => {
    const repoDeps = deps.filter((dep) => dep.repositoryId === repo.id);
    const latestScan = scans.find((scan) => scan.repositoryId === repo.id);
    const updateCount = repoDeps.filter((dep) => dep.status === "update_available").length;
    const health = repositoryHealth({
      scanning: latestScan?.status === "scanning" || latestScan?.status === "pending",
      scanFailed: latestScan?.status === "failed",
      updateCount,
    });
    return {
      repository: repo,
      integrationCount: repoDeps.length,
      updateCount,
      health,
      latestScan,
    };
  });
}

export { getProvider };
