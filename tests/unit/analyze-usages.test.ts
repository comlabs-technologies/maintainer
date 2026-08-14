import { describe, expect, it } from "vitest";
import { analyzeProviderUsages, summarizeUsages } from "@/lib/scanner/analyze-usages";
import { STRIPE_PROVIDER } from "@/lib/providers/registry";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("typescript usage analysis", () => {
  it("finds stripe usages in the sample fixture", () => {
    const root = path.join(process.cwd(), "fixtures/sample-repo");
    const files = [
      "src/lib/stripe.ts",
      "src/api/create-checkout.ts",
      "src/api/webhooks/stripe.ts",
    ].map((filePath) => ({
      path: filePath,
      content: readFileSync(path.join(root, filePath), "utf8"),
    }));
    const usages = analyzeProviderUsages(files, STRIPE_PROVIDER);
    const summary = summarizeUsages(usages);
    expect(summary.fileCount).toBe(3);
    expect(summary.usageCount).toBeGreaterThanOrEqual(3);
    expect(summary.files.map((file) => file.filePath)).toEqual([
      "src/api/create-checkout.ts",
      "src/api/webhooks/stripe.ts",
      "src/lib/stripe.ts",
    ]);
  });
});
