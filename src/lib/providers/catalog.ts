import type { ApiChange } from "@/lib/domain";

export const STRIPE_21_TO_22: ApiChange = {
  id: "stripe-21.0.1-22.0.1",
  providerId: "stripe",
  fromVersion: "21.0.0",
  toVersion: "22.0.1",
  severity: "breaking",
  affectedSymbols: ["Stripe", "typescript", "apiVersion", "customers.create"],
  description:
    "Stripe Node SDK 22 removes the constructor `typescript` flag, updates the required `apiVersion`, and replaces the legacy `source` customer field with `payment_method`.",
  migrationInstructions: [
    "Upgrade the `stripe` package to 22.0.1.",
    "Remove `typescript: true` from the Stripe constructor options.",
    "Update `apiVersion` to `2025-03-31.basil`.",
    "Replace `customers.create({ source })` with `customers.create({ payment_method })`.",
  ].join(" "),
};

export const CATALOGUED_API_CHANGES: ApiChange[] = [STRIPE_21_TO_22];

export const FIXTURE_LATEST_VERSIONS: Record<string, string> = {
  stripe: "22.0.1",
  openai: "4.104.0",
  "@anthropic-ai/sdk": "0.39.0",
};
