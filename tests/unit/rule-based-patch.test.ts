import { describe, expect, it } from "vitest";
import { RuleBasedCodingModel } from "@/lib/models/rule-based";
import { STRIPE_PROVIDER } from "@/lib/providers/registry";
import { STRIPE_21_TO_22 } from "@/lib/providers/catalog";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("rule-based stripe migration", () => {
  it("upgrades package.json and rewrites constructor options", async () => {
    const root = path.join(process.cwd(), "fixtures/sample-repo");
    const packageJson = readFileSync(path.join(root, "package.json"), "utf8");
    const stripeFile = readFileSync(path.join(root, "src/lib/stripe.ts"), "utf8");
    const checkout = readFileSync(path.join(root, "src/api/create-checkout.ts"), "utf8");
    const model = new RuleBasedCodingModel();
    const patch = await model.generatePatch({
      provider: STRIPE_PROVIDER,
      change: STRIPE_21_TO_22,
      fromVersion: "21.0.1",
      toVersion: "22.0.1",
      packageName: "stripe",
      usages: [],
      files: [
        { path: "src/lib/stripe.ts", content: stripeFile },
        { path: "src/api/create-checkout.ts", content: checkout },
      ],
      packageJson,
      relatedTests: [],
    });
    const pkg = patch.files.find((file) => file.path === "package.json");
    expect(pkg?.content).toContain('"stripe": "22.0.1"');
    const lib = patch.files.find((file) => file.path === "src/lib/stripe.ts");
    expect(lib?.content).not.toContain("typescript: true");
    expect(lib?.content).toContain("2025-03-31.basil");
    const api = patch.files.find((file) => file.path === "src/api/create-checkout.ts");
    expect(api?.content).toContain("payment_method");
    expect(api?.content).not.toMatch(/source,/);
  });
});
