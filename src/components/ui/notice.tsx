import { cn } from "@/lib/cn";

export function Notice({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "danger" | "warning";
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "rounded-[10px] border px-4 py-3 text-[14px] leading-5",
        tone === "danger" && "border-danger-border bg-danger-bg text-danger",
        tone === "warning" && "border-warning-border bg-warning-bg text-warning",
        tone === "neutral" && "border-border bg-surface text-secondary",
        className,
      )}
    >
      {children}
    </div>
  );
}
