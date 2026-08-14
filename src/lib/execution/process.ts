import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile, readFile, mkdir, cp, access } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createTwoFilesPatch } from "diff";
import type { ExecutionResult, MigrationExecutor, MigrationJobSpec } from "@/lib/execution/types";
import type { CheckName, JobStep, VerificationCheckResult } from "@/lib/domain";
import { sanitizeLogOutput } from "@/lib/utils/sanitize";
import { detectScripts } from "@/lib/verification/results";
import { workspaceRoot } from "@/lib/env";

function run(
  command: string,
  args: string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv; timeoutMs: number },
): Promise<{ code: number; stdout: string; stderr: string; durationMs: number }> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("executor_timeout"));
    }, options.timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        code: code ?? 1,
        stdout,
        stderr,
        durationMs: Date.now() - started,
      });
    });
  });
}

function countDiff(patch: string): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const line of patch.split("\n")) {
    if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("@@") || line.startsWith("Index")) {
      continue;
    }
    if (line.startsWith("+")) additions += 1;
    if (line.startsWith("-")) deletions += 1;
  }
  return { additions, deletions };
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

export class IsolatedProcessExecutor implements MigrationExecutor {
  async execute(job: MigrationJobSpec): Promise<ExecutionResult> {
    const events: ExecutionResult["events"] = [];
    const logs: string[] = [];
    const root = workspaceRoot();
    await mkdir(root, { recursive: true });
    const workspace = await mkdtemp(path.join(root, `${job.jobId}-`));
    const push = (step: JobStep, status: string, message: string) => {
      events.push({ step, status, message });
    };

    const env = {
      PATH: process.env.PATH,
      HOME: os.homedir(),
      NODE_ENV: "test",
      npm_config_audit: "false",
      npm_config_fund: "false",
      CI: "true",
    } as NodeJS.ProcessEnv;

    try {
      push("preparing", "running", "Preparing migration");
      if (job.localSourcePath) {
        await cp(job.localSourcePath, workspace, {
          recursive: true,
          filter: (source) => !source.includes("node_modules"),
        });
      } else {
        const token = job.installationToken;
        if (!token) throw new Error("Missing installation token");
        const cloneUrl = job.cloneUrl.replace(
          "https://github.com/",
          `https://x-access-token:${token}@github.com/`,
        );
        const clone = await run("git", ["clone", "--depth", "1", cloneUrl, workspace], {
          cwd: os.tmpdir(),
          env,
          timeoutMs: Math.min(job.timeoutMs, 120_000),
        });
        logs.push(clone.stdout, clone.stderr);
        if (clone.code !== 0) {
          throw new Error("Failed to clone repository");
        }
        if (job.commitSha) {
          await run("git", ["checkout", job.commitSha], {
            cwd: workspace,
            env,
            timeoutMs: 30_000,
          });
        }
      }
      push("prepared", "completed", "Repository prepared");

      const packageJsonRaw = await readFile(path.join(workspace, "package.json"), "utf8");
      const packageJson = JSON.parse(packageJsonRaw) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        scripts?: Record<string, string>;
      };
      const originals = new Map<string, string>();
      originals.set("package.json", packageJsonRaw);

      const installArgs =
        job.packageManager === "pnpm"
          ? ["pnpm", ["install", "--frozen-lockfile=false"]]
          : ["npm", ["install", "--ignore-scripts"]];
      const install = await run(installArgs[0] as string, installArgs[1] as string[], {
        cwd: workspace,
        env,
        timeoutMs: Math.min(job.timeoutMs, 180_000),
      });
      logs.push(install.stdout, install.stderr);
      if (install.code !== 0) {
        return {
          ok: false,
          errorCode: "install_failed",
          errorMessage: "Dependency install failed",
          logs: sanitizeLogOutput(logs.join("\n")),
          diffs: [],
          checks: [],
          events,
        };
      }

      const upgradeArgs =
        job.packageManager === "pnpm"
          ? ["pnpm", ["add", `${job.packageName}@${job.toVersion}`]]
          : ["npm", ["install", `${job.packageName}@${job.toVersion}`, "--save"]];
      const upgrade = await run(upgradeArgs[0] as string, upgradeArgs[1] as string[], {
        cwd: workspace,
        env,
        timeoutMs: Math.min(job.timeoutMs, 120_000),
      });
      logs.push(upgrade.stdout, upgrade.stderr);
      push("upgraded", "completed", "Dependency upgraded");

      push("analyzed", "completed", `${job.patch.files.length} files prepared for migration`);
      push("applying", "running", "Applying migration");
      for (const file of job.patch.files) {
        const target = path.join(workspace, file.path);
        if (file.action === "delete") {
          await rm(target, { force: true });
          continue;
        }
        if (file.content == null) continue;
        await mkdir(path.dirname(target), { recursive: true });
        if (await pathExists(target) && !originals.has(file.path)) {
          originals.set(file.path, await readFile(target, "utf8"));
        } else if (!originals.has(file.path)) {
          originals.set(file.path, "");
        }
        await writeFile(target, file.content, "utf8");
      }
      push("applying", "completed", "Applying migration");

      const scripts = detectScripts(packageJson.scripts ?? {});
      const checks: VerificationCheckResult[] = [];
      const runCheck = async (name: CheckName, enabled: boolean) => {
        const command = scripts[name];
        if (!enabled) {
          checks.push({
            name,
            command,
            exitCode: null,
            durationMs: 0,
            status: "skipped",
            output: "Skipped by migration preferences",
          });
          push(name, "skipped", `${labelFor(name)} skipped`);
          return;
        }
        if (!command) {
          checks.push({
            name,
            command: null,
            exitCode: null,
            durationMs: 0,
            status: "not_configured",
            output: "No script configured in package.json",
          });
          push(name, "skipped", `${labelFor(name)} not configured`);
          return;
        }
        push(name, "running", `${labelFor(name)}`);
        const npmArgs =
          job.packageManager === "pnpm"
            ? ["pnpm", ["run", name === "test" ? "test" : name]]
            : ["npm", ["run", scriptName(name, packageJson.scripts ?? {})]];
        const result = await run(npmArgs[0] as string, npmArgs[1] as string[], {
          cwd: workspace,
          env,
          timeoutMs: Math.min(job.timeoutMs, 180_000),
        });
        const output = sanitizeLogOutput(`${result.stdout}\n${result.stderr}`);
        logs.push(output);
        checks.push({
          name,
          command: `npm run ${scriptName(name, packageJson.scripts ?? {})}`,
          exitCode: result.code,
          durationMs: result.durationMs,
          status: result.code === 0 ? "passed" : "failed",
          output,
        });
        push(
          name,
          result.code === 0 ? "completed" : "failed",
          `${labelFor(name)} ${result.code === 0 ? "passed" : "failed"}`,
        );
      };

      await runCheck("typecheck", job.checks.typecheck);
      await runCheck("test", job.checks.test);
      await runCheck("lint", job.checks.lint);
      await runCheck("build", job.checks.build);

      push("collecting_diff", "running", "Collecting diff");
      const diffs: ExecutionResult["diffs"] = [];
      for (const file of job.patch.files) {
        const target = path.join(workspace, file.path);
        const after = file.action === "delete" ? "" : await readFile(target, "utf8").catch(() => "");
        const before = originals.get(file.path) ?? "";
        if (before === after) continue;
        const patch = createTwoFilesPatch(file.path, file.path, before, after, "", "");
        const counts = countDiff(patch);
        diffs.push({
          filePath: file.path,
          additions: counts.additions,
          deletions: counts.deletions,
          patch,
        });
      }
      push("completed", "completed", "Migration ready");

      const failed = checks.some((check) => check.status === "failed");
      return {
        ok: !failed,
        errorCode: failed ? failedCheckCode(checks) : undefined,
        errorMessage: failed ? "Verification failed" : undefined,
        logs: sanitizeLogOutput(logs.join("\n")),
        diffs,
        checks,
        events,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown executor error";
      const timeout = message === "executor_timeout";
      push("failed", "failed", timeout ? "Executor timed out" : message);
      return {
        ok: false,
        errorCode: timeout ? "executor_timeout" : "generation_failed",
        errorMessage: timeout ? "Migration executor timed out" : message,
        logs: sanitizeLogOutput(logs.join("\n")),
        diffs: [],
        checks: [],
        events,
      };
    } finally {
      await rm(workspace, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

function labelFor(name: CheckName): string {
  switch (name) {
    case "typecheck":
      return "Type checking";
    case "test":
      return "Running tests";
    case "lint":
      return "Lint";
    case "build":
      return "Building repository";
  }
}

function scriptName(name: CheckName, scripts: Record<string, string>): string {
  if (name === "typecheck") {
    if (scripts.typecheck) return "typecheck";
    if (scripts["type-check"]) return "type-check";
    if (scripts.tsc) return "tsc";
  }
  return name;
}

function failedCheckCode(checks: VerificationCheckResult[]): string {
  const failed = checks.find((check) => check.status === "failed");
  if (!failed) return "generation_failed";
  if (failed.name === "test") return "tests_failed";
  return `${failed.name}_failed`;
}
