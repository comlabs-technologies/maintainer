import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type {
  CreatedPullRequest,
  GitHubPort,
  GitHubRepoSummary,
  GitHubTreeItem,
} from "@/lib/github/port";

const FIXTURE_INSTALLATION_ID = "fixture-installation";

export const FIXTURE_REPO: GitHubRepoSummary = {
  id: "fixture-sample-repo",
  name: "sample-repo",
  owner: "maintainer-fixtures",
  fullName: "maintainer-fixtures/sample-repo",
  defaultBranch: "main",
  htmlUrl: "https://github.com/maintainer-fixtures/sample-repo",
  language: "TypeScript",
  private: false,
};

async function walk(dir: string, prefix = ""): Promise<Array<{ path: string; content: string }>> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: Array<{ path: string; content: string }> = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full, relative)));
    } else {
      files.push({ path: relative, content: await readFile(full, "utf8") });
    }
  }
  return files;
}

export function fixtureRoot(): string {
  return path.join(process.cwd(), "fixtures/sample-repo");
}

export class FixtureGitHubPort implements GitHubPort {
  private files = new Map<string, string>();
  private pullRequests: CreatedPullRequest[] = [];
  private loaded = false;

  private async ensureLoaded() {
    if (this.loaded) return;
    const files = await walk(fixtureRoot());
    for (const file of files) this.files.set(file.path, file.content);
    this.loaded = true;
  }

  async listInstallationRepos(): Promise<GitHubRepoSummary[]> {
    return [FIXTURE_REPO];
  }

  async getFileContent(
    _installationId: string,
    _owner: string,
    _repo: string,
    filePath: string,
  ): Promise<string | null> {
    await this.ensureLoaded();
    return this.files.get(filePath) ?? null;
  }

  async getTree(): Promise<GitHubTreeItem[]> {
    await this.ensureLoaded();
    return [...this.files.keys()].map((filePath) => ({
      path: filePath,
      sha: filePath,
      type: "blob" as const,
    }));
  }

  async getBlob(
    _installationId: string,
    _owner: string,
    _repo: string,
    sha: string,
  ): Promise<string> {
    await this.ensureLoaded();
    return this.files.get(sha) ?? "";
  }

  async getLatestCommitSha(): Promise<string | null> {
    return "fixture-sha";
  }

  async createBranch(): Promise<void> {
    return;
  }

  async commitFiles(
    _installationId: string,
    _owner: string,
    _repo: string,
    _branch: string,
    _message: string,
    files: Array<{ path: string; content: string }>,
  ): Promise<string | null> {
    await this.ensureLoaded();
    for (const file of files) {
      this.files.set(file.path, file.content);
    }
    return "fixture-commit";
  }

  async createPullRequest(
    _installationId: string,
    _owner: string,
    _repo: string,
    input: { title: string; head: string },
  ): Promise<CreatedPullRequest> {
    const pr: CreatedPullRequest = {
      number: this.pullRequests.length + 1,
      url: `https://github.com/${FIXTURE_REPO.fullName}/pull/${this.pullRequests.length + 1}`,
      branchName: input.head,
      commitSha: "fixture-commit",
    };
    this.pullRequests.push(pr);
    return pr;
  }
}

export { FIXTURE_INSTALLATION_ID };

export async function fixtureSourceExists(): Promise<boolean> {
  try {
    await stat(fixtureRoot());
    return true;
  } catch {
    return false;
  }
}
