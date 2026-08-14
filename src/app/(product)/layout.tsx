import { AppShell } from "@/components/app-shell/app-shell";
import { MissingConfig } from "@/components/setup/missing-config";
import { getSignedInUser } from "@/lib/auth/access";
import { isClerkConfigured, isDatabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const missing: Array<"clerk" | "database"> = [];
  if (!isClerkConfigured()) missing.push("clerk");
  if (!isDatabaseConfigured()) missing.push("database");
  if (missing.length > 0) {
    return <MissingConfig missing={missing} />;
  }

  let user: Awaited<ReturnType<typeof getSignedInUser>>;
  try {
    user = await getSignedInUser();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("DATABASE_URL") || message.includes("connect")) {
      return <MissingConfig missing={["database"]} />;
    }
    throw error;
  }

  return (
    <AppShell userName={user.name} userImage={user.imageUrl}>
      {children}
    </AppShell>
  );
}
