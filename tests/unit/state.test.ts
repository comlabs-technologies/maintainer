import { describe, expect, it } from "vitest";
import { assertTransition, canTransition, motifStates } from "@/lib/migrations/state";

describe("migration state transitions", () => {
  it("allows the happy path", () => {
    expect(canTransition("detected", "analyzing")).toBe(true);
    expect(canTransition("analyzing", "ready")).toBe(true);
    expect(canTransition("ready", "queued")).toBe(true);
    expect(canTransition("queued", "preparing")).toBe(true);
    expect(canTransition("preparing", "migrating")).toBe(true);
    expect(canTransition("migrating", "verifying")).toBe(true);
    expect(canTransition("verifying", "verified")).toBe(true);
    expect(canTransition("verified", "pr_created")).toBe(true);
  });

  it("rejects illegal jumps", () => {
    expect(canTransition("detected", "pr_created")).toBe(false);
    expect(() => assertTransition("ready", "verified")).toThrow(/Invalid migration transition/);
  });

  it("marks motif steps from status", () => {
    const ready = motifStates("ready");
    expect(ready.detected).toBe("complete");
    expect(ready.analyzed).toBe("complete");
    const verified = motifStates("verified");
    expect(verified.verified).toBe("complete");
  });
});
