import { afterEach, describe, expect, it } from "vitest";
import { isClerkConfigured, isDatabaseConfigured } from "@/lib/env";

const KEYS = [
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "DATABASE_URL",
] as const;

describe("environment readiness", () => {
  const original: Record<string, string | undefined> = {};

  for (const key of KEYS) {
    original[key] = process.env[key];
  }

  afterEach(() => {
    for (const key of KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  it("treats missing and placeholder clerk keys as unconfigured", () => {
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    delete process.env.CLERK_SECRET_KEY;
    expect(isClerkConfigured()).toBe(false);
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_replace_me";
    process.env.CLERK_SECRET_KEY = "sk_test_replace_me";
    expect(isClerkConfigured()).toBe(false);
  });

  it("accepts real clerk key prefixes", () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_liveishvalue";
    process.env.CLERK_SECRET_KEY = "sk_test_liveishvalue";
    expect(isClerkConfigured()).toBe(true);
  });

  it("requires a postgres url", () => {
    delete process.env.DATABASE_URL;
    expect(isDatabaseConfigured()).toBe(false);
    process.env.DATABASE_URL =
      "postgres://maintainer:maintainer@localhost:5432/maintainer";
    expect(isDatabaseConfigured()).toBe(true);
  });
});
