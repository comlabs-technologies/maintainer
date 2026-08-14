import { describe, expect, it } from "vitest";
import { sanitizeLogOutput, isSafeGithubName } from "@/lib/utils/sanitize";
import { AuthError } from "@/lib/auth/errors";

describe("log sanitization", () => {
  it("redacts tokens and keys", () => {
    const output = sanitizeLogOutput(
      "Authorization: Bearer ghp_abcdefghijklmnopqrstuvwxyz123456 token=sk-test-abcdefghijk",
    );
    expect(output).not.toContain("ghp_");
    expect(output).toContain("[redacted]");
  });

  it("validates github names", () => {
    expect(isSafeGithubName("comlabs")).toBe(true);
    expect(isSafeGithubName("main-site")).toBe(true);
    expect(isSafeGithubName("evil;rm -rf")).toBe(false);
  });
});

describe("access control helpers", () => {
  it("exposes typed auth errors", () => {
    const error = new AuthError("forbidden", "Repository not found");
    expect(error.code).toBe("forbidden");
  });
});
