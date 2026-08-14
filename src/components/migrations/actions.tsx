"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { generateMigrationAction, openPullRequestAction } from "@/server/actions";

export function GenerateMigrationButton({
  migrationId,
  disabled,
}: {
  migrationId: string;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      disabled={disabled || pending}
      onClick={() => {
        startTransition(async () => {
          await generateMigrationAction(migrationId);
        });
      }}
    >
      {pending ? "Starting…" : "Generate migration"}
    </Button>
  );
}

export function OpenPullRequestButton({
  migrationId,
  existingUrl,
}: {
  migrationId: string;
  existingUrl?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  if (existingUrl) {
    return (
      <a
        href={existingUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-9 items-center rounded-lg bg-foreground px-3 text-[14px] font-medium text-white"
      >
        View pull request ↗
      </a>
    );
  }
  return (
    <Button
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await openPullRequestAction(migrationId);
        });
      }}
    >
      {pending ? "Opening…" : "Open pull request"}
    </Button>
  );
}

export function MigrationPoller({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), 1500);
    return () => clearInterval(timer);
  }, [active, router]);
  return null;
}
