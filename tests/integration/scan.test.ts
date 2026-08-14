import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parsePackageJson, collectDeclaredDependencies } from "@/lib/scanner/manifest";
import { findProviderByPackage } from "@/lib/providers/registry";
import { pickPrimaryChange, isNewerVersion } from "@/lib/providers/versions";
import { analyzeProviderUsages } from "@/lib/scanner/analyze-usages";
import { STRIPE_PROVIDER } from "@/lib/providers/registry";

describe("repository scan against the fixture source", () => {
  it("detects stripe, openai, anthropic and a stripe migration", () => {
    const root = path.join(process.cwd(), "fixtures/sample-repo");
    const manifest = parsePackageJson(readFileSync(path.join(root, "package.json"), "utf8"));
    const declared = collectDeclaredDependencies(manifest);
    const detected = Object.entries(declared)
      .map(([packageName, specifier]) => ({
        packageName,
        specifier,
        provider: findProviderByPackage(packageName),
      }))
      .filter((item) => item.provider);

    expect(detected.map((item) => item.provider?.id).sort()).toEqual([
      "anthropic",
      "openai",
      "stripe",
    ]);

    const stripe = detected.find((item) => item.provider?.id === "stripe");
    expect(stripe).toBeTruthy();
    expect(isNewerVersion("22.0.1", "21.0.1")).toBe(true);
    expect(pickPrimaryChange("stripe", "21.0.1", "22.0.1")?.id).toBe(
      "stripe-21.0.1-22.0.1",
    );

    const usages = analyzeProviderUsages(
      [
        {
          path: "src/lib/stripe.ts",
          content: readFileSync(path.join(root, "src/lib/stripe.ts"), "utf8"),
        },
      ],
      STRIPE_PROVIDER,
    );
    expect(usages.length).toBeGreaterThan(0);
  });
});
