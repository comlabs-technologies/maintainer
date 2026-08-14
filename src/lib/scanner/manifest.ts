export type ManifestDependencies = {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  packageManagerField: string | null;
};

export function parsePackageJson(raw: string): ManifestDependencies {
  const parsed = JSON.parse(raw) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
    packageManager?: string;
  };
  return {
    dependencies: parsed.dependencies ?? {},
    devDependencies: parsed.devDependencies ?? {},
    scripts: parsed.scripts ?? {},
    packageManagerField: parsed.packageManager ?? null,
  };
}

export function detectPackageManager(input: {
  packageManagerField?: string | null;
  hasPackageLock: boolean;
  hasPnpmLock: boolean;
  hasYarnLock: boolean;
}): "npm" | "pnpm" | "unsupported" | "unknown" {
  const field = input.packageManagerField ?? "";
  if (field.startsWith("pnpm@") || input.hasPnpmLock) return "pnpm";
  if (field.startsWith("npm@") || input.hasPackageLock) return "npm";
  if (input.hasYarnLock && !input.hasPackageLock && !input.hasPnpmLock) {
    return "unsupported";
  }
  return "unknown";
}

export function collectDeclaredDependencies(
  manifest: ManifestDependencies,
): Record<string, string> {
  return { ...manifest.devDependencies, ...manifest.dependencies };
}
