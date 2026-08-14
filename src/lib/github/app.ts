import "server-only";

import { App } from "octokit";
import { getEnv, githubPrivateKey, isGithubAppConfigured } from "@/lib/env";

let app: App | null = null;

export function getGithubApp(): App {
  if (app) return app;
  if (!isGithubAppConfigured()) {
    throw new Error("GitHub App is not configured");
  }
  const env = getEnv();
  app = new App({
    appId: env.GITHUB_APP_ID!,
    privateKey: githubPrivateKey()!,
    webhooks: env.GITHUB_WEBHOOK_SECRET
      ? { secret: env.GITHUB_WEBHOOK_SECRET }
      : undefined,
  });
  return app;
}

export function githubAppInstallUrl(): string {
  const slug = getEnv().GITHUB_APP_SLUG;
  if (!slug) {
    return "https://github.com/apps";
  }
  return `https://github.com/apps/${slug}/installations/new`;
}
