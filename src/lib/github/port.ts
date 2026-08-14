export type GitHubRepoSummary = {
  id: string;
  name: string;
  owner: string;
  fullName: string;
  defaultBranch: string;
  htmlUrl: string;
  language: string | null;
  private: boolean;
};

export type GitHubTreeItem = {
  path: string;
  sha: string;
  type: "blob" | "tree";
};

export type CreatedPullRequest = {
  number: number;
  url: string;
  branchName: string;
  commitSha: string | null;
};

export interface GitHubPort {
  listInstallationRepos(installationId: string): Promise<GitHubRepoSummary[]>;
  getFileContent(
    installationId: string,
    owner: string,
    repo: string,
    path: string,
    ref?: string,
  ): Promise<string | null>;
  getTree(
    installationId: string,
    owner: string,
    repo: string,
    ref: string,
  ): Promise<GitHubTreeItem[]>;
  getBlob(
    installationId: string,
    owner: string,
    repo: string,
    sha: string,
  ): Promise<string>;
  getLatestCommitSha(
    installationId: string,
    owner: string,
    repo: string,
    branch: string,
  ): Promise<string | null>;
  createBranch(
    installationId: string,
    owner: string,
    repo: string,
    branch: string,
    fromSha: string,
  ): Promise<void>;
  commitFiles(
    installationId: string,
    owner: string,
    repo: string,
    branch: string,
    message: string,
    files: Array<{ path: string; content: string; action?: "update" | "create" | "delete" }>,
  ): Promise<string | null>;
  createPullRequest(
    installationId: string,
    owner: string,
    repo: string,
    input: { title: string; body: string; head: string; base: string },
  ): Promise<CreatedPullRequest>;
}
