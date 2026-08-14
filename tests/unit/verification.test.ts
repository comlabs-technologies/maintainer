import { describe, expect, it } from "vitest";
import { deriveConfidence, detectScripts, parseTestSummary } from "@/lib/verification/results";

describe("verification parsing", () => {
  it("detects scripts from package.json", () => {
    const scripts = detectScripts({
      typecheck: "tsc --noEmit",
      test: "vitest run",
      build: "next build",
    });
    expect(scripts.typecheck).toBe("tsc --noEmit");
    expect(scripts.lint).toBeNull();
  });

  it("parses test summaries", () => {
    expect(parseTestSummary("Tests  218 passed (218)")).toBe("218 passed");
    expect(parseTestSummary("# tests 4\n# pass 4")).toBe("4 passed");
  });

  it("derives confidence from deterministic signals", () => {
    expect(
      deriveConfidence({
        checks: [
          { name: "typecheck", status: "passed" },
          { name: "test", status: "passed" },
          { name: "build", status: "passed" },
        ],
        unresolvedUsages: 0,
        filesChanged: 3,
      }),
    ).toBe("high");
    expect(
      deriveConfidence({
        checks: [{ name: "typecheck", status: "failed" }],
        unresolvedUsages: 0,
        filesChanged: 1,
      }),
    ).toBe("needs_review");
    expect(
      deriveConfidence({
        checks: [{ name: "typecheck", status: "not_configured" }],
        unresolvedUsages: 0,
        filesChanged: 1,
      }),
    ).toBe("medium");
  });
});
