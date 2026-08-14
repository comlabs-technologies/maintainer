"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { selectRepositoriesAction } from "@/server/actions";
import type { GitHubRepoSummary } from "@/lib/github/port";
import { cn } from "@/lib/cn";

export function RepositoryPicker({
  installationId,
  repos,
}: {
  installationId: string;
  repos: GitHubRepoSummary[];
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter((repo) => repo.fullName.toLowerCase().includes(q));
  }, [query, repos]);

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function onContinue() {
    setError(null);
    startTransition(async () => {
      const result = await selectRepositoriesAction({
        installationId,
        repoIds: selected,
      });
      if (result?.error) setError(result.error.message);
    });
  }

  return (
    <div className="flex min-h-[60vh] flex-col">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search repositories..."
        className="h-10 w-full rounded-lg border border-border bg-white px-3 text-[14px] outline-none placeholder:text-muted focus:ring-2 focus:ring-foreground/10"
      />
      <div className="mt-4 divide-y divide-border overflow-hidden rounded-[10px] border border-border">
        {filtered.length === 0 ? (
          <div className="px-4 py-10 text-center text-[14px] text-secondary">
            No repositories match that search.
          </div>
        ) : (
          filtered.map((repo) => {
            const checked = selected.includes(repo.id);
            return (
              <label
                key={repo.id}
                className={cn(
                  "flex h-14 cursor-pointer items-center gap-3 px-4 text-[14px] hover:bg-surface",
                  checked && "bg-surface",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(repo.id)}
                  className="h-4 w-4 rounded border-border"
                />
                <span className="font-medium tracking-[-0.01em]">{repo.fullName}</span>
                {repo.private ? (
                  <span className="text-[12px] text-muted">Private</span>
                ) : null}
              </label>
            );
          })
        )}
      </div>
      <div className="sticky bottom-0 mt-auto flex items-center justify-between border-t border-border bg-white py-4">
        <p className="text-[14px] text-secondary">
          {selected.length} {selected.length === 1 ? "repository" : "repositories"} selected
        </p>
        <div className="flex items-center gap-3">
          {error ? <span className="text-[13px] text-danger">{error}</span> : null}
          <Button onClick={onContinue} disabled={selected.length === 0 || pending}>
            {pending ? "Adding…" : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
