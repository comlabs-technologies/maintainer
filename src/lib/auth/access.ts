import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import {
  githubInstallations,
  migrations,
  repositories,
  userPreferences,
  userProfiles,
} from "@/db/schema";
import { ensureCatalogSeeded } from "@/db/seed";
import { AuthError } from "@/lib/auth/errors";

export { AuthError };

export async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  await ensureAppUser(userId);
  return userId;
}

export async function requireUserIdApi(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new AuthError("unauthenticated", "Sign in required");
  await ensureAppUser(userId);
  return userId;
}

export async function ensureAppUser(clerkUserId: string) {
  const db = getDb();
  await ensureCatalogSeeded(db);
  await db
    .insert(userProfiles)
    .values({ clerkUserId })
    .onConflictDoNothing({ target: userProfiles.clerkUserId });
  await db
    .insert(userPreferences)
    .values({ clerkUserId })
    .onConflictDoNothing({ target: userPreferences.clerkUserId });
}

export async function getSignedInUser() {
  const userId = await requireUserId();
  const user = await currentUser();
  return {
    userId,
    name:
      user?.fullName ??
      user?.firstName ??
      user?.primaryEmailAddress?.emailAddress ??
      "Account",
    imageUrl: user?.imageUrl ?? null,
    email: user?.primaryEmailAddress?.emailAddress ?? null,
  };
}

export async function requireRepositoryAccess(repositoryId: string) {
  const userId = await requireUserIdApi();
  const db = getDb();
  const [row] = await db
    .select()
    .from(repositories)
    .where(
      and(
        eq(repositories.id, repositoryId),
        eq(repositories.clerkUserId, userId),
        isNull(repositories.disconnectedAt),
      ),
    )
    .limit(1);
  if (!row) throw new AuthError("forbidden", "Repository not found");
  return { userId, repository: row };
}

export async function requireMigrationAccess(migrationId: string) {
  const userId = await requireUserIdApi();
  const db = getDb();
  const [row] = await db
    .select({
      migration: migrations,
      repository: repositories,
    })
    .from(migrations)
    .innerJoin(repositories, eq(migrations.repositoryId, repositories.id))
    .where(and(eq(migrations.id, migrationId), eq(migrations.clerkUserId, userId)))
    .limit(1);
  if (!row || row.repository.disconnectedAt) {
    throw new AuthError("forbidden", "Migration not found");
  }
  return { userId, migration: row.migration, repository: row.repository };
}

export async function getActiveInstallation(clerkUserId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(githubInstallations)
    .where(eq(githubInstallations.clerkUserId, clerkUserId))
    .limit(1);
  if (!row || row.revokedAt) return null;
  return row;
}
