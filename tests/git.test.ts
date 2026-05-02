import { execFile } from "node:child_process";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { workspaceErrorCodes } from "../src/fs/workspace.js";
import { getGitHead, getGitRoot, noGitHead } from "../src/git/git.js";
import { getGitPorcelainStatus, parsePorcelainStatus } from "../src/git/status.js";

const execFileAsync = promisify(execFile);

describe("Git 基础能力", () => {
  it("有提交仓库可以读取 Git 根目录、HEAD 和 porcelain status", async () => {
    await using repo = await createTempDir();
    const filePath = join(repo.path, "tracked.txt");

    await execFileAsync("git", ["init"], { cwd: repo.path });
    await writeFile(filePath, "one\n", "utf8");
    await execFileAsync("git", ["add", "tracked.txt"], { cwd: repo.path });
    await execFileAsync(
      "git",
      ["-c", "user.email=a@example.com", "-c", "user.name=a", "commit", "-m", "init"],
      { cwd: repo.path },
    );
    await writeFile(filePath, "two\n", "utf8");
    await writeFile(join(repo.path, "untracked.txt"), "new\n", "utf8");

    const gitRoot = await getGitRoot({ cwd: repo.path });
    const gitHead = await getGitHead({ cwd: repo.path });
    const status = await getGitPorcelainStatus({ cwd: repo.path });

    await expect(realpath(repo.path)).resolves.toBe(gitRoot);
    expect(gitHead).toMatch(/^[0-9a-f]{40}$/);
    expect(status).toEqual(
      expect.arrayContaining([
        {
          indexStatus: " ",
          workTreeStatus: "M",
          path: "tracked.txt",
        },
        {
          indexStatus: "?",
          workTreeStatus: "?",
          path: "untracked.txt",
        },
      ]),
    );
  });

  it("无提交仓库返回 NO_HEAD", async () => {
    await using repo = await createTempDir();
    await execFileAsync("git", ["init"], { cwd: repo.path });

    await expect(getGitHead({ cwd: repo.path })).resolves.toBe(noGitHead);
  });

  it("非 Git 仓库返回明确错误", async () => {
    await using repo = await createTempDir();

    await expect(getGitRoot({ cwd: repo.path })).rejects.toMatchObject({
      code: workspaceErrorCodes.notGitRepository,
    });
    await expect(getGitHead({ cwd: repo.path })).rejects.toMatchObject({
      code: workspaceErrorCodes.notGitRepository,
    });
    await expect(getGitPorcelainStatus({ cwd: repo.path })).rejects.toMatchObject({
      code: workspaceErrorCodes.notGitRepository,
    });
  });

  it("可以解析 rename porcelain -z 输出", () => {
    expect(parsePorcelainStatus("R  new-name.txt\0old-name.txt\0")).toEqual([
      {
        indexStatus: "R",
        workTreeStatus: " ",
        path: "new-name.txt",
        originalPath: "old-name.txt",
      },
    ]);
  });
});

interface TempDir extends AsyncDisposable {
  readonly path: string;
}

async function createTempDir(): Promise<TempDir> {
  const path = await mkdtemp(join(tmpdir(), "louisgo-"));

  return {
    path,
    async [Symbol.asyncDispose]() {
      await rm(path, { force: true, recursive: true });
    },
  };
}
