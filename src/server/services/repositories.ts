import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { githubInstallations, repositories } from "@/db/schema";
import { recordActivity } from "@/server/services/activity";
import { scanRepository } from "@/server/services/scans";
import type { GitHubRepoSummary } from "@/lib/github/port";

export async function addRepositories(input: {
  clerkUserId: string;
  installationId: string;
  selected: GitHubRepoSummary[];
}) {
  const db = getDb();
  const [installation] = await db
    .select()
    .from(githubInstallations)
    .where(
      and(
        eq(githubInstallations.id, input.installationId),
        eq(githubInstallations.clerkUserId, input.clerkUserId),
      ),
    )
    .limit(1);
  if (!installation || installation.revokedAt) {
    throw new Error("github_not_connected");
  }

  const createdIds: string[] = [];
  for (const repo of input.selected) {
    const [existing] = await db
      .select()
      .from(repositories)
      .where(
        and(
          eq(repositories.githubInstallationId, installation.id),
          eq(repositories.githubRepoId, repo.id),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .update(repositories)
        .set({
          owner: repo.owner,
          name: repo.name,
          fullName: repo.fullName,
          defaultBranch: repo.defaultBranch,
          htmlUrl: repo.htmlUrl,
          language: repo.language,
          isPrivate: repo.private,
          disconnectedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(repositories.id, existing.id));
      createdIds.push(existing.id);
      continue;
    }

    const [created] = await db
      .insert(repositories)
      .values({
        clerkUserId: input.clerkUserId,
        githubInstallationId: installation.id,
        githubRepoId: repo.id,
        owner: repo.owner,
        name: repo.name,
        fullName: repo.fullName,
        defaultBranch: repo.defaultBranch,
        htmlUrl: repo.htmlUrl,
        language: repo.language,
        isPrivate: repo.private,
        isFixture: installation.isFixture,
      })
      .returning();
    createdIds.push(created.id);
    await recordActivity({
      clerkUserId: input.clerkUserId,
      repositoryId: created.id,
      type: "repository.connected",
      title: "Repository connected",
      body: created.fullName,
    });
  }

  for (const id of createdIds) {
    await scanRepository(id).catch(() => undefined);
  }
  return createdIds;
}

export async function listConnectedRepositories(clerkUserId: string) {
  const db = getDb();
  return db
    .select()
    .from(repositories)
    .where(
      and(
        eq(repositories.clerkUserId, clerkUserId),
        isNull(repositories.disconnectedAt),
      ),
    )
    .orderBy(desc(repositories.updatedAt));
}

export async function disconnectAllGithub(clerkUserId: string) {
  const db = getDb();
  await db
    .update(repositories)
    .set({ disconnectedAt: new Date(), updatedAt: new Date() })
    .where(eq(repositories.clerkUserId, clerkUserId));
  await db
    .update(githubInstallations)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(eq(githubInstallations.clerkUserId, clerkUserId));
  await recordActivity({
    clerkUserId,
    type: "github.disconnected",
    title: "GitHub disconnected",
  });
}
