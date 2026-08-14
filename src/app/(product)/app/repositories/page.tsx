import Link from "next/link";
import { requireUserId } from "@/lib/auth/access";
import { listRepositorySummaries } from "@/server/services/scans";
import { getInstallationForUser } from "@/server/services/github";
import { relativeTime } from "@/lib/utils/time";
import { buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { githubConnectionState } from "@/lib/github";

function healthLabel(health: string, updateCount: number) {
  if (health === "scanning") return { label: "Scanning", tone: "info" as const };
  if (health === "needs_attention")
    return { label: "Needs attention", tone: "danger" as const };
  if (health === "update_available")
    return {
      label: updateCount === 1 ? "1 update" : `${updateCount} updates`,
      tone: "warning" as const,
    };
  return { label: "Healthy", tone: "success" as const };
}

export default async function RepositoriesPage() {
  const userId = await requireUserId();
  const installation = await getInstallationForUser(userId);
  const rows = await listRepositorySummaries(userId);
  const connected = rows.filter((row) => !row.repository.disconnectedAt);
  const connection = githubConnectionState();

  if (!installation || installation.revokedAt) {
    return (
      <div>
        <h1 className="text-[26px] font-medium tracking-[-0.03em]">Repositories</h1>
        <p className="mt-2 text-[14px] text-secondary">
          Connect GitHub to select repositories Maintainer can monitor.
        </p>
        <Link href="/app/connect" className={`${buttonClass("primary")} mt-6`}>
          Connect GitHub
        </Link>
        {connection === "missing" ? (
          <p className="mt-4 text-[13px] text-muted">
            GitHub App credentials are not configured in this environment.
          </p>
        ) : null}
      </div>
    );
  }

  if (connected.length === 0) {
    return (
      <div>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-medium tracking-[-0.03em]">
              Repositories
            </h1>
            <p className="mt-2 text-[14px] text-secondary">
              Repositories connected to Maintainer.
            </p>
          </div>
          <Link href="/app/repositories/new" className={buttonClass("primary")}>
            + Add repository
          </Link>
        </div>
        <div className="mt-16 text-center">
          <p className="text-[15px] font-medium">No repositories yet</p>
          <p className="mt-2 text-[14px] text-secondary">
            Choose repositories from your GitHub App installation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-medium tracking-[-0.03em]">
            Repositories
          </h1>
          <p className="mt-2 text-[14px] text-secondary">
            Repositories connected to Maintainer.
          </p>
        </div>
        <Link href="/app/repositories/new" className={buttonClass("primary")}>
          + Add repository
        </Link>
      </div>
      <div className="mt-8 overflow-hidden rounded-[10px] border border-border">
        <div className="grid grid-cols-[1fr_90px_140px_100px] border-b border-border bg-surface px-4 text-[13px] text-secondary">
          <div className="h-10 content-center">Repository</div>
          <div className="h-10 content-center">Integrations</div>
          <div className="h-10 content-center">Status</div>
          <div className="h-10 content-center text-right">Updated</div>
        </div>
        {connected.map((row) => {
          const status = healthLabel(row.health, row.updateCount);
          return (
            <Link
              key={row.repository.id}
              href={`/app/repositories/${row.repository.id}`}
              className="grid h-14 grid-cols-[1fr_90px_140px_100px] items-center border-b border-border px-4 last:border-b-0 hover:bg-surface"
            >
              <div className="flex items-center gap-2 font-medium tracking-[-0.01em]">
                {row.repository.fullName}
                {row.repository.isFixture ? (
                  <span className="text-[12px] font-normal text-muted">
                    Fixture
                  </span>
                ) : null}
              </div>
              <div className="text-[14px] text-secondary">
                {row.integrationCount}
              </div>
              <div>
                <Badge tone={status.tone}>{status.label}</Badge>
              </div>
              <div className="text-right text-[13px] text-secondary">
                {relativeTime(row.repository.updatedAt)}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
