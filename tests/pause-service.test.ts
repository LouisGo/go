import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { initLouisGo } from "../src/services/init-service.js";
import {
  pauseLouisGo,
  pauseResultStatuses,
  PauseServiceError,
  pauseServiceErrorCodes,
} from "../src/services/pause-service.js";

const execFileAsync = promisify(execFile);
const initNow = () => new Date("2026-05-01T12:00:00.000Z");

describe("pause service", () => {
  it("正常生成私有任务 checkpoint", async () => {
    await using repo = await createGitRepo();
    await initLouisGo({ cwd: repo.path, now: initNow });

    const result = await pauseLouisGo({
      cwd: repo.path,
      now: () => new Date("2026-05-01T12:10:00.000Z"),
      louisgoHome: repo.louisgoHome,
    });

    expect(result.status).toBe(pauseResultStatuses.created);
    expect(result.task.meta).toMatchObject({
      task_id: "T001",
      updated_at: "2026-05-01T12:10:00.000Z",
    });
    expect(result.task.meta.diff_hash).toMatch(/^[a-f0-9]{64}$/);
    await expect(access(result.filePath)).resolves.toBeUndefined();
    await expect(readFile(result.task.taskPaths.resume, "utf8")).resolves.toContain(
      "Resume Prompt",
    );
  });

  it("已存在 checkpoint 时更新暂停点", async () => {
    await using repo = await createGitRepo();
    await initLouisGo({ cwd: repo.path, now: initNow });

    const first = await pauseLouisGo({
      cwd: repo.path,
      now: () => new Date("2026-05-01T12:10:00.000Z"),
      louisgoHome: repo.louisgoHome,
    });
    const second = await pauseLouisGo({
      cwd: repo.path,
      now: () => new Date("2026-05-01T12:20:00.000Z"),
      louisgoHome: repo.louisgoHome,
    });

    expect(first.status).toBe(pauseResultStatuses.created);
    expect(second.status).toBe(pauseResultStatuses.updated);
    expect(second.task.meta.updated_at).toBe("2026-05-01T12:20:00.000Z");
  });

  it("缺少协议文件时提示先 init", async () => {
    await using repo = await createGitRepo();

    await expect(pauseLouisGo({ cwd: repo.path })).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof PauseServiceError &&
        error.code === pauseServiceErrorCodes.protocolIncomplete &&
        error.message.includes("louisgo init") &&
        error.issues.length > 0,
    );
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
