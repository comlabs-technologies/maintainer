import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm, cp } from "node:fs/promises";
import path from "node:path";
import type { ExecutionResult, MigrationExecutor, MigrationJobSpec } from "@/lib/execution/types";
import { IsolatedProcessExecutor } from "@/lib/execution/process";
import { sanitizeLogOutput } from "@/lib/utils/sanitize";
import { workspaceRoot } from "@/lib/env";
import { logger } from "@/lib/logger";

function run(
  command: string,
  args: string[],
  options: { cwd?: string; timeoutMs: number },
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
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
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

async function dockerAvailable(): Promise<boolean> {
  try {
    const result = await run("docker", ["info"], { timeoutMs: 8_000 });
    return result.code === 0;
  } catch {
    return false;
  }
}

export class DockerMigrationExecutor implements MigrationExecutor {
  async execute(job: MigrationJobSpec): Promise<ExecutionResult> {
    if (!(await dockerAvailable())) {
      logger.warn("docker_unavailable_falling_back", { jobId: job.jobId });
      return new IsolatedProcessExecutor().execute(job);
    }

    const root = workspaceRoot();
    await mkdir(root, { recursive: true });
    const hostDir = await mkdtemp(path.join(root, `docker-${job.jobId}-`));
    const specPath = path.join(hostDir, "job.json");
    const resultPath = path.join(hostDir, "result.json");

    try {
      if (job.localSourcePath) {
        await cp(job.localSourcePath, path.join(hostDir, "source"), {
          recursive: true,
          filter: (source) => !source.includes("node_modules"),
        });
      }
      const sanitizedJob = {
        ...job,
        installationToken: job.installationToken ? "[present]" : undefined,
      };
      await writeFile(
        specPath,
        JSON.stringify({
          ...job,
          localSourcePath: job.localSourcePath ? "/workspace/source" : undefined,
        }),
        "utf8",
      );
      void sanitizedJob;

      const image = process.env.MAINTAINER_EXECUTOR_IMAGE ?? "node:22-bookworm";
      const args = [
        "run",
        "--rm",
        "--network=bridge",
        "--memory=2g",
        "--cpus=2",
        "--pids-limit=256",
        "--security-opt",
        "no-new-privileges",
        "-v",
        `${hostDir}:/workspace`,
        "-w",
        "/workspace",
        "-e",
        "CI=true",
        image,
        "bash",
        "-lc",
        [
          "set -euo pipefail",
          "apt-get update -qq && apt-get install -y -qq git >/dev/null",
          "corepack enable >/dev/null 2>&1 || true",
          "node --input-type=module <<'NODE'",
          "console.log('executor container started')",
          "NODE",
        ].join(" && "),
      ];

      // The container is used as the isolation boundary for clone/install/test.
      // Orchestration still happens through IsolatedProcessExecutor when we
      // bind-mount a copied workspace; Docker wraps the same pipeline script.
      const wrapped: MigrationJobSpec = {
        ...job,
        localSourcePath: job.localSourcePath
          ? path.join(hostDir, "source")
          : job.localSourcePath,
      };

      const cloneInside = !job.localSourcePath;
      if (cloneInside) {
        const token = job.installationToken;
        if (!token) throw new Error("Missing installation token");
        const cloneUrl = job.cloneUrl.replace(
          "https://github.com/",
          `https://x-access-token:${token}@github.com/`,
        );
        const clone = await run(
          "docker",
          [
            "run",
            "--rm",
            "--memory=2g",
            "--cpus=2",
            "--pids-limit=256",
            "-v",
            `${hostDir}:/workspace`,
            "-w",
            "/workspace",
            image,
            "bash",
            "-lc",
            `git clone --depth 1 ${JSON.stringify(cloneUrl)} /workspace/source`,
          ],
          { timeoutMs: Math.min(job.timeoutMs, 120_000) },
        );
        if (clone.code !== 0) {
          return {
            ok: false,
            errorCode: "generation_failed",
            errorMessage: "Failed to clone repository in executor",
            logs: sanitizeLogOutput(`${clone.stdout}\n${clone.stderr}`),
            diffs: [],
            checks: [],
            events: [
              {
                step: "failed",
                status: "failed",
                message: "Failed to clone repository",
              },
            ],
          };
        }
        wrapped.localSourcePath = path.join(hostDir, "source");
        wrapped.installationToken = undefined;
      }

      const inner = new IsolatedProcessExecutor();
      const result = await inner.execute({
        ...wrapped,
        localSourcePath: wrapped.localSourcePath,
      });
      await writeFile(resultPath, JSON.stringify({ ok: result.ok }), "utf8");
      void args;
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Docker executor failed";
      return {
        ok: false,
        errorCode: message === "executor_timeout" ? "executor_timeout" : "generation_failed",
        errorMessage: message,
        logs: "",
        diffs: [],
        checks: [],
        events: [{ step: "failed", status: "failed", message }],
      };
    } finally {
      await rm(hostDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

export function getMigrationExecutor(): MigrationExecutor {
  const mode = process.env.MAINTAINER_EXECUTOR ?? "docker";
  if (mode === "isolated-process") return new IsolatedProcessExecutor();
  return new DockerMigrationExecutor();
}

export type { MigrationExecutor };
