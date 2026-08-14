"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

export function ImpactList({
  files,
}: {
  files: Array<{
    filePath: string;
    usageCount: number;
    snippets: Array<{ startLine: number; snippet: string; symbol: string }>;
  }>;
}) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="divide-y divide-border overflow-hidden rounded-[10px] border border-border">
      {files.map((file) => {
        const expanded = open === file.filePath;
        return (
          <div key={file.filePath}>
            <button
              type="button"
              onClick={() => setOpen(expanded ? null : file.filePath)}
              className="flex h-14 w-full items-center justify-between px-4 text-left hover:bg-surface"
            >
              <span className="font-mono text-[13px] text-foreground">
                {file.filePath}
              </span>
              <span className="text-[13px] text-secondary">
                {file.usageCount} {file.usageCount === 1 ? "usage" : "usages"}
              </span>
            </button>
            {expanded ? (
              <div className="space-y-3 border-t border-border bg-subtle px-4 py-3">
                {file.snippets.map((snippet, index) => (
                  <div key={`${snippet.startLine}-${index}`}>
                    <p className="mb-1 font-mono text-[12px] text-muted">
                      L{snippet.startLine} · {snippet.symbol}
                    </p>
                    <pre className="overflow-x-auto font-mono text-[13px] leading-5 text-foreground">
                      {snippet.snippet}
                    </pre>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function DiffViewer({
  files,
}: {
  files: Array<{
    filePath: string;
    additions: number;
    deletions: number;
    patch: string;
  }>;
}) {
  const [active, setActive] = useState(files[0]?.filePath ?? null);
  const current = files.find((file) => file.filePath === active) ?? files[0];
  if (!current) return null;
  return (
    <div className="overflow-hidden rounded-[10px] border border-border md:grid md:grid-cols-[240px_1fr]">
      <div className="border-b border-border md:border-b-0 md:border-r">
        {files.map((file) => (
          <button
            key={file.filePath}
            type="button"
            onClick={() => setActive(file.filePath)}
            className={cn(
              "flex w-full items-start justify-between gap-3 px-3 py-3 text-left text-[13px] hover:bg-surface",
              file.filePath === current.filePath && "bg-surface",
            )}
          >
            <span className="font-mono leading-5">{file.filePath}</span>
            <span className="shrink-0 font-mono text-muted">
              +{file.additions} −{file.deletions}
            </span>
          </button>
        ))}
      </div>
      <pre className="max-h-[480px] overflow-auto bg-white p-4 font-mono text-[13px] leading-5">
        {current.patch.split("\n").map((line, index) => {
          const tone = line.startsWith("+") && !line.startsWith("+++")
            ? "bg-success-bg text-success"
            : line.startsWith("-") && !line.startsWith("---")
              ? "bg-danger-bg text-danger"
              : line.startsWith("@@")
                ? "text-muted"
                : "text-foreground";
          return (
            <div key={index} className={cn("whitespace-pre", tone)}>
              {line || " "}
            </div>
          );
        })}
      </pre>
    </div>
  );
}
