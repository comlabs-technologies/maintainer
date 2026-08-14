import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserId } from "@/lib/auth/access";
import { formatCheckDetail, getMigrationPage } from "@/server/services/migrations";
import { getProvider } from "@/lib/providers/registry";
import { Badge } from "@/components/ui/badge";
import { MigrationMotif } from "@/components/migrations/motif";
import {
  GenerateMigrationButton,
  MigrationPoller,
  OpenPullRequestButton,
} from "@/components/migrations/actions";
import { ImpactList, DiffViewer } from "@/components/migrations/impact-and-diff";
import { JobProgress } from "@/components/migrations/job-progress";
import { summarizeUsages } from "@/lib/scanner/analyze-usages";
import type { MigrationStatus } from "@/lib/domain";

function statusBadge(status: MigrationStatus) {
  if (status === "failed") return { label: "Failed", tone: "danger" as const };
  if (status === "pr_created") return { label: "Pull request opened", tone: "success" as const };
  if (status === "verified") return { label: "Migration ready", tone: "success" as const };
  if (["queued", "preparing", "migrating", "verifying"].includes(status))
    return { label: "Running", tone: "info" as const };
  return { label: "Update available", tone: "warning" as const };
}

function confidenceLabel(value: string | null) {
  if (value === "high") return "High";
  if (value === "medium") return "Medium";
  return "Needs review";
}

export default async function MigrationPage({
  params,
}: {
  params: Promise<{ migrationId: string }>;
}) {
  const { migrationId } = await params;
  const userId = await requireUserId();
  const page = await getMigrationPage(migrationId);
  if (!page?.migration || !page.repository || page.migration.clerkUserId !== userId) notFound();

  const { migration, repository, change, usages, job, events, diffs, checks, pullRequest } = page;
  const provider = getProvider(migration.providerId);
  const summary = summarizeUsages(
    usages.map((usage) => ({
      filePath: usage.filePath,
      symbol: usage.symbol,
      startLine: usage.startLine,
      endLine: usage.endLine,
      snippet: usage.snippet,
    })),
  );
  const running = ["queued", "preparing", "migrating", "verifying"].includes(migration.status);
  const badge = statusBadge(migration.status as MigrationStatus);
  const changelogUrl =
    migration.providerId === "stripe"
      ? "https://github.com/stripe/stripe-node/releases"
      : migration.providerId === "openai"
        ? "https://github.com/openai/openai-node/releases"
        : "https://github.com/anthropics/anthropic-sdk-typescript/releases";

  return (
    <div>
      <MigrationPoller active={running} />
      <Link href={`/app/repositories/${repository.id}`} className="text-[13px] text-secondary">
        ← {repository.fullName}
      </Link>
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-medium tracking-[-0.03em]">
            {provider?.displayName ?? migration.providerId}
          </h1>
          <p className="mt-1 font-mono text-[14px] text-secondary">
            {migration.fromVersion} → {migration.toVersion}
          </p>
          <div className="mt-3">
            <Badge tone={badge.tone}>{badge.label}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {migration.status === "verified" || migration.status === "pr_created" ? (
            <OpenPullRequestButton
              migrationId={migration.id}
              existingUrl={pullRequest?.githubPrUrl}
            />
          ) : (
            <GenerateMigrationButton
              migrationId={migration.id}
              disabled={running}
            />
          )}
          <a
            href={changelogUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center px-3 text-[14px] text-secondary hover:text-foreground"
          >
            View release details
          </a>
        </div>
      </div>
      <div className="mt-6">
        <MigrationMotif status={migration.status as MigrationStatus} />
      </div>
      <p className="mt-6 max-w-[520px] text-[14px] leading-6 text-secondary">
        {provider?.displayName} {migration.toVersion} contains changes affecting{" "}
        {summary.usageCount} usages across {summary.fileCount}{" "}
        {summary.fileCount === 1 ? "file" : "files"} in this repository.
      </p>
      {change ? (
        <p className="mt-3 max-w-[560px] text-[14px] leading-6 text-secondary">
          {change.description}
        </p>
      ) : null}

      {migration.status === "failed" && migration.errorMessage ? (
        <div className="mt-6 rounded-[10px] border border-danger-border bg-danger-bg px-4 py-3 text-[14px] text-danger">
          {migration.errorMessage}
        </div>
      ) : null}

      {running || (job && migration.status === "failed" && events.length > 0 && diffs.length === 0) ? (
        <section className="mt-10">
          <JobProgress events={events} usageCount={summary.usageCount} />
        </section>
      ) : null}

      {summary.files.length > 0 && !["verified", "pr_created"].includes(migration.status) ? (
        <section className="mt-10">
          <h2 className="text-[15px] font-medium tracking-[-0.01em]">Impact</h2>
          <p className="mt-1 text-[14px] text-secondary">
            {summary.usageCount} usages across {summary.fileCount}{" "}
            {summary.fileCount === 1 ? "file" : "files"}
          </p>
          <div className="mt-4">
            <ImpactList files={summary.files} />
          </div>
        </section>
      ) : null}

      {migration.status === "verified" || migration.status === "pr_created" ? (
        <>
          <section className="mt-10">
            <h2 className="text-[26px] font-medium tracking-[-0.03em]">Migration ready</h2>
            <p className="mt-2 text-[14px] text-secondary">
              {provider?.displayName}
              <span className="mx-2 font-mono">
                {migration.fromVersion} → {migration.toVersion}
              </span>
            </p>
            <p className="mt-4 text-[14px]">
              {migration.usageCount} usages migrated
              <span className="mx-2 text-muted">·</span>
              {diffs.length} {diffs.length === 1 ? "file" : "files"} changed
            </p>
          </section>
          <section className="mt-10">
            <h2 className="text-[15px] font-medium tracking-[-0.01em]">Verification</h2>
            <ul className="mt-4 divide-y divide-border overflow-hidden rounded-[10px] border border-border">
              {checks.map((check) => (
                <li
                  key={check.id}
                  className="flex h-14 items-center justify-between px-4 text-[14px]"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-4 text-center">
                      {check.status === "passed"
                        ? "✓"
                        : check.status === "failed"
                          ? "✕"
                          : "–"}
                    </span>
                    {check.name === "typecheck"
                      ? "Typecheck"
                      : check.name === "test"
                        ? "Tests"
                        : check.name === "lint"
                          ? "Lint"
                          : "Build"}
                  </span>
                  <span className="text-secondary">
                    {formatCheckDetail(check)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section className="mt-10">
            <h2 className="text-[15px] font-medium tracking-[-0.01em]">Confidence</h2>
            <p className="mt-2 text-[14px]">{confidenceLabel(migration.confidence)}</p>
          </section>
          {diffs.length > 0 ? (
            <section className="mt-10">
              <div className="flex items-baseline justify-between">
                <h2 className="text-[15px] font-medium tracking-[-0.01em]">Changes</h2>
                <p className="text-[13px] text-secondary">
                  {diffs.length} {diffs.length === 1 ? "file" : "files"}
                </p>
              </div>
              <div className="mt-4">
                <DiffViewer files={diffs} />
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
