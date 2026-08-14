import "server-only";

import { getGithubApp } from "@/lib/github/app";
import type {
  CreatedPullRequest,
  GitHubPort,
  GitHubRepoSummary,
  GitHubTreeItem,
} from "@/lib/github/port";
import { isSafeGithubName } from "@/lib/utils/sanitize";

async function installationClient(installationId: string) {
  const app = getGithubApp();
  return app.getInstallationOctokit(Number(installationId));
}

export class OctokitGitHubPort implements GitHubPort {
  async listInstallationRepos(installationId: string): Promise<GitHubRepoSummary[]> {
    const octokit = await installationClient(installationId);
    const repos: GitHubRepoSummary[] = [];
    let page = 1;
    for (;;) {
      const { data } = await octokit.rest.apps.listReposAccessibleToInstallation({
        per_page: 100,
        page,
      });
      for (const repo of data.repositories) {
        repos.push({
          id: String(repo.id),
          name: repo.name,
          owner: repo.owner.login,
          fullName: repo.full_name,
          defaultBranch: repo.default_branch,
          htmlUrl: repo.html_url,
          language: repo.language,
          private: repo.private,
        });
      }
      if (data.repositories.length < 100) break;
      page += 1;
    }
    return repos.sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  async getFileContent(
    installationId: string,
    owner: string,
    repo: string,
    path: string,
    ref?: string,
  ): Promise<string | null> {
    if (!isSafeGithubName(owner) || !isSafeGithubName(repo)) return null;
    const octokit = await installationClient(installationId);
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref,
      });
      if (Array.isArray(data) || data.type !== "file" || !("content" in data)) {
        return null;
      }
      return Buffer.from(data.content, "base64").toString("utf8");
    } catch {
      return null;
    }
  }

  async getTree(
    installationId: string,
    owner: string,
    repo: string,
    ref: string,
  ): Promise<GitHubTreeItem[]> {
    const octokit = await installationClient(installationId);
    const { data } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: ref,
      recursive: "true",
    });
    return data.tree
      .filter((item) => item.path && item.sha && item.type)
      .map((item) => ({
        path: item.path!,
        sha: item.sha!,
        type: item.type === "tree" ? "tree" : "blob",
      }));
  }

  async getBlob(
    installationId: string,
    owner: string,
    repo: string,
    sha: string,
  ): Promise<string> {
    const octokit = await installationClient(installationId);
    const { data } = await octokit.rest.git.getBlob({ owner, repo, file_sha: sha });
    return Buffer.from(data.content, "base64").toString("utf8");
  }

  async getLatestCommitSha(
    installationId: string,
    owner: string,
    repo: string,
    branch: string,
  ): Promise<string | null> {
    const octokit = await installationClient(installationId);
    const { data } = await octokit.rest.repos.getBranch({ owner, repo, branch });
    return data.commit.sha;
  }

  async createBranch(
    installationId: string,
    owner: string,
    repo: string,
    branch: string,
    fromSha: string,
  ): Promise<void> {
    const octokit = await installationClient(installationId);
    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branch}`,
      sha: fromSha,
    });
  }

  async commitFiles(
    installationId: string,
    owner: string,
    repo: string,
    branch: string,
    message: string,
    files: Array<{ path: string; content: string; action?: "update" | "create" | "delete" }>,
  ): Promise<string | null> {
    const octokit = await installationClient(installationId);
    let sha: string | null = null;
    for (const file of files) {
      if (file.action === "delete") {
        try {
          const existing = await octokit.rest.repos.getContent({
            owner,
            repo,
            path: file.path,
            ref: branch,
          });
          if (!Array.isArray(existing.data) && "sha" in existing.data) {
            const result = await octokit.rest.repos.deleteFile({
              owner,
              repo,
              path: file.path,
              message,
              sha: existing.data.sha,
              branch,
            });
            sha = result.data.commit.sha ?? sha;
          }
        } catch {
          continue;
        }
        continue;
      }
      let existingSha: string | undefined;
      try {
        const existing = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: file.path,
          ref: branch,
        });
        if (!Array.isArray(existing.data) && "sha" in existing.data) {
          existingSha = existing.data.sha;
        }
      } catch {
        existingSha = undefined;
      }
      const result = await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: file.path,
        message,
        content: Buffer.from(file.content, "utf8").toString("base64"),
        branch,
        sha: existingSha,
      });
      sha = result.data.commit.sha ?? sha;
    }
    return sha;
  }

  async createPullRequest(
    installationId: string,
    owner: string,
    repo: string,
    input: { title: string; body: string; head: string; base: string },
  ): Promise<CreatedPullRequest> {
    const octokit = await installationClient(installationId);
    const { data } = await octokit.rest.pulls.create({
      owner,
      repo,
      title: input.title,
      body: input.body,
      head: input.head,
      base: input.base,
    });
    return {
      number: data.number,
      url: data.html_url,
      branchName: input.head,
      commitSha: data.head.sha,
    };
  }
}
