# Maintainer

APIs change. Your codebase shouldn't break.

Maintainer connects to GitHub repositories, detects supported TypeScript SDK dependencies (Stripe, OpenAI, Anthropic), analyzes impacted code, generates a migration, verifies it in an isolated executor, and opens a GitHub pull request.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS
- Clerk authentication
- PostgreSQL + Drizzle ORM
- GitHub App via Octokit
- ts-morph for usage analysis
- Docker (or isolated process) migration executor

## Local development

### 1. Services

```bash
docker compose up -d postgres
cp .env.example .env.local
```

Fill Clerk and GitHub App values in `.env.local`. Then:

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 2. Clerk

Create an application at [dashboard.clerk.com](https://dashboard.clerk.com).

Required:

- GitHub as the SSO / social connection (enable for sign-up and sign-in)
- Paths:
  - `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
  - `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-in`
  - Sign-in fallback: `/app/repositories`

Copy `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`.

### 3. GitHub App

Create a GitHub App ([docs](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps)):

**Permissions (least privilege):**

- Repository contents: Read & write
- Pull requests: Read & write
- Metadata: Read-only

**Subscribe to events:**

- Installation
- Installation repositories

**Callback / setup URL:**

- Setup URL: `http://localhost:3000/api/github/setup`
- Webhook URL: `http://localhost:3000/api/webhooks/github`
- Webhook secret: set `GITHUB_WEBHOOK_SECRET` to the same value

After install, GitHub redirects to `/api/github/setup?installation_id=…`, which stores the installation and sends the user to repository selection.

### 4. Coding model (optional)

If `LLM_API_KEY` is unset, Maintainer uses deterministic rule-based transforms (including the Stripe 21 → 22 fixture). The model only produces a **candidate patch**. Verification is the source of truth.

### 5. Executor

`MAINTAINER_EXECUTOR=docker` is the local/dev default. Isolation:

- Control plane (Next.js) never runs customer `test` / `build` / `lint` in-process.
- `DockerMigrationExecutor` is the intended execution plane.
- If Docker is unavailable, it falls back to `IsolatedProcessExecutor` (child process + ephemeral workspace). Set `MAINTAINER_EXECUTOR=isolated-process` to force that path.

A future `FargateMigrationExecutor` can implement the same `MigrationExecutor` interface (SQS → ECS Fargate → S3 artifacts) without changing product/business logic.

### Development fixtures

Set `MAINTAINER_DEV_FIXTURES=true` to exercise the full product journey without a GitHub App. The fixture repository is labeled in the UI and is never treated as production GitHub data.

## Scripts

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm run db:migrate
npm run worker -- <jobId>
```

## Architecture

```
Control plane                          Execution plane
Next.js · Postgres · Clerk             clone · install · patch
GitHub App · job state · UI            typecheck · test · build
                                       diff · destroy workspace
```

Primary routes:

- `/app/repositories`
- `/app/repositories/[repositoryId]`
- `/app/migrations/[migrationId]`
- `/app/activity`
- `/app/settings`

## Deployment

Vercel needs at least:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
DATABASE_URL
```

Without those, the site still loads. `/` shows the product landing page. `/sign-in` and `/app` show which variables are missing instead of a 500.

`DATABASE_URL` must be a hosted Postgres URL (Neon, Vercel Postgres, or similar). `localhost` will not work on Vercel. After setting variables, redeploy.
