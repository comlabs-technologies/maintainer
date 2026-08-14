import { NextResponse } from "next/server";
import { requireMigrationAccess } from "@/lib/auth/access";
import { getMigrationPage } from "@/server/services/migrations";

export async function GET(
  _request: Request,
  context: { params: Promise<{ migrationId: string }> },
) {
  const { migrationId } = await context.params;
  await requireMigrationAccess(migrationId);
  const page = await getMigrationPage(migrationId);
  if (!page) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({
    status: page.migration.status,
    step: page.job?.currentStep ?? null,
  });
}
