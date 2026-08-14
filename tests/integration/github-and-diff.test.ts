import { describe, expect, it } from "vitest";
import { verifyGithubSignature } from "@/lib/github/webhooks";
import { createHmac } from "node:crypto";
import { fileFromUnifiedDiff } from "@/lib/migrations/diff";
import { createTwoFilesPatch } from "diff";

describe("github webhook signatures", () => {
  it("accepts valid hmac signatures and rejects invalid ones", () => {
    const payload = '{"ok":true}';
    const secret = "webhook-secret";
    const signature = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
    expect(verifyGithubSignature(payload, signature, secret)).toBe(true);
    expect(verifyGithubSignature(payload, "sha256=deadbeef", secret)).toBe(false);
    expect(verifyGithubSignature(payload, null, secret)).toBe(false);
  });
});

describe("diff reconstruction", () => {
  it("rebuilds the new file from a unified diff", () => {
    const patch = createTwoFilesPatch(
      "src/lib/stripe.ts",
      "src/lib/stripe.ts",
      "const a = 1\n",
      "const a = 2\n",
    );
    expect(fileFromUnifiedDiff(patch)).toContain("const a = 2");
  });
});
