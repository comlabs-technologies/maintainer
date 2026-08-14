import { describe, expect, it } from "vitest";
import {
  changeApplies,
  coerceVersion,
  compareVersions,
  isNewerVersion,
  pickPrimaryChange,
} from "@/lib/providers/versions";
import { STRIPE_21_TO_22 } from "@/lib/providers/catalog";
import { parseNpmLockfileVersion, parsePnpmLockfileVersion } from "@/lib/scanner/lockfile";

describe("version comparison", () => {
  it("coerces and compares semver", () => {
    expect(coerceVersion("^21.0.1")).toBe("21.0.1");
    expect(compareVersions("22.0.1", "21.0.1")).toBeGreaterThan(0);
    expect(isNewerVersion("22.0.1", "21.0.1")).toBe(true);
    expect(isNewerVersion("21.0.1", "21.0.1")).toBe(false);
  });

  it("matches catalogued stripe changes", () => {
    expect(changeApplies(STRIPE_21_TO_22, "21.0.1")).toBe(true);
    expect(changeApplies(STRIPE_21_TO_22, "22.0.1")).toBe(false);
    expect(pickPrimaryChange("stripe", "21.0.1", "22.0.1")?.id).toBe(
      STRIPE_21_TO_22.id,
    );
  });
});

describe("lockfile parsing", () => {
  it("reads npm lockfile v2 packages", () => {
    const raw = JSON.stringify({
      packages: {
        "node_modules/stripe": { version: "21.0.1" },
      },
    });
    expect(parseNpmLockfileVersion(raw, "stripe")).toBe("21.0.1");
  });

  it("reads pnpm lockfile importer versions", () => {
    const raw = `
importers:
  .:
    dependencies:
      stripe:
        specifier: 21.0.1
        version: 21.0.1
`;
    expect(parsePnpmLockfileVersion(raw, "stripe")).toBe("21.0.1");
  });
});
