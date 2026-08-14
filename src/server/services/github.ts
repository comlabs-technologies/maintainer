import "server-only";

import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { githubInstallations } from "@/db/schema";
import { FIXTURE_INSTALLATION_ID, FIXTURE_REPO } from "@/lib/github/fixture-port";
import { getGitHubPort, githubConnectionState } from "@/lib/github";
import { recordActivity } from "@/server/services/activity";

export async function upsertInstallation(input: {
  clerkUserId: string;
  installationId: string;
  accountLogin: string;
  accountType: string;
  accountId: string;
  isFixture?: boolean;
}) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(githubInstallations)
    .where(eq(githubInstallations.installationId, input.installationId))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(githubInstallations)
      .set({
        clerkUserId: input.clerkUserId,
        accountLogin: input.accountLogin,
        accountType: input.accountType,
        accountId: input.accountId,
        revokedAt: null,
        suspendedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(githubInstallations.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(githubInstallations)
    .values({
      clerkUserId: input.clerkUserId,
      installationId: input.installationId,
      accountLogin: input.accountLogin,
      accountType: input.accountType,
      accountId: input.accountId,
      isFixture: input.isFixture ?? false,
    })
    .returning();
  return created;
}

export async function connectFixtureInstallation(clerkUserId: string) {
  const installation = await upsertInstallation({
    clerkUserId,
    installationId: FIXTURE_INSTALLATION_ID,
    accountLogin: FIXTURE_REPO.owner,
    accountType: "User",
    accountId: "fixture-account",
    isFixture: true,
  });
  await recordActivity({
    clerkUserId,
    type: "github.connected",
    title: "Development fixture connected",
    body: FIXTURE_REPO.fullName,
  });
  return installation;
}

export async function listSelectableRepositories(clerkUserId: string) {
  const db = getDb();
  const [installation] = await db
    .select()
    .from(githubInstallations)
    .where(eq(githubInstallations.clerkUserId, clerkUserId))
    .limit(1);
  if (!installation || installation.revokedAt) {
    return { installation: null, repos: [], connection: githubConnectionState() };
  }
  const port = getGitHubPort();
  const repos = await port.listInstallationRepos(installation.installationId);
  return { installation, repos, connection: githubConnectionState() };
}

export async function revokeInstallation(installationId: string) {
  const db = getDb();
  await db
    .update(githubInstallations)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(eq(githubInstallations.installationId, installationId));
}

export async function getInstallationForUser(clerkUserId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(githubInstallations)
    .where(eq(githubInstallations.clerkUserId, clerkUserId))
    .orderBy(desc(githubInstallations.createdAt))
    .limit(1);
  return row ?? null;
}
