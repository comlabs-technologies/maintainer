"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuthError, requireRepositoryAccess, requireUserIdApi } from "@/lib/auth/access";
import { connectFixtureInstallation, listSelectableRepositories } from "@/server/services/github";
import { addRepositories, disconnectAllGithub } from "@/server/services/repositories";
import { scanRepository } from "@/server/services/scans";
import { openPullRequest, queueMigrationJob } from "@/server/services/migrations";
import { getDb } from "@/db/client";
import { userPreferences } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isDevFixturesEnabled } from "@/lib/env";

function asError(error: unknown): { error: { code: string; message: string } } {
  if (error instanceof AuthError) {
    return { error: { code: error.code, message: error.message } };
  }
  const message = error instanceof Error ? error.message : "Something went wrong";
  return { error: { code: message, message } };
}

const selectSchema = z.object({
  installationId: z.string().min(1),
  repoIds: z.array(z.string().min(1)).min(1),
});

export async function selectRepositoriesAction(input: {
  installationId: string;
  repoIds: string[];
}) {
  try {
    const userId = await requireUserIdApi();
    const parsed = selectSchema.parse(input);
    const { repos } = await listSelectableRepositories(userId);
    const selected = repos.filter((repo) => parsed.repoIds.includes(repo.id));
    if (selected.length === 0) {
      return { error: { code: "invalid", message: "Select at least one repository" } };
    }
    await addRepositories({
      clerkUserId: userId,
      installationId: parsed.installationId,
      selected,
    });
    revalidatePath("/app/repositories");
  } catch (error) {
    return asError(error);
  }
  redirect("/app/repositories");
}

export async function connectFixtureAction() {
  try {
    const userId = await requireUserIdApi();
    if (!isDevFixturesEnabled()) {
      return { error: { code: "forbidden", message: "Fixtures are not enabled" } };
    }
    await connectFixtureInstallation(userId);
    revalidatePath("/app/connect");
    revalidatePath("/app/repositories/new");
  } catch (error) {
    return asError(error);
  }
  redirect("/app/repositories/new");
}

export async function scanRepositoryAction(repositoryId: string) {
  try {
    await requireRepositoryAccess(repositoryId);
    await scanRepository(repositoryId);
    revalidatePath(`/app/repositories/${repositoryId}`);
    revalidatePath("/app/repositories");
    revalidatePath("/app/activity");
    return { ok: true as const };
  } catch (error) {
    return asError(error);
  }
}

export async function generateMigrationAction(migrationId: string) {
  try {
    const userId = await requireUserIdApi();
    await queueMigrationJob(migrationId, userId);
    revalidatePath(`/app/migrations/${migrationId}`);
    return { ok: true as const };
  } catch (error) {
    return asError(error);
  }
}

export async function openPullRequestAction(migrationId: string) {
  try {
    const userId = await requireUserIdApi();
    const pr = await openPullRequest(migrationId, userId);
    revalidatePath(`/app/migrations/${migrationId}`);
    revalidatePath("/app/activity");
    return { ok: true as const, url: pr.githubPrUrl };
  } catch (error) {
    return asError(error);
  }
}

const prefsSchema = z.object({
  runTypecheck: z.boolean(),
  runTests: z.boolean(),
  runBuild: z.boolean(),
  runLint: z.boolean(),
});

export async function updatePreferencesAction(input: z.infer<typeof prefsSchema>) {
  try {
    const userId = await requireUserIdApi();
    const parsed = prefsSchema.parse(input);
    const db = getDb();
    await db
      .update(userPreferences)
      .set({ ...parsed, updatedAt: new Date() })
      .where(eq(userPreferences.clerkUserId, userId));
    revalidatePath("/app/settings");
    return { ok: true as const };
  } catch (error) {
    return asError(error);
  }
}

export async function disconnectGithubAction() {
  try {
    const userId = await requireUserIdApi();
    await disconnectAllGithub(userId);
    revalidatePath("/app/settings");
    revalidatePath("/app/repositories");
    return { ok: true as const };
  } catch (error) {
    return asError(error);
  }
}
