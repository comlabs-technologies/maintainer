import type { JobStep } from "@/lib/domain";

const ORDER: Array<{ step: JobStep; label: string }> = [
  { step: "prepared", label: "Repository prepared" },
  { step: "upgraded", label: "Dependency upgraded" },
  { step: "analyzed", label: "Affected usages analyzed" },
  { step: "applying", label: "Applying migration" },
  { step: "typecheck", label: "Type checking" },
  { step: "test", label: "Running tests" },
  { step: "lint", label: "Lint" },
  { step: "build", label: "Building repository" },
];

export function JobProgress({
  events,
  usageCount,
}: {
  events: Array<{ step: string; status: string; message: string }>;
  usageCount: number;
}) {
  const byStep = new Map(events.map((event) => [event.step, event]));
  const failed = events.some((event) => event.status === "failed");
  return (
    <div className="space-y-4">
      <h2 className="text-[15px] font-medium tracking-[-0.01em]">
        {failed ? "Migration failed" : "Preparing migration"}
      </h2>
      <ul className="space-y-2 text-[14px]">
        {ORDER.map((item) => {
          const event = byStep.get(item.step);
          const status = event?.status ?? "pending";
          const mark =
            status === "completed"
              ? "✓"
              : status === "running"
                ? "●"
                : status === "failed"
                  ? "✕"
                  : status === "skipped"
                    ? "–"
                    : "○";
          const label =
            item.step === "analyzed" && usageCount
              ? `${usageCount} affected usages analyzed`
              : item.label;
          return (
            <li
              key={item.step}
              className={
                status === "pending"
                  ? "text-muted"
                  : status === "failed"
                    ? "text-danger"
                    : "text-foreground"
              }
            >
              <span className="mr-2 inline-block w-4 text-center">{mark}</span>
              {label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
