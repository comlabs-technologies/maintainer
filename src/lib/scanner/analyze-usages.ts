import { Project, SyntaxKind, type SourceFile } from "ts-morph";
import type { CodeUsage, ProviderDefinition } from "@/lib/domain";

export type SourceFileInput = {
  path: string;
  content: string;
};

const SKIP_PATH = /(^|\/)(node_modules|\.next|dist|build|coverage)(\/|$)/;

export function isAnalyzablePath(path: string): boolean {
  if (SKIP_PATH.test(path)) return false;
  return /\.(ts|tsx)$/.test(path) && !/\.d\.ts$/.test(path);
}

function snippetAround(source: string, line: number, radius = 2): string {
  const lines = source.split("\n");
  const start = Math.max(0, line - 1 - radius);
  const end = Math.min(lines.length, line + radius);
  return lines.slice(start, end).join("\n");
}

function normalizePath(filePath: string): string {
  return filePath.replace(/^\//, "");
}

function fileImportsProvider(
  sourceFile: SourceFile,
  packageNames: Set<string>,
  seen: Set<string>,
): boolean {
  const key = sourceFile.getFilePath();
  if (seen.has(key)) return false;
  seen.add(key);
  for (const importDecl of sourceFile.getImportDeclarations()) {
    const specifier = importDecl.getModuleSpecifierValue();
    if (packageNames.has(specifier)) return true;
    const resolved = importDecl.getModuleSpecifierSourceFile();
    if (resolved && fileImportsProvider(resolved, packageNames, seen)) return true;
  }
  return false;
}

function providerBindings(
  sourceFile: SourceFile,
  packageNames: Set<string>,
): Set<string> {
  const names = new Set<string>();
  for (const importDecl of sourceFile.getImportDeclarations()) {
    const specifier = importDecl.getModuleSpecifierValue();
    const resolved = importDecl.getModuleSpecifierSourceFile();
    const fromProvider =
      packageNames.has(specifier) ||
      (resolved
        ? fileImportsProvider(resolved, packageNames, new Set())
        : false);
    if (!fromProvider) continue;
    const defaultImport = importDecl.getDefaultImport();
    if (defaultImport) names.add(defaultImport.getText());
    const namespaceImport = importDecl.getNamespaceImport();
    if (namespaceImport) names.add(namespaceImport.getText());
    for (const named of importDecl.getNamedImports()) {
      names.add(named.getAliasNode()?.getText() ?? named.getName());
    }
  }
  return names;
}

export function analyzeProviderUsages(
  files: SourceFileInput[],
  provider: ProviderDefinition,
): CodeUsage[] {
  const project = new Project({
    useInMemoryFileSystem: true,
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      allowJs: false,
      target: 99,
      module: 99,
      jsx: 4,
      strict: false,
      skipLibCheck: true,
    },
  });

  const packageNames = new Set(provider.packages);
  const usages: CodeUsage[] = [];

  for (const file of files) {
    if (!isAnalyzablePath(file.path)) continue;
    project.createSourceFile(file.path, file.content, { overwrite: true });
  }

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = normalizePath(sourceFile.getFilePath());
    const importedNames = providerBindings(sourceFile, packageNames);
    if (importedNames.size === 0) continue;

    sourceFile.forEachDescendant((node) => {
      if (node.getKind() !== SyntaxKind.Identifier) return;
      const name = node.getText();
      if (!importedNames.has(name)) return;
      if (node.getFirstAncestorByKind(SyntaxKind.ImportDeclaration)) return;

      const parent = node.getParent();
      let symbol = name;
      if (parent?.getKind() === SyntaxKind.PropertyAccessExpression) {
        symbol = parent.getText();
      }

      const startLine = node.getStartLineNumber();
      const endLine = node.getEndLineNumber();
      usages.push({
        filePath,
        symbol,
        startLine,
        endLine,
        snippet: snippetAround(sourceFile.getFullText(), startLine),
      });
    });
  }

  return usages;
}

export function summarizeUsages(usages: CodeUsage[]): {
  usageCount: number;
  fileCount: number;
  files: Array<{ filePath: string; usageCount: number; snippets: CodeUsage[] }>;
} {
  const grouped = new Map<string, CodeUsage[]>();
  for (const usage of usages) {
    const list = grouped.get(usage.filePath) ?? [];
    list.push(usage);
    grouped.set(usage.filePath, list);
  }
  const files = [...grouped.entries()].map(([filePath, snippets]) => ({
    filePath,
    usageCount: snippets.length,
    snippets,
  }));
  files.sort((a, b) => a.filePath.localeCompare(b.filePath));
  return {
    usageCount: usages.length,
    fileCount: files.length,
    files,
  };
}
