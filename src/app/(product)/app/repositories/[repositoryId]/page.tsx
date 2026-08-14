import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserId } from "@/lib/auth/access";
import { getDb } from "@/db/client";
import { repositories } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { repositoryDetail } from "@/server/services/scans";
import { ScanButton } from "@/components/repositories/scan-button";
import { Badge } from "@/components/ui/badge";
import { getProvider } from "@/lib/providers/registry";
import { relativeTime, formatTimestamp } from "@/lib/utils/time";

export default async function RepositoryDetailPage({
  params,
}: {
  params: Promise<{ repositoryId: string }>;
}) {
  const userId = await requireUserId();
  const { repositoryId } = await params;
  const db = getDb();
  const [owned] = await db
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
  if (!owned) notFound();

  const detail = await repositoryDetail(repositoryId);
  if (!detail) notFound();
  const { repository, latestScan, dependencies, usages, migrations } = detail;
  const updateCount = dependencies.filter((dep) => dep.status === "update_available").length;
  const host = repository.htmlUrl.replace(/^https?:\/\//, "");

  return (
    <div>
      <Link href="/app/repositories" className="text-[13px] text-secondary">
        ← Repositories
      </Link>
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-medium tracking-[-0.03em]">
            {repository.fullName}
          </h1>
          <p className="mt-1 text-[14px] text-secondary">{host}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px] text-secondary">
            <span className="rounded-md border border-border px-2 py-0.5 font-mono">
              {repository.defaultBranch}
            </span>
            <span>
              {latestScan?.status === "scanning"
                ? "Scanning…"
                : repository.lastScannedAt
                  ? `Last scanned ${relativeTime(repository.lastScannedAt)}`
                  : "Not scanned yet"}
            </span>
          </div>
        </div>
        <ScanButton repositoryId={repository.id} />
      </div>

      {latestScan?.status === "failed" ? (
        <div className="mt-6 rounded-[10px] border border-danger-border bg-danger-bg px-4 py-3 text-[14px] text-danger">
          {latestScan.errorMessage ?? "Scan failed"}
        </div>
      ) : null}

      <section className="mt-10">
        <h2 className="text-[15px] font-medium tracking-[-0.01em]">Integrations</h2>
        {dependencies.length === 0 ? (
          <div className="mt-6 max-w-md">
            <p className="text-[15px] font-medium">No integrations detected</p>
            <p className="mt-2 text-[14px] text-secondary">
              Maintainer currently supports Stripe, OpenAI and Anthropic TypeScript SDKs.
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-[10px] border border-border">
            <div className="grid grid-cols-4 border-b border-border bg-surface px-4 text-[13px] text-secondary">
              <div className="h-10 content-center">Integration</div>
              <div className="h-10 content-center">Current</div>
              <div className="h-10 content-center">Latest</div>
              <div className="h-10 content-center">Status</div>
            </div>
            {dependencies.map((dep) => {
              const provider = getProvider(dep.providerId);
              const migration = migrations.find(
                (item) =>
                  item.providerId === dep.providerId &&
                  item.fromVersion === dep.currentVersion,
              );
              const href = migration
                ? `/app/migrations/${migration.id}`
                : undefined;
              const Row = href ? "a" : "div";
              return (
                <Row
                  key={dep.id}
                  href={href}
                  className="grid h-14 grid-cols-4 items-center border-b border-border px-4 last:border-b-0 hover:bg-surface"
                >
                  <div className="font-medium">{provider?.displayName ?? dep.providerId}</div>
                  <div className="font-mono text-[13px]">{dep.currentVersion}</div>
                  <div className="font-mono text-[13px]">{dep.latestVersion}</div>
                  <div>
                    {dep.status === "update_available" ? (
                      <Badge tone="warning">Update available</Badge>
                    ) : (
                      <Badge tone="success">Current</Badge>
                    )}
                  </div>
                </Row>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-[15px] font-medium tracking-[-0.01em]">Summary</h2>
        <dl className="mt-4 grid gap-3 text-[14px] sm:grid-cols-2">
          <div>
            <dt className="text-secondary">Integrations</dt>
            <dd className="mt-1">{dependencies.length}</dd>
          </div>
          <div>
            <dt className="text-secondary">Updates available</dt>
            <dd className="mt-1">{updateCount}</dd>
          </div>
          <div>
            <dt className="text-secondary">External SDK usages</dt>
            <dd className="mt-1">{usages.length}</dd>
          </div>
          <div>
            <dt className="text-secondary">Last successful scan</dt>
            <dd className="mt-1">{formatTimestamp(repository.lastSuccessfulScanAt)}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
