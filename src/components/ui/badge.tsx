import { cn } from "@/lib/cn";

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

const tones: Record<Tone, string> = {
  neutral: "text-secondary border-border bg-surface",
  success: "text-success border-success-border bg-success-bg",
  warning: "text-warning border-warning-border bg-warning-bg",
  danger: "text-danger border-danger-border bg-danger-bg",
  info: "text-link border-link-border bg-link-bg",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[12px] font-medium tracking-[-0.01em]",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
