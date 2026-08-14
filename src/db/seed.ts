import { eq } from "drizzle-orm";
import { apiChanges, providers } from "@/db/schema";
import { PROVIDERS } from "@/lib/providers/registry";
import { CATALOGUED_API_CHANGES } from "@/lib/providers/catalog";
import type { Database } from "@/db/client";

let seeded = false;

export async function ensureCatalogSeeded(db: Database) {
  if (seeded) return;
  for (const provider of PROVIDERS) {
    await db
      .insert(providers)
      .values({
        id: provider.id,
        displayName: provider.displayName,
        packages: provider.packages,
      })
      .onConflictDoNothing();
  }
  for (const change of CATALOGUED_API_CHANGES) {
    await db
      .insert(apiChanges)
      .values({
        id: change.id,
        providerId: change.providerId,
        fromVersion: change.fromVersion,
        toVersion: change.toVersion,
        severity: change.severity,
        affectedSymbols: change.affectedSymbols,
        description: change.description,
        migrationInstructions: change.migrationInstructions,
        isFixture: true,
      })
      .onConflictDoUpdate({
        target: apiChanges.id,
        set: {
          description: change.description,
          migrationInstructions: change.migrationInstructions,
          affectedSymbols: change.affectedSymbols,
          fromVersion: change.fromVersion,
          toVersion: change.toVersion,
          severity: change.severity,
          updatedAt: new Date(),
        },
      });
  }
  void eq;
  seeded = true;
}
