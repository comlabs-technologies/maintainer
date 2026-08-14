import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const styles: Record<Variant, string> = {
  primary:
    "bg-foreground text-white hover:bg-neutral-800 disabled:bg-neutral-400",
  secondary:
    "bg-white text-foreground border border-border hover:bg-surface disabled:text-muted",
  ghost: "bg-transparent text-foreground hover:bg-surface disabled:text-muted",
  danger:
    "bg-white text-danger border border-danger-border hover:bg-danger-bg",
};

export function Button({
  className,
  variant = "primary",
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
}) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-[14px] font-medium tracking-[-0.01em] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:cursor-not-allowed",
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}

export function buttonClass(variant: Variant = "primary", className?: string) {
  return cn(
    "inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-[14px] font-medium tracking-[-0.01em] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20",
    styles[variant],
    className,
  );
}
