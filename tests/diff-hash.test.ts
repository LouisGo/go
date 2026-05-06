import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { computeDiffHash } from "../src/git/diff-hash.js";

const execFileAsync = promisify(execFile);

describe("diff_hash", () => {
  it("干净工作区生成稳定 hash，并忽略生成型恢复文件", async () => {
    await using repo = await createCommittedRepo();
    const firstHash = await computeDiffHash({ cwd: repo.path });

    await mkdir(join(repo.path, ".louisgo"), { recursive: true });
    await mkdir(join(repo.path, ".louisgo", "sessions"), { recursive: true });
    await mkdir(join(repo.path, ".louisgo", "stats"), { recursive: true });
    await writeFile(join(repo.path, ".louisgo", "test-results.json"), "{}\n", "utf8");
    await writeFile(join(repo.path, ".louisgo", "RUNLOG.md"), "# Run Log\n", "utf8");
    await writeFile(join(repo.path, ".louisgo", "HANDOFF.md"), "# Handoff\n", "utf8");
    await writeFile(join(repo.path, ".louisgo", "HANDOFF_DRAFT.md"), "# Draft\n", "utf8");
    await writeFile(join(repo.path, ".louisgo", "QUICK_SAVE.md"), "# Quick Save\n", "utf8");
    await writeFile(join(repo.path, ".louisgo", "STATE.md"), "# State\n", "utf8");
    await writeFile(join(repo.path, ".louisgo", "CONFIRM_REQ.md"), "# Confirm\n", "utf8");
    await writeFile(join(repo.path, ".louisgo", "sessions", "one.md"), "# Session\n", "utf8");
    await writeFile(join(repo.path, ".louisgo", "stats", "events.jsonl"), "{}\n", "utf8");

    await expect(computeDiffHash({ cwd: repo.path })).resolves.toBe(firstHash);
    expect(firstHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("已跟踪文件内容变化会改变 hash", async () => {
    await using repo = await createCommittedRepo();
    const cleanHash = await computeDiffHash({ cwd: repo.path });

    await writeFile(join(repo.path, "tracked.txt"), "two\n", "utf8");
    const modifiedHash = await computeDiffHash({ cwd: repo.path });
    await writeFile(join(repo.path, "tracked.txt"), "three\n", "utf8");
    const nextModifiedHash = await computeDiffHash({ cwd: repo.path });

    expect(modifiedHash).not.toBe(cleanHash);
    expect(nextModifiedHash).not.toBe(modifiedHash);
  });

  it("暂存区内容变化会改变 hash", async () => {
    await using repo = await createCommittedRepo();
    const cleanHash = await computeDiffHash({ cwd: repo.path });

    await writeFile(join(repo.path, "tracked.txt"), "two\n", "utf8");
    await git(repo.path, ["add", "tracked.txt"]);
    const stagedHash = await computeDiffHash({ cwd: repo.path });
    await writeFile(join(repo.path, "tracked.txt"), "three\n", "utf8");
    await git(repo.path, ["add", "tracked.txt"]);
    const nextStagedHash = await computeDiffHash({ cwd: repo.path });

    expect(stagedHash).not.toBe(cleanHash);
    expect(nextStagedHash).not.toBe(stagedHash);
  });

  it("未跟踪文件新增、删除和内容变化会改变 hash", async () => {
    await using repo = await createCommittedRepo();
    const cleanHash = await computeDiffHash({ cwd: repo.path });
    const untrackedPath = join(repo.path, "untracked.txt");

    await writeFile(untrackedPath, "one\n", "utf8");
    const addedHash = await computeDiffHash({ cwd: repo.path });
    await writeFile(untrackedPath, "two\n", "utf8");
    const changedHash = await computeDiffHash({ cwd: repo.path });
    await unlink(untrackedPath);
    const deletedHash = await computeDiffHash({ cwd: repo.path });

    expect(addedHash).not.toBe(cleanHash);
    expect(changedHash).not.toBe(addedHash);
    expect(deletedHash).toBe(cleanHash);
  });

  it("无首个提交仓库也能生成稳定 hash", async () => {
    await using repo = await createTempRepo();

    const emptyHash = await computeDiffHash({ cwd: repo.path });
    await writeFile(join(repo.path, "tracked.txt"), "one\n", "utf8");
    await git(repo.path, ["add", "tracked.txt"]);
    const stagedHash = await computeDiffHash({ cwd: repo.path });

    await expect(computeDiffHash({ cwd: repo.path })).resolves.toBe(stagedHash);
    expect(emptyHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stagedHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stagedHash).not.toBe(emptyHash);
  });
});

interface TempRepo extends AsyncDisposable {
  readonly path: string;
}

async function createCommittedRepo(): Promise<TempRepo> {
  const repo = await createTempRepo();
  await writeFile(join(repo.path, "tracked.txt"), "one\n", "utf8");
  await git(repo.path, ["add", "tracked.txt"]);
  await git(repo.path, [
    "-c",
    "user.email=a@example.com",
    "-c",
    "user.name=a",
    "commit",
    "-m",
    "init",
  ]);
  return repo;
}

async function createTempRepo(): Promise<TempRepo> {
  const path = await mkdtemp(join(tmpdir(), "louisgo-"));
  await git(path, ["init"]);

  return {
    path,
    async [Symbol.asyncDispose]() {
      await rm(path, { force: true, recursive: true });
    },
  };
}

async function git(cwd: string, args: readonly string[]): Promise<void> {
  await execFileAsync("git", [...args], { cwd });
}
