import type { CodingModel, MigrationContext } from "@/lib/models/types";
import type { GeneratedPatch } from "@/lib/domain";

function bumpPackageVersion(
  packageJson: string,
  packageName: string,
  toVersion: string,
): string {
  const parsed = JSON.parse(packageJson) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  if (parsed.dependencies?.[packageName]) {
    parsed.dependencies[packageName] = toVersion;
  }
  if (parsed.devDependencies?.[packageName]) {
    parsed.devDependencies[packageName] = toVersion;
  }
  return `${JSON.stringify(parsed, null, 2)}\n`;
}

function applyStripe21To22(content: string): string {
  let next = content.replace(/\n\s*typescript:\s*true,?/g, "");
  next = next.replace(
    /apiVersion:\s*['"][^'"]+['"]/g,
    'apiVersion: "2025-03-31.basil"',
  );
  next = next.replace(/([,{]\s*)source\s*:/g, "$1payment_method:");
  next = next.replace(/([,{]\s*)source(\s*[,}])/g, "$1payment_method$2");
  return next;
}

export class RuleBasedCodingModel implements CodingModel {
  async generatePatch(context: MigrationContext): Promise<GeneratedPatch> {
    const files: GeneratedPatch["files"] = [];
    const bumped = bumpPackageVersion(
      context.packageJson,
      context.packageName,
      context.toVersion,
    );
    if (bumped !== context.packageJson) {
      files.push({ path: "package.json", action: "update", content: bumped });
    }

    const changeId = context.change?.id;
    for (const file of context.files) {
      let next = file.content;
      if (changeId === "stripe-21.0.1-22.0.1" || context.provider.id === "stripe") {
        next = applyStripe21To22(file.content);
      }
      if (next !== file.content) {
        files.push({ path: file.path, action: "update", content: next });
      }
    }

    return {
      files,
      notes:
        context.change?.migrationInstructions ??
        `Upgrade ${context.packageName} from ${context.fromVersion} to ${context.toVersion}.`,
    };
  }
}
