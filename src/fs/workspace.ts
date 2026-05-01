import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const workspaceErrorCodes = {
  notGitRepository: "NOT_GIT_REPOSITORY",
} as const;

export type WorkspaceErrorCode = (typeof workspaceErrorCodes)[keyof typeof workspaceErrorCodes];

export class WorkspaceError extends Error {
  readonly code: WorkspaceErrorCode;
  readonly cwd: string;

  constructor(code: WorkspaceErrorCode, cwd: string, message: string) {
    super(message);
    this.name = "WorkspaceError";
    this.code = code;
    this.cwd = cwd;
  }
}

export async function findGitRoot(startDir: string = process.cwd()): Promise<string> {
  const cwd = resolve(startDir);

  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "--show-toplevel"], { cwd });
    const gitRoot = stdout.trim();

    if (gitRoot.length === 0) {
      throw createNotGitRepositoryError(cwd);
    }

    return await realpath(gitRoot);
  } catch (error) {
    if (error instanceof WorkspaceError) {
      throw error;
    }

    throw createNotGitRepositoryError(cwd);
  }
}

function createNotGitRepositoryError(cwd: string): WorkspaceError {
  return new WorkspaceError(
    workspaceErrorCodes.notGitRepository,
    cwd,
    `当前目录不在 Git 仓库中：${cwd}。请先执行 git init。`,
  );
}
