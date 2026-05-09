import { execFile } from "node:child_process";
import { mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { createProtocolPaths } from "../src/protocol/paths.js";
import { initLouisGo } from "../src/services/init-service.js";
import { pauseLouisGo } from "../src/services/pause-service.js";
import { checkProtocolStatus, protocolIssueCodes } from "../src/services/status-service.js";
import { writeTaskVerification } from "../src/store/task-store.js";
import { getCurrentGitSnapshot } from "../src/verify/freshness.js";

const execFileAsync = promisify(execFile);
const now = () => new Date("2026-05-01T12:00:00.000Z");
const timestamp = "2026-05-01T20:00:00+08:00";

describe("status service", () => {
  it("识别完整项目 anchor 且无 active task", async () => {
    await using repo = await createGitRepo();
    const initResult = await initLouisGo({ cwd: repo.path, now });

    const status = await checkProtocolStatus({ cwd: repo.path, louisgoHome: repo.louisgoHome });

    expect(status).toMatchObject({
      workspaceRoot: initResult.workspaceRoot,
      complete: true,
      mode: "assist",
      phase: "idle",
      recoverySource: "none",
      verificationStatus: "missing",
      hasConfirmReq: false,
      adrDrafts: [],
      issues: [],
    });
    expect(status.currentTask).toBeNull();
  });

  it("识别 active private task", async () => {
    await using repo = await createGitRepo();
    await initLouisGo({ cwd: repo.path, now });
    await pauseLouisGo({ cwd: repo.path, louisgoHome: repo.louisgoHome, now });

    const status = await checkProtocolStatus({ cwd: repo.path, louisgoHome: repo.louisgoHome });

    expect(status.recoverySource).toBe("task");
    expect(status.currentTask?.task_id).toBe("T001");
    expect(status.privateStore.path).toContain(repo.louisgoHome);
  });

  it("报告缺失 anchor 文件", async () => {
    await using repo = await createGitRepo();
    const initResult = await initLouisGo({ cwd: repo.path, now });
    const paths = createProtocolPaths(initResult.workspaceRoot);

    await unlink(paths.mission);

    const status = await checkProtocolStatus({ cwd: repo.path, louisgoHome: repo.louisgoHome });

    expect(status.complete).toBe(false);
    expect(status.issues).toContainEqual(
      expect.objectContaining({
        code: protocolIssueCodes.missingPath,
        filePath: paths.mission,
        relativePath: ".louisgo/MISSION.md",
      }),
    );
  });

  it("识别 private task 验证结果状态", async () => {
    await using repo = await createGitRepo();
    await initLouisGo({ cwd: repo.path, now });
    const snapshot = await getCurrentGitSnapshot({ cwd: repo.path });

    await writeTaskVerification({
      cwd: repo.path,
      louisgoHome: repo.louisgoHome,
      testResults: {
        schema: "louisgo-test-results-v1",
        command: "louisgo verify",
        exitCode: 0,
        status: "passed",
        gitHead: snapshot.gitHead,
        diffHash: snapshot.diffHash,
        startedAt: timestamp,
        completedAt: "2026-05-01T20:01:00+08:00",
        summary: "验证通过",
      },
    });

    const status = await checkProtocolStatus({ cwd: repo.path, louisgoHome: repo.louisgoHome });

    expect(status.complete).toBe(true);
    expect(status.verificationStatus).toBe("passed");
  });

  it("忽略兼容 test-results.json", async () => {
    await using repo = await createGitRepo();
    const initResult = await initLouisGo({ cwd: repo.path, now });
    const paths = createProtocolPaths(initResult.workspaceRoot);

    await writeFile(paths.testResults, '{"schema":"wrong"}\n', "utf8");

    const status = await checkProtocolStatus({ cwd: repo.path, louisgoHome: repo.louisgoHome });

    expect(status.complete).toBe(true);
    expect(status.verificationStatus).toBe("missing");
    expect(status.issues).toEqual([]);
  });
});

interface TempRepo extends AsyncDisposable {
  readonly path: string;
  readonly louisgoHome: string;
}

async function createGitRepo(): Promise<TempRepo> {
  const path = await mkdtemp(join(tmpdir(), "louisgo-"));
  const louisgoHome = await mkdtemp(join(tmpdir(), "louisgo-home-"));
  await execFileAsync("git", ["init"], { cwd: path });

  return {
    path,
    louisgoHome,
    async [Symbol.asyncDispose]() {
      await rm(path, { force: true, recursive: true });
      await rm(louisgoHome, { force: true, recursive: true });
    },
  };
}
