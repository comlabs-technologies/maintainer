import { describe, expect, it } from "vitest";
import { findProviderByPackage, PROVIDERS } from "@/lib/providers/registry";
import {
  collectDeclaredDependencies,
  detectPackageManager,
  parsePackageJson,
} from "@/lib/scanner/manifest";

describe("provider detection", () => {
  it("maps supported packages", () => {
    expect(findProviderByPackage("stripe")?.id).toBe("stripe");
    expect(findProviderByPackage("openai")?.id).toBe("openai");
    expect(findProviderByPackage("@anthropic-ai/sdk")?.id).toBe("anthropic");
    expect(findProviderByPackage("lodash")).toBeUndefined();
  });

  it("registers exactly the V1 providers", () => {
    expect(PROVIDERS.map((provider) => provider.id)).toEqual([
      "stripe",
      "openai",
      "anthropic",
    ]);
  });
});

describe("dependency parsing", () => {
  it("reads package.json dependencies", () => {
    const manifest = parsePackageJson(
      JSON.stringify({
        dependencies: { stripe: "21.0.1" },
        devDependencies: { typescript: "5.8.0" },
        scripts: { test: "vitest" },
        packageManager: "pnpm@10.0.0",
      }),
    );
    expect(collectDeclaredDependencies(manifest).stripe).toBe("21.0.1");
    expect(manifest.packageManagerField).toBe("pnpm@10.0.0");
  });

  it("detects npm and pnpm and rejects yarn-only", () => {
    expect(
      detectPackageManager({
        hasPackageLock: true,
        hasPnpmLock: false,
        hasYarnLock: false,
      }),
    ).toBe("npm");
    expect(
      detectPackageManager({
        hasPackageLock: false,
        hasPnpmLock: true,
        hasYarnLock: false,
      }),
    ).toBe("pnpm");
    expect(
      detectPackageManager({
        hasPackageLock: false,
        hasPnpmLock: false,
        hasYarnLock: true,
      }),
    ).toBe("unsupported");
  });
});
