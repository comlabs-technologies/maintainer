import { describe, expect, it } from "vitest";
import { IsolatedProcessExecutor } from "@/lib/execution/process";
import { RuleBasedCodingModel } from "@/lib/models/rule-based";
import { STRIPE_PROVIDER } from "@/lib/providers/registry";
import { STRIPE_21_TO_22 } from "@/lib/providers/catalog";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("isolated executor job lifecycle", () => {
  it("applies a candidate patch, runs configured checks, and returns a diff", async () => {
    const root = path.join(process.cwd(), "fixtures/sample-repo");
    const packageJson = readFileSync(path.join(root, "package.json"), "utf8");
    const files = [
      "src/lib/stripe.ts",
      "src/api/create-checkout.ts",
      "src/api/webhooks/stripe.ts",
    ].map((filePath) => ({
      path: filePath,
      content: readFileSync(path.join(root, filePath), "utf8"),
    }));
    const patch = await new RuleBasedCodingModel().generatePatch({
      provider: STRIPE_PROVIDER,
      change: STRIPE_21_TO_22,
      fromVersion: "21.0.1",
      toVersion: "22.0.1",
      packageName: "stripe",
      usages: [],
      files,
      packageJson,
      relatedTests: [],
    });

    const executor = new IsolatedProcessExecutor();
    const result = await executor.execute({
      jobId: "test-job",
      migrationId: "test-migration",
      repositoryFullName: "maintainer-fixtures/sample-repo",
      owner: "maintainer-fixtures",
      name: "sample-repo",
      cloneUrl: "https://github.com/maintainer-fixtures/sample-repo.git",
      commitSha: null,
      defaultBranch: "main",
      packageName: "stripe",
      fromVersion: "21.0.1",
      toVersion: "22.0.1",
      packageManager: "npm",
      localSourcePath: root,
      patch,
      checks: {
        typecheck: false,
        test: true,
        lint: true,
        build: false,
      },
      timeoutMs: 120_000,
    });

    expect(result.events.some((event) => event.step === "prepared")).toBe(true);
    expect(result.diffs.some((diff) => diff.filePath === "package.json")).toBe(true);
    const testCheck = result.checks.find((check) => check.name === "test");
    expect(testCheck?.status).toBe("passed");
    const lintCheck = result.checks.find((check) => check.name === "lint");
    expect(lintCheck?.status).toBe("passed");
  }, 120_000);
});
