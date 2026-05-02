import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { findGitRoot } from "../fs/workspace.js";

const execFileAsync = promisify(execFile);

export const noGitHead = "NO_HEAD";

export interface GitCommandOptions {
  readonly cwd?: string;
}

export interface GitCommandResult {
  readonly stdout: string;
  readonly stderr: string;
}

export async function getGitRoot(options: GitCommandOptions = {}): Promise<string> {
  return findGitRoot(options.cwd);
}

export async function getGitHead(options: GitCommandOptions = {}): Promise<string> {
  const gitRoot = await getGitRoot(options);
  const result = await runGit(["rev-parse", "--verify", "HEAD"], {
    cwd: gitRoot,
    allowFailure: true,
  });

  if (result.exitCode !== 0) {
    return noGitHead;
  }

  return result.stdout.trim() || noGitHead;
}

export async function runGit(
  args: readonly string[],
  options: GitCommandOptions & { readonly allowFailure?: boolean } = {},
): Promise<GitCommandResult & { readonly exitCode: number }> {
  try {
    const result = await execFileAsync("git", [...args], {
      cwd: options.cwd,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: 0,
    };
  } catch (error) {
    if (options.allowFailure && isExecError(error)) {
      return {
        stdout: typeof error.stdout === "string" ? error.stdout : "",
        stderr: typeof error.stderr === "string" ? error.stderr : "",
        exitCode: typeof error.code === "number" ? error.code : 1,
      };
    }

    throw error;
  }
}

function isExecError(error: unknown): error is {
  readonly code?: number;
  readonly stdout?: unknown;
  readonly stderr?: unknown;
} {
  return typeof error === "object" && error !== null;
}
