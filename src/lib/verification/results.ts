import type { CheckName, CheckStatus, ConfidenceLevel, VerificationCheckResult } from "@/lib/domain";

export function detectScripts(scripts: Record<string, string>): Record<CheckName, string | null> {
  const typecheck =
    scripts.typecheck ??
    scripts["type-check"] ??
    (scripts.build?.includes("tsc") ? null : scripts.tsc) ??
    null;
  return {
    typecheck: typecheck ?? (scripts.build?.includes("tsc --noEmit") ? scripts.build : null),
    test: scripts.test ?? null,
    lint: scripts.lint ?? null,
    build: scripts.build ?? null,
  };
}

export function parseTestSummary(output: string): string | null {
  const vitest = output.match(/(\d+)\s+passed/);
  if (vitest) return `${vitest[1]} passed`;
  const nodeTest = output.match(/# tests (\d+)/);
  const nodePass = output.match(/# pass (\d+)/);
  if (nodePass) return `${nodePass[1]} passed`;
  if (nodeTest) return `${nodeTest[1]} tests`;
  return null;
}

export function deriveConfidence(input: {
  checks: Pick<VerificationCheckResult, "name" | "status">[];
  unresolvedUsages: number;
  filesChanged: number;
}): ConfidenceLevel {
  const failed = input.checks.filter((check) => check.status === "failed");
  const typecheck = input.checks.find((check) => check.name === "typecheck");
  if (failed.length > 0 || input.unresolvedUsages > 0) return "needs_review";
  const requiredPassed = ["typecheck", "test", "build"].every((name) => {
    const check = input.checks.find((item) => item.name === name);
    return !check || check.status === "passed" || check.status === "not_configured" || check.status === "skipped";
  });
  if (
    requiredPassed &&
    typecheck?.status === "passed" &&
    input.filesChanged > 0 &&
    input.unresolvedUsages === 0
  ) {
    return "high";
  }
  return "medium";
}

export function overallVerificationStatus(
  checks: Array<{ status: CheckStatus }>,
): "passed" | "failed" | "partial" {
  if (checks.some((check) => check.status === "failed")) return "failed";
  if (checks.some((check) => check.status === "passed")) return "passed";
  return "partial";
}
