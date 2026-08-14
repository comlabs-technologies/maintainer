import type { ApiChange, CodeUsage, GeneratedPatch, ProviderDefinition } from "@/lib/domain";

export type MigrationContext = {
  provider: ProviderDefinition;
  change: ApiChange | null;
  fromVersion: string;
  toVersion: string;
  packageName: string;
  usages: CodeUsage[];
  files: Array<{ path: string; content: string }>;
  packageJson: string;
  relatedTests: Array<{ path: string; content: string }>;
};

export interface CodingModel {
  generatePatch(context: MigrationContext): Promise<GeneratedPatch>;
}
