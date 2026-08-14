import YAML from "yaml";

export function parseNpmLockfileVersion(
  raw: string,
  packageName: string,
): string | null {
  const parsed = JSON.parse(raw) as {
    dependencies?: Record<string, { version?: string }>;
    packages?: Record<string, { version?: string }>;
  };
  const nodeModulesKey = `node_modules/${packageName}`;
  const fromPackages = parsed.packages?.[nodeModulesKey]?.version;
  if (fromPackages) return fromPackages;
  const fromDeps = parsed.dependencies?.[packageName]?.version;
  return fromDeps ?? null;
}

export function parsePnpmLockfileVersion(
  raw: string,
  packageName: string,
): string | null {
  const doc = YAML.parse(raw) as {
    importers?: Record<
      string,
      {
        dependencies?: Record<string, { version?: string; specifier?: string }>;
        devDependencies?: Record<string, { version?: string; specifier?: string }>;
      }
    >;
    packages?: Record<string, { version?: string } | string>;
  };

  const root = doc.importers?.["."];
  const fromImporter =
    root?.dependencies?.[packageName]?.version ??
    root?.devDependencies?.[packageName]?.version;
  if (fromImporter) {
    return fromImporter.split("(")[0] ?? fromImporter;
  }

  if (doc.packages) {
    for (const [key, value] of Object.entries(doc.packages)) {
      if (key === packageName || key.startsWith(`${packageName}@`)) {
        if (typeof value === "object" && value?.version) return value.version;
        const at = key.lastIndexOf("@");
        if (at > 0) return key.slice(at + 1);
      }
    }
  }
  return null;
}
