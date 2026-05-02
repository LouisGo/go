import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { createProtocolPaths } from "../src/protocol/paths.js";
import type { TestResultStatus } from "../src/protocol/schemas.js";
import { writeTestResults } from "../src/protocol/test-results.js";
import { checkVerificationFreshness, getCurrentGitSnapshot } from "../src/verify/freshness.js";

const execFileAsync = promisify(execFile);
const timestamp = "2026-05-01T20:00:00+08:00";
const completedAt = "2026-05-01T20:01:00+08:00";

describe("验证结果新鲜度", () => {
  it.each(["passed", "failed", "error", "skipped"] satisfies readonly TestResultStatus[])(
    "当前状态匹配时返回 %s",
    async (status) => {
      await using repo = await createCommittedRepo();
      const paths = createProtocolPaths(repo.path);
      const snapshot = await getCurrentGitSnapshot({ cwd: repo.path });

      await writeResult(paths.testResults, snapshot, status);

      await expect(
        checkVerificationFreshness({ cwd: repo.path, testResultsPath: paths.testResults }),
      ).resolves.toMatchObject({
        status,
        currentSnapshot: snapshot,
        staleReason: null,
      });
    },
  );

  it("Git HEAD 不匹配时返回 stale", async () => {
    await using repo = await createCommittedRepo();
    const paths = createProtocolPaths(repo.path);
    const snapshot = await getCurrentGitSnapshot({ cwd: repo.path });

    await writeResult(paths.testResults, { ...snapshot, gitHead: "other-head" }, "passed");

    await expect(
      checkVerificationFreshness({ cwd: repo.path, testResultsPath: paths.testResults }),
    ).resolves.toMatchObject({
      status: "stale",
      staleReason: "git_head_mismatch",
      currentSnapshot: snapshot,
    });
  });

  it("diff_hash 不匹配时返回 stale", async () => {
    await using repo = await createCommittedRepo();
    const paths = createProtocolPaths(repo.path);
    const snapshot = await getCurrentGitSnapshot({ cwd: repo.path });

    await writeResult(paths.testResults, snapshot, "passed");
    await writeFile(join(repo.path, "tracked.txt"), "two\n", "utf8");

    const freshness = await checkVerificationFreshness({
      cwd: repo.path,
      testResultsPath: paths.testResults,
    });

    expect(freshness).toMatchObject({
      status: "stale",
      staleReason: "diff_hash_mismatch",
    });
    expect(freshness.currentSnapshot?.gitHead).toBe(snapshot.gitHead);
    expect(freshness.currentSnapshot?.diffHash).not.toBe(snapshot.diffHash);
  });

  it("文件缺失时返回 missing", async () => {
    await using repo = await createCommittedRepo();
    const paths = createProtocolPaths(repo.path);

    await expect(
      checkVerificationFreshness({ cwd: repo.path, testResultsPath: paths.testResults }),
    ).resolves.toMatchObject({
      status: "missing",
      testResults: null,
      currentSnapshot: null,
      staleReason: null,
    });
  });
});

interface TempRepo extends AsyncDisposable {
  readonly path: string;
}

interface Snapshot {
  readonly gitHead: string;
  readonly diffHash: string;
}

async function createCommittedRepo(): Promise<TempRepo> {
  const path = await mkdtemp(join(tmpdir(), "louisgo-"));
  await git(path, ["init"]);
  await writeFile(join(path, "tracked.txt"), "one\n", "utf8");
  await git(path, ["add", "tracked.txt"]);
  await git(path, ["-c", "user.email=a@example.com", "-c", "user.name=a", "commit", "-m", "init"]);

  return {
    path,
    async [Symbol.asyncDispose]() {
      await rm(path, { force: true, recursive: true });
    },
  };
}

async function writeResult(
  filePath: string,
  snapshot: Snapshot,
  status: TestResultStatus,
): Promise<void> {
  await writeTestResults(filePath, {
    command: ".louisgo/scripts/verify.sh",
    exitCode: status === "passed" || status === "skipped" ? 0 : 1,
    status,
    gitHead: snapshot.gitHead,
    diffHash: snapshot.diffHash,
    startedAt: timestamp,
    completedAt,
    summary: status,
  });
}

async function git(cwd: string, args: readonly string[]): Promise<void> {
  await execFileAsync("git", [...args], { cwd });
}
