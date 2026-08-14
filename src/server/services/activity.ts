import "server-only";

import { getDb } from "@/db/client";
import { activityEvents } from "@/db/schema";

export async function recordActivity(input: {
  clerkUserId: string;
  repositoryId?: string | null;
  migrationId?: string | null;
  type: string;
  title: string;
  body?: string | null;
}) {
  const db = getDb();
  await db.insert(activityEvents).values({
    clerkUserId: input.clerkUserId,
    repositoryId: input.repositoryId ?? null,
    migrationId: input.migrationId ?? null,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
  });
}
