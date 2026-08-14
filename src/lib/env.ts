import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  DATABASE_URL: z.string().optional(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),
  GITHUB_APP_ID: z.string().optional(),
  GITHUB_APP_SLUG: z.string().optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().optional(),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  APP_BASE_URL: z.string().optional(),
  LLM_PROVIDER: z.string().optional(),
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().optional(),
  MAINTAINER_EXECUTOR: z.enum(["docker", "isolated-process"]).optional(),
  MAINTAINER_EXECUTOR_TIMEOUT_MS: z.string().optional(),
  MAINTAINER_WORKSPACE_ROOT: z.string().optional(),
  MAINTAINER_DEV_FIXTURES: z.string().optional(),
  LOG_LEVEL: z.string().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cached) return cached;
  cached = envSchema.parse(process.env);
  return cached;
}

export function isGithubAppConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.GITHUB_APP_ID && env.GITHUB_APP_PRIVATE_KEY);
}

export function isDevFixturesEnabled(): boolean {
  return getEnv().MAINTAINER_DEV_FIXTURES === "true";
}

export function githubPrivateKey(): string | null {
  const key = getEnv().GITHUB_APP_PRIVATE_KEY;
  if (!key) return null;
  return key.replace(/\\n/g, "\n");
}

export function appBaseUrl(): string {
  return getEnv().APP_BASE_URL ?? "http://localhost:3000";
}

export function executorTimeoutMs(): number {
  const raw = getEnv().MAINTAINER_EXECUTOR_TIMEOUT_MS;
  const parsed = raw ? Number.parseInt(raw, 10) : 600_000;
  return Number.isFinite(parsed) ? parsed : 600_000;
}

export function workspaceRoot(): string {
  return getEnv().MAINTAINER_WORKSPACE_ROOT ?? "/tmp/maintainer-workspaces";
}
