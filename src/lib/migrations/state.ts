import type { MigrationStatus } from "@/lib/domain";

const ALLOWED: Record<MigrationStatus, MigrationStatus[]> = {
  detected: ["analyzing", "failed"],
  analyzing: ["ready", "failed"],
  ready: ["queued", "failed"],
  queued: ["preparing", "failed"],
  preparing: ["migrating", "failed"],
  migrating: ["verifying", "failed"],
  verifying: ["verified", "failed"],
  verified: ["pr_created", "failed"],
  failed: ["queued", "analyzing", "ready"],
  pr_created: [],
};

export function canTransition(
  from: MigrationStatus,
  to: MigrationStatus,
): boolean {
  if (from === to) return true;
  return ALLOWED[from]?.includes(to) ?? false;
}

export function assertTransition(from: MigrationStatus, to: MigrationStatus) {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid migration transition: ${from} → ${to}`);
  }
}

export type MotifStep = "detected" | "analyzed" | "migrated" | "verified";
export type MotifState = "complete" | "current" | "upcoming" | "failed";

export function motifStates(
  status: MigrationStatus,
): Record<MotifStep, MotifState> {
  const failed = status === "failed";
  const order: MotifStep[] = ["detected", "analyzed", "migrated", "verified"];
  let current: MotifStep = "detected";
  if (status === "detected" || status === "analyzing") current = "detected";
  else if (status === "ready") current = "analyzed";
  else if (
    status === "queued" ||
    status === "preparing" ||
    status === "migrating"
  )
    current = "migrated";
  else if (status === "verifying") current = "verified";
  else if (status === "verified" || status === "pr_created") current = "verified";

  const currentIndex = order.indexOf(current);
  const completeThrough =
    status === "verified" || status === "pr_created"
      ? 3
      : status === "ready"
        ? 1
        : currentIndex - 1;

  return {
    detected:
      completeThrough >= 0
        ? "complete"
        : current === "detected"
          ? failed
            ? "failed"
            : "current"
          : "upcoming",
    analyzed:
      completeThrough >= 1
        ? "complete"
        : current === "analyzed"
          ? failed
            ? "failed"
            : "current"
          : currentIndex > 1
            ? "complete"
            : "upcoming",
    migrated:
      completeThrough >= 2 ||
      status === "verifying" ||
      status === "verified" ||
      status === "pr_created"
        ? "complete"
        : current === "migrated"
          ? failed
            ? "failed"
            : "current"
          : "upcoming",
    verified:
      status === "verified" || status === "pr_created"
        ? "complete"
        : current === "verified"
          ? failed
            ? "failed"
            : "current"
          : "upcoming",
  };
}
