import "server-only";

import { isDevFixturesEnabled, isGithubAppConfigured } from "@/lib/env";
import { FixtureGitHubPort } from "@/lib/github/fixture-port";
import { OctokitGitHubPort } from "@/lib/github/octokit-port";
import type { GitHubPort } from "@/lib/github/port";

export function getGitHubPort(): GitHubPort {
  if (isGithubAppConfigured()) return new OctokitGitHubPort();
  if (isDevFixturesEnabled()) return new FixtureGitHubPort();
  throw new Error("github_not_connected");
}

export function githubConnectionState(): "configured" | "fixtures" | "missing" {
  if (isGithubAppConfigured()) return "configured";
  if (isDevFixturesEnabled()) return "fixtures";
  return "missing";
}
