import { cn } from "@/lib/cn";
import { motifStates, type MotifStep } from "@/lib/migrations/state";
import type { MigrationStatus } from "@/lib/domain";

const LABELS: Record<MotifStep, string> = {
  detected: "Detected",
  analyzed: "Analyzed",
  migrated: "Migrated",
  verified: "Verified",
};

export function MigrationMotif({ status }: { status: MigrationStatus }) {
  const states = motifStates(status);
  const steps: MotifStep[] = ["detected", "analyzed", "migrated", "verified"];
  return (
    <ol className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
      {steps.map((step, index) => {
        const state = states[step];
        return (
          <li key={step} className="flex items-center gap-2">
            {index > 0 ? <span className="text-border">→</span> : null}
            <span
              className={cn(
                "tracking-[-0.01em]",
                state === "complete" && "text-foreground",
                state === "current" && "text-foreground font-medium",
                state === "failed" && "text-danger",
                state === "upcoming" && "text-muted",
              )}
            >
              {LABELS[step]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
