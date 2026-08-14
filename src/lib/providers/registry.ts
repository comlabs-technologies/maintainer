import type { ProviderDefinition } from "@/lib/domain";

export const STRIPE_PROVIDER: ProviderDefinition = {
  id: "stripe",
  displayName: "Stripe",
  packages: ["stripe"],
};

export const OPENAI_PROVIDER: ProviderDefinition = {
  id: "openai",
  displayName: "OpenAI",
  packages: ["openai"],
};

export const ANTHROPIC_PROVIDER: ProviderDefinition = {
  id: "anthropic",
  displayName: "Anthropic",
  packages: ["@anthropic-ai/sdk"],
};

export const PROVIDERS: ProviderDefinition[] = [
  STRIPE_PROVIDER,
  OPENAI_PROVIDER,
  ANTHROPIC_PROVIDER,
];

export function getProvider(id: string): ProviderDefinition | undefined {
  return PROVIDERS.find((provider) => provider.id === id);
}

export function findProviderByPackage(
  packageName: string,
): ProviderDefinition | undefined {
  return PROVIDERS.find((provider) => provider.packages.includes(packageName));
}

export function providerPackageSet(): Set<string> {
  return new Set(PROVIDERS.flatMap((provider) => provider.packages));
}
